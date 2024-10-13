import { Readable } from 'stream';
import { expect } from 'chai';
import * as csv from 'fast-csv';
import iconv from 'iconv-lite';
import * as utils from '../src/utils.js';

describe('chunk', () => {
  it('array is smaller than chunk size', () => {
    expect(utils.chunk(['a', 'b', 'c'], 10)).to.eql([['a', 'b', 'c']]);
  });

  it('array is larger than chunk size', () => {
    expect(utils.chunk([1, 2, 3, 4, 5], 2)).to.eql([[1, 2], [3, 4], [5]]);
  });
});

describe('range', () => {
  it('1 to 5', () => {
    expect(utils.range(1, 5)).to.eql([1, 2, 3, 4, 5]);
  });

  it('12 to 15', () => {
    expect(utils.range(12, 15)).to.eql([12, 13, 14, 15]);
  });

  it('1 to -1', () => {
    expect(utils.range(1, -1)).to.eql([]);
  });
});

describe('parseCsv', () => {
  const csvRows = [
    { col1: 'col1_1', col2: 'col2_1', col3: 'col3_1' },
    { col1: 'col1_2', col2: 'col2_2', col3: 'col3_2' },
    { col1: 'col1_3', col2: 'col2_3', col3: 'col3_3' },
  ];

  const csvStream = () => csv.write(csvRows, { headers: true });

  it('with no options', async () => {
    const rows = await utils.parseCsv(csvStream());
    expect(rows).to.eql(csvRows);
  });

  it('with mapping', async () => {
    const rows = await utils.parseCsv(csvStream(), {
      mapping: {
        Field1__c: 'col1',
        Field2__c: 'col3',
      },
    });
    expect(rows).to.eql([
      { Field1__c: 'col1_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_2', Field2__c: 'col3_2' },
      { Field1__c: 'col1_3', Field2__c: 'col3_3' },
    ]);
  });

  it('with invalid mapping', async () => {
    try {
      await utils.parseCsv(csvStream(), {
        mapping: {
          Field1__c: 'col1',
          Field2__c: 'invalid_col',
        },
      });
      throw new Error('no error is thrown');
    } catch (e: unknown) {
      expect((e as Error).message).to.contain(
        "The column 'invalid_col' is not found"
      );
    }
  });

  it('with convert', async () => {
    const rows = await utils.parseCsv(csvStream(), {
      convert: (row) => {
        if (row.col1 === 'col1_2') return null;

        return {
          Field1__c: `${row.col1} ${row.col2}`,
          Field2__c: row.col3,
        };
      },
    });
    expect(rows).to.eql([
      { Field1__c: 'col1_1 col2_1', Field2__c: 'col3_1' },
      { Field1__c: 'col1_3 col2_3', Field2__c: 'col3_3' },
    ]);
  });

  it('with delimiter', async () => {
    const rows = await utils.parseCsv(Readable.from('a:b:c\nv1:v2:v3'), {
      delimiter: ':',
    });
    expect(rows).to.eql([{ a: 'v1', b: 'v2', c: 'v3' }]);
  });

  it('with quote', async () => {
    const rows = await utils.parseCsv(
      Readable.from('a,b,c,d\n\'1,2\',3,"4,5"'),
      {
        quote: "'",
      }
    );
    expect(rows).to.eql([{ a: '1,2', b: '3', c: '"4', d: '5"' }]);
  });

  it('with skiplines', async () => {
    const rows = await utils.parseCsv(Readable.from('skip1,skip2\na,b\n1,2'), {
      skiplines: 1,
    });
    expect(rows).to.eql([{ a: '1', b: '2' }]);
  });

  it('with trim', async () => {
    const rows = await utils.parseCsv(Readable.from('a,b\n 1\t ,   2'), {
      trim: true,
    });
    expect(rows).to.eql([{ a: '1', b: '2' }]);
  });

  it('with encoding', async () => {
    const rows = await utils.parseCsv(
      Readable.from('col1,col2\n値1,値2').pipe(iconv.encodeStream('cp932')),
      { encoding: 'cp932' }
    );
    expect(rows).to.eql([{ col1: '値1', col2: '値2' }]);
  });
});
