import { test } from '@salesforce/command/lib/test';
import Command from '../../../../../src/commands/kit/layout/assignments/deploy';
import { LayoutAssignmentsPerProfile } from '../../../../../src/types';

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
  const deploy = jest
    .spyOn(Command.prototype as any, 'deploy')
    .mockReturnValue({});

  afterEach(() => {
    readFile.mockClear();
    deploy.mockClear();
  });

  const t = test.withOrg({ username: 'test@org.com' }, true).stdout().stderr();

  t.command(['kit:layout:assignments:deploy']).it('no arguments', (ctx) => {
    expect(readFile).toHaveBeenCalledWith('config/layout-assignments.json');
    expect(deploy).toHaveBeenCalledTimes(1);
    expect(deploy.mock.calls[0][0]).toEqual([
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

  t.stub(Command.prototype, 'readFile', ((file) => {
    const result = {};
    for (let i = 1; i <= 35; i++) {
      result['profile' + i] = [
        { layout: 'Account-Account Layout' },
        { layout: 'Contact-Contact Layout' },
      ];
    }
    return result;
  }) as any)
    .command(['kit:layout:assignments:deploy'])
    .it('update 10 profiles per one API call', (ctx) => {
      expect(deploy.mock.calls.length).toBe(4);
      expect(deploy.mock.calls[0][0]).toHaveLength(10);
      expect(deploy.mock.calls[1][0]).toHaveLength(10);
      expect(deploy.mock.calls[2][0]).toHaveLength(10);
      expect(deploy.mock.calls[3][0]).toHaveLength(5);
    });
});
