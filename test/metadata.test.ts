import { Connection } from 'jsforce';
import * as metadata from '../src/metadata';
import { range } from '../src/utils';

describe('chunkMetadata', () => {
  it('CustomObject are chunked every 10', () => {
    const data = range(1, 22).map((n) => ({ fullName: `item${n}` }));
    const result = metadata.chunkMetadata('CustomObject', data);
    expect(result).toEqual([
      data.slice(0, 10),
      data.slice(10, 20),
      data.slice(20, 22),
    ]);
  });

  it('CustomMetadata are chunked every 200', () => {
    const data = range(1, 202).map((n) => ({ fullName: `item${n}` }));
    const result = metadata.chunkMetadata('CustomMetadata', data);
    expect(result).toEqual([data.slice(0, 200), data.slice(200, 202)]);
  });

  it('CustomApplication are chunked every 200', () => {
    const data = range(1, 202).map((n) => ({ fullName: `item${n}` }));
    const result = metadata.chunkMetadata('CustomApplication', data);
    expect(result).toEqual([data.slice(0, 200), data.slice(200, 202)]);
  });
});

describe('readMetadata', () => {
  it('single object', async () => {
    const read = jest.fn((type, fullNames, callback) =>
      Promise.resolve(fullNames.map((fullName) => ({ fullName })))
    );
    const conn = new Connection({});
    conn.metadata.read = read;
    const results = await metadata.readMetadata(
      conn,
      'CustomObject',
      'Object1'
    );
    expect(read).toHaveBeenCalledWith('CustomObject', ['Object1']);
    expect(results).toEqual([{ fullName: 'Object1' }]);
  });

  it('11 objects', async () => {
    const read = jest.fn((type, metadata, callback) =>
      Promise.resolve(metadata.map((fullName) => ({ fullName })))
    );
    const conn = new Connection({});
    conn.metadata.read = read;
    const data = range(1, 11).map((n) => `Object${n}`);
    const results = await metadata.readMetadata(conn, 'CustomObject', data);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledWith('CustomObject', data.slice(0, 10));
    expect(read).toHaveBeenCalledWith('CustomObject', data.slice(10, 11));
    expect(results).toEqual(data.map((fullName) => ({ fullName })));
  });
});

describe('updateMetadata', () => {
  it('single object', async () => {
    const update = jest.fn((type, metadata, callback) =>
      Promise.resolve(
        metadata.map(({ fullName }) => ({ fullName, success: true }))
      )
    );
    const conn = new Connection({});
    conn.metadata.update = update;
    const results = await metadata.updateMetadata(conn, 'CustomObject', {
      fullName: 'Object1',
    });
    expect(update).toHaveBeenCalledWith('CustomObject', [
      { fullName: 'Object1' },
    ]);
    expect(results).toEqual([{ fullName: 'Object1', success: true }]);
  });

  it('12 objects', async () => {
    const update = jest.fn((type, metadata, callback) =>
      Promise.resolve(
        metadata.map(({ fullName }) => ({ fullName, success: true }))
      )
    );
    const conn = new Connection({});
    conn.metadata.update = update;
    const data = range(1, 12).map((n) => ({ fullName: `Object${n}` }));
    const results = await metadata.updateMetadata(conn, 'CustomObject', data);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith('CustomObject', data.slice(0, 10));
    expect(update).toHaveBeenCalledWith('CustomObject', data.slice(10, 12));
    expect(results).toEqual(
      data.map(({ fullName }) => ({ fullName, success: true }))
    );
  });
});

describe('upsertMetadata', () => {
  it('12 objects', async () => {
    const upsert = jest.fn((type, metadata, callback) =>
      Promise.resolve(
        metadata.map(({ fullName }) => ({ fullName, success: true }))
      )
    );
    const conn = new Connection({});
    conn.metadata.upsert = upsert;
    const data = range(1, 12).map((n) => ({ fullName: `Object${n}` }));
    const results = await metadata.upsertMetadata(conn, 'CustomObject', data);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith('CustomObject', data.slice(0, 10));
    expect(upsert).toHaveBeenCalledWith('CustomObject', data.slice(10, 12));
    expect(results).toEqual(
      data.map(({ fullName }) => ({ fullName, success: true }))
    );
  });
});

describe('deleteMetadata', () => {
  it('11 objects', async () => {
    const del = jest.fn((type, metadata, callback) =>
      Promise.resolve(metadata.map((fullName) => ({ fullName })))
    );
    const conn = new Connection({});
    conn.metadata.delete = del;
    const data = range(1, 11).map((n) => `Object${n}`);
    const results = await metadata.deleteMetadata(conn, 'CustomObject', data);
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith('CustomObject', data.slice(0, 10));
    expect(del).toHaveBeenCalledWith('CustomObject', data.slice(10, 11));
    expect(results).toEqual(data.map((fullName) => ({ fullName })));
  });
});
