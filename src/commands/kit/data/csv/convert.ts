import { flags, SfdxCommand } from '@salesforce/command';
import { JsonMap } from '@salesforce/ts-types';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import { loadScript, parseCsv } from '../../../../utils';

export default class CsvConvertCommand extends SfdxCommand {
  public static description =
    'convert CSV data using column mapping file or Node.js script';

  public static examples = [
    '$ sfdx kit:data:csv:convert -f ./path/to/input.csv -m ./path/to/mapping.json',
    '$ sfdx kit:data:csv:convert -f ./path/to/input.csv -o ./path/to/output.csv -c ./path/to/convert.js -e cp932 -d :',
  ];

  protected static requiresUsername = false;
  protected static requiresProject = false;

  protected static flagsConfig = {
    inputfile: flags.filepath({
      char: 'f',
      description: 'the path of the input CSV file (default: standard input)',
    }),
    outputfile: flags.filepath({
      char: 'o',
      description: 'the path of the output CSV file (default: standard output)',
    }),
    encoding: flags.string({
      char: 'e',
      default: 'utf8',
      description: 'the input CSV file encoding',
    }),
    delimiter: flags.string({
      char: 'd',
      default: ',',
      description: 'the input CSV file delimiter',
    }),
    quote: flags.string({
      char: 'q',
      default: '"',
      description: 'the input CSV file quote character',
    }),
    skiplines: flags.integer({
      default: 0,
      description: 'the number of lines to skip',
    }),
    trim: flags.boolean({ description: 'trim all white space from columns' }),
    mapping: flags.filepath({
      char: 'm',
      description: 'the path of the JSON file that defines CSV column mappings',
    }),
    converter: flags.filepath({
      char: 'c',
      description: 'the path of the script to convert CSV rows',
    }),
  };

  public async run(): Promise<JsonMap[]> {
    const {
      inputfile,
      outputfile,
      mapping,
      converter,
      encoding,
      delimiter,
      quote,
      skiplines,
      trim,
    } = this.flags;

    const mappingJson = mapping ? await fs.readJson(mapping) : undefined;
    const convert = converter ? this.loadConverter(converter) : undefined;

    const input = inputfile ? fs.createReadStream(inputfile) : process.stdin;
    const rows = await parseCsv(input, {
      encoding,
      delimiter,
      quote,
      skiplines,
      trim,
      mapping: mappingJson,
      convert,
    });

    if (!this.flags.json) {
      const output = outputfile
        ? fs.createWriteStream(outputfile)
        : process.stdout;
      this.writeCsv(rows, output);
    }

    return rows;
  }

  private writeCsv(rows, stream) {
    csv.writeToStream(stream, rows, { headers: true });
  }

  private loadConverter(file) {
    return loadScript(file).convert;
  }
}
