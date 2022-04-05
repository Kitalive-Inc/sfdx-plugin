import { Connection, MetadataInfo, SaveResult, UpsertResult } from 'jsforce';
import { chunk } from './utils';

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
  ).then((a) => a.flat());
}

export function deleteMetadata(
  conn: Connection,
  type: string,
  fullNames: string | string[]
): Promise<MetadataInfo[]> {
  return Promise.all(
    chunkMetadata(type, fullNames).map((data) =>
      conn.metadata.delete(type, data)
    )
  ).then((a) => a.flat());
}
