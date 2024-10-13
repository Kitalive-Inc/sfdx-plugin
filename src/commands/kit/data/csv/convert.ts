import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import * as csv from 'fast-csv';
import fs from 'fs-extra';
import { loadScript, parseCsv } from '../../../../utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'data.csv.convert'
);

export default class CsvConvert extends SfCommand<JsonMap[]> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    input: Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.input.summary'),
      aliases: ['inputfile', 'f'],
      deprecateAliases: true,
    }),
    output: Flags.string({
      char: 'o',
      summary: messages.getMessage('flags.output.summary'),
      aliases: ['outputfile'],
      deprecateAliases: true,
    }),
    encoding: Flags.string({
      char: 'e',
      default: 'utf8',
      summary: messages.getMessage('flags.encoding.summary'),
    }),
    delimiter: Flags.string({
      char: 'd',
      default: ',',
      summary: messages.getMessage('flags.delimiter.summary'),
    }),
    quote: Flags.string({
      char: 'q',
      default: '"',
      summary: messages.getMessage('flags.quote.summary'),
    }),
    skiplines: Flags.integer({
      default: 0,
      summary: messages.getMessage('flags.skiplines.summary'),
    }),
    trim: Flags.boolean({ summary: messages.getMessage('flags.trim.summary') }),
    mapping: Flags.string({
      char: 'm',
      summary: messages.getMessage('flags.mapping.summary'),
    }),
    converter: Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.converter.summary'),
    }),
  };

  public async run(): Promise<JsonMap[]> {
    const { flags } = await this.parse(CsvConvert);
    const { converter, encoding, delimiter, quote, skiplines, trim } = flags;

    const mapping = flags.mapping
      ? await fs.readJson(flags.mapping)
      : undefined;
    const convert = converter ? await this.loadConverter(converter) : undefined;

    const input = flags.input
      ? fs.createReadStream(flags.input)
      : process.stdin;
    const rows = await parseCsv(input, {
      encoding,
      delimiter,
      quote,
      skiplines,
      trim,
      mapping,
      convert,
    });

    if (!this.jsonEnabled()) {
      const output = flags.output
        ? fs.createWriteStream(flags.output)
        : process.stdout;
      csv.writeToStream(output, rows, { headers: true });
    }

    return rows;
  }

  private async loadConverter(file: string) {
    return (await loadScript(file)).convert;
  }
}
