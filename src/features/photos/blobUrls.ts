// Object URLs for photo Blobs, made once per Blob and revoked when no longer shown.
export interface BlobUrls {
  get(blob: Blob): string;
  /** Revokes URLs for every Blob not in `blobs`. */
  keepOnly(blobs: Iterable<Blob>): void;
  clear(): void;
}

export function createBlobUrls(): BlobUrls {
  const urls = new Map<Blob, string>();
  return {
    get(blob) {
      let url = urls.get(blob);
      if (!url) {
        url = URL.createObjectURL(blob);
        urls.set(blob, url);
      }
      return url;
    },
    keepOnly(blobs) {
      const keep = new Set(blobs);
      for (const [blob, url] of urls) {
        if (!keep.has(blob)) {
          URL.revokeObjectURL(url);
          urls.delete(blob);
        }
      }
    },
    clear() {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
