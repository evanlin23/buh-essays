# Voice matching

Find the stock Gemini TTS voice closest to a reference narrator, without cloning anyone.

1. `separate.py`: pull the narration out of the music bed (Demucs).
2. `profile.py`: measure the voice: pitch level and range, how phrases end, breathiness, brightness, pace, pauses, plus an ECAPA speaker embedding.
3. `gemini_tts.py`: audition Gemini 3.8 Flash TTS voices two per request (two-speaker mode), within the daily free quota.
4. `match.py`: rank the auditions against the reference profile.

The Gemini key is never in this repo. Save it as a network secret on the cloud environment:

| Field | Value |
|---|---|
| Host | `generativelanguage.googleapis.com` |
| Header | `x-goog-api-key` |
| Prefix | none |

The proxy then adds the key to every request to that host. Check it with `python -I gemini_tts.py check`; that call uses no TTS quota.

```bash
python -I separate.py refs/mix.wav refs/vocals.wav 0 120
python -I profile.py refs/vocals.wav refs/ref_profile.json --transcript refs/words.json --max-sec 120
python -I gemini_tts.py voices out/voices.json
python -I gemini_tts.py pair Algenib Charon text/test.txt out/auditions
python -I match.py refs/ref_profile.json out/auditions --out out/ranking.md
```

Audio files are gitignored.
