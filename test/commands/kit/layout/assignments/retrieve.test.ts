import { expect } from 'chai';
import { SfProject } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { stubSfCommandUx, stubSpinner } from '@salesforce/sf-plugins-core';
import { spyMethod, stubMethod } from '@salesforce/ts-sinon';
import { Config } from '@oclif/core';
import Command from '../../../../../src/commands/kit/layout/assignments/retrieve';
import * as metadata from '../../../../../src/metadata';

describe('kit layout assignments retrieve', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({
    root: __dirname + '/../../../../../package.json',
  });

  const projectConfig = {
    packageDirectories: [
      {
        path: 'package1',
      },
      {
        path: 'force-app',
        default: true,
      },
    ],
  };

  const layoutAssignments = [
    {
      layout: 'Opportunity-Opportunity Layout1.layout-meta.xml',
    },
    {
      layout: 'Account-Account Layout1.layout-meta.xml',
    },
    {
      layout: 'Account-Account Layout1.layout-meta.xml',
      recordType: 'Account.A',
    },
    {
      layout: 'Account-Account Layout2.layout-meta.xml',
      recordType: 'Account.B',
    },
    {
      layout: 'Contact-Contact Layout1.layout-meta.xml',
    },
  ];

  let readMetadata: any;
  let objectNamesFromLayouts: any;
  let findFiles: any;
  let getProfileNames: any;
  let readFile: any;
  let writeFile: any;
  let ux: any;
  let spinner: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    ux = stubSfCommandUx($$.SANDBOX);
    spinner = stubSpinner($$.SANDBOX);
    readMetadata = stubMethod($$.SANDBOX, metadata, 'readMetadata').callsFake(
      async (conn, type, names: string[]) =>
        names.map((fullName) => ({ fullName, layoutAssignments }))
    );
    stubMethod($$.SANDBOX, metadata, 'completeDefaultNamespace').callsFake(
      async (conn, names) => names
    );
    objectNamesFromLayouts = spyMethod(
      $$.SANDBOX,
      Command.prototype,
      'objectNamesFromLayouts'
    );
    findFiles = stubMethod($$.SANDBOX, Command.prototype, 'findFiles').returns([
      'force-app/ext/layouts/Opportunity-Opportunity Layout1.layout-meta.xml',
      'force-app/ext/layouts/Opportunity-Opportunity Layout2.layout-meta.xml',
      'force-app/main/default/layouts/Account-Account Layout1.layout-meta.xml',
      'force-app/main/default/layouts/Account-Account Layout2.layout-meta.xml',
      'force-app/main/default/layouts/Contact-Contact Layout.layout-meta.xml',
    ]);
    getProfileNames = stubMethod(
      $$.SANDBOX,
      Command.prototype,
      'getProfileNames'
    ).resolves(Array.from(Array(12), (_, i) => 'profile' + (i + 1)));
    readFile = stubMethod($$.SANDBOX, Command.prototype, 'readFile').returns({
      Admin: [{ layout: 'Account-Account Layout.layout-meta.xml' }],
    });
    writeFile = stubMethod($$.SANDBOX, Command.prototype, 'writeFile');

    stubMethod($$.SANDBOX, Command.prototype, 'getProjectConfig').returns(
      projectConfig
    );
  });

  it('only required arguments', async () => {
    const command = new Command(['-o', 'test@foo.bar'], config);
    command.project = SfProject.getInstance();
    await command.run();
    expect(objectNamesFromLayouts.calledOnce).to.be.true;
    expect(findFiles.calledOnce).to.be.true;
    expect(findFiles.args[0][0]).to.contain('force-app/**/*.layout-meta.xml');
    expect(getProfileNames.calledOnce).to.be.true;
    expect(readMetadata.calledOnce).to.be.true;
    expect(readMetadata.args[0][2].length).to.eq(12);
    expect(readFile.called).to.be.false;
    expect(writeFile.calledOnce).to.be.true;

    const data = {};
    for (let i = 1; i <= 12; i++) {
      data['profile' + i] = [
        {
          layout: 'Account-Account Layout1.layout-meta.xml',
        },
        {
          layout: 'Account-Account Layout1.layout-meta.xml',
          recordType: 'Account.A',
        },
        {
          layout: 'Account-Account Layout2.layout-meta.xml',
          recordType: 'Account.B',
        },
        {
          layout: 'Opportunity-Opportunity Layout1.layout-meta.xml',
        },
      ];
    }
    expect(writeFile.args[0]).to.eql(['config/layout-assignments.json', data]);
    expect(spinner.start.args[0][0]).to.eq('Retrieve page layout assignments');
    expect(ux.log.args[0][0]).to.contain(
      'Saved to config/layout-assignments.json:'
    );
    expect(ux.log.args[0][0]).to.contain(
      'profiles: profile1, profile2, profile3, '
    );
    expect(ux.log.args[0][0]).to.contain('objects: Account, Opportunity');
  });

  it('with optional arguments', async () => {
    const command = new Command(
      [
        '-o',
        'test@foo.bar',
        '-f',
        'config/test.json',
        '-p',
        'Admin',
        '-p',
        'Standard',
        '-s',
        'Account',
        '-s',
        'Contact',
      ],
      config
    );
    command.project = SfProject.getInstance();
    await command.run();
    expect(objectNamesFromLayouts.called).to.be.false;
    expect(findFiles.called).to.be.false;
    expect(getProfileNames.called).to.be.false;
    expect(readMetadata.calledOnce).to.be.true;
    expect(readMetadata.args[0][2]).to.eql(['Admin', 'Standard']);
    expect(readFile.called).to.be.false;
    expect(writeFile.calledOnce).to.be.true;

    const data = {};
    for (const profile of ['Admin', 'Standard']) {
      data[profile] = [
        {
          layout: 'Account-Account Layout1.layout-meta.xml',
        },
        {
          layout: 'Account-Account Layout1.layout-meta.xml',
          recordType: 'Account.A',
        },
        {
          layout: 'Account-Account Layout2.layout-meta.xml',
          recordType: 'Account.B',
        },
        {
          layout: 'Contact-Contact Layout1.layout-meta.xml',
        },
      ];
    }
    expect(writeFile.args[0]).to.eql(['config/test.json', data]);
    expect(spinner.start.args[0][0]).to.eq('Retrieve page layout assignments');
    expect(ux.log.args[0][0]).to.contain('Saved to config/test.json');
    expect(ux.log.args[0][0]).to.contain('profiles: Admin, Standard');
    expect(ux.log.args[0][0]).to.contain('objects: Account, Contact');
  });

  it('with merge option', async () => {
    const command = new Command(
      [
        '-o',
        'test@foo.bar',
        '-f',
        'config/test.json',
        '-p',
        'Standard',
        '--merge',
      ],
      config
    );
    command.project = SfProject.getInstance();
    await command.run();
    expect(readFile.calledOnce).to.be.true;
    expect(readFile.args[0][0]).to.eq('config/test.json');
    expect(writeFile.calledOnce).to.be.true;
    expect(writeFile.args[0]).to.eql([
      'config/test.json',
      {
        Admin: [{ layout: 'Account-Account Layout.layout-meta.xml' }],
        Standard: [
          {
            layout: 'Account-Account Layout1.layout-meta.xml',
          },
          {
            layout: 'Account-Account Layout1.layout-meta.xml',
            recordType: 'Account.A',
          },
          {
            layout: 'Account-Account Layout2.layout-meta.xml',
            recordType: 'Account.B',
          },
          {
            layout: 'Opportunity-Opportunity Layout1.layout-meta.xml',
          },
        ],
      },
    ]);
  });
});
