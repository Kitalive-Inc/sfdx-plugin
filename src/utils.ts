export function chunk(array, size) {
  const result = [];
  for (let i = 0, l = array.length; i < l; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
