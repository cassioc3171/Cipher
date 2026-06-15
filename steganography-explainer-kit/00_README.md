# 🦎 Hidden in Plain Sight — the Steganography Explainer Kit (for Cipher)

A complete, ready-to-produce content kit that explains **steganography** to a teen / social-media audience — simply, fun, and on-brand for **Cipher** — across **one Instagram video** and **one interactive web explainer**, in **English + Persian**.

**The idea in one line:** *A secret can hide inside something totally ordinary — a text, a photo, a song, a file — so nobody even knows it's there. Cipher is the app that does it for real.* Guided by **Steg, the pixel-chameleon** 🦎.

---

## What's in the box

| # | File | What it is |
|---|---|---|
| 00 | `00_README.md` | This file — start here |
| 01 | `01_Research-Brief.md` | The deep-research: facts, history, mechanics, modern hooks, all cited |
| 02 | `02_Creative-Concept-Pack.md` | The creative bible: mascot, metaphors, voice, the 3 directions, Cipher tie-in |
| 03 | `03_Instagram-Video-Script-EN.md` | ~50s vertical script + shot-by-shot storyboard + caption (English) |
| 04 | `04_Instagram-Video-AI-Prompts.md` | Shot-by-shot AI video-generation prompts (Seedance/Veo/Runway/Kling) |
| 05 | `05_Web-Explainer-Build-Guide.md` | How the interactive explainer works + how to ship it |
| 06 | `06_Image-Prompts.md` | 14 ready-to-run prompts for Nano Banana Pro / Imagen (+ exact commands) |
| 07 | `07_Persian-Versions.md` | Persian (Farsi) script, captions, web copy + RTL build notes |
| — | `web-explainer/index.html` | **Working** interactive explainer (real, in-browser steganography) |
| — | `images/*.svg` + `*.png` | 8 finished, on-brand illustrations (mascot, title, 4 metaphors, crypto-vs-steg, endcard) |
| — | `images/generate_art.py` | The script that generates the art (re-run to tweak) |

---

## The creative spine (TL;DR)

- **Mascot:** *Steg*, a pixel-chameleon whose skin blends into anything and whose tail dissolves into bits (a nod to the Cipher logo).
- **Core contrast:** 🔒 Cryptography hides *what* you say. 🦎 Steganography hides *that* you said anything. **Cipher does both.**
- **Four hiding spots:** 📝 text (invisible characters) · 🖼️ image (last-bit/LSB) · 🎧 voice (a face in the noise) · 📁 file (the secret pocket after "THE END").
- **The killer teen hook:** *"You already do this."* Posting a lyric your mom reads as a song and your bestie reads as a breakup = social steganography.
- **Wow facts:** your printer's secret yellow dots · invisible AI watermarks · malware hidden in cute images.
- **Meta payoff:** every asset hides a real secret (the video caption is an acrostic; the web page hides a message that decodes to **CIPHER**).

---

## How to use it (suggested order)

1. **Skim `02_Creative-Concept-Pack.md`** — confirm the direction feels right (change anything you want).
2. **Open `web-explainer/index.html`** in a browser — play with the real text + image demos. Ship via the build guide.
3. **Make the video:** generate art with `06_Image-Prompts.md`, generate b-roll with `04_…AI-Prompts.md`, follow `03_…Script-EN.md` to assemble in CapCut/Premiere. Burn in captions.
4. **Localize:** use `07_Persian-Versions.md` for the Persian cut and page.
5. **Generate raster art** (optional): set `GEMINI_API_KEY` and run the commands in `06_Image-Prompts.md` for photoreal versions; the SVG/PNG art in `images/` is ready to use right now.

---

## Production notes

- **Art is real and editable.** The 8 illustrations are vector SVGs (plus 900px PNGs). Re-run `images/generate_art.py` to recolor or tweak.
- **The web demos are real steganography**, running 100% client-side (nothing uploaded) — true to Cipher's privacy promise. Logic is round-trip-verified.
- **Brand-locked** to Cipher: cobalt `#2563EB`, violet `#5A0FC8`, signal-green `#3DDC84`, midnight `#0B1020`. Hidden things glow green; ordinary things stay dim.
- **Series-ready:** Steg can carry an ongoing "Steg explains" short-form series, not just one video.

*Built around the real Cipher feature set: AES-256 encryption + Steg / Emoji / Persian-disguise modes = lock the meaning, then hide the message itself.*
