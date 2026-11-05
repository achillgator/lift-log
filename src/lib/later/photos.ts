// Progress photos (v2): sizing, grouping, compare defaults and export names. Pure; the browser
// work (canvas, share sheet) lives in src/features/photos.
import type { Photo } from '../../db/types';
import { compareDates } from './dates';

export const JPEG_QUALITY = 0.8;
export const IMAGE_LONG_EDGE = 1600;
export const THUMB_LONG_EDGE = 320;
export const POSES: Photo['pose'][] = ['front', 'side', 'back'];
export const POSE_LABELS: Record<Photo['pose'], string> = { front: 'Front', side: 'Side', back: 'Back' };

/** Size that fits `longEdge` on the longer side, keeping the aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, longEdge: number): { width: number; height: number } {
  if (!(width > 0 && height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface PhotoDay<P extends Pick<Photo, 'id' | 'date' | 'pose'> = Photo> {
  date: string;
  poses: Partial<Record<Photo['pose'], P>>;
}

/**
 * Photos grouped by date, newest first, one per pose. When a date has two photos of a pose,
 * the later one in the list wins (the app saves at most one per date and pose).
 */
export function groupByDate<P extends Pick<Photo, 'id' | 'date' | 'pose'>>(photos: P[]): PhotoDay<P>[] {
  const days = new Map<string, PhotoDay<P>>();
  for (const p of photos) {
    const day = days.get(p.date) ?? { date: p.date, poses: {} };
    day.poses[p.pose] = p;
    days.set(p.date, day);
  }
  return [...days.values()].sort((a, b) => compareDates(b.date, a.date));
}

/** Dates that have a photo of `pose`, oldest first. */
export function datesWithPose(photos: Pick<Photo, 'date' | 'pose'>[], pose: Photo['pose']): string[] {
  return [...new Set(photos.filter((p) => p.pose === pose).map((p) => p.date))].sort(compareDates);
}

/** The pair to compare first: the oldest and newest dates with this pose. */
export function compareDefaults(dates: string[]): { before?: string; after?: string } {
  if (dates.length < 2) return { before: dates[0], after: undefined };
  return { before: dates[0], after: dates[dates.length - 1] };
}

/** The photo of `pose` on `date`, if any. */
export function findPhoto<P extends Pick<Photo, 'date' | 'pose'>>(photos: P[], date: string | undefined, pose: Photo['pose']): P | undefined {
  return date ? photos.find((p) => p.date === date && p.pose === pose) : undefined;
}

/** Export file name; .gitignore catches lift-log-photos*. */
export function photoExportName(today: string): string {
  return `lift-log-photos-${today}.zip`;
}

/** Unique file names inside the zip: 2000-01-03-front.jpg, then -2, -3 for repeats. */
export function photoFileNames(photos: Pick<Photo, 'date' | 'pose'>[]): string[] {
  const used = new Map<string, number>();
  return photos.map((p) => {
    const base = `${p.date}-${p.pose}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? `${base}.jpg` : `${base}-${n}.jpg`;
  });
}

/** Bytes used by photos and thumbnails, for the storage row. */
export function photoBytes(photos: Pick<Photo, 'image' | 'thumb'>[]): number {
  return photos.reduce((sum, p) => sum + (p.image?.size ?? 0) + (p.thumb?.size ?? 0), 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}
