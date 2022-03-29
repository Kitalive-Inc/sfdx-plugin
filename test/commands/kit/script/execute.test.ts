import { test } from '@salesforce/command/lib/test';
import * as fs from 'fs-extra';
import { Connection } from 'jsforce';
import * as repl from 'repl';
import Command from '../../../../src/commands/kit/script/execute';

const commandName = 'kit:script:execute';
describe(commandName, () => {
  const testSetup = test
    .withOrg({ username: 'test@org.com' }, true)
    .stdout()
    .stderr();

  const validateVariables = jest.fn();

  Object.assign(global, { validateVariables });
  const script = `
    validateVariables(conn, context);
  `;

  testSetup
    .stub(fs, 'readFileSync', () => script)
    .command([commandName, '-f', 'path/to/script.js'])
    .it('script mode', (ctx) => {
      expect(validateVariables.mock.calls.length).toBe(1);
      expect(validateVariables.mock.calls[0][0] instanceof Connection).toBe(
        true
      );
      expect(validateVariables.mock.calls[0][1] instanceof Command).toBe(true);
    });

  const replServer = {
    context: {},
    on: (event, callback) => {
      expect(event).toEqual('exit');
      callback();
    },
  };
  testSetup
    .stub(repl, 'start', () => replServer)
    .command([commandName])
    .it('REPL mode', (ctx) => {
      expect(replServer.context['conn'] instanceof Connection).toBe(true);
      expect(replServer.context['context'] instanceof Command).toBe(true);
    });
});
