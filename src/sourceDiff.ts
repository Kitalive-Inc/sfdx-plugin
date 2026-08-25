import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { Connection, SfError } from '@salesforce/core';
import {
  ComponentStatus,
  ComponentSet,
  MetadataResolver,
  RegistryAccess,
  SourceComponent,
} from '@salesforce/source-deploy-retrieve';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import fs from 'fs-extra';

const execFileAsync = promisify(execFile);

type PackageDirectory = { [key: string]: unknown; path: string };
type ComponentIdentity = { type: string; fullName: string };
type IgnoreElement = { type: string; element: string };
type ComponentFile = { relativePath: string; role: string };

export type SourceDiffProgress = {
  stage: 'prepare' | 'resolve' | 'retrieve' | 'compare' | 'cleanup';
  message: string;
  current?: number;
  total?: number;
};

export type SourceDiffStatus =
  | 'unchanged'
  | 'modified'
  | 'added'
  | 'deleted'
  | 'absent'
  | 'unresolved';

export type SourceDiffComponent = ComponentIdentity & {
  status: SourceDiffStatus;
};

export type SourceDiffResult = {
  base: string;
  targetOrg: string;
  hasDifferences: boolean;
  worktreeRetained: boolean;
  worktreePath?: string;
  components: SourceDiffComponent[];
  counts: Record<SourceDiffStatus, number>;
  warnings: string[];
  instructions: string[];
};

type RetrieveContext = {
  componentSet: ComponentSet;
  connection: Connection;
  outputDirectory: string;
  onProgress?: (progress: SourceDiffProgress) => void;
};

type RetrieveOutcome = {
  retrieved: Set<string>;
  warnings: string[];
};

export type SourceDiffOptions = {
  root: string;
  base: string;
  targetOrg: string;
  connection: Connection;
  manifest?: string;
  sourceDirectories?: string[];
  apiVersion?: string;
  ignoreElements?: string[];
  worktreeDirectory?: string;
  retrieve?: (context: RetrieveContext) => Promise<RetrieveOutcome>;
  onProgress?: (progress: SourceDiffProgress) => void;
};

type ManifestSelection = Map<string, Set<string>>;
type ComponentIndex = Map<string, SourceComponent>;
type Snapshot = Map<string, string>;

const xmlParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false,
});
const xmlBuilder = new XMLBuilder({
  preserveOrder: true,
  ignoreAttributes: false,
  format: false,
  suppressEmptyNode: false,
});

function key(componentIdentity: ComponentIdentity): string {
  return `${componentIdentity.type}#${componentIdentity.fullName}`;
}

function identity(componentKey: string): ComponentIdentity {
  const separator = componentKey.indexOf('#');
  return {
    type: componentKey.slice(0, separator),
    fullName: componentKey.slice(separator + 1),
  };
}

async function git(root: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  return result.stdout.trimEnd();
}

async function gitBuffer(root: string, args: string[]): Promise<Buffer> {
  const result = await execFileAsync('git', args, {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 50 * 1024 * 1024,
  });
  return result.stdout;
}

function addComponent(index: ComponentIndex, component: SourceComponent): void {
  index.set(
    key({ type: component.type.name, fullName: component.fullName }),
    component
  );
  component.getChildren().forEach((child) => addComponent(index, child));
}

function sourceIndex(paths: string[]): ComponentIndex {
  const resolver = new MetadataResolver(undefined, undefined, true);
  const index: ComponentIndex = new Map();
  for (const sourcePath of paths) {
    if (!fs.pathExistsSync(sourcePath)) continue;
    for (const component of resolver.getComponentsFromPath(sourcePath))
      addComponent(index, component);
  }
  return index;
}

function componentIndex(components: SourceComponent[]): ComponentIndex {
  const index: ComponentIndex = new Map();
  components.forEach((component) => addComponent(index, component));
  return index;
}

