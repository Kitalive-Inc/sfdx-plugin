import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { Connection, SfError } from '@salesforce/core';
import {
  ForceIgnore,
  MetadataResolver,
  SourceComponent,
} from '@salesforce/source-deploy-retrieve';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import fs from 'fs-extra';
import sgd from 'sfdx-git-delta';
import { stubApexMethods } from './apex.js';
import { emptyFlowXml } from './flow.js';

const execFileAsync = promisify(execFile);
const namespace = 'http://soap.sforce.com/2006/04/metadata';
const forcedRecreateTypes = new Set([
  'Formula',
  'MasterDetail',
  'Lookup',
  'EncryptedText',
]);
const autoCleanupTypes = new Set([
  'Layout',
  'Report',
  'ListView',
  'Profile',
  'PermissionSet',
]);

export type FieldTypeChange = {
  fullName: string;
  fromType: string;
  toType: string;
  path: string;
  warning: string;
};

export type ManualReview = {
  path: string;
  line?: number;
  reason: string;
};

export type SourceDeltaResult = {
  outputDirectory: string;
  deploymentInstructions: string;
  diagnostics: string[];
  fieldTypeChanges: FieldTypeChange[];
  flows: string[];
  manualReview: ManualReview[];
  warnings: string[];
  hardBlockers: string[];
  deploySteps: string[];
  manifests: {
    package: string;
    preDestructive?: string;
    postDestructive?: string;
    preDeployPackage?: string;
    preDeployPostDestructive?: string;
  };
};

type Manifest = Map<string, Set<string>>;

function hasManifestMembers(manifest: Manifest): boolean {
  return [...manifest.values()].some((members) => members.size > 0);
}

type Dependency = {
  id: string;
  type: string;
  fullName: string;
  managed: boolean;
  fieldNames: string[];
};

type DependencyRow = {
  MetadataComponentId: string;
  MetadataComponentType: string;
  RefMetadataComponentId: string;
};

type ToolingCustomFieldRow = {
  Id: string;
  DeveloperName: string;
  NamespacePrefix?: string;
  TableEnumOrId: string;
};

type EntityDefinitionRow = {
  DurableId: string;
  QualifiedApiName: string;
};

type ToolingFieldDefinitionRow = {
  DurableId: string;
  EntityDefinitionId: string;
  NamespacePrefix?: string;
  QualifiedApiName: string;
};

type CustomFieldName = {
  fullName: string;
  objectName: string;
  fieldName: string;
};

type PackageDirectory = { [key: string]: unknown; path: string };

type DeploymentStep = {
  command: string;
  title: string;
};

type FlowMetadataFile = {
  Flow?: {
    apiVersion?: string;
    label?: string;
    processType?: string;
  };
};

export type GenerateSourceDeltaOptions = {
  root: string;
  packageDirectories: PackageDirectory[];
  from: string;
  outputDirectory: string;
  apiVersion?: string;
  force?: boolean;
  verbose?: boolean;
  targetOrg?: string;
  connection?: Connection;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false,
});
const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  indentBy: '    ',
  suppressEmptyNode: true,
});

async function git(root: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  return result.stdout.trimEnd();
}

async function gitFile(
  root: string,
  revision: string,
  filepath: string
): Promise<string | undefined> {
  try {
    return await git(root, ['show', `${revision}:${filepath}`]);
  } catch {
    return undefined;
  }
}

function array<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function effectiveFieldType(xml: string): string {
  if (/<formula(?:\s[^>]*)?>[\s\S]*?<\/formula>/.test(xml)) return 'Formula';
  const match = xml.match(/<type>([^<]+)<\/type>/);
  return match?.[1]?.trim() ?? 'Unknown';
}

function fieldFullName(filepath: string): string | undefined {
  const normalized = filepath.replaceAll('\\', '/');
  const match = normalized.match(
    /\/objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/
  );
  return match ? `${match[1]}.${match[2]}` : undefined;
}

