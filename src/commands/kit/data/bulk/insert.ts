import { IngestOperation } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { BulkCommand, messages, commonFlags } from '../../../../bulk.js';

export default class InsertCommand extends BulkCommand {
  public static examples = messages.getMessages('examples', ['Insert']);

  public static flags = commonFlags('insert');

  protected operation: IngestOperation = 'insert';
}
