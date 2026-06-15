# Image Prompts — ready to run (Nano Banana Pro / Imagen)

Every prompt below is engineered with the 6-part structure (Subject · Action · Context · Composition · Lighting · Style) and shares one **Style DNA** so the whole set looks like one world. Built for **Nano Banana Pro (Gemini 3 Pro Image)** and **Imagen** — same prompts work in both, and in the Gemini app / Nano Banana app if you'd rather click than type.

> **Heads-up on running these here:** the generators need a `GEMINI_API_KEY`. This sandbox doesn't have one, so I've generated **real SVG versions of the key art** in `/images` (no API key needed) for you to use immediately. To get photoreal/raster renders, run the commands below on your machine after `export GEMINI_API_KEY=...` (get a key at aistudio.google.com → API keys).

### How to run
```bash
# Nano Banana Pro (recommended for hero art; supports 1K/2K/4K)
uv run ~/.claude/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "PASTE PROMPT HERE" --filename "2026-06-09-steg-hero.png" --resolution 4K

# Imagen
python ~/.claude/skills/imagen/scripts/generate_image.py "PASTE PROMPT HERE" "./images/steg-hero.png" --size 2K
```

---

## ⭐ STYLE DNA — paste at the end of every prompt
> *"Style: playful 'cyber-but-cuddly' 3D cartoon, smooth matte surfaces, rounded friendly shapes; dark midnight-navy background (#0B1020); neon glow lighting in cobalt blue (#2563EB) and violet (#5A0FC8); any hidden/secret element glows signal-green (#3DDC84); subtle floating square 'pixel' particles drifting in the background; soft cinematic rim light, gentle film grain, high detail, clean negative space for text. No text unless requested, no watermark, no clutter."*

**Negative prompt (every image):** `garbled text, misspelled letters, extra limbs, distorted anatomy, ugly, low-res, jpeg artifacts, busy background, harsh shadows, photoreal horror, creepy`

**Aspect ratios:** mascot/hero = 1:1 and 9:16 · metaphor cards = 4:5 · web hero = 16:9 · story/reel frames = 9:16.

---

## A — Mascot: "Steg" the pixel-chameleon

**1. Steg — hero portrait** *(1:1 and 9:16, 4K)*
> A friendly rounded cartoon chameleon named Steg, sitting upright and waving two fingers with a smug little grin; his skin is a soft grid of small rounded pixel-squares in cobalt blue that subtly shift hue; his curly tail breaks apart at the tip into floating square pixel-bits that drift away and fade; big curious eyes, one eye swiveling toward the viewer; centered with breathing room around him; soft cobalt rim light from behind. [STYLE DNA]

**2. Steg — expression & pose sheet** *(16:9, 2K)*
> Character turnaround sheet of the same cobalt pixel-chameleon, five poses in a neat row on a dark background: (1) friendly wave, (2) winking with a finger over his lips going "shh", (3) holding a glowing magnifier, (4) peeking out from behind the edge of a photo, (5) giving a thumbs up while holding a small glowing padlock; consistent design, model-sheet lighting. [STYLE DNA]

**3. Steg — camouflaged on a photo (the LSB idea)** *(4:5, 2K)*
> The cobalt pixel-chameleon sitting on top of an ordinary phone photo of a cat; the left half of his body has perfectly camouflaged into the cat photo (his pixels match the image) so he's nearly invisible, while the right half is still visible cobalt blue; a glowing green seam runs where the two halves meet; concept of hiding in plain sight. [STYLE DNA]

---

## B — Core concept

**4. Cryptography vs Steganography (split)** *(4:5, 4K)*
> A symmetrical split-screen illustration. LEFT side: a glowing ornate golden padlocked treasure box on a pedestal under a bright spotlight, surrounded by a crowd of small cartoon eyeball icons all staring at it (everyone sees the secret). RIGHT side: a plain grey rock that everyone ignores, with the cobalt pixel-chameleon almost fully camouflaged on it; calm, dim lighting on the right. A thin glowing divider down the middle. Clear visual contrast: loud-and-locked vs quiet-and-hidden. [STYLE DNA]

---

## C — The four hiding spots (matched card set, 4:5)

