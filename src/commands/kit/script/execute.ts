import { flags, SfdxCommand } from '@salesforce/command';
import * as fs from 'fs-extra';
import * as repl from 'repl';

export default class ScriptExecuteCommand extends SfdxCommand {
  public static description = [
    'execute Node.js scripts in SfdxCommand context',
    'Available variables in Node.js scripts',
    '  conn: jsforce Connection',
    '  context: SfdxCommand'
  ].join('\n');

  public static examples = [
    '$ sfdx kit:script -f ./path/to/script.js',
    '$ sfdx kit:script:execute',
    "> await conn.query('SELECT Id, Name FROM Account LIMIT 1')"
  ];

  public static aliases = ['kit:script'];
  public static strict = false;
  protected static requiresUsername = true;
  protected static requiresProject = false;

  protected static flagsConfig = {
    file: flags.filepath({ char: 'f', description: 'the path of the Node.js script file to execute' })
  };

  public async run(): Promise<void> {
    const { file } = this.flags;

    if (file) {
      const script = fs.readFileSync(file).toString('utf8');
      const asyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      new asyncFunction('context', 'conn', script)(this, this.org.getConnection());
    } else {
      this.ux.log('Starting sfdx REPL mode');
      this.ux.log('Available variables');
      this.ux.log('  conn: jsforce Connection');
      this.ux.log('  context: SfdxCommand');
      this.ux.log('Type .exit or Press Ctrl+D to exit the REPL');

      const replServer = repl.start('> ');
      replServer.context.context = this;
      replServer.context.conn = this.org.getConnection();

      return new Promise(
        resolve => replServer.on('exit', () => resolve())
      );
    }
  }
}
