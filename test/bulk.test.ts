import { expect } from 'chai';
import { normalizeDateString } from '../src/bulk';

describe('normalizeDateString', () => {
  it('null', () => {
    expect(normalizeDateString(null)).to.eq(null);
  });

  it('2022/1/3', () => {
    expect(normalizeDateString('2022/1/3', 'YYYY-MM-DD')).to.eq('2022-01-03');
  });
});
