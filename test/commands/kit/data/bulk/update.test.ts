import { test } from '@salesforce/command/lib/test';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import Command from '../../../../../src/commands/kit/data/bulk/update';

const commandName = 'kit:data:bulk:update';
describe(commandName, () => {
  const csvRows = [
    { LastName: 'contact1', Email: 'contact1@example.com' },
    { LastName: 'contact2', Email: 'contact2@example.com' },
    { LastName: 'contact3', Email: 'contact3@example.com' }
  ];

  const fieldTypes = {};
  const createReadStream = jest.spyOn(fs, 'createReadStream').mockReturnValue(csv.write(csvRows));
  jest.spyOn(Command.prototype, 'parseCsv' as any).mockReturnValue(Promise.resolve(csvRows));
  jest.spyOn(Command.prototype, 'saveCsv' as any).mockImplementation(() => {});
  jest.spyOn(Command.prototype, 'getFieldTypes').mockReturnValue(fieldTypes);
  const bulkLoad = jest.spyOn(Command.prototype, 'bulkLoad').mockReturnValue(Promise.resolve({job: {}, records: []}));

  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout().stderr();

  const defaultArgs = ['-o', 'Contact', '-f', 'data/Contact.csv'];
  testSetup
    .command([commandName].concat(defaultArgs))
    .it(defaultArgs.join(' '), ctx => {
      expect(createReadStream).toHaveBeenCalledWith('data/Contact.csv');

      expect(bulkLoad).toHaveBeenCalledTimes(1);
      expect(bulkLoad.mock.calls[0][1]).toBe('Contact');
      expect(bulkLoad.mock.calls[0][2]).toBe('update');
      expect(bulkLoad.mock.calls[0][3]).toEqual(csvRows);
      expect(bulkLoad.mock.calls[0][4]).toEqual({
        extIdField: undefined,
        concurrencyMode: 'Parallel',
        assignmentRuleId: undefined,
        batchSize: 10000,
        wait: undefined
      });
    });
});
