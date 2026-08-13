import path from 'node:path';
import { Messages, SfError } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs-extra';
import { parseCsv } from '../../../../utils.js';

export type CustomFieldDefinition = {
  fullName?: string;
  scale?: number;
  type?: string;
};

type CustomFieldFile = {
  CustomField?: CustomFieldDefinition;
};

const standardColumns = new Set([
  'DeveloperName',
  'MasterLabel',
  'Label',
  'isProtected',
]);

const fieldTypeMap = new Map<string, string>([
  ['Checkbox', 'boolean'],
  ['Date', 'date'],
  ['DateTime', 'dateTime'],
  ['Email', 'string'],
  ['Phone', 'string'],
  ['Picklist', 'string'],
  ['Text', 'string'],
  ['TextArea', 'string'],
  ['LongTextArea', 'string'],
  ['Url', 'string'],
]);

function developerNameFrom(row: JsonMap): string {
  const developerName = row.DeveloperName;
  if (typeof developerName !== 'string' || !developerName) {
    throw new SfError(messages.getMessage('error.missingDeveloperName'));
  }
  return developerName;
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function customMetadataXml(
  row: JsonMap,
  customFields: Map<string, CustomFieldDefinition>
): string {
  const developerName = developerNameFrom(row);

  const label = row.MasterLabel || row.Label || developerName;
  const values = Object.entries(row)
    .filter(([field]) => !standardColumns.has(field) && customFields.has(field))
    .map(([field, value]) => {
      const valueXml =
        value === null || value === ''
          ? '<value xsi:nil="true"/>'
          : `<value xsi:type="xsd:${fieldPrimitiveType(
              customFields.get(field)
            )}">${escapeXml(value)}</value>`;
      return `  <values>\n    <field>${escapeXml(
        field
      )}</field>\n    ${valueXml}\n  </values>`;
    });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
    `  <label>${escapeXml(label)}</label>`,
    `  <protected>${escapeXml(row.isProtected || false)}</protected>`,
    ...values,
    '</CustomMetadata>',
    '',
  ].join('\n');
}

export function fieldPrimitiveType(field?: CustomFieldDefinition): string {
  if (field?.type === 'Number' || field?.type === 'Percent') {
    return field.scale === 0 ? 'int' : 'double';
  }
  return fieldTypeMap.get(field?.type ?? '') ?? 'string';
}

export function parseFieldDefinition(
  xml: string
): CustomFieldDefinition | undefined {
  return (new XMLParser().parse(xml) as CustomFieldFile).CustomField;
}

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'cmdt.generate.records'
);

export default class CmdtGenerateRecords extends SfCommand<string[]> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly requiresProject = true;

  public static readonly flags = {
    'output-directory': Flags.string({
      char: 'd',
      default: 'force-app/main/default/customMetadata',
      summary: messages.getMessage('flags.output-directory.summary'),
    }),
    'input-directory': Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.input-directory.summary'),
    }),
    'csv-file': Flags.string({
      char: 'f',
      required: true,
      summary: messages.getMessage('flags.csv-file.summary'),
    }),
    type: Flags.string({
      char: 't',
      required: true,
      summary: messages.getMessage('flags.type.summary'),
    }),
  };

  public async run(): Promise<string[]> {
    const { flags } = await this.parse(CmdtGenerateRecords);
    if (!flags.type.endsWith('__mdt')) {
      throw new SfError(messages.getMessage('error.invalidType', [flags.type]));
    }

    const outputDirectory = path.resolve(
      this.project!.getPath(),
      flags['output-directory']
    );
    const inputDirectory = flags['input-directory']
      ? path.resolve(this.project!.getPath(), flags['input-directory'])
      : path.resolve(outputDirectory, '..', 'objects');
    const customFields = await this.readCustomFields(
      inputDirectory,
      flags.type
    );
    const rows = await parseCsv(fs.createReadStream(flags['csv-file']), {
      trim: true,
    });
    await fs.ensureDir(outputDirectory);
    const outputFiles = await Promise.all(
      rows.map(async (row) => {
        const developerName = developerNameFrom(row);
        const outputFile = path.join(
          outputDirectory,
          `${flags.type}.${developerName}.md-meta.xml`
        );
        await fs.outputFile(outputFile, customMetadataXml(row, customFields));
        return outputFile;
      })
    );

    this.log(
      messages.getMessage('result', [outputFiles.length, outputDirectory])
    );
    return outputFiles;
  }

  private async readCustomFields(
    inputDirectory: string,
    type: string
  ): Promise<Map<string, CustomFieldDefinition>> {
    const fieldsDirectory = path.join(inputDirectory, type, 'fields');
    if (!(await fs.pathExists(fieldsDirectory))) {
      throw new SfError(
        messages.getMessage('error.fieldsNotFound', [fieldsDirectory])
      );
    }

    const fieldFiles = (await fs.readdir(fieldsDirectory)).filter((file) =>
      file.endsWith('.field-meta.xml')
    );
    const definitions = await Promise.all(
      fieldFiles.map(async (file) => {
        const definition = await fs.readFile(
          path.join(fieldsDirectory, file),
          'utf8'
        );
        return parseFieldDefinition(definition);
      })
    );
    return new Map(
      definitions
        .filter(
          (
            definition
          ): definition is CustomFieldDefinition & { fullName: string } =>
            typeof definition?.fullName === 'string'
        )
        .map((definition) => [definition.fullName, definition])
    );
  }
}
