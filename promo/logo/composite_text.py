#!/usr/bin/env python3
"""Composite crisp gold arched text onto a text-free crest banner."""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def find_font():
    import glob
    cands = [
        "/usr/share/fonts/truetype/freefont/FreeSerif.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    ]
    for c in cands:
        if glob.glob(c):
            return c
    raise SystemExit("no serif font found")

def text_on_arc(draw, cx, cy, radius, text, font, fill, start_deg, end_deg, direction="cw"):
    """Draw text centered along an arc between start_deg..end_deg (degrees, 0=right, positive ccw).
    Puts letters on the circle so their bases face outward."""
    import math
    n = len(text)
    span = end_deg - start_deg
    for i, ch in enumerate(text):
        # position of this char along the arc (center of char)
        frac = (i + 0.5) / n
        deg = start_deg + span * frac
        a = math.radians(deg)
        x = cx + radius * math.cos(a)
        y = cy - radius * math.sin(a)
        # rotation so letter base faces radially outward
        rot = -math.degrees(a) if direction == "cw" else (180 - math.degrees(a))
        # draw char on temp image and rotate
        tmp = Image.new("RGBA", (64, 64), (0,0,0,0))
        td = ImageDraw.Draw(tmp)
        bbox = td.textbbox((0,0), ch, font=font)
        w = bbox[2]-bbox[0]; h = bbox[3]-bbox[1]
        td.text((32-w/2-bbox[0], 32-h/2-bbox[1]), ch, font=font, fill=fill)
        tmp = tmp.rotate(rot, resample=Image.Resampling.BICUBIC, center=(32,32))
        draw.alpha_composite(tmp, dest=(int(x-32), int(y-32)))

def main(img_path, out_path):
    im = Image.open(img_path).convert("RGBA")
    W,H = im.size
    font_path = find_font()
    # base font size ~ relative to image width
    base = max(28, int(W*0.055))
    top_font = ImageFont.truetype(font_path, base)
    bot_font = ImageFont.truetype(font_path, int(base*0.85))
    gold = (228, 198, 101, 255)
    gold_dark = (170, 140, 60, 255)
    cx, cy = W/2, H/2
    # ---- top arched text: ELDTÚRINN ----
    # draw twice: shadow/dark then gold, along top arc
    radius_top = H*0.36
    text_on_arc(im, cx, cy, radius_top, "ELDTÚRINN", top_font, gold_dark,
                -150, -30, direction="ccw")
    text_on_arc(im, cx, cy, radius_top-2, "ELDTÚRINN", top_font, gold,
                -150, -30, direction="ccw")
    # ---- bottom text: GOLF SHS 2026 ----
    d = ImageDraw.Draw(im)
    bbox = d.textbbox((0,0), "GOLF SHS 2026", font=bot_font)
    tw = bbox[2]-bbox[0]
    by = cy + H*0.30
    for dy, col in ((-1,gold_dark),(0,gold)):
        d.text((cx-tw/2-bbox[0], by+dy-bbox[1]), "GOLF SHS 2026", font=bot_font, fill=col)
    im.convert("RGB").save(out_path, quality=95)
    print("saved", out_path)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
