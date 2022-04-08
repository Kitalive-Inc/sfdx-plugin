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

export async function getCustomFieldNames(
  conn: Connection,
  object: string
): Promise<string[]> {
  const escapedObject = object.replace(/'/g, "\\'");
  const { records } = await conn.tooling.query(
    `SELECT FullName FROM CustomField WHERE EntityDefinition.QualifiedApiName='${escapedObject}'`
  );
  return records
    .map((r) => r['FullName'])
    .filter((n) => !n.endsWith('_del__c'));
}

export async function getCustomFields(
  conn: Connection,
  object: string
): Promise<CustomField[]> {
  const fullNames = await getCustomFieldNames(conn, object);
  const results: CustomField[] = await readMetadata(
    conn,
    'CustomField',
    fullNames
  );
  for (const result of results) {
    result.fullName = result.fullName.slice(object.length + 1);
  }
  return results;
}
