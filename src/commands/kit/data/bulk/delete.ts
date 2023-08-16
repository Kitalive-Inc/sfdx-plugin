import { Messages } from '@salesforce/core';
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import { composeQuery, getField, parseQuery } from 'soql-parser-js';
import { bulkLoad, bulkQuery, BulkResult } from '../../../../bulk';

Messages.importMessagesDirectory(__dirname);
const bulkMessages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'data.bulk'
);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'data.bulk.delete'
);

export default class DeleteCommand extends SfCommand<BulkResult> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    query: Flags.string({
      char: 'q',
      required: true,
      summary: messages.getMessage('flags.query.summary'),
    }),
    hard: Flags.boolean({
      default: false,
      summary: messages.getMessage('flags.hard.summary'),
    }),
    concurrencymode: Flags.string({
      default: 'Parallel',
      summary: bulkMessages.getMessage('flags.concurrencymode.summary'),
    }),
    batchsize: Flags.integer({
      char: 's',
      min: 1,
      max: 10000,
      default: 10000,
      summary: bulkMessages.getMessage('flags.batchsize.summary'),
    }),
    wait: Flags.integer({
      char: 'w',
      min: 0,
      summary: bulkMessages.getMessage('flags.wait.summary'),
    }),
    'target-org': requiredOrgFlagWithDeprecations,
  };

  public async run(): Promise<BulkResult> {
    const { flags } = await this.parse();
    const conn = flags['target-org'].getConnection();
    const query = parseQuery(flags.query);
    query.fields = [getField('Id')];
    const soql = composeQuery(query);

    this.spinner.start(flags.hard ? 'Bulk hard delete' : 'Bulk delete');

    try {
      const rows = await this.bulkQuery(conn, soql);
      if (!rows.length) {
        this.spinner.stop('no records');
        return { records: [] };
      }

      const operation = flags.hard ? 'hardDelete' : 'delete';
      const result = await this.bulkLoad(conn, query.sObject, operation, rows, {
        concurrencyMode: flags.concurrencymode,
        batchSize: flags.batchsize,
        wait: flags.wait,
      });

      if (flags.wait) {
        const { numberRecordsProcessed, numberRecordsFailed } =
          result.job as unknown as JsonMap;
        const errors = result.records
          .filter((r) => !r.success)
          .map((r) => ({ id: r.id, errors: r.errors.join(', ') }));
        this.spinner.stop(
          `${numberRecordsProcessed as number} processed, ${
            numberRecordsFailed as number
          } failed.`
        );
        if (errors.length) {
          this.styledHeader('Error details');
          this.table(errors, {
            id: { header: 'ID' },
            errors: { header: 'ERRORS' },
          });
        }
      } else {
        this.spinner.stop();
        this.log(
          bulkMessages.getMessage('asyncJob', [
            this.config.bin,
            flags['target-org'].options.aliasOrUsername,
            result.job?.id,
          ])
        );
      }

      return result;
    } catch (e) {
      this.spinner.stop('error');
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
