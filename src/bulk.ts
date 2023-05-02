/* eslint-disable */
import * as path from 'path';
import { Messages } from '@salesforce/core';
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import * as dayjs from 'dayjs';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import { Connection } from 'jsforce';
import {
  BatchInfo,
  BulkIngestBatchResult,
  BulkOptions as JobOptions,
  IngestOperation,
  JobInfo,
} from 'jsforce/api/bulk';
import CsvConvertCommand from './commands/kit/data/csv/convert';
import * as utils from './utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@kitalive/sfdx-plugin', 'data.bulk');

type BulkOptions = JobOptions & {
  batchSize?: number;
  wait?: number;
};

export type BulkResult = {
  job?: JobInfo;
  batches?: BatchInfo[];
  records: BulkIngestBatchResult;
  errors?: JsonMap[];
};

export function bulkQuery(conn: Connection, query: string): Promise<JsonMap[]> {
  return new Promise((resolve, reject) => {
    const records = [];
    conn.bulk
      .query(query)
      .on('error', reject)
      .on('record', (record) => records.push(record))
      .on('end', () => resolve(records));
  });
}

export function bulkLoad(
  conn: Connection,
  sobject: string,
  operation: IngestOperation,
  rows: JsonMap[],
  options?: BulkOptions
): Promise<BulkResult> {
  const { batchSize = 10000, wait, ...jobOptions } = options || {};
  const job = conn.bulk.createJob(sobject, operation, jobOptions as JobOptions);

  const fetchResults = async (records: BulkIngestBatchResult) => ({
    job: await job.check(),
    batches: await job.list(),
    records,
  });

  const executeBatch = (batchRows) =>
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

export function normalizeDateString(str, format?) {
  if (!str) return str;
  const d = dayjs(str);
  return format ? d.format(format) : d.toISOString();
}

const converters = {
  date: (value) => normalizeDateString(value, 'YYYY-MM-DD'),
  datetime: normalizeDateString,
};

const csvFlags = CsvConvertCommand.flags;

export const createBulkCommand = (operation: IngestOperation) =>
  class extends SfCommand<BulkResult> {
    public static description = messages.getMessage('description');

    public static examples = messages.getMessages('examples', [
      operation.charAt(0).toUpperCase() + operation.slice(1),
    ]);

    public static requiresProject = false;

    public static flags = {
      sobject: Flags.string({
        char: 's',
        required: true,
        summary: messages.getMessage('flags.sobject.summary', [operation]),
      }),
      // csv settings
      csvfile: Flags.string({
        char: 'f',
        required: true,
        summary: messages.getMessage('flags.csvfile.summary', [operation]),
      }),
      resultfile: Flags.string({
        char: 'r',
        summary: messages.getMessage('flags.resultfile.summary', [operation]),
      }),
      encoding: csvFlags.encoding,
      delimiter: csvFlags.delimiter,
      quote: csvFlags.quote,
      skiplines: csvFlags.skiplines,
      trim: csvFlags.trim,
      mapping: csvFlags.mapping,
      converter: csvFlags.converter,
      setnull: Flags.boolean({
        summary: messages.getMessage('flags.setnull.summary', [operation]),
      }),
      convertonly: Flags.boolean({
        summary: messages.getMessage('flags.convertonly.summary', [operation]),
      }),
      // job settings
      concurrencymode: Flags.string({
        default: 'Parallel',
        summary: messages.getMessage('flags.concurrencymode.summary'),
      }),
      assignmentruleid: Flags.string({
        summary: messages.getMessage('flags.assignmentruleid.summary'),
      }),
      batchsize: Flags.integer({
        min: 1,
        max: 10000,
        default: 10000,
        summary: messages.getMessage('flags.batchsize.summary'),
      }),
      wait: Flags.integer({
        char: 'w',
        min: 0,
        summary: messages.getMessage('flags.wait.summary'),
      }),
      'target-org': requiredOrgFlagWithDeprecations,
    };

    public async run(): Promise<BulkResult> {
      const { flags } = await this.parse();
      const conn = flags['target-org'].getConnection();
      const {
        sobject,
        csvfile,
        mapping,
        converter,
        encoding,
        delimiter,
        quote,
        skiplines,
        trim,
        setnull,
      } = flags;

      const mappingJson = mapping ? await fs.readJson(mapping) : undefined;
      const script = converter
        ? utils.loadScript(converter)
        : ({} as utils.Converter);
      const fieldTypes = await this.getFieldTypes(conn, sobject);

      this.spinner.start('Processing csv');

      if (script.start) await script.start(this);

      let rows = await this.parseCsv(fs.createReadStream(csvfile), {
        encoding,
        delimiter,
        quote,
        skiplines,
        trim: !!trim,
        setnull,
        mapping: mappingJson,
        convert: script.convert,
        fieldTypes,
      });

      if (script.finish) {
        const result = await script.finish(rows, this);
        if (result) rows = result;
      }

      this.spinner.stop();

      if (flags.convertonly) {
        const base = path.basename(csvfile, path.extname(csvfile));
        this.saveCsv(
          path.join(path.dirname(csvfile), base + '.converted.csv'),
          rows
        );
        return;
      }

      this.spinner.start(`Bulk ${operation}`);
      try {
        const result = await this.bulkLoad(conn, sobject, operation, rows, {
          extIdField: flags.externalid,
          concurrencyMode: flags.concurrencymode,
          assignmentRuleId: flags.assignmentruleid,
          batchSize: flags.batchsize,
          wait: flags.wait,
        });

        const batchErrors = [];
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
            this.table(batchErrors, {
              line: { header: 'LINE' },
              message: { header: 'MESSAGE' },
            });
          }
        } else {
          this.spinner.stop();
          this.log(
            messages.getMessage('asyncJob', [
              this.config.bin,
              flags['target-org'].options.aliasOrUsername,
              result.job?.id,
            ])
          );
        }

        if (flags.resultfile) this.saveCsv(flags.resultfile, rows);

        return result;
      } catch (e) {
        this.spinner.stop('error');
        throw e;
      }
    }

    public async parseCsv(
      input: NodeJS.ReadableStream,
      options?: {
        encoding?: string;
        delimiter?: string;
        quote?: string;
        skiplines?: number;
        trim?: boolean;
        setnull?: boolean;
        mapping?: JsonMap;
        convert?: (row: JsonMap) => JsonMap | null | undefined;
        fieldTypes?: { [field: string]: string };
      }
    ): Promise<JsonMap[]> {
      const {
        encoding,
        delimiter,
        quote,
        skiplines,
        trim,
        mapping,
        convert,
        setnull,
        fieldTypes,
      } = options ?? {};
      return utils.parseCsv(input, {
        encoding,
        delimiter,
        quote,
        skiplines,
        trim,
        mapping,
        convert: (row) => {
          const result = convert ? convert(row) : row;
          if (!result) return;
          if (fieldTypes) {
            for (const key of Object.keys(result)) {
              const converter = converters[fieldTypes[key]];
              if (converter) result[key] = converter(result[key]);
            }
          }
          if (setnull) {
            for (const key of Object.keys(result)) {
              if (key.includes('.')) continue; // skip reference
              if (result[key] == null || result[key] === '')
                result[key] = '#N/A';
            }
          }
          return result;
        },
      });
    }

    private bulkLoad(
      conn: Connection,
      sobject: string,
      op: IngestOperation,
      rows: JsonMap[],
      options?: BulkOptions
    ) {
      return bulkLoad(conn, sobject, op, rows, options);
    }

    private saveCsv(file, rows) {
      csv.writeToPath(file, rows, { headers: true, writeBOM: true });
    }

    private async getFieldTypes(conn, sobject) {
      const objectInfo = await conn.describe(sobject);
      return objectInfo.fields.reduce(
        (info, { name, type }) => Object.assign(info, { [name]: type }),
        {}
      );
    }
  };
