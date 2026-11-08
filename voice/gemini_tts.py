"""Gemini 3.8 Flash TTS: list voices and audition them two at a time.

The API key is never read here. The session's network proxy adds the `x-goog-api-key` header to
requests for generativelanguage.googleapis.com (saved as an environment network secret).

  python -I gemini_tts.py check                         # free call: is the key live?
  python -I gemini_tts.py voices OUT.json               # Extended Voice Library (no TTS quota)
  python -I gemini_tts.py pair A B TEXT.txt OUTDIR [--style "..."] [--style-b "..."] [--names a,b] [--model M]
  python -I gemini_tts.py say VOICE TEXT.txt OUT.wav [--style "..."]   # narration + OUT_words.json

`pair` makes ONE request with Gemini's two-speaker mode: voice A reads the text, then voice B reads
the same text. It splits the result with Whisper word timings into OUTDIR/<A>.wav and OUTDIR/<B>.wav.
Every TTS request is appended to requests.log; the script refuses to go past DAILY_LIMIT in 24 h.
"""
import base64, json, os, sys, time, urllib.error, urllib.request

API = "https://generativelanguage.googleapis.com/v1beta"
HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, "out", "requests.log")
DAILY_LIMIT = int(os.environ.get("GEMINI_TTS_DAILY_LIMIT", "10"))
# The narrator prompt that won the 8 Nov 2026 match (see RESULTS.md). Use with voice "Algieba".
DEFAULT_STYLE = ("Warm, intimate storyteller narrating a bittersweet animated short to one listener, quietly amused. "
                 "Use a slightly higher, brighter part of your range than usual, with lots of melodic movement: "
                 "lift into the key word of each line, then let every sentence fall all the way down and settle, "
                 "almost into a soft creak. Unhurried but never slow, about 140 words a minute. Keep the pauses "
                 "between sentences short, about half a second. Drop the pitch firmly on the last word of every "
                 "sentence, like closing a book.")


