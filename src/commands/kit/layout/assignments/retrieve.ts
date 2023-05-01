import * as path from 'path';
import { Connection, Messages, SfError } from '@salesforce/core';
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import * as glob from 'fast-glob';
import * as fs from 'fs-extra';
import {
  LayoutAssignment,
  LayoutAssignmentsPerProfile,
  ProfileMetadata,
} from '../../../../types';
import { completeDefaultNamespace, readMetadata } from '../../../../metadata';

function assignmentsPerObject(
  assignments: LayoutAssignment[],
  filterObjects?: string[]
) {
  const result = new Map();
  for (const assignment of assignments) {
    const object = assignment.layout.split('-')[0];
    if (filterObjects && !filterObjects.includes(object)) continue;
    const a = result.get(object) ?? [];
    a.push(assignment);
    result.set(object, a);
  }
  return result;
}

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'layout.assignments.retrieve'
);

export default class LayoutAssignmentsRetrieve extends SfCommand<LayoutAssignmentsPerProfile> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly requiresProject = true;

  public static readonly flags = {
    file: Flags.string({
      char: 'f',
      required: true,
      summary: messages.getMessage('flags.file.summary'),
      default: 'config/layout-assignments.json',
    }),
    profile: Flags.string({
      char: 'p',
      required: false,
      multiple: true,
      summary: messages.getMessage('flags.profile.summary'),
    }),
    sobject: Flags.string({
      char: 's',
      required: false,
      multiple: true,
      summary: messages.getMessage('flags.sobject.summary'),
    }),
    merge: Flags.boolean({
      required: false,
      summary: messages.getMessage('flags.merge.summary'),
    }),
    'target-org': requiredOrgFlagWithDeprecations,
  };

  public async run(): Promise<LayoutAssignmentsPerProfile> {
    const { flags } = await this.parse(LayoutAssignmentsRetrieve);
    const conn = flags['target-org'].getConnection();
    const filterObjects = flags.sobject
      ? flags.sobject
      : await this.objectNamesFromLayouts();
    if (filterObjects.length === 0)
      throw new SfError(messages.getMessage('error.noSObjects'));

    const data: LayoutAssignmentsPerProfile = flags.merge
      ? await this.readFile(flags.file)
      : {};

    const profileNames = flags.profile
      ? flags.profile
      : await this.getProfileNames(conn);

    this.spinner.start(messages.getMessage('spinner.start'));

    const profiles = (await readMetadata(
      conn,
      'Profile',
      profileNames
    )) as ProfileMetadata[];
    for (const profile of profiles) {
      if (!profile.fullName || !profile.layoutAssignments) continue;
      let assignmentsMap = assignmentsPerObject(
        profile.layoutAssignments,
        await completeDefaultNamespace(conn, filterObjects)
      );
      if (data[profile.fullName]) {
        const oldAssignmentsMap = assignmentsPerObject(data[profile.fullName]);
        assignmentsMap = new Map([...oldAssignmentsMap, ...assignmentsMap]);
      }
      data[profile.fullName] = Array.from(assignmentsMap.values())
        .flat()
        .sort((a, b) => a.layout.localeCompare(b.layout));
    }
    this.spinner.stop();

    this.log(
      messages.getMessage('result', [
        flags.file,
        profileNames.join(', '),
        filterObjects.join(', '),
      ])
    );
    await this.writeFile(flags.file, data);

    return data;
  }

  public async objectNamesFromLayouts(): Promise<string[]> {
    // eslint-disable-next-line
    const config: any = await this.getProjectConfig();
    const packageDir =
      config.packageDirectories &&
      config.packageDirectories.find((dir) => dir.default);
    if (!packageDir) return [];

    const pattern = path.join(
      this.project.getPath(),
      packageDir.path,
      '**/*.layout-meta.xml'
    );
    const objectCounts = {};
    for (const filepath of await this.findFiles(pattern)) {
      const object = path.basename(filepath).split('-')[0];
      objectCounts[object] = (objectCounts[object] || 0) + 1;
    }
    return Object.keys(objectCounts)
      .filter((object) => objectCounts[object] >= 2)
      .sort();
  }

  private getProjectConfig() {
    return this.project.resolveProjectConfig();
  }

  private getProfileNames(conn: Connection): Promise<string[]> {
    return conn.metadata
      .list({ type: 'Profile' })
      .then((profiles) => profiles.map((p) => p.fullName));
  }

  private findFiles(pattern: string): Promise<string[]> {
    return glob(pattern);
  }

  private readFile(file: string): Promise<LayoutAssignmentsPerProfile> {
    return fs.readJson(path.join(this.project.getPath(), file));
  }

  private writeFile(file: string, data: LayoutAssignmentsPerProfile) {
    return fs.outputJson(path.join(this.project.getPath(), file), data, {
      spaces: '\t',
    });
  }
}
