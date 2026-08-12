// Reads a .pptx (기획안) file well enough to match it against an already-
// uploaded banner creative — WITHOUT rendering slides to images. This
// environment has no LibreOffice/PowerPoint available (confirmed elsewhere
// in this project — pdftoppm/soffice are absent even locally), so a real
// "screenshot every slide" pipeline isn't possible here. Instead:
//
// 1) .pptx is a ZIP file — we read it with a minimal hand-rolled ZIP reader
//    (node:zlib only, no dependency) to avoid adding an untested npm
//    package to a codebase that has no local Node/npm to test it with.
// 2) Per slide, we pull the TEXT straight out of the slide XML (exact,
//    no vision-model guessing) and the slide's embedded raster images
//    (for OCR'ing any text that's baked into a picture rather than typed
//    into a PPT text box, and for giving the brief-direction step some
//    visual context).
//
// This intentionally does not resolve <p:sldIdLst> display order — slide
// filenames (slideN.xml) are numbered in the order PowerPoint assigns on
// save, which is good enough for "which slide's content matches this
// creative" matching; exact display order doesn't matter here.

import zlib from 'node:zlib';
import path from 'node:path';

const MAX_SLIDES = 20;
const MAX_IMAGES_PER_SLIDE = 6;
const MIN_IMAGE_BYTES = 15 * 1024; // skip tiny icons/logos, not real mockup/photo content
const IMAGE_EXT_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' };

// ---------- minimal ZIP reader ----------

function readZipEntries(buf) {
  const EOCD_SIG = 0x06054b50;
  const maxCommentLen = 65536;
  const searchStart = Math.max(0, buf.length - 22 - maxCommentLen);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('ZIP EOCD not found (파일이 손상됐거나 pptx가 아닙니다)');

  const cdEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const CD_SIG = 0x02014b50;
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (buf.readUInt32LE(p) !== CD_SIG) break; // malformed — stop rather than throw, return what we have
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.push({ name, method, compSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function extractEntry(buf, entry) {
  const LFH_SIG = 0x04034b50;
  const off = entry.localHeaderOffset;
  if (buf.readUInt32LE(off) !== LFH_SIG) throw new Error('ZIP local header 손상');
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + entry.compSize);
  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return zlib.inflateRawSync(raw);
  throw new Error(`지원하지 않는 압축 방식(method ${entry.method})`);
}

function xmlUnescape(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractSlideText(slideXml) {
  const texts = [];
  const re = /<a:t>([\s\S]*?)<\/a:t>/g;
  let m;
  while ((m = re.exec(slideXml))) {
    const t = xmlUnescape(m[1]).trim();
    if (t) texts.push(t);
  }
  return texts.join(' ');
}

function extractImageTargets(relsXml) {
  const targets = [];
  const tagRe = /<Relationship\b[^>]*\/>/g;
  let m;
  while ((m = tagRe.exec(relsXml))) {
    const tag = m[0];
    const typeMatch = tag.match(/Type="([^"]+)"/);
    const targetMatch = tag.match(/Target="([^"]+)"/);
    if (typeMatch && targetMatch && /\/image$/.test(typeMatch[1])) {
      targets.push(targetMatch[1]);
    }
  }
  return targets;
}

// Returns [{ slideIndex, text, images: [{ base64, mimeType, byteSize }] }, ...]
// sorted by slide number. Never throws for "no images found" / "no text
// found" cases — only throws if the file isn't a readable ZIP at all
// (caller should catch that and fail soft, same convention as runOcr()).
export function extractSlidesFromPptx(buffer) {
  const entries = readZipEntries(buffer);
  const byName = new Map(entries.map((e) => [e.name, e]));

  const slideEntries = entries
    .map((e) => {
      const m = e.name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      return m ? { entry: e, index: parseInt(m[1], 10) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)
    .slice(0, MAX_SLIDES);

  return slideEntries.map(({ entry, index }) => {
    const slideXml = extractEntry(buffer, entry).toString('utf8');
    const text = extractSlideText(slideXml);

    const relsEntry = byName.get(`ppt/slides/_rels/slide${index}.xml.rels`);
    const images = [];
    if (relsEntry) {
      const relsXml = extractEntry(buffer, relsEntry).toString('utf8');
      const targets = extractImageTargets(relsXml);
      for (const target of targets) {
        if (images.length >= MAX_IMAGES_PER_SLIDE) break;
        const resolved = path.posix.normalize(path.posix.join('ppt/slides', target));
        const ext = (resolved.split('.').pop() || '').toLowerCase();
        const mimeType = IMAGE_EXT_MIME[ext];
        if (!mimeType) continue; // skip emf/wmf/tiff/etc — not vision/OCR-friendly formats
        const imgEntry = byName.get(resolved);
        if (!imgEntry) continue;
        let data;
        try {
          data = extractEntry(buffer, imgEntry);
        } catch (e) {
          continue;
        }
        if (data.length < MIN_IMAGE_BYTES) continue; // likely an icon/logo, not real content
        images.push({ base64: data.toString('base64'), mimeType, byteSize: data.length });
      }
    }

    return { slideIndex: index, text, images };
  });
}

// ---------- matching against the analyzed creative's OCR text ----------

const MIN_TOKEN_LEN = 2;
const MIN_MATCH_SCORE = 4;

function normalize(s) {
  return (s || '').replace(/\s+/g, '');
}

// creativeTexts: OCR text fragments read off the banner being analyzed
// (e.g. ocrFields.map(f => f.inferText)).
// slides: [{ slideIndex, textPool, images }] — textPool = slide's own PPT
// text plus any text OCR'd out of its embedded images, combined.
// Returns { slide, score } for the best match, or null if nothing scores
// above MIN_MATCH_SCORE (better to skip brief-matching than guess wrong).
export function matchSlide(creativeTexts, slides) {
  if (!Array.isArray(creativeTexts) || !Array.isArray(slides) || !slides.length) return null;

  let best = null;
  for (const slide of slides) {
    const pool = normalize(slide.textPool);
    if (!pool) continue;
    let score = 0;
    for (const raw of creativeTexts) {
      const token = normalize(raw);
      if (token.length < MIN_TOKEN_LEN) continue;
      if (pool.includes(token)) score += token.length;
    }
    if (!best || score > best.score) best = { slide, score };
  }
  return best && best.score >= MIN_MATCH_SCORE ? best : null;
}
