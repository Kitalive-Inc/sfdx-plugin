import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { spyMethod, stubMethod } from '@salesforce/ts-sinon';
import Command from '../../../../../src/commands/kit/layout/assignments/retrieve';
import * as metadata from '../../../../../src/metadata';

describe('kit:layout:assignments:retrieve', () => {
  const $$ = testSetup();

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
  let completeDefaultNamespace: any;
  let objectNamesFromLayouts: any;
  let findFiles: any;
  let getProfileNames: any;
  let readFile: any;
  let writeFile: any;
  beforeEach(async () => {
    await $$.stubAuths(new MockTestOrgData());
    readMetadata = stubMethod($$.SANDBOX, metadata, 'readMetadata').callsFake(
      async (conn, type, names: string[]) =>
        names.map((fullName) => ({ fullName, layoutAssignments }))
    );
    completeDefaultNamespace = stubMethod(
      $$.SANDBOX,
      metadata,
      'completeDefaultNamespace'
    ).callsFake(async (conn, names) => names);
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
    await Command.run(['-u', 'test@foo.bar']);
    expect(objectNamesFromLayouts.calledOnce).toBe(true);
    expect(findFiles.calledOnce).toBe(true);
    expect(findFiles.args[0][0]).toMatch('force-app/**/*.layout-meta.xml');
    expect(getProfileNames.calledOnce).toBe(true);
    expect(readMetadata.calledOnce).toBe(true);
    expect(readMetadata.args[0][2].length).toBe(12);
    expect(readFile.called).toBe(false);
    expect(writeFile.calledOnce).toBe(true);

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
    expect(writeFile.args[0]).toEqual(['config/layout-assignments.json', data]);
    //expect(ctx.stdout).toMatch('profiles: profile1, profile2, profile3, ');
    //expect(ctx.stdout).toMatch('objects: Account, Opportunity');
    //expect(ctx.stdout).toMatch('save to config/layout-assignments.json');
  });

  it('with optional arguments', async () => {
    await Command.run([
      '-u',
      'test@foo.bar',
      '-f',
      'config/test.json',
      '-p',
      'Admin,Standard',
      '-o',
      'Account,Contact',
    ]);
    expect(objectNamesFromLayouts.called).toBe(false);
    expect(findFiles.called).toBe(false);
    expect(getProfileNames.called).toBe(false);
    expect(readMetadata.calledOnce).toBe(true);
    expect(readMetadata.args[0][2]).toEqual(['Admin', 'Standard']);
    expect(readFile.called).toBe(false);
    expect(writeFile.calledOnce).toBe(true);

    const data = {};
    for (let profile of ['Admin', 'Standard']) {
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
    expect(writeFile.args[0]).toEqual(['config/test.json', data]);
    //expect(ctx.stdout).toMatch('profiles: Admin, Standard');
    //expect(ctx.stdout).toMatch('objects: Account, Contact');
    //expect(ctx.stdout).toMatch('save to config/test.json');
  });

  it('with merge option', async () => {
    await Command.run([
      '-u',
      'test@foo.bar',
      '-f',
      'config/test.json',
      '-p',
      'Standard',
      '--merge',
    ]);
    expect(readFile.calledOnce).toBe(true);
    expect(readFile.args[0][0]).toBe('config/test.json');
    expect(writeFile.calledOnce).toBe(true);
    expect(writeFile.args[0]).toEqual([
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
