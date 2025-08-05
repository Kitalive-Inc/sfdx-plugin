/* eslint-disable */
import path from 'path';
import { Connection, Messages } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { Flags } from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import { Record } from '@jsforce/jsforce-node';
import {
  BatchInfo,
  BulkIngestBatchResult,
  BulkOptions as JobOptions,
  JobInfo,
} from '@jsforce/jsforce-node/lib/api/bulk.js';
import { IngestOperation } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import CsvConvertCommand, {
  CsvCommand,
  convertCsv,
} from './commands/kit/data/csv/convert.js';
import * as utils from './utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
export const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'data.bulk'
);

export type BulkOptions = JobOptions & {
  batchSize?: number;
  wait?: number;
};

export type BatchError = {
  line: number;
  message: string;
  data: Record;
};

export type BulkResult =
  | {
      job?: JobInfo;
      batches?: BatchInfo[];
      records: BulkIngestBatchResult;
      errors?: BatchError[];
    }
  | undefined;

export type QueryOptions = {
  all?: boolean;
  wait?: number;
};

export async function bulkQuery(
  conn: Connection,
  query: string,
  options?: QueryOptions
): Promise<Record[]> {
  const wait = options?.wait ?? 5;
  conn.bulk2.pollTimeout = Duration.minutes(wait).milliseconds;
  const result = await conn.bulk2.query(
    query,
    options?.all ? { scanAll: true } : {}
  );
  return result.toArray();
}

export function bulkLoad(
  conn: Connection,
  sobject: string,
  operation: IngestOperation,
  rows: Record[],
  options?: BulkOptions
): Promise<BulkResult> {
  const { batchSize = 10000, wait, ...jobOptions } = options || {};
  const job = conn.bulk.createJob(sobject, operation, jobOptions as JobOptions);

  const fetchResults = async (records: BulkIngestBatchResult) => ({
    job: await job.check(),
    batches: await job.list(),
    records,
  });

  const executeBatch = (batchRows: Record[]) =>
    new Promise((resolve, reject) => {
      const batch = job.createBatch();

      batch.on('error', (e) => {
        if (e.message.startsWith('Polling time out')) job.emit('error', e);
        reject(e);
      });

      batch.on('queue', () => {
        batch
          .check()
          .then((result) => {
            if (result.state === 'Failed') {
              reject(result.stateMessage);
            } else if (wait) {
              batch.poll(5000, wait * 60000);
            } else {
              fetchResults([]).then(resolve).catch(reject);
            }
          })
          .catch(reject);
      });

      batch.on('response', resolve);

      batch.execute(batchRows);
    });

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    job.on('error', reject);

    try {
      const results = await Promise.all(
        utils.chunk(rows, batchSize).map(executeBatch)
      );
      resolve(await fetchResults(results.flat() as BulkIngestBatchResult));
    } catch (e) {
      reject(e);
    } finally {
      await job.close();
    }
  });
}

const csvFlags = CsvConvertCommand.flags;

export function commonFlags(operation: IngestOperation) {
  return {
    sobject: Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.sobject.summary', [operation]),
    }),
    // csv settings
    'csv-file': Flags.string({
      char: 'f',
      required: true,
      summary: messages.getMessage('flags.csv-file.summary', [operation]),
      aliases: ['csvfile'],
      deprecateAliases: true,
    }),
    'result-file': Flags.string({
      char: 'r',
      summary: messages.getMessage('flags.result-file.summary', [operation]),
      aliases: ['resultfile'],
      deprecateAliases: true,
    }),
    encoding: csvFlags.encoding,
    delimiter: csvFlags.delimiter,
    quote: csvFlags.quote,
    'skip-lines': csvFlags['skip-lines'],
    trim: csvFlags.trim,
    mapping: csvFlags.mapping,
    converter: csvFlags.converter,
    'set-null': Flags.boolean({
      summary: messages.getMessage('flags.set-null.summary', [operation]),
      aliases: ['setnull'],
      deprecateAliases: true,
    }),
    'convert-only': Flags.boolean({
      summary: messages.getMessage('flags.convert-only.summary', [operation]),
      aliases: ['convertonly'],
      deprecateAliases: true,
    }),
    // job settings
    'concurrency-mode': Flags.string({
      default: 'Parallel',
      summary: messages.getMessage('flags.concurrency-mode.summary'),
      options: ['Serial', 'Parallel'],
      aliases: ['concurrencymode'],
      deprecateAliases: true,
    }),
    'assignment-rule-id': Flags.string({
      summary: messages.getMessage('flags.assignment-rule-id.summary'),
      aliases: ['assignmentruleid'],
      deprecateAliases: true,
    }),
    'batch-size': Flags.integer({
      min: 1,
      max: 10000,
      default: 10000,
      summary: messages.getMessage('flags.batch-size.summary'),
      aliases: ['batchsize'],
      deprecateAliases: true,
    }),
    wait: Flags.integer({
      char: 'w',
      min: 0,
      summary: messages.getMessage('flags.wait.summary'),
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };
}