async function detectFieldTypeChanges(
  options: GenerateSourceDeltaOptions,
  forceIgnore: ForceIgnore
): Promise<FieldTypeChange[]> {
  const sourcePaths = options.packageDirectories.map((item) => item.path);
  const changed = await git(options.root, [
    'diff',
    '--name-only',
    options.from,
    'HEAD',
    '--',
    ...sourcePaths,
  ]);
  const results: FieldTypeChange[] = [];
  for (const filepath of changed.split('\n').filter(Boolean)) {
    if (!filepath.endsWith('.field-meta.xml')) continue;
    if (forceIgnore.denies(path.join(options.root, filepath))) continue;
    const fullName = fieldFullName(filepath);
    if (!fullName) continue;
    // eslint-disable-next-line no-await-in-loop
    const [fromXml, toXml] = await Promise.all([
      gitFile(options.root, options.from, filepath),
      gitFile(options.root, 'HEAD', filepath),
    ]);
    if (!fromXml || !toXml) continue;
    const fromType = effectiveFieldType(fromXml);
    const toType = effectiveFieldType(toXml);
    if (fromType === toType) continue;
    if (!forcedRecreateTypes.has(fromType) && !forcedRecreateTypes.has(toType))
      continue;
    results.push({
      fullName,
      fromType,
      toType,
      path: filepath,
      warning: `${fullName}: deleting and recreating the field can discard stored data (${fromType} -> ${toType})`,
    });
  }
  return results.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function parseManifest(xml: string | undefined): {
  manifest: Manifest;
  version?: string;
} {
  const manifest: Manifest = new Map();
  if (!xml) return { manifest };
  const data = parser.parse(xml) as {
    Package?: {
      types?: Array<{ name: string; members?: string | string[] }>;
      version?: string;
    };
  };
  for (const type of array(data.Package?.types)) {
    manifest.set(type.name, new Set(array(type.members)));
  }
  return { manifest, version: data.Package?.version };
}

function addManifest(manifest: Manifest, type: string, fullName: string): void {
  const members = manifest.get(type) ?? new Set<string>();
  members.add(fullName);
  manifest.set(type, members);
}

function manifestXml(manifest: Manifest, version: string): string {
  const types = [...manifest]
    .filter(([, members]) => members.size)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, members]) => ({
      members: [...members].sort((a, b) => a.localeCompare(b)),
      name,
    }));
  const content = builder.build({
    Package: {
      '@_xmlns': namespace,
      types,
      version,
    },
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${content}\n`;
}

async function sourceIndex(
  root: string,
  packageDirectories: PackageDirectory[]
): Promise<Map<string, SourceComponent>> {
  const resolver = new MetadataResolver(undefined, undefined, true);
  const index = new Map<string, SourceComponent>();
  const add = (component: SourceComponent): void => {
    index.set(`${component.type.name}#${component.fullName}`, component);
    component.getChildren().forEach(add);
  };
  for (const directory of packageDirectories) {
    const absolute = path.join(root, directory.path);
    // eslint-disable-next-line no-await-in-loop
    if (!(await fs.pathExists(absolute))) continue;
    for (const component of resolver.getComponentsFromPath(absolute)) {
      add(component);
    }
  }
  return index;
}

class DependencyResolver {
  private readonly metadataByType = new Map<
    string,
    Map<string, { id: string; fullName: string; managed: boolean }>
  >();

  public constructor(
    private readonly conn: Connection,
    private readonly diagnostics?: string[]
  ) {}

  public async resolve(fields: FieldTypeChange[]): Promise<{
    dependencies: Dependency[];
    unresolved: string[];
  }> {
    const customFields = await this.targetCustomFields(fields);
    const fieldItems = fields
      .map((field) => customFields.get(field.fullName))
      .filter(
        (item): item is { id: string; fullName: string; managed: boolean } =>
          Boolean(item)
      );
    const missingFields = fields
      .filter((field) => !customFields.has(field.fullName))
      .map(
        (field) => `CustomField was not found in the org: ${field.fullName}`
      );
    if (missingFields.length)
      this.diagnostic('Unresolved target CustomFields', missingFields);
    const fieldNameById = new Map(
      fieldItems.map((item) => [this.salesforceIdKey(item.id), item.fullName])
    );
    const seen = new Map<string, Dependency>();
    const unresolved = [...missingFields];
    if (!fieldItems.length) return { dependencies: [], unresolved };

    const rows = (await this.conn.tooling
      .sobject('MetadataComponentDependency')
      .select(
        'MetadataComponentId, MetadataComponentType, RefMetadataComponentId'
      )
      .where({
        RefMetadataComponentId: fieldItems.map((item) => item.id),
      })) as unknown as DependencyRow[];
    const rowsByType = new Map<string, DependencyRow[]>();
    for (const row of rows) {
      const items = rowsByType.get(row.MetadataComponentType) ?? [];
      items.push(row);
      rowsByType.set(row.MetadataComponentType, items);
    }
    for (const [type, typeRows] of rowsByType) {
      // eslint-disable-next-line no-await-in-loop
      const metadata =
        type === 'CustomField'
          ? // eslint-disable-next-line no-await-in-loop
            await this.customFieldsByIds(
              typeRows.map((row) => row.MetadataComponentId)
            )
          : // eslint-disable-next-line no-await-in-loop
            await this.metadata(type);
      for (const row of typeRows) {
        const item = metadata.get(row.MetadataComponentId);
        if (!item) {
          unresolved.push(
            `Unable to resolve ${type} with id ${row.MetadataComponentId}`
          );
          continue;
        }
        const fieldName = fieldNameById.get(
          this.salesforceIdKey(row.RefMetadataComponentId)
        );
        if (!fieldName) continue;
        const existing = seen.get(item.id);
        if (existing) {
          if (!existing.fieldNames.includes(fieldName))
            existing.fieldNames.push(fieldName);
          continue;
        }
        seen.set(item.id, {
          id: item.id,
          type,
          fullName: item.fullName,
          managed: item.managed,
          fieldNames: [fieldName],
        });
      }
    }
    return { dependencies: [...seen.values()], unresolved };
  }

