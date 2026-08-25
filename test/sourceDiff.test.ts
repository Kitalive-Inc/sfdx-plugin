import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import fs from 'fs-extra';
import {
  generateSourceDiff,
  normalizeSourceContent,
} from '../src/sourceDiff.js';

const fieldPath =
  'force-app/main/default/objects/Account/fields/Value__c.field-meta.xml';
const baseField = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Value__c</fullName>
    <description>base description</description>
    <label>Value</label>
    <type>Text</type>
    <length>80</length>
</CustomField>
`;

describe('source diff', () => {
  let root: string;
  const retainedWorktrees: string[] = [];

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-source-diff-test-'));
    await fs.outputJson(path.join(root, 'sfdx-project.json'), {
      packageDirectories: [{ path: 'force-app', default: true }],
      sourceApiVersion: '66.0',
    });
    await fs.outputFile(path.join(root, fieldPath), baseField);
    await fs.outputFile(
      path.join(root, 'manifest/package.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types><members>Account.Value__c</members><name>CustomField</name></types>
  <version>66.0</version>
</Package>
`
    );
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], {
      cwd: root,
    });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });
  });

  afterEach(async () => {
    for (const worktree of retainedWorktrees.splice(0)) {
      try {
        execFileSync('git', ['worktree', 'remove', '--force', worktree], {
          cwd: root,
        });
      } catch {
        // The test may have removed it already.
      }
      await fs.remove(path.dirname(worktree));
    }
    await fs.remove(root);
  });

  it('retains a worktree when retrieved metadata differs from base', async () => {
    const result = await generateSourceDiff({
      root,
      base: 'HEAD',
      targetOrg: 'test-org',
      connection: {} as never,
      manifest: 'manifest/package.xml',
      retrieve: async ({ outputDirectory }) => {
        await fs.outputFile(
          path.join(
            outputDirectory,
            'main/default/objects/Account/fields/Value__c.field-meta.xml'
          ),
          baseField.replace('<label>Value</label>', '<label>Org Value</label>')
        );
        return {
          retrieved: new Set(['CustomField#Account.Value__c']),
          warnings: [],
        };
      },
    });

    expect(result.hasDifferences).to.equal(true);
    expect(result.components).to.deep.include({
      type: 'CustomField',
      fullName: 'Account.Value__c',
      status: 'modified',
    });
    expect(result.worktreeRetained).to.equal(true);
    retainedWorktrees.push(result.worktreePath!);
    expect(
      await fs.readFile(path.join(result.worktreePath!, fieldPath), 'utf8')
    ).to.include('Org Value');
    expect(
      result.instructions.some((item) => item.includes('apply --3way'))
    ).to.equal(true);
  });

  it('removes a worktree when only formatting and ignored elements differ', async () => {
    const result = await generateSourceDiff({
      root,
      base: 'HEAD',
      targetOrg: 'test-org',
      connection: {} as never,
      manifest: 'manifest/package.xml',
      ignoreElements: ['CustomField:description'],
      retrieve: async ({ outputDirectory }) => {
        await fs.outputFile(
          path.join(
            outputDirectory,
            'main/default/objects/Account/fields/Value__c.field-meta.xml'
          ),
          baseField
            .replaceAll('\n', '\r\n')
            .replace('base description', 'server description')
            .replace('    <label>', '<label>')
        );
        return {
          retrieved: new Set(['CustomField#Account.Value__c']),
          warnings: [],
        };
      },
    });

    expect(result.hasDifferences).to.equal(false);
    expect(result.counts.unchanged).to.equal(1);
    expect(result.worktreeRetained).to.equal(false);
    expect(result.worktreePath).to.equal(undefined);
  });

  it('represents metadata missing from the retrieve result as deleted', async () => {
    const result = await generateSourceDiff({
      root,
      base: 'HEAD',
      targetOrg: 'test-org',
      connection: {} as never,
      manifest: 'manifest/package.xml',
      retrieve: async () => ({
        retrieved: new Set(),
        warnings: ['CustomField Account.Value__c was not found'],
      }),
    });

    expect(result.counts.deleted).to.equal(1);
    expect(result.warnings).to.deep.equal([
      'CustomField Account.Value__c was not found',
    ]);
    retainedWorktrees.push(result.worktreePath!);
    expect(
      await fs.pathExists(path.join(result.worktreePath!, fieldPath))
    ).to.equal(false);
  });

  it('uses only components found under source-dir at base', async () => {
    const progress: string[] = [];
    const result = await generateSourceDiff({
      root,
      base: 'HEAD',
      targetOrg: 'test-org',
      connection: {} as never,
      sourceDirectories: ['force-app/main/default/objects/Account'],
      retrieve: async () => ({
        retrieved: new Set(['CustomField#Account.Value__c']),
        warnings: [],
      }),
      onProgress: ({ message }) => progress.push(message),
    });

    expect(result.components).to.deep.equal([
      {
        type: 'CustomField',
        fullName: 'Account.Value__c',
        status: 'unchanged',
      },
    ]);
    expect(result.worktreeRetained).to.equal(false);
    expect(progress).to.include('Resolved 1 base components.');
    expect(progress).to.include(
      'Comparing 0 changed components (0 changed files)...'
    );
    expect(progress.at(-1)).to.equal('Removing temporary worktree...');
  });

  it('detects components added in the org for wildcard manifest members', async () => {
    await fs.outputFile(
      path.join(root, 'manifest/wildcard.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types><members>*</members><name>CustomField</name></types>
  <version>66.0</version>
</Package>
`
    );
    const result = await generateSourceDiff({
      root,
      base: 'HEAD',
      targetOrg: 'test-org',
      connection: {} as never,
      manifest: 'manifest/wildcard.xml',
      retrieve: async ({ outputDirectory }) => {
        await fs.outputFile(
          path.join(
            outputDirectory,
            'main/default/objects/Account/fields/Added__c.field-meta.xml'
          ),
          baseField
            .replaceAll('Value__c', 'Added__c')
            .replaceAll('Value', 'Added')
        );
        return {
          retrieved: new Set([
            'CustomField#Account.Value__c',
            'CustomField#Account.Added__c',
          ]),
          warnings: [],
        };
      },
    });

    expect(result.components).to.deep.include({
      type: 'CustomField',
      fullName: 'Account.Added__c',
      status: 'added',
    });
    retainedWorktrees.push(result.worktreePath!);
  });

  it('removes formatting-only files from a retained worktree', async () => {
    const noisePath =
      'force-app/main/default/objects/Account/fields/Noise__c.field-meta.xml';
    const noiseField = baseField
      .replace('Value__c', 'Noise__c')
      .replace('<label>Value</label>', '<label>Noise</label>');
    await fs.outputFile(path.join(root, noisePath), noiseField);
    await fs.outputFile(
      path.join(root, 'manifest/package.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>Account.Value__c</members>
    <members>Account.Noise__c</members>
    <name>CustomField</name>
  </types>
  <version>66.0</version>
</Package>
`
    );
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'add noise field'], { cwd: root });
    const progress: string[] = [];
    const result = await generateSourceDiff({
      root,
      base: 'HEAD',
      targetOrg: 'test-org',
      connection: {} as never,
      manifest: 'manifest/package.xml',
      retrieve: async ({ outputDirectory }) => {
        await fs.outputFile(
          path.join(outputDirectory, 'main/default', fieldPath.slice(23)),
          baseField.replace('<label>Value</label>', '<label>Org Value</label>')
        );
        await fs.outputFile(
          path.join(outputDirectory, 'main/default', noisePath.slice(23)),
          noiseField
            .replace(
              '<?xml version="1.0" encoding="UTF-8"?>',
              "<?xml version='1.0' encoding='UTF-8'?>"
            )
            .trimEnd()
        );
        return {
          retrieved: new Set([
            'CustomField#Account.Value__c',
            'CustomField#Account.Noise__c',
          ]),
          warnings: [],
        };
      },
      onProgress: ({ message }) => progress.push(message),
    });

    retainedWorktrees.push(result.worktreePath!);
    const changedFiles = execFileSync('git', ['diff', '--name-only'], {
      cwd: result.worktreePath,
      encoding: 'utf8',
    })
      .trim()
      .split('\n');
    expect(changedFiles).to.deep.equal([fieldPath]);
    expect(
      progress.some((message) =>
        message.startsWith('Discarding 1 formatting-only file changes')
      )
    ).to.equal(true);
  });

  it('normalizes XML declarations, indentation, and attribute order', () => {
    const left = normalizeSourceContent(
      'field.xml',
      Buffer.from('<?xml version="1.0"?><A x="1" y="2"><B>v</B></A>'),
      'CustomField'
    );
    const right = normalizeSourceContent(
      'field.xml',
      Buffer.from('<A y="2" x="1">\n  <B>v</B>\n</A>\n'),
      'CustomField'
    );
    expect(left.equals(right)).to.equal(true);
  });
});
