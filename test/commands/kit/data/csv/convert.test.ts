import { test } from '@salesforce/command/lib/test';
import { assert } from 'chai';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import { encodeStream } from 'iconv-lite';
import Command from '../../../../../src/commands/kit/data/csv/convert';
import { parseCsv } from '../../../../../src/commands/kit/data/csv/convert';

const { Readable } = require('stream');

describe('parseCsv', () => {
  const csvRows = [
    { col1: 'col1_1', col2: 'col2_1', col3: 'col3_1' },
    { col1: 'col1_2', col2: 'col2_2', col3: 'col3_2' },
    { col1: 'col1_3', col2: 'col2_3', col3: 'col3_3' }
  ];

  const csvStream = () => csv.write(csvRows, { headers: true });

  it('with no options', async () => {
    const rows = await parseCsv(csvStream());
    expect(rows).toEqual(csvRows)
  });

  it('with mapping', async () => {
    const rows = await parseCsv(csvStream(), {
      mapping: {
        Field1__c: 'col1',
        Field2__c: 'col3'
      }
    });
    expect(rows).toEqual([
      { Field1__c: 'col1_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_2', Field2__c: 'col3_2' },
      { Field1__c: 'col1_3', Field2__c: 'col3_3' }
    ]);
  });

  it('with invalid mapping', async () => {
    try {
      await parseCsv(csvStream(), {
        mapping: {
          Field1__c: 'col1',
          Field2__c: 'invalid_col'
        }
      });
      assert.fail("no error is thrown");
    } catch (e) {
      expect(e.message).toMatch("The column 'invalid_col' is not found");
    }
  });

  it('with convert', async () => {
    const rows = await parseCsv(csvStream(), {
      convert: (row) => {
        if (row.col1 === 'col1_2') return null;

        return {
          Field1__c: `${row.col1} ${row.col2}`,
          Field2__c: row.col3
        };
      }
    });
    expect(rows).toEqual([
      { Field1__c: 'col1_1 col2_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_3 col2_3', Field2__c: 'col3_3' }
    ]);
  });

  it('with delimiter', async () => {
    const rows = await parseCsv(
      Readable.from('a:b:c\nv1:v2:v3'),
      { delimiter: ':' }
    );
    expect(rows).toEqual([
      { a: 'v1', b: 'v2', c: 'v3' }
    ]);
  });

  it('with quote', async () => {
    const rows = await parseCsv(
      Readable.from(`a,b,c,d\n'1,2',3,"4,5"`),
      { quote: "'" }
    );
    expect(rows).toEqual([
      { a: '1,2', b: '3', c: '"4', d: '5"' }
    ]);
  });

  it('with skiplines', async () => {
    const rows = await parseCsv(
      Readable.from(`skip1,skip2\na,b\n1,2`),
      { skiplines: 1 }
    );
    expect(rows).toEqual([
      { a: '1', b: '2' }
    ]);
  });

  it('with trim', async () => {
    const rows = await parseCsv(
      Readable.from(`a,b\n 1\t ,   2`),
      { trim: true }
    );
    expect(rows).toEqual([
      { a: '1', b: '2' }
    ]);
  });

  it('with encoding', async () => {
    const rows = await parseCsv(
      Readable.from('col1,col2\n値1,値2').pipe(encodeStream('cp932')),
      { encoding: 'cp932' }
    );
    expect(rows).toEqual([
      { col1: '値1', col2: '値2' }
    ]);
  });
});

const commandName = 'kit:data:csv:convert';
describe(commandName, () => {
  const csvRows = [
    { 'a': 'a1', b: 'b1', c: 'c1' },
    { 'a': 'a2', b: 'b2', c: 'c2' }
  ];

  const createReadStream = jest.spyOn(fs, 'createReadStream').mockImplementation(file => csv.write(csvRows, { headers: true }));
  const createWriteStream = jest.spyOn(fs, 'createWriteStream').mockImplementation(file => {});
  const writeCsv = jest.spyOn(Command.prototype, 'writeCsv' as any).mockImplementation((rows, stream) => {});

  afterEach(() => {
    createReadStream.mockClear();
    createWriteStream.mockClear();
    writeCsv.mockClear();
  });

  const testSetup = test
    .stdout().stderr();

  const defaultArgs = ['-f', 'data/input.csv', '-o', 'data/output.csv'];
  testSetup
    .command([commandName].concat(defaultArgs))
    .it(defaultArgs.join(' '), ctx => {
      expect(createReadStream).toHaveBeenCalledWith('data/input.csv');
      expect(createWriteStream).toHaveBeenCalledWith('data/output.csv');
      expect(writeCsv).toHaveBeenCalledTimes(1);
      expect(writeCsv.mock.calls[0][0]).toEqual(csvRows);
    });

  let args = defaultArgs.concat('-m', 'data/mapping.json');
  const readJson = jest.spyOn(fs, 'readJson').mockImplementation(async (file) => ({field: 'b'}));
  testSetup
    .command([commandName].concat(args))
    .it(args.join(' '), ctx => {
      expect(readJson).toHaveBeenCalledTimes(1);
      expect(readJson.mock.calls[0][0]).toBe('data/mapping.json');
      expect(writeCsv.mock.calls[0][0]).toEqual([{field: 'b1'}, {field: 'b2'}]);
    });

  args = defaultArgs.concat('-c', 'data/convert.js');
  const loadConverter = jest.spyOn(Command.prototype, 'loadConverter' as any).mockImplementation(file => (row) => ({ field: row.b.toUpperCase() }));
  testSetup
    .command([commandName].concat(args))
    .it(args.join(' '), ctx => {
      expect(loadConverter).toHaveBeenCalledTimes(1);
      expect(loadConverter.mock.calls[0][0]).toBe('data/convert.js');
      expect(writeCsv.mock.calls[0][0]).toEqual([{field: 'B1'}, {field: 'B2'}]);
    });
});
