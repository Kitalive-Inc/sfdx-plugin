import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import Command from '../../../../../src/commands/kit/layout/assignments/deploy';
import { LayoutAssignmentsPerProfile } from '../../../../../src/types';
import * as metadata from '../../../../../src/metadata';

describe('kit:layout:assignments:deploy', () => {
  const $$ = testSetup();

  const config: LayoutAssignmentsPerProfile = {
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
  beforeEach(async () => {
    await $$.stubAuths(new MockTestOrgData());
    readFile = stubMethod($$.SANDBOX, Command.prototype, 'readFile').returns(
      config
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
    await Command.run(['-u', 'test@foo.bar']);
    expect(readFile.calledWith('config/layout-assignments.json')).toBe(true);
    expect(updateMetadata.calledOnce).toBe(true);
    expect(updateMetadata.args[0][2]).toEqual([
      { fullName: 'Admin', layoutAssignments: config.Admin },
      { fullName: 'Standard', layoutAssignments: config.Standard },
    ]);
  });

  it('with file argument', async () => {
    await Command.run(['-u', 'test@foo.bar', '-f', 'config/test.json']);
    expect(readFile.calledWith('config/test.json')).toBe(true);
  });
});
