import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod, spyMethod } from '@salesforce/ts-sinon';
import Command from '../../../../../src/commands/kit/data/bulk/query';

const commandName = 'kit:data:bulk:query';
describe(commandName, () => {
  const $$ = testSetup();
  const validQuery = 'SELECT Id FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'invalid';

  let bulkQuery: any;
  beforeEach(async () => {
    await $$.stubAuths(new MockTestOrgData());
    bulkQuery = stubMethod(
      $$.SANDBOX,
      Command.prototype,
      'bulkQuery'
    ).callsFake((conn, query) => {
      switch (query) {
        case validQuery:
          return Promise.resolve([{ Id: 'id1' }]);
        case emptyQuery:
          return Promise.resolve([]);
        default:
          return Promise.reject(new Error('error message'));
      }
    });
  });

  it('success', async () => {
    await Command.run(['-u', 'test@foo.bar', '-q', validQuery]);
    expect(bulkQuery.args[0][1]).toBe(validQuery);
  });

  it('empty', async () => {
    await Command.run(['-u', 'test@foo.bar', '-q', emptyQuery]);
    expect(bulkQuery.args[0][1]).toBe(emptyQuery);
    //expect(ctx.stderr).toMatch('no records');
  });

  it('error', async () => {
    await Command.run(['-u', 'test@foo.bar', '-q', invalidQuery]);
    expect(bulkQuery.args[0][1]).toBe(invalidQuery);
    //expect(ctx.stderr).toMatch('error');
  });
});
