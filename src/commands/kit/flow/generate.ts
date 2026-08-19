import path from 'node:path';
import { Messages } from '@salesforce/core';
import { getCurrentApiVersion } from '@salesforce/source-deploy-retrieve';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { EmptyFlowFileResult, writeEmptyFlow } from '../../../flow.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'flow.generate'
);

export default class FlowGenerate extends SfCommand<EmptyFlowFileResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    name: Flags.string({
      char: 'n',
      required: true,
      summary: messages.getMessage('flags.name.summary'),
    }),
    label: Flags.string({
      char: 'l',
      summary: messages.getMessage('flags.label.summary'),
    }),
    'process-type': Flags.string({
      char: 't',
      required: true,
      summary: messages.getMessage('flags.process-type.summary'),
    }),
    'api-version': Flags.string({
      summary: messages.getMessage('flags.api-version.summary'),
    }),
    'output-dir': Flags.string({
      char: 'd',
      default: '.',
      summary: messages.getMessage('flags.output-dir.summary'),
    }),
    force: Flags.boolean({
      summary: messages.getMessage('flags.force.summary'),
    }),
  };

  public async run(): Promise<EmptyFlowFileResult> {
    const { flags } = await this.parse(FlowGenerate);
    const apiVersion =
      flags['api-version'] ?? (await getCurrentApiVersion()).toFixed(1);
    const result = await writeEmptyFlow(
      path.resolve(flags['output-dir']),
      flags.name,
      {
        apiVersion,
        label: flags.label ?? flags.name,
        processType: flags['process-type'],
      },
      flags.force
    );
    if (!this.jsonEnabled())
      this.log(`${result.name}: generated ${result.path}`);
    return result;
  }
}