function manifestSelection(xml: string): ManifestSelection {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
  }).parse(xml) as {
    Package?: {
      types?:
        | { name: string; members?: string | string[] }
        | Array<{ name: string; members?: string | string[] }>;
    };
  };
  const types = parsed.Package?.types;
  const result: ManifestSelection = new Map();
  for (const item of types ? (Array.isArray(types) ? types : [types]) : []) {
    const members = item.members
      ? Array.isArray(item.members)
        ? item.members
        : [item.members]
      : [];
    result.set(item.name, new Set(members));
  }
  return result;
}

function selected(selection: ManifestSelection, componentKey: string): boolean {
  const item = identity(componentKey);
  const members = selection.get(item.type);
  return Boolean(members?.has('*') || members?.has(item.fullName));
}

function exactManifestKeys(selection: ManifestSelection): Set<string> {
  const result = new Set<string>();
  for (const [type, members] of selection)
    for (const fullName of members)
      if (fullName !== '*') result.add(key({ type, fullName }));
  return result;
}

function parseIgnoreElements(values: string[]): IgnoreElement[] {
  const registry = new RegistryAccess();
  return [...new Set(values)].map((value) => {
    const separator = value.indexOf(':');
    if (separator < 1 || separator === value.length - 1)
      throw new SfError(
        `Invalid --ignore-element value ${value}; expected MetadataType:element`
      );
    const type = value.slice(0, separator);
    const element = value.slice(separator + 1);
    registry.getTypeByName(type);
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(element))
      throw new SfError(
        `Invalid XML element name in --ignore-element: ${value}`
      );
    return { type, element };
  });
}

function normalizeText(content: string): string {
  return `${content
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd()}\n`;
}

type OrderedXmlNode = Record<string, unknown>;

function normalizeOrderedXml(
  value: unknown,
  ignoredElements: Set<string>
): unknown {
  if (Array.isArray(value))
    return value
      .filter((item) => {
        if (!item || typeof item !== 'object') return true;
        const text = (item as OrderedXmlNode)['#text'];
        if (typeof text === 'string' && text.trim() === '') return false;
        return !Object.keys(item as OrderedXmlNode).some((name) =>
          ignoredElements.has(name)
        );
      })
      .map((item) => normalizeOrderedXml(item, ignoredElements));
  if (!value || typeof value !== 'object') return value;
  const result: OrderedXmlNode = {};
  for (const [name, child] of Object.entries(value as OrderedXmlNode)) {
    if (name === '?xml') continue;
    if (name === ':@' && child && typeof child === 'object') {
      result[name] = Object.fromEntries(
        Object.entries(child as OrderedXmlNode).sort(([a], [b]) =>
          a.localeCompare(b)
        )
      );
    } else {
      result[name] = normalizeOrderedXml(child, ignoredElements);
    }
  }
  return result;
}

export function normalizeSourceContent(
  filepath: string,
  content: Buffer,
  type: string,
  ignoreElements: IgnoreElement[] = []
): Buffer {
  if (content.includes(0)) return content;
  const text = normalizeText(content.toString('utf8'));
  if (!filepath.endsWith('.xml')) return Buffer.from(text);
  const ignored = new Set(
    ignoreElements
      .filter((item) => item.type === type)
      .map((item) => item.element)
  );
  try {
    const parsed = xmlParser.parse(text) as unknown;
    const normalized = normalizeOrderedXml(parsed, ignored);
    return Buffer.from(xmlBuilder.build(normalized));
  } catch {
    return Buffer.from(text);
  }
}

function filesInDirectory(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filepath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesInDirectory(filepath) : [filepath];
  });
}

