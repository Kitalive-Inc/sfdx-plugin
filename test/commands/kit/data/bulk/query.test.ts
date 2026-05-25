import { expect } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSpinner } from '@salesforce/sf-plugins-core';
import Command from '../../../../../src/commands/kit/data/bulk/query.js';

describe('kit data bulk query', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const validQuery = 'SELECT Id FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'invalid';

  let bulkQuery: any;
  let spinner: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    spinner = stubSpinner($$.SANDBOX);
    bulkQuery = $$.SANDBOX.stub(Command.prototype, 'bulkQuery').callsFake(
      (conn, query) => {
        switch (query) {
          case validQuery:
            return Promise.resolve([{ Id: 'id1' }]);
          case emptyQuery:
            return Promise.resolve([]);
          default:
            return Promise.reject(new Error('error message'));
        }
      }
    );
  });

  it('success', async () => {
    await Command.run(['-o', 'test@foo.bar', '-q', validQuery]);
    expect(bulkQuery.args[0][1]).to.eq(validQuery);
    expect(spinner.stop.args[0][0]).to.eq('1 records');
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
    expect(spinner.stop.args[0][0]).to.eq('1 records');
  });

  it('empty', async () => {
    await Command.run(['-o', 'test@foo.bar', '-q', emptyQuery]);
    expect(bulkQuery.args[0][1]).to.eq(emptyQuery);
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

  it('options', async () => {
    await Command.run([
      '-o',
      'test@foo.bar',
      '-q',
      validQuery,
      '-w',
      '10',
      '--all',
    ]);
    expect(bulkQuery.args[0][2]).to.eql({ all: true, wait: 10 });
    expect(spinner.stop.args[0][0]).to.eq('1 records');
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
