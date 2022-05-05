import { test } from '@salesforce/command/lib/test';
import Command from '../../../../../src/commands/kit/layout/assignments/retrieve';
import * as metadata from '../../../../../src/metadata';
const readMetadata = jest.spyOn(metadata, 'readMetadata');
const completeDefaultNamespace = jest.spyOn(
  metadata,
  'completeDefaultNamespace'
);

describe('kit:layout:assignments:retrieve', () => {
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

  jest
    .spyOn(Command.prototype, 'getProjectConfig' as any)
    .mockReturnValue(projectConfig);

  const objectNamesFromLayouts = jest.spyOn(
    Command.prototype,
    'objectNamesFromLayouts' as any
  );

  const findFiles = jest
    .spyOn(Command.prototype, 'findFiles' as any)
    .mockReturnValue([
      'force-app/ext/layouts/Opportunity-Opportunity Layout1.layout-meta.xml',
      'force-app/ext/layouts/Opportunity-Opportunity Layout2.layout-meta.xml',
      'force-app/main/default/layouts/Account-Account Layout1.layout-meta.xml',
      'force-app/main/default/layouts/Account-Account Layout2.layout-meta.xml',
      'force-app/main/default/layouts/Contact-Contact Layout.layout-meta.xml',
    ]);

  const getProfileNames = jest
    .spyOn(Command.prototype, 'getProfileNames' as any)
    .mockImplementation(async () => {
      const names = [];
      for (let i = 1; i <= 12; i++) {
        names.push('profile' + i);
      }
      return names;
    });

  readMetadata.mockImplementation(async (conn, type, names: string[]) =>
    names.map((fullName) => ({ fullName, layoutAssignments }))
  );
  completeDefaultNamespace.mockImplementation(async (conn, names) => names);

  const readFile = jest
    .spyOn(Command.prototype, 'readFile' as any)
    .mockReturnValue({
      Admin: [{ layout: 'Account-Account Layout.layout-meta.xml' }],
    });

  const writeFile = jest
    .spyOn(Command.prototype, 'writeFile' as any)
    .mockImplementation();

  afterEach(() => {
    objectNamesFromLayouts.mockClear();
    findFiles.mockClear();
    getProfileNames.mockClear();
    readMetadata.mockClear();
    readFile.mockClear();
    writeFile.mockClear();
  });

  const t = test.withOrg({ username: 'test@org.com' }, true).stdout().stderr();

  t.command(['kit:layout:assignments:retrieve']).it('no arguments', (ctx) => {
    expect(objectNamesFromLayouts).toHaveBeenCalledTimes(1);
    expect(findFiles).toHaveBeenCalledTimes(1);
    expect(findFiles.mock.calls[0][0]).toMatch(
      'force-app/**/*.layout-meta.xml'
    );
    expect(getProfileNames).toHaveBeenCalledTimes(1);
    expect(readMetadata).toHaveBeenCalledTimes(1);
    expect(readMetadata.mock.calls[0][2].length).toBe(12);
    expect(readFile).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledTimes(1);

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
    expect(writeFile.mock.calls[0]).toEqual([
      'config/layout-assignments.json',
      data,
    ]);
    expect(ctx.stdout).toMatch('profiles: profile1, profile2, profile3, ');
    expect(ctx.stdout).toMatch('objects: Account, Opportunity');
    expect(ctx.stdout).toMatch('save to config/layout-assignments.json');
  });

  t.command([
    'kit:layout:assignments:retrieve',
    '-f',
    'config/test.json',
    '-p',
    'Admin,Standard',
    '-o',
    'Account,Contact',
  ]).it('-f config/test.json -p Admin,Standard -o Account,Contact', (ctx) => {
    expect(objectNamesFromLayouts).not.toHaveBeenCalled();
    expect(getProfileNames).not.toHaveBeenCalled();
    expect(readMetadata).toHaveBeenCalledTimes(1);
    expect(readMetadata.mock.calls[0][2]).toEqual(['Admin', 'Standard']);
    expect(readFile).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledTimes(1);

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
    expect(writeFile.mock.calls[0]).toEqual(['config/test.json', data]);
    expect(ctx.stdout).toMatch('profiles: Admin, Standard');
    expect(ctx.stdout).toMatch('objects: Account, Contact');
    expect(ctx.stdout).toMatch('save to config/test.json');
  });

  t.command([
    'kit:layout:assignments:retrieve',
    '-f',
    'config/test.json',
    '-p',
    'Standard',
    '--merge',
  ]).it('-f config/test.json -p Standard --merge', (ctx) => {
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(readFile.mock.calls[0][0]).toBe('config/test.json');
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile.mock.calls[0]).toEqual([
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
