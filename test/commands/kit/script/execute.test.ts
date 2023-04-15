import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import * as fs from 'fs-extra';
import { Connection } from 'jsforce';
import * as repl from 'repl';
import Command from '../../../../src/commands/kit/script/execute';

const commandName = 'kit:script:execute';
describe(commandName, () => {
  const $$ = testSetup();

  const validateVariables = jest.fn();

  Object.assign(global, { validateVariables });
  const script = `
    validateVariables(conn, context);
  `;
  beforeEach(async () => {
    await $$.stubAuths(new MockTestOrgData());
  });

  const args = ['-u', 'test@foo.bar'];
  it('script mode', async () => {
    const readFileSync = stubMethod($$.SANDBOX, fs, 'readFileSync').returns(
      script
    );
    await Command.run(args.concat(['-f', 'path/to/script.js']));
    expect(validateVariables.mock.calls.length).toBe(1);
    expect(validateVariables.mock.calls[0][0] instanceof Connection).toBe(true);
    expect(validateVariables.mock.calls[0][1] instanceof Command).toBe(true);
  });

  it('REPL mode', async () => {
    const replServer = {
      context: {},
      on: (event, callback) => {
        expect(event).toEqual('exit');
        callback();
      },
    };
    stubMethod($$.SANDBOX, repl, 'start').returns(replServer);
    await Command.run(args);
    expect(replServer.context['conn'] instanceof Connection).toBe(true);
    expect(replServer.context['context'] instanceof Command).toBe(true);
  });
});
