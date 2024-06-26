import { flags, SfdxCommand } from '@salesforce/command';
import { Batcher } from '@salesforce/plugin-data/lib/batcher.js';
import { JsonMap } from '@salesforce/ts-types';
import * as dayjs from 'dayjs';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Readable } from 'stream';
import { chunk } from '../../../../utils';
import CsvConvertCommand from '../csv/convert';
import { loadScript, parseCsv } from '../csv/convert';

// monkey patch
Batcher.prototype['splitIntoBatches'] = arg => arg;

function normalizeDateString(str, format?) {
  if (!str) return str;
  const d = dayjs(str);
  return format ? d.format(format) : d.toISOString();
}

const converters = {
  date: value => normalizeDateString(value, 'YYYY-MM-DD'),
  datetime: normalizeDateString
};

const csvFlags = CsvConvertCommand['flagsConfig'];

export default class UpsertCommand extends SfdxCommand {
  public static description = [
    'bulk upsert records from a CSV file',
    'Upsert records using Bulk API and returns a job ID and a batch ID. Use these IDs to check job status with data:bulk:status.',
    'For information about CSV file formats, see [Prepare CSV Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in the Bulk API Developer Guide.'
  ].join('\n');

  public static examples = [
    '$ sfdx kit:data:bulk:upsert -o Account -f ./path/to/Account.csv -m ./path/to/mapping.json',
    '$ sfdx kit:data:bulk:upsert -o MyObject__c -f ./path/to/MyObject__c.csv -c ./path/to/convert.js -i MyExternalId__c -w 10'
  ];

  protected static requiresUsername = true;
  protected static requiresProject = false;

  protected static flagsConfig = {
    object: flags.string({ char: 'o', required: true, description: 'the sObject name to upsert' }),
    externalid: flags.string({ char: 'i', required: true, default: 'Id', description: 'the column name of the external ID' }),
    // csv settings
    csvfile: flags.filepath({ char: 'f', required: true, description: 'the path of the CSV file that defines the records to upsert' }),
    encoding: csvFlags.encoding,
    delimiter: csvFlags.delimiter,
    quote: csvFlags.quote,
    skiplines: csvFlags.skiplines,
    trim: csvFlags.trim,
    mapping: csvFlags.mapping,
    converter: csvFlags.converter,
    setnull: flags.boolean({ description: 'set blank values as null values during upsert operations (default: empty field values are ignored)' }),
    save: flags.boolean({ description: 'output converted.csv file' }),
    saveonly: flags.boolean({ description: 'output converted.csv file and skip upsert for debugging' }),
    // job settings
    concurrencymode: flags.string({ default: 'Parallel', description: 'the concurrency mode (Parallel or Serial) for the job' }),
    assignmentruleid: flags.string({ description: 'the ID of a specific assignment rule to run for a case or a lead.' }),
    batchsize: flags.integer({ char: 's', min: 1, max: 10000, default: 10000, description: 'the batch size of the job' }),
    wait: flags.integer({ char: 'w', min: 0, description: 'the number of minutes to wait for the command to complete before displaying the results' })
  };

  public async run(): Promise<JsonMap[]> {
    const { csvfile, mapping, converter, encoding, delimiter, quote, skiplines, trim, setnull } = this.flags;

    const mappingJson = (mapping) ? (await fs.readJson(mapping)) : undefined;
    const script = converter ? this.loadScript(converter) : {};
    const fieldTypes = await this.getFieldTypes(this.flags.object);

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
      fieldTypes
    });

    if (script.finish) {
      const result = await script.finish(rows, this);
      if (result) rows = result;
    }

    this.ux.stopSpinner();

    if (this.flags.save || this.flags.saveonly) {
      const base = path.basename(csvfile, path.extname(csvfile));
      this.saveCsv(path.join(path.dirname(csvfile), base + '.converted.csv'), rows);
      if (this.flags.saveonly) return;
    }

    this.ux.startSpinner('Bulk Upsert');
    try {
      const job = await this.createJob(this.flags.object, {
        extIdField: this.flags.externalid,
        concurrencyMode: this.flags.concurrencymode,
        assignmentRuleId: this.flags.assignmentruleid
      });

      const batches = chunk(rows, this.flags.batchsize);
      const result = await this.executeBatches(job, batches, this.flags.object, this.flags.wait);
      return result as JsonMap[];
    } catch (e) {
      this.ux.stopSpinner('error');
      throw e;
    }
  }

  public async parseCsv(
    input: Readable,
    options?: {
      encoding?: string,
      delimiter?: string,
      quote?: string,
      skiplines?: number,
      trim?: boolean,
      setnull?: boolean,
      mapping?: JsonMap,
      convert?: (row: JsonMap) => JsonMap | null | undefined,
      fieldTypes?: { [field: string]: string }
    }
  ): Promise<JsonMap[]> {
    const { encoding, delimiter, quote, skiplines, trim, mapping, convert, setnull, fieldTypes } = options ?? {};
    return await parseCsv(input, { encoding, delimiter, quote, skiplines, trim, mapping, convert: row => {
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
          if (result[key] == null || result[key] === '') result[key] = '#N/A';
        }
      }
      return result;
    }});
  }

  private executeBatches(job, batches, object, wait) {
    const batcher = new Batcher(this.org.getConnection(), this.ux);
    return batcher.createAndExecuteBatches(job, batches, object, wait);
  }

  private saveCsv(file, rows) {
    csv.writeToPath(file, rows, { headers: true });
  }

  private loadScript(file) {
    return loadScript(file);
  }

  private async getFieldTypes(sobject) {
    const conn = this.org.getConnection();
    const objectInfo = await conn.describe(sobject);
    return objectInfo.fields.reduce((info, { name, type }) => Object.assign(info, { [name]: type }), {});
  }

  private async createJob(sobject, options) {
    const conn = this.org.getConnection();
    const job = conn.bulk.createJob(sobject, 'upsert', options);
    await job.on('error', e => { throw e; }).open();
    return job;
  }
}
