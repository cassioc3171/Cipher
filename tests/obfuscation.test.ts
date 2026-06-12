import { describe, it, expect } from 'vitest';
import { encodeToEmoji, decodeFromEmoji, isEmojiCipher } from '../src/lib/emoji';
import { encodeToPersian, decodeFromPersian, isPersianCipher } from '../src/lib/persian';
import { encodeSteg, decodeSteg, isSteg } from '../src/lib/steg';

// A representative ciphertext envelope (ASCII: base64 alphabet + '|').
const ENVELOPE = 'CT4|T|mskJe/HGSXbFUNyrHzR3IQ==|lXSNK2I5GdUlMg2b|CbxndKWAuqMZkA7Ql99sndVlFAUn294TU7Fu';

describe('emoji obfuscation', () => {
  it('round-trips the ciphertext envelope', () => {
    expect(decodeFromEmoji(encodeToEmoji(ENVELOPE))).toBe(ENVELOPE);
  });
  it('round-trips arbitrary unicode text', () => {
    const t = 'سلام dünya 🌍 +/=';
    expect(decodeFromEmoji(encodeToEmoji(t))).toBe(t);
  });
  it('detects an emoji-ciphered string', () => {
    expect(isEmojiCipher(encodeToEmoji(ENVELOPE))).toBe(true);
    expect(isEmojiCipher('hello world not emoji')).toBe(false);
  });
});

describe('persian obfuscation', () => {
  it('round-trips the ciphertext envelope', () => {
    expect(decodeFromPersian(encodeToPersian(ENVELOPE))).toBe(ENVELOPE);
  });
  it('detects a persian-ciphered string', () => {
    expect(isPersianCipher(encodeToPersian(ENVELOPE))).toBe(true);
  });
});

describe('steg (zero-width) obfuscation', () => {
  it('round-trips with an ASCII decoy', () => {
    const out = encodeSteg(ENVELOPE, 'Just a normal English sentence as a decoy.');
    expect(isSteg(out)).toBe(true);
    expect(decodeSteg(out)).toBe(ENVELOPE);
  });

  it('round-trips with an empty decoy', () => {
    expect(decodeSteg(encodeSteg(ENVELOPE, ''))).toBe(ENVELOPE);
  });

  // BUG REPRO (P1): Persian cover text legitimately contains U+200C (ZWNJ),
  // which is steg's own "1" bit. The original decodeSteg slurped EVERY
  // zero-width char in the string, so the decoy's ZWNJ corrupted the payload.
  it('round-trips with a Persian decoy that contains ZWNJ (می‌رود …)', () => {
    const persianDecoy = 'یادداشت روزانه: ' + 'او به خانه می‌رود و کتاب‌ها را می‌خواند. '.repeat(3);
    const zwnjCount = (persianDecoy.match(/‌/g) || []).length;
    expect(zwnjCount).toBeGreaterThanOrEqual(8); // realistic Persian text
    const out = encodeSteg(ENVELOPE, persianDecoy);
    expect(decodeSteg(out)).toBe(ENVELOPE);
  });
});
