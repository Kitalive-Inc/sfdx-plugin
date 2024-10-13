import { Connection, Messages } from '@salesforce/core';
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import soqlParser from '@jetstreamapp/soql-parser-js';
import { Record } from '@jsforce/jsforce-node';
import { IngestOperation } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import {
  bulkLoad,
  bulkQuery,
  BulkResult,
  BulkOptions,
} from '../../../../bulk.js';
const { composeQuery, getField, parseQuery } = soqlParser;

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
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
      max: 10_000,
      default: 10_000,
      summary: bulkMessages.getMessage('flags.batchsize.summary'),
    }),
    wait: Flags.integer({
      char: 'w',
      min: 0,
      summary: bulkMessages.getMessage('flags.wait.summary'),
    }),
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<BulkResult> {
    const { flags } = await this.parse();
    const conn = flags['target-org'].getConnection(flags['api-version']);
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
      const result = await this.bulkLoad(
        conn,
        query.sObject!,
        operation,
        rows,
        {
          concurrencyMode: flags.concurrencymode,
          batchSize: flags.batchsize,
          wait: flags.wait,
        }
      );
      if (!result) return;

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

  public bulkQuery(conn: Connection, query: string) {
    return bulkQuery(conn, query);
  }

  public bulkLoad(
    conn: Connection,
    sobject: string,
    operation: IngestOperation,
    rows: Record[],
    options?: BulkOptions
  ) {
    return bulkLoad(conn, sobject, operation, rows, options);
  }
}
