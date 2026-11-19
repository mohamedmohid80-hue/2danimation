"""Overlay captions/labels on rendered Blender panels and tile a 3x3 storyboard.

Usage: python3 make_board.py PANEL_DIR OUT_PNG
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

src, out = Path(sys.argv[1]), Path(sys.argv[2])
HERE = Path(__file__).parent
MONT = str(HERE / "fonts/Montserrat-900.ttf")
DEJAVU_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
DEJAVU = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
COLORS = ["#3ee05a", "#ff3b3b", "#ff5fc8", "#ffe14d", "#3fe6ff"]

# same beats as the Remotion board: (caption w1, w2, colour, y, time, VO, shot)
PANELS = [
    ("IF", "YOU", 0, 0.6, "00.0", '"If you slammed your face into a tree..."', "Wide, push in to the beak. Chips fly."),
    ("HUNDREDS", "OF G", 1, 0.6, "06.3", '"...hundreds of g."', "Macro on impact, flash ring. 400 g label."),
    ("IN", "KERATIN", 3, 0.6, "13.6", '"So you coat it in keratin..."', "Beak macro. Keratin sheath glows yellow."),
    ("SHRINK", "IT", 2, 0.6, "20.3", '"So you shrink it..."', "X-ray head. Tiny brain, arrows squeeze in."),
    ("THIRD", "EYELID", 4, 0.6, "26.3", '"So a third eyelid snaps shut..."', "Eye macro. Membrane slides, chips fly."),
    ("LIKE", "A TRIPOD", 0, 0.72, "36.8", '"...like a tripod."', "Ghosted body. Feet + tail triangle."),
    ("AROUND", "YOUR SKULL", 1, 0.6, "42.0", '"...wraps all the way around your skull"', "X-ray. Orange tongue loops the skull."),
    ("IT'S A", "HAMMER", 3, 0.6, "55.8", '"It\'s a hammer."', "Impact flash. Deadpan beat."),
    ("CONGRATULATIONS", None, 2, 0.6, "61.0", '"Congratulations. You built a..."', "Turns to camera and winks."),
]


def shadowed_text(img, xy, parts, font, anchor_center=True):
    """Draw [(text, colour), ...] on one line with a soft drop shadow."""
    d = ImageDraw.Draw(img)
    gap = int(font.size * 0.3)
    widths = [d.textlength(t, font=font) for t, _ in parts]
    total = sum(widths) + gap * (len(parts) - 1)
    x0 = xy[0] - total / 2 if anchor_center else xy[0]
    y = xy[1] - font.size / 2
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    x = x0
    for (t, _), w in zip(parts, widths):
        sd.text((x, y + font.size * 0.09), t, font=font, fill=(0, 0, 0, 170))
        x += w + gap
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(font.size * 0.12)))
    x = x0
    for (t, c), w in zip(parts, widths):
        d.text((x, y), t, font=font, fill=c, stroke_width=2, stroke_fill=(0, 0, 0, 90))
        x += w + gap


def big_label(img):
    """'400 g' title in the penguin '-40°' style, plus a small comparison pill."""
    W, H = img.size
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = ImageFont.truetype(MONT, int(W * 0.14))
    text = "400 g"
    tw = d.textlength(text, font=f)
    x, y = W - tw - W * 0.07, H * 0.12
    d.text((x, y + W * 0.012), text, font=f, fill="#12204f", stroke_width=int(W * 0.009), stroke_fill="#12204f")
    d.text((x, y), text, font=f, fill="#ffffff", stroke_width=int(W * 0.009), stroke_fill="#1d2f6f")
    layer = layer.rotate(4, center=(x + tw / 2, y), resample=Image.BICUBIC)
    img.alpha_composite(layer)
    d = ImageDraw.Draw(img)
    fs = ImageFont.truetype(MONT, int(W * 0.04))
    sub = "concussion ≈ 100 g"
    sw = d.textlength(sub, font=fs)
    bx, by = W - sw - W * 0.1, H * 0.12 + W * 0.2
    d.rounded_rectangle((bx - 22, by - 12, bx + sw + 22, by + fs.size + 16), radius=16, fill=(18, 32, 79, 220))
    d.text((bx, by), sub, font=fs, fill="#ffffff")


PW, PH, STRIP = 360, 640, 120
tiles = []
for i, (w1, w2, c, yfrac, t, vo, shot) in enumerate(PANELS, 1):
    im = Image.open(src / f"scene{i}.png").convert("RGBA")
    W, H = im.size
    if i == 2:
        big_label(im)
    font = ImageFont.truetype(MONT, int(W * 0.059))
    parts = [(w1, "#ffffff"), (w2, COLORS[c])] if w2 else [(w1, COLORS[c])]
    shadowed_text(im, (W / 2, H * yfrac), parts, font)
    tile = Image.new("RGBA", (PW, PH + STRIP), "#15171c")
    tile.paste(im.resize((PW, PH), Image.LANCZOS), (0, 0))
    d = ImageDraw.Draw(tile)
    d.text((14, PH + 10), f"{i}  |  ~{t}s", font=ImageFont.truetype(DEJAVU_B, 20), fill="#ffd23f")
    d.text((14, PH + 42), vo, font=ImageFont.truetype(DEJAVU_B, 15), fill="#ffffff")
    d.text((14, PH + 70), shot, font=ImageFont.truetype(DEJAVU, 15), fill="#b8c0cc")
    tiles.append(tile)

G = 10
board = Image.new("RGBA", (3 * PW + 4 * G, 3 * (PH + STRIP) + 4 * G), "#0b0c0f")
for k, tile in enumerate(tiles):
    board.paste(tile, (G + (k % 3) * (PW + G), G + (k // 3) * (PH + STRIP + G)))
board.convert("RGB").save(out)
print("saved", out, board.size)
