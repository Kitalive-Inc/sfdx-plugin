import { Connection } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import esmock from 'esmock';

describe('kit script execute', () => {
  const $$ = new TestContext();

  beforeEach(async () => {
    stubSfCommandUx($$.SANDBOX);
  });

  const args = ['-o', 'test@foo.bar'];
  it('script mode', async () => {
    const script = "await conn.query('SELECT Id FROM Account');";
    const readFileSync = $$.SANDBOX.fake.returns(script);
    const runInContext = $$.SANDBOX.fake();
    const Command = await esmock(
      '../../../../src/commands/kit/script/execute.js',
      {
        fs: { readFileSync },
        vm: { runInContext },
      }
    );
    await Command.run(
      args.concat('-f', 'path/to/script.js', '--', '-a', '1', '-b')
    );
    expect(runInContext.calledOnce).to.be.true;
    expect(runInContext.args[0][0]).to.contain(script);
    expect(runInContext.args[0][1].argv).to.include({ a: 1, b: true });
    expect(runInContext.args[0][1].context instanceof Command).to.be.true;
    expect(runInContext.args[0][1].conn instanceof Connection).to.be.true;
    expect(runInContext.args[0][1].console).to.eq(console);
    expect(runInContext.args[0][2].filename).to.eq('path/to/script.js');
    expect(runInContext.args[0][2].lineOffset).to.eq(-1);
  });

  it('REPL mode', async () => {
    const replServer = {
      context: {} as any,
      on: (event: string, callback: () => void) => {
        expect(event).to.eq('exit');
        callback();
      },
    };
    const start = $$.SANDBOX.fake.returns(replServer);
    const Command = await esmock(
      '../../../../src/commands/kit/script/execute.js',
      {
        repl: { start },
      }
    );
    await Command.run(args);
    expect(replServer.context.conn instanceof Connection).to.be.true;
    expect(replServer.context.context instanceof Command).to.be.true;
  });
});
