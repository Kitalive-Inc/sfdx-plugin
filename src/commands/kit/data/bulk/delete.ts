import fs from 'node:fs';
import { Connection, Messages, Org } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  composeQuery,
  getField,
  parseQuery,
} from '@jetstreamapp/soql-parser-js';
import { Record } from '@jsforce/jsforce-node';
import { IngestOperation } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { bulkLoadStream, BulkResult, BulkOptions } from '../../../../bulk.js';

type QueryPage = {
  nextRecordsUrl?: string;
  records: Record[];
};

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
      exactlyOne: ['query', 'query-file'],
      summary: messages.getMessage('flags.query.summary'),
    }),
    'query-file': Flags.string({
      exactlyOne: ['query', 'query-file'],
      summary: messages.getMessage('flags.query-file.summary'),
    }),
    hard: Flags.boolean({
      default: false,
      summary: messages.getMessage('flags.hard.summary'),
    }),
    'concurrency-mode': Flags.string({
      default: 'Parallel',
      options: ['Serial', 'Parallel'],
      summary: bulkMessages.getMessage('flags.concurrency-mode.summary'),
      aliases: ['concurrencymode'],
      deprecateAliases: true,
    }),
    'batch-size': Flags.integer({
      char: 's',
      min: 1,
      max: 10_000,
      default: 10_000,
      summary: bulkMessages.getMessage('flags.batch-size.summary'),
      aliases: ['batchsize'],
      deprecateAliases: true,
    }),
    wait: Flags.integer({
      char: 'w',
      default: 0,
      min: 0,
      summary: bulkMessages.getMessage('flags.wait.summary'),
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<BulkResult> {
    const { flags } = await this.parse();
    const org = flags['target-org'] as Org;
    const conn = org.getConnection(flags['api-version'] as string);
    const query = parseQuery(
      this.getQuery(
        flags.query as string | undefined,
        flags['query-file'] as string | undefined
      )
    );
    query.fields = [getField('Id')];
    const soql = composeQuery(query);

    this.spinner.start(flags.hard ? 'Bulk hard delete' : 'Bulk delete');

    try {
      const operation = flags.hard ? 'hardDelete' : 'delete';
      const result = await this.bulkLoadStream(
        conn,
        query.sObject!,
        operation,
        this.bulkQuery(conn, soql),
        {
          concurrencyMode: flags['concurrency-mode'] as 'Serial' | 'Parallel',
          batchSize: flags['batch-size'] as number,
          wait: flags.wait as number,
        }
      );
      if (!result) {
        this.spinner.stop('no records');
        return { records: [] };
      }

      if (flags.wait) {
        const numberRecordsProcessed = Number(
          result.job?.numberRecordsProcessed
        );
        const numberRecordsFailed = Number(result.job?.numberRecordsFailed);
        const errors = result.records
          .filter((r) => !r.success)
          .map((r) => ({ id: r.id, errors: r.errors.join(', ') }));
        this.spinner.stop(
          `${numberRecordsProcessed} processed, ${numberRecordsFailed} failed.`
        );
        if (errors.length) {
          this.styledHeader('Error details');
          this.table({
            data: errors,
            columns: ['id', 'errors'],
          });
        }
      } else {
        this.spinner.stop();
        this.log(
          bulkMessages.getMessage('asyncJob', [
            this.config.bin,
            org.getUsername(),
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

  public async *bulkQuery(
    conn: Connection,
    query: string
  ): AsyncIterable<Record> {
    let url = `/query?q=${encodeURIComponent(query)}`;

    do {
      // eslint-disable-next-line no-await-in-loop
      const page: QueryPage = await conn.requestGet(url);
      yield* page.records;
      url = page.nextRecordsUrl ?? '';
    } while (url);
  }

  public getQuery(query?: string, queryFile?: string): string {
    return query ?? fs.readFileSync(queryFile as string).toString('utf8');
  }

  public bulkLoadStream(
    conn: Connection,
    sobject: string,
    operation: IngestOperation,
    rows: AsyncIterable<Record>,
    options?: BulkOptions
  ) {
    return bulkLoadStream(conn, sobject, operation, rows, options);
  }
}
