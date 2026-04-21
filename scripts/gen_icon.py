"""
GovPilot Icon Generator — App Store & Google Play ready
Outputs:
  assets/icon.png              1024×1024 RGB  — iOS App Store + Expo base icon
  assets/adaptive-icon.png     1024×1024 RGBA — Android adaptive icon foreground (transparent bg)
  assets/google-play-icon.png    512×512  RGB  — Google Play store listing
  assets/icon-fullbleed.png    1024×1024 RGB  — PWA apple-touch-icon

Android adaptive icon rules:
  • Canvas 1024×1024; OS clips to various shapes (circle, squircle, etc.)
  • Safe zone  = center 66% = 676×676 (pixels 174-850). ALL content must be here.
  • Bleed zone = full 1024×1024. Background fill (teal) covers this.
  • backgroundColor in app.json provides the background; this file is FOREGROUND only.
"""
from PIL import Image, ImageDraw
import math, os, shutil

BASE   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, 'assets')

# ─── Teal gradient: top #5DE0CE → bottom #1E8FA0 ──────────────────────────
TEAL_TOP    = (93,  224, 206)
TEAL_BOTTOM = (30,  143, 160)
BG_COLOR_HEX = '#3EC4C0'   # midpoint teal used as adaptive icon backgroundColor

def teal_gradient(img: Image.Image):
    """Fill image with teal gradient (top→bottom)."""
    draw = ImageDraw.Draw(img)
    W, H = img.size
    for y in range(H):
        t = y / H
        r = int(TEAL_TOP[0]*(1-t) + TEAL_BOTTOM[0]*t)
        g = int(TEAL_TOP[1]*(1-t) + TEAL_BOTTOM[1]*t)
        b = int(TEAL_TOP[2]*(1-t) + TEAL_BOTTOM[2]*t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    # Subtle top-left brightness highlight
    for y in range(H):
        for x in range(0, W // 2, 2):
            tx, ty = x / (W/2), y / H
            boost = int(18 * (1-tx) * (1-ty))
            if boost > 0:
                px = img.getpixel((x, y))
                img.putpixel((x, y), (min(255,px[0]+boost), min(255,px[1]+boost), min(255,px[2]+boost)))


def draw_compass(draw, cx, cy, cr):
    """8-point compass rose centered at cx,cy with radius cr."""
    draw.ellipse([cx-cr-14, cy-cr-14, cx+cr+14, cy+cr+14], outline=(210,235,245), width=10)
    draw.ellipse([cx-cr-4,  cy-cr-4,  cx+cr+4,  cy+cr+4],  outline=(185,220,240), width=5)
    for i, deg in enumerate(range(0, 360, 45)):
        angle = math.radians(deg - 90)   # 0° = North (top)
        cardinal = (i % 2 == 0)
        if cardinal:
            tip_r, side_r, inner_r = cr*0.84, cr*0.155, cr*0.22
            col = (239, 90, 90) if deg == 0 else (79, 121, 213)
        else:
            tip_r, side_r, inner_r = cr*0.52, cr*0.09, cr*0.14
            col = (185, 210, 240)
        tip  = (cx + tip_r  * math.cos(angle), cy + tip_r  * math.sin(angle))
        perp = angle + math.pi/2
        lft  = (cx + side_r * math.cos(perp),  cy + side_r * math.sin(perp))
        rgt  = (cx - side_r * math.cos(perp),  cy - side_r * math.sin(perp))
        back = (cx - inner_r* math.cos(angle), cy - inner_r* math.sin(angle))
        draw.polygon([tip, lft, back, rgt], fill=col)
    # Center rings
    draw.ellipse([cx-26, cy-26, cx+26, cy+26], fill=(79, 121, 213))
    draw.ellipse([cx-17, cy-17, cx+17, cy+17], fill=(255, 255, 255))
    draw.ellipse([cx-8,  cy-8,  cx+8,  cy+8],  fill=(79, 121, 213))


def draw_building(draw, bld_cx, bld_top, scale=1.0):
    """Government building (columns + pediment + steps)."""
    col_color = (190, 215, 242)
    ped_color = (205, 225, 246)
    S = scale
    col_count, col_w, col_h, spacing = 5, int(32*S), int(108*S), int(72*S)
    total_w = (col_count-1)*spacing + col_w
    L = bld_cx - total_w//2
    # Pediment
    draw.polygon([(L-int(28*S), bld_top), (bld_cx+col_w//2, bld_top-int(72*S)),
                  (L+total_w+col_w+int(28*S), bld_top)], fill=ped_color)
    # Entablature
    draw.rectangle([L-int(22*S), bld_top, L+total_w+col_w+int(22*S), bld_top+int(22*S)], fill=col_color)
    # Columns
    for i in range(col_count):
        x = L + i*spacing
        draw.rounded_rectangle([x, bld_top+int(22*S), x+col_w, bld_top+int(22*S)+col_h], radius=5, fill=col_color)
        draw.rectangle([x-int(4*S), bld_top+int(18*S), x+col_w+int(4*S), bld_top+int(26*S)], fill=(200,222,246))
        draw.rectangle([x-int(4*S), bld_top+int(22*S)+col_h-int(4*S),
                        x+col_w+int(4*S), bld_top+int(22*S)+col_h+int(6*S)], fill=(200,222,246))
    # Steps
    for s in range(3):
        sw = total_w + col_w + int((44+s*28)*S)
        sx = bld_cx - sw//2
        sy = bld_top + int(22*S) + col_h + int(6*S) + s*int(15*S)
        draw.rectangle([sx, sy, sx+sw, sy+int(13*S)], fill=(200, 220, 244))


def draw_badge(draw, bcx, bcy, br):
    """Green compass badge."""
    draw.ellipse([bcx-br+5, bcy-br+5, bcx+br+5, bcy+br+5], fill=(0, 100, 80))
    draw.ellipse([bcx-br,   bcy-br,   bcx+br,   bcy+br],   fill=(34, 180, 132))
    draw.ellipse([bcx-br+9, bcy-br+9, bcx+br-9, bcy+br-9], fill=(52, 211, 153))
    draw.polygon([(bcx, bcy-int(br*0.58)), (bcx-int(br*0.16), bcy+int(br*0.08)),
                  (bcx+int(br*0.16), bcy+int(br*0.08))], fill=(255, 255, 255))
    draw.polygon([(bcx, bcy+int(br*0.58)), (bcx-int(br*0.10), bcy-int(br*0.04)),
                  (bcx+int(br*0.10), bcy-int(br*0.04))], fill=(170, 240, 215))
    draw.ellipse([bcx-int(br*0.11), bcy-int(br*0.11), bcx+int(br*0.11), bcy+int(br*0.11)], fill=(255,255,255))
    draw.ellipse([bcx-int(br*0.05), bcy-int(br*0.05), bcx+int(br*0.05), bcy+int(br*0.05)], fill=(52,211,153))


def draw_sparkles(draw, positions):
    """4-ray sparkles at given (x, y, size, width) tuples."""
    for sx, sy, size, w in positions:
        draw.line([sx, sy-size, sx, sy+size], fill=(255,255,255), width=w)
        draw.line([sx-size, sy, sx+size, sy], fill=(255,255,255), width=w)
        d = int(size * 0.62)
        draw.line([sx-d, sy-d, sx+d, sy+d], fill=(255,255,255), width=max(1,w-2))
        draw.line([sx+d, sy-d, sx-d, sy+d], fill=(255,255,255), width=max(1,w-2))


# ══════════════════════════════════════════════════════════════════
# 1.  icon.png — 1024×1024 RGB (iOS App Store & Expo base icon)
#     • No transparency (required by App Store)
#     • Apple applies rounded corners automatically — no need to pre-round
#     • Full bleed: gradient reaches all 4 corners
# ══════════════════════════════════════════════════════════════════
SIZE = 1024
ios = Image.new('RGB', (SIZE, SIZE))
teal_gradient(ios)
d = ImageDraw.Draw(ios)

# White card
d.rounded_rectangle([195, 125, 825, 855], radius=55, fill=(255, 255, 255))

# Content
draw_compass(d, cx=512, cy=400, cr=168)
draw_building(d, bld_cx=512, bld_top=640, scale=1.0)
draw_badge(d, bcx=728, bcy=762, br=96)
draw_sparkles(d, [(125,155,26,5), (882,205,20,4), (98,792,17,4), (876,832,22,5)])

ios.save(os.path.join(ASSETS, 'icon.png'))
print('✓ icon.png             1024×1024  RGB  — iOS App Store')

# ══════════════════════════════════════════════════════════════════
# 2.  adaptive-icon.png — 1024×1024 RGBA (Android adaptive foreground)
#     • Transparent background (teal comes from app.json backgroundColor)
#     • ALL content inside safe zone: pixels 174–850 (center 66%)
#     • Card 560×630, centered at (512, 492) → top=177, bottom=807 ✓
#     • Badge at (702, 726) → within safe zone ✓
# ══════════════════════════════════════════════════════════════════
fg = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
df = ImageDraw.Draw(fg)

SAFE = 174   # safe zone starts at x=174, y=174 (ends at x=850, y=850)

# White card — fits inside safe zone
card_cx, card_cy, card_w, card_h = 512, 492, 556, 630
df.rounded_rectangle([card_cx-card_w//2, card_cy-card_h//2,
                       card_cx+card_w//2, card_cy+card_h//2],
                      radius=48, fill=(255, 255, 255))

# Compass (smaller to stay in safe zone)
draw_compass(df, cx=512, cy=370, cr=140)
draw_building(df, bld_cx=512, bld_top=602, scale=0.84)
draw_badge(df, bcx=704, bcy=724, br=80)

fg.save(os.path.join(ASSETS, 'adaptive-icon.png'))
print('✓ adaptive-icon.png    1024×1024  RGBA — Android adaptive foreground')

# ══════════════════════════════════════════════════════════════════
# 3.  google-play-icon.png — 512×512 RGB (Google Play store listing)
#     • Simple downscale of icon.png
#     • LANCZOS for maximum quality
# ══════════════════════════════════════════════════════════════════
play = ios.resize((512, 512), Image.LANCZOS)
play.save(os.path.join(ASSETS, 'google-play-icon.png'))
print('✓ google-play-icon.png   512×512  RGB  — Google Play store listing')

# ══════════════════════════════════════════════════════════════════
# 4.  icon-fullbleed.png — copy of icon.png (PWA / apple-touch-icon)
# ══════════════════════════════════════════════════════════════════
shutil.copy(os.path.join(ASSETS, 'icon.png'),
            os.path.join(ASSETS, 'icon-fullbleed.png'))
print('✓ icon-fullbleed.png   1024×1024  RGB  — PWA apple-touch-icon')

print(f'\nAll assets saved to: {ASSETS}')
print(f'Use backgroundColor: "{BG_COLOR_HEX}" in app.json adaptiveIcon')
