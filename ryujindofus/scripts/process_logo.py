from PIL import Image
import os

src = r"C:\Users\Luigi\.gemini\antigravity\brain\d82d53c6-2bb4-47cc-be51-dd044fd1901e\.user_uploaded\media_1793917179464_6a68ebf0.png"
out_dir = r"D:\Projetos\Ryujin_Dofus\ryujindofus\src\assets\brand"
os.makedirs(out_dir, exist_ok=True)
out_png = os.path.join(out_dir, "ryujin-mark.png")

img = Image.open(src).convert("RGBA")
print(f"Original size: {img.size}, mode: {img.mode}")

gray = img.convert("L")
w, h = img.size
alpha_img = Image.new("RGBA", (w, h), (255, 255, 255, 0))

pixels_gray = gray.load()
pixels_out = alpha_img.load()

for y in range(h):
    for x in range(w):
        val = pixels_gray[x, y]
        if val > 15:
            # Map smoothly
            pixels_out[x, y] = (255, 255, 255, val)
        else:
            pixels_out[x, y] = (255, 255, 255, 0)

bbox = alpha_img.getbbox()
print(f"Bounding box: {bbox}")
cropped = alpha_img.crop(bbox)
print(f"Cropped size: {cropped.size}, aspect ratio: {cropped.size[0]}/{cropped.size[1]} = {cropped.size[0]/cropped.size[1]:.4f}")
cropped.save(out_png, "PNG")
print(f"Saved: {out_png}")

