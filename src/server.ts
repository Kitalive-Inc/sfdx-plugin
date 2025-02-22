import express from 'express';
import 'express-async-errors';
import open, { apps } from 'open';

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@kitalive/sfdx-plugin', 'server');

export abstract class ServerCommand extends SfCommand<void> {
  public static readonly flags = {
    browser: Flags.option({
      summary: messages.getMessage('flags.browser.summary'),
      char: 'b',
      options: ['chrome', 'firefox', 'edge'],
    })(),
    port: Flags.integer({
      summary: messages.getMessage('flags.port.summary'),
      char: 'p',
      default: 3000,
    }),
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public serve(
    options: {
      browser?: string;
      port: number;
    },
    callback: (server: express.Express) => void
  ) {
    const app = express();
    app.use(express.json());
    callback(app);
    app.post('/quit', () => process.exit(0));

    app.listen(options.port, 'localhost', async () => {
      const name = apps[options.browser as keyof typeof apps];
      this.log(`Listening on port ${options.port}`);
      this.log('Use Ctrl-C to stop');
      await open(`http://localhost:${options.port}`, { app: { name } });
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
