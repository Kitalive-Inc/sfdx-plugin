import { Connection, Messages } from '@salesforce/core';
import * as csv from 'fast-csv';
import express from 'express';
import { ServerCommand } from '../../../server';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  '@kitalive/sfdx-plugin',
  'metadata.dependencies'
);

type Metadata = {
  id: string;
  type: string;
  fullName: string;
};

type MetadataCache = {
  [id: string]: Set<Metadata>;
};

function orderByField<T>(array: T[], field: string): T[] {
  return array.sort((a, b) =>
    String(a[field] ?? '').localeCompare(String(b[field] ?? ''))
  );
}

function packageXml(data: Metadata[], version: string): string {
  data.sort(
    (a, b) =>
      a.type.localeCompare(b.type) || a.fullName.localeCompare(b.fullName)
  );
  const metadataByType: { [type: string]: Metadata[] } = {};
  for (const meta of data) {
    (metadataByType[meta.type] ??= []).push(meta);
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
    Object.entries(metadataByType)
      .map(
        ([name, members]) =>
          '  <types>\n' +
          members
            .map((meta) => `    <members>${meta.fullName}</members>`)
            .join('\n') +
          `\n    <name>${name}</name>\n` +
          '  </types>'
      )
      .join('\n') +
    `\n  <version>${version}</version>\n</Package>`
  );
}

class MetadataQuery {
  private conn: Connection;
  private describeCache: string[];
  private typeCache: { [type: string]: string } = {};
  private metadataCache: { [type: string]: Map<string, Metadata> } = {};
  private usageCache: MetadataCache = {};
  private referencesCache: MetadataCache = {};
  private recursiveUsageCache: MetadataCache = {};
  private recursiveReferencesCache: MetadataCache = {};

  public constructor(connection: Connection) {
    this.conn = connection;
  }

  public async describe(): Promise<string[]> {
    if (!this.describeCache) {
      const { metadataObjects } = await this.conn.metadata.describe();
      this.describeCache = metadataObjects
        .flatMap((m) => [m.xmlName].concat(m.childXmlNames))
        .sort();
      this.describeCache.forEach((name) => (this.typeCache[name] = name));
    }
    return this.describeCache;
  }

  public async list(type: string): Promise<Metadata[]> {
    const idMap = await this.getMetadataMap(type);
    return Array.from(idMap.values());
  }

  public async usage(
    type: string,
    id: string,
    recursive?: boolean
  ): Promise<Metadata[]> {
    const cache = recursive ? this.recursiveUsageCache : this.usageCache;
    const result = [
      ...(await this.dependencies(
        id,
        cache,
        'RefMetadataComponentId',
        recursive
      )),
    ];
    if (recursive) {
      const idMap = await this.getMetadataMap(type);
      result.unshift(idMap.get(id));
    }
    return result;
  }

  public async references(
    type: string,
    id: string,
    recursive?: boolean
  ): Promise<Metadata[]> {
    const cache = recursive
      ? this.recursiveReferencesCache
      : this.referencesCache;
    const result = [
      ...(await this.dependencies(id, cache, 'MetadataComponentId', recursive)),
    ];
    if (recursive) {
      const idMap = await this.getMetadataMap(type);
      result.unshift(idMap.get(id));
    }
    return result;
  }

  private async getMetadataMap(type: string): Promise<Map<string, Metadata>> {
    if (this.metadataCache[type]) return this.metadataCache[type];
    const idMap = new Map<string, Metadata>();
    const list = await this.conn.metadata.list({ type });
    for (const meta of orderByField(list, 'fullName')) {
      idMap.set(meta.id, meta);
    }
    this.metadataCache[type] = idMap;
    return idMap;
  }

  private async dependencies(
    ids: string | string[],
    cache: MetadataCache,
    sourceIdField: string,
    recursive?: boolean,
    result?: Set<Metadata>
  ): Promise<Set<Metadata>> {
    result ??= new Set();
    ids = [].concat(ids);
    const dependentIds = [];
    const fetchIds = [];
    const add = (item) => {
      if (result.has(item)) return;
      result.add(item);
      dependentIds.push(item.id);
    };

    for (const id of ids) {
      if (cache[id]) {
        cache[id].forEach(add);
      } else {
        fetchIds.push(id);
        cache[id] = new Set();
      }
    }

    if (fetchIds.length) {
      const targetFieldPrefix =
        sourceIdField === 'MetadataComponentId' ? 'Ref' : '';
      const items = await this.conn.tooling
        .sobject('MetadataComponentDependency')
        .select(
          'MetadataComponentId, MetadataComponentType, RefMetadataComponentId, RefMetadataComponentType'
        )
        .where({ [sourceIdField]: fetchIds });
      for (const item of items) {
        const cacheSet = (cache[item[sourceIdField]] ??= new Set());
        const type = item[targetFieldPrefix + 'MetadataComponentType'];
        if (!this.typeCache[type]) continue;
        // eslint-disable-next-line no-await-in-loop
        const idMap = await this.getMetadataMap(type);
        const meta = idMap.get(item[targetFieldPrefix + 'MetadataComponentId']);
        if (!meta) continue;
        cacheSet.add(meta);
        add(meta);
      }
    }

    if (recursive && dependentIds.length) {
      return this.dependencies(
        dependentIds,
        cache,
        sourceIdField,
        recursive,
        result
      );
    }

    return result;
  }
}

export default class MetadataDependencies extends ServerCommand {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = ServerCommand.flags;

  public async run(): Promise<void> {
    const { flags } = await this.parse(MetadataDependencies);
    const conn = flags['target-org']!.getConnection(flags['api-version']);
    const metadata = new MetadataQuery(conn);
    await metadata.describe();

    function handleDependencies(
      data: Metadata[],
      format: string,
      res: express.Response
    ) {
      switch (format) {
        case 'xml':
          res.set('Content-Type', 'text/xml');
          res.send(packageXml(data, conn.version));
          break;
        case 'csv':
          res.set('Content-Type', 'text/csv');
          csv.writeToStream(res, data, { headers: ['fullName', 'type'] });
          break;
        default:
          res.json(data);
          break;
      }
    }

    this.serve(flags.port, (app) => {
      app.use(
        '/assets',
        express.static(__dirname + '/../../../../public/dist/assets')
      );

      app.get('/', (req, res) => {
        res.sendFile('metadata-dependencies.html', {
          root: __dirname + '/../../../../public/dist',
        });
      });

      app.get('/api/metadata', async (req, res) => {
        res.json(await metadata.describe());
      });

      app.get('/api/metadata/:type', async (req, res) => {
        res.json(await metadata.list(req.params.type));
      });

      app.get('/api/metadata/usage/:type/:id', async (req, res) => {
        const data = await metadata.usage(
          req.params.type,
          req.params.id,
          req.query.recursive === 'true'
        );
        handleDependencies(data, req.query.format, res);
      });

      app.get('/api/metadata/references/:type/:id', async (req, res) => {
        const data = await metadata.references(
          req.params.type,
          req.params.id,
          req.query.recursive === 'true'
        );
        handleDependencies(data, req.query.format, res);
      });
    });
  }
}
