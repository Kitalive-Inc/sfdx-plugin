// @ts-nocheck
import { expect } from 'chai';
import { Connection } from '@jsforce/jsforce-node';
import { TestContext } from '@salesforce/core/testSetup';
import * as metadata from '../src/metadata.js';
import { range } from '../src/utils.js';

describe('chunkMetadata', () => {
  it('CustomObject are chunked every 10', () => {
    const data = range(1, 22).map((n) => ({ fullName: `item${n}` }));
    const result = metadata.chunkMetadata('CustomObject', data);
    expect(result).to.eql([
      data.slice(0, 10),
      data.slice(10, 20),
      data.slice(20, 22),
    ]);
  });

  it('CustomMetadata are chunked every 200', () => {
    const data = range(1, 202).map((n) => ({ fullName: `item${n}` }));
    const result = metadata.chunkMetadata('CustomMetadata', data);
    expect(result).to.eql([data.slice(0, 200), data.slice(200, 202)]);
  });

  it('CustomApplication are chunked every 200', () => {
    const data = range(1, 202).map((n) => ({ fullName: `item${n}` }));
    const result = metadata.chunkMetadata('CustomApplication', data);
    expect(result).to.eql([data.slice(0, 200), data.slice(200, 202)]);
  });
});

describe('readMetadata', () => {
  const $$ = new TestContext();
  it('single object', async () => {
    const read = $$.SANDBOX.stub().callsFake((type, fullNames) =>
      Promise.resolve(fullNames.map((fullName) => ({ fullName })))
    );
    const conn = new Connection({});
    conn.metadata.read = read;
    const results = await metadata.readMetadata(
      conn,
      'CustomObject',
      'Object1'
    );
    expect(read.calledWith('CustomObject', ['Object1'])).to.be.true;
    expect(results).to.eql([{ fullName: 'Object1' }]);
  });

  it('11 objects', async () => {
    const read = $$.SANDBOX.stub().callsFake((type, metadata) =>
      Promise.resolve(metadata.map((fullName) => ({ fullName })))
    );
    const conn = new Connection({});
    conn.metadata.read = read;
    const data = range(1, 11).map((n) => `Object${n}`);
    const results = await metadata.readMetadata(conn, 'CustomObject', data);
    expect(read.callCount).to.eq(2);
    expect(read.calledWith('CustomObject', data.slice(0, 10))).to.be.true;
    expect(read.calledWith('CustomObject', data.slice(10, 11))).to.be.true;
    expect(results).to.eql(data.map((fullName) => ({ fullName })));
  });
});

describe('updateMetadata', () => {
  const $$ = new TestContext();
  it('single object', async () => {
    const update = $$.SANDBOX.stub().callsFake((type, metadata) =>
      Promise.resolve(
        metadata.map(({ fullName }) => ({ fullName, success: true }))
      )
    );
    const conn = new Connection({});
    conn.metadata.update = update;
    const results = await metadata.updateMetadata(conn, 'CustomObject', {
      fullName: 'Object1',
    });
    expect(update.calledWith('CustomObject', [{ fullName: 'Object1' }])).to.be
      .true;
    expect(results).to.eql([{ fullName: 'Object1', success: true }]);
  });

  it('12 objects', async () => {
    const update = $$.SANDBOX.stub().callsFake((type, metadata) =>
      Promise.resolve(
        metadata.map(({ fullName }) => ({ fullName, success: true }))
      )
    );
    const conn = new Connection({});
    conn.metadata.update = update;
    const data = range(1, 12).map((n) => ({ fullName: `Object${n}` }));
    const results = await metadata.updateMetadata(conn, 'CustomObject', data);
    expect(update.callCount).to.eq(2);
    expect(update.calledWith('CustomObject', data.slice(0, 10))).to.be.true;
    expect(update.calledWith('CustomObject', data.slice(10, 12))).to.be.true;
    expect(results).to.eql(
      data.map(({ fullName }) => ({ fullName, success: true }))
    );
  });
});

describe('upsertMetadata', () => {
  const $$ = new TestContext();
  it('12 objects', async () => {
    const upsert = $$.SANDBOX.stub().callsFake((type, metadata) =>
      Promise.resolve(
        metadata.map(({ fullName }) => ({ fullName, success: true }))
      )
    );
    const conn = new Connection({});
    conn.metadata.upsert = upsert;
    const data = range(1, 12).map((n) => ({ fullName: `Object${n}` }));
    const results = await metadata.upsertMetadata(conn, 'CustomObject', data);
    expect(upsert.callCount).to.eq(2);
    expect(upsert.calledWith('CustomObject', data.slice(0, 10))).to.be.true;
    expect(upsert.calledWith('CustomObject', data.slice(10, 12))).to.be.true;
    expect(results).to.eql(
      data.map(({ fullName }) => ({ fullName, success: true }))
    );
  });
});

describe('deleteMetadata', () => {
  const $$ = new TestContext();
  it('11 objects', async () => {
    const del = $$.SANDBOX.stub().callsFake((type, metadata) =>
      Promise.resolve(metadata.map((fullName) => ({ fullName, success: true })))
    );
    const conn = new Connection({});
    conn.metadata.delete = del;
    const data = range(1, 11).map((n) => `Object${n}`);
    const results = await metadata.deleteMetadata(conn, 'CustomObject', data);
    expect(del.callCount).to.eq(2);
    expect(del.calledWith('CustomObject', data.slice(0, 10))).to.be.true;
    expect(del.calledWith('CustomObject', data.slice(10, 11))).to.be.true;
    expect(results).to.eql(
      data.map((fullName) => ({ fullName, success: true }))
    );
  });
});
