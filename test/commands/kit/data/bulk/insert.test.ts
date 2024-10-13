import { expect } from 'chai';
import esmock from 'esmock';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import * as csv from 'fast-csv';

describe('kit data bulk insert', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  const csvRows = [
    { LastName: 'contact1', Email: 'contact1@example.com' },
    { LastName: 'contact2', Email: 'contact2@example.com' },
    { LastName: 'contact3', Email: 'contact3@example.com' },
  ];

  let Command: any;
  let bulkLoad: any;
  let createReadStream: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);

    createReadStream = $$.SANDBOX.fake.returns(csv.write(csvRows));
    Command = await esmock(
      '../../../../../src/commands/kit/data/bulk/insert.js',
      {
        '../../../../../src/bulk.js': await esmock(
          '../../../../../src/bulk.js',
          {
            'fs-extra': { createReadStream },
          }
        ),
      }
    );
    bulkLoad = $$.SANDBOX.stub(Command.prototype, 'bulkLoad').resolves({
      job: {} as any,
      records: [],
    });
    $$.SANDBOX.stub(Command.prototype, 'getFieldTypes').resolves({});
    $$.SANDBOX.stub(Command.prototype, 'parseCsv').resolves(csvRows);
    $$.SANDBOX.stub(Command.prototype, 'saveCsv');
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
    expect(createReadStream.calledWith('data/Contact.csv')).to.be.true;

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
