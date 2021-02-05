import { flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import * as fs from 'fs-extra';
import * as path from 'path';

export default class LayoutAssignmentsRetrieveCommand extends SfdxCommand {
  public static description = 'retrieve page layout assignments';

  public static examples = [
    '$ sfdx kit:layout:assignments:retrieve',
    '$ sfdx kit:layout:assignments:retrieve -p Admin,Standard,StandardAul -o Account,CustomObject__c -f config/layout-assignments.scratch.json',
    '$ sfdx kit:layout:assignments:retrieve -u me@my.org -f config/layout-assignments.sandbox.json'
  ];

  protected static requiresUsername = true;
  protected static requiresProject = true;

  protected static flagsConfig = {
    file: flags.string({ char: 'f', required: true, description: 'output file path', default: 'config/layout-assignments.json' }),
    profile: flags.string({ char: 'p', required: false, description: 'comma separated profile names to retrieve (default: all profiles)' }),
    object: flags.string({ char: 'o', required: false, description: 'comma separated object names to retrieve (default: objects which have multiple layouts)' }),
    merge: flags.boolean({ required: false, description: 'merge retrieved configurations with existing file' })
  };

  public async run(): Promise<AnyJson> {
    const outputFile = path.join(this.project.path, this.flags.file);
    const filterObjects = this.flags.object ? this.flags.object.split(',') : await this.objectNamesFromLayouts();
    const layoutAssignmentsPerProfile = this.flags.merge ? await fs.readJson(outputFile).catch(() => {}) : {};

    const conn = this.org.getConnection();

    const fullNames = this.flags.profile ?
      this.flags.profile.split(',') :
      await conn.metadata.list({ type: 'Profile' }).then(profiles => profiles.map(p => p.fullName));

    // limit 10 records per one API call
    for (let i = 0; i < fullNames.length; i += 10) {
      let profiles = await conn.metadata.read('Profile', fullNames.slice(i, i + 10));
      if (!Array.isArray(profiles)) profiles = [profiles];
      for (const profile of profiles) {
        if (!profile.fullName || !profile.layoutAssignments) continue;
        layoutAssignmentsPerProfile[profile.fullName] = profile.layoutAssignments.filter(assignment =>
          filterObjects.includes(assignment.layout.split('-')[0])
        ).sort((a, b) => a.layout.localeCompare(b.layout));
      }
    }

    this.ux.log('retrieve layout assignments to ' + this.flags.file);
    await fs.outputJson(outputFile, layoutAssignmentsPerProfile, { spaces: '\t' });

    return layoutAssignmentsPerProfile;
  }

  private async objectNamesFromLayouts() {
    const config = await this.project.resolveProjectConfig();
    const packageDir = config.packageDirectories.find(dir => dir.default);
    const layoutPath = path.join(this.project.path, packageDir.path, 'main/default/layouts');
    const objectCounts = {};
    for (const filename of await fs.readdir(layoutPath)) {
        const object = filename.split('-')[0];
        objectCounts[object] = (objectCounts[object] || 0) + 1;
    }
    const objects = Object.keys(objectCounts).filter(object => objectCounts[object] >= 2);
    if (objects.length === 0) throw new Error('There are no objects which have multiple layouts');
    return objects;
  }
}
