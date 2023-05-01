import * as path from 'path';
import * as repl from 'repl';
import { Messages } from '@salesforce/core';
import {
  Flags,
  SfCommand,
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
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ScriptExecute);
    const conn = flags['target-org']?.getConnection();
    module.paths.push('./node_modules');
    module.paths.push('.');

    if (flags.file) {
      const fileIndex = process.argv.indexOf(flags.file);
      const argv = yargs([]).parse(process.argv.slice(fileIndex + 1));
      const script = fs.readFileSync(flags.file).toString('utf8');
      const loader = (name) => {
        if (name.startsWith('.'))
          name = path.resolve(path.dirname(flags.file), name);
        return require(name);
      };
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const asyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      return await new asyncFunction(
        'require',
        'argv',
        'context',
        'conn',
        script
      )(loader, argv, this, conn);
    } else {
      this.log(messages.getMessage('repl.start'));

      const replServer = repl.start('> ');
      replServer.context.require = require;
      replServer.context.context = this;
      replServer.context.conn = conn;

      return new Promise((resolve) => replServer.on('exit', () => resolve()));
    }
  }
}
