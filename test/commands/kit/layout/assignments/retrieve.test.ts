import { expect, test } from '@salesforce/command/lib/test';
import { SfdxProject } from '@salesforce/core';
import { spy } from 'sinon';
import Command from '../../../../../src/commands/kit/layout/assignments/retrieve';

describe('kit:layout:assignments:retrieve', () => {
  const projectConfig = {
    packageDirectories: [
      {
        path: 'package1'
      },
      {
        path: 'force-app',
        default: true
      }
    ]
  };

  const layoutAssignments = [
    {
      layout: 'Opportunity-Opportunity Layout1.layout-meta.xml'
    },
    {
      layout: 'Account-Account Layout1.layout-meta.xml'
    },
    {
      layout: 'Account-Account Layout1.layout-meta.xml',
      recordType: 'Account.A'
    },
    {
      layout: 'Account-Account Layout2.layout-meta.xml',
      recordType: 'Account.B'
    },
    {
      layout: 'Contact-Contact Layout1.layout-meta.xml'
    }
  ];

  const objectNamesFromLayouts = spy(Command.prototype, 'objectNamesFromLayouts');

  const findFiles = spy(pattern => Promise.resolve([
    'force-app/ext/layouts/Opportunity-Opportunity Layout1.layout-meta.xml',
    'force-app/ext/layouts/Opportunity-Opportunity Layout2.layout-meta.xml',
    'force-app/main/default/layouts/Account-Account Layout1.layout-meta.xml',
    'force-app/main/default/layouts/Account-Account Layout2.layout-meta.xml',
    'force-app/main/default/layouts/Contact-Contact Layout.layout-meta.xml'
  ]));

  const getProfileNames = spy(() => {
    const names = [];
    for (let i = 1; i <= 12; i++) {
      names.push('profile' + i);
    }
    return Promise.resolve(names);
  });

  const getProfiles = spy(names => Promise.resolve(
    names.map(fullName => ({ fullName, layoutAssignments }))
  ));

  const readFile = spy(file => Promise.resolve({
    Admin: [{ layout: 'Account-Account Layout.layout-meta.xml' }]
  }));

  const writeFile = spy((file, data) => Promise.resolve());

  afterEach(() => {
    objectNamesFromLayouts.resetHistory();
    findFiles.resetHistory();
    getProfileNames.resetHistory();
    getProfiles.resetHistory();
    readFile.resetHistory();
    writeFile.resetHistory();
  });

  const t = test
    .withOrg({ username: 'test@org.com' }, true)
    .stub(SfdxProject.prototype, 'resolveProjectConfig', () => projectConfig)
    .stub(Command.prototype, 'findFiles', findFiles)
    .stub(Command.prototype, 'getProfileNames', getProfileNames)
    .stub(Command.prototype, 'getProfiles', getProfiles)
    .stub(Command.prototype, 'readFile', readFile)
    .stub(Command.prototype, 'writeFile', writeFile)
    .stdout();

  t.command(['kit:layout:assignments:retrieve'])
    .it('no arguments', ctx => {
      expect(objectNamesFromLayouts.calledOnce).to.be.true;
      expect(findFiles.calledOnce).to.be.true;
      expect(findFiles.args[0][0]).to.contain('force-app/**/*.layout-meta.xml');
      expect(getProfileNames.calledOnce).to.be.true;
      expect(getProfiles.callCount).to.eq(2);
      expect(getProfiles.args[0][0]).to.eql(['profile1', 'profile2', 'profile3', 'profile4', 'profile5', 'profile6', 'profile7', 'profile8', 'profile9', 'profile10']);
      expect(getProfiles.args[1][0]).to.eql(['profile11', 'profile12']);
      expect(readFile.called).to.be.false;
      expect(writeFile.calledOnce).to.be.true;

      const data = {};
      for (let i = 1; i <= 12; i++) {
        data['profile' + i] = [
          {
            layout: 'Account-Account Layout1.layout-meta.xml'
          },
          {
            layout: 'Account-Account Layout1.layout-meta.xml',
            recordType: 'Account.A'
          },
          {
            layout: 'Account-Account Layout2.layout-meta.xml',
            recordType: 'Account.B'
          },
          {
            layout: 'Opportunity-Opportunity Layout1.layout-meta.xml'
          }
        ];
      }
      expect(writeFile.args[0]).eql(['config/layout-assignments.json', data]);
      expect(ctx.stdout).to.contain('profiles: profile1, profile2, profile3, ');
      expect(ctx.stdout).to.contain('objects: Account, Opportunity');
      expect(ctx.stdout).to.contain('save to config/layout-assignments.json');
    });

  t.command(['kit:layout:assignments:retrieve', '-f', 'config/test.json', '-p', 'Admin,Standard', '-o', 'Account,Contact'])
    .it('-f config/test.json -p Admin,Standard -o Account,Contact', ctx => {
      expect(objectNamesFromLayouts.called).to.be.false;
      expect(getProfileNames.called).to.be.false;
      expect(getProfiles.calledOnce).to.be.true;
      expect(getProfiles.args[0][0]).to.eql(['Admin', 'Standard']);
      expect(readFile.called).to.be.false;
      expect(writeFile.calledOnce).to.be.true;

      const data = {};
      for (let profile of ['Admin', 'Standard']) {
        data[profile] = [
          {
            layout: 'Account-Account Layout1.layout-meta.xml'
          },
          {
            layout: 'Account-Account Layout1.layout-meta.xml',
            recordType: 'Account.A'
          },
          {
            layout: 'Account-Account Layout2.layout-meta.xml',
            recordType: 'Account.B'
          },
          {
            layout: 'Contact-Contact Layout1.layout-meta.xml'
          }
        ];
      }
      expect(writeFile.args[0]).eql(['config/test.json', data]);
      expect(ctx.stdout).to.contain('profiles: Admin, Standard');
      expect(ctx.stdout).to.contain('objects: Account, Contact');
      expect(ctx.stdout).to.contain('save to config/test.json');
    });


  t.command(['kit:layout:assignments:retrieve', '-f', 'config/test.json', '-p', 'Standard', '--merge'])
    .it('-f config/test.json -p Standard --merge', ctx => {
      expect(readFile.calledOnce).to.be.true;
      expect(readFile.args[0][0]).to.eq('config/test.json');
      expect(writeFile.calledOnce).to.be.true;
      expect(writeFile.args[0]).to.eql(['config/test.json', {
        Admin: [{ layout: 'Account-Account Layout.layout-meta.xml' }],
        Standard: [
          {
            layout: 'Account-Account Layout1.layout-meta.xml'
          },
          {
            layout: 'Account-Account Layout1.layout-meta.xml',
            recordType: 'Account.A'
          },
          {
            layout: 'Account-Account Layout2.layout-meta.xml',
            recordType: 'Account.B'
          },
          {
            layout: 'Opportunity-Opportunity Layout1.layout-meta.xml'
          }
        ]
      }]);
    });
});
