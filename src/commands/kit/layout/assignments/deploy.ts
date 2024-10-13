import path from 'node:path';
import { Messages } from '@salesforce/core';
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import fs from 'fs-extra';
import { SaveResult } from '@jsforce/jsforce-node/lib/api/metadata.js';
import { LayoutAssignmentsPerProfile } from '../../../../types.js';
import { updateMetadata } from '../../../../metadata.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'layout.assignments.deploy'
);

export default class LayoutAssignmentsDeploy extends SfCommand<SaveResult[]> {
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
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<SaveResult[]> {
    const { flags } = await this.parse(LayoutAssignmentsDeploy);
    const conn = flags['target-org'].getConnection(flags['api-version']);

    this.spinner.start(messages.getMessage('spinner.start', [flags.file]));
    const layoutAssignmentsPerProfile = await this.readFile(flags.file);
    const profiles = Object.entries(layoutAssignmentsPerProfile).map(
      ([fullName, layoutAssignments]) => ({ fullName, layoutAssignments })
    );
    return updateMetadata(conn, 'Profile', profiles);
  }

  private readFile(file: string): Promise<LayoutAssignmentsPerProfile> {
    const inputFile = path.join(this.project!.getPath(), file);
    return fs.readJson(inputFile) as Promise<LayoutAssignmentsPerProfile>;
  }
}
