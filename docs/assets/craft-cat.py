#!/usr/bin/env python3
"""
Pixel-art orange tabby cat — v3. Built from geometric primitives (filled
ellipses, triangles, pixel strokes) for proper cat proportions, not
elongated-weasel body. 48x32 canvas per frame, 8 walk frames.
Inspired by Stardew Valley / Harvest Moon-style side-view cat: stocky body,
big round head, prominent curved tail, cream belly, tabby stripes, visible
face (eye + nose + ears).
"""
from PIL import Image, ImageDraw
from pathlib import Path

# Palette
BG = (0, 0, 0, 0)
DARK = (28, 18, 10, 255)       # outline
ORANGE = (232, 150, 76, 255)   # fur base
ORANGE_H = (250, 200, 130, 255) # highlight
ORANGE_S = (176, 98, 44, 255)  # shadow
STRIPE = (108, 58, 22, 255)    # tabby stripe
CREAM = (250, 235, 198, 255)   # belly
CREAM_S = (218, 196, 160, 255) # belly shadow
WHITE = (255, 250, 240, 255)   # paws
PINK = (230, 136, 146, 255)    # nose
GREEN = (188, 222, 96, 255)    # iris
BLACK = (22, 16, 10, 255)      # pupil slit
SHINE = (255, 250, 210, 255)   # eye shine

W, H = 48, 32

# Pixel-level primitives -----------------------------------------------------

def put(img, x, y, color):
    if 0 <= x < W and 0 <= y < H:
        img.putpixel((x, y), color)


