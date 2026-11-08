# Buh Essays (@buhessays)

Long-form "What if…" videos in the Paper Theatre style: cut-paper dioramas for the story, risograph pages for the science, narrated by a Gemini voice, all rendered from code.

| Path | What it is |
|---|---|
| `research/whatif-teardown.md` | Why the "What if you aged backwards?" video worked, plus the 14-beat script template every episode follows |
| `docs/STYLE-WHATIF.md` | The house style: palettes, type, puppets, page turns, sound, production rules |
| `whatif/render.cjs` | Frame-exact renderer: HTML/SVG scene → headless Chromium → x264, with the audio script muxed in |
| `whatif/lib/` | Stage kit (`stage.js`, `stage.css`) and the audio mixer (`engine.py`) |
| `whatif/proof/` | The narrated proof, "What if you never had to sleep?", and the cast sheet |
| `whatif/brand/` | Channel avatar (800×800) and banner (2560×1440) |
| `voice/` | Narrator voice matching and Gemini TTS (`gemini_tts.py say …`). Results are in `voice/RESULTS.md` |

## Setup

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd whatif && npm install
```

ffmpeg must be on `PATH`. Chromium comes from Playwright. Voice matching needs the extra packages in `voice/requirements.txt`.

The Gemini key is never stored in the repo; see `voice/README.md`.

## Make things

All commands run from `whatif/`:

| Command | Output |
|---|---|
| `node render.cjs proof/never_sleep.html ../renders/proof.mp4 --audio proof/never_sleep_audio.py` | The narrated clip, about 12 min on 3 workers |
| `node render.cjs proof/never_sleep.html ../renders/proof.mp4 --audio proof/never_sleep_audio.py --remix ../renders/proof.mp4` | New sound on the same frames, in seconds |
| `node render.cjs brand/avatar.html ../renders/brand --stills 0` | The avatar |
| `node render.cjs brand/banner.html ../renders/brand --stills 0` | The banner |