  private async targetCustomFields(
    fields: FieldTypeChange[]
  ): Promise<Map<string, { id: string; fullName: string; managed: boolean }>> {
    const names = fields
      .map((field) => this.customFieldName(field.fullName))
      .filter((name): name is CustomFieldName => Boolean(name));
    const entities = await this.entityDefinitions(
      'QualifiedApiName',
      names.map((name) => name.objectName)
    );
    const entityIdByName = new Map(
      entities.map((entity) => [entity.QualifiedApiName, entity.DurableId])
    );
    const objectNameByEntityId = new Map(
      entities.map((entity) => [
        this.salesforceIdKey(entity.DurableId),
        entity.QualifiedApiName,
      ])
    );
    const tableIds = names
      .map((name) => entityIdByName.get(name.objectName))
      .filter((id): id is string => Boolean(id));
    if (!tableIds.length) return new Map();
    const definitions = (
      await Promise.all(
        names.map(async (name) => {
          const tableId = entityIdByName.get(name.objectName);
          if (!tableId) return [];
          const where = {
            EntityDefinitionId: tableId,
            QualifiedApiName: name.fieldName,
          };
          this.diagnostic('FieldDefinition query', {
            fullName: name.fullName,
            where,
          });
          const result = (await this.conn.tooling
            .sobject('FieldDefinition')
            .select(
              'DurableId, EntityDefinitionId, NamespacePrefix, QualifiedApiName'
            )
            .where(where)) as unknown as ToolingFieldDefinitionRow[];
          this.diagnostic('FieldDefinition result', {
            fullName: name.fullName,
            rows: result,
          });
          return result;
        })
      )
    ).flat();
    const metadata = new Map<
      string,
      { id: string; fullName: string; managed: boolean }
    >();
    for (const definition of definitions) {
      const objectName = objectNameByEntityId.get(
        this.salesforceIdKey(definition.EntityDefinitionId)
      );
      const id = definition.DurableId.split('.').at(-1);
      if (!objectName || !id?.startsWith('00N')) continue;
      const fullName = `${objectName}.${definition.QualifiedApiName}`;
      const value = {
        id,
        fullName,
        managed: Boolean(definition.NamespacePrefix),
      };
      metadata.set(id, value);
      metadata.set(fullName, value);
    }
    this.diagnostic('Resolved CustomField full names', [
      ...new Set([...metadata.values()].map((item) => item.fullName)),
    ]);
    const result = new Map<
      string,
      { id: string; fullName: string; managed: boolean }
    >();
    for (const name of names) {
      const item = metadata.get(name.fullName);
      if (item) result.set(name.fullName, item);
    }
    return result;
  }

  private async customFieldsByIds(
    ids: string[]
  ): Promise<Map<string, { id: string; fullName: string; managed: boolean }>> {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return new Map();
    this.diagnostic('Dependent CustomField query', {
      where: { Id: uniqueIds },
    });
    const rows = (await this.conn.tooling
      .sobject('CustomField')
      .select('Id, DeveloperName, NamespacePrefix, TableEnumOrId')
      .where({ Id: uniqueIds })) as unknown as ToolingCustomFieldRow[];
    this.diagnostic('Dependent CustomField result', rows);
    const entities = await this.entityDefinitions(
      'DurableId',
      rows.map((row) => row.TableEnumOrId)
    );
    return this.customFieldMetadata(rows, entities);
  }

  private async entityDefinitions(
    field: 'DurableId' | 'QualifiedApiName',
    values: string[]
  ): Promise<EntityDefinitionRow[]> {
    const uniqueValues = [...new Set(values)];
    if (!uniqueValues.length) return [];
    const where = { [field]: uniqueValues };
    this.diagnostic('EntityDefinition query', { where });
    const rows = (await this.conn.tooling
      .sobject('EntityDefinition')
      .select('DurableId, QualifiedApiName')
      .where(where)) as unknown as EntityDefinitionRow[];
    this.diagnostic('EntityDefinition result', rows);
    return rows;
  }

