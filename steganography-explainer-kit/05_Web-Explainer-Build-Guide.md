# Interactive Web Explainer — Build Guide

A working, single-file interactive explainer ships in this kit:
**`web-explainer/index.html`** — open it in any browser, no build step, no dependencies, works offline.

It's not a mockup. Two of the demos are **real, functioning steganography** that run entirely in the visitor's browser (nothing is uploaded anywhere — fitting for Cipher).

---

## What's inside (section flow)

1. **Hero** — Steg (inline SVG, always renders) + "Hidden in Plain Sight" + a teaser that the page itself hides a secret.
2. **The big idea** — "Two ways to keep a secret": cryptography (lock) vs steganography (disguise), with the punch line.
3. **Four hiding spots** — the four metaphor cards (pulls `../images/metaphor-*.svg`).
4. **Try it · TEXT** — a real **zero-width-character** encoder/decoder. Hide a secret inside a normal sentence; copy it; paste it back to reveal. *This is literally Cipher's Steg mode.*
5. **Try it · IMAGE** — a real **LSB** demo on `<canvas>`. Bury a message in the pixels; see the before/after look identical; reveal it.
6. **Voice & files** — concept cards + a spectrogram "reveal" button (a hidden word appears) and a file-structure diagram.
7. **You already do this** — social steganography (the two-meanings lyric).
8. **Wow facts** — printer dots, AI watermarks, stegomalware, ancient history.
9. **CTA → Cipher** — the lock-then-hide 3-step, linking to the repo.
10. **Footer easter egg** — the page hides a real message (`console` + base64 → `CIPHER`).

---

## How the two real demos work

**Zero-width text** — each character of the secret becomes 8 bits; `0 → U+200B` (zero-width space), `1 → U+200C` (zero-width non-joiner), `U+200D` marks the end. The invisible string is slipped inside the cover text. The visible text is byte-for-byte the cover; the payload is genuinely invisible. Decoding filters those code points back out. *(Round-trip verified, emoji-safe.)*

**Image LSB** — the cover image is drawn on a canvas (so there's no cross-origin tainting). A 16-bit length header + the message bytes are written into the **least-significant bit of the red channel** of successive pixels. A 300×300 image holds ~11 KB. Revealing reads those bits back. *(Round-trip verified, emoji-safe.)*

Both are intentionally simple/teachable — not hardened. The honest hand-off line in the CTA: *for the real, encrypted version, use Cipher.*

---

## Ship it

**Option A — standalone (fastest).** Upload the `web-explainer/` folder (keep `../images/` alongside, or see "portability" below) to any static host: GitHub Pages, Netlify, Vercel, Cloudflare Pages. Done.

**Option B — drop into the existing Cipher site (Vite + React 19).**
- Quick: copy `index.html`'s `<section>` markup into a new route/page, move the `<style>` into a CSS module or Tailwind classes, and port the `<script>` functions into a component (`useEffect` for the canvas/console bits).
- Or embed the standalone file as-is in an `<iframe>` on a `/learn` page — zero refactor.
- The palette already matches your brand tokens (`--cobalt #2563eb`, `--violet #5a0fc8`, `--green #3ddc84`), so it'll feel native.

**Portability tip.** The four metaphor cards load from `../images/`. To make `index.html` fully self-contained, either (a) copy the four `metaphor-*.svg` into `web-explainer/` and change `src="../images/…"` to `src="…"`, or (b) inline the SVGs. The hero mascot is already inlined, so the page still looks right even if the image folder is missing.

---

## Customize

- **CTA link:** search `github.com/CMOS-Jumper/Cipher` and swap for your live PWA/Pages URL once deployed.
- **Default demo text:** edit the `value="…"` on the inputs to set fun defaults.
- **Colors/fonts:** all in the `:root` block at the top of `<style>`.
- **The page's hidden secret:** change `_pageSecret` (base64) in the script, or hide a fresh zero-width message in the footer copy using the encoder itself.

---

## Nice upgrades (optional, later)

- **Drag-and-drop image upload** for the LSB demo (let visitors hide a message in *their own* photo, then download it). ~15 lines: a file input → `drawImage` → existing hide/reveal.
- **Real audio spectrogram** via the Web Audio API + an `AnalyserNode`, so the "voice" section uses actual sound instead of the drawn concept.
- **Shareable link**: after encoding, put the stego text in the URL hash so people can send "innocent" links that secretly carry a message.
- **"Scan for secrets" toy**: paste any text and it reports whether hidden zero-width characters are present (a fun privacy-awareness gag).

---

## Quality checklist (already handled)

- ✅ No external JS/CSS dependencies (Google Font with system fallback).
- ✅ Responsive (grids collapse to one column on mobile).
- ✅ Works offline / from `file://`.
- ✅ Demos verified to round-trip (text + image), emoji included.
- ✅ Brand-matched colors, dark theme, glow-on-reveal motif.
- ✅ Privacy-true: everything runs client-side, nothing uploaded.
