import { flags, SfdxCommand } from '@salesforce/command';
import { JsonMap } from '@salesforce/ts-types';
import { composeQuery, getField, parseQuery } from 'soql-parser-js';
import { bulkLoad, bulkQuery, BulkResult } from '../../../../bulk';

export default class DeleteCommand extends SfdxCommand {
  public static description = 'bulk delete records by SOQL select query';

  public static examples = [
    '$ sfdx kit:data:bulk:delete -q \'SELECT Id FROM Opportunity WHERE CloseDate < LAST_N_YEARS:5\''
  ];

  protected static requiresUsername = true;
  protected static requiresProject = false;

  protected static flagsConfig = {
    query: flags.string({ char: 'q', required: true, description: 'SOQL query to delete' }),
    hard: flags.boolean({ default: false, description: 'perform a hard delete' }),
    concurrencymode: flags.string({ default: 'Parallel', description: 'the concurrency mode (Parallel or Serial) for the job' }),
    batchsize: flags.integer({ char: 's', min: 1, max: 10000, default: 10000, description: 'the batch size of the job' }),
    wait: flags.integer({ char: 'w', min: 0, description: 'the number of minutes to wait for the command to complete before displaying the results' })
  };

  public async run(): Promise<BulkResult> {
    const query = parseQuery(this.flags.query);
    query.fields = [getField('Id')];
    const soql = composeQuery(query);
    const conn = this.org.getConnection();
    const { concurrencymode: concurrencyMode, batchsize: batchSize, wait, hard } = this.flags;

    this.ux.startSpinner(hard ? 'Bulk hard delete' : 'Bulk delete');

    try {
      const rows = await this.bulkQuery(conn, soql);
      if (!rows.length) {
        this.ux.stopSpinner('no records');
        return { records: [] };
      }

      const operation = hard ? 'hardDelete' : 'delete';
      const result = await this.bulkLoad(conn, query.sObject, operation, rows, { concurrencyMode, batchSize, wait });

      if (wait) {
        const { numberRecordsProcessed, numberRecordsFailed } = result.job as unknown as JsonMap;
        const errors = result.records.filter(r => !r.success).map(r => ({ id: r.id, errors: r.errors.join(', ') }));
        this.ux.stopSpinner(`${numberRecordsProcessed} processed, ${numberRecordsFailed} failed.`);
        if (errors.length) {
          this.ux.styledHeader('Error details');
          this.ux.table(errors, ['id', 'errors']);
        }
      } else {
        this.ux.stopSpinner();
        this.ux.log('Check bulk job status with the command: ');
        this.ux.log(`sfdx force:org:open -u ${this.flags.targetusername} -p "lightning/setup/AsyncApiJobStatus/page?address=%2F${result.job?.id}"`);
      }

      return result;
    } catch (e) {
      this.ux.stopSpinner('error');
      throw e;
    }
  }

  private bulkQuery(conn, query) {
    return bulkQuery(conn, query);
  }

  private bulkLoad(conn, sobject, operation, rows, options) {
    return bulkLoad(conn, sobject, operation, rows, options);
  }
}
