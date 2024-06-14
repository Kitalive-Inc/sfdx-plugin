import { Messages } from '@salesforce/core';
import { ServerCommand } from '../../../server';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'graphql.editor'
);

export default class GraphqlEditor extends ServerCommand {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = ServerCommand.flags;

  public async run(): Promise<void> {
    const { flags } = await this.parse(GraphqlEditor);
    const conn = flags['target-org']!.getConnection(flags['api-version']);

    const endpoint = `/services/data/v${conn.version}/graphql`;
    this.serve(flags.port, (app) => {
      app.get('/', (req, res) => {
        res.sendFile('index.html', {
          root: __dirname + '/../../../../public/graphql',
        });
      });

      app.post('/api/graphql', async (req, res) => {
        res.json(await conn.requestPost(endpoint, req.body));
      });
    });
  }
}