**5. TEXT — invisible letters in the gaps** *(4:5, 2K)*
> A single glassy chat-message bubble floating in dark space showing "hey what's up :)"; a glowing magnifier hovers over it and reveals faint glowing green secret letters tucked in the gaps BETWEEN the visible letters; a small cobalt pixel-chameleon peeks over the top edge of the bubble. Clean, lots of negative space. [STYLE DNA]

**6. IMAGE — change the last digit** *(4:5, 2K)*
> Two identical cute cat photos side by side; from one of them a magnified call-out bubble zooms into the pixels, shown as a tidy grid of glowing RGB number tiles, with the last digit of each number highlighted in green flipping from 232 to 233; concept that a tiny invisible change hides a message. [STYLE DNA]

**7. VOICE — a face hidden in the sound** *(4:5, 2K)*
> A glowing horizontal audio waveform that morphs upward into a colorful spectrogram; inside the spectrogram's frequency bands, a simple smiling face is clearly drawn in glowing green, as if hidden in the noise; the cobalt pixel-chameleon wears tiny headphones nearby. [STYLE DNA]

**8. FILE — the secret pocket after THE END** *(4:5, 2K)*
> A flat cartoon meme image card with a small drawer sliding out from behind its bottom edge, revealing glowing secret paper pages and a little green zip-folder icon tucked inside; a "THE END" tag on the visible file and the secret pages clearly sitting after it; playful depth and parallax. [STYLE DNA]

---

## D — The "no way" hooks (9:16 for Reels/Stories)

**9. Your printer is a snitch** *(9:16, 2K)*
> A white sheet of paper sliding out of a home printer; a purple UV light sweeps across it revealing a grid of tiny glowing yellow dots arranged in a secret pattern; a magnifier highlights the dots; mood of a surprising secret being exposed; the cobalt pixel-chameleon raises an eyebrow. [STYLE DNA]

**10. The invisible AI watermark** *(9:16, 2K)*
> A framed AI-generated style portrait with a faint glowing green fingerprint/QR-like watermark pattern shimmering invisibly across its pixels, only revealed by a small detector lens; concept of an invisible tattoo baked into an image. [STYLE DNA]

**11. You already do this (social steganography)** *(9:16, 2K)*
> Close, warm shot of a hand holding a phone that has just posted a song-lyric story; two soft thought-bubbles rise above the phone — the left one (labeled subtly as 'mom') shows a music note and a calm smile; the right one (labeled 'bestie') shows a broken heart and a worried face; same post, two meanings; the cobalt pixel-chameleon winks in the corner. [STYLE DNA]

---

## E — Social & marketing

**12. Title card / thumbnail — "Hidden in Plain Sight"** *(1:1 and 9:16, 4K)*
> A bold social title card: the cobalt pixel-chameleon front and center holding a glowing magnifier; large clean empty banner area at top reserved for the headline text "HIDDEN IN PLAIN SIGHT" (leave the space, do not render text); floating pixel particles; eye-catching, high-contrast, thumb-stopping. [STYLE DNA]

**13. End card / CTA — Cipher** *(1:1 and 9:16, 4K)*
> A clean closing brand frame: the Cipher logo (a solid letter 'C' whose right edge disperses into scattered pixel squares) glowing softly in cobalt; below it, the pixel-chameleon snapping a small padlock shut over a chat bubble that then turns ordinary and empty; generous space reserved for a tagline (no text rendered); premium, minimal. [STYLE DNA]

**14. Web explainer hero banner** *(16:9, 4K)*
> A wide atmospheric hero scene: an everyday phone, photo, sound wave, and file floating in dark space, each with a faint green secret glowing inside, connected by drifting pixel particles; the cobalt pixel-chameleon perched confidently in the lower third; cinematic depth, lots of clean dark space on the left for headline text. [STYLE DNA]

---

## Consistency tips
- Generate the **mascot (1)** first, then use **image-editing / reference mode** with that file as `--input-image` for poses (2,3) so Steg stays on-model across the set.
- Keep the **Style DNA + negative prompt identical** on every run — that's what makes the set cohere.
- For anything with a headline, render the art with empty space and add text in Canva/Figma (cleaner than AI text).
- Resolution: hero/title/end = 4K; metaphor cards & hooks = 2K is plenty.
