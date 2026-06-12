const EMOJI_MAP = [
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
  "🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆",
  "🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋",
  "🐌","🐞","🐜","🦟","🦗","🕷","🦂","🐢","🐍","🦎",
  "🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟",
  "🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧",
  "🐘","🦛","🦏","🐪","🐫"
];

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export function encodeToEmoji(text: string): string {
  // Encode text to base64 safely
  const base64 = btoa(encodeURIComponent(text));
  let emojiStr = "";
  for (let i = 0; i < base64.length; i++) {
    const char = base64[i];
    const index = BASE64_CHARS.indexOf(char);
    if (index !== -1) {
      emojiStr += EMOJI_MAP[index];
    }
  }
  return emojiStr;
}

export function decodeFromEmoji(emojiStr: string): string {
  const chars = Array.from(emojiStr.trim());
  let base64 = "";
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const index = EMOJI_MAP.indexOf(char);
    if (index !== -1) {
      base64 += BASE64_CHARS[index];
    }
  }
  try {
    return decodeURIComponent(atob(base64));
  } catch (e) {
    throw new Error("Invalid emoji cipher");
  }
}

export function isEmojiCipher(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;
  const chars = Array.from(trimmed);
  // Require at least 8 emoji and 90%+ from our map to avoid false positives
  if (chars.length < 8) return false;
  const sample = chars.slice(0, 20);
  const matches = sample.filter(c => EMOJI_MAP.includes(c)).length;
  return matches / sample.length >= 0.9;
}
