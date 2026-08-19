import path from 'node:path';
import { Connection, SfError } from '@salesforce/core';
import fs from 'fs-extra';

export type FlowOperationResult = {
  name: string;
  versionNumber?: number;
  status?: string;
  success: boolean;
  error?: string;
  warning?: string;
};

export type EmptyFlowOptions = {
  apiVersion: string;
  label: string;
  processType: string;
};

export type EmptyFlowFileResult = EmptyFlowOptions & {
  name: string;
  path: string;
};

type FlowDefinitionRecord = {
  Id: string;
  DeveloperName: string;
  ActiveVersionId?: string | null;
};

type FlowRecord = {
  Id: string;
  DefinitionId: string;
  VersionNumber: number;
  Status: string;
};

async function getDefinitions(
  conn: Connection,
  names: string[]
): Promise<FlowDefinitionRecord[]> {
  return (await conn.tooling
    .sobject('FlowDefinition')
    .select('Id, DeveloperName, ActiveVersionId')
    .where({ DeveloperName: names })) as unknown as FlowDefinitionRecord[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function emptyFlowXml(options: EmptyFlowOptions): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Flow xmlns="http://soap.sforce.com/2006/04/metadata">',
    `  <apiVersion>${escapeXml(options.apiVersion)}</apiVersion>`,
    `  <label>${escapeXml(options.label)}</label>`,
    `  <processType>${escapeXml(options.processType)}</processType>`,
    '  <status>Draft</status>',
    '</Flow>',
    '',
  ].join('\n');
}

export async function writeEmptyFlow(
  outputDirectory: string,
  name: string,
  options: EmptyFlowOptions,
  force = false
): Promise<EmptyFlowFileResult> {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name))
    throw new SfError(`Invalid Flow API name: ${name}`);
  if (!/^\d+\.\d+$/.test(options.apiVersion))
    throw new SfError(`Invalid API version: ${options.apiVersion}`);
  if (!options.label) throw new SfError('Flow label must not be empty');
  if (!options.processType)
    throw new SfError('Flow process type must not be empty');

  const outputPath = path.resolve(outputDirectory, `${name}.flow-meta.xml`);
  if ((await fs.pathExists(outputPath)) && !force)
    throw new SfError(
      `Flow file already exists: ${outputPath}. Use --force to overwrite it.`
    );
  await fs.ensureDir(path.dirname(outputPath));
  await fs.outputFile(outputPath, emptyFlowXml(options));
  return { name, path: outputPath, ...options };
}

export async function deactivateFlows(
  conn: Connection,
  names: string[]
): Promise<FlowOperationResult[]> {
  const definitions = await getDefinitions(conn, names);
  const byName = new Map(definitions.map((item) => [item.DeveloperName, item]));
  const resultByName = new Map<string, FlowOperationResult>();
  const activeDefinitions = definitions.filter(
    (definition) => definition.ActiveVersionId
  );

  for (const name of names) {
    const definition = byName.get(name);
    if (!definition) {
      resultByName.set(name, {
        name,
        success: false,
        error: `FlowDefinition was not found: ${name}`,
      });
    } else if (!definition.ActiveVersionId) {
      resultByName.set(name, { name, success: true, status: 'Inactive' });
    }
  }

  if (activeDefinitions.length) {
    // Tooling API does not expose the SObject Collections endpoint used when
    // jsforce receives an array, so call the supported single-record endpoint.
    await Promise.all(
      activeDefinitions.map(async (definition) => {
        try {
          const result = await conn.tooling.sobject('FlowDefinition').update({
            Id: definition.Id,
            Metadata: { activeVersionNumber: 0 },
          });
          resultByName.set(definition.DeveloperName, {
            name: definition.DeveloperName,
            success: result.success,
            status: result.success ? 'Inactive' : 'Active',
            error: result.success
              ? undefined
              : result.errors.map((error) => error.message).join('; '),
          });
        } catch (error) {
          resultByName.set(definition.DeveloperName, {
            name: definition.DeveloperName,
            success: false,
            status: 'Active',
            error: errorMessage(error),
          });
        }
      })
    );
  }

  return names.map((name) => resultByName.get(name)!);
}

export type DeleteFlowVersionsMode = 'all' | 'keep-latest' | 'inactive';

