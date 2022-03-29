import { test } from '@salesforce/command/lib/test';
import Command from '../../../../../src/commands/kit/data/bulk/delete';

const commandName = 'kit:data:bulk:delete';
describe(commandName, () => {
  const validQuery = 'SELECT Id FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'SELECT Id FROM Unknown';
  const records = [{ Id: 'id1' }];

  const bulkQuery = jest
    .spyOn(Command.prototype, 'bulkQuery' as any)
    .mockImplementation((conn, query) => {
      switch (query) {
        case validQuery:
          return Promise.resolve(records);
        case emptyQuery:
          return Promise.resolve([]);
        default:
          return Promise.reject(new Error('error message'));
      }
    });

  const bulkLoad = jest
    .spyOn(Command.prototype, 'bulkLoad' as any)
    .mockReturnValue(Promise.resolve({}));

  afterEach(() => {
    bulkQuery.mockClear();
    bulkLoad.mockClear();
  });

  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .stderr();

  testSetup
    .command([commandName, '-q', validQuery, '-s', '300'])
    .it('success', (ctx) => {
      expect(bulkQuery.mock.calls[0][1]).toBe(validQuery);
      expect(bulkLoad.mock.calls[0][1]).toBe('Account');
      expect(bulkLoad.mock.calls[0][2]).toBe('delete');
      expect(bulkLoad.mock.calls[0][3]).toBe(records);
      expect(bulkLoad.mock.calls[0][4]).toEqual({
        concurrencyMode: 'Parallel',
        batchSize: 300,
        wait: undefined,
      });
    });

  testSetup.command([commandName, '-q', emptyQuery]).it('empty', (ctx) => {
    expect(bulkQuery.mock.calls[0][1]).toBe(emptyQuery);
    expect(bulkLoad).not.toHaveBeenCalled();
    expect(ctx.stderr).toMatch('no records');
  });

  testSetup.command([commandName, '-q', invalidQuery]).it('error', (ctx) => {
    expect(bulkQuery.mock.calls[0][1]).toBe(invalidQuery);
    expect(ctx.stderr).toMatch('error');
  });
});
