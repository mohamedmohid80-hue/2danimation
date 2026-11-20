"""Motion storyboard: each shot shown as START -> END frame with camera + action notes.

Usage: python3 make_motion_board.py out/shots.tsv out/sb OUT.png [NOTES.json] [TITLE]
NOTES.json (optional) is a list of [camera, action] pairs, one per shot; defaults to the woodpecker notes.
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFont

tsv, sbdir, out = sys.argv[1:4]
DB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
DR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# (camera move, on-screen action) per shot, in shot order
NOTES = [
    ("CUT IN · crane down + fast push, wide → head", "Pecking 6×/s, chips, impact shake"),
    ("GLIDE · push to the impact, orbit right", "Flash rings on every hit"),
    ("PUNCH-IN on \"20\" · orbit 40°→65°", "\"20×\" label slams in"),
    ("CUT · x-ray, push in + orbit", "Brain wobbles like jelly, turns red on \"soup\""),
    ("CUT · low front angle, push", "Chips fly AT the camera, shake"),
    ("GLIDE + PUNCH on \"hundreds\"", "\"400 g\" label, flash rings"),
    ("Orbit around behind the head", "Bar chart grows: football 100 g vs 400 g"),
    ("CUT · orbit 76° around the beak", "Beak GROWS out; yellow arrow on \"chisel\""),
    ("CUT · side macro, slow orbit, punch on \"chip\"", "Beak strikes; bone chips break off, tip wears"),
    ("GLIDE · orbit to the other side", "Keratin sheath sweeps base → tip, beak repaired"),
    ("Push in to the tip + orbit", "Arrows flow toward the tip (\"keeps growing\")"),
    ("CUT · impact side, punch", "Strikes with flash = self-sharpening"),
    ("CUT · push from outside into x-ray", "Big brain slams forward, red impact ring"),
    ("GLIDE · crane up to high angle", "Brain sloshes in its fluid on every hit"),
    ("GLIDE · orbit + punch on \"shrink\"", "Brain shrinks, arrows squeeze in"),
    ("CUT · push in close", "Fluid gap squeezes tight; brain stops sloshing"),
    ("CUT · front 3/4 at the eye", "Chips fly straight at the camera"),
    ("GLIDE · fast push into the eye", "Chips keep coming"),
    ("Orbit around the eye, punch on \"snaps\"", "Third eyelid slides across on each hit"),
    ("Slow-mo · orbit 33°", "Eyelid closes just before each slow hit"),
    ("CUT · wide from behind, orbit", "Body bounces off the trunk, red recoil arrow"),
    ("CUT · low angle on the feet, punch on \"grab\"", "Toes spread, then CLAMP the bark"),
    ("GLIDE · orbit round to behind", "Toes glow: two forward, two back"),
    ("CUT · tail close-up, punch on \"tail\"", "Tail swings in and jams into the bark (puff)"),
    ("GLIDE · pull out + orbit 43°", "Ghost body; feet + tail dots pulse; triangle draws"),
    ("CUT · DIVE into the trunk", "Bark turns see-through; grub wriggles; arrow"),
    ("Camera FOLLOWS the tongue tip", "Tongue winds round the skull in x-ray"),
    ("GLIDE to the tunnel, punch on \"spear\"", "Tongue shoots in, barbs spear grub, pulls it out"),
    ("CUT · x-ray, slow orbit", "40+ bone plates FLY IN and build a helmet"),
    ("GLIDE · orbit 56° around the helmet", "Finished helmet, rotating reveal"),
    ("CUT · dramatic low angle, slow push, dark vignette", "Slow pecks — the twist"),
    ("CUT · x-ray, punch on \"nothing\"", "Helmet plates crumble and fall away"),
    ("BULLET TIME · 90° orbit round the impact", "Slow-mo peck, REC 1000 FPS + frame counter"),
    ("CUT · wide side, punch on \"hammer\"", "Ghost hammer swings with the head, big impact"),
    ("CUT · huge push from outside into the brain", "X-ray zoom"),
    ("GLIDE · orbit tight, punch on \"tiny\"", "Tiny brain glows, ring of arrows"),
    ("CUT · orbit", "Red force arrows pass the brain harmlessly"),
    ("SWOOP · 100° orbit from behind to the front", "Bird turns to camera, winks; confetti chips"),
]

if len(sys.argv) > 4:
    NOTES = [tuple(x) for x in json.load(open(sys.argv[4]))]
TITLE = sys.argv[5] if len(sys.argv) > 5 else "WOODPECKER — MOTION STORYBOARD (v2)"
rows = [l.rstrip("\n").split("\t") for l in open(tsv)]
assert len(rows) == len(NOTES), (len(rows), len(NOTES))

TW, TH = 180, 320
CELL_W = TW * 2 + 40 + 24
CELL_H = TH + 92
COLS = 4
G = 12
nrows = (len(rows) + COLS - 1) // COLS
HEAD_H = 120
board = Image.new("RGB", (COLS * CELL_W + (COLS + 1) * G, HEAD_H + nrows * CELL_H + (nrows + 1) * G), "#0b0c0f")
d = ImageDraw.Draw(board)
d.text((G + 8, 18), TITLE, font=ImageFont.truetype(DB, 34), fill="#ffd23f")
d.text((G + 8, 66), f"Each shot: START frame → END frame. Camera never holds still; {len(rows)} shots, avg {float(rows[-1][3]) / len(rows):.1f} s each.",
       font=ImageFont.truetype(DR, 20), fill="#b8c0cc")

fT = ImageFont.truetype(DB, 17)
fN = ImageFont.truetype(DR, 14)
fA = ImageFont.truetype(DB, 30)
for k, (row, (cam, act)) in enumerate(zip(rows, NOTES)):
    n, name, t0, t1 = row[0], row[1], float(row[2]), float(row[3])
    x = G + (k % COLS) * (CELL_W + G)
    y = HEAD_H + G + (k // COLS) * (CELL_H + G)
    d.rectangle((x, y, x + CELL_W, y + CELL_H), fill="#15171c")
    a = Image.open(f"{sbdir}/{n}a.png").convert("RGB").resize((TW, TH), Image.LANCZOS)
    b = Image.open(f"{sbdir}/{n}b.png").convert("RGB").resize((TW, TH), Image.LANCZOS)
    board.paste(a, (x + 12, y + 12))
    board.paste(b, (x + 12 + TW + 40, y + 12))
    d.text((x + 12 + TW + 6, y + 12 + TH // 2 - 20), "→", font=fA, fill="#ffd23f")
    d.text((x + 12, y + TH + 18), f"{n}. {t0:05.2f}–{t1:05.2f}s  {name}", font=fT, fill="#ffd23f")
    d.text((x + 12, y + TH + 44), f"CAM: {cam}", font=fN, fill="#ffffff")
    d.text((x + 12, y + TH + 64), f"DOES: {act}", font=fN, fill="#b8c0cc")

board.save(out)
print("saved", out, board.size)
