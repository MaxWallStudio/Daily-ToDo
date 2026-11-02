from PIL import Image, ImageDraw
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "icons"
for size in (192, 512):
    scale = size / 512
    image = Image.new("RGBA", (size, size), "#376b54")
    draw = ImageDraw.Draw(image)
    box = tuple(round(v * scale) for v in (100, 114, 412, 398))
    draw.rounded_rectangle(box, radius=round(40 * scale), fill="#f6f8f6")
    points = [(160, 246), (220, 307), (353, 170)]
    draw.line([(round(x * scale), round(y * scale)) for x, y in points], fill="#376b54", width=round(40 * scale), joint="curve")
    for x, y in (points[0], points[-1]):
        r = round(20 * scale)
        x, y = round(x * scale), round(y * scale)
        draw.ellipse((x-r, y-r, x+r, y+r), fill="#376b54")
    for x in (172, 340):
        draw.line([(round(x * scale), round(91 * scale)), (round(x * scale), round(149 * scale))], fill="#d6e8dc", width=round(28 * scale))
    image.save(root / f"icon-{size}.png")