export async function deleteFlowVersions(
  conn: Connection,
  names: string[],
  mode: DeleteFlowVersionsMode = 'all'
): Promise<FlowOperationResult[]> {
  const definitions = await getDefinitions(conn, names);
  const byName = new Map(definitions.map((item) => [item.DeveloperName, item]));
  const nameByDefinitionId = new Map(
    definitions.map((item) => [item.Id, item.DeveloperName])
  );
  const definitionIds = definitions.map((item) => item.Id);
  const resultsByName = new Map<string, FlowOperationResult[]>();
  const versions = definitionIds.length
    ? ((await conn.tooling
        .sobject('Flow')
        .select('Id, DefinitionId, VersionNumber, Status')
        .where({ DefinitionId: definitionIds })) as unknown as FlowRecord[])
    : [];
  versions.sort(
    (a, b) =>
      a.DefinitionId.localeCompare(b.DefinitionId) ||
      a.VersionNumber - b.VersionNumber
  );

  for (const name of names) {
    if (!byName.has(name)) {
      resultsByName.set(name, [
        {
          name,
          success: false,
          error: `FlowDefinition was not found: ${name}`,
        },
      ]);
    } else {
      resultsByName.set(name, []);
    }
  }

  const latestVersionByDefinitionId = new Map<string, number>();
  const latestVersionRecordByDefinitionId = new Map<string, FlowRecord>();
  for (const version of versions) {
    const latest = latestVersionRecordByDefinitionId.get(version.DefinitionId);
    if (!latest || version.VersionNumber > latest.VersionNumber) {
      latestVersionByDefinitionId.set(
        version.DefinitionId,
        version.VersionNumber
      );
      latestVersionRecordByDefinitionId.set(version.DefinitionId, version);
    }
  }

  const namesToDeactivate = definitions
    .filter((definition) => {
      if (!definition.ActiveVersionId || mode === 'inactive') return false;
      if (mode === 'all') return true;
      return (
        definition.ActiveVersionId !==
        latestVersionRecordByDefinitionId.get(definition.Id)?.Id
      );
    })
    .map((definition) => definition.DeveloperName);
  const failedDeactivations = new Set<string>();
  if (namesToDeactivate.length) {
    const deactivationResults = await deactivateFlows(conn, namesToDeactivate);
    for (const result of deactivationResults) {
      if (result.success) continue;
      failedDeactivations.add(result.name);
      resultsByName.get(result.name)!.push(result);
    }
  }

  const versionsToDelete: FlowRecord[] = [];
  for (const version of versions) {
    const name = nameByDefinitionId.get(version.DefinitionId)!;
    const definition = byName.get(name)!;
    if (failedDeactivations.has(name)) continue;
    if (
      mode === 'keep-latest' &&
      version.VersionNumber ===
        latestVersionByDefinitionId.get(version.DefinitionId)
    ) {
      resultsByName.get(name)!.push({
        name,
        versionNumber: version.VersionNumber,
        status: version.Status,
        success: true,
        warning: 'Latest version was skipped',
      });
    } else if (
      mode === 'inactive' &&
      version.Id === definition.ActiveVersionId
    ) {
      resultsByName.get(name)!.push({
        name,
        versionNumber: version.VersionNumber,
        status: version.Status,
        success: true,
        warning: 'Active version was skipped',
      });
    } else {
      versionsToDelete.push(version);
    }
  }

  if (versionsToDelete.length) {
    // Passing an ID array makes jsforce call /tooling/composite/sobjects,
    // which returns NOT_FOUND. Keep the requests parallel but send one ID each.
    await Promise.all(
      versionsToDelete.map(async (version) => {
        const name = nameByDefinitionId.get(version.DefinitionId)!;
        try {
          const result = await conn.tooling.sobject('Flow').destroy(version.Id);
          resultsByName.get(name)!.push({
            name,
            versionNumber: version.VersionNumber,
            status: version.Status,
            success: result.success,
            error: result.success
              ? undefined
              : result.errors.map((error) => error.message).join('; '),
          });
        } catch (error) {
          resultsByName.get(name)!.push({
            name,
            versionNumber: version.VersionNumber,
            status: version.Status,
            success: false,
            error: errorMessage(error),
          });
        }
      })
    );
  }

  return names.flatMap((name) =>
    resultsByName
      .get(name)!
      .sort((a, b) => (a.versionNumber ?? 0) - (b.versionNumber ?? 0))
  );
}
