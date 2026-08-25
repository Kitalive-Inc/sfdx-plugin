import path from 'node:path';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  generateSourceDiff,
  SourceDiffResult,
  SourceDiffStatus,
} from '../../../sourceDiff.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@kitalive/sfdx-plugin', 'source.diff');

export default class SourceDiff extends SfCommand<SourceDiffResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;
  public static readonly flags = {
    base: Flags.string({
      char: 'b',
      default: 'HEAD',
      summary: messages.getMessage('flags.base.summary'),
    }),
    manifest: Flags.file({
      char: 'x',
      exists: true,
      exactlyOne: ['manifest', 'source-dir'],
      summary: messages.getMessage('flags.manifest.summary'),
    }),
    'source-dir': Flags.directory({
      char: 'd',
      multiple: true,
      exactlyOne: ['manifest', 'source-dir'],
      summary: messages.getMessage('flags.source-dir.summary'),
    }),
    'ignore-element': Flags.string({
      multiple: true,
      summary: messages.getMessage('flags.ignore-element.summary'),
    }),
    'worktree-dir': Flags.string({
      summary: messages.getMessage('flags.worktree-dir.summary'),
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<SourceDiffResult> {
    const { flags } = await this.parse(SourceDiff);
    const result = await generateSourceDiff({
      root: this.project!.getPath(),
      base: flags.base,
      targetOrg: flags['target-org'].getUsername()!,
      connection: flags['target-org'].getConnection(flags['api-version']),
      manifest: flags.manifest,
      sourceDirectories: flags['source-dir'],
      apiVersion: flags['api-version'],
      ignoreElements: flags['ignore-element'],
      worktreeDirectory: flags['worktree-dir']
        ? path.resolve(flags['worktree-dir'])
        : undefined,
      onProgress: ({ message }) => {
        if (this.jsonEnabled()) this.logToStderr(message);
        else this.log(message);
      },
    });
    if (!this.jsonEnabled()) this.printResult(result);
    return result;
  }

  private printResult(result: SourceDiffResult): void {
    this.log(`Base: ${result.base}`);
    this.log(`Target org: ${result.targetOrg}`);
    for (const component of result.components)
      if (!['unchanged', 'absent'].includes(component.status))
        this.log(
          `${component.status}: ${component.type}:${component.fullName}`
        );
    this.log('Summary:');
    const statuses: SourceDiffStatus[] = [
      'unchanged',
      'modified',
      'added',
      'deleted',
      'absent',
      'unresolved',
    ];
    statuses.forEach((status) =>
      this.log(`  ${status}: ${result.counts[status]}`)
    );
    result.warnings.forEach((warning) => this.warn(warning));
    if (result.worktreeRetained) {
      this.log(`Worktree retained: ${result.worktreePath}`);
      this.log('Review and integration commands:');
      result.instructions.forEach((instruction) => this.log(instruction));
    } else {
      this.log('No org differences. The temporary worktree was removed.');
    }
  }
}
