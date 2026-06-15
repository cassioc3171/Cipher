# "Hidden in Plain Sight" — Creative Concept Pack

*The master creative bible for the Cipher steganography explainer.*
*Everything else in this kit (video, web explainer, images, captions) draws from this file.*

---

## 0. The big idea in one breath

> **There's a secret hiding in this message. You walked right past it.**
> Steganography is the art of hiding a secret *inside something that looks totally normal* — a photo, a text, a song, a file — so nobody even knows a secret exists. Cipher does it for real, on your phone.

**Campaign title:** *Hidden in Plain Sight*
**Mascot / handle:** **Steg** 🦎 (the pixel-chameleon)
**Tagline options:** "Hide in plain sight." · "Now you see nothing." · "Psst. It's already here."

---

## 1. Why a chameleon (and why this one)

A chameleon is the one animal everyone already associates with *blending in so well you don't notice it's there* — which is the exact emotional core of steganography. We make it specific and on-brand:

**Steg** is a **pixel-chameleon**. His skin is made of tiny squares (pixels) that re-color to match *whatever surface he's sitting on* — a photo, a chat bubble, a sound wave. His **tail dissolves into scattered, drifting bits** — a direct visual echo of the Cipher logo (the solid "C" that disperses into pixels).

When Steg sits on a cat photo, he *becomes* the cat photo — but he's still there, carrying a secret. That's LSB steganography as a character.

**Personality:** mischievous, friendly, a little smug — like the friend who knows a secret and is enjoying it. Think a Duolingo-owl level of meme-ability, but cooler and quieter. He rarely shouts; he *whispers* ("psst").

**Mascot design spec (for the image prompts):**
- Rounded, friendly vector chameleon; big curious eyes; one eye can swivel independently (chameleon gag).
- Body = a grid of soft pixel-squares in Cipher cobalt blue; the squares shift hue to match backgrounds.
- Curly tail breaks apart into floating square "bits" that fade out (logo motif).
- Optional accessory: a tiny detective/spy vibe — a magnifying glass, or a small hood. Keep it minimal.
- Always works on a **dark** background with a soft glow.

---

## 2. Visual identity (locked to the Cipher brand)

Pulled straight from the app so the kit and product feel like one thing.

**Colors**
- `#2563EB` **Cipher Cobalt** (primary — the logo blue)
- `#5A0FC8` **Deep Violet** (secondary / PWA accent)
- `#3DDC84` **Signal Green** (the "revealed secret" / success color)
- `#0B1020` **Midnight** (background)
- `#F4F6FF` **Paper** (light text / Ivory-theme nod)

**The core visual rule:** *Ordinary things are calm and muted. The hidden secret GLOWS.* Whenever a secret is revealed, it lights up in Signal Green or a bright glow. "Hidden = dim. Revealed = glow."

**Recurring motifs**
1. **Pixel dispersion** — solid shapes dissolving into scattered squares (the logo). Use for transitions and reveals.
2. **The magnifier / UV reveal** — drag a lens (or shine a light) over something normal and the hidden layer appears.
3. **Before / After toggle** — two identical-looking things side by side; one is secretly carrying a payload.
4. **The whisper** — small "psst" speech bubbles, sound ripples.

**Typography**
- Headlines: a chunky rounded sans (friendly, social-native) — e.g. Poppins / Nunito / Satoshi.
- "Secret/code" bits: a monospace (e.g. JetBrains Mono / Space Mono) — used any time we show raw bits, ciphertext, or invisible characters.

**Aesthetic in three words:** *cyber, but cuddly.* Dark, neon-glow, playful. Cyberpunk lighting + Saturday-morning-cartoon warmth.

---

## 3. The voice (teen / social)

- Short. Punchy. One idea per line. Talk like a person, not a textbook.
- Lead with a hook in the first 2 seconds or they scroll.
- Use "you" constantly. Make it about *them* and *their* feed.
- A little cheeky and conspiratorial ("you weren't supposed to see this").
- No jargon without an instant plain-language swap. "Least significant bit" → "the last tiny digit nobody notices."
- Reward attention: every piece hides a real secret the viewer can find (see §8).

---

## 4. The core metaphor: the lock vs. the disguise

The first thing every viewer must *get*:

- 🔒 **Cryptography = a locked box.** Everyone can see the box. They know there's something inside. They just can't open it. (Looks suspicious.)
- 🦎 **Steganography = a disguise.** There's no box at all. The secret is *dressed up as something boring* — a normal photo, a normal text. Nobody even looks twice. (Looks innocent.)

**The mic-drop line:** *"Cryptography hides what you're saying. Steganography hides THAT you're saying anything."*

**The power combo (= Cipher):** lock it **and** disguise it. Scramble the meaning, then hide the secret itself. Now there's nothing to see *and* nothing to read even if they find it.

---

## 5. The four hiding spots (the heart of the explainer)

Each spot = one metaphor + one teen-voice line + one visual. These map 1:1 to the video beats, the web explainer tabs, and the image set.

### 📝 TEXT — "The invisible ink of the internet"
- **Metaphor:** Between the letters you can see, there's room for letters you *can't*. Text can hold **invisible characters** — real characters that show up as *nothing*. You can hide a whole message in the gaps.
- **Teen line:** *"This text message? It's hiding another one. In the spaces. Right now."*
- **Visual:** a normal "hey what's up 😄" bubble; drag the lens across it and glowing green hidden letters pop up *between* the visible ones.
- **Classic version:** the acrostic — read the first letter of each line. (Use this as the meta-payoff, §8.)
- **Cipher link:** this is literally Cipher's **Steg mode** (zero-width-character hiding).

