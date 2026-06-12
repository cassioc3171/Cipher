const ZERO_0 = '\u200B'; // Zero Width Space
const ZERO_1 = '\u200C'; // Zero Width Non-Joiner

function textToBinary(text: string): string {
  let bin = '';
  for (let i = 0; i < text.length; i++) {
    bin += text.charCodeAt(i).toString(2).padStart(8, '0');
  }
  return bin;
}

function binaryToText(bin: string): string {
  let text = '';
  for (let i = 0; i < bin.length; i += 8) {
    const byte = bin.substring(i, i + 8);
    if (byte.length === 8) {
      text += String.fromCharCode(parseInt(byte, 2));
    }
  }
  return text;
}

export function encodeSteg(payload: string, decoy: string): string {
  const bin = textToBinary(payload);
  let hidden = '';
  for (const bit of bin) {
    hidden += bit === '0' ? ZERO_0 : ZERO_1;
  }
  
  if (!decoy || decoy.length === 0) {
    return hidden;
  }
  
  // Insert hidden text after the first character of the decoy text
  return decoy.charAt(0) + hidden + decoy.slice(1);
}

export function decodeSteg(text: string): string {
  // The payload is written as a single *contiguous* run of zero-width chars
  // (encodeSteg inserts it right after the first visible character). Cover
  // text — Persian especially — legitimately contains ZWNJ (U+200C, our "1"
  // bit) and ZWSP (U+200B, our "0" bit), e.g. "می‌رود". So we must NOT treat
  // every zero-width char in the string as payload: extract only the longest
  // contiguous zero-width run (the hidden payload) and ignore stray
  // zero-width characters that belong to the decoy text.
  let best = '';
  let run = '';
  for (const char of text) {
    if (char === ZERO_0) {
      run += '0';
    } else if (char === ZERO_1) {
      run += '1';
    } else {
      if (run.length > best.length) best = run;
      run = '';
    }
  }
  if (run.length > best.length) best = run;

  let bin = best;
  if (bin.length % 8 !== 0) {
    // Trim to nearest byte
    bin = bin.slice(0, bin.length - (bin.length % 8));
  }

  return binaryToText(bin);
}

export function isSteg(text: string): boolean {
  return text.includes(ZERO_0) || text.includes(ZERO_1);
}
