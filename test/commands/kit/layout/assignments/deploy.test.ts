import { test } from '@salesforce/command/lib/test';
import Command from '../../../../../src/commands/kit/layout/assignments/deploy';
import { LayoutAssignmentsPerProfile } from '../../../../../src/types';
import * as metadata from '../../../../../src/metadata';
const updateMetadata = jest.spyOn(metadata, 'updateMetadata');

describe('kit:layout:assignments:deploy', () => {
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

  const readFile = jest
    .spyOn(Command.prototype as any, 'readFile')
    .mockReturnValue(config);

  updateMetadata.mockImplementation(async (conn, type, profiles) =>
    [profiles].flat().map(({ fullName }) => ({ fullName, success: true }))
  );

  afterEach(() => {
    readFile.mockClear();
    updateMetadata.mockClear();
  });

  const t = test.withOrg({ username: 'test@org.com' }, true).stdout().stderr();

  t.command(['kit:layout:assignments:deploy']).it('no arguments', (ctx) => {
    expect(readFile).toHaveBeenCalledWith('config/layout-assignments.json');
    expect(updateMetadata).toHaveBeenCalledTimes(1);
    expect(updateMetadata.mock.calls[0][2]).toEqual([
      { fullName: 'Admin', layoutAssignments: config.Admin },
      { fullName: 'Standard', layoutAssignments: config.Standard },
    ]);
    expect(ctx.stdout).toMatch(
      'deploy layout assignments from config/layout-assignments.json'
    );
  });

  t.command(['kit:layout:assignments:deploy', '-f', 'config/test.json']).it(
    '-f config/test.json',
    (ctx) => {
      expect(readFile).toHaveBeenCalledWith('config/test.json');
      expect(ctx.stdout).toMatch(
        'deploy layout assignments from config/test.json'
      );
    }
  );
});
