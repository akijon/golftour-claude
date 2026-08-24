#!/usr/bin/env python3
"""Build logo variants from the text-free crest:
  - transparent crest with text (gold ELDTÚRINN + GOLF SHS 2026)
  - dark background version
  - light background version
The transparent crest WITHOUT text already ships as public/eldturin-logo-transparent.png.
"""
import glob, os
from PIL import Image, ImageDraw, ImageFont

def find_font():
    for c in ["/usr/share/fonts/truetype/freefont/FreeSerif.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"]:
        if glob.glob(c): return c
    raise SystemExit("no serif font")

GOLD=(228,198,101,255); GOLD_DARK=(160,132,58,255)
CREAM=(245,241,230,255); CRIMSON=(124,35,30,255)

def char_along_arc(target, cx, x_frac, cy, arc_h, ch, font, fill):
    x = cx + x_frac*(target.width*0.42)
    y = cy - arc_h*(1 - x_frac*x_frac)
    tmp = Image.new("RGBA",(90,110),(0,0,0,0))
    td = ImageDraw.Draw(tmp)
    bb = td.textbbox((0,0),ch,font=font)
    w=bb[2]-bb[0]; h=bb[3]-bb[1]
    td.text((45-w/2-bb[0], 55-h/2-bb[1]),ch,font=font,fill=fill)
    target.alpha_composite(tmp,dest=(int(x-45),int(y-55)))

def draw_top_text(target, cx, base_y, arc_h, txt, font):
    n=len(txt)
    for i,ch in enumerate(txt):
        x_frac = -1 + (2*i+1)/n
        char_along_arc(target, cx, x_frac, base_y, arc_h, ch, font, GOLD_DARK)
        char_along_arc(target, cx, x_frac, base_y-2, arc_h, ch, font, GOLD)

def build_crest_text_layer(W=1200, H=1000):
    """Return RGBA image: crest (cropped from textfree) + gold arched text, transparent bg."""
    im = Image.new("RGBA",(W,H),(0,0,0,0))
    d = ImageDraw.Draw(im)
    crest = Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "crest_textfree.png")).convert("RGBA")
    cx0,cy0,cx1,cy1 = 489,41,924,502
    crest = crest.crop((cx0,cy0,cx1,cy1))
    target_w = int(W*0.46)
    ratio = target_w/crest.width
    new_h = int(crest.height*ratio)
    crest = crest.resize((target_w,new_h), Image.Resampling.LANCZOS)
    cxp = (W-target_w)//2
    cyp = int(H*0.60) - new_h//2
    im.alpha_composite(crest,(cxp,cyp))
    font = ImageFont.truetype(find_font(), 78)
    draw_top_text(im, W/2, int(H*0.30), int(H*0.22), "ELDTÚRINN", font)
    # bottom text
    bot = ImageFont.truetype(find_font(), 62)
    bb = d.textbbox((0,0),"GOLF SHS 2026",font=bot)
    tw = bb[2]-bb[0]
    by = int(cyp+new_h+40)-bb[1]
    for dy,col in ((-1,GOLD_DARK),(0,GOLD)):
        d.text((W/2-tw/2-bb[0], by+dy), "GOLF SHS 2026", font=bot, fill=col)
    return im

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    pub = os.path.join(here, "..", "..", "public")
    layer = build_crest_text_layer()
    layer.save(os.path.join(pub, "eldturin-crest-text-transparent.png"))
    print("transparent-with-text", layer.size)
    # dark background
    dark = Image.new("RGBA",layer.size,CRIMSON)
    dark.alpha_composite(layer)
    dark.convert("RGB").save(os.path.join(pub, "eldturin-logo-dark.png"), quality=95)
    print("dark", dark.size)
    # light background
    light = Image.new("RGBA",layer.size,CREAM)
    light.alpha_composite(layer)
    light.convert("RGB").save(os.path.join(pub, "eldturin-logo-light.png"), quality=95)
    print("light", light.size)

if __name__=="__main__":
    main()
