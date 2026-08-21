import path from 'node:path';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  editSourceReferences,
  SourceReferenceEditResult,
} from '../../../sourceDelta.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'source.edit-references'
);

type ProjectConfig = {
  packageDirectories?: Array<{ [key: string]: unknown; path: string }>;
  sourceApiVersion?: string;
};

export default class SourceEditReferences extends SfCommand<SourceReferenceEditResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;
  public static readonly flags = {
    from: Flags.string({
      char: 'f',
      required: true,
      summary: messages.getMessage('flags.from.summary'),
    }),
    field: Flags.string({
      multiple: true,
      required: true,
      summary: messages.getMessage('flags.field.summary'),
    }),
    path: Flags.string({
      char: 'p',
      multiple: true,
      required: true,
      summary: messages.getMessage('flags.path.summary'),
    }),
    // This value is only written to deploymentInstructions.md.
    'target-org': Flags.string({
      // eslint-disable-next-line sf-plugin/dash-o
      char: 'o',
      summary: messages.getMessage('flags.target-org.summary'),
    }),
    'output-dir': Flags.string({
      char: 'd',
      default: 'output',
      summary: messages.getMessage('flags.output-dir.summary'),
    }),
    force: Flags.boolean({
      summary: messages.getMessage('flags.force.summary'),
    }),
  };

  public async run(): Promise<SourceReferenceEditResult> {
    const { flags } = await this.parse(SourceEditReferences);
    const projectConfig =
      (await this.project!.resolveProjectConfig()) as ProjectConfig;
    const result = await editSourceReferences({
      root: this.project!.getPath(),
      packageDirectories: projectConfig.packageDirectories ?? [],
      from: flags.from,
      fields: flags.field,
      paths: flags.path,
      outputDirectory: path.resolve(
        this.project!.getPath(),
        flags['output-dir']
      ),
      targetOrg: flags['target-org'],
      force: flags.force,
      apiVersion: projectConfig.sourceApiVersion,
    });

    if (!this.jsonEnabled()) this.printResult(result);
    return result;
  }

  private printResult(result: SourceReferenceEditResult): void {
    this.log(`Output: ${result.outputDirectory}`);
    this.log(`Deployment instructions: ${result.deploymentInstructions}`);
    for (const item of result.paths)
      this.log(`${item.changed ? 'Edited' : 'Copied'}: ${item.path}`);
    for (const warning of result.warnings) this.warn(warning);
    for (const review of result.manualReview) {
      this.warn(
        `Manual review: ${review.path}${
          review.line ? `:${review.line}` : ''
        } - ${review.reason}`
      );
    }
    this.log('Deployment steps:');
    result.deploySteps.forEach((step, index) =>
      this.log(`${index + 1}. ${step}`)
    );
  }
}
