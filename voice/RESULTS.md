# Voice match, 8 Nov 2026

**Pick: `gemini-3.8-flash-tts`, voice `Algieba`, with the round 3 take B prompt. That prompt is now `DEFAULT_STYLE` in `gemini_tts.py`.**

## Reference narrator

Measured on 120 s of the "What if you aged backwards?" narration, with the music removed by Demucs:

| Trait | Measurement | In plain terms |
|---|---|---|
| Pitch | median 118–120 Hz | A low voice, typical of an adult male narrator |
| Melody | range about 19–20 semitones (p5–p95) | Very expressive |
| Endings | 68–84% of phrases end lower, by a median of 7 semitones | Lines fall hard and settle, often into a slight creak |
| Breathiness | harmonics-to-noise ratio 8.6–9.4 dB | Some breath and grit |
| Brightness | spectral centroid 1.25–1.33 kHz; 4–8 kHz band 16 dB down | Dark and warm |
| Pace | 140–142 wpm overall, 202 wpm while speaking; 30% pauses | Quick inside a line, then a beat |

## Round 1: ten voices, default storyteller prompt (5 requests)

Every voice read the same 82-word opening. Two speaker models were used:

- **ECAPA**, from SpeechBrain.
- **Resemblyzer**, a GE2E model.

As a control, a different stretch of the same narrator scored 0.934 on ECAPA and 0.906 on Resemblyzer.

| Voice | ECAPA | Resemblyzer | Pitch vs ref | Range vs ref | Falling endings | Pace |
|---|---:|---:|---:|---:|---:|---:|
| Achird | **0.250** | **0.819** | −4.5 st | −3.4 st | 33% | 135 wpm |
| en-us-knox | 0.215 | 0.757 | −3.6 st | −5.7 st | 56% | 137 wpm |
| en-us-riko | 0.193 | 0.727 | −4.3 st | −8.8 st | 62% | 130 wpm |
| Algieba | 0.185 | 0.809 | −2.7 st | **−0.6 st** | 57% | **137 wpm** |
| en-us-tutor-25 | 0.181 | 0.785 | −1.7 st | −1.6 st | 64% | 127 wpm |
| en-us-storyteller-13 | 0.179 | 0.764 | −2.7 st | −1.9 st | 46% | 126 wpm |
| Charon | 0.136 | 0.792 | −2.4 st | −4.1 st | 53% | 115 wpm |
| Umbriel | 0.126 | 0.801 | −1.3 st | −0.3 st | 38% | 115 wpm |
| Enceladus | 0.112 | 0.744 | −1.5 st | −5.0 st | 50% | 141 wpm |
| Algenib | 0.037 | 0.741 | −0.4 st | −3.1 st | 45% | 135 wpm |

No stock voice is the same speaker; the narrator is not a Gemini voice. Achird sounds most like the same kind of speaker. Algieba is the closest on delivery.

## Round 2: the top two, with a prompt aimed at the measured gaps (1 request)

| Voice | ECAPA | Resemblyzer | Pitch vs ref | Range vs ref | Falling endings | Breathiness | Pace | Pauses |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Algieba (tuned)** | 0.197 | 0.816 | **+0.1 st (119 Hz)** | **+0.3 st** | 50% | **9.2 dB** | 154 wpm | **32%** |
| Achird (tuned) | 0.179 | 0.818 | +2.7 st | −5.4 st | 67% | 11.2 dB | 144 wpm | 34% |

The tuned Algieba matches the narrator's pitch, range, breathiness and pause share, and its speaker similarity rose on both models. What's left:

- It reads about 10% fast. Fix that in the edit, where we set pause lengths anyway.
- It ends fewer lines on a fall: 50% vs 68%.

It is a near match, not a clone. Final choice by ear.

## Round 3: Algieba twice, two fixes for pace and endings (1 request)

| Take | ECAPA | Resemblyzer | Pitch vs ref | Range vs ref | Brightness | Breathiness | Pace | Pauses |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **B: "unhurried but never slow, about 140 wpm… drop the pitch firmly on the last word"** | 0.189 | 0.813 | **−0.1 st** | +0.7 st | **1155 Hz** | 8.4 dB | **136 wpm** | **31%** |
| Round 2 tuned | 0.197 | 0.816 | +0.1 st | +0.3 st | 1129 Hz | 9.2 dB | 154 wpm | 32% |
| A: "a little slower… decisive downward fall" | 0.220 | 0.814 | −3.5 st | −3.2 st | 1158 Hz | 6.5 dB | 137 wpm | 36% |

Take B keeps the pitch match and fixes the pace (reference: 140 wpm, 30% pauses, 1250 Hz). The three takes are within 0.03 of each other on speaker similarity, which is noise at this level.

Falling endings stay at 50% (reference 68%). With about 20 phrases in a 36 s read, that measure is noisy.
