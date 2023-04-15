import { JsonMap } from '@salesforce/ts-types';
import { Connection } from 'jsforce';
import {
  Metadata,
  MetadataType,
  SaveResult,
  UpsertResult,
} from 'jsforce/api/metadata';
import { chunk } from './utils';
import { CustomField } from './types';

let orgNamespace;
export async function getOrgNamespace(conn: Connection): Promise<string> {
  if (orgNamespace === undefined) {
    const {
      records: [{ NamespacePrefix }],
    } = await conn.query('SELECT NamespacePrefix FROM Organization');
    orgNamespace = NamespacePrefix;
  }
  return orgNamespace;
}

export async function completeDefaultNamespace(
  conn: Connection,
  objectName: string
): Promise<string>;
export async function completeDefaultNamespace(
  conn: Connection,
  objectNames: string[]
): Promise<string[]>;
export async function completeDefaultNamespace(
  conn: Connection,
  objectName: string | string[]
): Promise<string | string[]> {
  const ns = await getOrgNamespace(conn);
  if (!ns) return objectName;

  const isArray = Array.isArray(objectName);
  const objectNames = isArray ? objectName : [objectName];
  const results = objectNames.map((name) => {
    if (name.endsWith('__c') && name.split('__').length === 2) {
      return `${ns}__${name}`;
    } else {
      return name;
    }
  });

  return isArray ? results : results[0];
}

export function chunkMetadata<T>(type: string, metadata: T | T[]): Array<T[]> {
  // metadata limit: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_createMetadata.htm
  const size =
    type === 'CustomMetadata' || type === 'CustomApplication' ? 200 : 10;
  return chunk(Array.isArray(metadata) ? metadata : [metadata], size);
}

export function readMetadata(
  conn: Connection,
  type: MetadataType,
  fullNames: string | string[]
): Promise<Metadata[]> {
  return Promise.all(
    chunkMetadata(type, fullNames).map((data) => conn.metadata.read(type, data))
  ).then((a) => a.flat());
}

export function updateMetadata(
  conn: Connection,
  type: string,
  metadata: Metadata | Metadata[]
): Promise<SaveResult[]> {
  return Promise.all(
    chunkMetadata(type, metadata).map((data) =>
      conn.metadata.update(type, data)
    )
  ).then((a) => a.flat());
}

export function upsertMetadata(
  conn: Connection,
  type: string,
  metadata: Metadata | Metadata[]
): Promise<UpsertResult[]> {
  return Promise.all(
    chunkMetadata(type, metadata).map((data) =>
      conn.metadata.upsert(type, data)
    )
  ).then((a) => a.flat() as UpsertResult[]);
}

export function deleteMetadata(
  conn: Connection,
  type: string,
  fullNames: string | string[]
): Promise<SaveResult[]> {
  return Promise.all(
    chunkMetadata(type, fullNames).map((data) =>
      conn.metadata.delete(type, data)
    )
  ).then((a) => a.flat());
}

type ToolingCustomField = { DeveloperName: string; Metadata: JsonMap };
export async function getCustomFields(
  conn: Connection,
  object: string
): Promise<CustomField[]> {
  object = await completeDefaultNamespace(conn, object);
  const [org] = await conn
    .sobject('Organization')
    .select(['IsSandbox', 'TrialExpirationDate']);
  const condition = {
    'EntityDefinition.QualifiedApiName': object,
    ManageableState: 'unmanaged',
    $not: { DeveloperName: { $like: '_tc%' } },
  };

  let fields: ToolingCustomField[] = [];
  if (org['IsSandbox'] && org['TrialExpirationDate']) {
    // scratch org
    fields = (await conn.tooling
      .sobject('CustomField')
      .find(
        condition,
        'DeveloperName, Metadata'
      )) as unknown as ToolingCustomField[];
  } else {
    // Avoid error when including metadata field
    const ids = (
      await conn.tooling.sobject('CustomField').find(condition, 'Id')
    ).map((r) => r['Id']);
    for (const Id of ids) {
      fields = fields.concat(
        (await conn.tooling
          .sobject('CustomField')
          .find(
            { ...condition, Id },
            'DeveloperName, Metadata'
          )) as unknown as ToolingCustomField
      );
    }
  }

  return fields
    .filter((r) => !r.DeveloperName.endsWith('_del'))
    .map((r) => ({
      fullName: r.DeveloperName + '__c',
      ...r.Metadata,
    }));
}

export async function getCustomFieldMap(
  conn: Connection,
  object: string
): Promise<Map<string, CustomField>> {
  const fields = await getCustomFields(conn, object);
  return new Map(fields.map((f) => [f.fullName, f]));
}
