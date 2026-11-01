/**
 * Minimal, dependency-free Ogg Opus duration reader (SPEC §3 rule 6). Used by
 * the content validator to check that a listening part's declared `durationSec`
 * matches the committed audio file. Pure over a byte buffer so it is unit
 * testable and runs only in Node (validator CLI / Astro build step).
 *
 * Opus granule positions are counted in 48 kHz samples regardless of the
 * original sample rate (RFC 7845). The playable length is the final page's
 * granule position minus the OpusHead pre-skip, divided by 48 000.
 */

const OGG_MAGIC = 0x4f676753; // 'OggS'
const SAMPLE_RATE = 48000;

/**
 * Return the duration in seconds of an Ogg Opus stream, or `null` when the
 * buffer is not a parseable Ogg Opus file. Never throws.
 */
export function oggOpusDurationSec(buffer: Uint8Array): number | null {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  let preSkip: number | null = null;
  let lastGranule: number | null = null;
  let offset = 0;

  while (offset + 27 <= buffer.length) {
    if (view.getUint32(offset, false) !== OGG_MAGIC) return null;

    const granuleLow = view.getUint32(offset + 6, true);
    const granuleHigh = view.getUint32(offset + 10, true);
    const granule = granuleHigh * 2 ** 32 + granuleLow;

    const segmentCount = buffer[offset + 26];
    const segmentTable = offset + 27;
    if (segmentTable + segmentCount > buffer.length) return null;

    let payloadLength = 0;
    for (let i = 0; i < segmentCount; i++) payloadLength += buffer[segmentTable + i];

    const payloadStart = segmentTable + segmentCount;
    if (payloadStart + payloadLength > buffer.length) return null;

    // 0xFFFFFFFFFFFFFFFF marks a page with no completed packet; ignore it.
    if (granule !== 0xffffffff * 2 ** 32 + 0xffffffff) lastGranule = granule;

    if (preSkip === null && matchesAscii(buffer, payloadStart, 'OpusHead')) {
      preSkip = view.getUint16(payloadStart + 10, true);
    }

    offset = payloadStart + payloadLength;
  }

  if (preSkip === null || lastGranule === null) return null;
  const samples = lastGranule - preSkip;
  if (samples <= 0) return null;
  return samples / SAMPLE_RATE;
}

function matchesAscii(buffer: Uint8Array, at: number, text: string): boolean {
  if (at + text.length > buffer.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (buffer[at + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}
