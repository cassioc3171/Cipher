# Steganography — Research Brief

*Deep-research pass for the "Hidden in Plain Sight" explainer kit (Cipher).*
*Compiled June 2026. Every claim below is sourced; see Sources at the end.*

---

## 1. The one-sentence definition

**Steganography = hiding a secret message inside something ordinary, so that nobody even suspects a secret is there.**

The word is Greek: *steganos* ("covered") + *graphein* ("writing") = **"covered writing."**

## 2. The single most important idea (steganography vs. cryptography)

This is the distinction the whole campaign hangs on:

| | What it does | What an outsider sees |
|---|---|---|
| **Cryptography** | Scrambles the **meaning** of a message | "There's clearly a secret here — I just can't read it." |
| **Steganography** | Hides the **existence** of the message | "That's just a normal photo / text / song. Nothing to see." |

The best plain-language analogies found in the research:

- **The gift analogy:** Cryptography is writing a letter in a secret language — people can read it but not understand it. Steganography is hiding the letter *inside a pair of socks you're gifting* — nobody knows there's a message at all.
- **The money analogy:** Cryptography is putting your money in a vault with a giant lock (everyone sees the vault). Steganography is hiding the money under the mattress (nobody looks).
- **Punch line for the video:** *"Cryptography hides the meaning. Steganography hides the secret itself."*
- **The power move = do both:** hide an *encrypted* message inside an *innocent-looking* carrier. (This is exactly what Cipher does — see §7.)

## 3. The history (the "wow, this is ancient" beats)

- **~440 BC — the tattooed scalp.** The Greek Histiaeus shaved a trusted slave's head, tattooed a message onto the scalp, waited for the hair to grow back, then sent him off. The recipient shaved the head to read it. (Recorded by Herodotus.)
- **~480 BC — the wax tablet.** Demaratus warned Greece of a coming Persian attack by scraping the wax off a writing tablet, carving the message into the wood underneath, then re-coating it with wax so it looked blank.
- **1st century AD — invisible ink.** Hidden writing revealed by heat or chemicals. Still the gateway "kid spy" experience (lemon juice; UV pens).
- **WWII — microdots.** Spies shrank whole pages of text down to a dot smaller than the period at the end of this sentence, then glued it into an ordinary letter.
- **Null ciphers / acrostics.** A normal-looking paragraph where you read, say, the first letter of every word/line to get the real message. A classic example decodes to *"Pershing sails from N.Y. June 1."*

> Note for accuracy: the Spartan **scytale** (a rod you wrap a strip around) is a *cipher* (it scrambles order), **not** steganography. Don't put it in the "hiding" bucket.

## 4. How digital steganography actually works (kept simple, per medium)

### TEXT
- **First-letter / acrostic tricks** — the real message is the first letter of each line.
- **Invisible characters (zero-width / whitespace)** — text files can contain characters that render as *nothing*. You can string a whole hidden message out of invisible "zero-width" characters tucked between normal letters. (A real 2021 web attack hid a 300KB payload as nothing but invisible tabs and spaces inside a `license.php` file.) **← this is the exact technique Cipher uses.**

### IMAGE — "LSB" (Least Significant Bit)
- Every pixel is 3 numbers: Red, Green, Blue, each 0–255.
- The **last digit** of each number barely affects the color. Changing **232 → 233** is invisible to the human eye.
- So you overwrite just the last bit of each color value with one bit of your secret. A normal phone photo has millions of pixels → it can hide **pages** of text with no visible change.
- Concrete example: the letter **"A"** is ASCII 65 = `01000001` (8 bits). You only need ~3 pixels (9 colour channels) to stash those 8 bits.

