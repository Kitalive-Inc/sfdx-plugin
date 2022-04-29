import { JsonMap } from '@salesforce/ts-types';
import {
  Connection,
  MetadataInfo,
  SaveResult,
  UpsertResult as JsforceUpsertResult,
} from 'jsforce';
import { chunk } from './utils';
import { CustomField } from './types';

interface UpsertResult extends JsforceUpsertResult {
  errors: { message: string };
}

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

export function chunkMetadata<T>(type: string, metadata: T | T[]): Array<T[]> {
  // metadata limit: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_createMetadata.htm
  const size =
    type === 'CustomMetadata' || type === 'CustomApplication' ? 200 : 10;
  return chunk(Array.isArray(metadata) ? metadata : [metadata], size);
}

export function readMetadata(
  conn: Connection,
  type: string,
  fullNames: string | string[]
): Promise<MetadataInfo[]> {
  return Promise.all(
    chunkMetadata(type, fullNames).map((data) => conn.metadata.read(type, data))
  ).then((a) => a.flat());
}

export function updateMetadata(
  conn: Connection,
  type: string,
  metadata: MetadataInfo | MetadataInfo[]
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
  metadata: MetadataInfo | MetadataInfo[]
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

export async function getCustomFields(
  conn: Connection,
  object: string
): Promise<CustomField[]> {
  let namespace;
  const parts = object.split('__');
  if (object.endsWith('__c')) {
    if (parts.length == 3) {
      namespace = parts[0];
    } else if (parts.length == 2) {
      namespace = await getOrgNamespace(conn);
      if (namespace) object = `${namespace}__${object}`;
    }
  }

  const { records } = await conn.tooling.query(
    `SELECT DeveloperName, Metadata FROM CustomField WHERE EntityDefinition.QualifiedApiName='${object}' AND ManageableState = 'unmanaged'`
  );
  return (records as Array<{ DeveloperName: string; Metadata: JsonMap }>)
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
