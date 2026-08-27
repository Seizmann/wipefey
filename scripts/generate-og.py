import os
from PIL import Image, ImageDraw, ImageFont

def generate_og_image():
    # 1. Initialize 1200x630 image with #080809 background
    bg_color = (8, 8, 9)
    img = Image.new("RGB", (1200, 630), bg_color)
    draw = ImageDraw.Draw(img)

    # 2. Draw outer design border (24px inset)
    border_color = (23, 23, 26) # --w-gray-800
    draw.rectangle([(24, 24), (1176, 606)], outline=border_color, width=2)

    # 3. Draw Logo (160x160, centered at X=600, Y=130)
    # logo bounding box: (520, 130) to (680, 290)
    x_off = 520
    y_off = 130
    
    # Outer sensor frame (white)
    # stroke = 10px, rx=20px
    draw.rounded_rectangle(
        [(x_off + 10, y_off + 10), (x_off + 150, y_off + 150)],
        radius=20,
        outline="white",
        width=10
    )
    
    # Inner camera frame (gray to simulate 0.5 opacity)
    draw.rounded_rectangle(
        [(x_off + 40, y_off + 40), (x_off + 105, y_off + 105)],
        radius=10,
        outline=(128, 128, 128),
        width=7
    )
    
    # Wipe line (accent blue #0066f3, stroke=12px, round caps)
    # original path: M4 21h13 -> 20 to 85 x offset, 105 y offset
    w_start = (x_off + 20, y_off + 105)
    w_end = (x_off + 85, y_off + 105)
    w_color = (0, 102, 243) # --w-accent
    draw.line([w_start, w_end], fill=w_color, width=12)
    # Cap circles for round ends
    draw.ellipse([(w_start[0] - 6, w_start[1] - 6), (w_start[0] + 6, w_start[1] + 6)], fill=w_color)
    draw.ellipse([(w_end[0] - 6, w_end[1] - 6), (w_end[0] + 6, w_end[1] + 6)], fill=w_color)

    # Caret lines (white, joint=round)
    # original path: M24 11l4 4-4 4 -> offsets 120,55 to 140,75 to 120,95
    c_p1 = (x_off + 120, y_off + 55)
    c_p2 = (x_off + 140, y_off + 75)
    c_p3 = (x_off + 120, y_off + 95)
    draw.line([c_p1, c_p2, c_p3], fill="white", width=10)
    # Cap / Join circles for round ends/joins
    for pt in [c_p1, c_p2, c_p3]:
        draw.ellipse([(pt[0] - 5, pt[1] - 5), (pt[0] + 5, pt[1] + 5)], fill="white")

    # 4. Load Fonts
    sans_bold_path = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
    sans_reg_path = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
    mono_reg_path = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"

    font_title = ImageFont.truetype(sans_bold_path, 72)
    font_subtitle = ImageFont.truetype(sans_reg_path, 30)
    font_badge = ImageFont.truetype(mono_reg_path, 18)

    # 5. Draw Title ("Wipefey")
    title_text = "Wipefey"
    title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
    title_w = title_bbox[2] - title_bbox[0]
    draw.text((600 - title_w // 2, 320), title_text, fill="white", font=font_title)

    # 6. Draw Subtitle ("Clean metadata. Detect AI. 100% locally.")
    sub_text = "Clean metadata. Detect AI. 100% locally."
    sub_bbox = draw.textbbox((0, 0), sub_text, font=font_subtitle)
    sub_w = sub_bbox[2] - sub_bbox[0]
    draw.text((600 - sub_w // 2, 420), sub_text, fill=(161, 161, 168), font=font_subtitle)

    # 7. Draw Badge / Metadata ("by RexiO · free · open source (MIT)")
    badge_text = "by RexiO · free · open source (MIT)"
    badge_bbox = draw.textbbox((0, 0), badge_text, font=font_badge)
    badge_w = badge_bbox[2] - badge_bbox[0]
    draw.text((600 - badge_w // 2, 490), badge_text, fill=(110, 110, 119), font=font_badge)

    # 8. Save output PNG
    os.makedirs("public", exist_ok=True)
    out_path = "public/og-image.png"
    img.save(out_path, "PNG")
    print(f"OG Image generated at: {out_path}")

if __name__ == "__main__":
    generate_og_image()
