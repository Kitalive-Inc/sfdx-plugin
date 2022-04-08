import { test } from '@salesforce/command/lib/test';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import Command from '../../../../../src/commands/kit/data/csv/convert';

jest.setTimeout(10000);
const commandName = 'kit:data:csv:convert';
describe(commandName, () => {
  const csvRows = [
    { a: 'a1', b: 'b1', c: 'c1' },
    { a: 'a2', b: 'b2', c: 'c2' },
  ];

  const createReadStream = jest
    .spyOn(fs, 'createReadStream')
    .mockImplementation((file) => csv.write(csvRows, { headers: true }));
  const createWriteStream = jest
    .spyOn(fs, 'createWriteStream')
    .mockImplementation((file) => {});
  const writeCsv = jest
    .spyOn(Command.prototype, 'writeCsv' as any)
    .mockImplementation((rows, stream) => {});

  afterEach(() => {
    createReadStream.mockClear();
    createWriteStream.mockClear();
    writeCsv.mockClear();
  });

  const testSetup = test.stdout().stderr();

  const defaultArgs = ['-f', 'data/input.csv', '-o', 'data/output.csv'];
  testSetup
    .command([commandName].concat(defaultArgs))
    .it(defaultArgs.join(' '), (ctx) => {
      expect(createReadStream).toHaveBeenCalledWith('data/input.csv');
      expect(createWriteStream).toHaveBeenCalledWith('data/output.csv');
      expect(writeCsv).toHaveBeenCalledTimes(1);
      expect(writeCsv.mock.calls[0][0]).toEqual(csvRows);
    });

  let args = defaultArgs.concat('-m', 'data/mapping.json');
  const readJson = jest
    .spyOn(fs, 'readJson')
    .mockImplementation(async (file) => ({ field: 'b' }));
  testSetup.command([commandName].concat(args)).it(args.join(' '), (ctx) => {
    expect(readJson).toHaveBeenCalledTimes(1);
    expect(readJson.mock.calls[0][0]).toBe('data/mapping.json');
    expect(writeCsv.mock.calls[0][0]).toEqual([
      { field: 'b1' },
      { field: 'b2' },
    ]);
  });

  args = defaultArgs.concat('-c', 'data/convert.js');
  const loadConverter = jest
    .spyOn(Command.prototype, 'loadConverter' as any)
    .mockImplementation((file) => (row) => ({ field: row.b.toUpperCase() }));
  testSetup.command([commandName].concat(args)).it(args.join(' '), (ctx) => {
    expect(loadConverter).toHaveBeenCalledTimes(1);
    expect(loadConverter.mock.calls[0][0]).toBe('data/convert.js');
    expect(writeCsv.mock.calls[0][0]).toEqual([
      { field: 'B1' },
      { field: 'B2' },
    ]);
  });
});
