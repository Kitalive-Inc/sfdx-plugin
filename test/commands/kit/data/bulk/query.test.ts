import { test } from '@salesforce/command/lib/test';
import Command from '../../../../../src/commands/kit/data/bulk/query';

const commandName = 'kit:data:bulk:query';
describe(commandName, () => {
  const validQuery = 'SELECT Id FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'invalid';

  const bulkQuery = jest
    .spyOn(Command.prototype, 'bulkQuery' as any)
    .mockImplementation((...args) => {
      switch (args[1]) {
        case validQuery:
          return Promise.resolve([{ Id: 'id1' }]);
        case emptyQuery:
          return Promise.resolve([]);
        default:
          return Promise.reject(new Error('error message'));
      }
    });

  afterEach(() => {
    bulkQuery.mockClear();
  });

  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .stderr();

  testSetup.command([commandName, '-q', validQuery]).it('success', (ctx) => {
    expect(bulkQuery.mock.calls[0][1]).toBe(validQuery);
  });

  testSetup.command([commandName, '-q', emptyQuery]).it('empty', (ctx) => {
    expect(bulkQuery.mock.calls[0][1]).toBe(emptyQuery);
    expect(ctx.stderr).toMatch('no records');
  });

  testSetup.command([commandName, '-q', invalidQuery]).it('error', (ctx) => {
    expect(bulkQuery.mock.calls[0][1]).toBe(invalidQuery);
    expect(ctx.stderr).toMatch('error');
  });
});
