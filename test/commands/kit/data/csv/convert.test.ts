import { testSetup } from '@salesforce/core/lib/testSetup';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import Command from '../../../../../src/commands/kit/data/csv/convert';

jest.setTimeout(10000);
const commandName = 'kit:data:csv:convert';
describe(commandName, () => {
  const $$ = testSetup();
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

  const defaultArgs = ['-f', 'data/input.csv', '-o', 'data/output.csv'];
  it(defaultArgs.join(' '), async () => {
    await Command.run(defaultArgs);
    expect(createReadStream).toHaveBeenCalledWith('data/input.csv');
    expect(createWriteStream).toHaveBeenCalledWith('data/output.csv');
    expect(writeCsv).toHaveBeenCalledTimes(1);
    expect(writeCsv.mock.calls[0][0]).toEqual(csvRows);
  });

  const mappingArgs = defaultArgs.concat('-m', 'data/mapping.json');
  it(mappingArgs.join(' '), async () => {
    const readJson = jest
      .spyOn(fs, 'readJson')
      .mockImplementation(async (file) => ({ field: 'b' }));
    await Command.run(mappingArgs);
    expect(readJson).toHaveBeenCalledTimes(1);
    expect(readJson.mock.calls[0][0]).toBe('data/mapping.json');
    expect(writeCsv.mock.calls[0][0]).toEqual([
      { field: 'b1' },
      { field: 'b2' },
    ]);
  });

  const convertArgs = defaultArgs.concat('-c', 'data/convert.js');
  it(convertArgs.join(' '), async () => {
    const loadConverter = jest
      .spyOn(Command.prototype, 'loadConverter' as any)
      .mockImplementation((file) => (row) => ({ field: row.b.toUpperCase() }));
    await Command.run(convertArgs);
    expect(loadConverter).toHaveBeenCalledTimes(1);
    expect(loadConverter.mock.calls[0][0]).toBe('data/convert.js');
    expect(writeCsv.mock.calls[0][0]).toEqual([
      { field: 'B1' },
      { field: 'B2' },
    ]);
  });
});
