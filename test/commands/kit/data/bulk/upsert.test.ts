import { expect, test } from '@salesforce/command/lib/test';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import Command from '../../../../../src/commands/kit/data/bulk/upsert';

const { Readable } = require('stream');

describe('.parseCsv', () => {
  const subject = Command.prototype.parseCsv;

  const csvRows = [
    { col1: 'col1_1', col2: 'col2_1', col3: 'col3_1' },
    { col1: 'col1_2', col2: 'col2_2', col3: 'col3_2' },
    { col1: 'col1_3', col2: 'col2_3', col3: 'col3_3' }
  ];

  const csvStream = () => csv.write(csvRows, { headers: true });

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

  it('with convert', async () => {
    const rows = await subject(csvStream(), {
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

  it('with quote', async () => {
    const rows = await subject(
      Readable.from(`a,b,c,d\n'1,2',3,"4,5"`),
      { quote: "'" }
    );
    expect(rows).to.eql([
      { a: '1,2', b: '3', c: '"4', d: '5"' }
    ]);
  });

  it('with skiplines', async () => {
    const rows = await subject(
      Readable.from(`skip1,skip2\na,b\n1,2`),
      { skiplines: 1 }
    );
    expect(rows).to.eql([
      { a: '1', b: '2' }
    ]);
  });

  it('with trim', async () => {
    const rows = await subject(
      Readable.from(`a,b\n 1\t ,   2`),
      { trim: true }
    );
    expect(rows).to.eql([
      { a: '1', b: '2' }
    ]);
  });

  it('with fieldTypes', async () => {
    const rows = await subject(
      Readable.from([
        'a,d,t',
        '2020/1/1,2020/2/2,2020/3/3 4:55',
        ',202002031200,2020-03-03T12:34:56',
        ',2020/3,2020-03-03T12:34:56-04:00',
      ].join('\n')), {
        fieldTypes: {
          d: 'date',
          t: 'datetime'
        }
      }
    );

    const t1 = new Date('2020/3/3 4:55');
    const t2 = new Date('2020-03-03T12:34:56');

    expect(rows).to.eql([
      { a: '2020/1/1', d: '2020-02-02', t: t1.toISOString() },
      { a: '', d: '2020-02-03', t: t2.toISOString() },
      { a: '', d: '2020-03-01', t: '2020-03-03T16:34:56.000Z' },
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
  const createReadStream = sinon.spy(file => csv.write(csvRows)) as any;
  const parseCsv = sinon.spy((...args) => Promise.resolve(csvRows));
  const saveCsv = sinon.spy();
  const createJob = sinon.spy((sobject, options) => Promise.resolve(job)) as any;
  const executeBatches = sinon.spy((...args) => Promise.resolve());

  afterEach(() => {
    createReadStream.resetHistory();
    parseCsv.resetHistory();
    saveCsv.resetHistory();
    createJob.resetHistory();
    executeBatches.resetHistory();
  });

  const fieldTypes = {};
  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stub(fs, 'createReadStream', createReadStream)
    .stub(Command.prototype, 'getFieldTypes', () => fieldTypes)
    .stub(Command.prototype, 'parseCsv', parseCsv)
    .stub(Command.prototype, 'saveCsv', saveCsv)
    .stub(Command.prototype, 'createJob', createJob)
    .stub(Command.prototype, 'executeBatches', executeBatches)
    .stdout();

  const defaultArgs = ['-o', 'Contact', '-f', 'data/Contact.csv'];
  testSetup
    .command([commandName].concat(defaultArgs))
    .it(defaultArgs.join(' '), ctx => {
      expect(createReadStream.calledWith('data/Contact.csv')).to.be.true;

      expect(parseCsv.calledOnce).to.be.true;
      expect(parseCsv.args[0][1]).to.include({
        encoding: 'utf8',
        delimiter: ','
      });

      expect(saveCsv.called).to.be.false;

      expect(createJob.calledOnce).to.be.true;
      expect(createJob.args[0][0]).to.eq('Contact');
      expect(createJob.args[0][1]).to.eql({
        extIdField: 'Id',
        concurrencyMode: 'Parallel',
        assignmentRuleId: undefined
      });

      expect(executeBatches.calledOnce).to.be.true;
      expect(executeBatches.args[0][0]).to.eq(job);
      expect(executeBatches.args[0][1]).to.eql([csvRows]);
      expect(executeBatches.args[0][2]).to.eq('Contact');
      expect(executeBatches.args[0][3]).to.be.undefined;
    });

  let args = defaultArgs.concat(
    '-i', 'Email',
    '--concurrencymode', 'Serial',
    '--assignmentruleid', 'ruleId',
    '--batchsize', '2',
    '-e', 'cp932',
    '-d', ':',
    '-m', 'data/mappings.json',
    '-c', 'data/convert.js',
    '-w', '10',
    '--setnull',
    '--save'
  );
  const mapping = {};
  const convert = () => [];
  testSetup
    .stub(fs, 'readJson', (file => {
      expect(file).to.eq('data/mappings.json');
      return Promise.resolve(mapping)
    }) as any)
    .stub(Command.prototype, 'loadScript', (file => {
      expect(file).to.eq('data/convert.js');
      return { convert };
    }) as any)
    .command([commandName].concat(args))
    .it(args.join(' '), ctx => {
      expect(parseCsv.calledOnce).to.be.true;
      expect(parseCsv.args[0][1]).to.eql({
        encoding: 'cp932',
        delimiter: ':',
        quote: '"',
        skiplines: 0,
        trim: false,
        setnull: true,
        mapping,
        convert,
        fieldTypes
      });

      expect(saveCsv.calledOnce).to.be.true;
      expect(saveCsv.args[0][0]).to.eql('data/Contact.converted.csv');
      expect(saveCsv.args[0][1]).to.eql(csvRows);

      expect(createJob.calledOnce).to.be.true;
      expect(createJob.args[0][0]).to.eq('Contact');
      expect(createJob.args[0][1]).to.eql({
        extIdField: 'Email',
        concurrencyMode: 'Serial',
        assignmentRuleId: 'ruleId'
      });
      expect(executeBatches.calledOnce).to.be.true;
      expect(executeBatches.args[0][0]).to.eq(job);
      expect(executeBatches.args[0][1]).to.eql([[csvRows[0], csvRows[1]], [csvRows[2]]]);
      expect(executeBatches.args[0][2]).to.eq('Contact');
      expect(executeBatches.args[0][3]).to.eq(10);
    });

  const start = sinon.spy();
  const finish = sinon.spy();
  testSetup
    .stub(Command.prototype, 'loadScript', (file => {
      return { convert, start, finish };
    }) as any)
    .command([commandName].concat(defaultArgs, '-c', 'data/converter.js'))
    .it('called converters hooks', ctx => {
      expect(start.called).to.be.true;
      expect(finish.called).to.be.true;
    });
});
