import { expect, test } from '@salesforce/command/lib/test';
import * as sinon from 'sinon';
import Command from '../../../../../src/commands/kit/data/bulk/delete';

const commandName = 'kit:data:bulk:delete';
describe(commandName, () => {
  const validQuery = 'SELECT Id FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'SELECT Id FROM Unknown';
  const records = [
    { Id: 'id1' }
  ];

  const bulkQuery = sinon.spy((conn, query) => {
    switch (query) {
      case validQuery:
        return Promise.resolve(records);
      case emptyQuery:
        return Promise.resolve([]);
      default:
        return Promise.reject(new Error('error message'));
    }
  }) as any;

  const bulkLoad = sinon.spy((...args) => Promise.resolve({}));

  afterEach(() => {
    bulkQuery.resetHistory();
    bulkLoad.resetHistory();
  });

  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stub(Command.prototype, 'bulkQuery', bulkQuery)
    .stub(Command.prototype, 'bulkLoad', bulkLoad)
    .stdout().stderr();

  testSetup
    .command([commandName, '-q', validQuery, '-s', '300'])
    .it('success', ctx => {
      expect(bulkQuery.args[0][1]).to.eq(validQuery);
      expect(bulkLoad.args[0][1]).to.eq('Account');
      expect(bulkLoad.args[0][2]).to.eq('delete');
      expect(bulkLoad.args[0][3]).to.eq(records);
      expect(bulkLoad.args[0][4]).to.eql({ concurrencyMode: 'Parallel', batchSize: 300, wait: undefined });
    });

  testSetup
    .command([commandName, '-q', emptyQuery])
    .it('empty', ctx => {
      expect(bulkQuery.args[0][1]).to.eq(emptyQuery);
      expect(bulkLoad.called).to.eq(false);
      expect(ctx.stderr).to.contain('no records');
    });

  testSetup
    .command([commandName, '-q', invalidQuery])
    .it('error', ctx => {
      expect(bulkQuery.args[0][1]).to.eq(invalidQuery);
      expect(ctx.stderr).to.contain('error message');
    });
});
