import * as repl from 'repl';
import { Connection } from '@salesforce/core';
import { TestContext } from '@salesforce/core/lib/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { spy } from 'sinon';
import Command from '../../../../src/commands/kit/script/execute';

describe('kit script execute', () => {
  const $$ = new TestContext();

  const validateVariables = spy();

  Object.assign(global, { validateVariables });
  const script = `
    validateVariables(conn, context);
  `;

  beforeEach(async () => {
    stubSfCommandUx($$.SANDBOX);
  });

  const args = ['-o', 'test@foo.bar'];
  it('script mode', async () => {
    stubMethod($$.SANDBOX, fs, 'readFileSync').returns(script);
    await Command.run(args.concat('-f', 'path/to/script.js'));
    expect(validateVariables.calledOnce).to.be.true;
    expect(validateVariables.args[0][0] instanceof Connection).to.be.true;
    expect(validateVariables.args[0][1] instanceof Command).to.be.true;
  });

  it('REPL mode', async () => {
    const replServer = {
      context: {},
      on: (event, callback) => {
        expect(event).to.eq('exit');
        callback();
      },
    };
    stubMethod($$.SANDBOX, repl, 'start').returns(replServer);
    await Command.run(args);
    expect(replServer.context['conn'] instanceof Connection).to.be.true;
    expect(replServer.context['context'] instanceof Command).to.be.true;
  });
});
