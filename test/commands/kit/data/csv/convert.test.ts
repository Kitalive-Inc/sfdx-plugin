import { expect, test } from '@salesforce/command/lib/test';
import { assert } from 'chai';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import { encodeStream } from 'iconv-lite';
import * as sinon from 'sinon';
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
    expect(rows).to.eql(csvRows)
  });

  it('with mapping', async () => {
    const rows = await parseCsv(csvStream(), {
      mapping: {
        Field1__c: 'col1',
        Field2__c: 'col3'
      }
    });
    expect(rows).to.eql([
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
      expect(e.message).to.include("The column 'invalid_col' is not found");
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
    expect(rows).to.eql([
      { Field1__c: 'col1_1 col2_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_3 col2_3', Field2__c: 'col3_3' }
    ]);
  });

  it('with delimiter', async () => {
    const rows = await parseCsv(
      Readable.from('a:b:c\nv1:v2:v3'),
      { delimiter: ':' }
    );
    expect(rows).to.eql([
      { a: 'v1', b: 'v2', c: 'v3' }
    ]);
  });

  it('with quote', async () => {
    const rows = await parseCsv(
      Readable.from(`a,b,c,d\n'1,2',3,"4,5"`),
      { quote: "'" }
    );
    expect(rows).to.eql([
      { a: '1,2', b: '3', c: '"4', d: '5"' }
    ]);
  });

  it('with skiplines', async () => {
    const rows = await parseCsv(
      Readable.from(`skip1,skip2\na,b\n1,2`),
      { skiplines: 1 }
    );
    expect(rows).to.eql([
      { a: '1', b: '2' }
    ]);
  });

  it('with trim', async () => {
    const rows = await parseCsv(
      Readable.from(`a,b\n 1\t ,   2`),
      { trim: true }
    );
    expect(rows).to.eql([
      { a: '1', b: '2' }
    ]);
  });

  it('with encoding', async () => {
    const rows = await parseCsv(
      Readable.from('col1,col2\n値1,値2').pipe(encodeStream('cp932')),
      { encoding: 'cp932' }
    );
    expect(rows).to.eql([
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

  const createReadStream = sinon.spy(file => csv.write(csvRows, { headers: true })) as any;
  const createWriteStream = sinon.spy(file => {}) as any;
  const writeCsv = sinon.spy((rows, stream) => {}) as any;
  const parseCsv = sinon.spy((...args) => Promise.resolve(csvRows)) as any;

  afterEach(() => {
    createReadStream.resetHistory();
    createWriteStream.resetHistory();
    writeCsv.resetHistory();
    parseCsv.resetHistory();
  });

  const testSetup = test
    .stub(fs, 'createReadStream', createReadStream)
    .stub(fs, 'createWriteStream', createWriteStream)
    .stub(Command.prototype, 'writeCsv', writeCsv)
    .stdout();

  const stdin = sinon.spy(() => csv.write(csvRows, { headers: true })) as any;
  testSetup
    .stub(process, 'stdin', stdin)
    .command([commandName])
    .it('no argument', ctx => {
      expect(stdin.called).to.be.true;
      expect(writeCsv.calledOnce).to.be.true;
      expect(writeCsv.args[0][0]).to.eql(csvRows);
      expect(writeCsv.args[0][1]).to.eq(process.stdout);
    });

  const defaultArgs = ['-f', 'data/input.csv', '-o', 'data/output.csv'];
  testSetup
    .command([commandName].concat(defaultArgs))
    .it(defaultArgs.join(' '), ctx => {
      expect(createReadStream.calledWith('data/input.csv')).to.be.true;
      expect(createWriteStream.calledWith('data/output.csv')).to.be.true;
      expect(writeCsv.calledOnce).to.be.true;
      expect(writeCsv.args[0][0]).to.eql(csvRows);
    });

  let args = defaultArgs.concat('-m', 'data/mapping.json');
  const readJson = sinon.spy(file => ({field: 'b'})) as any;
  testSetup
    .stub(fs, 'readJson', readJson)
    .command([commandName].concat(args))
    .it(args.join(' '), ctx => {
      expect(readJson.calledOnce).to.be.true;
      expect(readJson.args[0][0]).to.eq('data/mapping.json');
      expect(writeCsv.args[0][0]).to.eql([{field: 'b1'}, {field: 'b2'}]);
    });

  args = defaultArgs.concat('-c', 'data/convert.js');
  const loadConverter = sinon.spy(file => (row) => ({ field: row.b.toUpperCase() })) as any;
  testSetup
    .stub(Command.prototype, 'loadConverter', loadConverter)
    .command([commandName].concat(args))
    .it(args.join(' '), ctx => {
      expect(loadConverter.calledOnce).to.be.true;
      expect(loadConverter.args[0][0]).to.eq('data/convert.js');
      expect(writeCsv.args[0][0]).to.eql([{field: 'B1'}, {field: 'B2'}]);
    });
});
