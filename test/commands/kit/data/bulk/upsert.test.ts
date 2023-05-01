import { expect } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import { stubMethod } from '@salesforce/ts-sinon';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import Command from '../../../../../src/commands/kit/data/bulk/upsert';
import * as utils from '../../../../../src/utils';

const { Readable } = require('stream');

describe('.parseCsv', () => {
  const subject = Command.prototype.parseCsv;

  const csvRows = [
    { col1: 'col1_1', col2: 'col2_1', col3: 'col3_1' },
    { col1: 'col1_2', col2: 'col2_2', col3: 'col3_2' },
    { col1: 'col1_3', col2: 'col2_3', col3: 'col3_3' },
  ];

  const csvStream = () => csv.write(csvRows, { headers: true });

  it('with no options', async () => {
    const rows = await subject(csvStream());
    expect(rows).to.eql(csvRows);
  });

  it('with mapping', async () => {
    const rows = await subject(csvStream(), {
      encoding: 'utf8',
      mapping: {
        Field1__c: 'col1',
        Field2__c: 'col3',
      },
    });
    expect(rows).to.eql([
      { Field1__c: 'col1_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_2', Field2__c: 'col3_2' },
      { Field1__c: 'col1_3', Field2__c: 'col3_3' },
    ]);
  });

  it('with convert', async () => {
    const rows = await subject(csvStream(), {
      convert: (row) => {
        if (row.col1 === 'col1_2') return null;

        return {
          Field1__c: `${row.col1} ${row.col2}`,
          Field2__c: row.col3,
        };
      },
    });
    expect(rows).to.eql([
      { Field1__c: 'col1_1 col2_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_3 col2_3', Field2__c: 'col3_3' },
    ]);
  });

  it('with setnull', async () => {
    const rows = await subject(
      Readable.from('empty,reference.key,value\n,,test'),
      { setnull: true }
    );
    expect(rows).to.eql([
      { empty: '#N/A', 'reference.key': '', value: 'test' },
    ]);
  });

  it('with delimiter', async () => {
    const rows = await subject(Readable.from('a:b:c\nv1:v2:v3'), {
      delimiter: ':',
    });
    expect(rows).to.eql([{ a: 'v1', b: 'v2', c: 'v3' }]);
  });

  it('with quote', async () => {
    const rows = await subject(Readable.from('a,b,c,d\n\'1,2\',3,"4,5"'), {
      quote: "'",
    });
    expect(rows).to.eql([{ a: '1,2', b: '3', c: '"4', d: '5"' }]);
  });

  it('with skiplines', async () => {
    const rows = await subject(Readable.from('skip1,skip2\na,b\n1,2'), {
      skiplines: 1,
    });
    expect(rows).to.eql([{ a: '1', b: '2' }]);
  });

  it('with trim', async () => {
    const rows = await subject(Readable.from('a,b\n 1\t ,   2'), {
      trim: true,
    });
    expect(rows).to.eql([{ a: '1', b: '2' }]);
  });

  it('with fieldTypes', async () => {
    const rows = await subject(
      Readable.from(
        [
          'a,d,t',
          '2020/1/1,2020/2/2,2020/3/3 4:55',
          ',202002031200,2020-03-03T12:34:56',
          ',2020/3,2020-03-03T12:34:56-04:00',
        ].join('\n')
      ),
      {
        fieldTypes: {
          d: 'date',
          t: 'datetime',
        },
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

describe('kit data bulk upsert', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const csvRows = [
    {
      'Account.ExternalId__c': 'code1',
      LastName: 'contact1',
      Email: 'contact1@example.com',
    },
    {
      'Account.ExternalId__c': 'code1',
      LastName: 'contact2',
      Email: 'contact2@example.com',
    },
    {
      'Account.ExternalId__c': 'code2',
      LastName: 'contact3',
      Email: 'contact3@example.com',
    },
  ];

  const fieldTypes = {};
  let bulkLoad: any;
  let parseCsv: any;
  let saveCsv: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    stubMethod($$.SANDBOX, fs, 'createReadStream').returns(csv.write(csvRows));
    bulkLoad = stubMethod($$.SANDBOX, Command.prototype, 'bulkLoad').resolves({
      job: {},
      records: [],
    });
    stubMethod($$.SANDBOX, Command.prototype, 'getFieldTypes').returns(
      fieldTypes
    );
    parseCsv = stubMethod($$.SANDBOX, Command.prototype, 'parseCsv').resolves(
      csvRows
    );
    saveCsv = stubMethod($$.SANDBOX, Command.prototype, 'saveCsv');
  });

  const defaultArgs = [
    '-o',
    'test@foo.bar',
    '-s',
    'Contact',
    '-f',
    'data/Contact.csv',
  ];
  it(defaultArgs.join(' '), async () => {
    await Command.run(defaultArgs);
    expect(fs.createReadStream.calledWith('data/Contact.csv')).to.be.true;

    expect(parseCsv.calledOnce).to.be.true;
    expect(parseCsv.args[0][1]).to.contain({
      encoding: 'utf8',
      delimiter: ',',
    });

    expect(saveCsv.called).to.be.false;

    expect(bulkLoad.calledOnce).to.be.true;
    expect(bulkLoad.args[0][1]).to.eq('Contact');
    expect(bulkLoad.args[0][2]).to.eq('upsert');
    expect(bulkLoad.args[0][3]).to.eql(csvRows);
    expect(bulkLoad.args[0][4]).to.eql({
      extIdField: 'Id',
      concurrencyMode: 'Parallel',
      assignmentRuleId: undefined,
      batchSize: 10000,
      wait: undefined,
    });
  });

  const args = defaultArgs.concat(
    '-i',
    'Email',
    '--concurrencymode',
    'Serial',
    '--assignmentruleid',
    'ruleId',
    '--batchsize',
    '2',
    '-e',
    'cp932',
    '-d',
    ':',
    '-m',
    'data/mappings.json',
    '-c',
    'data/convert.js',
    '-w',
    '10',
    '--setnull',
    '-r',
    'path/to/resultfile.csv'
  );
  it(args.join(' '), async () => {
    const mapping = {};
    const convert = () => [];
    stubMethod($$.SANDBOX, fs, 'readJson').resolves(mapping);
    const loadScript = stubMethod($$.SANDBOX, utils, 'loadScript').returns({
      convert,
    });

    await Command.run(args);

    expect(fs.readJson.calledWith('data/mappings.json')).to.be.true;
    expect(loadScript.calledWith('data/convert.js')).to.be.true;
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
      fieldTypes,
    });
    expect(saveCsv.calledOnce).to.be.true;
    expect(saveCsv.args[0][0]).to.eq('path/to/resultfile.csv');

    expect(bulkLoad.calledOnce).to.be.true;
    expect(bulkLoad.args[0][1]).to.eq('Contact');
    expect(bulkLoad.args[0][2]).to.eq('upsert');
    expect(bulkLoad.args[0][3]).to.eql(csvRows);
    expect(bulkLoad.args[0][4]).to.eql({
      extIdField: 'Email',
      concurrencyMode: 'Serial',
      assignmentRuleId: 'ruleId',
      batchSize: 2,
      wait: 10,
    });
  });

  it('called converters hooks', async () => {
    const convert = $$.SANDBOX.stub();
    const start = $$.SANDBOX.stub();
    const finish = $$.SANDBOX.stub();
    stubMethod($$.SANDBOX, utils, 'loadScript').returns({
      convert,
      start,
      finish,
    });
    await Command.run(defaultArgs.concat('-c', 'data/converter.js'));

    expect(start.calledOnce).to.be.true;
    expect(finish.calledOnce).to.be.true;
  });
});
