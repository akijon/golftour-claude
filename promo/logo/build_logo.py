#!/usr/bin/env python3
"""Build a square-ish logo: tight-crop the clean crest, place it on a red canvas
with arched ELDTÚRINN above and GOLF SHS 2026 below, both in crisp gold."""
import glob, math, sys
from PIL import Image, ImageDraw, ImageFont

def find_font():
    for c in ["/usr/share/fonts/truetype/freefont/FreeSerif.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"]:
        if glob.glob(c): return c
    raise SystemExit("no font")

GOLD=(228,198,101,255); GOLD_DARK=(160,132,58,255); RED=(146,49,41,255)

def char_along_arc(target, cx, x_frac, cy, arc_h, ch, font, fill):
    """Place ch upright at horizontal position x_frac (-1..1) along a parabolic arch."""
    x = cx + x_frac*(target.width*0.42)
    # parabolic arch: max height at center (x_frac=0), lower at edges
    y = cy - arc_h*(1 - x_frac*x_frac)
    tmp = Image.new("RGBA",(90,110),(0,0,0,0))
    td = ImageDraw.Draw(tmp)
    bb = td.textbbox((0,0),ch,font=font)
    w=bb[2]-bb[0]; h=bb[3]-bb[1]
    td.text((45-w/2-bb[0], 55-h/2-bb[1]),ch,font=font,fill=fill)
    target.alpha_composite(tmp,dest=(int(x-45),int(y-55)))

def main(crest_path, out_path):
    # canvas 1200x1000 portrait-ish logo
    W,H = 1200, 1000
    im = Image.new("RGBA",(W,H),RED)
    d = ImageDraw.Draw(im)

    # tight-crop crest from source
    crest = Image.open(crest_path).convert("RGBA")
    # crest bbox known for 00011
    cx0,cy0,cx1,cy1 = 488,40,922,500
    crest = crest.crop((cx0,cy0,cx1,cy1))
    # scale crest to ~ 46% width, centered, lower-middle so text fits above
    target_w = int(W*0.46)
    ratio = target_w/crest.width
    new_h = int(crest.height*ratio)
    crest = crest.resize((target_w,new_h), Image.Resampling.LANCZOS)
    # place crest center at ~ y 60%
    cxp = (W-target_w)//2
    cyp = int(H*0.60) - new_h//2
    im.alpha_composite(crest, (cxp,cyp))

    # text
    font_path = find_font()
    top_font = ImageFont.truetype(font_path, 78)
    bot_font = ImageFont.truetype(font_path, 62)
    cx = W/2
    # TOP arched text: ELDTÚRINN, upright letters along an arch above the crest
    def draw_top(col, off):
        tmp=Image.new("RGBA",(W,H),(0,0,0,0))
        txt="ELDTÚRINN"; n=len(txt)
        arc_h = int(H*0.22)   # arch rise
        base_y = int(H*0.30)  # baseline of arch center
        for i,ch in enumerate(txt):
            x_frac = -1 + (2*i+1)/n   # -1..1 left-to-right
            char_along_arc(tmp, cx, x_frac, base_y+off, arc_h, ch, top_font, col)
        im.alpha_composite(tmp)
    draw_top(GOLD_DARK,1); draw_top(GOLD,0)

    # bottom text: GOLF SHS 2026, below crest, small gap
    bb=d.textbbox((0,0),"GOLF SHS 2026",font=bot_font); tw=bb[2]-bb[0]
    by = int(cyp+new_h+40)-bb[1]
    for dy,col in ((-1,GOLD_DARK),(0,GOLD)):
        d.text((cx-tw/2-bb[0], by+dy), "GOLF SHS 2026", font=bot_font, fill=col)

    im.convert("RGB").save(out_path, quality=95)
    print("saved", out_path, im.size)

if __name__=="__main__":
    main(sys.argv[1], sys.argv[2])
