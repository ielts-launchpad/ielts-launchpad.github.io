#!/usr/bin/env node
// Generate a tiny, valid, silent Ogg Opus file with no external dependencies.
//
// Usage: node tools/audio/make-silence.mjs <output.opus> [durationSec]
//
// The file is a structurally correct Ogg Opus stream (OpusHead + OpusTags +
// audio pages). Each audio packet is a single TOC byte describing a 20 ms mono
// frame with no compressed data, which decoders render as silence. This is
// enough for placeholder audio in draft content; real audio is produced by the
// TTS pipeline later.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const SERIAL = 0x6c617570; // arbitrary bitstream serial number
const SAMPLE_RATE = 48000;
const FRAME_SAMPLES = 960; // 20 ms at 48 kHz
const PRE_SKIP = 3840;

// Ogg uses CRC-32 with polynomial 0x04c11db7, no reflection, zero init/xor.
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let r = i << 24;
  for (let j = 0; j < 8; j++) {
    r = (r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1) >>> 0;
  }
  CRC_TABLE[i] = r >>> 0;
}

function oggCrc(buf) {
  let crc = 0;
  for (let i = 0; i < buf.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ buf[i]) & 0xff]) >>> 0;
  }
  return crc >>> 0;
}

function u32le(value) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value >>> 0, 0);
  return b;
}

function buildPage(headerType, granule, sequence, lacing, data) {
  const header = Buffer.alloc(27 + lacing.length);
  header.write('OggS', 0, 'ascii');
  header.writeUInt8(0, 4); // stream structure version
  header.writeUInt8(headerType, 5);
  header.writeUInt32LE(granule >>> 0, 6);
  header.writeUInt32LE(Math.floor(granule / 2 ** 32) >>> 0, 10);
  header.writeUInt32LE(SERIAL >>> 0, 14);
  header.writeUInt32LE(sequence >>> 0, 18);
  header.writeUInt32LE(0, 22); // CRC placeholder
  header.writeUInt8(lacing.length, 26);
  for (let i = 0; i < lacing.length; i++) header.writeUInt8(lacing[i], 27 + i);

  const page = Buffer.concat([header, data]);
  page.writeUInt32LE(oggCrc(page), 22);
  return page;
}

function opusHead() {
  const b = Buffer.alloc(19);
  b.write('OpusHead', 0, 'ascii');
  b.writeUInt8(1, 8); // version
  b.writeUInt8(1, 9); // channel count (mono)
  b.writeUInt16LE(PRE_SKIP, 10);
  b.writeUInt32LE(SAMPLE_RATE, 12);
  b.writeInt16LE(0, 16); // output gain
  b.writeUInt8(0, 18); // channel mapping family 0
  return b;
}

function opusTags() {
  const vendor = Buffer.from('ielts-launchpad', 'utf8');
  return Buffer.concat([Buffer.from('OpusTags', 'ascii'), u32le(vendor.length), vendor, u32le(0)]);
}

function build(durationSec) {
  const frames = Math.max(1, Math.round((durationSec * SAMPLE_RATE) / FRAME_SAMPLES));
  // TOC byte: config 1 (SILK NB, 20 ms), mono, 1 frame per packet.
  const toc = (1 << 3) | 0;

  const pages = [];
  pages.push(buildPage(0x02, 0, 0, [opusHead().length], opusHead())); // BOS
  pages.push(buildPage(0x00, 0, 1, [opusTags().length], opusTags()));

  // Emit audio packets, at most 255 per page (one lacing segment each).
  let sequence = 2;
  let emitted = 0;
  while (emitted < frames) {
    const count = Math.min(255, frames - emitted);
    emitted += count;
    const granule = emitted * FRAME_SAMPLES;
    const headerType = emitted >= frames ? 0x04 : 0x00; // EOS on the last page
    const lacing = Array.from({ length: count }, () => 1);
    const data = Buffer.alloc(count, toc);
    pages.push(buildPage(headerType, granule, sequence++, lacing, data));
  }

  return Buffer.concat(pages);
}

const [, , outPath, durationArg] = process.argv;
if (!outPath) {
  console.error('usage: node tools/audio/make-silence.mjs <output.opus> [durationSec]');
  process.exit(1);
}
const durationSec = durationArg ? Number(durationArg) : 2;
const file = build(durationSec);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, file);
console.log(`wrote ${outPath} (${file.length} bytes, ${durationSec}s silence)`);
