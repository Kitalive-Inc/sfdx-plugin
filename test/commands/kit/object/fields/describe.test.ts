import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import Command from '../../../../../src/commands/kit/object/fields/describe';
import * as metadata from '../../../../../src/metadata';

const command = 'kit:object:fields:describe';
describe(command, () => {
  const $$ = testSetup();
  const fields = [
    { fullName: 'Text__c', type: 'Text' },
    {
      fullName: 'Picklist__c',
      type: 'Picklist',
      valueSet: {
        restricted: false,
        valueSetDefinition: {
          value: [
            { valueName: 'item1', label: 'item1' },
            { valueName: 'item2', label: 'item2' },
            { valueName: 'item3_value', label: 'item3' },
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

  let getCustomFields: any;
  let writeCsv: any;
  beforeEach(async () => {
    await $$.stubAuths(new MockTestOrgData());
    getCustomFields = stubMethod(
      $$.SANDBOX,
      metadata,
      'getCustomFields'
    ).resolves(fields);
    writeCsv = stubMethod($$.SANDBOX, Command.prototype, 'writeCsv');
  });

  it('with arguments', async () => {
    await Command.run([
      '-u',
      'test@foo.bar',
      '-o',
      'CustomObject__c',
      '-f',
      'file.csv',
    ]);
    expect(getCustomFields.calledOnce).toBe(true);
    expect(getCustomFields.args[0][1]).toEqual('CustomObject__c');
    expect(
      writeCsv.calledWith('file.csv', [
        fields[0],
        {
          fullName: 'Picklist__c',
          type: 'Picklist',
          restricted: false,
          values: 'item1\nitem2\nitem3_value: item3',
        },
        {
          fullName: 'MultiSelectPicklist__c',
          type: 'MultiSelectPicklist',
          restricted: true,
          valueSetName: 'setName',
        },
      ])
    ).toBe(true);
  });
});
