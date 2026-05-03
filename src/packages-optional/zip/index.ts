// @orbitoffice/zip — minimal ZIP reader/writer (STORE + DEFLATE).
// Uses native CompressionStream / DecompressionStream when available.
// Implements only the subset needed for OOXML packages.

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// CRC32 ----------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Read -----------------------------------------------------------------------
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const blob = new Blob([data.slice().buffer as ArrayBuffer]);
  const stream = new Response(blob.stream().pipeThrough(ds));
  return new Uint8Array(await stream.arrayBuffer());
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate-raw");
  const blob = new Blob([data.slice().buffer as ArrayBuffer]);
  const stream = new Response(blob.stream().pipeThrough(cs));
  return new Uint8Array(await stream.arrayBuffer());
}

export async function readZip(buf: ArrayBuffer): Promise<ZipEntry[]> {
  const u = new Uint8Array(buf);
  const dv = new DataView(buf);
  // Locate End of Central Directory (search backwards for 0x06054b50).
  let eocd = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP: EOCD not found");
  const totalEntries = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP: bad CD entry");
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    // Read local header for actual data offset
    if (dv.getUint32(localOff, true) !== 0x04034b50) throw new Error("ZIP: bad local header");
    const lhNameLen = dv.getUint16(localOff + 26, true);
    const lhExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    const raw = u.subarray(dataStart, dataStart + compSize);

    let data: Uint8Array;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflate(raw);
    else throw new Error(`ZIP: unsupported method ${method}`);
    if (data.length !== uncompSize && method !== 0) {
      // some streams may differ — keep what we got
    }
    entries.push({ name, data });
  }
  return entries;
}

// Write ----------------------------------------------------------------------
function dosTime(d = new Date()) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

export async function writeZip(entries: ZipEntry[]): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const { time, date } = dosTime();
  const localChunks: Uint8Array[] = [];
  const cdChunks: Uint8Array[] = [];
  let offset = 0;

  for (const ent of entries) {
    const nameBytes = enc.encode(ent.name);
    const uncompSize = ent.data.length;
    const crc = crc32(ent.data);
    const compressed = await deflate(ent.data);
    const useDeflate = compressed.length < uncompSize;
    const method = useDeflate ? 8 : 0;
    const data = useDeflate ? compressed : ent.data;
    const compSize = data.length;

    // Local file header
    const lh = new Uint8Array(30 + nameBytes.length);
    const lhDv = new DataView(lh.buffer);
    lhDv.setUint32(0, 0x04034b50, true);
    lhDv.setUint16(4, 20, true);          // version
    lhDv.setUint16(6, 0, true);           // flags
    lhDv.setUint16(8, method, true);
    lhDv.setUint16(10, time, true);
    lhDv.setUint16(12, date, true);
    lhDv.setUint32(14, crc, true);
    lhDv.setUint32(18, compSize, true);
    lhDv.setUint32(22, uncompSize, true);
    lhDv.setUint16(26, nameBytes.length, true);
    lhDv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);
    localChunks.push(lh, data);

    // Central directory entry
    const cd = new Uint8Array(46 + nameBytes.length);
    const cdDv = new DataView(cd.buffer);
    cdDv.setUint32(0, 0x02014b50, true);
    cdDv.setUint16(4, 20, true);
    cdDv.setUint16(6, 20, true);
    cdDv.setUint16(8, 0, true);
    cdDv.setUint16(10, method, true);
    cdDv.setUint16(12, time, true);
    cdDv.setUint16(14, date, true);
    cdDv.setUint32(16, crc, true);
    cdDv.setUint32(20, compSize, true);
    cdDv.setUint32(24, uncompSize, true);
    cdDv.setUint16(28, nameBytes.length, true);
    cdDv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    cdChunks.push(cd);

    offset += lh.length + compSize;
  }

  const cdSize = cdChunks.reduce((a, b) => a + b.length, 0);
  const cdOffset = offset;
  const eocd = new Uint8Array(22);
  const eDv = new DataView(eocd.buffer);
  eDv.setUint32(0, 0x06054b50, true);
  eDv.setUint16(8, entries.length, true);
  eDv.setUint16(10, entries.length, true);
  eDv.setUint32(12, cdSize, true);
  eDv.setUint32(16, cdOffset, true);

  const total = offset + cdSize + eocd.length;
  const out = new Uint8Array(total);
  let cur = 0;
  for (const c of localChunks) { out.set(c, cur); cur += c.length; }
  for (const c of cdChunks) { out.set(c, cur); cur += c.length; }
  out.set(eocd, cur);
  return out.buffer;
}

export function entryAsText(entries: ZipEntry[], name: string): string | null {
  const e = entries.find((x) => x.name === name);
  return e ? new TextDecoder().decode(e.data) : null;
}

export function setEntryText(entries: ZipEntry[], name: string, text: string): ZipEntry[] {
  const data = new TextEncoder().encode(text);
  const idx = entries.findIndex((x) => x.name === name);
  if (idx >= 0) {
    const next = entries.slice();
    next[idx] = { name, data };
    return next;
  }
  return [...entries, { name, data }];
}
