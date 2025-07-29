import { expect } from 'chai';
import esmock from 'esmock';
import { TestContext } from '@salesforce/core/testSetup';
import * as csv from 'fast-csv';

describe('kit data csv convert', () => {
  const $$ = new TestContext();
  const csvRows = [
    { a: 'a1', b: 'b1', c: 'c1' },
    { a: 'a2', b: 'b2', c: 'c2' },
  ];

  let Command: any;
  let writeToStream: any;
  let createReadStream: any;
  let createWriteStream: any;
  let saveCsv: any;
  let readJson: any;
  let parseCsv: any;
  let loadScript: any;
  beforeEach(async () => {
    writeToStream = $$.SANDBOX.fake();
    createReadStream = $$.SANDBOX.fake.returns(
      csv.write(csvRows, { headers: true })
    );
    createWriteStream = $$.SANDBOX.fake();
    readJson = $$.SANDBOX.fake.returns({ field: 'b' });
    parseCsv = $$.SANDBOX.stub();
    loadScript = $$.SANDBOX.stub();
    Command = await esmock(
      '../../../../../src/commands/kit/data/csv/convert.js',
      {
        'fast-csv': { writeToStream },
        'fs-extra': { createReadStream, createWriteStream, readJson },
        '../../../../../src/utils.js': { parseCsv, loadScript },
      }
    );
    saveCsv = $$.SANDBOX.stub(Command.prototype, 'saveCsv');
  });

  const defaultArgs = ['-i', 'data/input.csv', '-o', 'data/output.csv'];
  it(defaultArgs.join(' '), async () => {
    parseCsv.resolves(csvRows);

    await Command.run(defaultArgs);
    expect(parseCsv.calledOnce).to.be.true;
    expect(saveCsv.calledWith('data/output.csv')).to.be.true;
    expect(saveCsv.calledOnce).to.be.true;
    expect(saveCsv.args[0][1]).to.eql(csvRows);
  });

  const mappingArgs = defaultArgs.concat('-m', 'data/mapping.json');
  it(mappingArgs.join(' '), async () => {
    const mappingResult = [{ field: 'b1' }, { field: 'b2' }];
    parseCsv.resolves(mappingResult);

    await Command.run(mappingArgs);
    expect(readJson.calledOnce).to.be.true;
    expect(readJson.args[0][0]).to.eq('data/mapping.json');
    expect(parseCsv.calledOnce).to.be.true;
    expect(saveCsv.args[0][1]).to.eql(mappingResult);
  });

  const convertArgs = defaultArgs.concat('-c', 'data/convert.js');
  it(convertArgs.join(' '), async () => {
    const convertResult = [{ field: 'B1' }, { field: 'B2' }];
    parseCsv.resolves(convertResult);
    loadScript.returns({
      convert: (row: any) => ({ field: row.b.toUpperCase() }),
    });

    await Command.run(convertArgs);
    expect(loadScript.calledOnce).to.be.true;
    expect(loadScript.args[0][0]).to.eq('data/convert.js');
    expect(parseCsv.calledOnce).to.be.true;
    expect(saveCsv.args[0][1]).to.eql(convertResult);
  });
});
