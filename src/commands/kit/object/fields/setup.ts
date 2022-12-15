import { flags, SfdxCommand } from '@salesforce/command';
import * as fs from 'fs-extra';
import {
  upsertMetadata,
  deleteMetadata,
  getCustomFieldMap,
  getOrgNamespace,
} from '../../../../metadata';
import { CustomField, CustomValue } from '../../../../types';
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

  if (field.formula && existingField?.formulaTreatBlanksAs != null)
    field.formulaTreatBlanksAs ??= existingField.formulaTreatBlanksAs;

  const setDefault = (name, value) => {
    if (field[name] === undefined) field[name] = existingField?.[name] ?? value;
  };

  switch (field.type) {
    case 'Checkbox':
      if (!field.formula) setDefault('defaultValue', false);
      break;
    case 'Currency':
    case 'Number':
    case 'Percent':
      setDefault('precision', 18);
      setDefault('scale', 0);
      break;
    case 'Text':
      if (!field.formula) setDefault('length', 255);
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
    case 'Lookup':
      if (field.required === 'true') field.deleteConstraint = 'Restrict';
      break;
  }
}

function setPicklistOptions(field, existingField) {
  if (existingField && field.type !== existingField.type) existingField = null;
  const { restricted, values, valueSetName } = field;
  if (values || valueSetName) {
    const valueSet = existingField
      ? deepCopy(existingField.valueSet)
      : { restricted: true };
    if (restricted !== undefined) valueSet.restricted = restricted;
    if (restricted === 'false') delete valueSet.restricted;
    if (valueSet.controllingField === null) delete valueSet.controllingField;
    if (valueSet.valueSettings === null) delete valueSet.valueSettings;
    if (values) {
      valueSet.valueSetDefinition ??= { value: [] };
      const oldOptionMap = new Map<string, CustomValue>(
        valueSet.valueSetDefinition.value.map((option) => [
          option.valueName,
          Object.fromEntries(
            Object.entries(option).filter((keyval) => keyval[1] !== null)
          ),
        ])
      );
      const options = values.split(/;|[\r\n]+/).map((value) => {
        const [name, label] = value.split(/\s*:\s*/);
        const option =
          oldOptionMap.get(name) ?? ({ valueName: name } as CustomValue);
        option['label'] = label ? label : name;
        oldOptionMap.delete(name);
        return option;
      });

      // handle options to be deleted
      if (oldOptionMap.size) {
        const newOptionMap = new Map(options.map((o) => [o['label'], o]));
        for (const { valueName, label } of oldOptionMap.values()) {
          // detect API name changes and change label to avoid duplicate labels
          if (newOptionMap.has(label))
            options.push({ valueName, label: label + '_del', isActive: false });
        }
      }

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
    const namespace = await getOrgNamespace(conn);
    const pattern = namespace ? new RegExp(`^${namespace}__`, 'g') : null;
    const removeNamespace = (name: string) =>
      pattern ? name.replace(pattern, '') : name;

    this.ux.startSpinner('parse ' + file);
    const fields = (await parseCsv(
      fs.createReadStream(file)
    )) as unknown as CustomField[];
    this.ux.stopSpinner();

    const existingFieldMap = await getCustomFieldMap(conn, object);
    const oldFieldMap = new Map(existingFieldMap);

    for (const field of fields) {
      const name = removeNamespace(field.fullName);
      const existingField = existingFieldMap.get(name);
      existingFieldMap.delete(name);
      setFieldOptions(field, existingField);
      field.fullName = `${object}.${field.fullName}`;
    }

    let deleteFields = del ? [...existingFieldMap.values()] : [];
    if (deleteFields.length && !force) {
      const confirmed = await this.ux.confirm(
        `delete fields: ${deleteFields
          .map(({ fullName }) => fullName)
          .join(', ')}\nDo you want to delete the above fields? (y/n)`
      );
      if (!confirmed) deleteFields = [];
    }

    const results = [];
    if (fields.length) {
      this.ux.startSpinner('upsert fields');
      this.logger.debug(fields);
      const upsertResults = await upsertMetadata(conn, 'CustomField', fields);
      const newFieldMap = await getCustomFieldMap(conn, object);
      for (const { fullName, created, success, errors } of upsertResults) {
        const name = fullName.slice(object.length + 1);
        let result = created ? 'created' : success ? 'updated' : 'error';
        if (
          result === 'updated' &&
          deepEquals(newFieldMap.get(name), oldFieldMap.get(name))
        ) {
          result = 'identical';
        }
        results.push({
          field: name,
          result,
          error: Array.isArray(errors)
            ? errors.map((e) => e.message).join(', ')
            : errors?.message,
        });
      }
      this.ux.stopSpinner();
    }

    if (deleteFields.length) {
      this.ux.startSpinner('delete fields');
      this.logger.debug(deleteFields);
      const names = deleteFields.map(({ fullName }) => `${object}.${fullName}`);
      for (const { fullName, success, errors } of await deleteMetadata(
        conn,
        'CustomField',
        names
      )) {
        results.push({
          field: fullName.slice(object.length + 1),
          result: success ? 'deleted' : 'error',
          error: Array.isArray(errors)
            ? errors.map((e) => e.message).join(', ')
            : errors?.message,
        });
      }
      this.ux.stopSpinner();
    }

    this.ux.styledHeader('Fields setup result');
    this.ux.table(results, ['field', 'result', 'error']);
    return results;
  }
}
