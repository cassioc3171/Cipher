const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

const PERSIAN_WORDS = [
  "آب", "بابا", "نان", "مادر", "پدر", "برادر", "خواهر", "دوست",
  "خانه", "ماشین", "درخت", "گل", "آسمان", "زمین", "خورشید", "ماه",
  "ستاره", "کوه", "دریا", "رودخانه", "جنگل", "حیوان", "پرنده", "ماهی",
  "سگ", "گربه", "اسب", "کتاب", "قلم", "کاغذ", "مدرسه", "دانشگاه",
  "معلم", "دانشجو", "پزشک", "بیمارستان", "دارو", "غذا", "میوه", "سیب",
  "پرتقال", "موز", "نانوا", "گوشت", "شیر", "پنیر", "چای", "قهوه",
  "آبمیوه", "لباس", "کفش", "کلاه", "ساعت", "عینک", "تلفن", "رایانه",
  "تلویزیون", "رادیو", "موسیقی", "فیلم", "هنر", "ورزش", "فوتبال", "شنا",
  "پایان" // For '=' padding
];

const charToWord = new Map<string, string>();
const wordToChar = new Map<string, string>();

for (let i = 0; i < B64_CHARS.length; i++) {
  charToWord.set(B64_CHARS[i], PERSIAN_WORDS[i]);
  wordToChar.set(PERSIAN_WORDS[i], B64_CHARS[i]);
}

export function encodeToPersian(base64: string): string {
  let result = [];
  for (const char of base64) {
    result.push(charToWord.get(char) || char);
  }
  return result.join(' ');
}

export function decodeFromPersian(text: string): string {
  const words = text.trim().split(/\s+/);
  let result = '';
  for (const word of words) {
    result += wordToChar.get(word) || word;
  }
  return result;
}

export function isPersianCipher(text: string): boolean {
  const words = text.trim().split(/\s+/);
  // Require at least 8 words to reduce false positives from everyday Persian
  if (words.length < 8) return false;
  
  const sample = words.slice(0, 20);
  let matchCount = 0;
  for (const word of sample) {
    if (wordToChar.has(word)) matchCount++;
  }
  
  // Require 90%+ match from our lookup table
  return matchCount / sample.length >= 0.9;
}
