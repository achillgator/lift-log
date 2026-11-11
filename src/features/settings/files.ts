// Getting files out of and into the app. Exports go through the Share sheet when the browser
// supports sharing files (iOS), else a normal download. Nothing leaves the device otherwise.
import { api } from '../../db';
import { todayISO } from '../../components/format';

/** Returns false when the person cancelled the share sheet. */
export async function deliverFile(blob: Blob, filename: string): Promise<boolean> {
  const type = blob.type || (filename.endsWith('.csv') ? 'text/csv' : 'application/json');
  const file = new File([blob], filename, { type });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      // Share failed for another reason: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** File names match .gitignore (CLAUDE.md rule 12). */
export function backupName(ext: 'json' | 'csv', date = todayISO()): string {
  return `lift-log-backup-${date}.${ext}`;
}

export function programName(date = todayISO()): string {
  return `lift-log-program-${date}.json`;
}

/** Full JSON backup; records lastExportAt so the Home backup banner goes away. */
export async function exportBackup(): Promise<boolean> {
  const delivered = await deliverFile(await api.exportJson(), backupName('json'));
  if (delivered) await api.updateSettings({ lastExportAt: Date.now() });
  return delivered;
}

export async function exportSetsCsv(): Promise<boolean> {
  return deliverFile(await api.exportCsv(), backupName('csv'));
}

export async function exportProgramFile(): Promise<boolean> {
  return deliverFile(await api.exportProgram(), programName());
}
