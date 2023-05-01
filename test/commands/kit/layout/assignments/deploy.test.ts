import { expect } from 'chai';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { stubSpinner } from '@salesforce/sf-plugins-core';
import { stubMethod } from '@salesforce/ts-sinon';
import { Config } from '@oclif/core';
import Command from '../../../../../src/commands/kit/layout/assignments/deploy';
import { LayoutAssignmentsPerProfile } from '../../../../../src/types';
import * as metadata from '../../../../../src/metadata';

describe('kit layout assignments deploy', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({
    root: __dirname + '/../../../../../package.json',
  });

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

  let readFile: any;
  let updateMetadata: any;
  let spinner: any;
  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    spinner = stubSpinner($$.SANDBOX);
    await config.load();
    readFile = stubMethod($$.SANDBOX, Command.prototype, 'readFile').returns(
      layouts
    );
    updateMetadata = stubMethod(
      $$.SANDBOX,
      metadata,
      'updateMetadata'
    ).callsFake(async (conn, type, profiles) =>
      [profiles]
        .flat()
        .map(({ fullName }) => ({ fullName, success: true, errors: [] }))
    );
  });

  it('no file argument', async () => {
    await new Command(['-o', 'test@foo.bar'], config).run();
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
    await new Command(
      ['-o', 'test@foo.bar', '-f', 'config/test.json'],
      config
    ).run();
    expect(readFile.calledWith('config/test.json')).to.be.true;
    expect(spinner.start.args[0][0]).to.include(
      'Deploy page layout assignments from config/test.json'
    );
  });
});
