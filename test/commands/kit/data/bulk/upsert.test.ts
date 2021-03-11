import { expect, test } from '@salesforce/command/lib/test';
import * as csv from 'csv';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import Command from '../../../../../src/commands/kit/data/bulk/upsert';

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

  it('with columnMappings', async () => {
    const rows = await subject(csvStream(), 'utf8', {
      Field1__c: 'col1',
      Field2__c: 'col3'
    });
    expect(rows).to.eql([
      { Field1__c: 'col1_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_2', Field2__c: 'col3_2' },
      { Field1__c: 'col1_3', Field2__c: 'col3_3' }
    ]);
  });

  it('with transform', async () => {
    const rows = await subject(csvStream(), 'utf8', null, (row) => {
      if (row.col1 === 'col1_2') return null;

      return {
        Field1__c: `${row.col1} ${row.col2}`,
        Field2__c: row.col3
      };
    });
    expect(rows).to.eql([
      { Field1__c: 'col1_1 col2_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_3 col2_3', Field2__c: 'col3_3' }
    ]);
  });
});

const commandName = 'kit:data:bulk:upsert';
describe(commandName, () => {
  const csvRows = [
    { 'Account.Name': 'account1', Name: 'contact1' },
    { 'Account.Name': 'account2', Name: 'contact2' },
    { 'Account.Name': 'account3', Name: 'contact3' }
  ];

  const job = {};
  const createReadStream = sinon.spy(file => csv.stringify(csvRows));
  const parseCsv = sinon.spy((...args) => Promise.resolve(csvRows));
  const saveCsv = sinon.spy();
  const createJob = sinon.spy((sobject, options) => job);
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
      expect(parseCsv.args[0][1]).to.eq('utf8');
      expect(parseCsv.args[0][2]).to.be.null;
      expect(parseCsv.args[0][3]).to.be.null;

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
    '-i', 'Name',
    '--concurrencymode', 'Serial',
    '--assignmentruleid', 'ruleId',
    '--batchsize', '2',
    '-e', 'cp932',
    '-m', 'data/mappings.json',
    '-t', 'data/transformer.js',
    '-w', '10',
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
      expect(parseCsv.args[0][1]).to.eq('cp932');
      expect(parseCsv.args[0][2]).to.eq(mapping);
      expect(parseCsv.args[0][3]).to.eq(transform);

      expect(saveCsv.calledOnce).to.be.true;
      expect(saveCsv.args[0][0]).to.eql('data/Contact.transformed.csv');
      expect(saveCsv.args[0][1]).to.eql(csvRows);

      expect(createJob.calledOnce).to.be.true;
      expect(createJob.args[0][0]).to.eq('Contact');
      expect(createJob.args[0][1]).to.eql({
        extIdField: 'Name',
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
