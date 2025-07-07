import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import * as csv from 'fast-csv';
import fs from 'fs-extra';
import * as utils from '../../../../utils.js';

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
    }),
    output: Flags.string({
      char: 'o', // eslint-disable-line sf-plugin/dash-o
      summary: messages.getMessage('flags.output.summary'),
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

    const mapping: JsonMap | undefined = flags.mapping
      ? ((await fs.readJson(flags.mapping)) as JsonMap)
      : undefined;
    const script = converter
      ? await utils.loadScript(converter)
      : ({} as utils.Converter);

    if (script.start) await script.start(this);

    const input = flags.input
      ? fs.createReadStream(flags.input)
      : process.stdin;
    let rows = await utils.parseCsv(input, {
      encoding,
      delimiter,
      quote,
      skiplines,
      trim,
      mapping,
      convert: script.convert,
    });

    if (script.finish) {
      const result = await script.finish(rows, this);
      if (result) rows = result;
    }

    if (!this.jsonEnabled()) {
      const output = flags.output
        ? fs.createWriteStream(flags.output)
        : process.stdout;
      csv.writeToStream(output, rows, { headers: true });
    }

    return rows;
  }
}
