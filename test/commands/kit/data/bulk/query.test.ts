import { expect } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSpinner } from '@salesforce/sf-plugins-core';
import Command from '../../../../../src/commands/kit/data/bulk/query.js';

describe('kit data bulk query', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const validQuery = 'SELECT Id, Name FROM Account';
  const duplicatedLabelsQuery =
    'SELECT Id, Name, Owner.Name, CreatedBy.Name FROM Account';
  const relationshipQuery = 'SELECT Id, Owner.Name, Owner.Email FROM Account';
  const emptyQuery = 'SELECT Id FROM Contact';
  const invalidQuery = 'invalid';

  let bulkQuery: any;
  let spinner: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    spinner = stubSpinner($$.SANDBOX);
    bulkQuery = $$.SANDBOX.stub(Command.prototype, 'bulkQuery').callsFake(
      (conn, query) => {
        switch (query) {
          case validQuery:
            return Promise.resolve([{ Id: 'id1', Name: 'name1' }]);
          case duplicatedLabelsQuery:
            return Promise.resolve([
              {
                Id: 'id1',
                Name: 'name1',
                'Owner.Name': 'owner1',
                'CreatedBy.Name': 'creator1',
              },
            ]);
          case relationshipQuery:
            return Promise.resolve([
              {
                Id: 'id1',
                'Owner.Name': 'user1',
                'Owner.Email': 'user1@example.com',
              },
            ]);
          case emptyQuery:
            return Promise.resolve([]);
          default:
            return Promise.reject(new Error('error message'));
        }
      }
    );
  });

  it('success', async () => {
    await Command.run(['-o', 'test@foo.bar', '-q', validQuery]);
    expect(bulkQuery.args[0][1]).to.eq(validQuery);
    expect(spinner.stop.args[0][0]).to.eq('1 records');
  });

  it('outputs object field labels', async () => {
    const writeCsv = $$.SANDBOX.stub(Command.prototype, 'writeCsv');
    $$.SANDBOX.stub(Command.prototype, 'getFieldLabels').resolves(
      new Map([
        ['Id', 'Account ID'],
        ['Name', 'Account Name'],
      ])
    );

    await Command.run([
      '-o',
      'test@foo.bar',
      '-q',
      validQuery,
      '--object-field-label',
    ]);
    expect(writeCsv.args[0][0]).to.eql([
      { 'Account ID': 'id1', 'Account Name': 'name1' },
    ]);
  });

  it('outputs field label mappings', async () => {
    const writeCsv = $$.SANDBOX.stub(Command.prototype, 'writeCsv');
    $$.SANDBOX.stub(Command.prototype, 'readFieldLabelMappings').returns({
      Id: 'Record ID',
    });

    await Command.run([
      '-o',
      'test@foo.bar',
      '-q',
      validQuery,
      '--field-label-mapping',
      'path/to/field-label-mapping.json',
    ]);
    expect(writeCsv.args[0][0]).to.eql([{ 'Record ID': 'id1', Name: 'name1' }]);
  });

  it('field label mappings override object field labels', async () => {
    const writeCsv = $$.SANDBOX.stub(Command.prototype, 'writeCsv');
    $$.SANDBOX.stub(Command.prototype, 'getFieldLabels').resolves(
      new Map([
        ['Id', 'Account ID'],
        ['Name', 'Custom Name'],
      ])
    );

    await Command.run([
      '-o',
      'test@foo.bar',
      '-q',
      validQuery,
      '--object-field-label',
      '--field-label-mapping',
      'path/to/field-label-mapping.json',
    ]);
    expect(writeCsv.args[0][0]).to.eql([
      { 'Account ID': 'id1', 'Custom Name': 'name1' },
    ]);
  });

  it('outputs json with field labels', async () => {
    $$.SANDBOX.stub(Command.prototype, 'getFieldLabels').resolves(
      new Map([['Id', 'Account ID']])
    );

    const result = await Command.run([
      '-o',
      'test@foo.bar',
      '-q',
      validQuery,
      '--field-label-mapping',
      'path/to/field-label-mapping.json',
      '--json',
    ]);
    expect(result).to.eql([{ 'Account ID': 'id1', Name: 'name1' }]);
  });

  it('rejects duplicated output field labels', async () => {
    $$.SANDBOX.stub(Command.prototype, 'getFieldLabels').resolves(
      new Map([
        ['Id', 'Same Label'],
        ['Name', 'Same Label'],
        ['Owner.Name', 'User'],
        ['CreatedBy.Name', 'User'],
      ])
    );

    try {
      await Command.run([
        '-o',
        'test@foo.bar',
        '-q',
        duplicatedLabelsQuery,
        '--field-label-mapping',
        'path/to/field-label-mapping.json',
      ]);
      expect.fail('No error occurred');
    } catch (e) {
      expect((e as Error).message).to.contain(
        'Duplicated output field names: Same Label (Id, Name); User (Owner.Name, CreatedBy.Name)'
      );
      expect(bulkQuery.called).to.be.false;
      expect(spinner.start.called).to.be.false;
    }
  });

  it('query file', async () => {
    const getQuery = $$.SANDBOX.stub(Command.prototype, 'getQuery').returns(
      validQuery
    );

    await Command.run([
      '-o',
      'test@foo.bar',
      '--query-file',
      'path/to/query.soql',
    ]);
    expect(getQuery.args[0]).to.eql([undefined, 'path/to/query.soql']);
    expect(bulkQuery.args[0][1]).to.eq(validQuery);
    expect(spinner.stop.args[0][0]).to.eq('1 records');
  });

  it('empty', async () => {
    await Command.run(['-o', 'test@foo.bar', '-q', emptyQuery]);
    expect(bulkQuery.args[0][1]).to.eq(emptyQuery);
    expect(spinner.stop.args[0][0]).to.eq('no records');
  });

  it('error', async () => {
    try {
      await Command.run(['-o', 'test@foo.bar', '-q', invalidQuery]);
      expect.fail('No error occurred');
    } catch (e) {
      expect(bulkQuery.args[0][1]).to.eq(invalidQuery);
      expect(spinner.stop.args[0][0]).to.eq('error');
    }
  });

  it('options', async () => {
    await Command.run([
      '-o',
      'test@foo.bar',
      '-q',
      validQuery,
      '-w',
      '10',
      '--all',
    ]);
    expect(bulkQuery.args[0][2]).to.eql({ all: true, wait: 10 });
    expect(spinner.stop.args[0][0]).to.eq('1 records');
  });

  it('requires either query or query-file', async () => {
    try {
      await Command.run(['-o', 'test@foo.bar']);
      expect.fail('No error occurred');
    } catch (e) {
      expect((e as Error).message).to.contain(
        'Exactly one of the following must be provided: --query, --query-file'
      );
    }
  });

  it('rejects query and query-file together', async () => {
    try {
      await Command.run([
        '-o',
        'test@foo.bar',
        '-q',
        validQuery,
        '--query-file',
        'path/to/query.soql',
      ]);
      expect.fail('No error occurred');
    } catch (e) {
      expect((e as Error).message).to.contain(
        '--query cannot also be provided when using --query-file'
      );
      expect((e as Error).message).to.contain(
        '--query-file cannot also be provided when using --query'
      );
    }
  });
});