### VOICE / AUDIO
- Same LSB idea, but on **sound samples** instead of pixels — tweak the quietest, least-noticeable part of each sample.
- Showstopper visual: hide an **image inside the sound**. The track sounds like noise, but open its **spectrogram** (a picture of the sound's frequencies) and a face or word appears. (Famously done by the musician Aphex Twin.)

### FILES
- **Append after "THE END."** Every file format has a marker where the program stops reading. You can staple extra secret data *after* it — the app ignores it, but it's right there.
- **Polyglot files** — a single file that is *both* a normal JPG *and* a working ZIP archive. Looks like a meme; is secretly a folder.

## 5. The modern "no way" hooks (best for a teen/social audience)

1. **Your color printer is a snitch.** 🖨️🟡 Most color laser printers secretly print a grid of **tiny near-invisible yellow dots** on *every page* — encoding the printer's **serial number and the date**. Built by Xerox/Canon in the mid-1980s to fight counterfeiting; the public only found out in **2004**. (Called the *Machine Identification Code*.)
2. **AI images carry an invisible signature.** Tools like Google's **SynthID** bake a hidden watermark *into the pixels* of AI-generated images — invisible to you, survives screenshots, cropping, and compression, readable only by a detector.
3. **You already do steganography** (the killer hook). "**Social steganography**": posting a song lyric or inside joke that looks innocent to your parents but carries a totally different meaning to your friends. You're not hiding the words — you're hiding the *meaning*, in plain sight.
4. **Hackers hide malware in cute pictures** ("stegomalware"): real cases include **Duqu** (sibling of Stuxnet, smuggled stolen data out inside ordinary-looking JPEGs), **Operation Shady RAT** (2011), and a **2016 Magento** attack that hid stolen credit-card numbers inside images of the store's own products. Lesson: *"it's just a picture" isn't always true.*

## 6. Why it matters (the balanced takeaway)

Steganography is a **tool**, not a villain. Good: privacy, free speech under censorship, watermarking/anti-counterfeiting, proving where a file came from. Bad: hiding malware, exfiltrating data, scams. The empowering message for viewers: *now you know the hidden layer is there — in your prints, your downloads, your feed.*

## 7. The Cipher tie-in (authentic, not bolted-on)

Cipher is a privacy app that does **both halves** of the secret-message problem:
- **Cryptography:** AES-256-GCM encrypts the message so the meaning is unreadable.
- **Steganography:** its **Steg / Emoji / Persian-disguise** modes then *hide that ciphertext* — e.g. inside **zero-width invisible characters** — so you can paste it into WhatsApp/Telegram and it looks like a normal (or empty!) message. The messenger's servers see nothing.

So Cipher is the living, on-your-phone version of this entire video: **scramble the meaning, then hide the secret itself.** Perfect, honest CTA.

---

## Sources

- [Steganography — Wikipedia](https://en.wikipedia.org/wiki/Steganography)
- [What is steganography and how does it differ from cryptography? — Comparitech](https://www.comparitech.com/blog/information-security/what-is-steganography/)
- [Difference between Steganography and Cryptography — GeeksforGeeks](https://www.geeksforgeeks.org/computer-networks/difference-between-steganography-and-cryptography/)
- [Early Evidence of Steganography — GeeksforGeeks](https://www.geeksforgeeks.org/early-evidence-of-steganography/)
- [Null cipher — Wikipedia](https://en.wikipedia.org/wiki/Null_cipher)
- [LSB steganography in images and audio — Daniel Lerch](https://daniellerch.me/stego/intro/lsb-en/)
- [LSB Steganography: Hiding a message in the pixels of an image — Medium (RenanTKN)](https://medium.com/@renantkn/lsb-steganography-hiding-a-message-in-the-pixels-of-an-image-4722a8567046)
- [Machine Identification Code (printer tracking dots) — Wikipedia](https://en.wikipedia.org/wiki/Machine_Identification_Code)
- [The Yellow Dots on Your Documents — Venatus](https://venatus.me/blog/printer-tracking-dots/)
- [SynthID — Google's invisible AI watermark — DataCamp guide](https://www.datacamp.com/tutorial/synthid)
- [Social Steganography: Learning to Hide in Plain Sight — danah boyd](https://www.zephoria.org/thoughts/archives/2010/08/23/social-steganography-learning-to-hide-in-plain-sight.html)
- [Steganography in contemporary cyberattacks — Securelist (Kaspersky)](https://securelist.com/steganography-in-contemporary-cyberattacks/79276/)
- [Stegomalware — Wikipedia](https://en.wikipedia.org/wiki/Stegomalware)
- [Hidden in Plain Sight (classroom lesson) — TeachEngineering](https://www.teachengineering.org/lessons/view/uno_plainsight_lesson01)
- [Secret Code Hidden in Plain Sight — Kids, Code & Computer Science](https://kidscodecs.com/steganography/)
