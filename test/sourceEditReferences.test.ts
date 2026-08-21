import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import fs from 'fs-extra';
import { editSourceReferences } from '../src/sourceDelta.js';

const packageXml = (
  members: string,
  type: string
) => `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>${members}</members>
    <name>${type}</name>
  </types>
  <version>66.0</version>
</Package>
`;

describe('source edit references', () => {
  let root: string;
  const fieldPath =
    'force-app/main/default/objects/Line__c/fields/Value__c.field-meta.xml';
  const flexiPath =
    'force-app/main/default/flexipages/Account.flexipage-meta.xml';
  const summaryPath =
    'force-app/main/default/objects/Account/fields/Total__c.field-meta.xml';
  const layoutPath =
    'force-app/main/default/layouts/Account-Account Layout.layout-meta.xml';

  beforeEach(async () => {
    root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'kit-source-edit-references-test-')
    );
    await fs.outputJson(path.join(root, 'sfdx-project.json'), {
      packageDirectories: [{ path: 'force-app', default: true }],
      sourceApiVersion: '66.0',
    });
    await fs.outputFile(path.join(root, '.forceignore'), 'ignored/**\n');
    await fs.outputFile(
      path.join(root, fieldPath),
      `<?xml version="1.0"?><CustomField xmlns="http://soap.sforce.com/2006/04/metadata"><fullName>Value__c</fullName><label>Value</label><type>Text</type><length>80</length></CustomField>\n`
    );
    await fs.outputFile(
      path.join(root, flexiPath),
      `<?xml version="1.0"?><FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
  <itemInstances><fieldInstance><fieldItem>Record.Value__c</fieldItem></fieldInstance></itemInstances>
  <masterLabel>Account</masterLabel>
</FlexiPage>\n`
    );
    await fs.outputFile(
      path.join(root, summaryPath),
      `<?xml version="1.0"?><CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>Total__c</fullName>
  <label>Total</label>
  <summarizedField>Line__c.Value__c</summarizedField>
  <summaryForeignKey>Line__c.Account__c</summaryForeignKey>
  <summaryOperation>sum</summaryOperation>
  <type>Summary</type>
</CustomField>\n`
    );
    await fs.outputFile(
      path.join(root, layoutPath),
      `<?xml version="1.0"?><Layout xmlns="http://soap.sforce.com/2006/04/metadata"><layoutSections /></Layout>\n`
    );
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], {
      cwd: root,
    });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'before'], { cwd: root });
    await fs.outputFile(
      path.join(root, fieldPath),
      `<?xml version="1.0"?><CustomField xmlns="http://soap.sforce.com/2006/04/metadata"><fullName>Value__c</fullName><label>Value</label><type>Text</type><formula>&quot;&quot;</formula></CustomField>\n`
    );
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'after'], { cwd: root });

    await fs.outputFile(
      path.join(root, 'output/deploy/package.xml'),
      packageXml('Line__c.Value__c', 'CustomField')
    );
    await fs.outputFile(
      path.join(root, 'output/deploy/destructiveChangesPre.xml'),
      packageXml('Line__c.Value__c', 'CustomField')
    );
    await fs.outputFile(
      path.join(root, 'output/preDeploy/destructiveChangesPost.xml'),
      packageXml('Account.Total__c', 'CustomField')
    );
  });

  afterEach(async () => fs.remove(root));

  it('adds explicitly selected metadata and converts rollups to count', async () => {
    const result = await editSourceReferences({
      root,
      packageDirectories: [{ path: 'force-app', default: true }],
      from: 'HEAD~1',
      fields: ['Line__c.Value__c'],
      paths: [flexiPath, summaryPath, layoutPath],
      outputDirectory: path.join(root, 'output'),
      targetOrg: 'production',
      apiVersion: '66.0',
    });

    const flexi = await fs.readFile(
      path.join(root, 'output/preDeploy', flexiPath),
      'utf8'
    );
    expect(flexi).not.to.include('<itemInstances>');
    const summary = await fs.readFile(
      path.join(root, 'output/preDeploy', summaryPath),
      'utf8'
    );
    expect(summary).not.to.include('<summarizedField>');
    expect(summary).to.include('<summaryOperation>count</summaryOperation>');
    expect(
      await fs.pathExists(
        path.join(root, 'output/preDeploy/destructiveChangesPost.xml')
      )
    ).to.equal(false);
    const prePackage = await fs.readFile(
      path.join(root, 'output/preDeploy/package.xml'),
      'utf8'
    );
    expect(prePackage).to.include('<members>Account</members>');
    expect(prePackage).to.include('<members>Account.Total__c</members>');
    expect(prePackage).to.include('<members>Account-Account Layout</members>');
    const deployPackage = await fs.readFile(
      path.join(root, 'output/deploy/package.xml'),
      'utf8'
    );
    expect(deployPackage).to.include('<members>Account</members>');
    expect(deployPackage).to.include('<members>Account.Total__c</members>');
    expect(result.warnings).to.include(
      `Reference could not be edited automatically: ${layoutPath}`
    );
    expect(result.manualReview).to.deep.include({
      path: layoutPath,
      reason: 'Field references must be edited manually',
    });
    expect(
      await fs.readFile(path.join(root, 'output/preDeploy', layoutPath), 'utf8')
    ).to.include('<layoutSections />');
    const instructions = await fs.readFile(
      result.deploymentInstructions,
      'utf8'
    );
    expect(instructions).to.include('--target-org "production"');
    expect(instructions).to.include('Remove field references');
  });

  it('does not overwrite an existing pre-deploy file without force', async () => {
    await fs.outputFile(
      path.join(root, 'output/preDeploy', flexiPath),
      'manual'
    );

    let error: unknown;
    try {
      await editSourceReferences({
        root,
        packageDirectories: [{ path: 'force-app' }],
        from: 'HEAD~1',
        fields: ['Line__c.Value__c'],
        paths: [flexiPath],
        outputDirectory: path.join(root, 'output'),
      });
    } catch (caught) {
      error = caught;
    }

    expect((error as Error).message).to.include('Use --force to replace it');
    expect(
      await fs.readFile(path.join(root, 'output/preDeploy', flexiPath), 'utf8')
    ).to.equal('manual');
  });

  it('replaces an explicitly selected pre-deploy file with force', async () => {
    await fs.outputFile(
      path.join(root, 'output/preDeploy', flexiPath),
      'manual'
    );

    const result = await editSourceReferences({
      root,
      packageDirectories: [{ path: 'force-app' }],
      from: 'HEAD~1',
      fields: ['Line__c.Value__c'],
      paths: [flexiPath],
      outputDirectory: path.join(root, 'output'),
      force: true,
    });

    expect(result.paths).to.deep.equal([{ path: flexiPath, changed: true }]);
    expect(
      await fs.readFile(path.join(root, 'output/preDeploy', flexiPath), 'utf8')
    ).not.to.include('<itemInstances>');
  });

  it('edits source from the revision when the metadata is deleted at HEAD', async () => {
    execFileSync('git', ['rm', '-q', flexiPath], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'delete flexipage'], { cwd: root });
    await fs.outputFile(
      path.join(root, 'output/deploy/destructiveChangesPost.xml'),
      packageXml('Account', 'FlexiPage')
    );

    const result = await editSourceReferences({
      root,
      packageDirectories: [{ path: 'force-app' }],
      from: 'HEAD~2',
      fields: ['Line__c.Value__c'],
      paths: [flexiPath],
      outputDirectory: path.join(root, 'output'),
    });

    expect(result.paths).to.deep.equal([{ path: flexiPath, changed: true }]);
    expect(
      await fs.readFile(path.join(root, 'output/preDeploy', flexiPath), 'utf8')
    ).not.to.include('<itemInstances>');
    const deployPackage = await fs.readFile(
      path.join(root, 'output/deploy/package.xml'),
      'utf8'
    );
    expect(deployPackage).not.to.include('<name>FlexiPage</name>');
    expect(result.manifests.postDestructive).to.equal(
      path.join(root, 'output/deploy/destructiveChangesPost.xml')
    );
  });

  it('rejects metadata absent from HEAD unless it is scheduled for deletion', async () => {
    execFileSync('git', ['rm', '-q', flexiPath], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'delete flexipage'], { cwd: root });

    let error: unknown;
    try {
      await editSourceReferences({
        root,
        packageDirectories: [{ path: 'force-app' }],
        from: 'HEAD~2',
        fields: ['Line__c.Value__c'],
        paths: [flexiPath],
        outputDirectory: path.join(root, 'output'),
      });
    } catch (caught) {
      error = caught;
    }

    expect((error as Error).message).to.include(
      'Metadata was not found at HEAD and is not in deploy/destructiveChangesPost.xml'
    );
  });

  it('rejects fields outside the generated pre-destructive manifest', async () => {
    let error: unknown;
    try {
      await editSourceReferences({
        root,
        packageDirectories: [{ path: 'force-app' }],
        from: 'HEAD~1',
        fields: ['Line__c.Other__c'],
        paths: [flexiPath],
        outputDirectory: path.join(root, 'output'),
      });
    } catch (caught) {
      error = caught;
    }

    expect((error as Error).message).to.include(
      'CustomField is not in deploy/destructiveChangesPre.xml'
    );
  });
});
