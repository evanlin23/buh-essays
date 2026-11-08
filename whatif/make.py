"""Buh Essays: one command from script to upload kit.

  python -I whatif/make.py EPISODE_DIR fakevo       # estimated timings from the script: free, for layout
  python -I whatif/make.py EPISODE_DIR narrate      # Gemini narration (cached per paragraph) + word timings -> vo.js
  python -I whatif/make.py EPISODE_DIR stills 1,8   # quick PNGs of the scene
  python -I whatif/make.py EPISODE_DIR render [--preview]
  python -I whatif/make.py EPISODE_DIR qa
  python -I whatif/make.py EPISODE_DIR package      # upload.md + cover.png
  python -I whatif/make.py EPISODE_DIR all          # narrate (if needed), render, qa, package

An episode folder holds:
  episode.json   title, description, tags, voice, cover time ...
  narration.txt  one beat per line; a blank line starts a new TTS request (keep each paragraph under about 60 s)
  scene.html     the scene, built from whatif/lib/kit.js and keyed to vo.js
Outputs go to renders/<slug>/. narration.m4a and vo.js are written into the episode folder and committed,
so a re-render never spends voice quota.
"""
import difflib, hashlib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "voice"))
PY = sys.executable
GAP = 0.45          # silence between TTS paragraphs (s)
VO_OFFSET = 0.3     # narration starts this long after frame 1


def ep_load(d):
    E = json.load(open(os.path.join(d, "episode.json")))
    E["dir"] = os.path.abspath(d)
    E["out"] = os.path.join(ROOT, "renders", E["slug"])
    os.makedirs(E["out"], exist_ok=True)
    return E


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def narrate(E, force=False):
    import numpy as np, soundfile as sf
    import gemini_tts
    text = open(os.path.join(E["dir"], "narration.txt")).read().strip()
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    voice = E.get("voice", "Algieba")
    style = E.get("style") or gemini_tts.DEFAULT_STYLE
    model = E.get("model", "gemini-3.8-flash-tts")
    cache = os.path.join(E["dir"], "vo_cache")
    os.makedirs(cache, exist_ok=True)
    chunks = []
    for p in paras:
        flat = " ".join(p.split())
        h = hashlib.sha1(f"{model}|{voice}|{style}|{flat}".encode()).hexdigest()[:16]
        f = os.path.join(cache, f"{h}.wav")
        if force or not os.path.exists(f):
            tmp = os.path.join(cache, f"{h}.txt")
            open(tmp, "w").write(flat)
            rc = gemini_tts.say(voice, tmp, f, style=style, model=model)
            if rc != 0:
                sys.exit(f"narration failed for paragraph: {flat[:60]}...")
        else:
            print(f"cached: {flat[:50]}...")
        y, sr = sf.read(f)
        chunks.append(y if y.ndim == 1 else y.mean(1))
    gap = np.zeros(int(GAP * sr))
    full = np.concatenate([np.concatenate([c, gap]) for c in chunks])[: -len(gap)]
    wav = os.path.join(cache, "narration.wav")
    sf.write(wav, full, sr)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "160k", os.path.join(E["dir"], "narration.m4a")], check=True)

    # word timings for the whole narration, then align the script's lines onto them
    import librosa
    from faster_whisper import WhisperModel
    y16 = librosa.resample(full.astype(np.float32), orig_sr=sr, target_sr=16000)
    segs, _ = WhisperModel("small.en", device="cpu", compute_type="int8").transcribe(y16, language="en", word_timestamps=True)
    words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
    script_tok, line_of = [], []
    for li, l in enumerate(lines):
        for w in l.split():
            if norm(w):
                script_tok.append(norm(w)); line_of.append(li)
    wt = [norm(w["w"]) for w in words]
    sm = difflib.SequenceMatcher(None, script_tok, wt, autojunk=False)
    m = {}
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            m[a + k] = b + k
    L = []
    prev_e = 0.0
    for li, l in enumerate(lines):
        idx = [i for i, x in enumerate(line_of) if x == li]
        hit = [i for i in idx if i in m]
        if not hit:
            s = prev_e + 0.2; e = s + 0.35 * len(idx)
        else:
            first, last = hit[0], hit[-1]
            s = max(prev_e, words[m[first]]["s"] - 0.28 * (first - idx[0]))
            e = words[m[last]]["e"] + 0.32 * (idx[-1] - last)
        L.append({"text": l, "s": round(s, 3), "e": round(e, 3)})
        prev_e = e
    vo = {"src": "narration.m4a", "offset": VO_OFFSET, "words": words, "lines": L}
    open(os.path.join(E["dir"], "vo.js"), "w").write(
        f"// Narration timing, written by make.py narrate. Voice: {voice} ({model}).\nwindow.VO = " + json.dumps(vo, separators=(",", ":")) + ";\n")
    print(f"narration: {len(full) / sr:.1f} s, {len(words)} words, {len(L)} lines -> vo.js")
    for i, l in enumerate(L):
        print(f"  {i:2d} {l['s'] + VO_OFFSET:6.2f}-{l['e'] + VO_OFFSET:6.2f}  {l['text'][:70]}")


