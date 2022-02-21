import { write } from '@fast-csv/format';
import { flags, SfdxCommand } from '@salesforce/command';
import { JsonMap } from '@salesforce/ts-types';
import * as fs from 'fs';
import { bulkQuery } from '../../../../bulk';

export default class QueryCommand extends SfdxCommand {
  public static description = 'bulk query records';

  public static examples = [
    '$ sfdx kit:data:bulk:query -q \'SELECT Id, Name FROM Account\' -f ./path/to/Account.csv'
  ];

  protected static requiresUsername = true;
  protected static requiresProject = false;

  protected static flagsConfig = {
    query: flags.string({ char: 'q', required: true, description: 'SOQL query to export' }),
    csvfile: flags.string({ char: 'f', description: 'output csv file (default: standard output)' })
  };

  public async run(): Promise<JsonMap[]> {
    const conn = this.org.getConnection();
    const file = this.flags.csvfile;

    this.ux.startSpinner('Bulk query');
    try {
      const rows = await this.bulkQuery(conn, this.flags.query);
      if (!rows.length) {
        this.ux.stopSpinner('no records');
        return rows;
      }

      this.ux.stopSpinner(`${rows.length} records`);

      if (file) {
        this.writeCsv(rows, fs.createWriteStream(file));
      } else if (!this.flags.json) {
        this.writeCsv(rows, process.stdout);
      }

      return rows;
    } catch (e) {
      this.ux.stopSpinner('error');
      throw e;
    }
  }

  private writeCsv(rows, stream) {
    write(rows, { headers: true, writeBOM: true }).pipe(stream);
  }

  private bulkQuery(conn, query) {
    return bulkQuery(conn, query);
  }
}
