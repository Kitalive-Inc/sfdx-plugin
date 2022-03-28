import { flags, SfdxCommand } from '@salesforce/command';
import { SfdxError } from '@salesforce/core';
import * as glob from 'fast-glob';
import * as fs from 'fs-extra';
import * as path from 'path';
import { LayoutAssignmentsPerProfile, ProfileMetadata } from '../../../../types';
import { chunk } from '../../../../utils';

export default class LayoutAssignmentsRetrieveCommand extends SfdxCommand {
  public static description = 'retrieve page layout assignments and save to JSON file';

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

  public async run(): Promise<LayoutAssignmentsPerProfile> {
    const filterObjects = this.flags.object ? this.flags.object.split(',') : await this.objectNamesFromLayouts();
    if (filterObjects.length === 0) throw new SfdxError('There are no objects to retrieve');

    const data: LayoutAssignmentsPerProfile = this.flags.merge ? await this.readFile(this.flags.file) : {};

    const profileNames = this.flags.profile ? this.flags.profile.split(',') : await this.getProfileNames();

    this.ux.log(`retrieve layout assignments\n\tprofiles: ${profileNames.join(', ')}\n\tobjects: ${filterObjects.join(', ')}`);

    // limit 10 records per one API call
    const profiles = await Promise.all(chunk(profileNames, 10).map(names => this.getProfiles(names))).then(a => [].concat(...a));
    for (const profile of profiles) {
      if (!profile.fullName || !profile.layoutAssignments) continue;
      data[profile.fullName] = profile.layoutAssignments.filter(
        assignment => filterObjects.includes(assignment.layout.split('-')[0])
      ).sort((a, b) => a.layout.localeCompare(b.layout));
    }

    this.ux.log('save to ' + this.flags.file);
    await this.writeFile(this.flags.file, data);

    return data;
  }

  public async objectNamesFromLayouts(): Promise<string[]> {
    // tslint:disable-next-line
    const config: any = await this.getProjectConfig();
    const packageDir = config.packageDirectories && config.packageDirectories.find(dir => dir.default);
    if (!packageDir) return [];

    const pattern = path.join(this.project.getPath(), packageDir.path, '**/*.layout-meta.xml');
    const objectCounts = {};
    for (const filepath of await this.findFiles(pattern)) {
        const object = path.basename(filepath).split('-')[0];
        objectCounts[object] = (objectCounts[object] || 0) + 1;
    }
    return Object.keys(objectCounts).filter(object => objectCounts[object] >= 2).sort();
  }

  private getProjectConfig() {
    return this.project.resolveProjectConfig();
  }

  private getProfileNames(): Promise<string[]> {
    return this.org.getConnection().metadata.list({ type: 'Profile' }).then(profiles => profiles.map(p => p.fullName));
  }

  private getProfiles(names: string[]): Promise<ProfileMetadata[]> {
    return this.org.getConnection().metadata.read('Profile', names) as Promise<ProfileMetadata[]>;
  }

  private findFiles(pattern: string): Promise<string[]> {
    return glob(pattern);
  }

  private readFile(file: string): Promise<LayoutAssignmentsPerProfile> {
    return fs.readJson(path.join(this.project.getPath(), file));
  }

  private writeFile(file: string, data: LayoutAssignmentsPerProfile) {
    return fs.outputJson(path.join(this.project.getPath(), file), data, { spaces: '\t' });
  }
}
