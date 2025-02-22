import path from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import * as csv from 'fast-csv';
import iconv from 'iconv-lite';

export function getScriptDir(url: string) {
  return path.dirname(fileURLToPath(url));
}

export function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0, l = array.length; i < l; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function* rangeGenerator(from: number, to: number): Iterable<number> {
  for (let i = from; i <= to; i++) {
    yield i;
  }
}

export function range(from: number, to: number): number[] {
  return Array.from(rangeGenerator(from, to));
}

export function parseCsv(
  input: NodeJS.ReadableStream,
  options?: {
    encoding?: string;
    delimiter?: string;
    quote?: string;
    skiplines?: number;
    trim?: boolean;
    mapping?: JsonMap;
    convert?: (row: JsonMap) => JsonMap | null | undefined;
  }
): Promise<JsonMap[]> {
  const { encoding, delimiter, quote, skiplines, trim, mapping, convert } =
    options ?? {};
  return new Promise((resolve, reject) => {
    const mapper = mapping ? columnMapper(mapping) : undefined;

    let lines = 2;
    const rows: JsonMap[] = [];
    const parser = csv
      .parse({
        headers: true,
        ignoreEmpty: true,
        delimiter: delimiter === '\\t' ? '\t' : delimiter ?? ',',
        quote: quote ?? '"',
        skipLines: skiplines,
        trim,
      })
      .on('data', (row: JsonMap) => {
        try {
          if (mapper) row = mapper(row);
          const r = convert ? convert(row) : row;
          if (r) rows.push(r);
          lines++;
        } catch (e) {
          throw new Error(
            `A error occurred in csv file at line ${lines}: ${
              (e as Error).message
            }\ndata: ${JSON.stringify(row)}`
          );
        }
      });

    const callback = (e: unknown): void => (e ? reject(e) : resolve(rows));
    if (!encoding || encoding === 'utf8') {
      pipeline(input, parser, callback);
    } else {
      pipeline(input, iconv.decodeStream(encoding), parser, callback);
    }
  });
}

export type Converter = {
  start?: (context: SfCommand<unknown>) => void;
  convert: (row: JsonMap) => JsonMap;
  finish?: (rows: JsonMap[], context: SfCommand<unknown>) => JsonMap[];
};
export async function loadScript(file: string): Promise<Converter> {
  let script: Converter;
  try {
    script = (await import(path.resolve(file))) as Converter;
  } catch (e: unknown) {
    throw new Error((e as Error).stack);
  }
  if (!script.convert) throw new Error('function convert is not exported');
  return script;
}

export function columnMapper(mapping: JsonMap): (row: JsonMap) => JsonMap {
  const keys = Object.keys(mapping);
  return (row: JsonMap) => {
    const result: JsonMap = {};
    for (const to of keys) {
      const from = mapping[to] as string;
      if (!(from in row)) throw new Error(`The column '${from}' is not found`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      result[to] = row[from];
    }
    return result;
  };
}
