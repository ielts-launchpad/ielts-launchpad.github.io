# One-off spoken listening sample

The original eight-turn sample-01 transcript is synthesized locally with Kokoro
v1.0. This is a small manual-testing fixture, **not** the M7 TTS/content pipeline.
There is no paid API, cloud inference, runtime TTS dependency, or download in CI.
The draft stays excluded from production test pages.

## Sources and licences

- [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), by hexgrad and contributors:
  Apache-2.0 model and bundled voice/style embeddings. The
  [upstream project](https://github.com/hexgrad/kokoro) and
  [ONNX distribution licence notes](https://github.com/thewh1teagle/kokoro-onnx#license)
  identify the model licence. The voice pack is the model's NumPy style vectors,
  not recordings or a separately downloaded voice dataset.
- [Kokoro-ONNX model-files-v1.0](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0):
  int8 ONNX export and bundled voice pack; local `kokoro-onnx` 0.6.1 inference is MIT.
- [FFmpeg](https://ffmpeg.org/legal.html): the pinned BtbN encoder build has GPL v3 enabled.
  Neither the encoder nor any model/library is redistributed with the site.
- The spoken transcript and generated audio are original IELTS Launchpad practice
  content, CC BY-SA 4.0; see [NOTICE](../../NOTICE) for credits. Voice IDs are
  synthetic style names, not real-speaker attribution or endorsement.

| Speaker | British English voice |
| --- | --- |
| NARRATOR | `bf_emma` |
| CLERK | `bm_george` |
| VISITOR | `bf_isabella` |

## Exact reproduction commands

PowerShell, from the repository root, with Windows x64 Python **3.12.6**. The
interpreter path below is the generation host's path; replace only that path if
Python is installed elsewhere. All weights, the venv and temporary WAV stay
outside the repository. The pinned package snapshot is
[requirements.txt](requirements.txt).

```powershell
$cache = "$env:LOCALAPPDATA\ielts-audio-tools"
New-Item -ItemType Directory -Force "$cache\models" | Out-Null
& 'C:/LegacyApp/Python/Python312/python.exe' -m venv "$cache\venv"
& "$cache\venv\Scripts\python.exe" -m pip install -r tools/audio/requirements.txt

foreach ($file in @('kokoro-v1.0.int8.onnx', 'voices-v1.0.bin')) {
  curl.exe -fsSL --ssl-no-revoke --retry 2 -o "$cache\models\$file" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$file"
  if ($LASTEXITCODE -ne 0) { throw "Model download failed: $file" }
}
curl.exe -fsSL --ssl-no-revoke --retry 2 -o "$cache\ffmpeg-pinned.zip" 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-31-12-59/ffmpeg-n8.1.3-27-g8dca1586f4-win64-gpl-8.1.zip'
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg download failed' }
if ((Get-FileHash "$cache\ffmpeg-pinned.zip" -Algorithm SHA256).Hash -ne '401DFFCF14C301082E1FC03B0BC876B92EA676BFC521FC56E80A1537D137034F') { throw 'FFmpeg archive hash mismatch' }
Expand-Archive -Path "$cache\ffmpeg-pinned.zip" -DestinationPath "$cache\ffmpeg-pinned" -Force
$bin = "$cache\ffmpeg-pinned\ffmpeg-n8.1.3-27-g8dca1586f4-win64-gpl-8.1\bin"

& "$cache\venv\Scripts\python.exe" tools/audio/spoken-sample.py --model "$cache\models\kokoro-v1.0.int8.onnx" --voices "$cache\models\voices-v1.0.bin" --wav "$cache\sample-01.wav"
if ($LASTEXITCODE -ne 0) { throw 'Speech synthesis failed' }
& "$bin\ffmpeg.exe" -hide_banner -loglevel error -y -i "$cache\sample-01.wav" -map_metadata -1 -ac 1 -ar 48000 -c:a libopus -b:a 48k -vbr on -application voip -frame_duration 20 -fflags +bitexact -flags:a +bitexact public/audio/academic/sample-01/part-1.opus
if ($LASTEXITCODE -ne 0) { throw 'Opus encoding failed' }
& "$bin\ffprobe.exe" -v error -show_entries format=duration,size:stream=codec_name,sample_rate,channels -of json public/audio/academic/sample-01/part-1.opus
Get-FileHash public/audio/academic/sample-01/part-1.opus -Algorithm SHA256
npm run validate
```

The script validates the model/voice SHA-256 values before opening them. No
network is used during synthesis: ONNX runs on CPU with one intra/inter-op thread;
British English phonemization uses the installed `phonemizer` 3.4.0 and bundled
`espeakng-loader` 0.2.4. Kokoro settings: speed 1.0, `en-gb`, silence trimming on,
sentence pause 0.25 s and clause pause 0.1 s. The WAV is mono 24 kHz PCM16,
normalized to peak 0.8 before encoding, providing headroom without clipping.

The original generation used the same executable from BtbN's moving `latest`
archive (SHA-256 `10f00905240b0409672c4fb1e9eb841f22aaf81b36f95827e57d483d9b144817`).
The immutable archive above was downloaded and verified to contain a
byte-identical FFmpeg executable: **n8.1.3-27-g8dca1586f4-20261031**, GCC 16.2.0.
Do not silently substitute a newer encoder, model, or package when comparing
hashes; inspect a regeneration diff and update all metadata together.

## Asset SHA-256

| Asset | SHA-256 |
| --- | --- |
| int8 ONNX model | `6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb` |
| voice pack | `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d` |
| immutable FFmpeg ZIP | `401dffcf14c301082e1fc03b0bc876b92ea676bfc521fc56e80a1537d137034f` |
| committed spoken Opus | `3162f431bd8e3717076b3db8fb44b7f5f5df0ef62518e37c45b83f4f0f4cd862` |

## Measured alignment and review

[spoken-sample.py](spoken-sample.py) reads the existing transcript text, ignoring
its old timestamps. It synthesizes turns separately and splits at the four
evidence prefixes, preserving all original words. There is 0.3 s opening padding,
0.1 s between chunks, 0.35 s between turns and 0.5 s final padding. Every start/end
is counted in **24 kHz samples**, recorded in
[sample-01.alignment.json](sample-01.alignment.json). No estimated word alignment
or stretched silent track is used. The script prints the manifest and updated
transcript; apply source metadata changes separately, rather than rewriting YAML
automatically.

- Total PCM/decoded duration: 723,504 samples / 24,000 = **30.146 s**.
- FFprobe container duration: **30.1525 s** (includes 6.5 ms Opus pre-skip).
- YAML duration: **30.146 s**; the validator reads Ogg granule positions and
  requires the existing ±1 s rule.
- Transcript turn starts and evidence `audioStart` round to nearest 0.1 s.
  Evidence prefixes start at **10.5, 17.4, 21.9 and 25.0 s**, all before duration.
- Final Opus: mono 48 kHz, 48 kb/s VBR, 20 ms packets, 175,811 bytes;
  decoded mean −23.0 dB and peak −2.6 dB. Regeneration reproduced the sample counts.
- The custom player rounds the displayed total up to **0:31**.

Manual review: run the development site, open the sample-01 Listening practice
page, and listen to the complete conversation. Check the narrator/clerk/visitor
voices, pronunciation and short chunk joins. Submit, then use each Results
“Play answer location” button: playback should start three seconds before its
evidence phrase; compare against the transcript. Human listening/quality approval
is still required, rather than implied by the decoding and alignment tests.

[make-silence.mjs](make-silence.mjs) remains a historical fixture utility; it does
not generate this spoken sample.