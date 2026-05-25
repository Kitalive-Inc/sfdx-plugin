import { expect } from 'chai';
import { Record } from '@jsforce/jsforce-node';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import { BulkResult } from '../../../../../src/bulk.js';
import Command from '../../../../../src/commands/kit/data/bulk/delete.js';

describe('kit data bulk delete', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const validQuery = 'SELECT Id FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'SELECT Id FROM Unknown';
  const records: Record[] = [{ Id: 'id1' }];

  let bulkQuery: any;
  let bulkLoad: any;
  let spinner: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    spinner = stubSpinner($$.SANDBOX);
    stubSfCommandUx($$.SANDBOX);
    bulkQuery = $$.SANDBOX.stub(Command.prototype, 'bulkQuery').callsFake(
      (conn, query) => {
        switch (query) {
          case validQuery:
            return Promise.resolve(records);
          case emptyQuery:
            return Promise.resolve([]);
          default:
            return Promise.reject(new Error('error message'));
        }
      }
    );
    bulkLoad = $$.SANDBOX.stub(Command.prototype, 'bulkLoad').resolves(
      {} as BulkResult
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
      wait: 0,
    });
  });

  it('query file', async () => {
    const getQuery = $$.SANDBOX.stub(Command.prototype, 'getQuery').returns(
      validQuery
    );

    await Command.run([
      '-o',
      'test@foo.bar',
      '--query-file',
      'path/to/query.soql',
    ]);
    expect(getQuery.args[0]).to.eql([undefined, 'path/to/query.soql']);
    expect(bulkQuery.args[0][1]).to.eq(validQuery);
    expect(bulkLoad.args[0][1]).to.eq('Account');
    expect(bulkLoad.args[0][2]).to.eq('delete');
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

  it('requires either query or query-file', async () => {
    try {
      await Command.run(['-o', 'test@foo.bar']);
      expect.fail('No error occurred');
    } catch (e) {
      expect((e as Error).message).to.contain(
        'Exactly one of the following must be provided: --query, --query-file'
      );
    }
  });

  it('rejects query and query-file together', async () => {
    try {
      await Command.run([
        '-o',
        'test@foo.bar',
        '-q',
        validQuery,
        '--query-file',
        'path/to/query.soql',
      ]);
      expect.fail('No error occurred');
    } catch (e) {
      expect((e as Error).message).to.contain(
        '--query cannot also be provided when using --query-file'
      );
      expect((e as Error).message).to.contain(
        '--query-file cannot also be provided when using --query'
      );
    }
  });
});
