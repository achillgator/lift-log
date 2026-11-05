import { expect, test } from 'vitest';
import { crc32, dosDate, makeZip } from './zip';

const enc = new TextEncoder();

test('crc32 check value', () => {
  expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  expect(crc32(new Uint8Array())).toBe(0);
});

test('dosDate', () => {
  expect(dosDate('2000-01-03')).toBe((20 << 9) | (1 << 5) | 3);
  expect(dosDate('1970-01-01')).toBe((0 << 9) | (1 << 5) | 1);
  expect(dosDate()).toBe(33);
});

/** Reads a stored zip back: enough of the format to check what makeZip wrote. */
function readZip(zip: Uint8Array): { name: string; data: Uint8Array; crc: number }[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const endAt = zip.length - 22;
  expect(v.getUint32(endAt, true)).toBe(0x06054b50);
  const count = v.getUint16(endAt + 10, true);
  let at = v.getUint32(endAt + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50);
    const crc = v.getUint32(at + 16, true);
    const size = v.getUint32(at + 20, true);
    const nameLen = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const localNameLen = v.getUint16(local + 26, true);
    const start = local + 30 + localNameLen;
    out.push({ name, data: zip.subarray(start, start + size), crc });
    at += 46 + nameLen;
  }
  return out;
}

test('makeZip round-trips stored files', () => {
  const files = [
    { name: '2000-01-03-front.jpg', data: enc.encode('made-up image bytes'), date: '2000-01-03' },
    { name: 'é.jpg', data: new Uint8Array([0, 255, 1, 254]) },
  ];
  const back = readZip(makeZip(files));
  expect(back.map((f) => f.name)).toEqual(['2000-01-03-front.jpg', 'é.jpg']);
  expect([...back[0].data]).toEqual([...files[0].data]);
  expect([...back[1].data]).toEqual([0, 255, 1, 254]);
  expect(back[0].crc).toBe(crc32(files[0].data));
});

test('empty zip is just the end record', () => {
  expect(makeZip([])).toHaveLength(22);
});
