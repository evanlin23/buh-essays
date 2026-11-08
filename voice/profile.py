"""Acoustic profile of a narration voice + an ECAPA speaker embedding.

python -I profile.py AUDIO.wav OUT.json [--transcript WHISPER.json] [--start S] [--max-sec 120]

Writes OUT.json and OUT_emb.npy (192-d ECAPA speaker embedding, VoxCeleb-trained).

Reports pitch level and range (Hz, semitones), intonation movement, final-fall share, breathiness (HNR),
formants (vocal tract size cues), spectral brightness, loudness variation, pace and pauses.
"""
import argparse, json, os, sys
import numpy as np
import parselmouth
from parselmouth.praat import call
import librosa

ap = argparse.ArgumentParser()
ap.add_argument("audio"); ap.add_argument("out")
ap.add_argument("--transcript"); ap.add_argument("--max-sec", type=float, default=1e9)
ap.add_argument("--start", type=float, default=0.0)
ap.add_argument("--no-embed", action="store_true")
a = ap.parse_args()

y, sr = librosa.load(a.audio, sr=16000, mono=True, offset=a.start, duration=None if a.max_sec > 1e8 else a.max_sec)
snd = parselmouth.Sound(y, sampling_frequency=sr)

# ---- pitch (autocorrelation, wide limits, then trimmed)
pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=60, pitch_ceiling=500)
f0 = pitch.selected_array["frequency"]
v = f0[f0 > 0]
med = float(np.median(v))
v = v[(v > med / 2.2) & (v < med * 2.2)]          # drop octave errors
st = 12 * np.log2(v / np.median(v))
# per-phrase movement: contiguous voiced runs separated by >=250 ms unvoiced
times = pitch.xs()
voiced = f0 > 0
phr, cur, last_t = [], [], -1
for t, f in zip(times, f0):
    if f > 0 and med / 2.2 < f < med * 2.2:
        if cur and t - last_t > 0.25:
            phr.append(cur); cur = []
        cur.append(f); last_t = t
if cur: phr.append(cur)
falls = []
for p in phr:
    if len(p) >= 40:
        k = max(4, len(p) // 4)
        falls.append(12 * np.log2(np.median(p[-k:]) / np.median(p[:k])))
falls = np.array(falls)

# ---- harmonicity (breathiness: lower = breathier)
harm = snd.to_harmonicity_cc(time_step=0.01, minimum_pitch=60)
hv = harm.values[harm.values > -100]

# ---- formants on voiced frames
form = snd.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=5000 if med < 165 else 5500)
F = {k: [] for k in (1, 2, 3, 4)}
for t in times[voiced][::3]:
    for k in F:
        x = form.get_value_at_time(k, t)
        if x == x: F[k].append(x)
Fm = {f"F{k}_hz": round(float(np.median(F[k])), 0) for k in F}

# ---- spectrum + loudness on speech frames
S = np.abs(librosa.stft(y, n_fft=1024, hop_length=160)) + 1e-9
rms = librosa.feature.rms(S=S, frame_length=1024)[0]
db = 20 * np.log10(rms + 1e-9)
speech = db > np.percentile(db, 60) - 12
cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0][speech]
freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
P = (S ** 2)[:, speech].mean(1)
band = lambda lo, hi: 10 * np.log10(P[(freqs >= lo) & (freqs < hi)].sum())
tilt = band(1000, 4000) - band(80, 1000)
air = band(4000, 8000) - band(80, 1000)

out = dict(
    file=a.audio, seconds=round(len(y) / sr, 1),
    f0_median_hz=round(med, 1), f0_p5_hz=round(float(np.percentile(v, 5)), 1), f0_p95_hz=round(float(np.percentile(v, 95)), 1),
    f0_range_st_p5_p95=round(float(np.percentile(st, 95) - np.percentile(st, 5)), 2),
    f0_std_st=round(float(st.std()), 2),
    phrase_end_change_st_median=round(float(np.median(falls)), 2) if len(falls) else None,
    phrases_ending_lower_share=round(float((falls < -1).mean()), 2) if len(falls) else None,
    phrases_ending_higher_share=round(float((falls > 1).mean()), 2) if len(falls) else None,
    low_f0_frames_share=round(float((v < med * 0.72).mean()), 3),
    hnr_db_median=round(float(np.median(hv)), 2),
    **Fm,
    spectral_centroid_hz=round(float(np.median(cent)), 0),
    tilt_1to4k_vs_low_db=round(float(tilt), 2), air_4to8k_vs_low_db=round(float(air), 2),
    loudness_std_db=round(float(db[speech].std()), 2),
)

if a.transcript:
    T = json.load(open(a.transcript))
    W = [w for s in T for w in s["words"] if a.start <= w["s"] < a.start + a.max_sec]
    if W:
        span = W[-1]["e"] - W[0]["s"]
        talk = sum(w["e"] - w["s"] for w in W)
        g = np.array([W[i + 1]["s"] - W[i]["e"] for i in range(len(W) - 1)])
        out.update(words=len(W), wpm=round(len(W) / span * 60, 1), articulation_wpm=round(len(W) / talk * 60, 1),
                   pause_share=round(1 - talk / span, 3), pauses_over_400ms_per_min=round((g > 0.4).sum() / span * 60, 1),
                   median_pause_over_150ms_s=round(float(np.median(g[g > 0.15])), 3) if (g > 0.15).any() else None)

if not a.no_embed:
    import torch
    from speechbrain.inference.speaker import EncoderClassifier
    enc = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache", "ecapa"), run_opts={"device": "cpu"})
    # embed 6 s windows on speech-dense stretches, average (normalised)
    win, hop = 6 * sr, 3 * sr
    embs = []
    for i in range(0, max(1, len(y) - win + 1), hop):
        seg = y[i:i + win]
        if np.sqrt(np.mean(seg ** 2)) < 0.01: continue
        e = enc.encode_batch(torch.tensor(seg)[None]).squeeze().numpy()
        embs.append(e / np.linalg.norm(e))
    E = np.mean(embs, 0); E /= np.linalg.norm(E)
    np.save(a.out.replace(".json", "_emb.npy"), E)
    out["embedding_windows"] = len(embs)

json.dump(out, open(a.out, "w"), indent=1)
print(json.dumps(out, indent=1))
