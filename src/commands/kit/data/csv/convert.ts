import { Connection, Org, Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import dayjs from 'dayjs';
import * as csv from 'fast-csv';
import fs from 'fs-extra';
import * as utils from '../../../../utils.js';

export type CsvParseOptions = {
  encoding?: string;
  delimiter?: string;
  quote?: string;
  skiplines?: number;
  trim?: boolean;
  setnull?: boolean;
  mapping?: JsonMap;
  convert?: (row: JsonMap) => JsonMap | null | undefined;
  fieldTypes?: { [field: string]: string };
};

export type CsvConvertOptions = {
  input?: string;
  encoding?: string;
  delimiter?: string;
  quote?: string;
  skiplines?: number;
  trim?: boolean;
  mapping?: string;
  converter?: string;
  fieldTypes?: { [field: string]: string };
};

export function normalizeDateString(str: string, format?: string) {
  if (!str) return str;
  const d = dayjs(str);
  return format ? d.format(format) : d.toISOString();
}

const converters = new Map([
  ['date', (value: string) => normalizeDateString(value, 'YYYY-MM-DD')],
  ['datetime', normalizeDateString],
]);

export interface CsvConvertContext extends SfCommand<unknown> {
  org?: Org;
  conn?: Connection;
  options?: CsvConvertOptions;

  parseCsv(
    input: string | NodeJS.ReadableStream,
    options?: CsvParseOptions
  ): Promise<JsonMap[]>;

  saveCsv(file: string, rows: JsonMap[]): Promise<void>;

  writeCsv(
    output: NodeJS.WritableStream,
    rows: JsonMap[],
    writeBOM: boolean
  ): Promise<void>;
}

export async function convertCsv(
  cmd: CsvConvertContext,
  options: CsvConvertOptions
): Promise<JsonMap[]> {
  const { input, mapping, converter, ...csvOptions } = options;
  const mappingJson = mapping
    ? ((await fs.readJson(mapping)) as JsonMap)
    : undefined;
  const script = converter
    ? await utils.loadScript(converter)
    : ({} as utils.Converter);

  if (script.start) await script.start(cmd);

  let rows = await cmd.parseCsv(input ?? process.stdin, {
    ...csvOptions,
    mapping: mappingJson,
    convert: script.convert,
  });

  if (script.finish) {
    const result = await script.finish(rows, cmd);
    if (result) rows = result;
  }

  return rows;
}

// eslint-disable-next-line sf-plugin/command-example,sf-plugin/command-summary
export abstract class CsvCommand<T>
  extends SfCommand<T>
  implements CsvConvertContext
{
  public org?: Org;
  public conn?: Connection;
  public options?: CsvConvertOptions;

  public async parseCsv(
    input: string | NodeJS.ReadableStream,
    options?: CsvParseOptions
  ): Promise<JsonMap[]> {
    const convert = options?.convert;
    return utils.parseCsv(
      typeof input === 'string' ? fs.createReadStream(input) : input,
      {
        ...options,
        convert: (row) => {
          const result = convert ? convert(row) : row;
          if (!result) return;
          if (options?.fieldTypes) {
            for (const key of Object.keys(result)) {
              const converter = converters.get(options.fieldTypes[key]);
              if (converter) result[key] = converter(result[key] as string);
            }
          }
          if (options?.setnull) {
            for (const key of Object.keys(result)) {
              if (key.includes('.')) continue; // skip reference
              if (result[key] == null || result[key] === '')
                result[key] = '#N/A';
            }
          }
          return result;
        },
      }
    );
  }

  public async saveCsv(file: string, rows: JsonMap[]): Promise<void> {
    return this.writeCsv(fs.createWriteStream(file), rows, true);
  }

  public async writeCsv(
    output: NodeJS.WritableStream,
    rows: JsonMap[],
    writeBOM: boolean = false
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      csv
        .writeToStream(output, rows, { headers: true, writeBOM })
        .on('error', reject)
        .on('finish', resolve);
    });
  }
}

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'data.csv.convert'
);

export default class CsvConvert extends CsvCommand<JsonMap[]> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    input: Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.input.summary'),
    }),
    output: Flags.string({
      char: 'f',
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
    'target-org': Flags.optionalOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<JsonMap[]> {
    const { flags } = await this.parse(CsvConvert);

    this.org = flags['target-org'];
    this.conn = this.org?.getConnection(flags['api-version'] as string);
    this.options = flags;

    const rows = await convertCsv(this, flags);
    if (flags.output) {
      await this.saveCsv(flags.output, rows);
    } else if (!this.jsonEnabled()) {
      await this.writeCsv(process.stdout, rows);
    }

    return rows;
  }
}
