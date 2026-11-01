import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTest } from '../../src/engine/content/loader';
import { oggOpusDurationSec } from '../../src/engine/audio/ogg';
import { formatAudioTime } from '../../src/engine/audio/playback';

const listening = loadTest(
  join(process.cwd(), 'content/academic/practice/sample-01'),
  join(process.cwd(), 'public'),
).listening[0];
if (!listening) throw new Error('sample-01 listening fixture missing');
const duration = oggOpusDurationSec(readFileSync(listening.audioFsPath));
if (duration === null) throw new Error('sample-01 Opus duration unreadable');

export const sampleListening = listening;
export const sampleAudioDuration = duration;
export const sampleAudioTime = formatAudioTime(Math.ceil(duration));