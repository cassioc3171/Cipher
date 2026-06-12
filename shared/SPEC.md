# Cipher Wire-Format Spec (CANONICAL — PWA and Android MUST both match)

The single source of truth for cross-platform interop. A message encrypted on
either app must decrypt on the other. Conformance is enforced by
`shared/test-vectors.json` (web: `tests/interop-vectors.test.ts`; android:
`:core` `InteropVectorsTest.kt`).

## Message envelope (text & file)
```
CTn|<type>|<saltB64>|<ivB64>|<cipherB64>      (5 pipe-delimited fields)
```
| prefix | PBKDF2 | compression | status |
|--------|--------|-------------|--------|
| `CT3`  | 600,000 | none | **current** |
| `CT4`  | 600,000 | GZIP | **current** |
| `CT1`  | 100,000 | none | legacy — DECRYPT ONLY, never emit |
| `CT2`  | 100,000 | GZIP | legacy — DECRYPT ONLY, never emit |

- `type` ∈ `{T, A, F, I, M}` (Text, Audio, File, Image, M…)
- **base64: STANDARD alphabet, padded** (`+` `/` `=`) — NOT url-safe.

## Crypto primitives
- **AES-256-GCM**, 128-bit tag appended to ciphertext.
- **PBKDF2-HMAC-SHA256**, iteration count per `CTn` above.
- **salt**: 16 bytes, random per message, carried in field 3.
- **iv/nonce**: 12 bytes, random per message, carried in field 4.
- **compression**: **GZIP** (PWA uses fflate `compressSync`, which emits gzip
  `1f 8b …`). Applied to the UTF-8 plaintext of text messages when enabled →
  `CT4`; the gzipped bytes are then encrypted. Android = `GZIPOutputStream` /
  `GZIPInputStream`. *(Compressed output need not be byte-identical across
  impls — only mutually decompressible.)*

## Obfuscation (wraps the finished envelope STRING)
- **emoji**: `btoa(encodeURIComponent(envelope))` → replace each of the 65
  base64 chars (`A–Z a–z 0–9 + / =`) with the emoji at the same index in
  `EMOJI_MAP` (65 entries). Decode reverses.
- **persian**: map each envelope character → a Persian word (65-word table,
  same base64 index); join with single spaces; chars not in the table (e.g.
  `|`) pass through unchanged.
- **steg**: each payload char → its 8-bit code as zero-width chars
  (`U+200B`=0, `U+200C`=1), spliced in after the first visible character of a
  cover sentence. Decode = the **longest contiguous** zero-width run.

## Reference implementations
- **PWA:** `src/lib/crypto.ts`, `emoji.ts`, `persian.ts`, `steg.ts`
- **Android:** `android/core/src/main/kotlin/io/cipher/core/crypto/*`, `.../obfuscation/*`

## Conformance
Regenerate vectors from the PWA only when the spec intentionally changes:
run the generator, commit `shared/test-vectors.json`, then ensure BOTH
`tests/interop-vectors.test.ts` and the Kotlin `InteropVectorsTest` pass.

---

## Phase-2 parity additions (Android rebuild — all byte-exact, vector-locked)

### Steg-image (`shared/steg-image-vectors.json`)
RGBA pixel-array LSB. 2 LSBs/channel on R,G,B (**alpha untouched**) = 6 bits/px. Bit
stream `[len32 | crc32 | payload]` MSB-first; CRC-32 = zlib/IEEE. Capacity
`floor((w·h·6 − 64)/8)`. PNG container bytes are NOT portable — parity is defined at
the embedded RGBA array; container cross-decode via the live loop.
Impl: web `src/lib/stegImage.ts`, Kotlin `:core obfuscation/StegImage.kt`.

### Steg-audio (`shared/steg-audio-vectors.json`)
1 LSB/sample on channel 0 of 16-bit PCM; same `[len32|crc32|payload]` MSB-first.
Capacity `floor((n − 64)/8)`. WAV = 44-byte header + interleaved LE int16 (byte-exact);
decode reads the WAV's NATIVE sample rate (no resample). Float↔int16 via a single
32768 divisor. Impl: web `stegAudio.ts` (`pcmToWav`), Kotlin `StegAudio.kt`+`WavIo.kt`.

### Noise WAV + Snow PNG (`shared/raw-encode-vectors.json`)
Noise: ciphertext bytes as a mono 8000 Hz 16-bit PCM WAV; data = `[4B LE len][payload][pad-even]`. **Byte-exact.**
Snow: ciphertext bytes packed `[4B BE len][payload]` across RGB channels (alpha=255),
side `ceil(sqrt(pixelCount))`. Pixel-array exact. Decode validates `startsWith(CTn|)`.
Impl: web `rawEncode.ts`, Kotlin `RawEncode.kt`.

### Paired / ECDH (`shared/ecc-vectors.json`)
P-256 (secp256r1). mnemonic (12 words) → `SHA256(phrase)` →
`HKDF-SHA256(salt="Cipher-Mnemonic", info="ECDH-P256", 256b)` → scalar `= (BE mod (n−1)) + 1`
→ `d·G` UNCOMPRESSED (0x04‖x32‖y32) → standard base64 pubkey. Shared secret =
`HKDF-SHA256(ECDH_X(32B), salt=SHA256(sort(pubA,pubB))[:16], info="Cipher-ECC-Session", 256b)` → base64.
fingerprint = `b64[0:10] + "..." + b64[-10:]`. A paired message is a normal CTn envelope
encrypted with the derived secret. Impl: web `ecc.ts` (@noble), Kotlin `:core crypto/Ecc.kt`+`Hkdf.kt` (Bouncy Castle).

### Master vault (`shared/master-key-vectors.json`)
KEK = `PBKDF2-HMAC-SHA256, 600k` over a 32-byte salt → AES-256 key. Wrap =
`mk1:<ivB64>:<cipherB64>` (12-byte IV, AES-256-GCM; legacy `<ivB64>|<cipherB64>` also parsed).
Verify hash = `PBKDF2-HMAC-SHA256, 100k` over a SEPARATE salt → base64 (compared constant-time).
Impl: web `masterKey.ts`, Kotlin `:core security/MasterVault.kt`.

### File envelope (`shared/file-envelope-vectors.json`)
A file = a normal CTn envelope with **type `F`** and plaintext `"<fileName>::<dataURL>"`
(the dataURL carries mime+bytes); the `.ctx` download is that envelope text. Files are
**not** gzipped → always `CT3|F|…` (web `encryptData` compresses only type `T`). Legacy
Android `CT4F|` is decode-only for old local messages.
