import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { deactivateFlows, FlowOperationResult } from '../../../flow.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'flow.deactivate'
);

export default class FlowDeactivate extends SfCommand<FlowOperationResult[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    name: Flags.string({
      char: 'n',
      multiple: true,
      required: true,
      summary: messages.getMessage('flags.name.summary'),
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<FlowOperationResult[]> {
    const { flags } = await this.parse(FlowDeactivate);
    const conn = flags['target-org'].getConnection(flags['api-version']);
    const results = await deactivateFlows(conn, flags.name);
    if (!this.jsonEnabled()) {
      for (const result of results) {
        if (result.error)
          this.error(`${result.name}: ${result.error}`, { exit: false });
        else if (result.warning) this.warn(`${result.name}: ${result.warning}`);
        else this.log(`${result.name}: deactivated`);
      }
    }
    if (results.some((result) => !result.success)) process.exitCode = 1;
    return results;
  }
}
