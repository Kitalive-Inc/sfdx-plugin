import { normalizeDateString } from '../src/bulk';

describe('normalizeDateString', () => {
  it('null', () => {
    expect(normalizeDateString(null)).toBeNull();
  });

  it('2022/1/3', () => {
    expect(normalizeDateString('2022/1/3', 'YYYY-MM-DD')).toEqual('2022-01-03');
  });
});
