import { flags, SfdxCommand } from '@salesforce/command';
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
import * as path from 'path';
import CsvConvertCommand from './commands/kit/data/csv/convert';
import * as utils from './utils';

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

const csvFlags = CsvConvertCommand['flagsConfig'];

export const createBulkCommand = (
  operation: IngestOperation
): new (...args) => SfdxCommand => {
  const config = {
    object: flags.string({
      char: 'o',
      required: true,
      description: `the sObject name to ${operation}`,
    }),
    // csv settings
    csvfile: flags.filepath({
      char: 'f',
      required: true,
      description: `the CSV file path that defines the records to ${operation}`,
    }),
    resultfile: flags.filepath({
      char: 'r',
      description: `the CSV file path for writing the ${operation} results`,
    }),
    encoding: csvFlags.encoding,
    delimiter: csvFlags.delimiter,
    quote: csvFlags.quote,
    skiplines: csvFlags.skiplines,
    trim: csvFlags.trim,
    mapping: csvFlags.mapping,
    converter: csvFlags.converter,
    setnull: flags.boolean({
      description: `set blank values as null values during ${operation} operations (default: empty field values are ignored)`,
    }),
    convertonly: flags.boolean({
      description: `output converted.csv file and skip ${operation} for debugging`,
    }),
    // job settings
    concurrencymode: flags.string({
      default: 'Parallel',
      description: 'the concurrency mode (Parallel or Serial) for the job',
    }),
    assignmentruleid: flags.string({
      description:
        'the ID of a specific assignment rule to run for a case or a lead.',
    }),
    batchsize: flags.integer({
      char: 's',
      min: 1,
      max: 10000,
      default: 10000,
      description: 'the batch size of the job',
    }),
    wait: flags.integer({
      char: 'w',
      min: 0,
      description:
        'the number of minutes to wait for the command to complete before displaying the results',
    }),
  };

  const examples = [
    `$ sfdx kit:data:bulk:${operation} -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json`,
  ];

  if (operation === 'upsert') {
    config['externalid'] = flags.string({
      char: 'i',
      required: true,
      default: 'Id',
      description: 'the column name of the external ID',
    });
    examples.push(
      '$ sfdx kit:data:bulk:upsert -o MyObject__c -f ./path/to/MyObject__c.csv -c ./path/to/convert.js -i MyExternalId__c -w 10'
    );
  } else {
    examples.push(
      `$ sfdx kit:data:bulk:${operation} -o MyObject__c -f ./path/to/MyObject__c.csv -c ./path/to/convert.js -w 10`
    );
  }

  return class extends SfdxCommand {
    public static description = [
      `bulk ${operation} records from a CSV file`,
      'For information about CSV file formats, see [Prepare CSV Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in the Bulk API Developer Guide.',
    ].join('\n');

    public static examples = examples;

    protected static requiresUsername = true;
    protected static requiresProject = false;

    protected static flagsConfig = config;

    public async run(): Promise<BulkResult> {
      const {
        object,
        csvfile,
        mapping,
        converter,
        encoding,
        delimiter,
        quote,
        skiplines,
        trim,
        setnull,
      } = this.flags;

      const mappingJson = mapping ? await fs.readJson(mapping) : undefined;
      const script = converter ? utils.loadScript(converter) : {};
      const fieldTypes = await this.getFieldTypes(object);

      this.ux.startSpinner('Processing csv');

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

      this.ux.stopSpinner();

      if (this.flags.convertonly) {
        const base = path.basename(csvfile, path.extname(csvfile));
        this.saveCsv(
          path.join(path.dirname(csvfile), base + '.converted.csv'),
          rows
        );
        return;
      }

      this.ux.startSpinner(`Bulk ${operation}`);
      try {
        const result = await this.bulkLoad(
          this.org.getConnection(),
          object,
          operation,
          rows,
          {
            extIdField: this.flags.externalid,
            concurrencyMode: this.flags.concurrencymode,
            assignmentRuleId: this.flags.assignmentruleid,
            batchSize: this.flags.batchsize,
            wait: this.flags.wait,
          }
        );

        const batchErrors = [];
        if (this.flags.wait) {
          const { numberRecordsProcessed, numberRecordsFailed } =
            result.job as unknown as JsonMap;
          this.ux.stopSpinner(
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
            this.ux.styledHeader('Error details');
            this.ux.table(batchErrors, ['line', 'message']);
          }
        } else {
          this.ux.stopSpinner();
          this.ux.log('Check bulk job status with the command: ');
          this.ux.log(
            `sfdx force:org:open -u ${this.flags.targetusername} -p "lightning/setup/AsyncApiJobStatus/page?address=%2F${result.job.id}"`
          );
        }

        if (this.flags.resultfile) this.saveCsv(this.flags.resultfile, rows);

        return result;
      } catch (e) {
        this.ux.stopSpinner('error');
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
      return await utils.parseCsv(input, {
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

    private async getFieldTypes(sobject) {
      const conn = this.org.getConnection();
      const objectInfo = await conn.describe(sobject);
      return objectInfo.fields.reduce(
        (info, { name, type }) => Object.assign(info, { [name]: type }),
        {}
      );
    }
  };
};
