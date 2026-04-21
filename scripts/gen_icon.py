"""
GovPilot Icon Generator
Design: teal gradient bg + white card + compass rose (upper) + government columns (lower) + green badge
"""
from PIL import Image, ImageDraw
import math, os

SIZE = 1024
img = Image.new('RGB', (SIZE, SIZE))
draw = ImageDraw.Draw(img)

# ── 1. TEAL GRADIENT BACKGROUND (matches existing icon palette) ──
for y in range(SIZE):
    t = y / SIZE
    # #5DE0CE (93,224,206) → #1E8FA0 (30,143,160)
    r = int(93  * (1 - t) + 30  * t)
    g = int(224 * (1 - t) + 143 * t)
    b = int(206 * (1 - t) + 160 * t)
    draw.line([(0, y), (SIZE, y)], fill=(r, g, b))

# Slight diagonal highlight (top-left brighter)
for y in range(SIZE):
    for x_band in range(0, SIZE // 2, 1):
        t_x = x_band / (SIZE // 2)
        t_y = y / SIZE
        brightness = int(20 * (1 - t_x) * (1 - t_y))
        px_y = img.getpixel((x_band, y))
        img.putpixel((x_band, y), (
            min(255, px_y[0] + brightness),
            min(255, px_y[1] + brightness),
            min(255, px_y[2] + brightness)
        ))

draw = ImageDraw.Draw(img)

# ── 2. WHITE DOCUMENT CARD ──
doc = [195, 125, 825, 855]
draw.rounded_rectangle(doc, radius=55, fill=(255, 255, 255))

# Subtle inner shadow top edge
for i in range(6):
    alpha = int(12 - i * 2)
    draw.line([(doc[0] + 55, doc[1] + i), (doc[2] - 55, doc[1] + i)],
              fill=(180, 210, 220), width=1)

# ── 3. COMPASS ROSE (upper portion of card) ──
cx, cy = SIZE // 2, 400
cr = 168  # compass radius

# Outer decorative ring
draw.ellipse([cx - cr - 14, cy - cr - 14, cx + cr + 14, cy + cr + 14],
             outline=(210, 235, 245), width=10)
draw.ellipse([cx - cr - 4, cy - cr - 4, cx + cr + 4, cy + cr + 4],
             outline=(185, 220, 240), width=5)

# 8-point compass star
for i, angle_deg in enumerate(range(0, 360, 45)):
    angle = math.radians(angle_deg - 90)   # 0° = North (top)
    is_cardinal = (i % 2 == 0)

    if is_cardinal:
        tip_r   = cr * 0.84
        side_r  = cr * 0.155
        inner_r = cr * 0.22
        # North = coral/red, others = indigo blue
        if angle_deg == 0:
            fill_col = (239, 90, 90)    # coral north
        else:
            fill_col = (79, 121, 213)   # indigo
    else:
        tip_r   = cr * 0.52
        side_r  = cr * 0.09
        inner_r = cr * 0.14
        fill_col = (185, 210, 240)      # light blue ordinal

    tip_x  = cx + tip_r  * math.cos(angle)
    tip_y  = cy + tip_r  * math.sin(angle)
    perp   = angle + math.pi / 2
    left_x = cx + side_r * math.cos(perp)
    left_y = cy + side_r * math.sin(perp)
    right_x= cx - side_r * math.cos(perp)
    right_y= cy - side_r * math.sin(perp)
    back_x = cx - inner_r * math.cos(angle)
    back_y = cy - inner_r * math.sin(angle)

    draw.polygon(
        [(tip_x, tip_y), (left_x, left_y), (back_x, back_y), (right_x, right_y)],
        fill=fill_col
    )

# Compass center rings
draw.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=(79, 121, 213))
draw.ellipse([cx - 17, cy - 17, cx + 17, cy + 17], fill=(255, 255, 255))
draw.ellipse([cx -  8, cy -  8, cx +  8, cy +  8], fill=(79, 121, 213))

# ── 4. GOVERNMENT BUILDING (lower portion of card) ──
bld_cx   = SIZE // 2
bld_top  = 640
col_color = (190, 215, 242)
ped_color = (205, 225, 246)

col_count = 5
col_w     = 32
col_h     = 108
spacing   = 72
total_w   = (col_count - 1) * spacing + col_w
bld_left  = bld_cx - total_w // 2

# Pediment (triangle roof)
roof_pts = [
    (bld_left - 28, bld_top),
    (bld_cx + col_w // 2, bld_top - 72),
    (bld_left + total_w + col_w + 28, bld_top)
]
draw.polygon(roof_pts, fill=ped_color)

# Entablature (frieze)
draw.rectangle(
    [bld_left - 22, bld_top, bld_left + total_w + col_w + 22, bld_top + 22],
    fill=col_color
)

# Columns
for i in range(col_count):
    x = bld_left + i * spacing
    # shaft
    draw.rounded_rectangle(
        [x, bld_top + 22, x + col_w, bld_top + 22 + col_h],
        radius=5, fill=col_color
    )
    # capital
    draw.rectangle([x - 4, bld_top + 18, x + col_w + 4, bld_top + 26], fill=(200, 222, 246))
    # base
    draw.rectangle([x - 4, bld_top + 22 + col_h - 4, x + col_w + 4, bld_top + 22 + col_h + 6],
                   fill=(200, 222, 246))

# Steps
for s in range(3):
    sw = total_w + col_w + 44 + s * 28
    sx = bld_cx - sw // 2
    sy = bld_top + 22 + col_h + 6 + s * 15
    draw.rectangle([sx, sy, sx + sw, sy + 13], fill=(200, 220, 244))

# ── 5. GREEN BADGE (bottom-right) ──
bcx, bcy = 728, 762
br = 96

# Shadow
draw.ellipse([bcx - br + 5, bcy - br + 5, bcx + br + 5, bcy + br + 5],
             fill=(0, 100, 80))

# Outer green ring
draw.ellipse([bcx - br, bcy - br, bcx + br, bcy + br], fill=(34, 180, 132))

# Inner lighter green
draw.ellipse([bcx - br + 9, bcy - br + 9, bcx + br - 9, bcy + br - 9],
             fill=(52, 211, 153))

# White compass needle (N = white solid, S = translucent)
# North pointer (white)
draw.polygon(
    [(bcx, bcy - 56), (bcx - 15, bcy + 8), (bcx + 15, bcy + 8)],
    fill=(255, 255, 255)
)
# South pointer (tinted)
draw.polygon(
    [(bcx, bcy + 56), (bcx - 10, bcy - 4), (bcx + 10, bcy - 4)],
    fill=(170, 240, 215)
)
# Center pin
draw.ellipse([bcx - 11, bcy - 11, bcx + 11, bcy + 11], fill=(255, 255, 255))
draw.ellipse([bcx -  5, bcy -  5, bcx +  5, bcy +  5], fill=(52, 211, 153))

# ── 6. SPARKLES ──
sparkle_color = (255, 255, 255)
sparkles = [
    (125, 155, 26, 5),
    (882, 205, 20, 4),
    ( 98, 792, 17, 4),
    (876, 832, 22, 5),
]
for sx, sy, size, w in sparkles:
    draw.line([sx, sy - size, sx, sy + size], fill=sparkle_color, width=w)
    draw.line([sx - size, sy, sx + size, sy], fill=sparkle_color, width=w)
    d = int(size * 0.62)
    draw.line([sx - d, sy - d, sx + d, sy + d], fill=sparkle_color, width=w - 2)
    draw.line([sx + d, sy - d, sx - d, sy + d], fill=sparkle_color, width=w - 2)

# ── SAVE ──
out_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets', 'icon.png')
img.save(out_path)
print(f"Saved: {out_path}  ({SIZE}x{SIZE})")
