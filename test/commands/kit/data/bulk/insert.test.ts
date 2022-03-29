import { expect, test } from '@salesforce/command/lib/test';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import Command from '../../../../../src/commands/kit/data/bulk/insert';

const commandName = 'kit:data:bulk:insert';
describe(commandName, () => {
  const csvRows = [
    { LastName: 'contact1', Email: 'contact1@example.com' },
    { LastName: 'contact2', Email: 'contact2@example.com' },
    { LastName: 'contact3', Email: 'contact3@example.com' },
  ];

  const createReadStream = sinon.spy((file) => csv.write(csvRows)) as any;
  const parseCsv = sinon.spy((...args) => Promise.resolve(csvRows));
  const saveCsv = sinon.spy();
  const bulkLoad = sinon.spy((...args) =>
    Promise.resolve({ job: {}, records: [] })
  );

  const fieldTypes = {};
  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stub(fs, 'createReadStream', createReadStream)
    .stub(Command.prototype, 'bulkLoad', bulkLoad)
    .stub(Command.prototype, 'getFieldTypes', () => fieldTypes)
    .stub(Command.prototype, 'parseCsv', parseCsv)
    .stub(Command.prototype, 'saveCsv', saveCsv)
    .stdout();

  const defaultArgs = ['-o', 'Contact', '-f', 'data/Contact.csv'];
  testSetup
    .command([commandName].concat(defaultArgs))
    .it(defaultArgs.join(' '), (ctx) => {
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
