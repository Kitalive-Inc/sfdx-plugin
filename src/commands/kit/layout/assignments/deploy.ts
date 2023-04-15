import { flags, SfdxCommand } from '@salesforce/command';
import * as fs from 'fs-extra';
import { SaveResult } from 'jsforce/api/metadata';
import * as path from 'path';
import { LayoutAssignmentsPerProfile } from '../../../../types';
import { updateMetadata } from '../../../../metadata';

export default class LayoutAssignmentsDeployCommand extends SfdxCommand {
  public static description = 'deploy page layout assignments from JSON file';

  public static examples = [
    '$ sfdx kit:layout:assignments:deploy',
    '$ sfdx kit:layout:assignments:deploy -f config/layout-assignments.scratch.json',
    '$ sfdx kit:layout:assignments:deploy -u me@my.org -f config/layout-assignments.sandbox.json',
  ];

  protected static requiresUsername = true;
  protected static requiresProject = true;

  protected static flagsConfig = {
    file: flags.string({
      char: 'f',
      required: true,
      description: 'input file path',
      default: 'config/layout-assignments.json',
    }),
  };

  public async run(): Promise<SaveResult[]> {
    this.ux.log('deploy layout assignments from ' + this.flags.file);
    const layoutAssignmentsPerProfile = await this.readFile(this.flags.file);
    const profiles = Object.entries(layoutAssignmentsPerProfile).map(
      ([fullName, layoutAssignments]) => ({ fullName, layoutAssignments })
    );
    return updateMetadata(this.org.getConnection(), 'Profile', profiles);
  }

  private readFile(file): Promise<LayoutAssignmentsPerProfile> {
    const inputFile = path.join(this.project.getPath(), file);
    return fs.readJson(inputFile);
  }
}
