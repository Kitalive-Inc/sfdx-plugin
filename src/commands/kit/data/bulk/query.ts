import fs from 'node:fs';
import { Messages } from '@salesforce/core';
import { write } from '@fast-csv/format';
import {
  Flags,
  SfCommand,
  requiredOrgFlagWithDeprecations,
} from '@salesforce/sf-plugins-core';
import { JsonMap } from '@salesforce/ts-types';
import { bulkQuery } from '../../../../bulk';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'data.bulk.query'
);

export default class QueryCommand extends SfCommand<JsonMap[]> {
  public static readonly summary = messages.getMessage('summary');

  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    query: Flags.string({
      char: 'q',
      required: true,
      summary: messages.getMessage('flags.query.summary'),
    }),
    csvfile: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.csvfile.summary'),
    }),
    all: Flags.boolean({
      summary: messages.getMessage('flags.all.summary'),
    }),
    wait: Flags.integer({
      char: 'w',
      summary: messages.getMessage('flags.wait.summary'),
      default: 5,
    }),
    'target-org': requiredOrgFlagWithDeprecations,
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<JsonMap[]> {
    const { flags } = await this.parse();
    const conn = flags['target-org'].getConnection(flags['api-version']);
    const file = flags.csvfile;

    this.spinner.start('Bulk query');
    try {
      const rows = await this.bulkQuery(conn, flags.query, {
        all: flags.all,
        wait: flags.wait,
      });
      if (!rows.length) {
        this.spinner.stop('no records');
        return rows;
      }

      this.spinner.stop(`${rows.length} records`);

      if (file) {
        this.writeCsv(rows, fs.createWriteStream(file));
      } else if (!this.jsonEnabled()) {
        this.writeCsv(rows, process.stdout);
      }

      return rows;
    } catch (e) {
      this.spinner.stop('error');
      throw e;
    }
  }

  private writeCsv(rows, stream) {
    write(rows, { headers: true, writeBOM: true }).pipe(stream);
  }

  private bulkQuery(conn, query, options) {
    return bulkQuery(conn, query, options);
  }
}
