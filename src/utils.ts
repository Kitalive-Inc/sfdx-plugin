import * as path from 'path';
import { pipeline } from 'stream';
import { Command } from '@oclif/core';
import { JsonMap } from '@salesforce/ts-types';
import * as csv from 'fast-csv';
import { decodeStream } from 'iconv-lite';

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
    const rows = [];
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
          if (convert) row = convert(row);
          if (row) rows.push(row);
          lines++;
        } catch (e) {
          throw new Error(
            `A error occurred in csv file at line ${lines}: ${
              (e as Error).message
            }\ndata: ${JSON.stringify(row)}`
          );
        }
      });

    const callback = (e): void => (e ? reject(e) : resolve(rows));
    if (!encoding || encoding === 'utf8') {
      pipeline(input, parser, callback);
    } else {
      pipeline(input, decodeStream(encoding), parser, callback);
    }
  });
}

export type Converter = {
  start?: (context: Command) => void;
  convert: (row: JsonMap) => JsonMap;
  finish?: (rows: JsonMap[], context: Command) => JsonMap[];
};
export function loadScript(file: string): Converter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const script = require(path.resolve(file)) as Converter;
  if (!script.convert) throw new Error('function convert is not exported');
  return script;
}

export function columnMapper(mapping: JsonMap): (row: JsonMap) => JsonMap {
  const keys = Object.keys(mapping);
  return (row: JsonMap) => {
    const result = {};
    for (const to of keys) {
      const from = mapping[to] as string;
      if (!(from in row)) throw new Error(`The column '${from}' is not found`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      result[to] = row[from];
    }
    return result;
  };
}
