import path from 'node:path';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  generateSourceDelta,
  SourceDeltaResult,
} from '../../../sourceDelta.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@kitalive/sfdx-plugin', 'source.delta');

type ProjectConfig = {
  packageDirectories?: Array<{ path: string }>;
  sourceApiVersion?: string;
};

export default class SourceDelta extends SfCommand<SourceDeltaResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;
  public static readonly flags = {
    from: Flags.string({
      char: 'f',
      required: true,
      summary: messages.getMessage('flags.from.summary'),
    }),
    'output-dir': Flags.string({
      char: 'd',
      default: 'output',
      summary: messages.getMessage('flags.output-dir.summary'),
    }),
    force: Flags.boolean({
      summary: messages.getMessage('flags.force.summary'),
    }),
    verbose: Flags.boolean({
      summary: messages.getMessage('flags.verbose.summary'),
    }),
    'target-org': Flags.optionalOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<SourceDeltaResult> {
    const { flags } = await this.parse(SourceDelta);
    const projectConfig =
      (await this.project!.resolveProjectConfig()) as ProjectConfig;
    const packageDirectories = projectConfig.packageDirectories ?? [];
    const connection = flags['target-org']?.getConnection(flags['api-version']);
    const result = await generateSourceDelta({
      root: this.project!.getPath(),
      packageDirectories,
      from: flags.from,
      outputDirectory: path.resolve(
        this.project!.getPath(),
        flags['output-dir']
      ),
      apiVersion: flags['api-version'] ?? projectConfig.sourceApiVersion,
      force: flags.force,
      verbose: flags.verbose,
      targetOrg: flags['target-org']?.getUsername(),
      connection,
    });

    if (!this.jsonEnabled()) this.printResult(result);
    if (result.hardBlockers.length) process.exitCode = 1;
    return result;
  }

  private printResult(result: SourceDeltaResult): void {
    this.log(`Output: ${result.outputDirectory}`);
    this.log(`Deployment instructions: ${result.deploymentInstructions}`);
    for (const diagnostic of result.diagnostics)
      this.log(`Diagnostic: ${diagnostic}`);
    for (const field of result.fieldTypeChanges) this.warn(field.warning);
    for (const warning of result.warnings) this.warn(warning);
    for (const review of result.manualReview) {
      this.warn(
        `Manual review: ${review.path}${
          review.line ? `:${review.line}` : ''
        } - ${review.reason}`
      );
    }
    for (const blocker of result.hardBlockers)
      this.error(`Hard blocker: ${blocker}`, { exit: false });
    this.log('Deployment steps:');
    result.deploySteps.forEach((step, index) =>
      this.log(`${index + 1}. ${step}`)
    );
  }
}
