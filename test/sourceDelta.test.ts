import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import fs from 'fs-extra';
import { generateSourceDelta } from '../src/sourceDelta.js';

const fieldBefore = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Value__c</fullName>
    <label>Value</label>
    <type>Text</type>
    <length>80</length>
</CustomField>
`;

const fieldAfter = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Value__c</fullName>
    <label>Value</label>
    <type>Text</type>
    <formula>Account.Name</formula>
</CustomField>
`;

type DependencyRow = {
  MetadataComponentId: string;
  MetadataComponentType: string;
  RefMetadataComponentId: string;
};

function sourceDeltaConnection(
  metadataList: (query: { type: string }) => Promise<any[]> = async () => [],
  dependencies: DependencyRow[] = [],
  onToolingQuery?: (type: string, where: Record<string, unknown>) => void
): any {
  return {
    metadata: { list: metadataList },
    tooling: {
      sobject: (type: string) => ({
        select: () => ({
          where: async (where: Record<string, unknown>) => {
            onToolingQuery?.(type, where);
            if (type === 'EntityDefinition')
              return [{ DurableId: 'Account', QualifiedApiName: 'Account' }];
            if (type === 'FieldDefinition')
              return [
                {
                  DurableId: 'Account.00N000000000001',
                  EntityDefinitionId: 'Account',
                  NamespacePrefix: null,
                  QualifiedApiName: 'Value__c',
                },
              ];
            if (type === 'CustomField')
              return [
                {
                  Id: '00N000000000001',
                  DeveloperName: 'Value',
                  NamespacePrefix: null,
                  TableEnumOrId: 'Account',
                },
              ];
            if (type === 'MetadataComponentDependency') return dependencies;
            return [];
          },
        }),
      }),
    },
  };
}

