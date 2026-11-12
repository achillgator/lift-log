// Hands a file to the iOS share sheet (Save to Files, AirDrop ...), or downloads it where sharing
// files is not supported. Call from a tap handler with the file already built: Safari only allows
// navigator.share during the tap, so build the zip first and share on a second tap.
export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

export async function shareOrDownload(file: File): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // NotAllowedError and friends: fall back to a download below.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}