### 🖼️ IMAGE — "Change the last digit, hide a whole letter"
- **Metaphor:** Every pixel is just numbers for Red, Green, Blue. Nudging the **last digit** (232 → 233) is invisible to your eyes — but those tiny nudges, across millions of pixels, can spell out pages of secret text.
- **Teen line:** *"Two identical photos. One is screaming a secret. Can you tell which? Neither can your phone."*
- **Visual:** two side-by-side cat pics, pixel-for-pixel identical to the eye; zoom way in and the last digits glow, spelling a message.
- **Cipher link:** Cipher's **image/file encryption** (PWA).

### 🎧 VOICE — "A secret whispered under the music"
- **Metaphor:** Sound is made of tiny samples too. Hide your message in the parts too quiet to notice — or hide a whole *picture* in the sound. It sounds like noise… until you look at the soundwave's "x-ray" (the spectrogram) and a face appears.
- **Teen line:** *"Play it: just noise. Look at it: there's a face screaming in the static."*
- **Visual:** a waveform that looks like a normal song; flip to spectrogram view and the word "HELLO" (or Steg's face) is drawn in the frequencies.

### 📁 FILE — "The secret pocket after THE END"
- **Metaphor:** Every file has an official "THE END" marker. The computer stops reading there. So you can staple secret pages *after* it — invisible to the app, fully there. A single file can be a meme *and* secretly a zip full of files.
- **Teen line:** *"This meme is also a folder. Your computer just politely doesn't mention it."*
- **Visual:** a JPG meme; a drawer slides out from behind it revealing stapled-on secret pages / a tiny zip.
- **Cipher link:** Cipher bundles encrypt-then-hide so the "file" you paste is innocent.

---

## 6. The "no way" hooks (scroll-stoppers)

Drop these as standalone shorts or as the spike in the main video:

1. 🖨️🟡 **"Your printer is a snitch."** Color printers secretly stamp every page with near-invisible yellow dots = the printer's serial number + the date. You've been signing everything you print, for decades, without knowing.
2. 🤖 **"This AI image has a tattoo you can't see."** AI images carry invisible watermarks (SynthID) baked into the pixels — survives screenshots and crops.
3. 💬 **"You're already a spy."** Posting a lyric your mom reads as a song and your bestie reads as "we broke up" = *social steganography.* You hide meaning in plain sight every day.
4. 🐛 **"It's not always just a picture."** Hackers have hidden real malware inside ordinary images (stegomalware) — including stolen credit-card numbers tucked inside a store's own product photos.

---

## 7. The three creative directions (pick one; we recommend A)

We explored three. The video + web explainer are built on **A**, which borrows the best bits of B and C.

**▶ A — "Steg the Pixel-Chameleon: Hidden in Plain Sight"** ✅ *recommended*
A friendly mascot guides you through the four hiding spots, capped by the "you already do this" reveal and the Cipher CTA. *Why:* brandable (a mascot = a series, not a one-off), memeable, warm, equally strong in EN + FA, and the pixel-chameleon fuses perfectly with the Cipher logo. Carries an entire content series, not just one video.

**B — "You're Already a Spy"** (social-first, no mascot)
Frames the viewer as someone who *already* hides messages — finstas, inside jokes, coded lyrics — then reveals that's literally steganography. *Why not (as the base):* edgy and very teen, but mascot-less = harder to brand and extend. **We fold its hook in as the emotional climax of A.**

**C — "The Secret Layer"** (aesthetic-first, glitch/reveal)
Pure mood: scroll/drag to peel back a hidden glowing layer on everyday things. Gorgeous, gallery-like. *Why not (as the base):* stunning but cold and un-guided. **We fold its reveal aesthetic into the web explainer's interactions.**

---

## 8. The meta-payoff (do this — it's the whole brand in one move)

Every asset should *practice what it preaches* by hiding a real, findable secret:
- **The video caption** is an acrostic — the first letter of each line spells **`CIPHER`** (or `HIDDEN`).
- The pinned comment: *"there's a hidden message in this post. found it yet? 👀🦎"* → drives replies/shares.
- The **web explainer** lets visitors actually hide and reveal their own message, then says *"want this in your pocket? → Cipher."*

This turns passive viewers into people who *did* steganography — the strongest possible setup for the download.

---

## 9. CTA & distribution

- **Primary CTA:** "Try it yourself — hide a real message in 10 seconds." → web explainer → Cipher (PWA install / APK).
- **Series ideas (so this isn't a one-off):** "Steg explains" shorts — one hook each (printer dots; spectrogram faces; invisible characters; social steganography; stegomalware). Each ≤ 20s.
- **Hashtags (EN):** #steganography #hiddeninplainsight #privacy #cybersecurity #infosec #techtok #Cipher #encryption #digitalprivacy
- **Hashtags (FA):** #استگانوگرافی #حریم_خصوصی #امنیت #رمزنگاری #سایفر #پنهان‌نگاری

---

## 10. Asset map (what this kit produces)

| Asset | File | Purpose |
|---|---|---|
| Research brief | `01_Research-Brief.md` | The verified facts |
| This concept pack | `02_Creative-Concept-Pack.md` | The creative spine |
| IG video script + storyboard | `03_Instagram-Video-Script-EN.md` | Production-ready ~50s vertical |
| AI video prompts | `04_Instagram-Video-AI-Prompts.md` | Shot-by-shot generation prompts |
| Web explainer build guide | `05_Web-Explainer-Build-Guide.md` | Spec + how to ship it |
| Working web explainer | `web-explainer/index.html` | Real interactive prototype |
| Image prompts | `06_Image-Prompts.md` | Ready-to-run for nano-banana / Imagen |
| Generated visuals | `images/` | Real SVG art (mascot + 4 metaphors + card) |
| Persian versions | `07_Persian-Versions.md` | FA script, captions, web copy |
