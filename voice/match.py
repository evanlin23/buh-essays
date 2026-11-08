"""Rank auditioned voices against a reference narrator.

  python -I match.py REF_profile.json CANDIDATE_DIR [--out RANKING.md]

For every CANDIDATE_DIR/<Voice>.wav: transcribe (Whisper word timings), profile it with profile.py,
then compare with the reference on
  * speaker similarity: cosine between ECAPA embeddings (who it sounds like),
  * delivery: pitch level and range, phrase-final falls, brightness, breathiness, pace and pauses.
The score is the cosine minus small penalties for each delivery gap; every component is printed so
the ranking can be checked by ear.
"""
import json, os, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable


def words_json(wav, out):
    import librosa
    from faster_whisper import WhisperModel
    y, _ = librosa.load(wav, sr=16000, mono=True)
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(y, language="en", word_timestamps=True)
    T = [{"start": s.start, "end": s.end, "text": s.text, "words": [{"w": w.word, "s": w.start, "e": w.end} for w in s.words]} for s in segs]
    json.dump(T, open(out, "w"))


def profile(wav):
    base = wav[:-4]
    pj = base + "_profile.json"
    if not os.path.exists(pj):
        if not os.path.exists(base + "_words.json"):
            words_json(wav, base + "_words.json")
        subprocess.run([PY, "-I", os.path.join(HERE, "profile.py"), wav, pj, "--transcript", base + "_words.json"],
                       check=True, capture_output=True)
    return json.load(open(pj)), np.load(base + "_profile_emb.npy")


def main(ref_json, cdir, out=None):
    R = json.load(open(ref_json))
    E = np.load(ref_json.replace(".json", "_emb.npy"))
    rows = []
    for f in sorted(os.listdir(cdir)):
        if not f.endswith(".wav") or f.startswith("pair_"):
            continue
        P, e = profile(os.path.join(cdir, f))
        cos = float(E @ e)
        d = dict(
            voice=f[:-4], cos=cos,
            f0=12 * np.log2(P["f0_median_hz"] / R["f0_median_hz"]),
            rng=P["f0_range_st_p5_p95"] - R["f0_range_st_p5_p95"],
            fall=(P["phrases_ending_lower_share"] or 0) - (R["phrases_ending_lower_share"] or 0),
            cent=P["spectral_centroid_hz"] - R["spectral_centroid_hz"],
            hnr=P["hnr_db_median"] - R["hnr_db_median"],
            wpm=P.get("wpm", R["wpm"]) - R["wpm"],
            pause=P.get("pause_share", R["pause_share"]) - R["pause_share"],
            P=P,
        )
        d["score"] = (cos - 0.03 * abs(d["f0"]) - 0.006 * abs(d["rng"]) - 0.1 * abs(d["fall"]) - 0.00015 * abs(d["cent"])
                      - 0.008 * abs(d["hnr"]) - 0.0015 * abs(d["wpm"]) - 0.2 * abs(d["pause"]))
        rows.append(d)
    rows.sort(key=lambda r: -r["score"])
    lines = [
        f"Reference: median pitch {R['f0_median_hz']} Hz, range {R['f0_range_st_p5_p95']} st, "
        f"{int(100 * R['phrases_ending_lower_share'])}% of phrases fall at the end, centroid {R['spectral_centroid_hz']:.0f} Hz, "
        f"HNR {R['hnr_db_median']} dB, {R['wpm']} wpm, {int(100 * R['pause_share'])}% pauses",
        "",
        "| # | Voice | Score | Speaker similarity | Pitch vs ref | Range vs ref | Falling endings | Brightness | Breathiness (HNR) | Pace | Pauses |",
        "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for i, r in enumerate(rows, 1):
        P = r["P"]
        lines.append(f"| {i} | {r['voice']} | {r['score']:.3f} | {r['cos']:.3f} | {r['f0']:+.1f} st ({P['f0_median_hz']:.0f} Hz) | "
                     f"{r['rng']:+.1f} st | {100 * (P['phrases_ending_lower_share'] or 0):.0f}% | {P['spectral_centroid_hz']:.0f} Hz | "
                     f"{P['hnr_db_median']:.1f} dB | {P.get('wpm', 0):.0f} wpm | {100 * P.get('pause_share', 0):.0f}% |")
    txt = "\n".join(lines)
    print(txt)
    if out:
        open(out, "w").write(txt + "\n")


if __name__ == "__main__":
    a = sys.argv[1:]
    out = None
    if "--out" in a:
        i = a.index("--out"); out = a[i + 1]; del a[i:i + 2]
    main(*a, out=out)
