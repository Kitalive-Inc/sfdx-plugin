import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import repl from 'node:repl';
import vm from 'node:vm';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import yargs from 'yargs';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
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
    'target-org': Flags.optionalOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<void> {
    const { flags, argv } = await this.parse(ScriptExecute);
    const conn = flags['target-org']?.getConnection(flags['api-version']);
    const require = createRequire(path.resolve(flags.file ?? './repl.js'));

    if (flags.file) {
      const script = fs.readFileSync(flags.file).toString('utf8');
      const vmContext = vm.createContext({
        require,
        argv: yargs([]).parse(argv as string[]),
        context: this,
        conn,
        console,
      });
      vm.runInContext('(async () => {\n' + script + '\n})();', vmContext, {
        filename: flags.file,
        lineOffset: -1,
        // @ts-ignore
        importModuleDynamically: vm.constants?.USE_MAIN_CONTEXT_DEFAULT_LOADER,
      });
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
