// Builds the photo export zip: one JPEG per photo, named by date and pose.
import type { Photo } from '../../db/types';
import { photoExportName, photoFileNames } from '../../lib/later/photos';
import { makeZip } from '../../lib/later/zip';

export async function buildPhotoZip(photos: Photo[], today: string): Promise<File> {
  const sorted = [...photos].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pose.localeCompare(b.pose)));
  const names = photoFileNames(sorted);
  const entries = [];
  for (let i = 0; i < sorted.length; i++) {
    entries.push({ name: names[i], data: new Uint8Array(await sorted[i].image.arrayBuffer()), date: sorted[i].date });
  }
  const zip = makeZip(entries);
  return new File([zip.buffer as ArrayBuffer], photoExportName(today), { type: 'application/zip' });
}