def http(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        txt = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(txt)
        except json.JSONDecodeError:
            return e.code, {"error": {"message": txt[:500]}}


def used_today():
    """Requests since the last midnight Pacific: the free tier's daily quota resets then."""
    if not os.path.exists(LOG):
        return 0
    import datetime
    from zoneinfo import ZoneInfo
    pt = datetime.datetime.now(ZoneInfo("America/Los_Angeles"))
    since = pt.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    return sum(1 for line in open(LOG) if line.strip() and json.loads(line)["t"] >= since and json.loads(line).get("status") == 200)


def log_request(entry):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a") as f:
        f.write(json.dumps({"t": time.time(), **entry}) + "\n")


def find_audio(obj):
    """Last base64 audio blob anywhere in the response (docs: steps[].content[].data in the model_output step)."""
    found = []
    def walk(o):
        if isinstance(o, dict):
            mt = str(o.get("mime_type") or o.get("mimeType") or o.get("type") or "")
            if isinstance(o.get("data"), str) and ("audio" in mt or len(o["data"]) > 1000):
                found.append(o["data"])
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(obj)
    return base64.b64decode(found[-1]) if found else None


def check():
    code, d = http("GET", f"{API}/models?pageSize=200")
    if code != 200:
        print("key NOT active:", code, d.get("error", {}).get("message", "")[:200])
        return 1
    tts = [m["name"] for m in d.get("models", []) if "tts" in m["name"]]
    print("key active. TTS models:", ", ".join(tts) or "(none listed)")
    print(f"TTS requests used since midnight Pacific: {used_today()}/{DAILY_LIMIT}")
    return 0


def voices(out):
    allv, tok = [], None
    while True:
        code, d = http("GET", f"{API}/voices?page_size=1000" + (f"&page_token={tok}" if tok else ""))
        if code != 200:
            print("voices failed:", code, d.get("error", {}).get("message", "")[:300])
            return 1
        allv += d.get("voices", [])
        tok = d.get("next_page_token") or d.get("nextPageToken")
        if not tok:
            break
    json.dump(allv, open(out, "w"), indent=1)
    print(f"{len(allv)} voices -> {out}")
    return 0


def split_by_text(wav_path, text, outA, outB):
    """Cut a two-speaker take where the second reading starts (Whisper word timings)."""
    import numpy as np, soundfile as sf
    from faster_whisper import WhisperModel
    y, sr = sf.read(wav_path)
    if y.ndim > 1:
        y = y.mean(1)
    import librosa
    y16 = librosa.resample(y.astype(np.float32), orig_sr=sr, target_sr=16000)
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(y16, language="en", word_timestamps=True)
    words = [w for s in segs for w in s.words]
    norm = lambda s: "".join(c for c in s.lower() if c.isalnum())
    head = [norm(w) for w in text.split()[:4]]
    starts = [i for i in range(len(words) - 3) if [norm(words[i + k].word) for k in range(4)] == head]
    if len(starts) < 2:
        # fall back to the longest silence near the middle
        gaps = [(words[i + 1].start - words[i].end, i) for i in range(len(words) - 1)
                if 0.3 < words[i].end / (words[-1].end + 1e-9) < 0.7]
        i = max(gaps)[1] + 1
    else:
        i = starts[1]
    cut = (words[i - 1].end + words[i].start) / 2
    k = int(cut * sr)
    sf.write(outA, y[:k], sr)
    sf.write(outB, y[k:], sr)
    return cut


def pair(a, b, text_file, outdir, style=DEFAULT_STYLE, style_b=None, names=None, model="gemini-3.8-flash-tts"):
    """One request, two takes. Same voice twice is fine: give each take its own style and file name."""
    style_b = style_b or style
    na, nb = (names.split(",") if names else (a, b))
    n = used_today()
    if n >= DAILY_LIMIT:
        print(f"refusing: {n}/{DAILY_LIMIT} TTS requests already used since midnight Pacific")
        return 2
    text = " ".join(open(text_file).read().split())
    body = {
        "model": model,
        "input": [{"type": "user_input", "content": [
            {"type": "text", "text": text, "annotations": [{"type": "speech_metadata", "speaker": "A", "style": style}]},
            {"type": "text", "text": text, "annotations": [{"type": "speech_metadata", "speaker": "B", "style": style_b}]},
        ]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": {"speakers": [{"speaker": "A", "voice": a}, {"speaker": "B", "voice": b}]}},
    }
    t0 = time.time()
    code, d = http("POST", f"{API}/interactions", body)
    log_request({"model": model, "voices": [a, b], "names": [na, nb], "status": code})
    os.makedirs(outdir, exist_ok=True)
    if code != 200:
        print("TTS failed:", code, json.dumps(d)[:600])
        return 1
    audio = find_audio(d)
    if not audio:
        print("no audio in response; keys:", list(d)[:10])
        json.dump(d, open(os.path.join(outdir, f"raw_{na}_{nb}.json"), "w"))
        return 1
    both = os.path.join(outdir, f"pair_{na}_{nb}.wav")
    open(both, "wb").write(audio)
    cut = split_by_text(both, text, os.path.join(outdir, f"{na}.wav"), os.path.join(outdir, f"{nb}.wav"))
    print(f"{na} + {nb}: {len(audio) / 48000:.1f} s of audio in {time.time() - t0:.1f} s, split at {cut:.2f} s "
          f"({used_today()}/{DAILY_LIMIT} requests used today)")
    return 0


def say(voice, text_file, out, style=DEFAULT_STYLE, model="gemini-3.8-flash-tts"):
    """Single-speaker narration for production. Also writes OUT_words.json (Whisper word timings) for retiming scenes."""
    n = used_today()
    if n >= DAILY_LIMIT:
        print(f"refusing: {n}/{DAILY_LIMIT} TTS requests already used since midnight Pacific")
        return 2
    text = " ".join(open(text_file).read().split())
    body = {"model": model,
            "input": [{"type": "user_input", "content": [{"type": "text", "text": text,
                       "annotations": [{"type": "speech_metadata", "style": style}]}]}],
            "response_format": {"type": "audio"},
            "generation_config": {"speech_config": [{"voice": voice}]}}
    code, d = http("POST", f"{API}/interactions", body)
    log_request({"model": model, "voices": [voice], "status": code, "say": os.path.basename(out)})
    if code != 200:
        print("TTS failed:", code, json.dumps(d)[:600])
        return 1
    audio = find_audio(d)
    if not audio:
        print("no audio in response")
        return 1
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, "wb").write(audio)
    import librosa
    from faster_whisper import WhisperModel
    y, _ = librosa.load(out, sr=16000, mono=True)
    segs, _ = WhisperModel("small.en", device="cpu", compute_type="int8").transcribe(y, language="en", word_timestamps=True)
    words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s_ in segs for w in s_.words]
    json.dump(words, open(out[:-4] + "_words.json", "w"), indent=0)
    print(f"{voice}: {len(y) / 16000:.1f} s, {len(words)} words -> {out} ({used_today()}/{DAILY_LIMIT} requests used today)")
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "check":
        sys.exit(check())
    if cmd == "voices":
        sys.exit(voices(sys.argv[2]))
    if cmd in ("pair", "say"):
        args = sys.argv[2:]
        kw = {}
        for flag in ("--style", "--style-b", "--names", "--model"):
            if flag in args:
                i = args.index(flag)
                kw[flag[2:].replace("-", "_")] = args[i + 1]
                del args[i:i + 2]
        sys.exit(pair(*args[:4], **kw) if cmd == "pair" else say(*args[:3], **kw))
    print(__doc__)
    sys.exit(2)
