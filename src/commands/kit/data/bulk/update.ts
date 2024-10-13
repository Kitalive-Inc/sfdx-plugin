import { IngestOperation } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { BulkCommand, messages, commonFlags } from '../../../../bulk.js';

export default class UpdateCommand extends BulkCommand {
  public static examples = messages.getMessages('examples', ['Update']);

  public static flags = commonFlags('update');

  protected operation: IngestOperation = 'update';
}
