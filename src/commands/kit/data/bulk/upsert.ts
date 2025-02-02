import { Messages } from '@salesforce/core';
import { Flags } from '@salesforce/sf-plugins-core';
import { IngestOperation } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { BulkCommand, commonFlags } from '../../../../bulk.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'data.bulk.upsert'
);

export default class UpsertCommand extends BulkCommand {
  public static examples = messages.getMessages('examples');

  public static flags = {
    ...BulkCommand.flags,
    ...commonFlags('upsert'),
    externalid: Flags.string({
      char: 'i',
      required: true,
      default: 'Id',
      summary: messages.getMessage('flags.externalid.summary'),
    }),
  };

  protected operation: IngestOperation = 'upsert';
}
