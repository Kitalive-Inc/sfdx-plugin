import { expect, test } from '@salesforce/command/lib/test';
import * as fs from 'fs-extra';
import { Connection } from 'jsforce';
import * as repl from 'repl';
import * as sinon from 'sinon';
import Command from '../../../../src/commands/kit/script/execute';

const commandName = 'kit:script:execute';
describe(commandName, () => {
  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout();

  const validateVariables = sinon.spy();

  Object.assign(global, { validateVariables });
  const script = `
    validateVariables(conn, context);
  `;

  testSetup
    .stub(fs, 'readFileSync', () => script)
    .command([commandName, '-f', 'path/to/script.js'])
    .it('script mode', ctx => {
      expect(validateVariables.calledOnce).to.be.true;
      expect(validateVariables.args[0][0] instanceof Connection).to.be.true;
      expect(validateVariables.args[0][1] instanceof Command).to.be.true;
    });

  const replServer = {
    context: {},
    on: (event, callback) => {
      expect(event).to.eq('exit');
      callback();
    }
  };
  testSetup
    .stub(repl, 'start', () => replServer)
    .command([commandName])
    .it('REPL mode', ctx => {
      expect(replServer.context['conn'] instanceof Connection).to.be.true;
      expect(replServer.context['context'] instanceof Command).to.be.true;
    });
});