  private customFieldMetadata(
    rows: ToolingCustomFieldRow[],
    entities: EntityDefinitionRow[]
  ): Map<string, { id: string; fullName: string; managed: boolean }> {
    const objectNameById = new Map(
      entities.map((entity) => [
        this.salesforceIdKey(entity.DurableId),
        entity.QualifiedApiName,
      ])
    );
    const result = new Map<
      string,
      { id: string; fullName: string; managed: boolean }
    >();
    for (const row of rows) {
      const objectName = objectNameById.get(
        this.salesforceIdKey(row.TableEnumOrId)
      );
      if (!objectName) continue;
      const fieldName = `${
        row.NamespacePrefix ? `${row.NamespacePrefix}__` : ''
      }${row.DeveloperName}__c`;
      const fullName = `${objectName}.${fieldName}`;
      const value = {
        id: row.Id,
        fullName,
        managed: Boolean(row.NamespacePrefix),
      };
      result.set(row.Id, value);
      result.set(fullName, value);
    }
    return result;
  }

  private customFieldName(fullName: string): CustomFieldName | undefined {
    const separator = fullName.indexOf('.');
    if (separator < 1) return undefined;
    const objectName = fullName.slice(0, separator);
    const fieldName = fullName.slice(separator + 1);
    if (!fieldName.endsWith('__c')) return undefined;
    return {
      fullName,
      objectName,
      fieldName,
    };
  }

  private diagnostic(label: string, value: unknown): void {
    this.diagnostics?.push(`${label}: ${JSON.stringify(value)}`);
  }

  private salesforceIdKey(value: string): string {
    return /^(?:00N|01I)[A-Za-z0-9]{12,15}$/.test(value)
      ? value.slice(0, 15)
      : value;
  }

  private async metadata(
    type: string
  ): Promise<Map<string, { id: string; fullName: string; managed: boolean }>> {
    const cached = this.metadataByType.get(type);
    if (cached) return cached;
    const result = new Map<
      string,
      { id: string; fullName: string; managed: boolean }
    >();
    try {
      for (const item of await this.conn.metadata.list({ type })) {
        if (!item.id || !item.fullName) continue;
        const value = {
          id: item.id,
          fullName: item.fullName,
          managed: Boolean(item.namespacePrefix),
        };
        result.set(item.id, value);
        result.set(item.fullName, value);
      }
    } catch {
      // The caller reports individual dependency ids as unresolved.
    }
    this.metadataByType.set(type, result);
    return result;
  }
}

function metadataInfo(
  filepath: string
): { type: string; fullName: string } | undefined {
  const normalized = filepath.replaceAll('\\', '/');
  const basename = path.posix.basename(normalized);
  const suffixes: Array<[RegExp, string]> = [
    [/\.cls$/, 'ApexClass'],
    [/\.trigger$/, 'ApexTrigger'],
    [/\.flow-meta\.xml$/, 'Flow'],
    [/\.flexipage-meta\.xml$/, 'FlexiPage'],
    [/\.layout-meta\.xml$/, 'Layout'],
    [/\.permissionset-meta\.xml$/, 'PermissionSet'],
    [/\.profile-meta\.xml$/, 'Profile'],
    [/\.validationRule-meta\.xml$/, 'ValidationRule'],
  ];
  for (const [suffix, type] of suffixes) {
    if (suffix.test(basename))
      return { type, fullName: basename.replace(suffix, '') };
  }
  const field = fieldFullName(normalized);
  if (field) return { type: 'CustomField', fullName: field };
  const listView = normalized.match(
    /\/objects\/([^/]+)\/listViews\/([^/]+)\.listView-meta\.xml$/
  );
  if (listView)
    return { type: 'ListView', fullName: `${listView[1]}.${listView[2]}` };
  const report = normalized.match(/\/reports\/(.+)\.report-meta\.xml$/);
  if (report) return { type: 'Report', fullName: report[1] };
  return undefined;
}

function constantFormula(xml: string): string {
  const type = xml.match(/<type>([^<]+)<\/type>/)?.[1];
  switch (type) {
    case 'Checkbox':
      return 'false';
    case 'Date':
      return 'DATE(2000, 1, 1)';
    case 'DateTime':
      return 'DATETIMEVALUE(&quot;2000-01-01 00:00:00&quot;)';
    case 'Text':
      return '&quot;&quot;';
    default:
      return '0';
  }
}

