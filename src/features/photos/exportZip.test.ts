import { expect, test } from 'vitest';
import type { Photo } from '../../db/types';
import { buildPhotoZip } from './exportZip';

test('buildPhotoZip names the file and holds one entry per photo', async () => {
  const p = (id: string, date: string, pose: Photo['pose']): Photo => ({ id, date, pose, image: new Blob([id]), thumb: new Blob(['t']) });
  const file = await buildPhotoZip([p('x', '2000-02-07', 'front'), p('y', '2000-01-03', 'side')], '2000-03-01');
  expect(file.name).toBe('lift-log-photos-2000-03-01.zip');
  expect(file.type).toBe('application/zip');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  expect(text.indexOf('2000-01-03-side.jpg')).toBeLessThan(text.indexOf('2000-02-07-front.jpg'));
  // Two local headers, two central entries, one end record.
  expect(text.split('PK\u0003\u0004')).toHaveLength(3);
  expect(text.split('PK\u0001\u0002')).toHaveLength(3);
});
