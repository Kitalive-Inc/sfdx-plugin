import { Messages } from '@salesforce/core';
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
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
    case 'AutoNumber':
      if (existingField?.displayFormat)
        field.displayFormat = existingField.displayFormat;
      break;
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
      if (existingField)
        field.displayLocationInDecimal = existingField.displayLocationInDecimal;
      setDefault('scale', 5);
      break;
    case 'Picklist':
      setPicklistOptions(field, existingField);
      break;
    case 'MultiselectPicklist':
      setDefault('visibleLines', 4);
      setPicklistOptions(field, existingField);
      break;
    case 'MasterDetail':
      if (existingField) {
        field.writeRequiresMasterRead = existingField.writeRequiresMasterRead;
        field.reparentableMasterDetail = existingField.reparentableMasterDetail;
      }
      setReferenceOptions(field, existingField);
      break;
    case 'Lookup':
      if (existingField)
        field.deleteConstraint = existingField.deleteConstraint;
      if (field.required === 'true') field.deleteConstraint = 'Restrict';
      setReferenceOptions(field, existingField);
      break;
    case 'Summary':
      if (existingField?.summaryFilterItems)
        field.summaryFilterItems = normalizeFilterItems(
          existingField.summaryFilterItems
        );
      break;
  }
}

function normalizeFilterItems(items) {
  return items.map((item) => {
    item = { ...item };
    if (item.value === null) delete item.value;
    if (item.valueField === null) delete item.valueField;
    return item;
  });
}

function setReferenceOptions(field, existingField) {
  if (!existingField) return;
  if (existingField.relationshipLabel !== null)
    field.relationshipLabel = existingField.relationshipLabel;
  if (existingField.lookupFilter) {
    field.lookupFilter = { ...existingField.lookupFilter };
    if (field.lookupFilter.booleanFilter === null)
      delete field.lookupFilter.booleanFilter;
    if (field.lookupFilter.description === null)
      delete field.lookupFilter.description;
    if (field.lookupFilter.errorMessage === null)
      delete field.lookupFilter.errorMessage;
    if (field.lookupFilter.infoMessage === null)
      delete field.lookupFilter.infoMessage;
    if (field.lookupFilter.filterItems)
      field.lookupFilter.filterItems = normalizeFilterItems(
        existingField.lookupFilter.filterItems
      );
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
    if (restricted === 'false' || valueSet.restricted === null)
      delete valueSet.restricted;
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
        option.label = label ?? name;
        oldOptionMap.delete(name);
        return option;
      });

      // handle options to be deleted
      if (oldOptionMap.size) {
        const newOptionMap = new Map(options.map((o) => [o.label, o]));
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

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'object.fields.setup'
);

export default class FieldsSetup extends SfCommand<SetupResult[]> {
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
      required: true,
      summary: messages.getMessage('flags.file.summary'),
    }),
    delete: Flags.boolean({
      summary: messages.getMessage('flags.delete.summary'),
    }),
    force: Flags.boolean({
      summary: messages.getMessage('flags.force.summary'),
    }),
    'target-org': requiredOrgFlagWithDeprecations,
  };

  public async run(): Promise<SetupResult[]> {
    const { flags } = await this.parse(FieldsSetup);
    const conn = flags['target-org'].getConnection();
    const namespace = await getOrgNamespace(conn);
    const pattern = namespace ? new RegExp(`^${namespace}__`, 'g') : null;
    const removeNamespace = (name: string) =>
      pattern ? name.replace(pattern, '') : name;

    this.spinner.start('parse ' + flags.file);
    const fields = (await parseCsv(
      fs.createReadStream(flags.file)
    )) as unknown as CustomField[];
    this.spinner.stop();

    const existingFieldMap = await getCustomFieldMap(conn, flags.sobject);
    const oldFieldMap = new Map(existingFieldMap);

    for (const field of fields) {
      const name = removeNamespace(field.fullName);
      const existingField = existingFieldMap.get(name);
      existingFieldMap.delete(name);
      setFieldOptions(field, existingField);
      field.fullName = `${flags.sobject}.${field.fullName}`;
    }

    let deleteFields = flags.delete ? [...existingFieldMap.values()] : [];
    if (deleteFields.length && !flags.force) {
      const prompt = await this.prompt({
        type: 'confirm',
        name: 'deleteFields',
        message: `delete fields: ${deleteFields
          .map(({ fullName }) => fullName)
          .join(', ')}\nDo you want to delete the above fields? (y/n)`,
      });
      if (!prompt.deleteFields) deleteFields = [];
    }

    const results = [];
    if (fields.length) {
      this.spinner.start('upsert fields');
      this.debug(fields);
      const upsertResults = await upsertMetadata(conn, 'CustomField', fields);
      const newFieldMap = await getCustomFieldMap(conn, flags.sobject);
      for (const { fullName, created, success, errors } of upsertResults) {
        const name = fullName.slice(flags.sobject.length + 1);
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
          error: errors.map((e) => e.message).join(', '),
        });
      }
      this.spinner.stop();
    }

    if (deleteFields.length) {
      this.spinner.start('delete fields');
      this.debug(deleteFields);
      const names = deleteFields.map(
        ({ fullName }) => `${flags.sobject}.${fullName}`
      );
      for (const { fullName, success, errors } of await deleteMetadata(
        conn,
        'CustomField',
        names
      )) {
        results.push({
          field: fullName.slice(flags.sobject.length + 1),
          result: success ? 'deleted' : 'error',
          error: errors.map((e) => e.message).join(', '),
        });
      }
      this.spinner.stop();
    }

    this.styledHeader('Fields setup result');
    this.table(results, {
      field: { header: 'FIELD' },
      result: { header: 'RESULT' },
      error: { header: 'ERROR' },
    });
    return results;
  }
}
