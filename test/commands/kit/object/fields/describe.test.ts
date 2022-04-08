import { test } from '@salesforce/command/lib/test';
import Command from '../../../../../src/commands/kit/object/fields/describe';
import * as metadata from '../../../../../src/metadata';

const command = 'kit:object:fields:describe';
describe(command, () => {
  const fields = [
    { fullName: 'Text__c', type: 'Text' },
    {
      fullName: 'Picklist__c',
      type: 'Picklist',
      valueSet: {
        restricted: false,
        valueSetDefinition: {
          value: [
            { fullName: 'item1', label: 'item1' },
            { fullName: 'item2', label: 'item2' },
            { fullName: 'item3', label: 'item3' },
          ],
        },
      },
    },
    {
      fullName: 'MultiSelectPicklist__c',
      type: 'MultiSelectPicklist',
      valueSet: {
        restricted: true,
        valueSetName: 'setName',
      },
    },
  ];
  const getCustomFields = jest
    .spyOn(metadata, 'getCustomFields')
    .mockImplementation(async (conn, object) => fields);
  const writeCsv = jest
    .spyOn(Command.prototype, 'writeCsv')
    .mockImplementation((file, rows) => {});

  const t = test.withOrg({ username: 'test@org.com' }, true).stdout().stderr();

  t.command([command, '-o', 'CustomObject__c', '-f', 'file.csv']).it(
    'arguments',
    () => {
      expect(getCustomFields).toHaveBeenCalledTimes(1);
      expect(getCustomFields.mock.calls[0][1]).toEqual('CustomObject__c');
      expect(writeCsv).toHaveBeenCalledWith('file.csv', [
        fields[0],
        {
          fullName: 'Picklist__c',
          type: 'Picklist',
          restricted: false,
          values: 'item1;item2;item3',
        },
        {
          fullName: 'MultiSelectPicklist__c',
          type: 'MultiSelectPicklist',
          restricted: true,
          valueSetName: 'setName',
        },
      ]);
    }
  );
});
