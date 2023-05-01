import { expect } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import { stubMethod } from '@salesforce/ts-sinon';
import Command from '../../../../../src/commands/kit/data/bulk/delete';

describe('kit data bulk delete', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const validQuery = 'SELECT Id FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'SELECT Id FROM Unknown';
  const records = [{ Id: 'id1' }];

  let bulkQuery: any;
  let bulkLoad: any;
  let spinner: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    spinner = stubSpinner($$.SANDBOX);
    stubSfCommandUx($$.SANDBOX);
    bulkQuery = stubMethod(
      $$.SANDBOX,
      Command.prototype,
      'bulkQuery'
    ).callsFake((conn, query) => {
      switch (query) {
        case validQuery:
          return Promise.resolve(records);
        case emptyQuery:
          return Promise.resolve([]);
        default:
          return Promise.reject(new Error('error message'));
      }
    });
    bulkLoad = stubMethod($$.SANDBOX, Command.prototype, 'bulkLoad').resolves(
      {}
    );
  });

  it('success', async () => {
    await Command.run(['-o', 'test@foo.bar', '-q', validQuery, '-s', '300']);
    expect(bulkQuery.args[0][1]).to.eq(validQuery);
    expect(bulkLoad.args[0][1]).to.eq('Account');
    expect(bulkLoad.args[0][2]).to.eq('delete');
    expect(bulkLoad.args[0][3]).to.eql(records);
    expect(bulkLoad.args[0][4]).to.eql({
      concurrencyMode: 'Parallel',
      batchSize: 300,
      wait: undefined,
    });
  });

  it('empty', async () => {
    await Command.run(['-o', 'test@foo.bar', '-q', emptyQuery]);
    expect(bulkQuery.args[0][1]).to.eq(emptyQuery);
    expect(bulkLoad.called).to.be.false;
    expect(spinner.stop.args[0][0]).to.eq('no records');
  });

  it('error', async () => {
    try {
      await Command.run(['-o', 'test@foo.bar', '-q', invalidQuery]);
      expect.fail('No error occurred');
    } catch (e) {
      expect(bulkQuery.args[0][1]).to.eq(invalidQuery);
      expect(spinner.stop.args[0][0]).to.eq('error');
    }
  });
});
