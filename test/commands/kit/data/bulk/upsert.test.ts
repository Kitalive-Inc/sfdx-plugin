import { test } from '@salesforce/command/lib/test';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import Command from '../../../../../src/commands/kit/data/bulk/upsert';

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
  jest.spyOn(Command.prototype, 'getFieldTypes').mockReturnValue(fieldTypes);
  const createReadStream = jest
    .spyOn(fs, 'createReadStream')
    .mockReturnValue(csv.write(csvRows));
  const parseCsv = jest
    .spyOn(Command.prototype, 'parseCsv')
    .mockReturnValue(Promise.resolve(csvRows));
  const saveCsv = jest.spyOn(Command.prototype, 'saveCsv').mockImplementation();
  const bulkLoad = jest
    .spyOn(Command.prototype, 'bulkLoad')
    .mockReturnValue(Promise.resolve({ job: {}, records: [] }));

  afterEach(() => {
    createReadStream.mockClear();
    parseCsv.mockClear();
    saveCsv.mockClear();
    bulkLoad.mockClear();
  });

  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .stderr();

  const defaultArgs = ['-o', 'Contact', '-f', 'data/Contact.csv'];
  testSetup
    .command([commandName].concat(defaultArgs))
    .it(defaultArgs.join(' '), (ctx) => {
      expect(createReadStream).toHaveBeenCalledWith('data/Contact.csv');

      expect(parseCsv).toHaveBeenCalledTimes(1);
      expect(parseCsv.mock.calls[0][1]).toMatchObject({
        encoding: 'utf8',
        delimiter: ',',
      });

      expect(saveCsv).not.toHaveBeenCalled();

      expect(bulkLoad).toHaveBeenCalledTimes(1);
      expect(bulkLoad.mock.calls[0][1]).toBe('Contact');
      expect(bulkLoad.mock.calls[0][2]).toBe('upsert');
      expect(bulkLoad.mock.calls[0][3]).toEqual(csvRows);
      expect(bulkLoad.mock.calls[0][4]).toEqual({
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
  const mapping = {};
  const convert = () => [];
  testSetup
    .stub(fs, 'readJson', ((file) => {
      expect(file).toBe('data/mappings.json');
      return Promise.resolve(mapping);
    }) as any)
    .stub(Command.prototype, 'loadScript', ((file) => {
      expect(file).toBe('data/convert.js');
      return { convert };
    }) as any)
    .command([commandName].concat(args))
    .it(args.join(' '), (ctx) => {
      expect(parseCsv).toHaveBeenCalledTimes(1);
      expect(parseCsv.mock.calls[0][1]).toEqual({
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

      expect(saveCsv).toHaveBeenCalledTimes(1);
      expect(saveCsv.mock.calls[0][0]).toBe('path/to/resultfile.csv');

      expect(bulkLoad).toHaveBeenCalledTimes(1);
      expect(bulkLoad.mock.calls[0][1]).toBe('Contact');
      expect(bulkLoad.mock.calls[0][2]).toBe('upsert');
      expect(bulkLoad.mock.calls[0][3]).toEqual(csvRows);
      expect(bulkLoad.mock.calls[0][4]).toEqual({
        extIdField: 'Email',
        concurrencyMode: 'Serial',
        assignmentRuleId: 'ruleId',
        batchSize: 2,
        wait: 10,
      });
    });

  const start = jest.fn();
  const finish = jest.fn();
  jest
    .spyOn(Command.prototype, 'loadScript')
    .mockReturnValue({ convert, start, finish });
  testSetup
    .command([commandName].concat(defaultArgs, '-c', 'data/converter.js'))
    .it('called converters hooks', (ctx) => {
      expect(start).toHaveBeenCalled();
      expect(finish).toHaveBeenCalled();
    });
});
