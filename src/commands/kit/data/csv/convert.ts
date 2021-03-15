import { flags, SfdxCommand } from '@salesforce/command';
import { JsonMap } from '@salesforce/ts-types';
import * as csv from 'csv';
import * as fs from 'fs-extra';
import { decodeStream } from 'iconv-lite';
import * as path from 'path';
import { pipeline, Readable } from 'stream';

export default class CsvConvertCommand extends SfdxCommand {
  public static description = 'convert CSV data using column mapping file or Node.js script';

  public static examples = [
    '$ sfdx kit:data:csv:convert -f ./path/to/input.csv -o ./path/to/output.csv -m ./path/to/mapping.json',
    '$ sfdx kit:data:csv:convert -f ./path/to/input.csv -o ./path/to/output.csv -c ./path/to/convert.js -e cp932 -d :'
  ];

  protected static requiresUsername = false;
  protected static requiresProject = false;

  protected static flagsConfig = {
    inputfile: flags.filepath({ char: 'f', description: 'the path of the input CSV file (default: standard input)' }),
    outputfile: flags.filepath({ char: 'o', description: 'the path of the output CSV file (default: standard output)' }),
    encoding: flags.string({ char: 'e', default: 'utf8', description: 'the input CSV file encoding' }),
    delimiter: flags.string({ char: 'd', default: ',', description: 'the input CSV file delimiter' }),
    mapping: flags.filepath({ char: 'm', description: 'the path of the JSON file that defines CSV column mappings' }),
    converter: flags.filepath({ char: 'c', description: 'the path of the script to convert CSV rows' })
  };

  public async run(): Promise<JsonMap[]> {
    const { inputfile, outputfile, mapping, converter, encoding, delimiter } = this.flags;

    const mappingJson = mapping ? (await fs.readJson(mapping)) : undefined;
    const convert = converter ? this.loadScript(converter) : undefined;

    const input = inputfile ? fs.createReadStream(inputfile) : process.stdin;
    const rows = await parseCsv(input, {
      encoding,
      delimiter,
      mapping: mappingJson,
      convert
    });

    if (!this.flags.json) {
      const output = outputfile ? fs.createWriteStream(outputfile) : process.stdout;
      this.writeCsv(rows, output);
    }

    return rows;
  }

  private writeCsv(rows, stream) {
    csv.stringify(rows, { header: true }).pipe(stream);
  }

  private loadScript(file) {
    return loadScript(file);
  }
}

export async function parseCsv(
  input: Readable,
  options?: {
    encoding?: string,
    delimiter?: string,
    mapping?: JsonMap,
    convert?: (row: JsonMap) => JsonMap | null | undefined
  }
): Promise<JsonMap[]> {
  const { encoding, delimiter, mapping, convert } = options ?? {};
  return new Promise((resolve, reject) => {
    const reader = (!encoding || encoding === 'utf8') ? input : input.pipe(decodeStream(encoding));
    const mapper = mapping ? columnMapper(mapping) : undefined;

    const rows = [];
    const parser = csv.parse({
      columns: true,
      skip_empty_lines: true,
      skip_lines_with_empty_values: true,
      delimiter: delimiter === '\\t' ? '\t' : delimiter,
      on_record: (row, { lines }) => { try {
        if (mapper) row = mapper(row);
        if (convert) row = convert(row);
        if (row) rows.push(row);
        return row;
      } catch (e) {
        throw new Error(`A error occurred in csv file at line ${lines}: ${e.message}\ndata: ${JSON.stringify(row)}`);
      }}
    });

    pipeline(reader, parser, e => e ? reject(e) : resolve(rows));
  });
}

export function loadScript(file) {
  let script;
  try {
    script = require(path.resolve(file));
  } catch (e) {
    this.ux.error(e);
    throw e;
  }
  if (!script.convert) throw new Error('function convert is not exported');
  return script.convert;
}

export function columnMapper(mapping) {
  const keys = Object.keys(mapping);
  return row => {
    const result = {};
    for (const to of keys) {
      const from = mapping[to];
      if (!(from in row)) throw new Error(`The column '${from}' is not found`);
      result[to] = row[from];
    }
    return result;
  };
}
