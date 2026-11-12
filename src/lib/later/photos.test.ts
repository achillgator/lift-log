import { describe, expect, test } from 'vitest';
import {
  compareDefaults, datesWithPose, findPhoto, fitWithin, formatBytes, groupByDate, photoBytes, photoExportName, photoFileNames,
} from './photos';

type P = { id: string; date: string; pose: 'front' | 'side' | 'back' };
const photo = (id: string, date: string, pose: P['pose']): P => ({ id, date, pose });

describe('fitWithin', () => {
  test('portrait and landscape shrink to the long edge', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 320)).toEqual({ width: 240, height: 320 });
  });
  test('never upscales and handles bad sizes', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 600, 1600)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(10000, 1, 320)).toEqual({ width: 320, height: 1 });
  });
});

describe('grouping and compare', () => {
  const photos = [photo('a', '2000-01-03', 'front'), photo('b', '2000-01-03', 'side'), photo('c', '2000-02-07', 'front'), photo('d', '2000-01-17', 'back')];

  test('groupByDate is newest first with one slot per pose', () => {
    const days = groupByDate(photos);
    expect(days.map((d) => d.date)).toEqual(['2000-02-07', '2000-01-17', '2000-01-03']);
    expect(days[2].poses.front?.id).toBe('a');
    expect(days[2].poses.side?.id).toBe('b');
    expect(days[2].poses.back).toBeUndefined();
  });

  test('datesWithPose and compareDefaults', () => {
    const dates = datesWithPose(photos, 'front');
    expect(dates).toEqual(['2000-01-03', '2000-02-07']);
    expect(compareDefaults(dates)).toEqual({ before: '2000-01-03', after: '2000-02-07' });
    expect(compareDefaults(['2000-01-03'])).toEqual({ before: '2000-01-03', after: undefined });
    expect(compareDefaults([])).toEqual({ before: undefined, after: undefined });
  });

  test('findPhoto', () => {
    expect(findPhoto(photos, '2000-01-03', 'side')?.id).toBe('b');
    expect(findPhoto(photos, '2000-01-03', 'back')).toBeUndefined();
    expect(findPhoto(photos, undefined, 'front')).toBeUndefined();
  });
});

test('export names', () => {
  expect(photoExportName('2000-01-03')).toBe('lift-log-photos-2000-01-03.zip');
  expect(photoFileNames([photo('a', '2000-01-03', 'front'), photo('b', '2000-01-03', 'front'), photo('c', '2000-01-03', 'side')])).toEqual([
    '2000-01-03-front.jpg', '2000-01-03-front-2.jpg', '2000-01-03-side.jpg',
  ]);
});

test('bytes', () => {
  expect(photoBytes([{ image: new Blob(['abc']), thumb: new Blob(['d']) }])).toBe(4);
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(2048)).toBe('2 KB');
  expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
});
