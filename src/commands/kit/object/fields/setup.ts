import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import fs from 'fs-extra';
import {
  upsertMetadata,
  deleteMetadata,
  getCustomFieldMap,
  getOrgNamespace,
} from '../../../../metadata.js';
import { CustomField, CustomValue, FilterItem } from '../../../../types.js';
import { parseCsv } from '../../../../utils.js';

type ResultType = 'created' | 'updated' | 'deleted' | 'identical' | 'error';
type SetupResult = {
  field: string;
  result: ResultType;
  error?: string;
};

const deepCopy = <T>(object: T): T =>
  object && (JSON.parse(JSON.stringify(object)) as T);
const deepEquals = (
  obj1: JsonMap | null | undefined,
  obj2: JsonMap | null | undefined
) => JSON.stringify(obj1) === JSON.stringify(obj2);

export function setFieldOptions(
  field: CustomField,
  existingField?: CustomField
) {
  for (const [key, value] of Object.entries(field)) {
    if (value === '') delete field[key];
  }

  if (field.formula && existingField?.formulaTreatBlanksAs != null)
    field.formulaTreatBlanksAs ??= existingField.formulaTreatBlanksAs;

  switch (field.type) {
    case 'AutoNumber':
      if (existingField?.displayFormat)
        field.displayFormat = existingField.displayFormat;
      break;
    case 'Checkbox':
      if (!field.formula)
        field.defaultValue ??= existingField?.defaultValue ?? 'false';
      break;
    case 'Currency':
    case 'Number':
    case 'Percent':
      field.precision ??= existingField?.precision ?? 18;
      field.scale ??= existingField?.scale ?? 0;
      break;
    case 'Text':
      if (!field.formula) field.length ??= existingField?.length ?? 255;
      break;
    case 'EncryptedText':
      field.length ??= existingField?.length ?? 175;
      field.maskChar ??= existingField?.maskChar ?? 'asterisk';
      field.maskType ??= existingField?.maskType ?? 'all';
      break;
    case 'LongTextArea':
    case 'Html':
      field.length ??= existingField?.length ?? 32_768;
      field.visibleLines ??= existingField?.visibleLines ?? 10;
      break;
    case 'Location':
      if (existingField)
        field.displayLocationInDecimal = existingField.displayLocationInDecimal;
      field.scale ??= existingField?.scale ?? 5;
      break;
    case 'Picklist':
      setPicklistOptions(field, existingField);
      break;
    case 'MultiselectPicklist':
      field.visibleLines ??= existingField?.visibleLines ?? 4;
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
    default:
      break;
  }
}

function normalizeFilterItems(items: FilterItem[]): FilterItem[] {
  return items.map((item) => {
    item = { ...item };
    if (item.value === null) delete item.value;
    if (item.valueField === null) delete item.valueField;
    return item;
  });
}

function setReferenceOptions(field: CustomField, existingField?: CustomField) {
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

function setPicklistOptions(field: CustomField, existingField?: CustomField) {
  if (existingField && field.type !== existingField.type)
    existingField = undefined;
  const { restricted, values, valueSetName } = field;
  if (values || valueSetName) {
    const valueSet = existingField
      ? deepCopy(existingField.valueSet!)
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
          option.valueName as string,
          Object.fromEntries(
            Object.entries(option).filter((keyval) => keyval[1] !== null)
          ) as CustomValue,
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
        const newOptionMap = new Map(
          options.map((o) => [o.label as string, o])
        );
        for (const { valueName, label } of oldOptionMap.values()) {
          // detect API name changes and change label to avoid duplicate labels
          if (newOptionMap.has(label!))
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

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
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
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<SetupResult[]> {
    const { flags } = await this.parse(FieldsSetup);
    const conn = flags['target-org'].getConnection(flags['api-version']);
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
      const result = await this.confirm({
        message: `delete fields: ${deleteFields
          .map(({ fullName }) => fullName)
          .join(', ')}\nDo you want to delete the above fields? (y/n)`,
      });
      if (!result) deleteFields = [];
    }

    const results: SetupResult[] = [];
    if (fields.length) {
      this.spinner.start('upsert fields');
      this.debug(fields);
      const upsertResults = await upsertMetadata(conn, 'CustomField', fields);
      const newFieldMap = await getCustomFieldMap(conn, flags.sobject);
      for (const { fullName, created, success, errors } of upsertResults) {
        const name = fullName.slice(flags.sobject.length + 1);
        let result: ResultType = created
          ? 'created'
          : success
          ? 'updated'
          : 'error';
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
    this.table({
      data: results,
      columns: ['field', 'result', 'error'],
    });
    return results;
  }
}
