import os from 'node:os';
import path from 'node:path';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import fs from 'fs-extra';
import FlowGenerate from '../../../../src/commands/kit/flow/generate.js';

describe('kit flow generate', () => {
  const $$ = new TestContext();

  beforeEach(() => stubSfCommandUx($$.SANDBOX));

  it('generates a Flow without a project or org', async () => {
    const output = await fs.mkdtemp(
      path.join(os.tmpdir(), 'kit-flow-command-')
    );
    try {
      const result = await FlowGenerate.run([
        '--name',
        'Test',
        '--label',
        'Test Flow',
        '--process-type',
        'Flow',
        '--api-version',
        '67.0',
        '--output-dir',
        output,
      ]);

      expect(result).to.deep.equal({
        name: 'Test',
        path: path.join(output, 'Test.flow-meta.xml'),
        apiVersion: '67.0',
        label: 'Test Flow',
        processType: 'Flow',
      });
      expect(await fs.readFile(result.path, 'utf8')).to.include(
        '<status>Draft</status>'
      );
    } finally {
      await fs.remove(output);
    }
  });
});
