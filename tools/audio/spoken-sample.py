"""One-off local sample synthesis; prints measured alignment, never edits content."""

import argparse
import hashlib
import json
import math
import re
from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

RATE = 24_000
VOICES = {"NARRATOR": "bf_emma", "CLERK": "bm_george", "VISITOR": "bf_isabella"}
HASHES = {
    "model": "6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb",
    "voices": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
}
# Split only at these evidence prefixes: their onsets are measured, not guessed.
CUTS = {4: ("The workshop starts",), 6: ("leave them by",),
        7: ("a pair of gloves", "a small trowel")}
ANSWERS = {"L1-q1": (4, 1), "L1-q2": (6, 1), "L1-q3": (7, 1), "L1-q4": (7, 2)}


def tenths(seconds: float) -> float:
    return math.floor(seconds * 10 + 0.5) / 10


def timestamp(sample: int) -> str:
    ticks = math.floor(sample / RATE * 10 + 0.5)
    return f"{ticks // 600:02d}:{ticks % 600 / 10:04.1f}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--voices", required=True, type=Path)
    parser.add_argument("--wav", required=True, type=Path)
    args = parser.parse_args()
    for name in HASHES:
        path = getattr(args, name)
        if hashlib.sha256(path.read_bytes()).hexdigest() != HASHES[name]:
            raise ValueError(f"Unexpected {name} SHA-256; use the documented assets")

    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(args.model), sess_options=options,
                                  providers=["CPUExecutionProvider"])
    engine = Kokoro.from_session(session, str(args.voices))
    transcript = Path(__file__).resolve().parents[2] / (
        "content/academic/practice/sample-01/listening/part-1.transcript.md"
    )
    lines = transcript.read_text(encoding="utf-8").strip().splitlines()
    if len(lines) != 8:
        raise ValueError("This one-off script expects the original eight sample turns")

    audio = [np.zeros(7_200, dtype=np.float32)]  # 0.3 s opening pad.
    cursor = 7_200
    turns = []
    for number, line in enumerate(lines, 1):
        match = re.fullmatch(r"\[\d+:\d+\.\d+\] (NARRATOR|CLERK|VISITOR): (.+)", line)
        if match is None:
            raise ValueError(f"Invalid transcript turn {number}")
        speaker, text = match.groups()
        boundaries = [0, *(text.index(prefix) for prefix in CUTS.get(number, ())), len(text)]
        chunks = []
        for start, end in zip(boundaries, boundaries[1:]):
            chunk = text[start:end].strip()
            samples, rate = engine.create(chunk, voice=VOICES[speaker], speed=1.0,
                                          lang="en-gb", trim=True,
                                          sentence_pause=0.25, clause_pause=0.1)
            if rate != RATE or len(samples) == 0 or not np.isfinite(samples).all():
                raise ValueError(f"Invalid synthesized audio at turn {number}")
            if np.max(np.abs(samples)) < 0.01:
                raise ValueError(f"Silent synthesized audio at turn {number}")
            chunks.append({"text": chunk, "startSample": cursor,
                           "endSample": cursor + len(samples)})
            audio.append(samples)
            cursor += len(samples)
            if end != len(text):
                audio.append(np.zeros(2_400, dtype=np.float32))  # 0.1 s chunk join.
                cursor += 2_400
        turns.append({"speaker": speaker, "voice": VOICES[speaker],
                      "startSample": chunks[0]["startSample"],
                      "endSample": chunks[-1]["endSample"], "chunks": chunks})
        if number != len(lines):
            audio.append(np.zeros(8_400, dtype=np.float32))  # 0.35 s turn pause.
            cursor += 8_400
    audio.append(np.zeros(12_000, dtype=np.float32))  # 0.5 s final pad.
    cursor += 12_000
    args.wav.parent.mkdir(parents=True, exist_ok=True)
    joined = np.concatenate(audio)
    joined *= 0.8 / np.max(np.abs(joined))  # Peak headroom, no clipped PCM samples.
    sf.write(str(args.wav), joined, RATE, subtype="PCM_16")
    alignment = {"sampleRate": RATE, "totalSamples": cursor,
                 "durationSec": round(cursor / RATE, 3), "turns": turns,
                 "audioStart": {key: tenths(turns[turn - 1]["chunks"][chunk]["startSample"] / RATE)
                                for key, (turn, chunk) in ANSWERS.items()}}
    print(json.dumps(alignment, indent=2))
    for turn in turns:
        text = " ".join(chunk["text"] for chunk in turn["chunks"])
        print(f"[{timestamp(turn['startSample'])}] {turn['speaker']}: {text}")


if __name__ == "__main__":
    main()