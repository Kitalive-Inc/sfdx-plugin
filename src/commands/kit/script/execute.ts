import { flags, SfdxCommand } from '@salesforce/command';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as repl from 'repl';
import yargs from 'yargs';

export default class ScriptExecuteCommand extends SfdxCommand {
  public static description = [
    'execute Node.js scripts in SfdxCommand context',
    'Available variables in Node.js scripts',
    '  argv: Parsed command line arguments after the file option',
    '  conn: jsforce Connection',
    '  context: SfdxCommand'
  ].join('\n');

  public static examples = [
    '$ sfdx kit:script -f ./path/to/script.js',
    '$ sfdx kit:script:execute',
    "> await conn.query('SELECT Id, Name FROM Account LIMIT 1')",
    'Top level await is not enabled by default in REPL before Node.js v16',
    '$ NODE_OPTIONS=--experimental-repl-await sfdx kit:script:execute'
  ];

  public static aliases = ['kit:script'];
  public static strict = false;
  protected static supportsUsername = true;
  protected static requiresProject = false;

  protected static flagsConfig = {
    file: flags.filepath({ char: 'f', description: 'the path of the Node.js script file to execute' })
  };

  public async run(): Promise<void> {
    const { file } = this.flags;
    module.paths.push('./node_modules');

    if (file) {
      const fileIndex = process.argv.indexOf(file);
      const argv = yargs([]).parse(process.argv.slice(fileIndex + 1));
      const script = fs.readFileSync(file).toString('utf8');
      const loader = name => {
        if (name.startsWith('.')) name = path.resolve(path.dirname(file), name);
        return require(name);
      };
      const asyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      return await new asyncFunction('require', 'argv', 'context', 'conn', script)(loader, argv, this, this.org?.getConnection());
    } else {
      this.ux.log('Starting sfdx REPL mode');
      this.ux.log('Available variables');
      this.ux.log('  conn: jsforce Connection');
      this.ux.log('  context: SfdxCommand');
      this.ux.log('Type .exit or Press Ctrl+D to exit the REPL');

      const replServer = repl.start('> ');
      replServer.context.require = require;
      replServer.context.context = this;
      replServer.context.conn = this.org?.getConnection();

      return new Promise(
        resolve => replServer.on('exit', () => resolve())
      );
    }
  }
}
