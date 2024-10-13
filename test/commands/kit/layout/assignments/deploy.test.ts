import { expect } from 'chai';
import esmock from 'esmock';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSpinner } from '@salesforce/sf-plugins-core';
import { LayoutAssignmentsPerProfile } from '../../../../../src/types.js';

describe('kit layout assignments deploy', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  const layouts: LayoutAssignmentsPerProfile = {
    Admin: [
      { layout: 'Account-Account Layout For Admin' },
      { layout: 'Contact-Contact Layout For Admin' },
    ],
    Standard: [
      { layout: 'Account-Account Layout For Standard' },
      { layout: 'Contact-Contact Layout For Standard' },
    ],
  };

  let Command: any;
  let readFile: any;
  let updateMetadata: any;
  let spinner: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    spinner = stubSpinner($$.SANDBOX);
    updateMetadata = $$.SANDBOX.fake(async (conn, type, profiles) =>
      [profiles]
        .flat()
        .map(({ fullName }) => ({ fullName, success: true, errors: [] }))
    );
    Command = await esmock(
      '../../../../../src/commands/kit/layout/assignments/deploy.js',
      {
        '../../../../../src/metadata.js': { updateMetadata },
      }
    );
    readFile = $$.SANDBOX.stub(Command.prototype, 'readFile').returns(layouts);
  });

  it('no file argument', async () => {
    await Command.run(['-o', 'test@foo.bar']);
    expect(readFile.calledWith('config/layout-assignments.json')).to.be.true;
    expect(updateMetadata.calledOnce).to.be.true;
    expect(updateMetadata.args[0][2]).to.eql([
      { fullName: 'Admin', layoutAssignments: layouts.Admin },
      { fullName: 'Standard', layoutAssignments: layouts.Standard },
    ]);
    expect(spinner.start.args[0][0]).to.include(
      'Deploy page layout assignments from config/layout-assignments.json'
    );
  });

  it('with file argument', async () => {
    await Command.run(['-o', 'test@foo.bar', '-f', 'config/test.json']);
    expect(readFile.calledWith('config/test.json')).to.be.true;
    expect(spinner.start.args[0][0]).to.include(
      'Deploy page layout assignments from config/test.json'
    );
  });
});
