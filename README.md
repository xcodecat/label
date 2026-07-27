# CatCaddy produce recognizer — training kit

The Info-tab camera ships with a general recognizer (MobileNet). To make it
know *your* produce, train a small model on the commodities in your PLU list and
point the app at it. No app rebuild needed — it's just two URLs in Settings.

## Files
- `classes.json` — 163 produce commodities pulled from your PLU list. **Edit this
  first**: delete anything you don't sell or can't photograph, merge duplicates
  (e.g. potato/potatoes), and fix odd tokens (bok→bok choy, gai→gai lan, ong→ong choy, name→name yam).
- `fetch_images.py` — downloads images per class into `data/<class>/`. Swap in your
  own store photos if you have them; they work far better than web images.
- `train_produce.py` — transfer-learns MobileNetV2 and exports a TF.js model + `labels.json`.

## Steps
1. `pip install bing-image-downloader "tensorflow==2.15.*" tensorflowjs pillow`
2. `python fetch_images.py --per-class 120` then **hand-review `data/` and delete junk.**
3. `python train_produce.py --data data --epochs 12`
4. Host `web_model/` (model.json + shards + labels.json) on any HTTPS host with CORS
   (GitHub Pages, Cloudflare Pages, your own domain, the same Apps Script host, etc.).
5. In CatCaddy → **Settings → Produce camera**, paste the `model.json` URL and the
   `labels.json` URL, tap **Save model settings**, then open the camera. Tap
   **Save recognizer for offline** once online to cache it for no-signal use.

## Must match
The app feeds the model pixels scaled to **[0,1]**, NHWC, **224×224**. `train_produce.py`
already trains with `Rescaling(1/255)` to match. If you change one, change both.

## Reality check
A phone-friendly transfer-learned model will nail distinct commodities (banana,
broccoli, lemon, pepper…) but **cannot** tell apart look-alike varieties (ambrosia
vs fuji apple) from a photo — nothing can, reliably. Keep classes at the commodity
level and let the PLU search + the info card handle the variety.
