const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) {
    c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function zipBlob(
  files: ReadonlyArray<[string, string | Uint8Array]>,
  mime: string = 'application/zip'
): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const cen: Uint8Array[] = [];
  let off = 0;
  const d = new Date();
  const tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

  files.forEach(([name, data]) => {
    const nb = enc.encode(name);
    const b = typeof data === 'string' ? enc.encode(data) : data;
    const c = crc32(b);

    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true);
    h.setUint16(10, tm, true);
    h.setUint16(12, dt, true);
    h.setUint32(14, c, true);
    h.setUint32(18, b.length, true);
    h.setUint32(22, b.length, true);
    h.setUint16(26, nb.length, true);
    h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nb, b);

    const e = new DataView(new ArrayBuffer(46));
    e.setUint32(0, 0x02014b50, true);
    e.setUint16(4, 20, true);
    e.setUint16(6, 20, true);
    e.setUint16(8, 0x0800, true);
    e.setUint16(10, 0, true);
    e.setUint16(12, tm, true);
    e.setUint16(14, dt, true);
    e.setUint32(16, c, true);
    e.setUint32(20, b.length, true);
    e.setUint32(24, b.length, true);
    e.setUint16(28, nb.length, true);
    e.setUint32(42, off, true);
    cen.push(new Uint8Array(e.buffer), nb);
    off += 30 + nb.length + b.length;
  });

  const cs = cen.reduce((a, x) => a + x.length, 0);
  const z = new DataView(new ArrayBuffer(22));
  z.setUint32(0, 0x06054b50, true);
  z.setUint16(8, files.length, true);
  z.setUint16(10, files.length, true);
  z.setUint32(12, cs, true);
  z.setUint32(16, off, true);

  const blobParts: BlobPart[] = [...parts, ...cen, new Uint8Array(z.buffer)].map(
    (u) => u.buffer as ArrayBuffer
  );
  return new Blob(blobParts, { type: mime });
}

export function xmlEscape(s: string | number | null | undefined): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function saveBlobFile(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 2000);
}
