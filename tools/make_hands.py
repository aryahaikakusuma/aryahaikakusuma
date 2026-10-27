"""Cut the two hands out of the 14090px scan into assets/hands.webp (RGBA).

Source: assets/creation-of-adam-14090.jpg ("A Criacao de Adao - Michelangelo Buonarroti.jpg",
Wikimedia Commons, CC0). Not served to visitors; only the cutout is.

Coordinates below are in "base" px: the 1498px-wide crop the hero code was first written against.
The output covers REGION of that crop at S times the resolution, so hero.js can keep its base units
and read the scale from the image width.

The matte is derived from the painting. The wall is cool grey, skin is warmer (higher b* in CIELAB).
A colour mask is intersected with two hand-drawn keep polygons (to drop the knee, cloak and robe),
cleaned up, and its edge colours are pulled in from the interior so no wall fringe survives.

Run from the project root:  python -I tools/make_hands.py
"""
import os
os.environ['OPENCV_IO_MAX_IMAGE_PIXELS'] = str(2 ** 40)
import cv2
import numpy as np

S = 3                                        # output px per base px
ORIGIN = (581, 510)                          # base crop origin in the old 3524px scan
REGION = (320, 1180, 40, 390)                # x0, x1, y0, y1 in base px
x0, x1, y0, y1 = REGION
W, H = (x1 - x0) * S, (y1 - y0) * S


def load_map():
    """Affine map from old-scan px to hi-res px (SIFT registration of the two scans).
    The old 3524px scan is kept only for this."""
    old = cv2.imread('assets/creation-of-adam.jpg')
    new4 = cv2.imread('assets/creation-of-adam-14090.jpg', cv2.IMREAD_REDUCED_COLOR_4)
    sift = cv2.SIFT_create(6000)
    k1, d1 = sift.detectAndCompute(cv2.cvtColor(old, cv2.COLOR_BGR2GRAY), None)
    k2, d2 = sift.detectAndCompute(cv2.cvtColor(new4, cv2.COLOR_BGR2GRAY), None)
    good = [a for a, b in cv2.BFMatcher().knnMatch(d1, d2, k=2) if a.distance < 0.7 * b.distance]
    src = np.float32([k1[g.queryIdx].pt for g in good])
    dst = np.float32([k2[g.trainIdx].pt for g in good])
    A, _ = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0)
    A[:, :] *= 4.0
    return A


M = load_map()

hi = cv2.imread('assets/creation-of-adam-14090.jpg')
# output px (u, v) -> base px -> old-scan px -> hi-res px
to_old = np.array([[1 / S, 0, ORIGIN[0] + x0], [0, 1 / S, ORIGIN[1] + y0], [0, 0, 1]])
T = (np.vstack([M, [0, 0, 1]]) @ to_old)[:2]
rgb = cv2.warpAffine(hi, T, (W, H), flags=cv2.WARP_INVERSE_MAP | cv2.INTER_AREA)
del hi

# The matte is built at a coarser scale on purpose: at full resolution the scan's crack texture and
# hardened outlines make the edge ragged. It is then upsampled and softened.
SM = S / 2                                                   # mask scale, px per base px
small = cv2.resize(rgb, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
lab = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2LAB).astype(np.float32), (0, 0), 2.4)
warmth = (lab[..., 2] - 130.5) + 0.5 * (lab[..., 1] - 130.5)
colour = ((warmth > 3.0) * 255).astype(np.uint8)

# keep polygons, in base px of the crop
ADAM = [(0, 60), (780, 60), (780, 290), (470, 290), (450, 312), (330, 318), (250, 345), (0, 372)]
GOD = [(700, 100), (1090, 104), (1130, 117), (1170, 109), (1210, 99), (1260, 72), (1300, 48),
       (1300, 214), (1170, 222), (1100, 224), (1090, 330), (700, 330)]
keep = np.zeros(colour.shape, np.uint8)
for poly in (ADAM, GOD):
    pts = np.array([((px - x0) * SM, (py - y0) * SM) for px, py in poly], np.int32)
    cv2.fillPoly(keep, [pts], 255)

ell = lambda k: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
m = cv2.bitwise_and(colour, keep)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, ell(5))              # bridge fresco cracks inside the skin
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, ell(9))               # drop specks and thin wall bridges
m = cv2.medianBlur(m, 9)

n, lbl, stats, _ = cv2.connectedComponentsWithStats(m)
big = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 4000 * SM * SM]
m = np.isin(lbl, big).astype(np.uint8) * 255
cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
m = np.zeros_like(m)
cv2.drawContours(m, cnts, -1, 255, -1)
m = cv2.GaussianBlur(m, (0, 0), 1.6)                          # smooth the outline before it is scaled up

# upsample, then pull the edge in a little so no wall fringe is left
mu = cv2.resize(m, (W, H), interpolation=cv2.INTER_CUBIC)
mu = ((mu > 140) * 255).astype(np.uint8)
mu = cv2.erode(mu, ell(3), iterations=int(2.2 * S))
alpha = cv2.GaussianBlur(mu, (0, 0), 0.45 * S).astype(np.float32) / 255

# wall seen through the gaps between fingers: cool and bright, large enough not to be a crack in the skin
labhi = cv2.cvtColor(rgb, cv2.COLOR_BGR2LAB).astype(np.float32)
labhi = cv2.GaussianBlur(labhi, (0, 0), 1.5)
wall = (((labhi[..., 2] - 130.5) + 0.5 * (labhi[..., 1] - 130.5) < 5.0) & (labhi[..., 0] > 180)).astype(np.uint8) * 255
wall = cv2.morphologyEx(wall, cv2.MORPH_OPEN, ell(3))
nw, lw, sw, _ = cv2.connectedComponentsWithStats(wall)
gaps = np.isin(lw, [i for i in range(1, nw) if sw[i, cv2.CC_STAT_AREA] > 40 * S * S]).astype(np.uint8) * 255
gaps = cv2.dilate(gaps, ell(3), iterations=2)
mu = cv2.bitwise_and(mu, cv2.bitwise_not(gaps))
alpha = cv2.GaussianBlur(mu, (0, 0), 0.45 * S).astype(np.float32) / 255

# decontaminate: edge pixels take their colour from the interior, not from the wall they blended with
core = cv2.erode(mu, ell(3), iterations=int(3 * S)).astype(np.float32) / 255
rgbf = rgb.astype(np.float32)
sig = 1.5 * S
num = cv2.GaussianBlur(rgbf * core[..., None], (0, 0), sig)
den = cv2.GaussianBlur(core, (0, 0), sig)[..., None]
inner = num / np.maximum(den, 1e-3)
solid = (core > 0.5)[..., None]
rgbf = np.where(solid | (den <= 0.02), rgbf, inner)

# bake the fade where the arms leave the frame (crop coordinates)
xs = x0 + np.arange(W, dtype=np.float32) / S
fade = np.clip(xs / 150, 0, 1) * np.clip((1300 - xs) / 300, 0, 1)
alpha *= fade[None, :]

out = np.dstack([np.clip(rgbf, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])
cv2.imwrite('assets/hands.webp', out, [cv2.IMWRITE_WEBP_QUALITY, 90])
back = cv2.imread('assets/hands.webp', cv2.IMREAD_UNCHANGED)
print('wrote assets/hands.webp', out.shape, 'alpha kept:', back is not None and back.shape[2] == 4,
      round(os.path.getsize('assets/hands.webp') / 1e6, 2), 'MB')
