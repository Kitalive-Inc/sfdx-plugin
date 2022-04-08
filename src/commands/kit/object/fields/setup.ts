import { flags, SfdxCommand } from '@salesforce/command';
import * as fs from 'fs-extra';
import {
  upsertMetadata,
  deleteMetadata,
  getCustomFields,
} from '../../../../metadata';
import { CustomField } from '../../../../types';
import { parseCsv } from '../../../../utils';

type SetupResult = {
  field: string;
  result: 'created' | 'updated' | 'deleted' | 'identical' | 'error';
  error?: string;
};

const deepCopy = (object) => object && JSON.parse(JSON.stringify(object));
const deepEquals = (obj1, obj2) =>
  JSON.stringify(obj1) === JSON.stringify(obj2);

export function setFieldOptions(field, existingField) {
  for (const [key, value] of Object.entries(field)) {
    if (value === '') delete field[key];
  }

  if (field.formula && existingField)
    field.formulaTreatBlanksAs ??= existingField.formulaTreatBlanksAs;

  const setDefault = (name, value) => {
    if (field[name] === undefined) field[name] = existingField?.[name] ?? value;
  };

  switch (field.type) {
    case 'Checkbox':
      setDefault('defaultValue', false);
      break;
    case 'Currency':
    case 'Number':
    case 'Percent':
      setDefault('precision', 18);
      setDefault('scale', 0);
      break;
    case 'Text':
      setDefault('length', 255);
      break;
    case 'EncryptedText':
      setDefault('length', 175);
      setDefault('maskChar', 'asterisk');
      setDefault('maskType', 'all');
      break;
    case 'LongTextArea':
    case 'Html':
      setDefault('length', 32768);
      setDefault('visibleLines', 10);
      break;
    case 'Location':
      setDefault('scale', 5);
      break;
    case 'Picklist':
      setPicklistOptions(field, existingField);
      break;
    case 'MultiselectPicklist':
      setDefault('visibleLines', 4);
      setPicklistOptions(field, existingField);
      break;
  }
}

function setPicklistOptions(field, existingField) {
  const { restricted, values, valueSetName } = field;
  if (values || valueSetName) {
    const valueSet = existingField
      ? deepCopy(existingField.valueSet)
      : { restricted: true };
    if (restricted !== undefined) valueSet.restricted = restricted;
    if (restricted === 'false') delete valueSet.restricted;
    if (values) {
      valueSet.valueSetDefinition ??= { value: [] };
      const optionMap = new Map(
        valueSet.valueSetDefinition.value.map((option) => [
          option.fullName,
          option,
        ])
      );
      const options = values
        .split(';')
        .map(
          (value) => optionMap.get(value) ?? { fullName: value, label: value }
        );
      valueSet.valueSetDefinition.value = options;
      delete valueSet.valueSetName;
    } else {
      valueSet.valueSetName = valueSetName;
      delete valueSet.valueSetDefinition;
    }
    field.valueSet =
      existingField && deepEquals(valueSet, existingField.valueSet)
        ? existingField.valueSet
        : valueSet;
    delete field.restricted;
    delete field.values;
    delete field.valueSetName;
  }
}

export default class FieldsSetupCommand extends SfdxCommand {
  public static description = 'upsert and delete object fields from a CSV file';

  public static examples = [
    '$ sfdx kit:object:fields:setup -o Account -f path/to/account_fields.csv',
    '$ sfdx kit:object:fields:setup -u me@my.org -o CustomObject__c -f path/to/custom_object_fields.csv --delete',
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
      required: true,
      description: 'input csv file path',
    }),
    delete: flags.boolean({
      description: 'delete fields that are not in the csv file',
    }),
    force: flags.boolean({
      description: 'Do not confirm when deleting',
    }),
  };

  public async run(): Promise<SetupResult[]> {
    const { object, file, delete: del, force } = this.flags;
    const conn = this.org.getConnection();
    this.ux.startSpinner('parse ' + file);
    const fields = (await parseCsv(
      fs.createReadStream(file)
    )) as unknown as CustomField[];
    const identicalFieldNames = [];
    const upsertFields = [];

    const existingFields = await getCustomFields(conn, object);
    const existingFieldMap = new Map(
      existingFields.map((f) => [f.fullName, f])
    );

    for (const field of fields) {
      const existingField = existingFieldMap.get(field.fullName);
      existingFieldMap.delete(field.fullName);
      setFieldOptions(field, existingField);

      const identical =
        existingField &&
        Object.entries(field).every(
          ([key, value]) => existingField[key] == value
        );
      if (identical) {
        identicalFieldNames.push(field.fullName);
      } else {
        upsertFields.push({
          ...field,
          fullName: `${object}.${field.fullName}`,
        });
      }
    }
    this.ux.stopSpinner();

    let deleteFields = del ? [...existingFieldMap.values()] : [];
    if (deleteFields.length && !force) {
      const confirmed = await this.ux.confirm(
        `delete fields: ${deleteFields
          .map(({ fullName }) => fullName)
          .join(', ')}\nDo you want to delete the above fields? (y/n)`
      );
      if (!confirmed) deleteFields = [];
    }

    const result = [];
    if (upsertFields.length) {
      this.ux.startSpinner('upsert fields');
      for (const { fullName, created, success, errors } of await upsertMetadata(
        conn,
        'CustomField',
        upsertFields
      )) {
        result.push({
          field: fullName.slice(object.length + 1),
          result: created ? 'created' : success ? 'updated' : 'error',
          error: Array.isArray(errors)
            ? errors.map((e) => e.message).join(', ')
            : errors?.message,
        });
      }
      this.ux.stopSpinner();
    }

    if (deleteFields.length) {
      this.ux.startSpinner('delete fields');
      const names = deleteFields.map(({ fullName }) => `${object}.${fullName}`);
      for (const { fullName, success, errors } of await deleteMetadata(
        conn,
        'CustomField',
        names
      )) {
        result.push({
          field: fullName.slice(object.length + 1),
          result: success ? 'deleted' : 'error',
          error: Array.isArray(errors)
            ? errors.map((e) => e.message).join(', ')
            : errors?.message,
        });
      }
      this.ux.stopSpinner();
    }

    for (const field of identicalFieldNames) {
      result.push({ field, result: 'identical' });
    }

    this.ux.styledHeader('Fields setup result');
    this.ux.table(result, ['field', 'result', 'error']);
    return result;
  }
}