describe('source delta', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kit-source-delta-test-'));
    await fs.outputJson(path.join(root, 'sfdx-project.json'), {
      packageDirectories: [{ path: 'force-app', default: true }],
      sourceApiVersion: '66.0',
    });
    await fs.outputFile(path.join(root, '.forceignore'), 'ignored/**\n');
    await fs.outputFile(
      path.join(
        root,
        'force-app/main/default/objects/Account/fields/Value__c.field-meta.xml'
      ),
      fieldBefore
    );
    await fs.outputFile(
      path.join(root, 'force-app/main/default/classes/UsesValue.cls'),
      'public class UsesValue {\n  public String value() {\n    return String.valueOf(Account.Value__c);\n  }\n}\n'
    );
    await fs.outputFile(
      path.join(root, 'force-app/main/default/classes/UsesValue.cls-meta.xml'),
      '<?xml version="1.0"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>66.0</apiVersion><status>Active</status></ApexClass>\n'
    );
    await fs.outputFile(
      path.join(root, 'force-app/main/default/classes/Unrelated.cls'),
      "public class Unrelated {\n  String Value__c = 'not a field reference';\n}\n"
    );
    await fs.outputFile(
      path.join(root, 'force-app/main/default/classes/Unrelated.cls-meta.xml'),
      '<?xml version="1.0"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>66.0</apiVersion><status>Active</status></ApexClass>\n'
    );
    await fs.outputFile(
      path.join(root, 'force-app/main/default/triggers/UsesValue.trigger'),
      'trigger UsesValue on Account (before insert) {\n  Schema.SObjectField field = Account.Value__c;\n}\n'
    );
    await fs.outputFile(
      path.join(
        root,
        'force-app/main/default/triggers/UsesValue.trigger-meta.xml'
      ),
      '<?xml version="1.0"?><ApexTrigger xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>66.0</apiVersion><status>Active</status></ApexTrigger>\n'
    );
    await fs.outputFile(
      path.join(
        root,
        'force-app/main/default/flexipages/Account.flexipage-meta.xml'
      ),
      `<?xml version="1.0"?><FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
  <itemInstances><fieldInstance><fieldItem>Record.Value__c</fieldItem></fieldInstance></itemInstances>
  <masterLabel>Account</masterLabel>
</FlexiPage>\n`
    );
    await fs.outputFile(
      path.join(
        root,
        'force-app/main/default/layouts/Account-Account Layout.layout-meta.xml'
      ),
      `<?xml version="1.0"?><Layout xmlns="http://soap.sforce.com/2006/04/metadata"><layoutSections><layoutColumns><layoutItems><field>Value__c</field></layoutItems></layoutColumns></layoutSections></Layout>\n`
    );
    await fs.outputFile(
      path.join(root, 'force-app/main/default/flows/UsesValue.flow-meta.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>66.0</apiVersion>
  <label>Uses Value</label>
  <processType>AutoLaunchedFlow</processType>
  <recordLookups>
    <name>Account</name>
    <filters><field>Value__c</field></filters>
    <object>Account</object>
  </recordLookups>
  <status>Active</status>
</Flow>\n`
    );
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], {
      cwd: root,
    });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'before'], { cwd: root });
    await fs.outputFile(
      path.join(
        root,
        'force-app/main/default/objects/Account/fields/Value__c.field-meta.xml'
      ),
      fieldAfter
    );
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'after'], { cwd: root });
  });

  afterEach(async () => fs.remove(root));

  it('rejects an existing output directory unless force is specified', async () => {
    const outputDirectory = path.join(root, 'output');
    const marker = path.join(outputDirectory, 'old-result.txt');
    await fs.outputFile(marker, 'old');

    let error: unknown;
    try {
      await generateSourceDelta({
        root,
        packageDirectories: [{ path: 'force-app' }],
        from: 'HEAD~1',
        outputDirectory,
        apiVersion: '66.0',
      });
    } catch (caught) {
      error = caught;
    }

    expect((error as Error).message).to.include(
      'Output directory already exists'
    );
    expect(await fs.pathExists(marker)).to.equal(true);
  });

  it('recreates an existing output directory when force is specified', async () => {
    const outputDirectory = path.join(root, 'output');
    const marker = path.join(outputDirectory, 'old-result.txt');
    await fs.outputFile(marker, 'old');
    const connection = sourceDeltaConnection();

    const result = await generateSourceDelta({
      root,
      packageDirectories: [{ path: 'force-app' }],
      from: 'HEAD~1',
      outputDirectory,
      apiVersion: '66.0',
      force: true,
      connection,
    });

    expect(await fs.pathExists(marker)).to.equal(false);
    expect(await fs.pathExists(result.manifests.package)).to.equal(true);
  });

  it('does not allow the project root to be used as the output directory', async () => {
    let error: unknown;
    try {
      await generateSourceDelta({
        root,
        packageDirectories: [{ path: 'force-app' }],
        from: 'HEAD~1',
        outputDirectory: root,
        apiVersion: '66.0',
        force: true,
      });
    } catch (caught) {
      error = caught;
    }

    expect((error as Error).message).to.equal(
      'The output directory must be a subdirectory of the Salesforce project'
    );
    expect(await fs.pathExists(path.join(root, 'sfdx-project.json'))).to.equal(
      true
    );
  });

  it('rejects when tracked files do not match HEAD', async () => {
    await fs.appendFile(
      path.join(
        root,
        'force-app/main/default/objects/Account/fields/Value__c.field-meta.xml'
      ),
      '\n'
    );

    let error: unknown;
    try {
      await generateSourceDelta({
        root,
        packageDirectories: [{ path: 'force-app' }],
        from: 'HEAD~1',
        outputDirectory: path.join(root, 'output'),
        apiVersion: '66.0',
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(Error);
    expect((error as Error).message).to.equal(
      'Tracked files contain uncommitted changes'
    );
  });

  it('omits destructive manifests and options when there are no deletions', async () => {
    const result = await generateSourceDelta({
      root,
      packageDirectories: [{ path: 'force-app' }],
      from: 'HEAD',
      outputDirectory: path.join(root, 'output'),
      apiVersion: '66.0',
    });

    expect(result.manifests.preDestructive).to.equal(undefined);
    expect(result.manifests.postDestructive).to.equal(undefined);
    expect(
      await fs.pathExists(
        path.join(root, 'output/deploy/destructiveChangesPre.xml')
      )
    ).to.equal(false);
    expect(
      await fs.pathExists(
        path.join(root, 'output/deploy/destructiveChangesPost.xml')
      )
    ).to.equal(false);
    expect(result.deploySteps).to.have.length(1);
    expect(result.deploySteps[0]).not.to.include('--test-level');
    expect(result.deploySteps[0]).not.to.include('--pre-destructive-changes');
    expect(result.deploySteps[0]).not.to.include('--post-destructive-changes');

    const instructions = await fs.readFile(
      result.deploymentInstructions,
      'utf8'
    );
    expect(instructions).not.to.include('--pre-destructive-changes');
    expect(instructions).not.to.include('--post-destructive-changes');
    expect(instructions).to.include(
      'add `--test-level RunRelevantTests` to the deployment command'
    );
  });

  it('generates only the post destructive manifest for Git deletions', async () => {
    await fs.remove(
      path.join(root, 'force-app/main/default/classes/Unrelated.cls')
    );
    await fs.remove(
      path.join(root, 'force-app/main/default/classes/Unrelated.cls-meta.xml')
    );
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'delete class'], { cwd: root });

    const result = await generateSourceDelta({
      root,
      packageDirectories: [{ path: 'force-app' }],
      from: 'HEAD~1',
      outputDirectory: path.join(root, 'output'),
      apiVersion: '66.0',
    });

    expect(result.manifests.preDestructive).to.equal(undefined);
    expect(result.manifests.postDestructive).to.include(
      'deploy/destructiveChangesPost.xml'
    );
    expect(result.deploySteps).to.have.length(1);
    expect(result.deploySteps[0]).not.to.include('--test-level');
    expect(result.deploySteps[0]).not.to.include('--pre-destructive-changes');
    expect(result.deploySteps[0]).to.include('--post-destructive-changes');
    expect(
      await fs.readFile(result.manifests.postDestructive!, 'utf8')
    ).to.include('<members>Unrelated</members>');
  });

  it('finds a target field on a custom object with focused Tooling API queries', async () => {
    const fieldPath = path.join(
      root,
      'force-app/main/default/objects/MeterPurchace__c/fields/ConstructionAccountDept__c.field-meta.xml'
    );
    await fs.outputFile(fieldPath, fieldBefore);
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'add custom object field'], {
      cwd: root,
    });
    await fs.outputFile(fieldPath, fieldAfter);
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'change custom object field type'], {
      cwd: root,
    });
    const toolingQueries: Array<{
      type: string;
      where: Record<string, unknown>;
    }> = [];
    const connection = {
      metadata: {
        list: async ({ type }: { type: string }) => {
          if (type === 'CustomField')
            throw new Error('CustomField metadata.list must not be called');
          return [];
        },
      },
      tooling: {
        sobject: (type: string) => ({
          select: () => ({
            where: async (where: Record<string, unknown>) => {
              toolingQueries.push({ type, where });
              if (type === 'EntityDefinition')
                return [
                  {
                    DurableId: '01I000000000001',
                    QualifiedApiName: 'MeterPurchace__c',
                  },
                ];
              if (type === 'FieldDefinition')
                return [
                  {
                    DurableId: '01I000000000001.00N000000000002',
                    EntityDefinitionId: '01I000000000001AAA',
                    NamespacePrefix: null,
                    QualifiedApiName: 'ConstructionAccountDept__c',
                  },
                ];
              if (type === 'CustomField') return [];
              if (type === 'MetadataComponentDependency') return [];
              return [];
            },
          }),
        }),
      },
    } as any;

    const result = await generateSourceDelta({
      root,
      packageDirectories: [{ path: 'force-app' }],
      from: 'HEAD~1',
      outputDirectory: path.join(root, 'output'),
      apiVersion: '66.0',
      verbose: true,
      connection,
    });

    expect(result.hardBlockers).to.deep.equal([]);
    expect(
      result.fieldTypeChanges.map((field) => field.fullName)
    ).to.deep.equal(['MeterPurchace__c.ConstructionAccountDept__c']);
    expect(toolingQueries).to.deep.include({
      type: 'EntityDefinition',
      where: { QualifiedApiName: ['MeterPurchace__c'] },
    });
    expect(toolingQueries).to.deep.include({
      type: 'FieldDefinition',
      where: {
        EntityDefinitionId: '01I000000000001',
        QualifiedApiName: 'ConstructionAccountDept__c',
      },
    });
    expect(result.diagnostics).to.deep.include(
      'EntityDefinition result: [{"DurableId":"01I000000000001","QualifiedApiName":"MeterPurchace__c"}]'
    );
    expect(result.diagnostics).to.deep.include(
      'Resolved CustomField full names: ["MeterPurchace__c.ConstructionAccountDept__c"]'
    );
  });

  it('generates edit-reference artifacts without empty destructive changes', async () => {
    const metadataTypes: string[] = [];
    const toolingQueries: Array<{
      type: string;
      where: Record<string, unknown>;
    }> = [];
    const metadataList = async ({ type }: { type: string }) => {
      metadataTypes.push(type);
      if (type === 'ApexClass')
        return [{ id: '01p000000000001', fullName: 'UsesValue' }];
      if (type === 'FlexiPage')
        return [{ id: '0M0000000000001', fullName: 'Account' }];
      return [];
    };
    const dependencies = [
      {
        MetadataComponentId: '01p000000000001',
        MetadataComponentType: 'ApexClass',
        RefMetadataComponentId: '00N000000000001AAA',
      },
      {
        MetadataComponentId: '0M0000000000001',
        MetadataComponentType: 'FlexiPage',
        RefMetadataComponentId: '00N000000000001AAA',
      },
    ];
    const connection = sourceDeltaConnection(
      metadataList,
      dependencies,
      (type, where) => toolingQueries.push({ type, where })
    );
    const result = await generateSourceDelta({
      root,
      packageDirectories: [
        { path: 'force-app', default: true },
        { path: 'other-app', default: false },
      ],
      from: 'HEAD~1',
      outputDirectory: path.join(root, 'output'),
      apiVersion: '66.0',
      connection,
    });

    expect(result.fieldTypeChanges).to.deep.include({
      fullName: 'Account.Value__c',
      fromType: 'Text',
      toType: 'Formula',
      path: 'force-app/main/default/objects/Account/fields/Value__c.field-meta.xml',
      warning:
        'Account.Value__c: deleting and recreating the field can discard stored data (Text -> Formula)',
    });
    expect(metadataTypes).not.to.include('CustomField');
    expect(toolingQueries).to.deep.include({
      type: 'EntityDefinition',
      where: { QualifiedApiName: ['Account'] },
    });
    expect(toolingQueries).to.deep.include({
      type: 'FieldDefinition',
      where: { EntityDefinitionId: 'Account', QualifiedApiName: 'Value__c' },
    });
    expect(result.manualReview.some((item) => item.line === 2)).to.equal(true);
    const apex = await fs.readFile(
      path.join(
        root,
        'output/preDeploy/force-app/main/default/classes/UsesValue.cls'
      ),
      'utf8'
    );
    expect(apex).to.include('// FIELD-TYPE-CHANGE:');
    expect(apex).to.include('return null;');
    expect(
      await fs.pathExists(
        path.join(
          root,
          'output/preDeploy/force-app/main/default/classes/Unrelated.cls'
        )
      )
    ).to.equal(false);
    const flexiPage = await fs.readFile(
      path.join(
        root,
        'output/preDeploy/force-app/main/default/flexipages/Account.flexipage-meta.xml'
      ),
      'utf8'
    );
    expect(flexiPage).not.to.include('<itemInstances>');
    expect(
      result.manualReview.some((item) => item.path.includes('flexipages'))
    ).to.equal(false);
    expect(result.manifests.preDeployPostDestructive).to.equal(undefined);
    expect(
      await fs.pathExists(
        path.join(root, 'output/preDeploy/destructiveChangesPost.xml')
      )
    ).to.equal(false);
    expect(
      await fs.pathExists(path.join(root, 'output/preDeploy/other-app'))
    ).to.equal(true);
    const preProject = await fs.readJson(
      path.join(root, 'output/preDeploy/sfdx-project.json')
    );
    expect(preProject.packageDirectories).to.deep.equal([
      { path: 'force-app', default: true },
      { path: 'other-app', default: false },
    ]);
    const finalPackage = await fs.readFile(result.manifests.package, 'utf8');
    expect(finalPackage).to.include('<members>UsesValue</members>');
    expect(finalPackage).to.include('<members>Account</members>');
  });

  it('rejects a package directory outside preDeploy', async () => {
    const metadataList = async ({ type }: { type: string }) => {
      if (type === 'ApexClass')
        return [{ id: '01p000000000001', fullName: 'UsesValue' }];
      return [];
    };
    const connection = sourceDeltaConnection(metadataList, [
      {
        MetadataComponentId: '01p000000000001',
        MetadataComponentType: 'ApexClass',
        RefMetadataComponentId: '00N000000000001',
      },
    ]);

    let error: unknown;
    try {
      await generateSourceDelta({
        root,
        packageDirectories: [
          { path: 'force-app' },
          { path: '../outside-pre-deploy' },
        ],
        from: 'HEAD~1',
        outputDirectory: path.join(root, 'output'),
        apiVersion: '66.0',
        connection,
      });
    } catch (caught) {
      error = caught;
    }

    expect((error as Error).message).to.equal(
      'Package directory must remain inside preDeploy: ../outside-pre-deploy'
    );
    expect(
      await fs.pathExists(path.join(root, 'output/outside-pre-deploy'))
    ).to.equal(false);
  });

  it('keeps auto-cleanup dependencies out of pre destructive changes', async () => {
    const metadataList = async ({ type }: { type: string }) => {
      if (type === 'Layout')
        return [
          {
            id: '0Rb000000000001',
            fullName: 'Account-Account Layout',
          },
        ];
      return [];
    };
    let queryCount = 0;
    const connection = sourceDeltaConnection(
      metadataList,
      [
        {
          MetadataComponentId: '0Rb000000000001',
          MetadataComponentType: 'Layout',
          RefMetadataComponentId: '00N000000000001',
        },
      ],
      (type) => {
        if (type === 'MetadataComponentDependency') queryCount += 1;
      }
    );
    const result = await generateSourceDelta({
      root,
      packageDirectories: [{ path: 'force-app' }],
      from: 'HEAD~1',
      outputDirectory: path.join(root, 'output'),
      apiVersion: '66.0',
      connection,
    });

    expect(queryCount).to.equal(1);
    expect(result.hardBlockers).to.deep.equal([]);
    const finalPackage = await fs.readFile(result.manifests.package, 'utf8');
    const preDestructive = await fs.readFile(
      result.manifests.preDestructive!,
      'utf8'
    );
    expect(finalPackage).to.include(
      '<members>Account-Account Layout</members>'
    );
    expect(preDestructive).not.to.include(
      '<members>Account-Account Layout</members>'
    );
    expect(preDestructive).to.include('<members>Account.Value__c</members>');
  });

  it('copies directly dependent Apex triggers without editing them', async () => {
    const metadataList = async ({ type }: { type: string }) => {
      if (type === 'ApexTrigger')
        return [{ id: '01q000000000001', fullName: 'UsesValue' }];
      return [];
    };
    const dependencies = [
      {
        MetadataComponentId: '01q000000000001',
        MetadataComponentType: 'ApexTrigger',
        RefMetadataComponentId: '00N000000000001',
      },
    ];
    const connection = sourceDeltaConnection(metadataList, dependencies);

    const result = await generateSourceDelta({
      root,
      packageDirectories: [{ path: 'force-app' }],
      from: 'HEAD~1',
      outputDirectory: path.join(root, 'output'),
      apiVersion: '66.0',
      connection,
    });

    const triggerPath = path.join(
      root,
      'output/preDeploy/force-app/main/default/triggers/UsesValue.trigger'
    );
    expect((await fs.readFile(triggerPath, 'utf8')).trimEnd()).to.equal(
      (
        await fs.readFile(
          path.join(root, 'force-app/main/default/triggers/UsesValue.trigger'),
          'utf8'
        )
      ).trimEnd()
    );
    expect(
      result.manualReview.some(
        (review) =>
          review.path.endsWith('UsesValue.trigger') &&
          review.reason === 'Apex triggers are not edited automatically'
      )
    ).to.equal(true);
    const prePackage = await fs.readFile(
      result.manifests.preDeployPackage!,
      'utf8'
    );
    expect(prePackage).to.include('<name>ApexTrigger</name>');
    expect(prePackage).to.include('<members>UsesValue</members>');
  });

  it('deploys an empty Flow version and keeps only the latest version', async () => {
    const metadataList = async ({ type }: { type: string }) => {
      if (type === 'Flow')
        return [{ id: '301000000000001', fullName: 'UsesValue' }];
      return [];
    };
    const connection = sourceDeltaConnection(metadataList, [
      {
        MetadataComponentId: '301000000000001',
        MetadataComponentType: 'Flow',
        RefMetadataComponentId: '00N000000000001',
      },
    ]);

    const result = await generateSourceDelta({
      root,
      packageDirectories: [{ path: 'force-app' }],
      from: 'HEAD~1',
      outputDirectory: path.join(root, 'output'),
      apiVersion: '66.0',
      connection,
    });

    const generated = await fs.readFile(
      path.join(
        root,
        'output/preDeploy/force-app/main/default/flows/UsesValue.flow-meta.xml'
      ),
      'utf8'
    );
    expect(generated).to.equal(`<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>66.0</apiVersion>
  <label>Uses Value</label>
  <processType>AutoLaunchedFlow</processType>
  <status>Draft</status>
</Flow>
`);
    const prePackage = await fs.readFile(
      result.manifests.preDeployPackage!,
      'utf8'
    );
    const finalPackage = await fs.readFile(result.manifests.package, 'utf8');
    expect(prePackage).to.include('<name>Flow</name>');
    expect(prePackage).to.include('<members>UsesValue</members>');
    expect(finalPackage).to.include('<members>UsesValue</members>');
    expect(result.flows).to.deep.equal(['UsesValue']);
    expect(result.deploySteps).to.have.length(3);
    expect(
      result.deploySteps.some((step) => step.includes('deactivate'))
    ).to.equal(false);
    expect(result.deploySteps[0]).to.include('preDeploy');
    expect(result.deploySteps[0]).not.to.include('--test-level');
    expect(result.deploySteps[1]).to.include('flow delete');
    expect(result.deploySteps[1]).to.include('--keep-latest-version');
    expect(result.deploySteps[2]).to.include('destructiveChangesPre.xml');
    expect(result.deploySteps[2]).not.to.include('--test-level');
    expect(result.deploySteps[2]).not.to.include('destructiveChangesPost.xml');
    expect(result.manifests.postDestructive).to.equal(undefined);
    expect(
      await fs.pathExists(
        path.join(root, 'output/deploy/destructiveChangesPost.xml')
      )
    ).to.equal(false);
    expect(result.deploymentInstructions).to.equal(
      path.join(root, 'output/deploymentInstructions.md')
    );
    const instructions = await fs.readFile(
      result.deploymentInstructions,
      'utf8'
    );
    expect(instructions).to.include('# Deployment Instructions');
    expect(instructions).to.include('## Fields with potential data loss');
    expect(instructions).to.include(
      '- `Account.Value__c` (`Text` → `Formula`)'
    );
    expect(instructions).to.include('## 1. Optional: Back up field data');
    expect(instructions).to.include('sf kit data bulk query');
    expect(instructions).to.include(
      '--query "SELECT Id, Value__c FROM Account"'
    );
    expect(instructions).to.include('backup-Account.csv');
    expect(instructions).to.include('## 2. Remove field references');
    expect(instructions).to.include('## 3. Delete old Flow versions');
    expect(instructions).to.include('## 4. Deploy changes');
    expect(instructions).not.to.include('Delete placeholder Flow versions');
    expect(instructions).to.include('## Optional test execution');
    expect(instructions).to.include(
      'add `--test-level RunRelevantTests` to the deployment command'
    );
    expect(instructions.match(/```sh/g) ?? []).to.have.length(4);
    expect(instructions).not.to.include('flow deactivate');
    expect(instructions).not.to.include('Manual review');
    result.deploySteps.forEach((step) => expect(instructions).to.include(step));
  });
});
