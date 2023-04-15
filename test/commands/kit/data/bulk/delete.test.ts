import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod, spyMethod } from '@salesforce/ts-sinon';
import Command from '../../../../../src/commands/kit/data/bulk/delete';

const commandName = 'kit:data:bulk:delete';
describe(commandName, () => {
  const $$ = testSetup();
  const validQuery = 'SELECT Id FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'SELECT Id FROM Unknown';
  const records = [{ Id: 'id1' }];

  let bulkQuery: any;
  let bulkLoad: any;
  beforeEach(async () => {
    await $$.stubAuths(new MockTestOrgData());
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
    await Command.run(['-u', 'test@foo.bar', '-q', validQuery, '-s', '300']);
    expect(bulkQuery.args[0][1]).toBe(validQuery);
    expect(bulkLoad.args[0][1]).toBe('Account');
    expect(bulkLoad.args[0][2]).toBe('delete');
    expect(bulkLoad.args[0][3]).toBe(records);
    expect(bulkLoad.args[0][4]).toEqual({
      concurrencyMode: 'Parallel',
      batchSize: 300,
      wait: undefined,
    });
  });

  it('empty', async () => {
    await Command.run(['-u', 'test@foo.bar', '-q', emptyQuery]);
    expect(bulkQuery.args[0][1]).toBe(emptyQuery);
    expect(bulkLoad.called).toBe(false);
    //expect(ctx.stderr).toMatch('no records');
  });

  it('error', async () => {
    await Command.run(['-u', 'test@foo.bar', '-q', invalidQuery]);
    expect(bulkQuery.args[0][1]).toBe(invalidQuery);
    //expect(ctx.stderr).toMatch('error');
  });
});
