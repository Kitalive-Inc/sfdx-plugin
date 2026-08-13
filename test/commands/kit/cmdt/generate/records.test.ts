import { expect } from 'chai';
import {
  customMetadataXml,
  parseFieldDefinition,
} from '../../../../../src/commands/kit/cmdt/generate/records.js';

describe('kit cmdt generate records', () => {
  it('generates XML from standard CSV columns and defined custom fields', () => {
    const xml = customMetadataXml(
      {
        DeveloperName: 'Sample_Record',
        MasterLabel: 'Sample & Record',
        isProtected: 'true',
        Text__c: '<value>',
        Ignored__c: 'ignored',
      },
      new Map([['Text__c', { type: 'Text' }]])
    );

    expect(xml).to.contain('<label>Sample &amp; Record</label>');
    expect(xml).to.contain('<protected>true</protected>');
    expect(xml).to.contain('<field>Text__c</field>');
    expect(xml).to.contain(
      '<value xsi:type="xsd:string">&lt;value&gt;</value>'
    );
    expect(xml).not.to.contain('Ignored__c');
  });

  it('uses DeveloperName as the label when MasterLabel and Label are absent', () => {
    const xml = customMetadataXml(
      { DeveloperName: 'Sample_Record' },
      new Map()
    );

    expect(xml).to.contain('<label>Sample_Record</label>');
    expect(xml).to.contain('<protected>false</protected>');
  });

  it('parses field definitions and uses their primitive XML types', () => {
    const definition = parseFieldDefinition(`
      <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
        <fullName>Amount__c</fullName>
        <scale>0</scale>
        <type>Number</type>
      </CustomField>
    `);
    const xml = customMetadataXml(
      { DeveloperName: 'Sample_Record', Amount__c: '10', Active__c: '' },
      new Map([
        ['Amount__c', definition!],
        ['Active__c', { type: 'Checkbox' }],
      ])
    );

    expect(definition).to.deep.include({
      fullName: 'Amount__c',
      scale: 0,
      type: 'Number',
    });
    expect(xml).to.contain('<value xsi:type="xsd:int">10</value>');
    expect(xml).to.contain('<value xsi:nil="true"/>');
  });
});
