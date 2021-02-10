import { expect } from 'chai';
import { chunk } from '../src/utils';

describe('utils', () => {
  it('chunk', () => {
    expect(chunk([1,2,3,4,5], 2)).to.eql([[1,2], [3,4], [5]]);
  });
});
