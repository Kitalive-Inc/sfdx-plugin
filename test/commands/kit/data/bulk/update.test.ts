import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod, spyMethod } from '@salesforce/ts-sinon';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import Command from '../../../../../src/commands/kit/data/bulk/update';

const commandName = 'kit:data:bulk:update';
describe(commandName, () => {
  const $$ = testSetup();
  const csvRows = [
    { LastName: 'contact1', Email: 'contact1@example.com' },
    { LastName: 'contact2', Email: 'contact2@example.com' },
    { LastName: 'contact3', Email: 'contact3@example.com' },
  ];

  beforeEach(async () => {
    await $$.stubAuths(new MockTestOrgData());
    stubMethod($$.SANDBOX, fs, 'createReadStream').returns(csv.write(csvRows));
    stubMethod($$.SANDBOX, Command.prototype, 'bulkLoad').resolves({
      job: {},
      records: [],
    });
    stubMethod($$.SANDBOX, Command.prototype, 'getFieldTypes').returns({});
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

    expect(Command.prototype.bulkLoad.calledOnce).toBe(true);
    expect(Command.prototype.bulkLoad.args[0][1]).toEqual('Contact');
    expect(Command.prototype.bulkLoad.args[0][2]).toEqual('update');
    expect(Command.prototype.bulkLoad.args[0][3]).toEqual(csvRows);
    expect(Command.prototype.bulkLoad.args[0][4]).toEqual({
      extIdField: undefined,
      concurrencyMode: 'Parallel',
      assignmentRuleId: undefined,
      batchSize: 10000,
      wait: undefined,
    });
  });
});
