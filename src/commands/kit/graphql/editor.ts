import express from 'express';
import open from 'open';

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'graphql.editor'
);

export default class GraphqlEditor extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    port: Flags.integer({
      summary: messages.getMessage('flags.port.summary'),
      char: 'p',
      default: 3000,
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(GraphqlEditor);
    const conn = flags['target-org']!.getConnection(flags['api-version']);

    const endpoint = `/services/data/v${conn.version}/graphql`;
    const app = express();
    app.use(express.static(__dirname + '/../../../../public/graphql'));
    app.use(express.json());

    app.post('/graphql', async (req, res) => {
      res.json(await conn.requestPost(endpoint, req.body));
    });
    app.post('/quit', () => process.exit(0));

    app.listen(flags.port, '127.0.0.1', async () => {
      this.log(`Listening on port ${flags.port}`);
      this.log('Use Ctrl-C to stop');
      await open(`http://localhost:${flags.port}`);
    });
  }

  public exit(code = 0): never {
    if (code === 130) {
      process.exit(0);
    } else {
      super.exit(code);
    }
  }
}