describe('kit data bulk query field labels', () => {
  const command = Object.create(Command.prototype) as Command;
  const objectInfo = {
    fields: [
      { name: 'Id', label: 'Account ID' },
      { name: 'Name', label: 'Account Name' },
      { name: 'OwnerId', label: 'Owner ID', relationshipName: 'Owner' },
    ],
  };

  it('resolves object field labels', async () => {
    const labels = await command.getFieldLabels(
      { describe: async () => objectInfo } as any,
      'SELECT Id, Name FROM Account',
      true
    );
    expect([...labels.entries()]).to.eql([
      ['Id', 'Account ID'],
      ['Name', 'Account Name'],
    ]);
  });

  it('resolves relationship name labels only for relationship Name fields', async () => {
    const labels = await command.getFieldLabels(
      { describe: async () => objectInfo } as any,
      'SELECT Id, Owner.Name, Owner.Email FROM Account',
      true
    );
    expect([...labels.entries()]).to.eql([
      ['Id', 'Account ID'],
      ['Owner.Name', 'Owner'],
    ]);
  });

  it('overrides object field labels with field label mappings', async () => {
    const commandWithMappings = Object.assign(
      Object.create(Command.prototype),
      {
        readFieldLabelMappings: () => ({ Name: 'Custom Name' }),
      }
    ) as Command;
    const labels = await commandWithMappings.getFieldLabels(
      { describe: async () => objectInfo } as any,
      'SELECT Id, Name FROM Account',
      true,
      'path/to/field-label-mapping.json'
    );
    expect([...labels.entries()]).to.eql([
      ['Id', 'Account ID'],
      ['Name', 'Custom Name'],
    ]);
  });
});