export abstract class BulkCommand extends CsvCommand<BulkResult> {
  public static description = messages.getMessage('description');

  public static requiresProject = false;

  protected abstract operation: IngestOperation;

  public async run(): Promise<BulkResult> {
    const { flags } = await this.parse();
    this.org = flags['target-org'];
    const conn = this.org!.getConnection(flags['api-version']);
    this.conn = conn;
    const { sobject, 'csv-file': csvfile } = flags;

    const fieldTypes = await this.getFieldTypes(conn, sobject);

    this.spinner.start('Processing csv');
    try {
      let rows = await convertCsv(this, {
        input: csvfile,
        encoding: flags.encoding,
        delimiter: flags.delimiter,
        quote: flags.quote,
        skiplines: flags['skip-lines'],
        trim: flags.trim,
        setnull: flags['set-null'],
        mapping: flags.mapping,
        converter: flags.converter,
        fieldTypes,
      });

      this.spinner.stop();

      if (flags['convert-only']) {
        const base = path.basename(csvfile, path.extname(csvfile));
        await this.saveCsv(
          path.join(path.dirname(csvfile), base + '.converted.csv'),
          rows
        );
        return;
      }

      this.spinner.start(`Bulk ${this.operation}`);
      const result = await this.bulkLoad(conn, sobject, this.operation, rows, {
        extIdField: flags['external-id'],
        concurrencyMode: flags['concurrency-mode'],
        assignmentRuleId: flags['assignment-rule-id'],
        batchSize: flags['batch-size'],
        wait: flags.wait,
      });
      if (!result) return;

      const batchErrors: BatchError[] = [];
      if (flags.wait) {
        const { numberRecordsProcessed, numberRecordsFailed } =
          result.job as unknown as JsonMap;
        this.spinner.stop(
          `${numberRecordsProcessed} processed, ${numberRecordsFailed} failed.`
        );

        rows = rows.map((data, i) => {
          const { id, errors } = result.records[i] || {};
          const message = errors?.join(', ');
          if (message) {
            batchErrors.push({ line: i + 2, message, data });
          }
          return { ...data, Id: id, Errors: message };
        });

        if (batchErrors.length) {
          result.errors = batchErrors;
          this.styledHeader('Error details');
          this.table({
            data: batchErrors,
            columns: ['line', 'message'],
          });
        }
      } else {
        this.spinner.stop();
        this.log(
          messages.getMessage('asyncJob', [
            this.config.bin,
            conn.getUsername(),
            result.job?.id,
          ])
        );
      }

      if (flags['result-file']) await this.saveCsv(flags['result-file'], rows);

      return result;
    } catch (e) {
      this.spinner.stop('error');
      throw e;
    }
  }

  protected bulkLoad(
    conn: Connection,
    sobject: string,
    op: IngestOperation,
    rows: JsonMap[],
    options?: BulkOptions
  ) {
    return bulkLoad(conn, sobject, op, rows, options);
  }

  protected async getFieldTypes(conn: Connection, sobject: string) {
    const objectInfo = await conn.describe(sobject);
    return objectInfo.fields.reduce(
      (info, { name, type }) => Object.assign(info, { [name]: type }),
      {}
    );
  }
}
