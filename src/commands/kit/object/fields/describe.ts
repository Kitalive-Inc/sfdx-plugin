import { flags, SfdxCommand } from '@salesforce/command';
import * as csv from 'fast-csv';
import * as fs from 'fs-extra';
import { MetadataInfo } from 'jsforce';
import { getCustomFields } from '../../../../metadata';

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

export default class FieldsDescribeCommand extends SfdxCommand {
  public static description = 'describe object fields information';

  public static examples = [
    '$ sfdx kit:object:fields:describe -o Account -f path/to/account_fields.csv',
    '$ sfdx kit:object:fields:describe -u me@my.org -o CustomObject__c --json',
  ];

  protected static requiresUsername = true;
  protected static requiresProject = false;

  protected static flagsConfig = {
    object: flags.string({
      char: 'o',
      required: true,
      description: 'SObject name',
    }),
    file: flags.string({
      char: 'f',
      description: 'output csv file path',
    }),
  };

  public async run(): Promise<MetadataInfo[]> {
    const { object, file, json } = this.flags;
    const conn = this.org.getConnection();
    this.ux.startSpinner(`describe ${object} fields`);
    const results = await getCustomFields(conn, object);
    this.ux.stopSpinner();
    if (!json) {
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
      this.writeCsv(file, rows);
    }
    return results;
  }

  writeCsv(file, rows) {
    csv
      .write(rows, { headers: csvHeaders, writeBOM: true })
      .pipe(file ? fs.createWriteStream(file) : process.stdout);
  }
}
