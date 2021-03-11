import { flags, SfdxCommand } from '@salesforce/command';
import { JsonMap } from '@salesforce/ts-types';
import * as csv from 'csv';
import * as fs from 'fs-extra';
import { decodeStream } from 'iconv-lite';
import * as path from 'path';
import { pipeline, Readable } from 'stream';
import { chunk } from '../../../../utils';

/* tslint:disable:no-var-requires */
const ALM_PATH = path.dirname(require.resolve('salesforce-alm'));
const dataBulk = require(path.join(ALM_PATH, 'lib/data/dataBulkUpsertCommand'));
const logger = require(path.join(ALM_PATH, 'lib/core/logApi'));

function columnMapper(mapping) {
  const cols = Object.keys(mapping);
  return row => cols.reduce((r, c) => Object.assign(r, { [c]: row[mapping[c]] }), {});
}

export default class UpsertCommand extends SfdxCommand {
  public static description = [
    'bulk upsert records from a CSV file',
    'Upsert records using Bulk API and returns a job ID and a batch ID. Use these IDs to check job status with data:bulk:status.',
    'For information about CSV file formats, see [Prepare CSV Files](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm) in the Bulk API Developer Guide.'
  ].join('\n');

  public static examples = [
    '$ sfdx kit:data:bulk:upsert -s Account -f ./path/to/Account.csv -m ./path/to/mapping.json',
    '$ sfdx kit:data:bulk:upsert -s MyObject__c -f ./path/to/MyObject__c.csv -t ./path/to/transformer.js -i MyExternalId__c -w 10'
  ];

  protected static requiresUsername = true;
  protected static requiresProject = false;

  protected static flagsConfig = {
    object: flags.string({ char: 'o', required: true, description: 'the sObject name to upsert' }),
    csvfile: flags.filepath({ char: 'f', required: true, description: 'the path of the CSV file that defines the records to upsert' }),
    externalid: flags.string({ char: 'i', required: true, default: 'Id', description: 'the column name of the external ID' }),
    concurrencymode: flags.string({ default: 'Parallel', description: 'the concurrency mode (Parallel or Serial) for the job' }),
    assignmentruleid: flags.string({ description: 'the ID of a specific assignment rule to run for a case or a lead.' }),
    encoding: flags.string({ char: 'e', default: 'utf8', description: 'the csv file encoding' }),
    fieldmapping: flags.filepath({ char: 'm', description: 'the path of the JSON file that defines field mappings' }),
    transformer: flags.filepath({ char: 't', description: 'the path of the script to transform csv data' }),
    batchsize: flags.integer({ char: 's', min: 1, max: 10000, default: 10000, description: 'the batch size of the job' }),
    save: flags.boolean({ description: 'output transformed.csv file for debugging' }),
    wait: flags.integer({ char: 'w', min: 0, description: 'the number of minutes to wait for the command to complete before displaying the results' })
  };

  public async run(): Promise<JsonMap> {
    const { csvfile, fieldmapping, transformer } = this.flags;

    const mapping = (fieldmapping) ? (await fs.readJson(fieldmapping)) : null;
    const transform = transformer ? this.loadScript(transformer) : null;

    this.ux.startSpinner('Processing csv');
    const rows = await this.parseCsv(fs.createReadStream(csvfile), this.flags.encoding, mapping, transform);
    this.ux.stopSpinner();

    if (this.flags.save) {
      const base = path.basename(csvfile, path.extname(csvfile));
      this.saveCsv(path.join(path.dirname(csvfile), base + '.transformed.csv'), rows);
    }

    this.ux.startSpinner('Bulk Upsert');
    try {
      const job = this.createJob(this.flags.object, {
        extIdField: this.flags.externalid,
        concurrencyMode: this.flags.concurrencymode,
        assignmentRuleId: this.flags.assignmentruleid
      });

      const batches = chunk(rows, this.flags.batchsize);
      logger.setHumanConsumable(!this.flags.json);
      return await dataBulk.createAndExecuteBatches(this.org.getConnection(), job, batches, this.flags.object, this.flags.wait);
    } catch (e) {
      this.ux.stopSpinner('error');
      throw e;
    }
  }

  public async parseCsv(
    input: Readable,
    encoding?: string,
    columnMappings?: JsonMap,
    transform?: (row: JsonMap) => JsonMap | null | undefined
  ): Promise<JsonMap[]> {
    return new Promise((resolve, reject) => {
      const reader = (!encoding || encoding === 'utf8') ? input : input.pipe(decodeStream(encoding));
      const mapper = columnMappings ? columnMapper(columnMappings) : null;

      const rows = [];
      const parser = csv.parse({
        columns: true,
        skip_empty_lines: true,
        skip_lines_with_empty_values: true,
        on_record: row => {
          let result = row;
          if (mapper) result = mapper(result);
          if (transform) result = transform(result);
          if (result) rows.push(result);
          return result;
        }
      });

      pipeline(reader, parser, e => e ? reject(e) : resolve(rows));
    });
  }

  private saveCsv(file, rows) {
    csv.stringify(rows, { header: true })
      .pipe(fs.createWriteStream(file));
  }

  private loadScript(file) {
    let script;
    try {
      script = require(path.resolve(file));
    } catch (e) {
      this.ux.error(e);
      throw e;
    }
    if (!script.transform) throw new Error('function transform is not exported');
    return script.transform;
  }

  private createJob(sobject, options) {
    return this.org.getConnection().bulk.createJob(sobject, 'upsert', options).on('error', e => { throw e; });
  }
}
