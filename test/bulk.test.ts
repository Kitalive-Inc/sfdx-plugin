import { EventEmitter } from 'node:events';
import { expect } from 'chai';
import { Connection } from '@salesforce/core';
import { bulkLoadStream, bulkQueryResults } from '../src/bulk.js';

async function* recordStream(ids: string[]) {
  for (const Id of ids) yield { Id };
}

describe('bulkLoadStream', () => {
  it('submits streamed records in batches without retaining successful results', async () => {
    const batches: { records: { Id: string }[] }[] = [];
    const job = {
      createBatch: () => {
        const batch = new EventEmitter() as EventEmitter & {
          check: () => Promise<{ state: string; stateMessage: string }>;
          execute: (records: { Id: string }[]) => void;
          poll: () => void;
        };
        batch.check = async () => ({ state: 'Queued', stateMessage: '' });
        batch.execute = (records) => {
          batches.push({ records });
          queueMicrotask(() => batch.emit('queue'));
        };
        batch.poll = () => undefined;
        return batch;
      },
      close: async () => ({ id: '750000000000001' }),
    };
    const conn = {
      bulk: { createJob: () => job },
    } as unknown as Connection;

    const result = await bulkLoadStream(
      conn,
      'Account',
      'delete',
      recordStream(['001', '002', '003']),
      { batchSize: 2, wait: 0 }
    );

    expect(batches.map((batch) => batch.records)).to.eql([
      [{ Id: '001' }, { Id: '002' }],
      [{ Id: '003' }],
    ]);
    expect(result).to.eql({
      job: { id: '750000000000001' },
      records: [],
    });
  });

  it('does not create a job for an empty stream', async () => {
    let createJobCalled = false;
    const conn = {
      bulk: {
        createJob: () => {
          createJobCalled = true;
          throw new Error('A job must not be created');
        },
      },
    } as unknown as Connection;

    const result = await bulkLoadStream(
      conn,
      'Account',
      'delete',
      recordStream([])
    );

    expect(createJobCalled).to.be.false;
    expect(result).to.be.undefined;
  });

  it('keeps only failed results when waiting for completion', async () => {
    const job = {
      createBatch: () => {
        const batch = new EventEmitter() as EventEmitter & {
          check: () => Promise<{ state: string; stateMessage: string }>;
          execute: (records: { Id: string }[]) => void;
          poll: () => void;
        };
        batch.check = async () => ({ state: 'Queued', stateMessage: '' });
        batch.execute = () => queueMicrotask(() => batch.emit('queue'));
        batch.poll = () => {
          queueMicrotask(() =>
            batch.emit('response', [
              { id: '001', success: true, created: false, errors: [] },
              {
                id: '002',
                success: false,
                created: false,
                errors: ['delete failed'],
              },
            ])
          );
        };
        return batch;
      },
      close: async () => ({ id: '750000000000001' }),
    };
    const conn = {
      bulk: { createJob: () => job },
    } as unknown as Connection;

    const result = await bulkLoadStream(
      conn,
      'Account',
      'delete',
      recordStream(['001', '002']),
      { wait: 1 }
    );

    expect(result?.records).to.eql([
      {
        id: '002',
        success: false,
        created: false,
        errors: ['delete failed'],
      },
    ]);
  });
});

describe('bulkQueryResults', () => {
  it('parses each Bulk API result page independently', async () => {
    const requests: string[] = [];
    const job = {
      id: '750000000000001',
      locator: undefined as string | undefined,
      createQueryRequest: ({ path }: { path: string }) => {
        requests.push(path);
        if (requests.length === 1) {
          return Promise.resolve().then(() => {
            job.locator = 'next page';
            return [{ Id: '001' }];
          });
        }
        return Promise.resolve().then(() => {
          job.locator = 'null';
          return [{ Id: '002' }];
        });
      },
    };

    const records = await bulkQueryResults(job);

    expect(records).to.eql([{ Id: '001' }, { Id: '002' }]);
    expect(requests).to.eql([
      '/750000000000001/results',
      '/750000000000001/results?locator=next%20page',
    ]);
  });
});
