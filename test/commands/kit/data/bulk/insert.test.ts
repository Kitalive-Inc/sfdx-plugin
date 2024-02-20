import { expect } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import { stubMethod } from '@salesforce/ts-sinon';
import * as csv from 'fast-csv';
import fs from 'fs-extra';
import Command from '../../../../../src/commands/kit/data/bulk/insert';

describe('kit data bulk insert', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  const csvRows = [
    { LastName: 'contact1', Email: 'contact1@example.com' },
    { LastName: 'contact2', Email: 'contact2@example.com' },
    { LastName: 'contact3', Email: 'contact3@example.com' },
  ];

  let bulkLoad: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    stubMethod($$.SANDBOX, fs, 'createReadStream').returns(csv.write(csvRows));
    bulkLoad = stubMethod($$.SANDBOX, Command.prototype, 'bulkLoad').resolves({
      job: {},
      records: [],
    });
    stubMethod($$.SANDBOX, Command.prototype, 'getFieldTypes').returns({});
    stubMethod($$.SANDBOX, Command.prototype, 'parseCsv').resolves(csvRows);
    stubMethod($$.SANDBOX, Command.prototype, 'saveCsv');
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

    expect(bulkLoad.calledOnce).to.be.true;
    expect(bulkLoad.args[0][1]).to.eq('Contact');
    expect(bulkLoad.args[0][2]).to.eq('insert');
    expect(bulkLoad.args[0][3]).to.eql(csvRows);
    expect(bulkLoad.args[0][4]).to.eql({
      extIdField: undefined,
      concurrencyMode: 'Parallel',
      assignmentRuleId: undefined,
      batchSize: 10000,
      wait: undefined,
    });
  });
});
