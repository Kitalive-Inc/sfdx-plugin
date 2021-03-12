import { expect, test } from '@salesforce/command/lib/test';
import * as csv from 'csv';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import Command from '../../../../../src/commands/kit/data/bulk/upsert';

const { Readable } = require('stream');
const ALM_PATH = path.dirname(require.resolve('salesforce-alm'));
const dataBulk= require(path.join(ALM_PATH, 'lib/data/dataBulkUpsertCommand'));

describe('.parseCsv', () => {
  const subject = Command.prototype.parseCsv;

  const csvRows = [
    { col1: 'col1_1', col2: 'col2_1', col3: 'col3_1' },
    { col1: 'col1_2', col2: 'col2_2', col3: 'col3_2' },
    { col1: 'col1_3', col2: 'col2_3', col3: 'col3_3' }
  ];

  const csvStream = () => csv.stringify(csvRows, { header: true });

  it('with no options', async () => {
    const rows = await subject(csvStream());
    expect(rows).to.eql(csvRows)
  });

  it('with mapping', async () => {
    const rows = await subject(csvStream(), {
      encoding: 'utf8',
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

  it('with transform', async () => {
    const rows = await subject(csvStream(), {
      transform: (row) => {
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

  it('with setnull', async () => {
    const rows = await subject(
      Readable.from('empty,reference.key,value\n,,test'),
      { setnull: true }
    );
    expect(rows).to.eql([
      { empty: '#N/A', 'reference.key': '', value: 'test' }
    ]);
  });

  it('with delimiter', async () => {
    const rows = await subject(
      Readable.from('a:b:c\nv1:v2:v3'),
      { delimiter: ':' }
    );
    expect(rows).to.eql([
      { a: 'v1', b: 'v2', c: 'v3' }
    ]);
  });
});

const commandName = 'kit:data:bulk:upsert';
describe(commandName, () => {
  const csvRows = [
    { 'Account.ExternalId__c': 'code1', LastName: 'contact1', Email: 'contact1@example.com' },
    { 'Account.ExternalId__c': 'code1', LastName: 'contact2', Email: 'contact2@example.com' },
    { 'Account.ExternalId__c': 'code2', LastName: 'contact3', Email: 'contact3@example.com' }
  ];

  const job = {};
  const createReadStream = sinon.spy(file => csv.stringify(csvRows));
  const parseCsv = sinon.spy((...args) => Promise.resolve(csvRows));
  const saveCsv = sinon.spy();
  const createJob = sinon.spy((sobject, options) => Promise.resolve(job));
  const createAndExecuteBatches = sinon.spy((...args) => Promise.resolve());

  afterEach(() => {
    createReadStream.resetHistory();
    parseCsv.resetHistory();
    saveCsv.resetHistory();
    createJob.resetHistory();
    createAndExecuteBatches.resetHistory();
  });

  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stub(fs, 'createReadStream', createReadStream)
    .stub(Command.prototype, 'parseCsv', parseCsv)
    .stub(Command.prototype, 'saveCsv', saveCsv)
    .stub(Command.prototype, 'createJob', createJob)
    .stub(dataBulk, 'createAndExecuteBatches', createAndExecuteBatches)
    .stdout();

  const defaultArgs = ['-o', 'Contact', '-f', 'data/Contact.csv'];
  testSetup
    .command([commandName].concat(defaultArgs))
    .it(defaultArgs.join(' '), ctx => {
      expect(createReadStream.calledWith('data/Contact.csv')).to.be.true;

      expect(parseCsv.calledOnce).to.be.true;
      expect(parseCsv.args[0][1]).to.eql({
        encoding: 'utf8',
        delimiter: ',',
        mapping: undefined,
        transform: undefined,
        setnull: undefined
      });

      expect(saveCsv.called).to.be.false;

      expect(createJob.calledOnce).to.be.true;
      expect(createJob.args[0][0]).to.eq('Contact');
      expect(createJob.args[0][1]).to.eql({
        extIdField: 'Id',
        concurrencyMode: 'Parallel',
        assignmentRuleId: undefined
      });

      expect(createAndExecuteBatches.calledOnce).to.be.true;
      expect(createAndExecuteBatches.args[0][1]).to.eq(job);
      expect(createAndExecuteBatches.args[0][2]).to.eql([csvRows]);
      expect(createAndExecuteBatches.args[0][3]).to.eq('Contact');
      expect(createAndExecuteBatches.args[0][4]).to.be.undefined;
    });

  let args = defaultArgs.concat(
    '-i', 'Email',
    '--concurrencymode', 'Serial',
    '--assignmentruleid', 'ruleId',
    '--batchsize', '2',
    '-e', 'cp932',
    '-d', '\t',
    '-m', 'data/mappings.json',
    '-t', 'data/transformer.js',
    '-w', '10',
    '--setnull',
    '--save'
  );
  const mapping = {};
  const transform = () => [];
  testSetup
    .stub(fs, 'readJson', file => {
      expect(file).to.eq('data/mappings.json');
      return Promise.resolve(mapping)
    })
    .stub(Command.prototype, 'loadScript', file => {
      expect(file).to.eq('data/transformer.js');
      return transform;
    })
    .command([commandName].concat(args))
    .it(args.join(' '), ctx => {
      expect(parseCsv.calledOnce).to.be.true;
      expect(parseCsv.args[0][1]).to.eql({
        encoding: 'cp932',
        delimiter: '\t',
        setnull: true,
        mapping,
        transform
      });

      expect(saveCsv.calledOnce).to.be.true;
      expect(saveCsv.args[0][0]).to.eql('data/Contact.transformed.csv');
      expect(saveCsv.args[0][1]).to.eql(csvRows);

      expect(createJob.calledOnce).to.be.true;
      expect(createJob.args[0][0]).to.eq('Contact');
      expect(createJob.args[0][1]).to.eql({
        extIdField: 'Email',
        concurrencyMode: 'Serial',
        assignmentRuleId: 'ruleId'
      });
      expect(createAndExecuteBatches.calledOnce).to.be.true;
      expect(createAndExecuteBatches.args[0][1]).to.eq(job);
      expect(createAndExecuteBatches.args[0][2]).to.eql([[csvRows[0], csvRows[1]], [csvRows[2]]]);
      expect(createAndExecuteBatches.args[0][3]).to.eq('Contact');
      expect(createAndExecuteBatches.args[0][4]).to.eq(10);
    });
});
