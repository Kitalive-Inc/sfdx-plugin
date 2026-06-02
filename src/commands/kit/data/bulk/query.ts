import fs from 'node:fs';
import { Writable } from 'node:stream';
import { Connection, Messages, Org } from '@salesforce/core';
import { write } from '@fast-csv/format';
import { Record as JsforceRecord } from '@jsforce/jsforce-node';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import { getFlattenedFields, parseQuery } from '@jetstreamapp/soql-parser-js';
import { bulkQuery, QueryOptions } from '../../../../bulk.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'data.bulk.query'
);

export default class QueryCommand extends SfCommand<JsonMap[]> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    query: Flags.string({
      char: 'q',
      exactlyOne: ['query', 'query-file'],
      summary: messages.getMessage('flags.query.summary'),
    }),
    'query-file': Flags.string({
      exactlyOne: ['query', 'query-file'],
      summary: messages.getMessage('flags.query-file.summary'),
    }),
    'csv-file': Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.csv-file.summary'),
      aliases: ['csvfile'],
      deprecateAliases: true,
    }),
    'object-field-label': Flags.boolean({
      summary: messages.getMessage('flags.object-field-label.summary'),
    }),
    'field-label-mapping': Flags.string({
      summary: messages.getMessage('flags.field-label-mapping.summary'),
    }),
    all: Flags.boolean({
      summary: messages.getMessage('flags.all.summary'),
    }),
    wait: Flags.integer({
      char: 'w',
      summary: messages.getMessage('flags.wait.summary'),
      default: 5,
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<JsonMap[]> {
    const { flags } = await this.parse();
    const org = flags['target-org'] as Org;
    const conn = org.getConnection(flags['api-version'] as string);
    const file = flags['csv-file'] as string;
    const query = this.getQuery(
      flags.query as string | undefined,
      flags['query-file'] as string | undefined
    );
    const objectFieldLabel = flags['object-field-label'] as boolean;
    const fieldLabelMapping = flags['field-label-mapping'] as
      | string
      | undefined;
    const fieldLabels =
      objectFieldLabel || fieldLabelMapping
        ? await this.getFieldLabels(
            conn,
            query,
            objectFieldLabel,
            fieldLabelMapping
          )
        : new Map<string, string>();
    this.validateFieldLabels(query, fieldLabels);

    this.spinner.start('Bulk query');
    try {
      const rows = await this.bulkQuery(conn, query, {
        all: flags.all as boolean,
        wait: flags.wait as number,
      });
      if (!rows.length) {
        this.spinner.stop('no records');
        return rows;
      }

      this.spinner.stop(`${rows.length} records`);

      const outputRows = this.applyFieldLabels(rows, fieldLabels);

      if (file) {
        this.writeCsv(outputRows, fs.createWriteStream(file));
      } else if (!this.jsonEnabled()) {
        this.writeCsv(outputRows, process.stdout);
      }

      return outputRows;
    } catch (e) {
      this.spinner.stop('error');
      throw e;
    }
  }

  public writeCsv(rows: JsonMap[], stream: Writable) {
    write(rows, { headers: true, writeBOM: true }).pipe(stream);
  }

  public getQuery(query?: string, queryFile?: string): string {
    return query ?? fs.readFileSync(queryFile as string).toString('utf8');
  }

  public async getFieldLabels(
    conn: Connection,
    soql: string,
    useObjectFieldLabel: boolean,
    mappingFile?: string
  ): Promise<Map<string, string>> {
    const parsedQuery = parseQuery(soql);
    const labels = new Map<string, string>();

    if (useObjectFieldLabel) {
      const objectInfo = await conn.describe(parsedQuery.sObject as string);
      const fields = objectInfo.fields as Array<{
        name: string;
        label: string;
        relationshipName?: string | null;
      }>;
      const fieldMap = new Map(fields.map((field) => [field.name, field]));
      const relationshipFieldMap = new Map(
        fields
          .filter((field) => field.relationshipName)
          .map((field) => [field.relationshipName as string, field])
      );

      for (const fieldName of getFlattenedFields(parsedQuery)) {
        const field = fieldMap.get(fieldName);
        if (field) {
          labels.set(fieldName, field.label);
          continue;
        }

        const relationshipName = fieldName.match(/^(.+)\.Name$/)?.[1];
        const relationshipField =
          relationshipName && relationshipFieldMap.get(relationshipName);
        if (relationshipField) {
          labels.set(fieldName, relationshipField.label.replace(/ ID$/, ''));
        }
      }
    }

    if (mappingFile) {
      for (const [fieldName, label] of Object.entries(
        this.readFieldLabelMappings(mappingFile)
      )) {
        labels.set(fieldName, label);
      }
    }

    return labels;
  }

  public readFieldLabelMappings(file: string): { [key: string]: string } {
    const mappings = JSON.parse(fs.readFileSync(file).toString('utf8')) as
      | { [key: string]: unknown }
      | unknown[];
    if (
      !mappings ||
      Array.isArray(mappings) ||
      typeof mappings !== 'object' ||
      Object.values(mappings).some((value) => typeof value !== 'string')
    ) {
      throw new Error(
        messages.getMessage('errors.invalidFieldLabelMapping', [file])
      );
    }

    return mappings as { [key: string]: string };
  }

  public applyFieldLabels(
    rows: JsforceRecord[],
    labels: Map<string, string>
  ): JsonMap[] {
    if (!labels.size) return rows as JsonMap[];

    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([fieldName, value]) => [
          labels.get(fieldName) ?? fieldName,
          value,
        ])
      )
    ) as JsonMap[];
  }

  public validateFieldLabels(soql: string, labels: Map<string, string>) {
    if (!labels.size) return;

    const duplicatedLabels = this.findDuplicatedLabels(
      getFlattenedFields(parseQuery(soql)).map((fieldName) => ({
        fieldName,
        label: labels.get(fieldName) ?? fieldName,
      }))
    );
    if (duplicatedLabels.length) {
      throw new Error(
        messages.getMessage('errors.duplicatedFieldLabel', [
          duplicatedLabels
            .map(
              ({ label, fieldNames }) => `${label} (${fieldNames.join(', ')})`
            )
            .join('; '),
        ])
      );
    }
  }

  public bulkQuery(conn: Connection, query: string, options: QueryOptions) {
    return bulkQuery(conn, query, options);
  }

  private findDuplicatedLabels(
    fields: Array<{ fieldName: string; label: string }>
  ): Array<{ label: string; fieldNames: string[] }> {
    const fieldNamesByLabel = new Map<string, string[]>();
    for (const { fieldName, label } of fields) {
      const fieldNames = fieldNamesByLabel.get(label) ?? [];
      fieldNames.push(fieldName);
      fieldNamesByLabel.set(label, fieldNames);
    }

    return [...fieldNamesByLabel.entries()]
      .filter(([, fieldNames]) => fieldNames.length > 1)
      .map(([label, fieldNames]) => ({ label, fieldNames }));
  }
}
