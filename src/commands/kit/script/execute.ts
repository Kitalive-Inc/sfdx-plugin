import * as path from 'node:path';
import * as repl from 'node:repl';
import { Messages } from '@salesforce/core';
import {
  Flags,
  SfCommand,
  StandardColors,
  optionalOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import * as fs from 'fs-extra';
import yargs from 'yargs';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'script.execute'
);

export default class ScriptExecute extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly examples = messages.getMessages('examples');

  public static readonly aliases = ['kit:script'];
  public static strict = false;

  public static readonly flags = {
    file: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.file.summary'),
    }),
    'target-org': optionalOrgFlagWithDeprecations,
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<void> {
    const { flags, argv } = await this.parse(ScriptExecute);
    const conn = flags['target-org']?.getConnection(flags['api-version']);
    module.paths.push('./node_modules');
    module.paths.push('.');

    const createLoader = (baseDir) => (name) => {
      if (name.startsWith('.')) name = path.resolve(baseDir, name);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return require(name);
    };
    if (flags.file) {
      const script = fs.readFileSync(flags.file).toString('utf8');
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const asyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      const func = new asyncFunction(
        'require',
        'argv',
        'context',
        'conn',
        script
      );
      try {
        await func(
          createLoader(path.dirname(flags.file)),
          yargs([]).parse(argv as string[]),
          this,
          conn
        );
      } catch (e) {
        const message = e.stack.split('\n')[0];
        const m = e.stack.match(/<anonymous>:(\d+):(\d+)/);
        if (m) {
          const code = func.toString().split('\n')[m[1] - 1];
          this.log(StandardColors.error(`at line ${m[1] - 2}: ${message}`));
          this.log(code);
          this.log(StandardColors.error(' '.repeat(m[2] - 1) + '^'));
        }
        throw e;
      }
      return;
    } else {
      this.log(messages.getMessage('repl.start'));

      const replServer = repl.start('> ');
      replServer.context.require = createLoader('.');
      replServer.context.context = this;
      replServer.context.conn = conn;

      return new Promise((resolve) => replServer.on('exit', () => resolve()));
    }
  }
}
