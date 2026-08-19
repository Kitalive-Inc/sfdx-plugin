import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  deleteFlowVersions,
  DeleteFlowVersionsMode,
  FlowOperationResult,
} from '../../../flow.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@kitalive/sfdx-plugin', 'flow.delete');

export default class FlowDelete extends SfCommand<FlowOperationResult[]> {
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
    'keep-latest-version': Flags.boolean({
      exclusive: ['inactive-versions'],
      summary: messages.getMessage('flags.keep-latest-version.summary'),
    }),
    'inactive-versions': Flags.boolean({
      exclusive: ['keep-latest-version'],
      summary: messages.getMessage('flags.inactive-versions.summary'),
    }),
  };

  public async run(): Promise<FlowOperationResult[]> {
    const { flags } = await this.parse(FlowDelete);
    const conn = flags['target-org'].getConnection(flags['api-version']);
    let mode: DeleteFlowVersionsMode = 'all';
    if (flags['keep-latest-version']) mode = 'keep-latest';
    else if (flags['inactive-versions']) mode = 'inactive';
    const results = await deleteFlowVersions(conn, flags.name, mode);
    if (!this.jsonEnabled()) {
      for (const result of results) {
        const version = result.versionNumber
          ? ` version ${result.versionNumber}`
          : '';
        if (result.error)
          this.error(`${result.name}${version}: ${result.error}`, {
            exit: false,
          });
        else if (result.warning)
          this.warn(`${result.name}${version}: ${result.warning}`);
        else this.log(`${result.name}${version}: deleted`);
      }
    }
    if (results.some((result) => !result.success)) process.exitCode = 1;
    return results;
  }
}
