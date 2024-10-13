import { expect } from 'chai';
import { normalizeDateString } from '../src/bulk.js';

describe('normalizeDateString', () => {
  it('null', () => {
    // @ts-ignore
    expect(normalizeDateString(null)).to.be.null;
  });

  it('2022/1/3', () => {
    expect(normalizeDateString('2022/1/3', 'YYYY-MM-DD')).to.eq('2022-01-03');
  });
});
