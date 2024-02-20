import { expect } from 'chai';
import { TestContext } from '@salesforce/core/lib/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import * as csv from 'fast-csv';
import fs from 'fs-extra';
import Command from '../../../../../src/commands/kit/data/csv/convert';

describe('kit data csv convert', () => {
  const $$ = new TestContext();
  const csvRows = [
    { a: 'a1', b: 'b1', c: 'c1' },
    { a: 'a2', b: 'b2', c: 'c2' },
  ];

  let createReadStream: any;
  let createWriteStream: any;
  let writeCsv: any;
  beforeEach(() => {
    createReadStream = stubMethod($$.SANDBOX, fs, 'createReadStream').returns(
      csv.write(csvRows, { headers: true })
    );
    createWriteStream = stubMethod($$.SANDBOX, fs, 'createWriteStream');
    writeCsv = stubMethod($$.SANDBOX, Command.prototype, 'writeCsv');
  });

  const defaultArgs = ['-i', 'data/input.csv', '-o', 'data/output.csv'];
  it(defaultArgs.join(' '), async () => {
    await Command.run(defaultArgs);
    expect(createReadStream.calledWith('data/input.csv')).to.be.true;
    expect(createWriteStream.calledWith('data/output.csv')).to.be.true;
    expect(writeCsv.calledOnce).to.be.true;
    expect(writeCsv.args[0][0]).to.eql(csvRows);
  });

  const mappingArgs = defaultArgs.concat('-m', 'data/mapping.json');
  it(mappingArgs.join(' '), async () => {
    const readJson = stubMethod($$.SANDBOX, fs, 'readJson').resolves({
      field: 'b',
    });
    await Command.run(mappingArgs);
    expect(readJson.calledOnce).to.be.true;
    expect(readJson.args[0][0]).to.eq('data/mapping.json');
    expect(writeCsv.args[0][0]).to.eql([{ field: 'b1' }, { field: 'b2' }]);
  });

  const convertArgs = defaultArgs.concat('-c', 'data/convert.js');
  it(convertArgs.join(' '), async () => {
    const loadConverter = stubMethod(
      $$.SANDBOX,
      Command.prototype,
      'loadConverter'
    ).returns((row) => ({ field: row.b.toUpperCase() }));
    await Command.run(convertArgs);
    expect(loadConverter.calledOnce).to.be.true;
    expect(loadConverter.args[0][0]).to.eq('data/convert.js');
    expect(writeCsv.args[0][0]).to.eql([{ field: 'B1' }, { field: 'B2' }]);
  });
});