def fill_ellipse(img, cx, cy, rx, ry, color, outline=None):
    """Fill a pixel ellipse. If outline given, draw outline in that color."""
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx = (x - cx) / rx
            dy = (y - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                put(img, x, y, color)
    if outline:
        # Walk the perimeter
        prev_rows = {}
        for y in range(cy - ry, cy + ry + 1):
            # find leftmost and rightmost filled x in row
            xs = [x for x in range(cx - rx, cx + rx + 1)
                  if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0]
            if not xs:
                continue
            put(img, min(xs), y, outline)
            put(img, max(xs), y, outline)
            prev_rows[y] = (min(xs), max(xs))
        # Top & bottom caps
        if cy - ry in prev_rows:
            lo, hi = prev_rows[cy - ry]
            for x in range(lo, hi + 1):
                put(img, x, cy - ry, outline)
        if cy + ry in prev_rows:
            lo, hi = prev_rows[cy + ry]
            for x in range(lo, hi + 1):
                put(img, x, cy + ry, outline)


def filled_triangle(img, p1, p2, p3, color):
    xs = [p1[0], p2[0], p3[0]]
    ys = [p1[1], p2[1], p3[1]]
    for y in range(min(ys), max(ys) + 1):
        for x in range(min(xs), max(xs) + 1):
            # Barycentric test
            def sign(a, b, c):
                return (a[0]-c[0])*(b[1]-c[1]) - (b[0]-c[0])*(a[1]-c[1])
            d1 = sign((x, y), p1, p2)
            d2 = sign((x, y), p2, p3)
            d3 = sign((x, y), p3, p1)
            has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
            has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
            if not (has_neg and has_pos):
                put(img, x, y, color)


def line(img, x0, y0, x1, y1, color):
    """Bresenham line — pixel perfect."""
    dx = abs(x1 - x0); dy = abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        put(img, x0, y0, color)
        if x0 == x1 and y0 == y1: break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy; x0 += sx
        if e2 < dx:
            err += dx; y0 += sy


def rect_fill(img, x, y, w, h, color):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            put(img, xx, yy, color)


# Cat builder ----------------------------------------------------------------

def build_cat(frame_idx):
    img = Image.new("RGBA", (W, H), BG)

    # BODY — stocky ellipse, center around (24, 18), rx=13, ry=6
    fill_ellipse(img, 24, 18, 13, 6, ORANGE, outline=DARK)
    # Body shading — upper half highlight, lower half keeps orange base
    for y in range(13, 18):
        for x in range(14, 35):
            # top-left of body gets highlight
            dx = (x - 24) / 13
            dy = (y - 18) / 6
            if dx * dx + dy * dy <= 0.85 and y <= 16:
                img.putpixel((x, y), ORANGE_H)
    # Tabby stripes (vertical darker bars)
    for stripe_x in (20, 24, 28):
        for y in range(14, 20):
            if 14 <= y <= 19 and ((stripe_x - 24) / 13) ** 2 + ((y - 18) / 6) ** 2 <= 0.75:
                img.putpixel((stripe_x, y), STRIPE)
                if y < 18:
                    img.putpixel((stripe_x, y + 1), STRIPE)

    # Cream belly — ellipse under the body
    for y in range(19, 25):
        for x in range(15, 34):
            dx = (x - 24) / 11
            dy = (y - 21) / 3.5
            if dx * dx + dy * dy <= 1.0:
                put(img, x, y, CREAM)
    # Belly outline
    for x in range(15, 34):
        for y in range(19, 25):
            dx = (x - 24) / 11
            dy = (y - 21) / 3.5
            v = dx * dx + dy * dy
            if 0.85 < v <= 1.0:
                put(img, x, y, CREAM_S)

    # HEAD — round, positioned left of body, center (11, 13), r=6
    fill_ellipse(img, 11, 13, 6, 5, ORANGE, outline=DARK)
    # Chin / cream
    for y in range(13, 18):
        for x in range(7, 14):
            dx = (x - 10) / 4
            dy = (y - 15) / 2.2
            if dx * dx + dy * dy <= 1.0 and y >= 14:
                put(img, x, y, CREAM)

    # EARS — two pointy triangles on top of head
    # Left ear: tip at (7, 5), base (6,9)-(9,9)
    filled_triangle(img, (6, 9), (9, 9), (7, 5), ORANGE)
    line(img, 6, 9, 7, 5, DARK)
    line(img, 7, 5, 9, 9, DARK)
    # Inner ear pink
    put(img, 7, 7, PINK)
    put(img, 7, 8, PINK)

    # Right ear: tip at (14, 5), base (12,9)-(15,9)
    filled_triangle(img, (12, 9), (15, 9), (14, 5), ORANGE)
    line(img, 12, 9, 14, 5, DARK)
    line(img, 14, 5, 15, 9, DARK)
    put(img, 14, 7, PINK)
    put(img, 13, 8, PINK)

    # FACE — eye, nose, mouth, whiskers
    # Eye (single large one in profile view)
    put(img, 9, 12, DARK)       # eye outline top
    put(img, 10, 12, DARK)
    put(img, 8, 13, DARK)
    put(img, 9, 13, GREEN)
    put(img, 10, 13, GREEN)
    put(img, 11, 13, DARK)
    put(img, 9, 14, BLACK)
    put(img, 10, 14, DARK)
    # Eye shine
    put(img, 10, 13, SHINE)
    # Nose — pink triangle at the snout
    put(img, 6, 14, PINK)
    put(img, 6, 15, PINK)
    put(img, 5, 15, DARK)
    # Mouth
    put(img, 6, 16, DARK)
    put(img, 7, 16, DARK)
    # Whisker
    put(img, 4, 15, DARK)
    put(img, 4, 14, DARK)

    # TAIL — curves up and back. Start at right side of body, arc over.
    # Use pixel line segments to trace a curve.
    tail_frame_offset = [0, 1, 1, 0, 0, -1, -1, 0][frame_idx % 8]
    tail_path = [
        (37, 17), (39, 16), (41, 14), (42, 12),
        (43, 10), (43 + tail_frame_offset, 8), (42 + tail_frame_offset, 6),
        (40 + tail_frame_offset, 5), (38 + tail_frame_offset, 5),
    ]
    # Draw tail as 2px thick segments
    for i in range(len(tail_path) - 1):
        x0, y0 = tail_path[i]
        x1, y1 = tail_path[i + 1]
        line(img, x0, y0, x1, y1, ORANGE)
        # Thicken below / above
        line(img, x0, y0 + 1, x1, y1 + 1, ORANGE_S)
    # Tail outline (rough — just mark tips with DARK)
    tx, ty = tail_path[-1]
    put(img, tx, ty, DARK)
    put(img, tx - 1, ty, DARK)
    put(img, tx, ty - 1, DARK)
    # Tail stripes (tabby)
    for sx, sy in [(40, 12), (42, 10)]:
        if 0 <= sx < W and 0 <= sy < H:
            img.putpixel((sx, sy), STRIPE)

    # LEGS — 4 legs, front pair ~x=15-17, 19-21, back pair ~x=28-30, 32-34
    # Per-frame leg positions
    # Each leg: (top_x, length)
    LEG_FRAMES = [
        # (fl, fr, bl, br) — top col of leg (2px wide leg)
        # length in pixels downward from body bottom (y=24)
        {"fl": (15, 6), "fr": (20, 4), "bl": (29, 4), "br": (33, 6)},  # 0 contact
        {"fl": (16, 5), "fr": (20, 5), "bl": (29, 5), "br": (33, 5)},  # 1 passing
        {"fl": (17, 4), "fr": (20, 6), "bl": (29, 6), "br": (33, 4)},  # 2 reach
        {"fl": (16, 5), "fr": (20, 5), "bl": (29, 5), "br": (33, 5)},  # 3 passing
        {"fl": (15, 4), "fr": (21, 6), "bl": (28, 6), "br": (33, 4)},  # 4 opp contact
        {"fl": (16, 5), "fr": (21, 5), "bl": (28, 5), "br": (33, 5)},  # 5 passing
        {"fl": (17, 6), "fr": (22, 4), "bl": (27, 4), "br": (33, 6)},  # 6 reach opp
        {"fl": (16, 5), "fr": (21, 5), "bl": (28, 5), "br": (33, 5)},  # 7 passing
    ]
    fr = LEG_FRAMES[frame_idx % 8]

    def draw_leg(top_col, length):
        # Leg shaft: 2px wide (columns top_col, top_col+1) with DARK outline
        # on both sides. Starts at y=24 (just below belly), goes down `length`.
        for i in range(length):
            y = 24 + i
            if y >= H: break
            last = (i == length - 1)
            col = ORANGE if not last else WHITE
            put(img, top_col - 1, y, DARK)
            put(img, top_col, y, col)
            put(img, top_col + 1, y, col)
            put(img, top_col + 2, y, DARK)
        # Cap bottom of leg
        yb = 24 + length
        if yb < H:
            for cx in range(top_col - 1, top_col + 3):
                put(img, cx, yb, DARK)

    # Draw back legs first (behind), then front
    bl_top, bl_len = fr["bl"]
    br_top, br_len = fr["br"]
    fl_top, fl_len = fr["fl"]
    fr_top, fr_len = fr["fr"]
    draw_leg(bl_top, bl_len)
    draw_leg(br_top, br_len)
    draw_leg(fl_top, fl_len)
    draw_leg(fr_top, fr_len)

    return img


def main():
    out_dir = Path("/tmp/cat-v3")
    out_dir.mkdir(exist_ok=True)
    frames = [build_cat(i) for i in range(8)]
    for i, f in enumerate(frames):
        f.save(out_dir / f"frame-{i}.png")
    sheet = Image.new("RGBA", (W * 8, H), BG)
    for i, f in enumerate(frames):
        sheet.paste(f, (i * W, 0), f)
    sheet.save(out_dir / "walk.png")
    # 4x scaled for inspection
    scaled = sheet.resize((W * 8 * 4, H * 4), Image.Resampling.NEAREST)
    scaled.save(out_dir / "walk@4x.png")
    # Also a single frame at 8x for close inspection
    big = frames[0].resize((W * 8, H * 8), Image.Resampling.NEAREST)
    big.save(out_dir / "frame-0@8x.png")
    print(f"wrote {len(frames)} frames + walk.png + walk@4x.png + frame-0@8x.png to {out_dir}")


if __name__ == "__main__":
    main()
