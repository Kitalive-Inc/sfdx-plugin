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
  let readJson: any;
  beforeEach(async () => {
    writeToStream = $$.SANDBOX.fake();
    createReadStream = $$.SANDBOX.fake.returns(
      csv.write(csvRows, { headers: true })
    );
    createWriteStream = $$.SANDBOX.fake();
    readJson = $$.SANDBOX.fake.returns({ field: 'b' });
    Command = await esmock(
      '../../../../../src/commands/kit/data/csv/convert.js',
      {
        'fast-csv': { writeToStream },
        'fs-extra': { createReadStream, createWriteStream, readJson },
      }
    );
  });

  const defaultArgs = ['-i', 'data/input.csv', '-o', 'data/output.csv'];
  it(defaultArgs.join(' '), async () => {
    await Command.run(defaultArgs);
    expect(createReadStream.calledWith('data/input.csv')).to.be.true;
    expect(createWriteStream.calledWith('data/output.csv')).to.be.true;
    expect(writeToStream.calledOnce).to.be.true;
    expect(writeToStream.args[0][1]).to.eql(csvRows);
  });

  const mappingArgs = defaultArgs.concat('-m', 'data/mapping.json');
  it(mappingArgs.join(' '), async () => {
    await Command.run(mappingArgs);
    expect(readJson.calledOnce).to.be.true;
    expect(readJson.args[0][0]).to.eq('data/mapping.json');
    expect(writeToStream.args[0][1]).to.eql([{ field: 'b1' }, { field: 'b2' }]);
  });

  const convertArgs = defaultArgs.concat('-c', 'data/convert.js');
  it(convertArgs.join(' '), async () => {
    const loadConverter = $$.SANDBOX.stub(
      Command.prototype,
      'loadConverter'
    ).returns((row: any) => ({ field: row.b.toUpperCase() }));
    await Command.run(convertArgs);
    expect(loadConverter.calledOnce).to.be.true;
    expect(loadConverter.args[0][0]).to.eq('data/convert.js');
    expect(writeToStream.args[0][1]).to.eql([{ field: 'B1' }, { field: 'B2' }]);
  });
});
