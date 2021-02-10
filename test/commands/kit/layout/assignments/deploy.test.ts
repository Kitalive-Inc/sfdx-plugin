import { expect, test } from '@salesforce/command/lib/test';
import { spy } from 'sinon';
import Command from '../../../../../src/commands/kit/layout/assignments/deploy';

describe('kit:layout:assignments:deploy', () => {
  const config = {
    "Admin": [
      { layout: "Account-Account Layout For Admin" },
      { layout: "Contact-Contact Layout For Admin" }
    ],
    "Standard": [
      { layout: "Account-Account Layout For Standard" },
      { layout: "Contact-Contact Layout For Standard" }
    ]
  };

  const readFile = spy(file => config);
  const deploy = spy(data => Promise.resolve({}));

  afterEach(() => {
    readFile.resetHistory();
    deploy.resetHistory();
  });

  const t = test
    .withOrg({ username: 'test@org.com' }, true)
    .stub(Command.prototype, 'readFile', readFile)
    .stub(Command.prototype, 'deploy', deploy)
    .stdout();

  t.command(['kit:layout:assignments:deploy'])
    .it('no arguments', ctx => {
      expect(readFile.calledWith('config/layout-assignments.json')).to.be.true;
      expect(deploy.calledOnce).to.be.true;
      expect(deploy.args[0][0]).to.eql([
        { fullName: 'Admin', layoutAssignments: config.Admin },
        { fullName: 'Standard', layoutAssignments: config.Standard }
      ]);
      expect(ctx.stdout).to.contain('deploy layout assignments from config/layout-assignments.json');
    });

  t.command(['kit:layout:assignments:deploy', '-f', 'config/test.json'])
    .it('-f config/test.json', ctx => {
      expect(readFile.calledWith('config/test.json')).to.be.true;
      expect(ctx.stdout).to.contain('deploy layout assignments from config/test.json');
    });


  t
    .stub(Command.prototype, 'readFile', (file) => {
      const result = {};
      for (let i = 1; i <= 35; i++) {
        result['profile' + i] = [
          { layout: "Account-Account Layout" },
          { layout: "Contact-Contact Layout" }
        ];
      }
      return result;
    })
    .command(['kit:layout:assignments:deploy'])
    .it('update 10 profiles per one API call', ctx => {
      expect(deploy.callCount).to.eq(4);
      expect(deploy.args[0][0].length).to.eq(10);
      expect(deploy.args[1][0].length).to.eq(10);
      expect(deploy.args[2][0].length).to.eq(10);
      expect(deploy.args[3][0].length).to.eq(5);
    });

});
