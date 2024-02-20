import { Messages } from '@salesforce/core';
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import * as csv from 'fast-csv';
import fs from 'fs-extra';
import { getCustomFields } from '../../../../metadata';
import { CustomField } from '../../../../types';

const csvHeaders = [
  'label',
  'fullName',
  'type',
  'length',
  'precision',
  'scale',
  'formula',
  // START picklist specific options
  'valueSetName', // global picklist name
  'values', // semicolon separated picklist values
  'restricted',
  // END
  'referenceTo',
  'relationshipName',
  'summaryForeignKey',
  'summaryOperation',
  'summarizedField',
  'required',
  'unique',
  'caseSensitive',
  'defaultValue',
  'externalId',
  'description',
  'inlineHelpText',
];

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'object.fields.describe'
);

export default class FieldsDescribe extends SfCommand<CustomField[]> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    sobject: Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.sobject.summary'),
    }),
    file: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.file.summary'),
    }),
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<CustomField[]> {
    const { flags } = await this.parse(FieldsDescribe);
    const conn = flags['target-org'].getConnection(flags['api-version']);
    this.spinner.start(messages.getMessage('spinner.start', [flags.sobject]));
    const results = await getCustomFields(conn, flags.sobject);
    this.spinner.stop();
    if (!this.jsonEnabled()) {
      const rows = results.map(({ valueSet, ...row }) => {
        if (valueSet) {
          const { restricted, valueSetDefinition, valueSetName } = valueSet;
          row.restricted = restricted;
          if (valueSetDefinition) {
            row.values = valueSetDefinition.value
              .map((v) =>
                v.label === v.valueName
                  ? v.valueName
                  : `${v.valueName}: ${v.label}`
              )
              .join('\n');
          } else {
            row.valueSetName = valueSetName;
          }
        }
        return row;
      });
      this.writeCsv(flags.file, rows);
    }
    return results;
  }

  private writeCsv(file, rows) {
    csv
      .write(rows, { headers: csvHeaders, writeBOM: true })
      .pipe(file ? fs.createWriteStream(file) : process.stdout);
  }
}