def fakevo(E, wpm=140):
    """Estimated timings straight from the script (no audio, no quota) for laying out and checking a scene."""
    text = open(os.path.join(E["dir"], "narration.txt")).read().strip()
    words, L, t = [], [], 0.0
    for para in re.split(r"\n\s*\n", text):
        for l in [x.strip() for x in para.splitlines() if x.strip()]:
            s0 = t
            for w in l.split():
                d = 60 / wpm * max(0.6, len(norm(w)) / 4.5)
                words.append({"w": w, "s": round(t, 3), "e": round(t + d * 0.85, 3)})
                t += d
                if w[-1] in ".?!,":
                    t += 0.25 if w[-1] == "," else 0.45
            L.append({"text": l, "s": round(s0, 3), "e": round(t - 0.4, 3)})
        t += GAP
    vo = {"src": None, "offset": VO_OFFSET, "words": words, "lines": L}
    open(os.path.join(E["dir"], "vo.js"), "w").write("// ESTIMATED timing (make.py fakevo): no narration yet.\nwindow.VO = " + json.dumps(vo) + ";\n")
    print(f"fake narration: {t:.1f} s, {len(L)} lines -> vo.js (run `narrate` for the real thing)")


def node(*args):
    subprocess.run(["node", os.path.join(HERE, "render.cjs"), *args], check=True, cwd=HERE, env={**os.environ, "PYTHON": PY})


def render(E, preview=False):
    out = os.path.join(E["out"], "video.mp4")
    node(os.path.join(E["dir"], "scene.html"), out, "--jobs", str(E.get("jobs", 3)), "--audio", os.path.join(HERE, "lib", "audio.py"), *(["--preview"] if preview else []))
    return out


def stills(E, times):
    node(os.path.join(E["dir"], "scene.html"), os.path.join(E["out"], "stills"), "--stills", times)


def qa(E):
    import numpy as np
    v = os.path.join(E["out"], "video.mp4")
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", v], capture_output=True, text=True).stdout)
    meas = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", v, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], capture_output=True, text=True).stderr
    lufs = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", meas)[-1])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", v, "-vf", "scale=96:-2,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    w = 96
    h = len(raw) // (w * int(round(dur * 24))) if dur else 0
    F = np.frombuffer(raw[: (len(raw) // (w * h)) * w * h], np.uint8).reshape(-1, h, w).astype(np.float32)
    d = np.abs(np.diff(F, axis=0)).mean((1, 2))
    still = d < 0.25
    run = best = 0
    for s_ in still:
        run = run + 1 if s_ else 0
        best = max(best, run)
    fmt = E.get("format", "short")
    checks = [
        ("length", f"{dur:.1f} s", dur <= 60 if fmt == "short" else 120 <= dur <= 900),
        ("loudness", f"{lufs:.1f} LUFS", abs(lufs + 14) <= 1),
        ("still frames", f"{100 * still.mean():.1f}%", still.mean() <= 0.10),
        ("longest hold", f"{best / 24:.2f} s", best / 24 <= 1.0),
    ]
    ok = all(c[2] for c in checks)
    for name, val, good in checks:
        print(f"  {'PASS' if good else 'FAIL'}  {name:13s} {val}")
    json.dump({"pass": ok, "checks": {c[0]: c[1] for c in checks}}, open(os.path.join(E["out"], "qa.json"), "w"), indent=1)
    print("QA", "PASS" if ok else "FAIL")
    return ok


def package(E):
    node(os.path.join(E["dir"], "scene.html"), os.path.join(E["out"], "cover"), "--stills", str(E.get("cover_t", 1.5)))
    cov = [f for f in os.listdir(os.path.join(E["out"], "cover")) if f.endswith(".png")][0]
    os.replace(os.path.join(E["out"], "cover", cov), os.path.join(E["out"], "cover.png"))
    P = E["package"]
    src = "\n".join(f"- {s}" for s in P.get("sources", []))
    desc = "\n\n".join(P["description"]).replace("{sources}", src)
    tags = ", ".join(P.get("tags", []))
    md = f"""# Upload kit: {E['slug']}

**Format:** {E.get('format', 'short')} · **File:** `renders/{E['slug']}/video.mp4` · **Cover:** `renders/{E['slug']}/cover.png`

## Title
{P['title']}

## Description
{desc}

{' '.join(P.get('hashtags', []))}

## Tags
{tags}

## Pinned comment
{P.get('pinned', '')}

## Settings
- Audience: not made for kids
- Altered or synthetic content: {P.get('synthetic', 'No. Animated, with a synthetic narrator voice; nothing realistic depicts real people or events')}
- Category: Education
"""
    open(os.path.join(E["out"], "upload.md"), "w").write(md)
    print(f"wrote {E['out']}/upload.md and cover.png")


if __name__ == "__main__":
    d, cmd = sys.argv[1], sys.argv[2]
    E = ep_load(d)
    if cmd == "fakevo":
        fakevo(E)
    elif cmd == "narrate":
        narrate(E, force="--force" in sys.argv)
    elif cmd == "stills":
        stills(E, sys.argv[3])
    elif cmd == "render":
        render(E, preview="--preview" in sys.argv)
    elif cmd == "qa":
        sys.exit(0 if qa(E) else 1)
    elif cmd == "package":
        package(E)
    elif cmd == "all":
        if not os.path.exists(os.path.join(E["dir"], "vo.js")) or "ESTIMATED" in open(os.path.join(E["dir"], "vo.js")).read(200):
            narrate(E)
        render(E)
        qa(E)
        package(E)
    else:
        print(__doc__)