function transformReference(
  filepath: string,
  content: string,
  tokens: string[],
  reviews: ManualReview[]
): string | undefined {
  const info = metadataInfo(filepath);
  if (!info) return undefined;
  if (info.type === 'FlexiPage') {
    return content.replace(
      /<itemInstances>[\s\S]*?<\/itemInstances>\s*/g,
      (item) => (tokens.some((token) => item.includes(token)) ? '' : item)
    );
  }
  if (info.type === 'CustomField' && /<formula[\s>]/.test(content)) {
    return content.replace(
      /<formula(?:\s[^>]*)?>[\s\S]*?<\/formula>/,
      `<formula>${constantFormula(content)}</formula>`
    );
  }
  const lines = content.split('\n');
  const filtered = lines.filter(
    (line) => !tokens.some((token) => line.includes(token))
  );
  if (filtered.length !== lines.length) {
    reviews.push({
      path: filepath,
      reason:
        'XML lines containing field references were removed heuristically',
    });
  }
  return filtered.join('\n');
}

function componentFilepath(
  root: string,
  component: SourceComponent
): string | undefined {
  return [...component.walkContent(), component.content, component.xml]
    .filter((filepath): filepath is string => Boolean(filepath))
    .map((filepath) => path.relative(root, filepath).replaceAll('\\', '/'))
    .find((filepath) => {
      const info = metadataInfo(filepath);
      return (
        info?.type === component.type.name &&
        info.fullName === component.fullName
      );
    });
}

async function writePreDeploySource(
  options: GenerateSourceDeltaOptions,
  preRoot: string,
  filepath: string,
  content: string
): Promise<void> {
  await fs.outputFile(path.join(preRoot, filepath), content);
  if (filepath.endsWith('.cls') || filepath.endsWith('.trigger')) {
    const companionPath = `${filepath}-meta.xml`;
    const companion = await gitFile(options.root, options.from, companionPath);
    if (companion)
      await fs.outputFile(path.join(preRoot, companionPath), companion);
  }
}

