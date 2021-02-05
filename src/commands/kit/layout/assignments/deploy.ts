import { flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import * as fs from 'fs-extra';
import * as path from 'path';

export default class LayoutAssignmentsDeployCommand extends SfdxCommand {
  public static description = 'deploy page layout assignments';

  public static examples = [
    '$ sfdx kit:layout:assignments:deploy',
    '$ sfdx kit:layout:assignments:deploy -f config/layout-assignments.scratch.json',
    '$ sfdx kit:layout:assignments:deploy -u me@my.org -f config/layout-assignments.sandbox.json'
  ];

  protected static requiresUsername = true;
  protected static requiresProject = true;

  protected static flagsConfig = {
    file: flags.string({ char: 'f', required: true, description: 'input file path', default: 'config/layout-assignments.json' })
  };

  public async run(): Promise<AnyJson> {
    const inputFile = path.join(this.project.path, this.flags.file);
    const layoutAssignmentsPerProfile = await fs.readJson(inputFile);
    const conn = this.org.getConnection();
    const data = Object.entries(layoutAssignmentsPerProfile).map(([fullName, layoutAssignments]) => ({ fullName, layoutAssignments }));
    this.ux.log('deploy layout assignments from ' + this.flags.file);

    return conn.metadata.update('Profile', data);
  }
}
