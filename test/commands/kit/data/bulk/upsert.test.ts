import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod, spyMethod } from '@salesforce/ts-sinon';
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
    expect(rows).toEqual(csvRows);
  });

  it('with mapping', async () => {
    const rows = await subject(csvStream(), {
      encoding: 'utf8',
      mapping: {
        Field1__c: 'col1',
        Field2__c: 'col3',
      },
    });
    expect(rows).toEqual([
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
    expect(rows).toEqual([
      { Field1__c: 'col1_1 col2_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_3 col2_3', Field2__c: 'col3_3' },
    ]);
  });

  it('with setnull', async () => {
    const rows = await subject(
      Readable.from('empty,reference.key,value\n,,test'),
      { setnull: true }
    );
    expect(rows).toEqual([
      { empty: '#N/A', 'reference.key': '', value: 'test' },
    ]);
  });

  it('with delimiter', async () => {
    const rows = await subject(Readable.from('a:b:c\nv1:v2:v3'), {
      delimiter: ':',
    });
    expect(rows).toEqual([{ a: 'v1', b: 'v2', c: 'v3' }]);
  });

  it('with quote', async () => {
    const rows = await subject(Readable.from(`a,b,c,d\n'1,2',3,"4,5"`), {
      quote: "'",
    });
    expect(rows).toEqual([{ a: '1,2', b: '3', c: '"4', d: '5"' }]);
  });

  it('with skiplines', async () => {
    const rows = await subject(Readable.from(`skip1,skip2\na,b\n1,2`), {
      skiplines: 1,
    });
    expect(rows).toEqual([{ a: '1', b: '2' }]);
  });

  it('with trim', async () => {
    const rows = await subject(Readable.from(`a,b\n 1\t ,   2`), {
      trim: true,
    });
    expect(rows).toEqual([{ a: '1', b: '2' }]);
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

    expect(rows).toEqual([
      { a: '2020/1/1', d: '2020-02-02', t: t1.toISOString() },
      { a: '', d: '2020-02-03', t: t2.toISOString() },
      { a: '', d: '2020-03-01', t: '2020-03-03T16:34:56.000Z' },
    ]);
  });
});

const commandName = 'kit:data:bulk:upsert';
describe(commandName, () => {
  const $$ = testSetup();
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
  beforeEach(async () => {
    await $$.stubAuths(new MockTestOrgData());
    stubMethod($$.SANDBOX, fs, 'createReadStream').returns(csv.write(csvRows));
    stubMethod($$.SANDBOX, Command.prototype, 'bulkLoad').resolves({
      job: {},
      records: [],
    });
    stubMethod($$.SANDBOX, Command.prototype, 'getFieldTypes').returns(
      fieldTypes
    );
    stubMethod($$.SANDBOX, Command.prototype, 'parseCsv').resolves(csvRows);
    stubMethod($$.SANDBOX, Command.prototype, 'saveCsv');
  });

  const defaultArgs = [
    '-u',
    'test@foo.bar',
    '-o',
    'Contact',
    '-f',
    'data/Contact.csv',
  ];
  it(defaultArgs.join(' '), async () => {
    const result = await (Command as any).run(defaultArgs);
    expect(fs.createReadStream.calledWith('data/Contact.csv')).toBe(true);

    expect(Command.prototype.parseCsv.calledOnce).toBe(true);
    expect(Command.prototype.parseCsv.args[0][1]).toMatchObject({
      encoding: 'utf8',
      delimiter: ',',
    });

    expect(Command.prototype.saveCsv.called).toBe(false);

    expect(Command.prototype.bulkLoad.calledOnce).toBe(true);
    expect(Command.prototype.bulkLoad.args[0][1]).toEqual('Contact');
    expect(Command.prototype.bulkLoad.args[0][2]).toEqual('upsert');
    expect(Command.prototype.bulkLoad.args[0][3]).toEqual(csvRows);
    expect(Command.prototype.bulkLoad.args[0][4]).toEqual({
      extIdField: 'Id',
      concurrencyMode: 'Parallel',
      assignmentRuleId: undefined,
      batchSize: 10000,
      wait: undefined,
    });
  });

  let args = defaultArgs.concat(
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

    const result = await (Command as any).run(args);

    expect(fs.readJson.calledWith('data/mappings.json')).toBe(true);
    expect(loadScript.calledWith('data/convert.js')).toBe(true);
    expect(Command.prototype.parseCsv.calledOnce).toBe(true);
    expect(Command.prototype.parseCsv.args[0][1]).toEqual({
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
    expect(Command.prototype.saveCsv.calledOnce).toBe(true);
    expect(Command.prototype.saveCsv.args[0][0]).toBe('path/to/resultfile.csv');

    expect(Command.prototype.bulkLoad.calledOnce).toBe(true);
    expect(Command.prototype.bulkLoad.args[0][1]).toEqual('Contact');
    expect(Command.prototype.bulkLoad.args[0][2]).toEqual('upsert');
    expect(Command.prototype.bulkLoad.args[0][3]).toEqual(csvRows);
    expect(Command.prototype.bulkLoad.args[0][4]).toEqual({
      extIdField: 'Email',
      concurrencyMode: 'Serial',
      assignmentRuleId: 'ruleId',
      batchSize: 2,
      wait: 10,
    });
  });

  it('called converters hooks', async () => {
    const convert = jest.fn();
    const start = jest.fn();
    const finish = jest.fn();
    const loadScript = stubMethod($$.SANDBOX, utils, 'loadScript').returns({
      convert,
      start,
      finish,
    });
    await (Command as any).run(defaultArgs.concat('-c', 'data/converter.js'));

    expect(start).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
  });
});
