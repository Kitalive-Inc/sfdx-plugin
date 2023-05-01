import { Messages } from '@salesforce/core';
import { Flags } from '@salesforce/sf-plugins-core';
import { createBulkCommand } from '../../../../bulk';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'data.bulk.upsert'
);

const Upsert = createBulkCommand('upsert');
Upsert.examples = messages.getMessages('examples');
Upsert.flags['externalid'] = Flags.string({
  char: 'i',
  required: true,
  default: 'Id',
  summary: messages.getMessage('flags.externalid.summary'),
});

export default Upsert;