function componentFiles(component: SourceComponent): string[] {
  const files = new Set<string>();
  if (component.xml && fs.pathExistsSync(component.xml))
    files.add(component.xml);
  if (component.content && fs.pathExistsSync(component.content)) {
    const stat = fs.statSync(component.content);
    if (stat.isFile()) files.add(component.content);
    else if (
      ['bundle', 'mixedContent'].includes(
        component.type.strategies?.adapter ?? ''
      )
    )
      filesInDirectory(component.content).forEach((filepath) =>
        files.add(filepath)
      );
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

function fileRole(component: SourceComponent, filepath: string): string {
  if (
    component.content &&
    fs.pathExistsSync(component.content) &&
    fs.statSync(component.content).isDirectory()
  )
    return path.relative(component.content, filepath).replaceAll('\\', '/');
  return path.basename(filepath);
}

function describeComponentFiles(
  component: SourceComponent,
  worktree: string
): ComponentFile[] {
  return componentFiles(component).map((filepath) => ({
    relativePath: path.relative(worktree, filepath).replaceAll('\\', '/'),
    role: fileRole(component, filepath),
  }));
}

async function snapshot(
  component: SourceComponent,
  ignoredElements: IgnoreElement[]
): Promise<Snapshot> {
  const result: Snapshot = new Map();
  for (const filepath of componentFiles(component)) {
    // eslint-disable-next-line no-await-in-loop
    const content = await fs.readFile(filepath);
    const normalized = normalizeSourceContent(
      filepath,
      content,
      component.type.name,
      ignoredElements
    );
    result.set(
      fileRole(component, filepath),
      crypto.createHash('sha256').update(normalized).digest('hex')
    );
  }
  return result;
}

async function baseSnapshot(
  worktree: string,
  type: string,
  files: ComponentFile[],
  ignoredElements: IgnoreElement[]
): Promise<Snapshot> {
  const result: Snapshot = new Map();
  for (const file of files) {
    // The worktree index remains at the base revision after retrieve.
    // eslint-disable-next-line no-await-in-loop
    const content = await gitBuffer(worktree, [
      'show',
      `:${file.relativePath}`,
    ]);
    const normalized = normalizeSourceContent(
      file.relativePath,
      content,
      type,
      ignoredElements
    );
    result.set(
      file.role,
      crypto.createHash('sha256').update(normalized).digest('hex')
    );
  }
  return result;
}

async function changedPaths(worktree: string): Promise<Set<string>> {
  const [tracked, untracked] = await Promise.all([
    git(worktree, ['diff', '--name-only', '-z']),
    git(worktree, ['ls-files', '--others', '--exclude-standard', '-z']),
  ]);
  return new Set(
    `${tracked}\0${untracked}`
      .split('\0')
      .filter((filepath) => filepath.length > 0)
  );
}

async function restoreTrackedPaths(
  worktree: string,
  pathsToRestore: string[]
): Promise<void> {
  const batchSize = 200;
  for (let index = 0; index < pathsToRestore.length; index += batchSize)
    // eslint-disable-next-line no-await-in-loop
    await git(worktree, [
      'restore',
      '--worktree',
      '--',
      ...pathsToRestore.slice(index, index + batchSize),
    ]);
}

function snapshotsEqual(left?: Snapshot, right?: Snapshot): boolean {
  if (left?.size === undefined || right?.size !== left.size) return false;
  return [...left].every(([name, hash]) => right?.get(name) === hash);
}

async function removeComponent(component: SourceComponent): Promise<void> {
  await Promise.all(
    componentFiles(component).map((filepath) => fs.remove(filepath))
  );
}

async function defaultRetrieve(
  context: RetrieveContext
): Promise<RetrieveOutcome> {
  const startedAt = Date.now();
  const operation = await context.componentSet.retrieve({
    usernameOrConnection: context.connection,
    output: context.outputDirectory,
    merge: true,
  });
  let previousStatus: string | undefined;
  let previousUpdate = 0;
  operation.onUpdate((status) => {
    const now = Date.now();
    if (status.status !== previousStatus || now - previousUpdate >= 30_000) {
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      context.onProgress?.({
        stage: 'retrieve',
        message: `Metadata retrieve: ${status.status} (${elapsedSeconds}s elapsed)`,
      });
      previousStatus = status.status;
      previousUpdate = now;
    }
  });
  const result = await operation.pollStatus();
  if (!result.response.success)
    throw new SfError(
      `Metadata retrieve failed with status ${result.response.status}`
    );
  const retrieved = new Set<string>();
  const add = (component: SourceComponent): void => {
    retrieved.add(
      key({ type: component.type.name, fullName: component.fullName })
    );
    component.getChildren().forEach(add);
  };
  result.components?.getSourceComponents().toArray().forEach(add);
  for (const response of result.getFileResponses())
    if (response.state !== ComponentStatus.Failed)
      retrieved.add(key({ type: response.type, fullName: response.fullName }));
  const messages = result.response.messages;
  const warnings = (
    messages ? (Array.isArray(messages) ? messages : [messages]) : []
  ).map((message) => `${message.fileName}: ${message.problem}`);
  warnings.push(
    ...result
      .getFileResponses()
      .filter((response) => response.state === ComponentStatus.Failed)
      .map(
        (response) =>
          `${response.type}:${response.fullName} - ${response.error}`
      )
  );
  return { retrieved, warnings };
}

function instructions(root: string, worktree: string): string[] {
  const quoted = JSON.stringify(worktree);
  return [
    `git -C ${quoted} status`,
    `git -C ${quoted} diff`,
    `git -C ${quoted} diff --binary > /tmp/org-changes.patch`,
    `git -C ${JSON.stringify(root)} apply --3way /tmp/org-changes.patch`,
    `git -C ${JSON.stringify(root)} worktree remove --force ${quoted}`,
  ];
}

function emptyCounts(): Record<SourceDiffStatus, number> {
  return {
    unchanged: 0,
    modified: 0,
    added: 0,
    deleted: 0,
    absent: 0,
    unresolved: 0,
  };
}

// eslint-disable-next-line complexity
export async function generateSourceDiff(
  options: SourceDiffOptions
): Promise<SourceDiffResult> {
  const report = (progress: SourceDiffProgress): void =>
    options.onProgress?.(progress);
  report({ stage: 'prepare', message: 'Resolving base revision...' });
  const base = await git(options.root, [
    'rev-parse',
    '--verify',
    `${options.base}^{commit}`,
  ]);
  const ignores = parseIgnoreElements(options.ignoreElements ?? []);
  const sourceDirectories = options.sourceDirectories ?? [];
  if (Boolean(options.manifest) === Boolean(sourceDirectories.length))
    throw new SfError(
      'Exactly one of --manifest or --source-dir must be specified'
    );
  const manifestPath = options.manifest
    ? path.resolve(options.root, options.manifest)
    : undefined;
  if (manifestPath && !(await fs.pathExists(manifestPath)))
    throw new SfError(`Manifest was not found: ${manifestPath}`);
  if (
    options.worktreeDirectory &&
    (await fs.pathExists(options.worktreeDirectory))
  )
    throw new SfError(
      `Worktree directory already exists: ${options.worktreeDirectory}`
    );

  const temporaryParent = options.worktreeDirectory
    ? undefined
    : await fs.mkdtemp(path.join(os.tmpdir(), 'kit-source-diff-'));
  const worktree = path.resolve(
    options.worktreeDirectory ?? path.join(temporaryParent!, 'worktree')
  );
  let added = false;
  let retain = false;
  try {
    report({ stage: 'prepare', message: 'Creating detached worktree...' });
    await git(options.root, ['worktree', 'add', '--detach', worktree, base]);
    added = true;
    const projectConfig = (await fs.readJson(
      path.join(worktree, 'sfdx-project.json')
    )) as {
      packageDirectories?: PackageDirectory[];
      sourceApiVersion?: string;
    };
    const packageDirectories = projectConfig.packageDirectories ?? [];
    if (!packageDirectories.length)
      throw new SfError('No packageDirectories are configured at base');
    const packagePaths = packageDirectories.map((directory) =>
      path.join(worktree, directory.path)
    );
    report({ stage: 'resolve', message: 'Resolving base components...' });
    let selection: ManifestSelection | undefined;
    let componentSet: ComponentSet;
    if (manifestPath) {
      selection = manifestSelection(await fs.readFile(manifestPath, 'utf8'));
      componentSet = await ComponentSet.fromManifest({
        manifestPath,
        resolveSourcePaths: packagePaths,
        forceAddWildcards: true,
      });
    } else {
      const worktreePaths = sourceDirectories.map((sourceDirectory) => {
        const relative = path.relative(
          options.root,
          path.resolve(options.root, sourceDirectory)
        );
        if (
          relative === '..' ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        )
          throw new SfError(
            `Source directory must remain inside the project: ${sourceDirectory}`
          );
        return path.join(worktree, relative);
      });
      componentSet = ComponentSet.fromSource(worktreePaths);
    }
    const baseIndex = componentIndex(
      componentSet.getSourceComponents().toArray()
    );
    const requestedKeys = selection
      ? new Set([
          ...exactManifestKeys(selection),
          ...[...baseIndex.keys()].filter((componentKey) =>
            selected(selection, componentKey)
          ),
        ])
      : new Set(baseIndex.keys());
    if (!requestedKeys.size)
      throw new SfError('No metadata components were found in the selection');
    report({
      stage: 'resolve',
      message: `Resolved ${requestedKeys.size} base components.`,
      current: requestedKeys.size,
      total: requestedKeys.size,
    });
    componentSet.apiVersion =
      options.apiVersion ?? projectConfig.sourceApiVersion;
    componentSet.projectDirectory = worktree;
    const baseFiles = new Map<string, ComponentFile[]>();
    for (const [componentKey, component] of baseIndex)
      if (requestedKeys.has(componentKey))
        baseFiles.set(
          componentKey,
          describeComponentFiles(component, worktree)
        );
    const defaultPackage =
      packageDirectories.find((directory) => directory.default) ??
      packageDirectories[0];
    report({
      stage: 'retrieve',
      message: `Starting metadata retrieve for ${requestedKeys.size} components...`,
    });
    const outcome = await (options.retrieve ?? defaultRetrieve)({
      componentSet,
      connection: options.connection,
      outputDirectory: path.join(worktree, defaultPackage.path),
      onProgress: report,
    });
    report({
      stage: 'retrieve',
      message: `Metadata retrieve completed (${outcome.retrieved.size} components returned).`,
    });
    for (const componentKey of requestedKeys) {
      const component = baseIndex.get(componentKey);
      if (component && !outcome.retrieved.has(componentKey))
        // eslint-disable-next-line no-await-in-loop
        await removeComponent(component);
    }
    report({
      stage: 'compare',
      message: 'Detecting files changed by the retrieve...',
    });
    const changed = await changedPaths(worktree);
    const changedSourcePaths = [...changed]
      .map((filepath) => path.join(worktree, filepath))
      .filter((filepath) => fs.pathExistsSync(filepath));
    const orgIndex = sourceIndex(changedSourcePaths);
    const comparisonKeys = new Set(requestedKeys);
    if (selection)
      for (const componentKey of orgIndex.keys())
        if (selected(selection, componentKey)) comparisonKeys.add(componentKey);
    const semanticComparisonKeys = [...comparisonKeys].filter(
      (componentKey) => {
        const files = baseFiles.get(componentKey);
        return (
          (!files && outcome.retrieved.has(componentKey)) ||
          Boolean(files?.some((file) => changed.has(file.relativePath)))
        );
      }
    );
    report({
      stage: 'compare',
      message: `Comparing ${semanticComparisonKeys.length} changed components (${changed.size} changed files)...`,
      current: 0,
      total: semanticComparisonKeys.length,
    });
    const semanticKeySet = new Set(semanticComparisonKeys);
    const components: SourceDiffComponent[] = [];
    const equivalentPaths = new Set<string>();
    const meaningfulPaths = new Set<string>();
    let compared = 0;
    for (const componentKey of [...comparisonKeys].sort((a, b) =>
      a.localeCompare(b)
    )) {
      const item = identity(componentKey);
      const files = baseFiles.get(componentKey);
      const orgComponent = outcome.retrieved.has(componentKey)
        ? orgIndex.get(componentKey)
        : undefined;
      const orgFiles = orgComponent
        ? describeComponentFiles(orgComponent, worktree)
        : undefined;
      let baseComponentSnapshot: Snapshot | undefined;
      let orgSnapshot: Snapshot | undefined;
      if (semanticKeySet.has(componentKey)) {
        if (files)
          // eslint-disable-next-line no-await-in-loop
          baseComponentSnapshot = await baseSnapshot(
            worktree,
            item.type,
            files,
            ignores
          );
        if (orgComponent)
          // eslint-disable-next-line no-await-in-loop
          orgSnapshot = await snapshot(orgComponent, ignores);
        compared += 1;
        if (compared === semanticComparisonKeys.length || compared % 100 === 0)
          report({
            stage: 'compare',
            message: `Compared ${compared}/${semanticComparisonKeys.length} changed components.`,
            current: compared,
            total: semanticComparisonKeys.length,
          });
      }
      let status: SourceDiffStatus;
      if (!files && !orgSnapshot)
        status = outcome.retrieved.has(componentKey) ? 'unresolved' : 'absent';
      else if (!files) status = 'added';
      else if (!outcome.retrieved.has(componentKey)) status = 'deleted';
      else if (!semanticKeySet.has(componentKey)) status = 'unchanged';
      else if (!orgSnapshot) status = 'unresolved';
      else
        status = snapshotsEqual(baseComponentSnapshot, orgSnapshot)
          ? 'unchanged'
          : 'modified';
      if (baseComponentSnapshot && orgSnapshot && files && orgFiles) {
        const orgFilesByRole = new Map(
          orgFiles.map((file) => [file.role, file] as const)
        );
        for (const file of files) {
          const orgFile = orgFilesByRole.get(file.role);
          if (
            orgFile?.relativePath === file.relativePath &&
            baseComponentSnapshot.get(file.role) === orgSnapshot.get(file.role)
          )
            equivalentPaths.add(file.relativePath);
          else {
            meaningfulPaths.add(file.relativePath);
            if (orgFile) meaningfulPaths.add(orgFile.relativePath);
          }
        }
        for (const orgFile of orgFiles)
          if (!baseComponentSnapshot.has(orgFile.role))
            meaningfulPaths.add(orgFile.relativePath);
      } else if (!['unchanged', 'absent'].includes(status)) {
        files?.forEach((file) => meaningfulPaths.add(file.relativePath));
        orgFiles?.forEach((file) => meaningfulPaths.add(file.relativePath));
      }
      components.push({ ...item, status });
    }
    const counts = emptyCounts();
    components.forEach((component) => (counts[component.status] += 1));
    const hasDifferences = counts.modified + counts.added + counts.deleted > 0;
    retain = hasDifferences || counts.unresolved > 0;
    const formattingOnlyPaths = [...equivalentPaths].filter(
      (filepath) => changed.has(filepath) && !meaningfulPaths.has(filepath)
    );
    if (retain && formattingOnlyPaths.length) {
      report({
        stage: 'cleanup',
        message: `Discarding ${formattingOnlyPaths.length} formatting-only file changes...`,
        current: formattingOnlyPaths.length,
        total: formattingOnlyPaths.length,
      });
      await restoreTrackedPaths(worktree, formattingOnlyPaths);
    }
    const result: SourceDiffResult = {
      base,
      targetOrg: options.targetOrg,
      hasDifferences,
      worktreeRetained: retain,
      worktreePath: retain ? worktree : undefined,
      components,
      counts,
      warnings: outcome.warnings,
      instructions: retain ? instructions(options.root, worktree) : [],
    };
    if (!retain) {
      report({ stage: 'cleanup', message: 'Removing temporary worktree...' });
      await git(options.root, ['worktree', 'remove', '--force', worktree]);
      added = false;
      if (temporaryParent) await fs.remove(temporaryParent);
    }
    return result;
  } finally {
    if (added && !retain) {
      try {
        await git(options.root, ['worktree', 'remove', '--force', worktree]);
      } catch {
        // Preserve the original error.
      }
    }
    if (temporaryParent && !retain) await fs.remove(temporaryParent);
  }
}