async function writeEmptyFlowReference(
  options: GenerateSourceDeltaOptions,
  preRoot: string,
  filepath: string,
  content: string,
  dependency: Dependency,
  apiVersion: string,
  prePackage: Manifest,
  flows: Set<string>,
  warnings: string[],
  hardBlockers: string[]
): Promise<void> {
  try {
    const metadata = (parser.parse(content) as FlowMetadataFile).Flow;
    if (!metadata?.label || !metadata.processType) {
      hardBlockers.push(
        `Unable to generate an empty Flow from Git: ${dependency.fullName}`
      );
      return;
    }
    const flowApiVersion = metadata.apiVersion || apiVersion;
    if (!metadata.apiVersion)
      warnings.push(
        `${dependency.fullName}: Flow apiVersion was missing; using ${apiVersion}`
      );
    if (!['Flow', 'AutoLaunchedFlow'].includes(metadata.processType))
      warnings.push(
        `${dependency.fullName}: generated a best-effort empty Flow for processType ${metadata.processType}`
      );
    flows.add(dependency.fullName);
    addManifest(prePackage, 'Flow', dependency.fullName);
    await writePreDeploySource(
      options,
      preRoot,
      filepath,
      emptyFlowXml({
        apiVersion: flowApiVersion,
        label: metadata.label,
        processType: metadata.processType,
      })
    );
  } catch (error) {
    hardBlockers.push(
      `Unable to generate an empty Flow from Git: ${dependency.fullName} - ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function editReferences(
  options: GenerateSourceDeltaOptions,
  dependencies: Dependency[],
  source: Map<string, SourceComponent>,
  apiVersion: string,
  finalPackage: Manifest,
  prePackage: Manifest,
  prePostDestructive: Manifest,
  flows: Set<string>,
  reviews: ManualReview[],
  warnings: string[],
  hardBlockers: string[]
): Promise<void> {
  const preRoot = path.join(options.outputDirectory, 'preDeploy');

  for (const dependency of dependencies) {
    if (dependency.managed) continue;
    addManifest(finalPackage, dependency.type, dependency.fullName);
    if (autoCleanupTypes.has(dependency.type)) continue;
    const component = source.get(`${dependency.type}#${dependency.fullName}`);
    if (!component) continue;
    const filepath = componentFilepath(options.root, component);
    if (!filepath) {
      reviews.push({
        path: `${dependency.type}:${dependency.fullName}`,
        reason: 'A direct dependency uses an unsupported source format',
      });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const content = await gitFile(options.root, options.from, filepath);
    if (!content) continue;
    const info = metadataInfo(filepath);
    if (!info) {
      reviews.push({
        path: filepath,
        reason: 'A field reference was found in an unsupported metadata file',
      });
      continue;
    }
    if (info.type === 'Flow') {
      // eslint-disable-next-line no-await-in-loop
      await writeEmptyFlowReference(
        options,
        preRoot,
        filepath,
        content,
        dependency,
        apiVersion,
        prePackage,
        flows,
        warnings,
        hardBlockers
      );
      continue;
    }
    if (info.type === 'ApexClass') {
      const result = stubApexMethods(content, dependency.fieldNames);
      reviews.push(
        ...result.reviews.map((review) => ({
          path: filepath,
          line: review.line,
          reason: review.reason,
        }))
      );
      addManifest(prePackage, info.type, info.fullName);
      // eslint-disable-next-line no-await-in-loop
      await writePreDeploySource(options, preRoot, filepath, result.content);
      continue;
    }
    if (info.type === 'ApexTrigger') {
      reviews.push({
        path: filepath,
        reason: 'Apex triggers are not edited automatically',
      });
      addManifest(prePackage, info.type, info.fullName);
      // eslint-disable-next-line no-await-in-loop
      await writePreDeploySource(options, preRoot, filepath, content);
      continue;
    }
    if (
      info.type === 'CustomField' &&
      (content.includes('<summaryOperation>') ||
        content.includes('<type>Summary</type>'))
    ) {
      addManifest(prePostDestructive, info.type, info.fullName);
      continue;
    }
    const tokens = dependency.fieldNames.flatMap((fieldName) => [
      fieldName,
      fieldName.split('.')[1],
    ]);
    const transformed = transformReference(filepath, content, tokens, reviews);
    if (transformed === undefined || transformed === content) {
      warnings.push(`Reference could not be edited automatically: ${filepath}`);
      continue;
    }
    addManifest(prePackage, info.type, info.fullName);
    // eslint-disable-next-line no-await-in-loop
    await writePreDeploySource(options, preRoot, filepath, transformed);
  }
}

function deploymentSteps(
  outputDirectory: string,
  hasPreDeploy: boolean,
  hasPrePostDestructive: boolean,
  hasPreDestructive: boolean,
  hasPostDestructive: boolean,
  flows: string[],
  targetOrg?: string
): DeploymentStep[] {
  const relative = (value: string) =>
    path.relative(process.cwd(), value) || '.';
  const steps: DeploymentStep[] = [];
  const orgFlag = targetOrg ? ` --target-org ${JSON.stringify(targetOrg)}` : '';
  const flowNames = flows
    .map((name) => `--name ${JSON.stringify(name)}`)
    .join(' ');
  if (hasPreDeploy) {
    const pre = relative(path.join(outputDirectory, 'preDeploy'));
    let command = `(cd ${JSON.stringify(
      pre
    )} && sf project deploy start --manifest package.xml${orgFlag}`;
    if (hasPrePostDestructive)
      command += ' --post-destructive-changes destructiveChangesPost.xml';
    steps.push({ command: `${command})`, title: 'Remove field references' });
  }
  if (flows.length) {
    steps.push({
      command: `sf kit flow delete${
        orgFlag || ' --target-org <org>'
      } --keep-latest-version ${flowNames}`,
      title: 'Delete old Flow versions',
    });
  }
  const deploy = relative(path.join(outputDirectory, 'deploy'));
  let deployCommand = `sf project deploy start --manifest ${JSON.stringify(
    path.join(deploy, 'package.xml')
  )}${orgFlag}`;
  if (hasPreDestructive)
    deployCommand += ` --pre-destructive-changes ${JSON.stringify(
      path.join(deploy, 'destructiveChangesPre.xml')
    )}`;
  if (hasPostDestructive)
    deployCommand += ` --post-destructive-changes ${JSON.stringify(
      path.join(deploy, 'destructiveChangesPost.xml')
    )}`;
  steps.push({
    command: deployCommand,
    title: 'Deploy changes',
  });
  return steps;
}

function dataBackupCommands(
  outputDirectory: string,
  fields: FieldTypeChange[],
  targetOrg?: string
): string[] {
  const fieldsByObject = new Map<string, Set<string>>();
  for (const field of fields) {
    const [objectName, fieldName] = field.fullName.split('.');
    if (!objectName || !fieldName) continue;
    const objectFields = fieldsByObject.get(objectName) ?? new Set<string>();
    objectFields.add(fieldName);
    fieldsByObject.set(objectName, objectFields);
  }
  const orgFlag = targetOrg
    ? ` --target-org ${JSON.stringify(targetOrg)}`
    : ' --target-org <org>';
  return [...fieldsByObject]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([objectName, fieldNames]) => {
      const query = `SELECT Id, ${[...fieldNames]
        .sort((a, b) => a.localeCompare(b))
        .join(', ')} FROM ${objectName}`;
      const output = path.relative(
        process.cwd(),
        path.join(outputDirectory, `backup-${objectName}.csv`)
      );
      return `sf kit data bulk query${orgFlag} --query ${JSON.stringify(
        query
      )} --csv-file ${JSON.stringify(output)}`;
    });
}

function deploymentInstructionsMarkdown(
  steps: DeploymentStep[],
  fields: FieldTypeChange[],
  outputDirectory: string,
  targetOrg?: string
): string {
  const backupCommands = dataBackupCommands(outputDirectory, fields, targetOrg);
  const fieldList = fields.length
    ? fields.map(
        (field) =>
          `- \`${field.fullName}\` (\`${field.fromType}\` → \`${field.toType}\`)`
      )
    : ['- None'];
  const backupStep = backupCommands.length
    ? [
        '## 1. Optional: Back up field data',
        '',
        'Run these commands before deployment if the existing values must be retained.',
        '',
        '```sh',
        ...backupCommands,
        '```',
        '',
      ]
    : [];
  const firstDeploymentStep = backupCommands.length ? 2 : 1;
  return [
    '# Deployment Instructions',
    '',
    '## Fields with potential data loss',
    '',
    ...fieldList,
    '',
    ...backupStep,
    ...steps.flatMap((step, index) => [
      `## ${index + firstDeploymentStep}. ${step.title}`,
      '',
      '```sh',
      step.command,
      '```',
      '',
    ]),
    '## Optional test execution',
    '',
    'The generated deployment commands do not specify a test level. To run relevant Apex tests during deployment, add `--test-level RunRelevantTests` to the deployment command.',
    '',
  ].join('\n');
}

function preDeployPackageDirectory(preRoot: string, directory: string): string {
  const resolved = path.resolve(preRoot, directory);
  const relative = path.relative(preRoot, resolved);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new SfError(
      `Package directory must remain inside preDeploy: ${directory}`
    );
  return resolved;
}

// The orchestration is intentionally centralized so every generated manifest
// is written from the same analyzed state.
// eslint-disable-next-line complexity
export async function generateSourceDelta(
  options: GenerateSourceDeltaOptions
): Promise<SourceDeltaResult> {
  const dirty = await git(options.root, [
    'status',
    '--porcelain',
    '--untracked-files=no',
  ]);
  if (dirty) throw new SfError('Tracked files contain uncommitted changes');

  const outputDirectory = path.resolve(options.root, options.outputDirectory);
  const relativeOutput = path.relative(options.root, outputDirectory);
  if (
    !relativeOutput ||
    relativeOutput.startsWith(`..${path.sep}`) ||
    relativeOutput === '..' ||
    path.isAbsolute(relativeOutput)
  ) {
    throw new SfError(
      'The output directory must be a subdirectory of the Salesforce project'
    );
  }
  const deployRoot = path.join(outputDirectory, 'deploy');
  const preRoot = path.join(outputDirectory, 'preDeploy');
  for (const directory of options.packageDirectories)
    preDeployPackageDirectory(preRoot, directory.path);
  if (await fs.pathExists(outputDirectory)) {
    if (!options.force)
      throw new SfError(
        `Output directory already exists: ${outputDirectory}. Use --force to replace it.`
      );
    await fs.remove(outputDirectory);
  }
  await fs.ensureDir(deployRoot);
  const temporary = await fs.mkdtemp(
    path.join(options.root, '.kit-source-delta-')
  );
  const forceIgnorePath = path.join(options.root, '.forceignore');
  const forceIgnore = new ForceIgnore(
    (await fs.pathExists(forceIgnorePath)) ? forceIgnorePath : undefined
  );

  try {
    const packageDirectories = options.packageDirectories.map(
      (item) => item.path
    );
    const job = await sgd({
      from: options.from,
      to: 'HEAD',
      output: temporary,
      repo: options.root,
      source: packageDirectories,
      ignore: (await fs.pathExists(forceIgnorePath))
        ? forceIgnorePath
        : undefined,
      ignoreWhitespace: false,
      generateDelta: false,
      apiVersion: options.apiVersion
        ? Number.parseInt(options.apiVersion, 10)
        : undefined,
    });
    const packagePath = path.join(temporary, 'package', 'package.xml');
    const destructivePath = path.join(
      temporary,
      'destructiveChanges',
      'destructiveChanges.xml'
    );
    const packageData = parseManifest(
      (await fs.pathExists(packagePath))
        ? await fs.readFile(packagePath, 'utf8')
        : undefined
    );
    const destructiveData = parseManifest(
      (await fs.pathExists(destructivePath))
        ? await fs.readFile(destructivePath, 'utf8')
        : undefined
    );
    const version =
      options.apiVersion ??
      packageData.version ??
      destructiveData.version ??
      '66.0';
    const preDestructive: Manifest = new Map();
    const prePackage: Manifest = new Map();
    const prePostDestructive: Manifest = new Map();
    const warnings = job.warnings.map((warning) => warning.message);
    const hardBlockers: string[] = [];
    const manualReview: ManualReview[] = [];
    const diagnostics: string[] = [];
    const flows = new Set<string>();
    const fields = await detectFieldTypeChanges(options, forceIgnore);

    for (const field of fields)
      addManifest(preDestructive, 'CustomField', field.fullName);

    if (fields.length) {
      if (!options.connection) {
        hardBlockers.push(
          '--target-org is required when a field type change is detected'
        );
      } else {
        const source = await sourceIndex(
          options.root,
          options.packageDirectories
        );
        const dependencyResolver = new DependencyResolver(
          options.connection,
          options.verbose ? diagnostics : undefined
        );
        const resolved = await dependencyResolver.resolve(fields);
        hardBlockers.push(...resolved.unresolved);
        for (const dependency of resolved.dependencies) {
          if (dependency.managed) {
            hardBlockers.push(
              `Managed dependency cannot be changed: ${dependency.type}:${dependency.fullName}`
            );
            continue;
          }
          if (!source.has(`${dependency.type}#${dependency.fullName}`)) {
            hardBlockers.push(
              `Dependency cannot be restored from Git: ${dependency.type}:${dependency.fullName}`
            );
          }
        }
        await editReferences(
          options,
          resolved.dependencies,
          source,
          version,
          packageData.manifest,
          prePackage,
          prePostDestructive,
          flows,
          manualReview,
          warnings,
          hardBlockers
        );
      }
    }

    await fs.outputFile(
      path.join(deployRoot, 'package.xml'),
      manifestXml(packageData.manifest, version)
    );
    const hasPreDestructive = hasManifestMembers(preDestructive);
    const hasPostDestructive = hasManifestMembers(destructiveData.manifest);
    const hasPrePostDestructive = hasManifestMembers(prePostDestructive);
    if (hasPreDestructive)
      await fs.outputFile(
        path.join(deployRoot, 'destructiveChangesPre.xml'),
        manifestXml(preDestructive, version)
      );
    if (hasPostDestructive)
      await fs.outputFile(
        path.join(deployRoot, 'destructiveChangesPost.xml'),
        manifestXml(destructiveData.manifest, version)
      );

    const hasPreDeploy =
      hasManifestMembers(prePackage) || hasPrePostDestructive;
    if (hasPreDeploy) {
      await fs.ensureDir(preRoot);
      for (const directory of options.packageDirectories) {
        // eslint-disable-next-line no-await-in-loop
        await fs.ensureDir(preDeployPackageDirectory(preRoot, directory.path));
      }
      await fs.outputFile(
        path.join(preRoot, 'package.xml'),
        manifestXml(prePackage, version)
      );
      if (hasPrePostDestructive)
        await fs.outputFile(
          path.join(preRoot, 'destructiveChangesPost.xml'),
          manifestXml(prePostDestructive, version)
        );
      const projectConfig = {
        packageDirectories: options.packageDirectories,
        sourceApiVersion: version,
      };
      await fs.outputJson(
        path.join(preRoot, 'sfdx-project.json'),
        projectConfig,
        {
          spaces: 2,
        }
      );
      if (await fs.pathExists(forceIgnorePath))
        await fs.copy(forceIgnorePath, path.join(preRoot, '.forceignore'));
    }

    const sortedFlows = [...flows].sort((a, b) => a.localeCompare(b));
    const instructionSteps = deploymentSteps(
      outputDirectory,
      hasPreDeploy,
      hasPrePostDestructive,
      hasPreDestructive,
      hasPostDestructive,
      sortedFlows,
      options.targetOrg
    );
    const deploySteps = instructionSteps.map((step) => step.command);
    const deploymentInstructions = path.join(
      outputDirectory,
      'deploymentInstructions.md'
    );
    await fs.outputFile(
      deploymentInstructions,
      deploymentInstructionsMarkdown(
        instructionSteps,
        fields,
        outputDirectory,
        options.targetOrg
      )
    );
    return {
      outputDirectory,
      deploymentInstructions,
      diagnostics,
      fieldTypeChanges: fields,
      flows: sortedFlows,
      manualReview,
      warnings,
      hardBlockers: [...new Set(hardBlockers)],
      deploySteps,
      manifests: {
        package: path.join(deployRoot, 'package.xml'),
        preDestructive: hasPreDestructive
          ? path.join(deployRoot, 'destructiveChangesPre.xml')
          : undefined,
        postDestructive: hasPostDestructive
          ? path.join(deployRoot, 'destructiveChangesPost.xml')
          : undefined,
        preDeployPackage: hasPreDeploy
          ? path.join(preRoot, 'package.xml')
          : undefined,
        preDeployPostDestructive: hasPrePostDestructive
          ? path.join(preRoot, 'destructiveChangesPost.xml')
          : undefined,
      },
    };
  } finally {
    await fs.remove(temporary);
  }
}
