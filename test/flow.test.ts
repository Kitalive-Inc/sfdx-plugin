import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import fs from 'fs-extra';
import {
  deactivateFlows,
  deleteFlowVersions,
  emptyFlowXml,
  writeEmptyFlow,
} from '../src/flow.js';

describe('flow operations', () => {
  const $$ = new TestContext();

  it('deactivates an active flow definition', async () => {
    const update = $$.SANDBOX.stub().resolves({ success: true, errors: [] });
    const where = $$.SANDBOX.stub().resolves([
      {
        Id: '300000000000001',
        DeveloperName: 'Flow1',
        ActiveVersionId: '301000000000001',
      },
    ]);
    const conn = {
      tooling: {
        sobject: $$.SANDBOX.stub().returns({
          select: () => ({ where }),
          update,
        }),
      },
    } as any;

    const result = await deactivateFlows(conn, ['Flow1']);
    expect(
      update.calledWith({
        Id: '300000000000001',
        Metadata: { activeVersionNumber: 0 },
      })
    ).to.equal(true);
    expect(result).to.deep.equal([
      { name: 'Flow1', success: true, status: 'Inactive', error: undefined },
    ]);
  });

  it('deletes inactive versions and skips active versions', async () => {
    const destroy = $$.SANDBOX.stub().resolves({ success: true, errors: [] });
    const definitionWhere = $$.SANDBOX.stub().resolves([
      {
        Id: '300000000000001',
        DeveloperName: 'Flow1',
        ActiveVersionId: '301000000000002',
      },
    ]);
    const flowWhere = $$.SANDBOX.stub().resolves([
      {
        Id: '301000000000001',
        DefinitionId: '300000000000001',
        VersionNumber: 1,
        Status: 'Obsolete',
      },
      {
        Id: '301000000000002',
        DefinitionId: '300000000000001',
        VersionNumber: 2,
        Status: 'Active',
      },
    ]);
    const conn = {
      tooling: {
        sobject: $$.SANDBOX.stub().callsFake((type: string) => ({
          select: () => ({
            where: type === 'FlowDefinition' ? definitionWhere : flowWhere,
          }),
          destroy,
        })),
      },
    } as any;

    const result = await deleteFlowVersions(conn, ['Flow1'], 'inactive');
    expect(destroy.calledOnceWith('301000000000001')).to.equal(true);
    expect(result).to.have.length(2);
    expect(result[1].warning).to.equal('Active version was skipped');
  });

  it('returns an error when a flow definition is not found', async () => {
    const where = $$.SANDBOX.stub().resolves([]);
    const conn = {
      tooling: {
        sobject: $$.SANDBOX.stub().returns({
          select: () => ({ where }),
        }),
      },
    } as any;

    const result = await deactivateFlows(conn, ['MissingFlow']);
    expect(result).to.deep.equal([
      {
        name: 'MissingFlow',
        success: false,
        error: 'FlowDefinition was not found: MissingFlow',
      },
    ]);
  });

  it('generates a minimal draft Flow and escapes XML values', () => {
    const xml = emptyFlowXml({
      apiVersion: '67.0',
      label: 'Test & Flow',
      processType: 'Flow',
    });

    expect(xml).to.equal(`<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>67.0</apiVersion>
  <label>Test &amp; Flow</label>
  <processType>Flow</processType>
  <status>Draft</status>
</Flow>
`);
  });

  it('writes a Flow file and requires force to overwrite it', async () => {
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-flow-test-'));
    try {
      const options = {
        apiVersion: '67.0',
        label: 'Test',
        processType: 'Flow',
      };
      const result = await writeEmptyFlow(output, 'Test', options);
      expect(result.path).to.equal(path.join(output, 'Test.flow-meta.xml'));

      let error: unknown;
      try {
        await writeEmptyFlow(output, 'Test', options);
      } catch (caught) {
        error = caught;
      }
      expect((error as Error).message).to.include('already exists');

      await writeEmptyFlow(
        output,
        'Test',
        { ...options, label: 'Updated' },
        true
      );
      expect(await fs.readFile(result.path, 'utf8')).to.include(
        '<label>Updated</label>'
      );
    } finally {
      await fs.remove(output);
    }
  });

  it('keeps the latest inactive version when requested', async () => {
    const destroy = $$.SANDBOX.stub().resolves({ success: true, errors: [] });
    const definitionWhere = $$.SANDBOX.stub().resolves([
      {
        Id: '300000000000001',
        DeveloperName: 'Flow1',
        ActiveVersionId: null,
      },
    ]);
    const flowWhere = $$.SANDBOX.stub().resolves([
      {
        Id: '301000000000001',
        DefinitionId: '300000000000001',
        VersionNumber: 1,
        Status: 'Obsolete',
      },
      {
        Id: '301000000000002',
        DefinitionId: '300000000000001',
        VersionNumber: 2,
        Status: 'Draft',
      },
    ]);
    const conn = {
      tooling: {
        sobject: $$.SANDBOX.stub().callsFake((type: string) => ({
          select: () => ({
            where: type === 'FlowDefinition' ? definitionWhere : flowWhere,
          }),
          destroy,
        })),
      },
    } as any;

    const result = await deleteFlowVersions(conn, ['Flow1'], 'keep-latest');
    expect(destroy.calledOnceWith('301000000000001')).to.equal(true);
    expect(result[1]).to.deep.include({
      versionNumber: 2,
      success: true,
      warning: 'Latest version was skipped',
    });
  });

  it('deactivates an active Flow and deletes every version by default', async () => {
    const update = $$.SANDBOX.stub().resolves({ success: true, errors: [] });
    const destroy = $$.SANDBOX.stub().resolves({ success: true, errors: [] });
    const definitionWhere = $$.SANDBOX.stub().resolves([
      {
        Id: '300000000000001',
        DeveloperName: 'Flow1',
        ActiveVersionId: '301000000000002',
      },
    ]);
    const flowWhere = $$.SANDBOX.stub().resolves([
      {
        Id: '301000000000001',
        DefinitionId: '300000000000001',
        VersionNumber: 1,
        Status: 'Obsolete',
      },
      {
        Id: '301000000000002',
        DefinitionId: '300000000000001',
        VersionNumber: 2,
        Status: 'Active',
      },
    ]);
    const conn = {
      tooling: {
        sobject: $$.SANDBOX.stub().callsFake((type: string) => ({
          select: () => ({
            where: type === 'FlowDefinition' ? definitionWhere : flowWhere,
          }),
          update,
          destroy,
        })),
      },
    } as any;

    const result = await deleteFlowVersions(conn, ['Flow1']);
    expect(update.calledOnce).to.equal(true);
    expect(destroy.callCount).to.equal(2);
    expect(destroy.calledWith('301000000000001')).to.equal(true);
    expect(destroy.calledWith('301000000000002')).to.equal(true);
    expect(result.every((item) => item.success)).to.equal(true);
    expect(result.every((item) => !item.warning)).to.equal(true);
  });

  it('deactivates an older active version and keeps the latest version', async () => {
    const update = $$.SANDBOX.stub().resolves({ success: true, errors: [] });
    const destroy = $$.SANDBOX.stub().resolves({ success: true, errors: [] });
    const definitionWhere = $$.SANDBOX.stub().resolves([
      {
        Id: '300000000000001',
        DeveloperName: 'Flow1',
        ActiveVersionId: '301000000000002',
      },
    ]);
    const flowWhere = $$.SANDBOX.stub().resolves([
      {
        Id: '301000000000001',
        DefinitionId: '300000000000001',
        VersionNumber: 1,
        Status: 'Obsolete',
      },
      {
        Id: '301000000000002',
        DefinitionId: '300000000000001',
        VersionNumber: 2,
        Status: 'Active',
      },
      {
        Id: '301000000000003',
        DefinitionId: '300000000000001',
        VersionNumber: 3,
        Status: 'Draft',
      },
    ]);
    const conn = {
      tooling: {
        sobject: $$.SANDBOX.stub().callsFake((type: string) => ({
          select: () => ({
            where: type === 'FlowDefinition' ? definitionWhere : flowWhere,
          }),
          update,
          destroy,
        })),
      },
    } as any;

    const result = await deleteFlowVersions(conn, ['Flow1'], 'keep-latest');
    expect(update.calledOnce).to.equal(true);
    expect(destroy.callCount).to.equal(2);
    expect(destroy.calledWith('301000000000001')).to.equal(true);
    expect(destroy.calledWith('301000000000002')).to.equal(true);
    expect(destroy.calledWith('301000000000003')).to.equal(false);
    expect(result[2].warning).to.equal('Latest version was skipped');
  });
});
