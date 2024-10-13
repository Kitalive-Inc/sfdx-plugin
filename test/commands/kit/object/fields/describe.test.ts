import { expect } from 'chai';
import esmock from 'esmock';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSpinner } from '@salesforce/sf-plugins-core';
import { CustomField } from '../../../../../src/types.js';

describe('kit object fields describe', () => {
  const $$ = new TestContext();
  const fields: CustomField[] = [
    { fullName: 'Text__c', type: 'Text' },
    {
      fullName: 'Picklist__c',
      type: 'Picklist',
      valueSet: {
        restricted: false,
        valueSetDefinition: {
          sorted: true,
          value: [
            { valueName: 'item1', label: 'item1', default: false },
            { valueName: 'item2', label: 'item2', default: false },
            { valueName: 'item3_value', label: 'item3', default: false },
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

  let Command: any;
  let getCustomFields: any;
  let writeCsv: any;
  let spinner: any;
  beforeEach(async () => {
    spinner = stubSpinner($$.SANDBOX);
    getCustomFields = $$.SANDBOX.fake.returns(fields);
    Command = await esmock(
      '../../../../../src/commands/kit/object/fields/describe.js',
      {
        '../../../../../src/metadata.js': { getCustomFields },
      }
    );
    writeCsv = $$.SANDBOX.stub(Command.prototype, 'writeCsv');
  });

  it('with arguments', async () => {
    await Command.run([
      '-o',
      'test@foo.bar',
      '-s',
      'CustomObject__c',
      '-f',
      'file.csv',
    ]);
    expect(getCustomFields.calledOnce).to.be.true;
    expect(getCustomFields.args[0][1]).to.eq('CustomObject__c');
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
    ).to.be.true;
    expect(spinner.start.args[0][0]).to.eq('Describe CustomObject__c fields');
  });
});
