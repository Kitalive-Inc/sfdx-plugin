import { expect, test } from '@salesforce/command/lib/test';
import * as sinon from 'sinon';
import Command from '../../../../../src/commands/kit/data/bulk/query';

const commandName = 'kit:data:bulk:query';
describe(commandName, () => {
  const validQuery = 'SELECT Id FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'invalid';

  const bulkQuery = sinon.spy((...args) => {
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
    bulkQuery.resetHistory();
  });

  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stub(Command.prototype, 'bulkQuery', bulkQuery)
    .stdout().stderr();

  testSetup
    .command([commandName, '-q', validQuery])
    .it('success', ctx => {
      expect(bulkQuery.args[0][1]).to.eq(validQuery);
    });

  testSetup
    .command([commandName, '-q', emptyQuery])
    .it('empty', ctx => {
      expect(bulkQuery.args[0][1]).to.eq(emptyQuery);
      expect(ctx.stderr).to.contain('no records');
    });

  testSetup
    .command([commandName, '-q', invalidQuery])
    .it('error', ctx => {
      expect(bulkQuery.args[0][1]).to.eq(invalidQuery);
      expect(ctx.stderr).to.contain('error message');
    });
});
