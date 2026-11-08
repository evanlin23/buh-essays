"""Isolate narration from music with Demucs htdemucs.

python -I separate.py MIX.wav VOCALS.wav START_S DUR_S
"""
import sys, numpy as np, soundfile as sf, torch, librosa
from demucs.pretrained import get_model
from demucs.apply import apply_model
src, out, start, dur = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
y, sr = librosa.load(src, sr=44100, mono=False, offset=start, duration=dur)
m = get_model("htdemucs"); m.eval()
x = torch.tensor(y, dtype=torch.float32)[None]
ref = x.mean(1, keepdim=True); mu, sd = ref.mean(), ref.std()
with torch.no_grad():
    s = apply_model(m, (x - mu) / sd, split=True, overlap=0.25, progress=False, num_workers=0)[0] * sd + mu
v = s[m.sources.index("vocals")].numpy().T
sf.write(out, v, 44100)
print("wrote", out, v.shape)
