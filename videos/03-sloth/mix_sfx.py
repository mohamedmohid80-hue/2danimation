"""Mix sloth SFX onto the rendered video. Usage: python3 mix_sfx.py IN.mp4 OUT.mp4"""
import json, subprocess, sys
from pathlib import Path
HERE = Path(__file__).parent
W = json.load(open(HERE / "words.json"))
def T(word, after=0.0):
    for x in W:
        if x["s"] >= after and x["w"].strip(".,!?").lower() == word: return x["s"]
    raise SystemExit(word)
END = W[-1]["e"]; LAND = END + 0.05
drops = T("drops")
# (time s, file, gain dB): sloth calls sit in the natural pauses at face moments
cues = [
    (3.75, "squeak_question", -8),            # after "toilet" — "eee?"
    (22.3, "chew", -16), (61.3, "chew", -16), # munching leaf / algae
    (29.78, "squeak_short", -9),              # after "something strange" (face snap-zoom)
    (34.65, "yawn", -13),                     # "slowly, ... very slowly"
    (37.4, "dig", -18),                       # tail digs the hole
    *[(drops + d, "plop", -12) for d in (0.45, 0.85, 1.25, 1.65)],
    (47.2, "growl", -11),                     # jaguar in the bushes
    (T("it", T("risk")) + 0.3, "squeak_question", -8),  # after "so why risk it?"
    (T("gross") + 0.42, "squeak_happy", -8),  # grin after "pretty gross"
    (LAND - 0.45, "moth_land", -5),           # moth flies at the screen and taps on
    (LAND + 0.55, "moth_twitch", -10), (LAND + 1.05, "moth_twitch", -10),
]
inp, out = sys.argv[1], sys.argv[2]
args = ["ffmpeg", "-v", "error", "-y", "-i", inp]
fc, labels = [], ["[0:a]"]
for k, (t, f, db) in enumerate(cues, 1):
    args += ["-i", str(HERE / "sfx" / f"{f}.wav")]
    fc.append(f"[{k}]volume={db}dB,adelay={int(t*1000)}[s{k}]")
    labels.append(f"[s{k}]")
fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=7[a]")
args += ["-filter_complex", ";".join(fc), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", out]
subprocess.run(args, check=True)
print("mixed", len(cues), "sfx ->", out)
