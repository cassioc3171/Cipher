import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Camera,
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Dices,
  Download,
  Eye,
  EyeOff,
  Expand,
  Link2,
  Lock,
  LockOpen,
  Menu,
  Mic,
  Minimize2,
  PanelLeftClose,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  Share2,
  Shield,
  Shuffle,
  Star,
  Trash2,
  UserRound,
  X,
  FileText,
  Image,
  Film,
  Music,
  Heart,
  HelpCircle,
  Info,
  Clock,
  Hourglass,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Upload,
  MoreVertical,
  Pin,
  Eraser,
  Castle,
  SquareDashed,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { GuidePanel, useFirstRunGuide } from './components/GuidePanel';
import { TutorialOverlay } from './tutorial/TutorialOverlay';
import { TutorialNudge } from './tutorial/TutorialNudge';
import { decryptData, encryptData, estimateEnvelopeSize, isCipherEnvelope, type CompressionLevel, type DataType } from './lib/crypto';
import { decodeFromEmoji, encodeToEmoji, isEmojiCipher } from './lib/emoji';
import { decodeFromPersian, encodeToPersian, isPersianCipher } from './lib/persian';
import { decodeSteg, encodeSteg, isSteg } from './lib/steg';
import {
  getCoverTexts,
  type CoverTextCategory,
} from './lib/coverTexts';
import { IRAN_CASTLES, isPersian, pickCastleIndex } from './lib/castles';
import {
  getWorldCoverTexts,
  getRandomWorldCoverText,
  WORLD_COVER_CATEGORIES,
  WORLD_COVER_CATEGORY_META,
  type WorldCoverCategory,
} from './lib/coverTextsWorld';
import {
  saveEccSecret,
  getEccSecret,
  deleteEccSecret,
  saveChatSecret,
  getChatSecret,
  deleteChatSecret,
  rewrapAllSecrets,
  saveLargeData,
  getLargeData,
  deleteLargeDataBatch,
  nukeEverything,
  saveMessage,
  getMessages,
  countMessages,
  deleteMessagesForChat,
  migrateEccSecretsToKEK,
  saveAppUnlockSession,
  getAppUnlockSession,
  clearAppUnlockSession,
  type IDBMessage,
} from './lib/db';
import {
  deriveKEK,
  isWrappedSecret,
  wrapSecret,
  unwrapSecret,
  hashMasterPassword,
  generateSalt,
} from './lib/masterKey';
import {
  deriveKeyPairFromMnemonic,
  deriveSharedSessionSecret,
  exportPublicKeyB64,
  fingerprintPublicKey,
  generateEccKeyPair,
  generateMnemonic,
} from './lib/ecc';
import {
  applyCompression,
  detectMediaKind,
  estimateEncryptedSize,
  fmt,
  fmtDuration,
  getVoiceRecorderOptions,
  smartAnalyze,
  type CompressOption,
  type FileAnalysis,
  type MediaKind,
} from './lib/compress';
import {
  applyTheme,
  loadThemeId,
  saveThemeId,
  watchSystemTheme,
  THEMES,
  type ThemeId,
} from './lib/themes';
import { generateQrPng, QR_MAX_BYTES } from './lib/qrCode';
import { encryptedToWav, wavToEncrypted, encryptedToPngBlob, pngToEncrypted } from './lib/rawEncode';
import { consumePendingShare } from './lib/shareTarget';
import jsQR from 'jsqr';
import {
  loadImageData,
  encodeIntoImage,
  decodeFromImage,
  imageDataToPng,
  imageCapacity,
} from './lib/stegImage';
import {
  decodeAudioFile,
  encodeIntoAudio,
  decodeFromAudio,
  audioBufferToWav,
  audioCapacity,
} from './lib/stegAudio';

/* ===== Types ===== */
type ObfuscationMode = 'none' | 'emoji' | 'persian' | 'steg' | 'qr' | 'noise' | 'snow';
type SecurityMode = 'password' | 'ecc';
type CompressionMode = 'off' | CompressionLevel;

type ChatMessage = {
  id: string;
  inputPreview: string;
  outputPreview: string;
  outputFull: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  shareFile?: File;
  thumbUrl?: string;
  type: 'encrypt' | 'decrypt';
  dataType: string;
  timestamp: number;
};

type ChatSession = {
  id: string;
  name: string;
  securityMode: SecurityMode;
  selectedVaultId: string;
  obfuscationMode: ObfuscationMode;
  compressionMode: CompressionMode;
  friendPublicKeyB64: string;
  myPublicKeyB64: string;
  eccSessionName: string;
  messages: ChatMessage[];
  lockedPassword?: boolean;
  messageCount?: number;
  castleId?: number;
  ephemeral?: boolean;
  createdAt: number;
  lastUsedAt: number;
};

const CHATS_KEY = 'cipher_v2_chats';
const LARGE_MSG_THRESHOLD = 50_000;
/** Skip auto-copy to clipboard for outputs larger than this (bytes of UTF-16) */
const AUTO_COPY_LIMIT = 50_000;
const MP_SALT_KEY = 'cipher_v2_mp_salt';
const MP_VERIFY_SALT_KEY = 'cipher_v2_mp_verify_salt';
const MP_HASH_KEY = 'cipher_v2_mp_hash';
const MIGRATED_KEY = 'cipher_v2_migrated_v3';
const AUTO_LOCK_KEY = 'cipher_v2_autolock';
const AUTO_LOCK_ACTIVITY_KEY = 'cipher_v2_autolock_activity';
const LAST_ACTIVE_CHAT_KEY = 'cipher_v2_last_active_chat';
const PAGE_SIZE = 20;
const SEND_HOLD_DELAY_MS = 420;

/* ===== Helpers ===== */
function readTextFile(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const shareExtMimeMap: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  wav: 'audio/wav',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  ogg: 'audio/ogg',
  txt: 'text/plain',
  ctx: 'application/octet-stream',
};

const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  'ctx', 'txt', 'md', 'log', 'csv', 'json', 'xml', 'svg',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
]);
const ATTACHMENT_CIPHERTEXT_PROBE_BYTES = 4096;

function getNamedFileType(fileName: string, fallbackType?: string): string {
  const normalizedFallback = fallbackType?.trim().toLowerCase();
  if (normalizedFallback && normalizedFallback !== 'application/octet-stream' && normalizedFallback !== 'binary/octet-stream') {
    return normalizedFallback;
  }

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return shareExtMimeMap[ext] || normalizedFallback || 'application/octet-stream';
}

function fileNameFromMime(mime: string): string {
  const ext = mime.includes('png') ? 'png'
    : mime.includes('jpeg') ? 'jpg'
      : mime.includes('gif') ? 'gif'
        : mime.includes('webp') ? 'webp'
          : mime.includes('bmp') ? 'bmp'
            : mime.includes('wav') ? 'wav'
              : mime.includes('webm') ? 'webm'
              : mime.includes('mpeg') ? 'mp3'
                : mime.includes('mp4') ? 'mp4'
                  : mime.includes('ogg') ? 'ogg'
                    : mime.includes('plain') ? 'txt'
                      : 'bin';
  return `clipboard-${Date.now()}.${ext}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header = '', data = ''] = dataUrl.split(',', 2);
  const mime = header.startsWith('data:')
    ? header.slice(5).replace(/;base64$/i, '') || 'application/octet-stream'
    : 'application/octet-stream';

  if (/;base64/i.test(header)) {
    const decoded = atob(data);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  return new Blob([decodeURIComponent(data)], { type: mime });
}

function getDataUrlMime(dataUrl?: string): string {
  return dataUrl?.match(/^data:([^;]+)/)?.[1]?.toLowerCase() || '';
}

function getBrokenEncryptedFileMessage(fileName?: string): string {
  return fileName
    ? `Encrypted file could not be restored: ${fileName}`
    : 'Encrypted file could not be restored.';
}

function buildNamedFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: getNamedFileType(fileName, blob.type) });
}

function normalizeClipboardFile(file: File): File {
  const trimmedName = file.name.trim();
  if (trimmedName) return file;
  return new File([file], fileNameFromMime(file.type || 'application/octet-stream'), {
    type: file.type || 'application/octet-stream',
    lastModified: file.lastModified || Date.now(),
  });
}

function getAudioShareFileName(dataUrl: string): string {
  const mime = dataUrl.match(/^data:([^;]+)/)?.[1] || '';
  const ext = mime.includes('wav') ? 'wav'
    : mime.includes('mpeg') ? 'mp3'
      : mime.includes('mp4') ? 'mp4'
        : mime.includes('ogg') ? 'ogg'
          : 'webm';
  return `cipher-audio-${Date.now()}.${ext}`;
}

function getEncryptedAttachmentShareFileName(msg: ChatMessage): string {
  const stamp = new Date(msg.timestamp).toISOString().replace(/[:.]/g, '-');
  return msg.dataType === 'A'
    ? `cipher-audio-${stamp}.ctx`
    : `cipher-message-${stamp}.ctx`;
}

function formatFileTimestamp(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function getQrShareFileName(timestamp = Date.now()): string {
  return `cipher-qr-${formatFileTimestamp(timestamp)}.png`;
}

function isQrShareFileName(fileName?: string): boolean {
  return !!fileName && /^cipher-qr.*\.png$/i.test(fileName);
}

function isPreviewableFileName(fileName?: string): boolean {
  return !!fileName && /\.(png|jpe?g|gif|webp|svg|bmp|mp4|webm|mov|avi|mkv|mp3|wav|ogg|aac|flac|m4a|wma|opus)$/i.test(fileName);
}

function parseDecryptedFilePayload(payload: string): { fileName: string; fileUrl: string } | null {
  const splitAt = payload.indexOf('::');
  if (splitAt <= 0) return null;

  const fileName = payload.slice(0, splitAt);
  const fileUrl = payload.slice(splitAt + 2);
  if (!fileName || !fileUrl.startsWith('data:')) return null;

  return { fileName, fileUrl };
}

function createMessageFileUrl(shareFile: File | undefined, type: ChatMessage['type'], fileName?: string): string | undefined {
  if (!shareFile) return undefined;
  if (type === 'encrypt' && !isPreviewableFileName(fileName)) return undefined;
  return URL.createObjectURL(shareFile);
}

function buildMessageFileFromMessage(msg: ChatMessage): File | null {
  try {
    if (msg.shareFile) return msg.shareFile;

    if (msg.type === 'decrypt' && msg.dataType === 'F') {
      const parsed = parseDecryptedFilePayload(msg.outputFull);
      if (parsed) {
        return buildNamedFile(dataUrlToBlob(parsed.fileUrl), parsed.fileName || msg.fileName || 'cipher-file.bin');
      }
    }

    if (msg.type === 'decrypt' && msg.dataType === 'A') {
      const dataUrl = msg.audioUrl || msg.outputFull;
      if (dataUrl.startsWith('data:')) {
        return buildNamedFile(dataUrlToBlob(dataUrl), getAudioShareFileName(dataUrl));
      }
    }

    if (msg.type === 'encrypt' && msg.dataType === 'F' && msg.outputFull.includes('::')) {
      const splitAt = msg.outputFull.indexOf('::');
      const fileName = msg.outputFull.slice(0, splitAt) || msg.fileName || `cipher-${Date.now()}.ctx`;
      const filePayload = msg.outputFull.slice(splitAt + 2);
      if (filePayload.startsWith('data:')) {
        return buildNamedFile(dataUrlToBlob(filePayload), fileName);
      }

      if (/\.ctx$/i.test(fileName)) {
        return buildNamedFile(new Blob([filePayload], { type: 'application/octet-stream' }), fileName);
      }

      return null;
    }

    if (msg.type === 'encrypt' && msg.dataType === 'A' && msg.outputFull) {
      return buildNamedFile(
        new Blob([msg.outputFull], { type: 'application/octet-stream' }),
        getEncryptedAttachmentShareFileName(msg),
      );
    }

    if (!msg.fileUrl && !msg.audioUrl && msg.outputFull && msg.outputFull.length > 4000) {
      return buildNamedFile(
        new Blob([msg.outputFull], { type: 'text/plain' }),
        `cipher-${new Date(msg.timestamp).toISOString().slice(0, 10)}.txt`,
      );
    }

    return null;
  } catch {
    return null;
  }
}

function buildShareFileFromMessage(msg: ChatMessage): File | null {
  return msg.shareFile || buildMessageFileFromMessage(msg);
}

async function resolveShareFileFromMessage(msg: ChatMessage): Promise<File | null> {
  const shareFile = buildShareFileFromMessage(msg);
  if (shareFile) return shareFile;

  const sourceUrl = msg.fileUrl || msg.audioUrl;
  const fileName = msg.fileName || (msg.audioUrl ? getAudioShareFileName(msg.audioUrl) : undefined);
  if (!sourceUrl || !fileName) return null;

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) return null;
    return buildNamedFile(await response.blob(), fileName);
  } catch {
    return null;
  }
}

function withShareFile(msg: ChatMessage, shareFile?: File): ChatMessage {
  if (shareFile) {
    const next = { ...msg, shareFile };
    if (msg.dataType === 'F') {
      const objectUrl = createMessageFileUrl(shareFile, msg.type, msg.fileName);
      if (objectUrl) next.fileUrl = objectUrl;
    }
    return next;
  }
  if (msg.shareFile) return msg;
  const derived = buildMessageFileFromMessage(msg);
  return derived ? withShareFile(msg, derived) : msg;
}

function normalizeIncoming(raw: string): string {
  let value = raw.trim();
  if (!value) return value;

  if (isSteg(value)) {
    try {
      const maybe = decodeSteg(value);
      if (isCipherEnvelope(maybe)) return maybe;
    } catch { /* continue */ }
  }
  if (isPersianCipher(value)) {
    try {
      const maybe = decodeFromPersian(value);
      if (isCipherEnvelope(maybe)) return maybe;
    } catch { /* continue */ }
  }
  if (isEmojiCipher(value)) {
    try {
      const maybe = decodeFromEmoji(value);
      if (isCipherEnvelope(maybe)) return maybe;
    } catch { /* keep */ }
  }
  return value;
}

function buildReadAsTextError(fileName: string, readError: unknown): Error {
  const detail = readError instanceof Error && readError.message ? ` ${readError.message}` : '';
  return new Error(`Could not read \"${fileName}\" as text.${detail}`);
}

function isLikelyTextAttachment(file: File): boolean {
  const fileType = (file.type || '').toLowerCase();
  if (fileType.startsWith('text/')) return true;
  if (/(json|xml|javascript|ecmascript|svg|yaml|toml)/.test(fileType)) return true;

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return TEXT_ATTACHMENT_EXTENSIONS.has(ext);
}

async function tryReadCiphertextAttachment(file: File): Promise<string | null> {
  const readNormalized = async (blob: Blob) => normalizeIncoming(await readTextFile(blob));

  if (isLikelyTextAttachment(file)) {
    try {
      const text = await readNormalized(file);
      return isCipherEnvelope(text) ? text : null;
    } catch (readError) {
      throw buildReadAsTextError(file.name, readError);
    }
  }

  try {
    const probe = await readNormalized(file.slice(0, ATTACHMENT_CIPHERTEXT_PROBE_BYTES));
    if (!isCipherEnvelope(probe)) return null;
  } catch {
    return null;
  }

  try {
    const text = await readNormalized(file);
    return isCipherEnvelope(text) ? text : null;
  } catch (readError) {
    throw buildReadAsTextError(file.name, readError);
  }
}

function isKnownCipherMediaFileName(fileName: string): boolean {
  return isQrShareFileName(fileName)
    || /^cipher-\d+\.png$/i.test(fileName)
    || /^cipher-\d+\.wav$/i.test(fileName)
    || /^steg-.*\.(png|wav)$/i.test(fileName);
}

async function extractCipherPayloadFromMedia(file: File): Promise<string> {
  const fileType = file.type || '';
  const fileName = file.name.toLowerCase();

  if (fileType.startsWith('image/') || /\.(png|bmp|jpe?g|webp)$/.test(fileName)) {
    try {
      const { imageData } = await loadImageData(file);
      const qrResult = jsQR(imageData.data, imageData.width, imageData.height);
      if (qrResult?.data) {
        const normalized = normalizeIncoming(qrResult.data);
        if (isCipherEnvelope(normalized)) return normalized;
      }

      const payload = decodeFromImage(imageData);
      if (payload) {
        const normalized = normalizeIncoming(new TextDecoder().decode(payload));
        if (isCipherEnvelope(normalized)) return normalized;
      }

      const snowResult = pngToEncrypted(imageData);
      if (snowResult) return snowResult;
    } catch {
      return '';
    }
  }

  if (fileType.startsWith('audio/') || fileName.endsWith('.wav')) {
    try {
      const audioBuffer = await decodeAudioFile(file);
      const samples = audioBuffer.getChannelData(0);
      const payload = decodeFromAudio(samples);
      if (payload) {
        const normalized = normalizeIncoming(new TextDecoder().decode(payload));
        if (isCipherEnvelope(normalized)) return normalized;
      }
    } catch {
      // Fall through to raw noise decode.
    }

    try {
      const rawBuffer = await file.arrayBuffer();
      const noiseResult = wavToEncrypted(rawBuffer);
      if (noiseResult) return noiseResult;
    } catch {
      return '';
    }
  }

  return '';
}

function applyObfuscation(value: string, mode: ObfuscationMode, decoy: string): string {
  if (mode === 'emoji') return encodeToEmoji(value);
  if (mode === 'persian') return encodeToPersian(value);
  if (mode === 'steg') return encodeSteg(value, decoy);
  // 'qr', 'noise', 'snow', and 'none' pass through as-is (rendered separately)
  return value;
}

function chatLabel(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 32 ? clean.slice(0, 32) + '…' : clean || 'New Chat';
}

type SpectrumPalette = {
  base: {
    daily: string;
    proverb: string;
    humor: string;
    kotlet: string;
  };
  world: string[];
  iran: string[];
};

type SpectrumSegment = {
  id: string;
  label: string;
  category: string;
  color: string;
  texts: string[];
};

const IRANIAN_POET_SLICES: Array<{ id: string; label: string; labelEn: string; count: number }> = [
  { id: 'hafez', label: 'حافظ', labelEn: 'Hafez Shirazi', count: 1000 },
  { id: 'saadi', label: 'سعدی', labelEn: 'Saadi Shirazi', count: 1000 },
  { id: 'ferdowsi', label: 'فردوسی', labelEn: 'Ferdowsi Tusi', count: 1000 },
  { id: 'moulavi', label: 'مولوی', labelEn: 'Jalal ad-Din Rumi', count: 500 },
  { id: 'khayyam', label: 'خیام', labelEn: 'Omar Khayyam', count: 300 },
  { id: 'attar', label: 'عطار', labelEn: 'Farid ud-Din Attar', count: 300 },
  { id: 'farrokhi-yazdi', label: 'فرخی یزدی', labelEn: 'Farrokhi Yazdi', count: 100 },
  { id: 'aref-ghazvini', label: 'عارف قزوینی', labelEn: 'Aref Qazvini', count: 100 },
  { id: 'iraj-mirza', label: 'ایرج میرزا', labelEn: 'Iraj Mirza', count: 100 },
  { id: 'anvari', label: 'انوری', labelEn: 'Anvari Abivardi', count: 100 },
  { id: 'others', label: 'سایر شاعران', labelEn: 'Classical Persian Poets', count: 500 },
  { id: 'forough', label: 'فروغ فرخزاد', labelEn: 'Forough Farrokhzad', count: 250 },
  { id: 'sohrab', label: 'سهراب سپهری', labelEn: 'Sohrab Sepehri', count: 250 },
];

const DEFAULT_DISABLED_WORLD_POETRY_CATEGORIES: WorldCoverCategory[] = ['arabic', 'french', 'german', 'spanish', 'italian'];
const DEFAULT_ROTATING_WORLD_POETRY_CATEGORIES = WORLD_COVER_CATEGORIES.filter(
  (cat) => !DEFAULT_DISABLED_WORLD_POETRY_CATEGORIES.includes(cat),
);
const DEFAULT_ENABLED_CATEGORY_IDS = new Set<string>([
  'neutral',
  'proverbs',
  'pro_government',
  'kotlet_recipe',
  ...WORLD_COVER_CATEGORIES
    .filter((cat) => !DEFAULT_DISABLED_WORLD_POETRY_CATEGORIES.includes(cat))
    .map((cat) => `world:${cat}`),
  ...IRANIAN_POET_SLICES.map((poet) => `poetry:${poet.id}`),
]);

const EDITORIAL_PALETTE: SpectrumPalette = {
  base: {
    daily: '#4f9d69',
    proverb: '#b48a24',
    humor: '#bf5a36',
    kotlet: '#a3322f',
  },
  world: ['#2155a6', '#1f7a8c', '#3d6ea8', '#4d7a5b', '#8d6b1f', '#5a4a82', '#8a5e3b'],
  iran: ['#44305f', '#4d3569', '#563a73', '#5f407d', '#684687', '#724d92', '#7d569d', '#8960a8', '#956ab2', '#a174bc', '#ae80c6', '#bb8cd0', '#c89ada'],
};

/* === Password Strength === */
function getPasswordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 4) score++;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 10) score++;
  const map: Record<number, { label: string; color: string }> = {
    0: { label: 'Too short', color: 'var(--error)' },
    1: { label: 'Weak', color: 'var(--error)' },
    2: { label: 'Fair', color: '#e09800' },
    3: { label: 'Good', color: '#3d8b37' },
    4: { label: 'Strong', color: 'var(--blue)' },
  };
  return { score: score as 0 | 1 | 2 | 3 | 4, ...map[score] };
}

function PasswordStrengthBar({ password }: { password: string }) {
  const s = getPasswordStrength(password);
  if (!password) return null;
  return (
    <div className="pw-strength">
      <div className="pw-strength-track">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="pw-strength-seg" style={{ background: i <= s.score ? s.color : 'var(--outline-variant)' }} />
        ))}
      </div>
      <span className="pw-strength-label" style={{ color: s.color }}>{s.label}</span>
    </div>
  );
}

/* ===== Component ===== */
export default function App() {
  /* --- i18n --- */
  const { t } = useTranslation();

  /* --- Lock Screen / Master Password --- */
  const [kek, setKek] = useState<CryptoKey | null>(null);
  const [appUnlocked, setAppUnlocked] = useState(() => !localStorage.getItem(MP_SALT_KEY));
  const [masterPasswordExists, setMasterPasswordExists] = useState(() => !!localStorage.getItem(MP_SALT_KEY));
  const [unlockRestorePending, setUnlockRestorePending] = useState(() => !!localStorage.getItem(MP_SALT_KEY));
  const [lockPassword, setLockPassword] = useState('');
  const [lockConfirm, setLockConfirm] = useState('');
  const [lockError, setLockError] = useState('');
  const [lockBusy, setLockBusy] = useState(false);
  const [showLockWarning, setShowLockWarning] = useState(false);
  const [showLockSetup, setShowLockSetup] = useState(false);

  /* --- Change / Remove Master Password --- */
  const [showChangeMp, setShowChangeMp] = useState(false);
  const [showRemoveMp, setShowRemoveMp] = useState(false);
  const [mpOldPw, setMpOldPw] = useState('');
  const [mpNewPw, setMpNewPw] = useState('');
  const [mpNewConfirm, setMpNewConfirm] = useState('');
  const [mpActionError, setMpActionError] = useState('');
  const [mpActionBusy, setMpActionBusy] = useState(false);
  const [showMpPw, setShowMpPw] = useState(false);

  /* --- Visible messages (from IDB, lazy-loaded) --- */
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  /* --- Password prompt for password-mode chats --- */
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordPromptChatId, setPasswordPromptChatId] = useState('');
  const [promptPassword, setPromptPassword] = useState('');

  /* --- Auto-lock timer --- */
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(() => {
    const saved = localStorage.getItem(AUTO_LOCK_KEY);
    return saved ? Number(saved) : 5;
  });
  const initialAutoLockActivity = Number(localStorage.getItem(AUTO_LOCK_ACTIVITY_KEY) || '');
  const activityRef = useRef(Number.isFinite(initialAutoLockActivity) && initialAutoLockActivity > 0 ? initialAutoLockActivity : Date.now());
  const activityPersistedAtRef = useRef(activityRef.current);

  /* --- Password peek (eye icon on locked passwords) --- */
  const [passwordPeeking, setPasswordPeeking] = useState(false);
  const passwordPeekTimerRef = useRef<ReturnType<typeof setTimeout>>();
  function startPasswordPeek() {
    setPasswordPeeking(true);
    clearTimeout(passwordPeekTimerRef.current);
    passwordPeekTimerRef.current = setTimeout(() => setPasswordPeeking(false), 3000);
  }
  function stopPasswordPeek() {
    setPasswordPeeking(false);
    clearTimeout(passwordPeekTimerRef.current);
  }

  /* --- PWA: Install prompt, update notification, offline status --- */
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<any>(null);
  const [pwaUpdateReady, setPwaUpdateReady] = useState(false);
  const [pwaOffline, setPwaOffline] = useState(!navigator.onLine);
  const [pwaInstalled, setPwaInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true,
  );
  const waitingSwRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    // Intercept the browser install prompt
    const onBeforeInstall = (e: Event) => { e.preventDefault(); setPwaInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Detect when the app is successfully installed
    const onInstalled = () => { setPwaInstalled(true); setPwaInstallPrompt(null); };
    window.addEventListener('appinstalled', onInstalled);

    // Online/offline tracking
    const goOnline = () => setPwaOffline(false);
    const goOffline = () => setPwaOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Listen for SW update — named handlers so cleanup can remove them
    // (otherwise StrictMode's double-mount stacks duplicate controllerchange
    // handlers, each able to fire window.location.reload()).
    let swReg: ServiceWorkerRegistration | null = null;
    const onUpdateFound = () => {
      const newSw = swReg?.installing;
      if (!newSw) return;
      newSw.addEventListener('statechange', () => {
        if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
          waitingSwRef.current = newSw;
          setPwaUpdateReady(true);
        }
      });
    };
    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        swReg = reg;
        reg.addEventListener('updatefound', onUpdateFound);
      });
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if ('serviceWorker' in navigator) {
        swReg?.removeEventListener('updatefound', onUpdateFound);
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, []);

  const pwaInstall = useCallback(async () => {
    if (!pwaInstallPrompt) return;
    (pwaInstallPrompt as any).prompt();
    const result = await (pwaInstallPrompt as any).userChoice;
    if (result.outcome === 'accepted') setPwaInstallPrompt(null);
  }, [pwaInstallPrompt]);

  const pwaApplyUpdate = useCallback(() => {
    if (waitingSwRef.current) {
      waitingSwRef.current.postMessage({ type: 'SKIP_WAITING' });
    }
  }, []);

  /* --- Sidebar --- */
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [sidebarMenuChatId, setSidebarMenuChatId] = useState('');
  const sidebarMenuRef = useRef<HTMLDivElement>(null);
  const [sidebarRenamingId, setSidebarRenamingId] = useState('');
  // Pending delete: chat ID whose deletion the user is being asked to confirm.
  // Deletion is destructive (chats, messages, secrets all wiped from IDB) and
  // currently irreversible — protect against accidental clicks with a modal.
  const [pendingDeleteChatId, setPendingDeleteChatId] = useState('');
  const [sidebarRenameValue, setSidebarRenameValue] = useState('');
  const [eraseStep, setEraseStep] = useState<0 | 1 | 2>(0); // 0=closed, 1=first warning, 2=second warning
  const [castleInfoChatId, setCastleInfoChatId] = useState(''); // chat id to show castle info modal
  const isSidebarDismissible = isMobile && sidebarOpen;

  /* --- Chat sessions --- */
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState('');
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const initialChatRestoreRef = useRef(false);

  /* --- Current settings --- */
  const [securityMode, setSecurityMode] = useState<SecurityMode>('password');
  const [obfuscationMode, setObfuscationMode] = useState<ObfuscationMode>('none');
  const [compressionMode, setCompressionMode] = useState<CompressionMode>('balanced');
  const [decoyText, setDecoyText] = useState('');
  const [selectedCoverCategory, setSelectedCoverCategory] = useState<string>('neutral');
  const [stegIndex, setStegIndex] = useState(-1); // -1 = no preset selected (user text)
  const [stegEditing, setStegEditing] = useState(false);
  const [stegDragging, setStegDragging] = useState(false);
  const spectrumTrackRef = useRef<HTMLDivElement | null>(null);

  /* --- Per-chat busy tracking --- */
  const [busyChats, setBusyChats] = useState<Set<string>>(new Set());
  const activeChatIdRef = useRef(activeChatId);
  const chatLoadRequestRef = useRef(0);
  activeChatIdRef.current = activeChatId;

  /* --- Input/Output --- */
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const busy = busyChats.has(activeChatId);
  const [copied, setCopied] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const successToastTimer = useRef<ReturnType<typeof setTimeout>>();
  const showSuccessToast = useCallback((msg: string) => {
    clearTimeout(successToastTimer.current);
    setSuccessToast(msg);
    successToastTimer.current = setTimeout(() => setSuccessToast(''), 2500);
  }, []);
  const [estimatedSize, setEstimatedSize] = useState('');

  /* --- Password --- */
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);

  /* --- ECC --- */
  const [myKeyPair, setMyKeyPair] = useState<CryptoKeyPair | null>(null);
  const [myPublicKeyB64, setMyPublicKeyB64] = useState('');
  const [friendPublicKeyB64, setFriendPublicKeyB64] = useState('');
  const [eccSessionName, setEccSessionName] = useState('');
  const [eccNameConfirmed, setEccNameConfirmed] = useState(false);
  const [eccCodeShared, setEccCodeShared] = useState(false);
  const [eccFriendConfirmed, setEccFriendConfirmed] = useState(false);
  const [mnemonicWords, setMnemonicWords] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [step3Notice, setStep3Notice] = useState<{ type: 'error'; text: string } | null>(null);
  const step3NoticeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [step3InputFlash, setStep3InputFlash] = useState(false);
  const step3FlashTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [step2Reminder, setStep2Reminder] = useState(false);
  const step2ReminderTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [showEccQr, setShowEccQr] = useState(false);
  const [eccQrUrl, setEccQrUrl] = useState('');
  const [eccQrBlob, setEccQrBlob] = useState<Blob | null>(null);
  const [pastePreviewOpen, setPastePreviewOpen] = useState(false);
  const [pastePreviewUrl, setPastePreviewUrl] = useState('');
  const [pastePreviewBlob, setPastePreviewBlob] = useState<Blob | null>(null);
  const [cameraScanOpen, setCameraScanOpen] = useState(false);
  const [cameraScanStatus, setCameraScanStatus] = useState('Point the camera at your friend\'s QR code.');

  /* --- Attachments --- */
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileSelectionRequestRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval>>();
  const [audioAttachment, setAudioAttachment] = useState<{ name: string; dataUrl: string } | null>(null);
  const [highlightMsgId, setHighlightMsgId] = useState('');
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [compressingChats, setCompressingChats] = useState<Set<string>>(new Set());
  const mediaCompressing = compressingChats.has(activeChatId);
  const [videoProgress, setVideoProgress] = useState(0);
  const [compressEta, setCompressEta] = useState(0); // estimated total seconds
  const [compressElapsed, setCompressElapsed] = useState(0);
  const [compressLoadContent, setCompressLoadContent] = useState<{ text: string; sub: string; fade: string }>({ text: '', sub: '', fade: '' });
  const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis | null>(null);
  const [selectedCompressId, setSelectedCompressId] = useState('original');
  const attachPreviewUrl = useMemo(() => {
    if (!attachedFile || !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(attachedFile.name)) return '';
    return URL.createObjectURL(attachedFile);
  }, [attachedFile]);
  useEffect(() => { return () => { if (attachPreviewUrl) URL.revokeObjectURL(attachPreviewUrl); }; }, [attachPreviewUrl]);

  /* --- Per-chat compression timing --- */
  const compressTimingRef = useRef<Map<string, { startedAt: number; eta: number }>>(new Map());
  const compressEtaRef = useRef(0);
  compressEtaRef.current = compressEta;

  useEffect(() => {
    if (!mediaCompressing) { setCompressElapsed(0); return; }
    const timing = compressTimingRef.current.get(activeChatId);
    const start = timing?.startedAt ?? Date.now();
    if (timing?.eta) setCompressEta(timing.eta);
    // Immediately sync elapsed so it doesn't flash 0
    setCompressElapsed(Math.floor((Date.now() - start) / 1000));
    const iv = window.setInterval(() => setCompressElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [mediaCompressing, activeChatId]);

  const pickPoetryLine = useCallback((): { text: string; lang: string } => {
    const cats = DEFAULT_ROTATING_WORLD_POETRY_CATEGORIES;
    // Persian:World ratio ≈ 5.5:1 → ~85% Persian, ~15% world
    if (Math.random() < 0.85) {
      const all = getCoverTexts('poetry');
      const idx = Math.floor(Math.random() * all.length);
      const verse = all[idx];
      // Determine poet from sequential slice boundaries
      let cursor = 0;
      let poetLabel = '';
      for (const poet of IRANIAN_POET_SLICES) {
        if (idx < cursor + poet.count) { if (poet.id !== 'others') poetLabel = poet.labelEn; break; }
        cursor += poet.count;
      }
      return { text: verse, lang: poetLabel ? `${poetLabel} — Persian Poetry` : 'Persian Poetry' };
    }
    const cat = cats[Math.floor(Math.random() * cats.length)];
    return { text: getRandomWorldCoverText(cat), lang: WORLD_COVER_CATEGORY_META[cat].labelEn + ' Poetry' };
  }, []);

  useEffect(() => {
    if (!mediaCompressing) { setCompressLoadContent({ text: '', sub: '', fade: '' }); return; }
    const ids: number[] = [];
    let poetryIv = 0;
    const s = (fn: () => void, ms: number) => { ids.push(window.setTimeout(fn, ms)); };
    const eta = compressEtaRef.current;
    const etaStr = eta > 60 ? `${Math.floor(eta / 60)} min ${Math.round(eta % 60)} sec` : eta > 0 ? `${Math.round(eta)} seconds` : '';
    // Phase 1: info
    setCompressLoadContent({ text: etaStr ? `Working on it — about ${etaStr}` : 'Processing your file…', sub: '', fade: 'fade-in' });
    s(() => setCompressLoadContent(p => ({ ...p, fade: 'fade-out' })), 8_000);
    // Phase 2: support
    s(() => setCompressLoadContent({ text: 'Your support helps keep Cipher alive', sub: '♥', fade: 'fade-in' }), 8_600);
    s(() => setCompressLoadContent(p => ({ ...p, fade: 'fade-out' })), 20_600);
    // Phase 3: poetry cycling
    const showPoetry = () => {
      const line = pickPoetryLine();
      setCompressLoadContent({ text: line.text, sub: `— ${line.lang}`, fade: 'fade-in' });
    };
    s(() => {
      showPoetry();
      poetryIv = window.setInterval(() => {
        setCompressLoadContent(p => ({ ...p, fade: 'fade-out' }));
        s(showPoetry, 600);
      }, 15_000);
    }, 21_200);
    return () => { ids.forEach(clearTimeout); clearInterval(poetryIv); };
  }, [mediaCompressing, pickPoetryLine]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number>(0);
  const compressCancelRef = useRef<AbortController | null>(null);
  const micBtnRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesAreaRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [expandedMsgId, setExpandedMsgId] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [lightboxUrl, setLightboxUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const [showSendActionMenu, setShowSendActionMenu] = useState(false);
  const sendActionRef = useRef<HTMLDivElement | null>(null);
  const sendHoldTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const sendHoldTriggeredRef = useRef(false);
  const [showPairedPicker, setShowPairedPicker] = useState(false);
  const pairedPickerRef = useRef<HTMLDivElement>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const [renamingChat, setRenamingChat] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showDonatePanel, setShowDonatePanel] = useState(false);
  const [firstRunOpen, dismissFirstRun] = useFirstRunGuide();
  const [guideOpen, setGuideOpen] = useState<boolean>(false);
  const [starredChats, setStarredChats] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem('cipher_v2_starred'); return s ? new Set(JSON.parse(s)) : new Set(); }
    catch { return new Set(); }
  });

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aPin = starredChats.has(a.id) ? 1 : 0;
      const bPin = starredChats.has(b.id) ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
    });
  }, [chats, starredChats]);

  const totalMsgCount = useMemo(() => chats.reduce((s, c) => s + (c.messageCount || 0), 0), [chats]);

  /* --- Settings panel --- */
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const dismissibleOverlayHistoryKeyRef = useRef('');
  const dismissibleOverlayIgnorePopRef = useRef(false);
  const dismissibleOverlayClosedByBackRef = useRef(false);
  const dismissibleOverlayKey = settingsPanelOpen
    ? 'settings-panel'
    : showSettings
      ? 'obfuscation-popover'
      : isSidebarDismissible
        ? 'mobile-sidebar'
        : '';
  const [themeId, setThemeId] = useState<ThemeId>(loadThemeId);
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cipher_v2_steg_categories');
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* ignore */ }
    return new Set(DEFAULT_ENABLED_CATEGORY_IDS);
  });
  const [advancedModeEnabled, setAdvancedModeEnabled] = useState(() => localStorage.getItem('cipher_v2_advanced_mode') === 'true');
  const [directionOverride, setDirectionOverride] = useState<'auto' | 'encrypt' | 'decrypt'>('auto');
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(() => localStorage.getItem('cipher_v2_auto_delete') === 'true');
  const [autoDeleteDuration, setAutoDeleteDuration] = useState(() => localStorage.getItem('cipher_v2_auto_delete_dur') || '24h');
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // Media steg carrier file
  const [carrierFile, setCarrierFile] = useState<File | null>(null);
  const [carrierType, setCarrierType] = useState<'image' | 'audio' | null>(null);
  const carrierImageInputRef = useRef<HTMLInputElement>(null);
  const carrierAudioInputRef = useRef<HTMLInputElement>(null);

  // Async detection: uploaded file contains encrypted data (QR / LSB)
  const [detectedStegFile, setDetectedStegFile] = useState(false);
  const [replaceStegConfirm, setReplaceStegConfirm] = useState<'file' | 'mic' | null>(null);
  const [pendingReplacementFile, setPendingReplacementFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eccUploadInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraScanRafRef = useRef<number>(0);
  const cameraScanLastRef = useRef(0);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) || null, [chats, activeChatId]);
  const pairedChats = useMemo(
    () => chats.filter((c) => c.securityMode === 'ecc' && c.eccSessionName.trim()),
    [chats]
  );

  const spectrumSegments = useMemo(() => {
    const palette = EDITORIAL_PALETTE;
    const poetryTexts = getCoverTexts('poetry');

    const iranianPoets: SpectrumSegment[] = [];
    let cursor = 0;
    IRANIAN_POET_SLICES.forEach((poet, idx) => {
      const slice = poetryTexts.slice(cursor, cursor + poet.count);
      cursor += poet.count;
      if (slice.length > 0) {
        iranianPoets.push({
          id: `iran-${poet.id}`,
          label: poet.label,
          category: `poetry:${poet.id}`,
          color: palette.iran[idx % palette.iran.length],
          texts: slice,
        });
      }
    });

    if (cursor < poetryTexts.length) {
      iranianPoets.push({
        id: 'iran-extra',
        label: 'شاعران افزوده',
        category: 'poetry:extra',
        color: palette.iran[palette.iran.length - 1],
        texts: poetryTexts.slice(cursor),
      });
    }

    const worldSegments: SpectrumSegment[] = WORLD_COVER_CATEGORIES.map((cat, idx) => ({
      id: `world-${cat}`,
      label: cat,
      category: `world:${cat}`,
      color: palette.world[idx % palette.world.length],
      texts: getWorldCoverTexts(cat),
    }));

    return [
      {
        id: 'daily',
        label: 'روزمره',
        category: 'neutral',
        color: palette.base.daily,
        texts: getCoverTexts('neutral'),
      },
      {
        id: 'proverbs',
        label: 'ضرب المثل',
        category: 'proverbs',
        color: palette.base.proverb,
        texts: getCoverTexts('proverbs'),
      },
      ...worldSegments,
      ...iranianPoets,
      {
        id: 'humor',
        label: 'طنز',
        category: 'pro_government',
        color: palette.base.humor,
        texts: getCoverTexts('pro_government'),
      },
      {
        id: 'kotlet',
        label: 'کتلت',
        category: 'kotlet_recipe',
        color: palette.base.kotlet,
        texts: getCoverTexts('kotlet_recipe'),
      },
    ].filter((seg) => seg.texts.length > 0 && (enabledCategories.size === 0 || enabledCategories.has(seg.category)));
  }, [enabledCategories]);

  /* Helper: check if a category is enabled (empty set = all enabled) */
  const isCategoryEnabled = useCallback((catId: string) => {
    return enabledCategories.size === 0 || enabledCategories.has(catId);
  }, [enabledCategories]);

  /* All possible category ids for settings panel */
  const allCategoryIds = useMemo(() => {
    const palette = EDITORIAL_PALETTE;
    const poetryTexts = getCoverTexts('poetry');
    const ids: { id: string; label: string; color: string; count: number }[] = [
      { id: 'neutral', label: 'Everyday', color: palette.base.daily, count: getCoverTexts('neutral').length },
      { id: 'proverbs', label: 'Proverbs', color: palette.base.proverb, count: getCoverTexts('proverbs').length },
    ];
    WORLD_COVER_CATEGORIES.forEach((cat, i) => {
      ids.push({ id: `world:${cat}`, label: cat.charAt(0).toUpperCase() + cat.slice(1), color: palette.world[i % palette.world.length], count: getWorldCoverTexts(cat).length });
    });
    let cursor = 0;
    IRANIAN_POET_SLICES.forEach((poet, idx) => {
      const slice = poetryTexts.slice(cursor, cursor + poet.count);
      cursor += poet.count;
      if (slice.length > 0) ids.push({ id: `poetry:${poet.id}`, label: poet.label, color: palette.iran[idx % palette.iran.length], count: slice.length });
    });
    ids.push({ id: 'pro_government', label: 'Humor', color: palette.base.humor, count: getCoverTexts('pro_government').length });
    ids.push({ id: 'kotlet_recipe', label: 'Kotlet Recipes', color: palette.base.kotlet, count: getCoverTexts('kotlet_recipe').length });
    return ids;
  }, []);

  const allCategoriesEnabled = useMemo(() => {
    return enabledCategories.size === 0 || allCategoryIds.every((cat: { id: string }) => enabledCategories.has(cat.id));
  }, [allCategoryIds, enabledCategories]);

  const allCoverTexts = useMemo(() => {
    return spectrumSegments.flatMap((seg) => seg.texts.map((text) => ({ text, category: seg.category })));
  }, [spectrumSegments]);

  const spectrumLayout = useMemo(() => {
    const total = allCoverTexts.length || 1;
    let offset = 0;
    return spectrumSegments.map((seg) => {
      const start = (offset / total) * 100;
      offset += seg.texts.length;
      const end = (offset / total) * 100;
      return {
        ...seg,
        start,
        end,
      };
    });
  }, [spectrumSegments, allCoverTexts.length]);

  const stegPositionPct = useMemo(() => {
    if (stegIndex < 0 || allCoverTexts.length === 0) return 0;
    return stegIndex / Math.max(allCoverTexts.length - 1, 1);
  }, [stegIndex, allCoverTexts.length]);

  const maxStegIndex = Math.max(allCoverTexts.length - 1, 0);
  const isAtSpectrumStart = stegIndex <= 0;
  const isAtSpectrumEnd = stegIndex >= maxStegIndex;

  const moveStegBy = useCallback((delta: number) => {
    if (allCoverTexts.length === 0) return;
    const current = stegIndex < 0 ? 0 : stegIndex;
    const next = Math.max(0, Math.min(maxStegIndex, current + delta));
    setStegIndex(next);
    setDecoyText(allCoverTexts[next].text);
    setSelectedCoverCategory(allCoverTexts[next].category);
  }, [allCoverTexts, stegIndex, maxStegIndex]);

  const setStegByPercent = useCallback((pct: number) => {
    if (allCoverTexts.length === 0) return;
    const idx = Math.round(Math.max(0, Math.min(1, pct)) * maxStegIndex);
    setStegIndex(idx);
    setDecoyText(allCoverTexts[idx].text);
    setSelectedCoverCategory(allCoverTexts[idx].category);
  }, [allCoverTexts, maxStegIndex]);

  const hasFileAttachment = !!attachedFile || !!audioAttachment;
  const hasCompression = compressionMode !== 'off';
  const compressionLevel: CompressionLevel = compressionMode === 'off' ? 'balanced' : compressionMode;
  const autoDetectedDecrypt = useMemo(() => {
    const t = inputText.trim();
    return isCipherEnvelope(t) || isEmojiCipher(t) || isPersianCipher(t) || isSteg(t) || detectedStegFile || !!attachedFile?.name.toLowerCase().endsWith('.ctx');
  }, [inputText, detectedStegFile, attachedFile]);
  const looksLikeDecrypt = directionOverride === 'auto' ? autoDetectedDecrypt : directionOverride === 'decrypt';
  const composerInputIsRtl = useMemo(() => isPersian(inputText.trimStart()), [inputText]);

  const stegPreviewUrl = useMemo(() => {
    if (!detectedStegFile || !attachedFile) return null;
    const ft = attachedFile.type || '';
    const fn = attachedFile.name.toLowerCase();
    if (ft.startsWith('image/') || fn.endsWith('.png') || fn.endsWith('.bmp') || fn.endsWith('.jpg') || fn.endsWith('.jpeg')) {
      return URL.createObjectURL(attachedFile);
    }
    return null;
  }, [detectedStegFile, attachedFile]);

  useEffect(() => {
    return () => { if (stegPreviewUrl) URL.revokeObjectURL(stegPreviewUrl); };
  }, [stegPreviewUrl]);

  useEffect(() => {
    if (!detectedStegFile) {
      setReplaceStegConfirm(null);
      setPendingReplacementFile(null);
    }
  }, [detectedStegFile]);

  /* === Master Password Setup (first time) === */
  async function handleSetupMasterPassword() {
    if (lockPassword.length < 4) { setLockError('Password must be at least 4 characters.'); return; }
    if (lockPassword !== lockConfirm) { setLockError('Passwords do not match.'); return; }
    setLockBusy(true); setLockError('');
    try {
      const salt = generateSalt();
      const verifySalt = generateSalt();
      const derivedKek = await deriveKEK(lockPassword, salt);
      const hash = await hashMasterPassword(lockPassword, verifySalt);
      // Wrap all existing plaintext secrets (eccSecrets + chatSecrets + messages) with new KEK
      await rewrapAllSecrets(null, derivedKek);
      localStorage.setItem(MP_SALT_KEY, btoa(String.fromCharCode(...salt)));
      localStorage.setItem(MP_VERIFY_SALT_KEY, btoa(String.fromCharCode(...verifySalt)));
      localStorage.setItem(MP_HASH_KEY, hash);
      localStorage.setItem(MIGRATED_KEY, 'true');
      const now = Date.now();
      activityRef.current = now;
      await persistActiveUnlockSession(derivedKek, now, true);
      setKek(derivedKek);
      setMasterPasswordExists(true);
      setAppUnlocked(true);
      setUnlockRestorePending(false);
      setShowLockSetup(false);
      setLockPassword(''); setLockConfirm('');
      setShowMpPw(false);
      // Data reload is handled by useEffect([appUnlocked, kek])
    } catch (err) { setLockError('Failed to create app password.' + (err instanceof Error ? ' ' + err.message : '')); }
    finally { setLockBusy(false); }
  }

  /* === Change App Password === */
  async function handleChangeMasterPassword(oldPw: string, newPw: string, confirmPw: string): Promise<string | null> {
    if (newPw.length < 4) return 'Password must be at least 4 characters.';
    if (newPw !== confirmPw) return 'Passwords do not match.';
    try {
      const saltB64 = localStorage.getItem(MP_SALT_KEY);
      const verifySaltB64 = localStorage.getItem(MP_VERIFY_SALT_KEY);
      const storedHash = localStorage.getItem(MP_HASH_KEY);
      if (!saltB64 || !verifySaltB64 || !storedHash) return 'App password not found.';
      const oldSalt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
      const oldVerifySalt = Uint8Array.from(atob(verifySaltB64), (c) => c.charCodeAt(0));
      const oldHash = await hashMasterPassword(oldPw, oldVerifySalt);
      if (oldHash !== storedHash) return 'Current app password is wrong.';
      const oldKek = await deriveKEK(oldPw, oldSalt);
      const newSalt = generateSalt();
      const newVerifySalt = generateSalt();
      const newKek = await deriveKEK(newPw, newSalt);
      const newHash = await hashMasterPassword(newPw, newVerifySalt);
      await rewrapAllSecrets(oldKek, newKek);
      localStorage.setItem(MP_SALT_KEY, btoa(String.fromCharCode(...newSalt)));
      localStorage.setItem(MP_VERIFY_SALT_KEY, btoa(String.fromCharCode(...newVerifySalt)));
      localStorage.setItem(MP_HASH_KEY, newHash);
      const now = Date.now();
      activityRef.current = now;
      await persistActiveUnlockSession(newKek, now, true);
      setKek(newKek);
      setShowMpPw(false);
      return null;
    } catch (err) {
      return 'Failed to change app password.' + (err instanceof Error ? ' ' + err.message : '');
    }
  }

  /* === Remove App Password === */
  async function handleRemoveMasterPassword(currentPw: string): Promise<string | null> {
    try {
      const saltB64 = localStorage.getItem(MP_SALT_KEY);
      const verifySaltB64 = localStorage.getItem(MP_VERIFY_SALT_KEY);
      const storedHash = localStorage.getItem(MP_HASH_KEY);
      if (!saltB64 || !verifySaltB64 || !storedHash) return 'App password not found.';
      const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
      const verifySalt = Uint8Array.from(atob(verifySaltB64), (c) => c.charCodeAt(0));
      const hash = await hashMasterPassword(currentPw, verifySalt);
      if (hash !== storedHash) return 'Wrong app password.';
      const oldKek = await deriveKEK(currentPw, salt);
      await rewrapAllSecrets(oldKek, null);
      localStorage.removeItem(MP_SALT_KEY);
      localStorage.removeItem(MP_VERIFY_SALT_KEY);
      localStorage.removeItem(MP_HASH_KEY);
      localStorage.removeItem(MIGRATED_KEY);
      await clearPersistedUnlockSession();
      setKek(null);
      setMasterPasswordExists(false);
      setAppUnlocked(true);
      setUnlockRestorePending(false);
      setShowMpPw(false);
      loadDataWithoutKek();
      return null;
    } catch (err) {
      return 'Failed to remove app password.' + (err instanceof Error ? ' ' + err.message : '');
    }
  }

  /* === App Password Unlock (returning user) === */
  async function handleUnlockMasterPassword() {
    setLockBusy(true); setLockError('');
    try {
      const saltB64 = localStorage.getItem(MP_SALT_KEY)!;
      const verifySaltB64 = localStorage.getItem(MP_VERIFY_SALT_KEY)!;
      const storedHash = localStorage.getItem(MP_HASH_KEY)!;
      const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
      const verifySalt = Uint8Array.from(atob(verifySaltB64), (c) => c.charCodeAt(0));
      const hash = await hashMasterPassword(lockPassword, verifySalt);
      if (hash !== storedHash) { setLockError('Wrong app password.'); setLockBusy(false); return; }
      const derivedKek = await deriveKEK(lockPassword, salt);
      const now = Date.now();
      activityRef.current = now;
      await persistActiveUnlockSession(derivedKek, now, true);
      setKek(derivedKek);
      setAppUnlocked(true);
      setUnlockRestorePending(false);
      setLockPassword('');
    } catch { setLockError('Unlock failed.'); }
    finally { setLockBusy(false); }
  }

  /* === Lock the app (auto-lock / manual) === */
  function persistPasswordSecret(chatId: string, secret: string, chatSecurityMode: ChatSession['securityMode'], isEphemeral?: boolean) {
    const trimmed = secret.trim();
    if (!chatId || !trimmed || chatSecurityMode !== 'password' || isEphemeral) return;
    void saveChatSecret(chatId, trimmed, kek);
  }

  function lockApp() {
    const activeChatMeta = chats.find((chat) => chat.id === activeChatId);
    persistPasswordSecret(activeChatId, password, securityMode, activeChatMeta?.ephemeral);
    void clearPersistedUnlockSession();
    setKek(null);
    setAppUnlocked(false);
    setUnlockRestorePending(false);
    setVisibleMessages([]);
    setChats([]);
    // Reset activeChatId so that after the next unlock, the auto-load effect
    // (which short-circuits on `|| activeChatId`) re-runs and restores the
    // last active chat from LAST_ACTIVE_CHAT_KEY. Without this, the user
    // sees the session selected in the sidebar but an empty message area
    // until they manually click the session again.
    setActiveChatId('');
    setPassword('');
    setLockPassword('');
    setLockError('');
  }

  /* === Load visible messages from IDB for a chat === */
  async function loadVisibleMessages(
    chatId: string,
    currentKek: CryptoKey | null,
    before?: { timestamp: number; msgId: string },
  ) {
    const msgs = await getMessages(chatId, currentKek, PAGE_SIZE, before);
    // msgs come newest-first from IDB, reverse to oldest-first for display
    const inOrder = msgs.reverse().map((m) => {
      const msg: ChatMessage = {
        id: m.msgId,
        inputPreview: m.inputPreview,
        outputPreview: m.outputPreview,
        outputFull: m.payload,
        fileName: m.fileName,
        thumbUrl: m.thumbUrl,
        type: m.type,
        dataType: m.dataType,
        timestamp: m.timestamp,
      };
      // Reconstruct blob/data URLs for media messages
      if (m.type === 'decrypt' && m.dataType === 'F') {
        const parsed = parseDecryptedFilePayload(m.payload);
        if (parsed) {
          msg.fileName = parsed.fileName;
          msg.fileUrl = parsed.fileUrl;
        }
      } else if (m.type === 'decrypt' && m.dataType === 'A') {
        msg.audioUrl = m.payload;
      } else if (m.type === 'encrypt' && m.dataType === 'F' && m.payload.includes('::')) {
        const shareFile = buildMessageFileFromMessage(msg);
        if (shareFile) {
          msg.fileUrl = createMessageFileUrl(shareFile, 'encrypt', msg.fileName);
          msg.shareFile = shareFile;
          if (!isQrShareFileName(msg.fileName)) {
            msg.outputFull = `Encrypted: ${msg.fileName}`;
          }
        } else {
          msg.outputFull = getBrokenEncryptedFileMessage(msg.fileName);
        }
      }
      return withShareFile(msg);
    });
    return inOrder;
  }

  /* === Handle lock button click in sidebar === */
  function handleLockBtnClick() {
    if (masterPasswordExists) {
      // Already has master password — lock the app
      lockApp();
    } else {
      // No master password yet — show warning first
      setShowLockWarning(true);
    }
  }

  /* === After user acknowledges warning, show setup screen === */
  function handleLockWarningAccept() {
    setShowLockWarning(false);
    setShowLockSetup(true);
    setLockPassword('');
    setLockConfirm('');
    setLockError('');
  }

  /* === Init === */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (masterPasswordExists) {
        const restored = await restorePersistedUnlockSession();
        if (!cancelled && !restored) {
          setAppUnlocked(false);
        }
        if (!cancelled) setUnlockRestorePending(false);
        return;
      }

      loadDataWithoutKek();
      if (!cancelled) setUnlockRestorePending(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Load data when unlocking with KEK */
  useEffect(() => {
    if (!appUnlocked || !kek) return;
    loadDataWithKek(kek);
  }, [appUnlocked, kek]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadDataWithoutKek() {
    void (async () => {
      const saved = localStorage.getItem(CHATS_KEY);
      if (!saved) return;
      try {
        const items = JSON.parse(saved) as ChatSession[];
        const withCounts = await Promise.all(items.map(async (c) => ({
          ...c,
          messages: [],
          messageCount: await countMessages(c.id),
        })));
        setChats(withCounts.sort((a, b) => b.lastUsedAt - a.lastUsedAt));
      } catch { setChats([]); }
    })();
  }

  function loadDataWithKek(currentKek: CryptoKey) {
    // Load chats (metadata only — messages loaded from IDB on demand)
    void (async () => {
      const saved = localStorage.getItem(CHATS_KEY);
      if (!saved) return;
      try {
        const items = JSON.parse(saved) as ChatSession[];
        // Migration: if chats still have inline messages, move them to IDB
        const migrated = localStorage.getItem(MIGRATED_KEY);
        if (!migrated) {
          for (const chat of items) {
            if (chat.messages && chat.messages.length > 0) {
              for (const msg of chat.messages) {
                // Resolve idb: pointers for migration
                let outputFull = msg.outputFull;
                if (typeof outputFull === 'string' && outputFull.startsWith('idb:')) {
                  const data = await getLargeData(outputFull.slice(4));
                  if (data) outputFull = data;
                }
                await saveMessage({
                  chatId: chat.id,
                  msgId: msg.id,
                  payload: outputFull,
                  inputPreview: msg.inputPreview,
                  outputPreview: msg.outputPreview,
                  type: msg.type,
                  dataType: msg.dataType,
                  fileName: msg.fileName,
                  timestamp: msg.timestamp,
                }, currentKek);
              }
            }
          }
          // Migrate ECC secrets to wrapped
          await migrateEccSecretsToKEK(currentKek);
          localStorage.setItem(MIGRATED_KEY, 'true');
        }

        // Strip messages from localStorage metadata (they're in IDB now)
        const metadataOnly = items.map((c) => ({ ...c, messages: [] }));
        localStorage.setItem(CHATS_KEY, JSON.stringify(metadataOnly));

        // Count messages per chat for display
        const withCounts = await Promise.all(metadataOnly.map(async (c) => ({
          ...c,
          messageCount: await countMessages(c.id),
        })));
        setChats(withCounts.sort((a, b) => b.lastUsedAt - a.lastUsedAt));
      } catch { setChats([]); }
    })();
  }

  /* === Persist (metadata only) === */
  useEffect(() => {
    if (!appUnlocked) return;
    // Save chat metadata only — messages are in IDB; ephemeral chats are excluded
    const metadata = chats
      .filter((chat) => !chat.ephemeral)
      .map((chat) => ({
        ...chat,
        messages: [], // messages live in IDB now
      }));
    localStorage.setItem(CHATS_KEY, JSON.stringify(metadata));
  }, [chats, appUnlocked]);

  useEffect(() => {
    if (!appUnlocked) {
      initialChatRestoreRef.current = false;
      return;
    }
    if (!activeChatId) return;
    localStorage.setItem(LAST_ACTIVE_CHAT_KEY, activeChatId);
  }, [activeChatId, appUnlocked]);

  useEffect(() => {
    if (!appUnlocked || initialChatRestoreRef.current || activeChatId || chats.length === 0) return;
    const storedChatId = localStorage.getItem(LAST_ACTIVE_CHAT_KEY);
    const targetChat = (storedChatId ? chats.find((chat) => chat.id === storedChatId) : null) || chats[0];
    if (!targetChat) {
      initialChatRestoreRef.current = true;
      return;
    }
    initialChatRestoreRef.current = true;
    void loadChat({ ...targetChat });
  }, [appUnlocked, chats, activeChatId]);

  useEffect(() => {
    if (!showChatMenu) return;
    const handler = (e: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) {
        setShowChatMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showChatMenu]);

  useEffect(() => {
    if (!showPairedPicker) return;
    const handler = (e: MouseEvent) => {
      if (pairedPickerRef.current && !pairedPickerRef.current.contains(e.target as Node)) {
        setShowPairedPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPairedPicker]);

  useEffect(() => {
    if (!sidebarMenuChatId) return;
    const handler = (e: MouseEvent) => {
      if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(e.target as Node)) {
        setSidebarMenuChatId('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sidebarMenuChatId]);

  /* === Theme === */
  useEffect(() => {
    applyTheme(themeId);
    saveThemeId(themeId);
  }, [themeId]);

  useEffect(() => {
    if (themeId !== 'auto') return;
    return watchSystemTheme(() => applyTheme('auto'));
  }, [themeId]);

  /* === Retro mouse sparkle trail === */
  useEffect(() => {
    if (themeId !== 'retro' && themeId !== 'anime') return;

    if (themeId === 'retro') {
      const sparkles = ['✦', '✧', '⋆', '★', '✶', '✴', '❋', '✺', '⚡', '💾', '🌟'];
      const colors = ['#ff00ff', '#ffff00', '#00ffff', '#ff6600', '#00ff00', '#ff69b4', '#7b68ee'];
      let throttle = 0;
      const onMove = (e: MouseEvent) => {
        const now = Date.now();
        if (now - throttle < 60) return;
        throttle = now;
        const el = document.createElement('span');
        el.className = 'retro-trail';
        el.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
        el.style.left = `${e.clientX}px`;
        el.style.top = `${e.clientY}px`;
        el.style.color = colors[Math.floor(Math.random() * colors.length)];
        el.style.fontSize = `${12 + Math.random() * 14}px`;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
      };
      window.addEventListener('mousemove', onMove);
      return () => {
        window.removeEventListener('mousemove', onMove);
        document.querySelectorAll('.retro-trail').forEach(e => e.remove());
      };
    }

    /* Anime theme: falling stars + sparkle click burst */
    const starPool = ['✦', '⋆', '✧', '✩', '⊹', '🌸', '⚝', '✶'];
    const starColors = ['#ff6b9d', '#c084fc', '#7dd3fc', '#ffb3d0', '#f0abfc', '#67e8f9'];
    let starTimer: ReturnType<typeof setInterval>;

    /* Ambient falling stars */
    const spawnStar = () => {
      const el = document.createElement('span');
      el.className = 'anime-falling-star';
      el.textContent = starPool[Math.floor(Math.random() * starPool.length)];
      el.style.left = `${Math.random() * 100}vw`;
      el.style.color = starColors[Math.floor(Math.random() * starColors.length)];
      el.style.fontSize = `${10 + Math.random() * 12}px`;
      el.style.animationDuration = `${6 + Math.random() * 8}s`;
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    };
    starTimer = setInterval(spawnStar, 1800);

    /* Click: katana slash burst */
    const onClick = (e: MouseEvent) => {
      const slashSymbols = ['⚔', '🗡', '✦', '💫', '⊹'];
      for (let i = 0; i < 4; i++) {
        const el = document.createElement('span');
        el.className = 'anime-click-burst';
        el.textContent = slashSymbols[Math.floor(Math.random() * slashSymbols.length)];
        el.style.left = `${e.clientX}px`;
        el.style.top = `${e.clientY}px`;
        el.style.color = starColors[Math.floor(Math.random() * starColors.length)];
        el.style.fontSize = `${14 + Math.random() * 10}px`;
        const angle = (Math.PI * 2 * i) / 4 + (Math.random() - 0.5) * 0.8;
        const dist = 30 + Math.random() * 30;
        el.style.setProperty('--burst-x', `${Math.cos(angle) * dist}px`);
        el.style.setProperty('--burst-y', `${Math.sin(angle) * dist}px`);
        el.style.setProperty('--burst-x2', `${Math.cos(angle) * dist * 1.5}px`);
        el.style.setProperty('--burst-y2', `${Math.sin(angle) * dist * 1.5}px`);
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
      }
    };
    window.addEventListener('click', onClick);

    return () => {
      clearInterval(starTimer);
      window.removeEventListener('click', onClick);
      document.querySelectorAll('.anime-falling-star, .anime-click-burst').forEach(e => e.remove());
    };
  }, [themeId]);

  /* === Persist settings === */
  useEffect(() => {
    if (enabledCategories.size > 0) {
      localStorage.setItem('cipher_v2_steg_categories', JSON.stringify([...enabledCategories]));
    } else {
      localStorage.removeItem('cipher_v2_steg_categories');
    }
  }, [enabledCategories]);

  useEffect(() => {
    localStorage.setItem('cipher_v2_advanced_mode', String(advancedModeEnabled));
    if (!advancedModeEnabled) setShowAdvanced(false);
  }, [advancedModeEnabled]);

  useEffect(() => {
    localStorage.setItem('cipher_v2_auto_delete', String(autoDeleteEnabled));
    localStorage.setItem('cipher_v2_auto_delete_dur', autoDeleteDuration);
  }, [autoDeleteEnabled, autoDeleteDuration]);

  /* Auto-delete: purge old messages on mount and when settings change */
  useEffect(() => {
    if (!autoDeleteEnabled) return;
    const durMs: Record<string, number> = {
      '1h': 3_600_000,
      '6h': 21_600_000,
      '24h': 86_400_000,
      '7d': 604_800_000,
      '30d': 2_592_000_000,
    };
    const threshold = durMs[autoDeleteDuration] || 86_400_000;
    const cutoff = Date.now() - threshold;

    // Delete messages older than cutoff from each chat
    setChats((prev) => prev.map((chat) => {
      const filtered = chat.messages.filter((m) => m.timestamp >= cutoff);
      if (filtered.length === chat.messages.length) return chat;
      return { ...chat, messages: filtered };
    }));

    // Also purge from visible messages
    setVisibleMessages((prev) => prev.filter((m) => m.timestamp >= cutoff));
  }, [autoDeleteEnabled, autoDeleteDuration]);

  // Async scan: detect if uploaded image/audio contains encrypted data
  useEffect(() => {
    if (!attachedFile) { setDetectedStegFile(false); return; }
    let cancelled = false;
    const probableCipherMedia = isKnownCipherMediaFileName(attachedFile.name.toLowerCase());
    setDetectedStegFile(probableCipherMedia);

    (async () => {
      try {
        const extracted = await extractCipherPayloadFromMedia(attachedFile);
        if (!cancelled) setDetectedStegFile(probableCipherMedia || !!extracted);
      } catch {
        if (!cancelled) setDetectedStegFile(probableCipherMedia);
      }
    })();
    return () => { cancelled = true; };
  }, [attachedFile]);

  /* === Size estimate === */
  useEffect(() => {
    if (!hasFileAttachment && !inputText) { setEstimatedSize(''); return; }
    const bytes = attachedFile
      ? attachedFile.size
      : audioAttachment
        ? new Blob([audioAttachment.dataUrl]).size
        : new Blob([inputText]).size;
    const out = estimateEnvelopeSize(bytes, attachedFile ? 'F' : audioAttachment ? 'A' : 'T', hasCompression, compressionLevel);
    setEstimatedSize(`~${(out / 1024).toFixed(out > 1024 ? 1 : 0)} KB`);
  }, [inputText, attachedFile, audioAttachment, hasCompression, compressionLevel, hasFileAttachment]);

  /* === QR capacity tracking === */
  const qrUsage = useMemo(() => {
    if (obfuscationMode !== 'qr' || looksLikeDecrypt) return null;
    if (!inputText && !hasFileAttachment) return null;
    const bytes = attachedFile
      ? attachedFile.size
      : audioAttachment
        ? new Blob([audioAttachment.dataUrl]).size
        : new Blob([inputText]).size;
    if (bytes === 0) return null;
    const estimated = estimateEnvelopeSize(bytes, attachedFile ? 'F' : audioAttachment ? 'A' : 'T', hasCompression, compressionLevel);
    const ratio = estimated / QR_MAX_BYTES;
    const level: 'ok' | 'warn' | 'danger' | 'over' =
      ratio > 1 ? 'over' : ratio > 0.9 ? 'danger' : ratio > 0.7 ? 'warn' : 'ok';
    return { estimated, max: QR_MAX_BYTES, ratio, level };
  }, [obfuscationMode, looksLikeDecrypt, inputText, attachedFile, audioAttachment, hasCompression, compressionLevel, hasFileAttachment]);

  /* === Exceeds QR capacity? (gates noise/snow visibility) === */
  const exceedsQr = useMemo(() => {
    if (looksLikeDecrypt) return false;
    if (!inputText && !hasFileAttachment) return false;
    const bytes = attachedFile
      ? attachedFile.size
      : audioAttachment
        ? new Blob([audioAttachment.dataUrl]).size
        : new Blob([inputText]).size;
    if (bytes === 0) return false;
    const estimated = estimateEnvelopeSize(bytes, attachedFile ? 'F' : audioAttachment ? 'A' : 'T', hasCompression, compressionLevel);
    return estimated > QR_MAX_BYTES;
  }, [looksLikeDecrypt, inputText, attachedFile, audioAttachment, hasCompression, compressionLevel, hasFileAttachment]);

  const hasComposerPayload = !!inputText || !!attachedFile || !!audioAttachment;
  const composerInputBytes = useMemo(() => {
    if (!hasComposerPayload) return 0;
    return attachedFile
      ? attachedFile.size
      : audioAttachment
        ? new Blob([audioAttachment.dataUrl]).size
        : new Blob([inputText]).size;
  }, [inputText, attachedFile, audioAttachment, hasComposerPayload]);
  const sendButtonDisabled = busy || mediaCompressing || !hasComposerPayload || qrUsage?.level === 'over';
  const selectedCompressionOption = fileAnalysis?.options.find((option) => option.id === selectedCompressId) ?? null;
  const directionChipLabel = directionOverride === 'auto'
    ? 'Auto'
    : directionOverride === 'encrypt'
      ? 'Encrypt'
      : 'Decrypt';

  // Auto-reset noise/snow if text content shrinks below QR threshold (skip for file attachments)
  useEffect(() => {
    if (!hasFileAttachment && !exceedsQr && (obfuscationMode === 'noise' || obfuscationMode === 'snow')) {
      setObfuscationMode('none');
    }
  }, [exceedsQr, obfuscationMode, hasFileAttachment]);

  // Auto-reset text-only obfuscation modes when file is attached
  useEffect(() => {
    if (hasFileAttachment && (obfuscationMode === 'qr' || obfuscationMode === 'emoji' || obfuscationMode === 'persian')) {
      setObfuscationMode('none');
    }
  }, [hasFileAttachment, obfuscationMode]);

  /* === Scroll to bottom === */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  /* === Track scroll position for scroll-to-bottom button === */
  useEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [activeChat?.id]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function openSettingsPanel() {
    setShowSettings(false);
    setSettingsPanelOpen(true);
  }

  function closeSettingsPanel() {
    setSettingsPanelOpen(false);
  }

  async function clearPersistedUnlockSession() {
    activityPersistedAtRef.current = 0;
    localStorage.removeItem(AUTO_LOCK_ACTIVITY_KEY);
    try {
      await clearAppUnlockSession();
    } catch {
      // Ignore runtime session cleanup failures and fall back to password unlock.
    }
  }

  async function persistActiveUnlockSession(
    sessionKek: CryptoKey | null | undefined = kek,
    activityAt = activityRef.current,
    force = false,
  ) {
    if (!sessionKek || autoLockMinutes <= 0) return;
    if (!force && activityAt - activityPersistedAtRef.current < 5_000) return;

    activityRef.current = activityAt;
    activityPersistedAtRef.current = activityAt;
    localStorage.setItem(AUTO_LOCK_ACTIVITY_KEY, String(activityAt));

    try {
      await saveAppUnlockSession({
        kek: sessionKek,
        lastActivityAt: activityAt,
        expiresAt: activityAt + autoLockMinutes * 60_000,
      });
    } catch {
      // If this browser cannot persist a CryptoKey, the app still falls back to password unlock.
    }
  }

  async function restorePersistedUnlockSession(): Promise<boolean> {
    if (!masterPasswordExists || autoLockMinutes <= 0) {
      await clearPersistedUnlockSession();
      return false;
    }

    try {
      const savedSession = await getAppUnlockSession();
      const savedActivity = Number(localStorage.getItem(AUTO_LOCK_ACTIVITY_KEY) || '');
      const lastActivityAt = Number.isFinite(savedActivity) && savedActivity > 0
        ? savedActivity
        : savedSession?.lastActivityAt ?? 0;

      if (!savedSession || lastActivityAt <= 0) {
        await clearPersistedUnlockSession();
        return false;
      }

      const expiresAt = Math.min(savedSession.expiresAt, lastActivityAt + autoLockMinutes * 60_000);
      if (Date.now() >= expiresAt) {
        await clearPersistedUnlockSession();
        return false;
      }

      activityRef.current = lastActivityAt;
      activityPersistedAtRef.current = lastActivityAt;
      setKek(savedSession.kek);
      setAppUnlocked(true);
      return true;
    } catch {
      await clearPersistedUnlockSession();
      return false;
    }
  }

  useEffect(() => {
    if (settingsPanelOpen && showSettings) {
      setShowSettings(false);
    }
  }, [settingsPanelOpen, showSettings]);

  useEffect(() => {
    const handlePopState = () => {
      if (dismissibleOverlayIgnorePopRef.current) {
        dismissibleOverlayIgnorePopRef.current = false;
        return;
      }
      if (settingsPanelOpen) {
        dismissibleOverlayClosedByBackRef.current = true;
        setSettingsPanelOpen(false);
        return;
      }
      if (showSettings) {
        dismissibleOverlayClosedByBackRef.current = true;
        setShowSettings(false);
        return;
      }
      if (isSidebarDismissible) {
        dismissibleOverlayClosedByBackRef.current = true;
        setSidebarOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSidebarDismissible, settingsPanelOpen, showSettings]);

  // When a transient panel is open, keep one history entry so the phone back button closes it first.
  useEffect(() => {
    const previousKey = dismissibleOverlayHistoryKeyRef.current;
    const currentState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {};

    if (dismissibleOverlayKey) {
      const nextState = { ...currentState, cipherDismissibleOverlay: dismissibleOverlayKey };
      if (!previousKey) {
        window.history.pushState(nextState, '');
      } else if (previousKey !== dismissibleOverlayKey) {
        window.history.replaceState(nextState, '');
      }
      dismissibleOverlayHistoryKeyRef.current = dismissibleOverlayKey;
      dismissibleOverlayClosedByBackRef.current = false;
      return;
    }

    if (!previousKey) return;

    if (dismissibleOverlayClosedByBackRef.current) {
      dismissibleOverlayClosedByBackRef.current = false;
      dismissibleOverlayHistoryKeyRef.current = '';
      return;
    }

    dismissibleOverlayIgnorePopRef.current = true;
    dismissibleOverlayHistoryKeyRef.current = '';
    window.history.back();
  }, [dismissibleOverlayKey]);

  /* === Close settings popover on outside click === */
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  useEffect(() => {
    if (!showSendActionMenu) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (sendActionRef.current && !sendActionRef.current.contains(e.target as Node)) {
        setShowSendActionMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showSendActionMenu]);

  useEffect(() => {
    if (showSendActionMenu && sendButtonDisabled) {
      setShowSendActionMenu(false);
    }
  }, [showSendActionMenu, sendButtonDisabled]);

  useEffect(() => {
    return () => {
      if (sendHoldTimerRef.current) clearTimeout(sendHoldTimerRef.current);
    };
  }, []);

  /* === Session management === */
  function startNewChat(preserveComposer = true) {
    const currentChat = chats.find((chat) => chat.id === activeChatId);
    persistPasswordSecret(activeChatId, password, securityMode, currentChat?.ephemeral);
    setActiveChatId('');
    setError('');
    setVisibleMessages([]);
    setHasMoreMessages(false);
    if (!preserveComposer) {
      setInputText('');
      setAttachedFile(null);
      setAudioAttachment(null);
      setFileAnalysis(null);
      setSelectedCompressId('original');
      setCarrierFile(null);
      setCarrierType(null);
    }
    // Reset all per-chat settings to defaults
    setPassword('');
    setShowPassword(true);
    setSecurityMode('password');
    setObfuscationMode('none');
    setCompressionMode('balanced');
    setFriendPublicKeyB64('');
    setMyPublicKeyB64('');
    setEccSessionName('');
    setEccNameConfirmed(false);
    setEccCodeShared(false);
    setEccFriendConfirmed(false);
    setPasswordPeeking(false);
    clearTimeout(passwordPeekTimerRef.current);
    setDirectionOverride('auto');
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.style.height = 'auto';
      if (preserveComposer && textareaRef.current.value) {
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
      }
    });
  }

  async function loadChat(chat: ChatSession) {
    const chatId = chat.id;
    const requestId = ++chatLoadRequestRef.current;
    const isCurrentRequest = () => chatLoadRequestRef.current === requestId;

    if (activeChatId && activeChatId !== chatId) {
      const currentChat = chats.find((session) => session.id === activeChatId);
      persistPasswordSecret(activeChatId, password, securityMode, currentChat?.ephemeral);
    }

    // Stop any active password peek
    stopPasswordPeek();

    // Password-mode chat: try to load secret from IDB first (skip for ephemeral)
    if (chat.securityMode === 'password' && !chat.ephemeral) {
      const storedSecret = await getChatSecret(chatId, kek);
      if (!isCurrentRequest()) return;
      if (storedSecret) {
        // Password recovered from IDB → set in React state
        setPassword(storedSecret);
      } else {
        // No stored secret → prompt user
        setPasswordPromptChatId(chatId);
        setPromptPassword('');
        setPasswordPromptOpen(true);
        return;
      }
    } else {
      // ECC mode — clear password
      setPassword('');
    }

    if (!isCurrentRequest()) return;

    setActiveChatId(chatId);
    setSecurityMode(chat.securityMode);
    // Noise/snow are transient overflow modes — reset to 'none' on restore
    const restoredOb = chat.obfuscationMode;
    setObfuscationMode(restoredOb === 'noise' || restoredOb === 'snow' ? 'none' : restoredOb);
    setCompressionMode(chat.compressionMode);
    setEccSessionName(chat.eccSessionName);
    setError('');

    if (chat.securityMode === 'ecc') {
      const cached = await getEccSecret(chatId, kek);
      if (!isCurrentRequest()) return;
      if (cached) {
        setMyPublicKeyB64(chat.myPublicKeyB64);
        setFriendPublicKeyB64(chat.friendPublicKeyB64);
        setEccNameConfirmed(true);
        setEccCodeShared(true);
        setEccFriendConfirmed(true);
      } else {
        setFriendPublicKeyB64('');
        setEccCodeShared(false);
        setEccFriendConfirmed(false);
        const pair = await generateEccKeyPair();
        if (!isCurrentRequest()) return;
        setMyKeyPair(pair);
        const publicKeyB64 = await exportPublicKeyB64(pair.publicKey);
        if (!isCurrentRequest()) return;
        setMyPublicKeyB64(publicKeyB64);
        setEccNameConfirmed(!!chat.eccSessionName.trim());
      }
    } else {
      setFriendPublicKeyB64(chat.friendPublicKeyB64);
      setMyPublicKeyB64(chat.myPublicKeyB64);
      setEccNameConfirmed(!!chat.eccSessionName.trim());
      setEccCodeShared(!!chat.friendPublicKeyB64.trim());
      setEccFriendConfirmed(!!chat.friendPublicKeyB64.trim());
    }

    // Load messages from IDB (ephemeral chats have no persisted messages)
    if (chat.ephemeral) {
      setVisibleMessages([]);
      setHasMoreMessages(false);
    } else {
      const msgs = await loadVisibleMessages(chatId, kek);
      if (!isCurrentRequest()) return;
      setVisibleMessages(msgs);
      const total = await countMessages(chatId);
      if (!isCurrentRequest()) return;
      setHasMoreMessages(msgs.length < total);
    }

    // Scroll to bottom after chat loads (newest messages visible)
    requestAnimationFrame(() => {
      if (!isCurrentRequest()) return;
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    });

    if (isMobile) setSidebarOpen(false);
  }

  /* Load more messages for lazy-loading */
  async function loadMoreMessages() {
    if (!activeChatId || loadingMore || !hasMoreMessages) return;
    const chatId = activeChatId;
    const visibleCount = visibleMessages.length;
    setLoadingMore(true);
    try {
      const oldest = visibleMessages[0];
      const before = oldest ? { timestamp: oldest.timestamp, msgId: oldest.id } : undefined;
      const older = await loadVisibleMessages(chatId, kek, before);
      if (activeChatIdRef.current !== chatId) return;
      if (older.length === 0) { setHasMoreMessages(false); return; }
      setVisibleMessages((prev) => [...older, ...prev]);
      const total = await countMessages(chatId);
      if (activeChatIdRef.current !== chatId) return;
      setHasMoreMessages(older.length + visibleCount < total);
    } finally {
      setLoadingMore(false);
    }
  }

  /* Accept password from prompt dialog */
  async function handlePasswordPromptConfirm() {
    if (!promptPassword.trim()) return;
    const targetChatId = passwordPromptChatId;
    setPassword(promptPassword.trim());
    setPasswordPromptOpen(false);
    // Save the entered password to IDB for future loads
    if (targetChatId) {
      const isEph = chats.some((c) => c.id === targetChatId && c.ephemeral);
      if (!isEph) await saveChatSecret(targetChatId, promptPassword.trim(), kek);
    }
    // Now load the chat
    setPasswordPromptChatId('');
    setPromptPassword('');
    const chat = chats.find((c) => c.id === targetChatId);
    if (chat) await loadChat({ ...chat });
  }

  function removeChat(id: string) {
    void deleteMessagesForChat(id);
    void deleteEccSecret(id);
    void deleteChatSecret(id);
    if (localStorage.getItem(LAST_ACTIVE_CHAT_KEY) === id) {
      localStorage.removeItem(LAST_ACTIVE_CHAT_KEY);
    }
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) {
      startNewChat(false);
      setVisibleMessages([]);
    }
  }

  function renameActiveChat(newName: string) {
    if (!activeChatId || !newName.trim()) return;
    setChats((prev) => prev.map((c) => c.id === activeChatId ? { ...c, name: newName.trim() } : c));
  }

  function renameChat(id: string, newName: string) {
    if (!id || !newName.trim()) return;
    setChats((prev) => prev.map((c) => c.id === id ? { ...c, name: newName.trim() } : c));
  }

  function toggleStarChat(id: string) {
    setStarredChats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('cipher_v2_starred', JSON.stringify([...next]));
      return next;
    });
  }

  const ensureChat = useCallback(
    (inputPreview: string): string => {
      if (activeChatId) {
        // Update existing session settings
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChatId
              ? {
                  ...c,
                  securityMode,
                  selectedVaultId: '',
                  obfuscationMode,
                  compressionMode,
                  friendPublicKeyB64,
                  myPublicKeyB64,
                  eccSessionName,
                  lastUsedAt: Date.now(),
                }
              : c
          )
        );
        return activeChatId;
      }

      const id = crypto.randomUUID();
      let chatName: string;
      let castleId: number | undefined;
      if (securityMode === 'ecc') {
        chatName = chatLabel(inputPreview);
      } else {
        const usedIds = new Set<number>(chats.filter(c => c.castleId !== undefined).map(c => c.castleId as number));
        castleId = pickCastleIndex(usedIds);
        const castle = IRAN_CASTLES[castleId];
        chatName = isPersian(inputPreview) ? castle.nameFa : castle.nameEn;
      }
      const newChat: ChatSession = {
        id,
        name: chatName,
        securityMode,
        selectedVaultId: '',
        obfuscationMode,
        compressionMode,
        friendPublicKeyB64,
        myPublicKeyB64,
        eccSessionName,
        messages: [],
        castleId,
        ephemeral: ephemeralMode || undefined,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(id);
      return id;
    },
    [activeChatId, securityMode, obfuscationMode, compressionMode, friendPublicKeyB64, myPublicKeyB64, eccSessionName, chats, ephemeralMode]
  );

  function addMessageToChat(chatId: string, msg: ChatMessage) {
    const isEphemeral = chats.some((c) => c.id === chatId && c.ephemeral);
    // Save to IDB (encrypted with KEK) — skip for ephemeral chats
    if (!isEphemeral) {
      void saveMessage({
        chatId,
        msgId: msg.id,
        payload: msg.outputFull,
        inputPreview: msg.inputPreview,
        outputPreview: msg.outputPreview,
        type: msg.type,
        dataType: msg.dataType,
        fileName: msg.fileName,
        thumbUrl: msg.thumbUrl,
        timestamp: msg.timestamp,
      }, kek);
    }
    // Update visible messages only if user is viewing this chat
    if (chatId === activeChatIdRef.current) {
      setVisibleMessages((prev) => [...prev, msg]);
    }
    // Update chat metadata (message count + timestamp)
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, messageCount: (c.messageCount || 0) + 1, lastUsedAt: Date.now() } : c
      )
    );
    // Brief glow on the new message
    clearTimeout(highlightTimerRef.current);
    setHighlightMsgId(msg.id);
    highlightTimerRef.current = setTimeout(() => setHighlightMsgId(''), 1800);
  }

  function generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    const pw = Array.from(arr, (b) => chars[b % chars.length]).join('');
    setPassword(pw);
    setShowPassword(true);
  }

  /* === Clipboard === */
  async function copyText(text: string, id = '_global') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Modern Clipboard API can fail when the document isn't focused or
      // when permission is denied. Fall back to the legacy execCommand path,
      // which still works in many of those cases (e.g. when an iframe stole focus).
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) {
          setError('Copy failed. Select the text and copy it manually.');
          return;
        }
      } catch {
        setError('Copy failed. Select the text and copy it manually.');
        return;
      }
    }
    setCopied(id);
    setTimeout(() => setCopied(''), 1500);
    // Best-effort: wipe clipboard after 30s so sensitive output doesn't linger.
    // Failure is fine — many browsers reject the write without a user gesture.
    setTimeout(() => { void navigator.clipboard?.writeText('').catch(() => void 0); }, 30000);
  }

  async function tryCopyBlobToClipboard(blob: Blob, id?: string) {
    if (!blob || typeof navigator.clipboard?.write !== 'function' || typeof ClipboardItem === 'undefined') {
      return false;
    }
    const mime = blob.type || 'application/octet-stream';
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [mime]: blob }),
      ]);
      if (id) {
        setCopied(id);
        setTimeout(() => setCopied(''), 1500);
      }
      return true;
    } catch {
      return false;
    }
  }

  /* === Share === */
  async function shareContent(msg: ChatMessage) {
    try {
      if (typeof navigator.share !== 'function') {
        setError('Sharing is not supported on this browser/device.');
        return;
      }

      const shareFile = await resolveShareFileFromMessage(msg);
      if (shareFile) {
        const shareData = { files: [shareFile] };
        if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
          setError('This browser/device cannot share this file type.');
          return;
        }

        await navigator.share(shareData);
        return;
      }

      if (msg.dataType === 'F' || msg.dataType === 'A' || !!msg.fileUrl || !!msg.audioUrl) {
        setError('This item should be shared as a file, but the file could not be prepared on this device.');
        return;
      }

      if (typeof navigator.canShare === 'function' && !navigator.canShare({ text: msg.outputFull })) {
        setError('This device cannot share text.');
        return;
      }

      await navigator.share({ text: msg.outputFull });
    } catch (e) {
      const err = e as DOMException;
      if (err.name === 'AbortError') return;
      if (err.name === 'NotAllowedError') {
        setError('File sharing was blocked before the share sheet opened. Open the app in Chrome if this PWA is using an embedded browser.');
        return;
      }
      if (err.name === 'TypeError' || err.name === 'DataError') {
        setError('This file type is not accepted by the system share sheet on this device.');
        return;
      }
      setError('Share failed on this device for this item.');
    }
  }

  /* === ECC === */
  async function confirmEccName() {
    if (!myKeyPair) {
      const pair = await generateEccKeyPair();
      setMyKeyPair(pair);
      setMyPublicKeyB64(await exportPublicKeyB64(pair.publicKey));
    }
    setEccNameConfirmed(true);
  }

  async function refreshEccKey() {
    const pair = await generateEccKeyPair();
    setMyKeyPair(pair);
    setMyPublicKeyB64(await exportPublicKeyB64(pair.publicKey));
  }

  async function rollMnemonic() {
    const words = generateMnemonic();
    try {
      // Derive first, then commit state atomically — never leave the words
      // displayed without a matching keypair if derivation fails.
      const { keyPair, publicKeyB64 } = await deriveKeyPairFromMnemonic(words);
      setMnemonicWords(words);
      setMyKeyPair(keyPair);
      setMyPublicKeyB64(publicKeyB64);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate recovery words.');
    }
  }

  async function openEccQr() {
    if (!myPublicKeyB64.trim()) return;
    if (eccQrUrl && eccQrBlob) {
      setShowEccQr(true);
      return;
    }
    const qrBlob = await generateQrPng(myPublicKeyB64, 8);
    const qrUrl = URL.createObjectURL(qrBlob);
    setEccQrBlob(qrBlob);
    setEccQrUrl(qrUrl);
    setShowEccQr(true);
  }

  function downloadEccQr() {
    if (!eccQrUrl) return;
    const link = document.createElement('a');
    link.href = eccQrUrl;
    link.download = 'paired-public-key-qr.png';
    link.click();
    completeStep2();
  }

  async function shareEccQr() {
    if (!eccQrBlob) return;
    try {
      if (navigator.canShare) {
        const file = new File([eccQrBlob], 'paired-public-key-qr.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          setEccCodeShared(true);
          return;
        }
      }
      if (navigator.share && eccQrUrl) {
        await navigator.share({ title: 'Paired code QR', text: 'Scan this QR for my paired public key.' });
        setEccCodeShared(true);
        return;
      }
      await copyText(myPublicKeyB64, 'ecc-code');
      completeStep2();
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') {
        await copyText(myPublicKeyB64, 'ecc-code');
      }
    }
  }

  async function shareMyKey() {
    try {
      if (navigator.share) {
        await navigator.share({ text: myPublicKeyB64 });
        setEccCodeShared(true);
        return;
      }
      await copyText(myPublicKeyB64, 'ecc-code');
      completeStep2();
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') {
        await copyText(myPublicKeyB64, 'ecc-code');
        completeStep2();
      }
    }
  }

  function completeStep2() {
    if (eccCodeShared || step2Reminder) return;
    setStep2Reminder(true);
    clearTimeout(step2ReminderTimerRef.current);
    step2ReminderTimerRef.current = setTimeout(() => {
      setStep2Reminder(false);
      setEccCodeShared(true);
    }, 3000);
  }

  function showStep3Notice(text: string) {
    clearTimeout(step3NoticeTimerRef.current);
    setStep3Notice({ type: 'error', text });
    step3NoticeTimerRef.current = setTimeout(() => setStep3Notice(null), 5500);
  }

  function flashStep3Input() {
    clearTimeout(step3FlashTimerRef.current);
    setStep3InputFlash(false);
    // Flush then re-enable so animation restarts even on repeat calls
    requestAnimationFrame(() => {
      setStep3InputFlash(true);
      step3FlashTimerRef.current = setTimeout(() => setStep3InputFlash(false), 900);
    });
  }

  async function decodeQrFromImageBlob(blob: Blob): Promise<string> {
    const file = new File([blob], 'qr-image.png', { type: blob.type || 'image/png' });
    const { imageData, width, height } = await loadImageData(file);
    const result = jsQR(imageData.data, width, height);
    if (!result?.data) throw new Error('No QR code found in this image.');
    return normalizeIncoming(result.data).trim();
  }

  function closePastePreview() {
    setPastePreviewOpen(false);
    setPastePreviewBlob(null);
    if (pastePreviewUrl) {
      URL.revokeObjectURL(pastePreviewUrl);
      setPastePreviewUrl('');
    }
  }

  async function handleConfirmPasteImage() {
    try {
      if (!pastePreviewBlob) return;
      const decoded = await decodeQrFromImageBlob(pastePreviewBlob);
      if (!decoded) throw new Error('QR content is empty.');
      setFriendPublicKeyB64(decoded);
      setEccFriendConfirmed(false);
      flashStep3Input();
      closePastePreview();
    } catch (e) {
      showStep3Notice(e instanceof Error ? e.message : 'Could not read QR from image.');
    }
  }

  async function handlePasteFriendCode() {
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const url = URL.createObjectURL(blob);
            setPastePreviewBlob(blob);
            setPastePreviewUrl(url);
            setPastePreviewOpen(true);
            return;
          }
        }
      }
    } catch {
      // Fall through to readText
    }

    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        showStep3Notice('Clipboard is empty. Copy text or an image first.');
        return;
      }
      setFriendPublicKeyB64(normalizeIncoming(text));
      setEccFriendConfirmed(false);
      flashStep3Input();
    } catch {
      showStep3Notice('Clipboard access denied. Use Upload or allow clipboard permissions.');
    }
  }

  function stopCameraScanner() {
    if (cameraScanRafRef.current) {
      cancelAnimationFrame(cameraScanRafRef.current);
      cameraScanRafRef.current = 0;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraScanOpen(false);
  }

  async function startCameraScanner() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        showStep3Notice('Camera API is not available in this browser.');
        return;
      }
      setCameraScanStatus('Point the camera at your friend\'s QR code.');
      setCameraScanOpen(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      cameraStreamRef.current = stream;

      const video = cameraVideoRef.current;
      if (!video) { stopCameraScanner(); return; } // don't leave the camera stream running
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        showStep3Notice('Camera canvas init failed.');
        stopCameraScanner();
        return;
      }

      const scan = () => {
        const now = performance.now();
        if (now - cameraScanLastRef.current > 120 && video.readyState >= 2) {
          cameraScanLastRef.current = now;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(img.data, img.width, img.height);
          if (qr?.data) {
            setFriendPublicKeyB64(normalizeIncoming(qr.data));
            setEccFriendConfirmed(false);
            flashStep3Input();
            stopCameraScanner();
            return;
          }
        }
        cameraScanRafRef.current = requestAnimationFrame(scan);
      };

      cameraScanRafRef.current = requestAnimationFrame(scan);
    } catch {
      showStep3Notice('Unable to access camera. Check permission and try again.');
      stopCameraScanner();
    }
  }

  async function handleUploadFriendQr(file: File | null) {
    if (!file) return;
    try {
      const decoded = await decodeQrFromImageBlob(file);
      if (!decoded) throw new Error('QR content is empty.');
      setFriendPublicKeyB64(decoded);
      setEccFriendConfirmed(false);
      flashStep3Input();
    } catch (e) {
      showStep3Notice(e instanceof Error ? e.message : 'Could not read QR from uploaded image.');
    }
  }

  /* === Resolve secret === */
  async function resolveSecret(): Promise<string> {
    if (securityMode === 'password') {
      const resolved = password.trim();
      if (!resolved) throw new Error('Enter a password.');
      return resolved;
    }
    // ECC mode — check cached secret in IDB first
    if (activeChatId) {
      const cached = await getEccSecret(activeChatId, kek);
      if (cached) return cached;
    }
    // Derive fresh
    if (!myKeyPair) throw new Error('ECC key not ready.');
    const friendKey = friendPublicKeyB64.trim();
    if (!friendKey) throw new Error("Friend's public key required.");
    const { secret } = await deriveSharedSessionSecret(myKeyPair.privateKey, friendKey, myPublicKeyB64);
    // Persist to IDB so future loads don't need the private key
    if (activeChatId) {
      const isEph = chats.some((c) => c.id === activeChatId && c.ephemeral);
      if (!isEph) await saveEccSecret(activeChatId, secret, kek);
    }
    // Discard private key — shared secret is cached in IDB
    setMyKeyPair(null);
    return secret;
  }

  // When Step 3 is confirmed, derive and cache the shared secret immediately
  useEffect(() => {
    if (!eccFriendConfirmed || !myKeyPair || !friendPublicKeyB64.trim() || !myPublicKeyB64) return;
    void (async () => {
      try {
        const chatId = ensureChat(eccSessionName || 'Paired');
        const { secret } = await deriveSharedSessionSecret(myKeyPair.privateKey, friendPublicKeyB64.trim(), myPublicKeyB64);
        const isEph = chats.some((c) => c.id === chatId && c.ephemeral);
        if (!isEph) await saveEccSecret(chatId, secret, kek);
        setMyKeyPair(null);
      } catch { /* handled by resolveSecret on actual use */ }
    })();
  }, [eccFriendConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setShowEccQr(false);
    setEccQrBlob(null);
    if (eccQrUrl) {
      URL.revokeObjectURL(eccQrUrl);
      setEccQrUrl('');
    }
  }, [myPublicKeyB64]);

  useEffect(() => () => {
    if (eccQrUrl) URL.revokeObjectURL(eccQrUrl);
  }, [eccQrUrl]);

  useEffect(() => {
    return () => {
      stopCameraScanner();
      if (pastePreviewUrl) URL.revokeObjectURL(pastePreviewUrl);
    };
  }, [pastePreviewUrl]);

  useEffect(() => () => { clearTimeout(step3NoticeTimerRef.current); clearTimeout(step3FlashTimerRef.current); clearTimeout(step2ReminderTimerRef.current); clearTimeout(passwordPeekTimerRef.current); }, []);

  /* === Recording === */
  function startVolumeMonitor(stream: MediaStream) {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    src.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255;          // 0..1
      const vol = Math.min(1, avg * 2.5);            // amplify
      micBtnRef.current?.style.setProperty('--vol', String(vol));
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
    return ctx;
  }

  const audioCtxRef = useRef<AudioContext | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorderOpts = getVoiceRecorderOptions();
      const recorder = new MediaRecorder(stream, recorderOpts);
      recorderRef.current = recorder;
      audioChunksRef.current = [];
      audioCtxRef.current = startVolumeMonitor(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorderOpts.mimeType || 'audio/webm' });
          const name = `voice-${Date.now()}.webm`;
          setAudioAttachment({ name, dataUrl: await readDataUrl(blob) });
          setAttachedFile(null);
          // Analyze for compression options
          try {
            const audioFile = new File([blob], name, { type: blob.type });
            const analysis = await smartAnalyze(audioFile);
            setFileAnalysis(analysis);
            const def = analysis.options.find(o => o.isDefault);
            setSelectedCompressId(def?.id ?? 'original');
          } catch { /* ignore */ }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not save the recording.');
        } finally {
          // Always release the mic, even if reading the blob failed.
          stream.getTracks().forEach((t) => t.stop());
        }
      };
      recorder.start();
      setRecording(true);
      setRecordingElapsed(0);
      clearInterval(recordingTimerRef.current);
      const t0 = Date.now();
      recordingTimerRef.current = setInterval(() => setRecordingElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
      setError('');
    } catch { setError('Microphone permission required.'); }
  }

  function stopRecording() {
    cancelAnimationFrame(rafIdRef.current);
    clearInterval(recordingTimerRef.current);
    micBtnRef.current?.style.setProperty('--vol', '0');
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    if (recorderRef.current && recording) { recorderRef.current.stop(); setRecording(false); }
  }

  const onFileSelected = useCallback(async (file: File | null) => {
    const requestId = ++fileSelectionRequestRef.current;
    const isCurrentRequest = () => fileSelectionRequestRef.current === requestId;

    setAudioAttachment(null);
    setFileAnalysis(null);
    setSelectedCompressId('original');
    if (!file) { setAttachedFile(null); setDetectedStegFile(false); return; }

    setAttachedFile(file);

    const fileName = file.name.toLowerCase();
    const probableCipherMedia = isKnownCipherMediaFileName(fileName);
    setDetectedStegFile(probableCipherMedia);

    // .ctx files are Cipher encrypted — skip analysis, will decrypt on send
    if (fileName.endsWith('.ctx')) return;

    if (!probableCipherMedia) {
      const extracted = await extractCipherPayloadFromMedia(file);
      if (!isCurrentRequest()) return;
      if (extracted) {
        setDetectedStegFile(true);
        return;
      }
    }

    if (probableCipherMedia || !isCurrentRequest()) return;

    try {
      const analysis = await smartAnalyze(file);
      if (!isCurrentRequest()) return;
      setFileAnalysis(analysis);
      const def = analysis.options.find(o => o.isDefault);
      setSelectedCompressId(def?.id ?? 'original');
    } catch {
      if (!isCurrentRequest()) return;
      setFileAnalysis(null);
    }
  }, []);

  const requestFileAttachment = useCallback(async (file: File | null) => {
    if (!file) return;
    const nextFile = normalizeClipboardFile(file);
    if (detectedStegFile) {
      setPendingReplacementFile(nextFile);
      setReplaceStegConfirm('file');
      return;
    }
    setPendingReplacementFile(null);
    await onFileSelected(nextFile);
  }, [detectedStegFile, onFileSelected]);

  useEffect(() => {
    if (!appUnlocked) return;

    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has('share-target')) return;

    let cancelled = false;
    const cleanShareTargetUrl = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('share-target');
      const query = nextUrl.searchParams.toString();
      window.history.replaceState({}, '', `${nextUrl.pathname}${query ? `?${query}` : ''}${nextUrl.hash}`);
    };

    void (async () => {
      try {
        const payload = await consumePendingShare();
        if (cancelled) return;

        cleanShareTargetUrl();
        if (!payload) return;

        const textParts = [payload.title.trim(), payload.text.trim(), payload.url.trim()].filter(Boolean);
        const nextText = textParts.join('\n\n');
        const firstFile = payload.files[0]
          ? new File(
              [payload.files[0].blob],
              payload.files[0].name || 'shared-file',
              {
                type: payload.files[0].type || payload.files[0].blob.type || 'application/octet-stream',
                lastModified: payload.files[0].lastModified || Date.now(),
              },
            )
          : null;

        setError('');
        setInputText(nextText);
        setCarrierFile(null);
        setCarrierType(null);
        setDetectedStegFile(false);
        setReplaceStegConfirm(null);

        if (firstFile) {
          await onFileSelected(firstFile);
        } else {
          setAttachedFile(null);
          setAudioAttachment(null);
          setFileAnalysis(null);
          setSelectedCompressId('original');
        }

        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) return;
          el.style.height = 'auto';
          el.style.height = Math.min(el.scrollHeight, 200) + 'px';
        });

        if (!firstFile && nextText) {
          showSuccessToast('Shared text loaded.');
        }
      } catch {
        if (!cancelled) {
          cleanShareTargetUrl();
          setError('Incoming shared data could not be loaded.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appUnlocked, onFileSelected, showSuccessToast]);

  /* === Clear === */
  function clearAll() {
    setInputText('');
    setAttachedFile(null);
    setAudioAttachment(null);
    setFileAnalysis(null);
    setSelectedCompressId('original');
    setError('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
  }

  function cancelCompression() {
    compressCancelRef.current?.abort();
    compressCancelRef.current = null;
    compressTimingRef.current.delete(activeChatIdRef.current);
    setCompressingChats(prev => { const n = new Set(prev); n.delete(activeChatIdRef.current); return n; });
    setVideoProgress(0);
    setCompressEta(0);
    setCompressElapsed(0);
  }

  /* === Auto-resize textarea === */
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  function handleComposerPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const clipboardItems = Array.from(e.clipboardData?.items ?? []) as DataTransferItem[];
    const fileItem = clipboardItems.find((item) => item.kind === 'file');
    const pastedFile = fileItem?.getAsFile() || e.clipboardData?.files?.[0] || null;
    if (!pastedFile) return;
    e.preventDefault();
    void requestFileAttachment(pastedFile);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!busy && !mediaCompressing && (inputText || attachedFile || audioAttachment)) {
        void handleProcess();
      }
    }
  }

  function clearSendHoldTimer() {
    if (sendHoldTimerRef.current) {
      clearTimeout(sendHoldTimerRef.current);
      sendHoldTimerRef.current = undefined;
    }
  }

  function handleSendHoldStart() {
    if (sendButtonDisabled) return;
    sendHoldTriggeredRef.current = false;
    clearSendHoldTimer();
    sendHoldTimerRef.current = setTimeout(() => {
      sendHoldTriggeredRef.current = true;
      setShowSettings(false);
      setShowSendActionMenu(true);
    }, SEND_HOLD_DELAY_MS);
  }

  function handleSendHoldEnd() {
    clearSendHoldTimer();
  }

  function handleSendButtonClick() {
    if (sendHoldTriggeredRef.current) {
      sendHoldTriggeredRef.current = false;
      return;
    }
    if (showSendActionMenu) {
      setShowSendActionMenu(false);
      return;
    }
    void handleProcess();
  }

  function handleForcedSend(mode: 'encrypt' | 'decrypt') {
    clearSendHoldTimer();
    sendHoldTriggeredRef.current = false;
    setShowSendActionMenu(false);
    void handleProcess(mode);
  }

  /* === Process === */

  /** Wrapper: decrypt with a clear error if the password is wrong */
  async function tryDecrypt(data: string, secret: string) {
    try {
      return await decryptData(data, secret);
    } catch (e) {
      // AES-GCM OperationError = wrong password / corrupted ciphertext
      if (e instanceof DOMException && e.name === 'OperationError') {
        throw new Error('Decryption failed — wrong password or corrupted data.');
      }
      throw e;
    }
  }

  async function handleProcess(forcedDirection?: 'encrypt' | 'decrypt') {
    // Capture the chat this process belongs to (may be updated after ensureChat)
    let procChatId = activeChatId;
    const activeDirectionOverride = forcedDirection ?? directionOverride;
    const markBusy = (id: string) => setBusyChats(s => { const n = new Set(s); n.add(id); return n; });
    const unmarkBusy = (id: string) => setBusyChats(s => { const n = new Set(s); n.delete(id); return n; });
    const markCompress = (id: string) => setCompressingChats(s => { const n = new Set(s); n.add(id); return n; });
    const unmarkCompress = (id: string) => setCompressingChats(s => { const n = new Set(s); n.delete(id); return n; });
    markBusy(procChatId);
    setError('');

    try {
      const secret = await resolveSecret();
      let modeType: DataType = 'T';
      let rawPayload = inputText;
      let successMsg = '';

      if (audioAttachment) {
        modeType = 'A';
        rawPayload = audioAttachment.dataUrl;
        // Apply audio compression if selected
        if (fileAnalysis?.kind === 'audio' && selectedCompressId !== 'original') {
          try {
            const ac = new AbortController();
            compressCancelRef.current = ac;
            const audioEta = fileAnalysis.duration ?? 0;
            compressTimingRef.current.set(procChatId, { startedAt: Date.now(), eta: audioEta });
            markCompress(procChatId);
            setVideoProgress(0);
            setCompressEta(audioEta);
            const resp = await fetch(audioAttachment.dataUrl);
            const origBlob = await resp.blob();
            const audioFile = new File([origBlob], audioAttachment.name, { type: origBlob.type });
            const result = await applyCompression(audioFile, fileAnalysis, selectedCompressId, (p) => { if (!ac.signal.aborted) setVideoProgress(p); }, ac.signal);
            rawPayload = await readDataUrl(result.blob);
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') { return; }
            const reason = e instanceof Error ? e.message : 'Unknown error.';
            throw new Error(`Audio compression failed: ${reason}`);
          } finally {
            compressCancelRef.current = null;
            compressTimingRef.current.delete(procChatId);
            unmarkCompress(procChatId);
            setVideoProgress(0);
            setCompressEta(0);
          }
        }
      }

      if (attachedFile) {
        const extractedStegText = await extractCipherPayloadFromMedia(attachedFile);

        if (extractedStegText && activeDirectionOverride !== 'encrypt') {
          // Decrypt data extracted from steg carrier
          const dec = await tryDecrypt(extractedStegText, secret);
          let audioDataUrl = '';
          let fileUrl = '';
          let fileName = '';
          if (dec.type === 'A') { audioDataUrl = dec.data; }
          else if (dec.type === 'F') {
            const parsed = parseDecryptedFilePayload(dec.data);
            if (!parsed) throw new Error('Decrypted file payload is corrupted.');
            fileName = parsed.fileName;
            fileUrl = parsed.fileUrl;
            await tryCopyBlobToClipboard(buildNamedFile(dataUrlToBlob(fileUrl), fileName));
          }
          else if (dec.data.length <= AUTO_COPY_LIMIT) { await copyText(dec.data); }

          const chatId = ensureChat('[steg] ' + attachedFile.name);
          if (!procChatId) { unmarkBusy(procChatId); procChatId = chatId; markBusy(procChatId); }
          if (securityMode === 'password') {
            setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, lockedPassword: true } : c));
            if (!chats.some((c) => c.id === chatId && c.ephemeral)) void saveChatSecret(chatId, secret, kek);
          }
          addMessageToChat(chatId, withShareFile({
            id: crypto.randomUUID(),
            inputPreview: `🔍 ${attachedFile.name} (media steg)`,
            outputPreview: dec.type === 'A' ? 'Audio decrypted' : dec.type === 'F' ? `File decrypted: ${fileName}` : dec.data.slice(0, 120),
            outputFull: dec.data,
            audioUrl: audioDataUrl || undefined,
            fileUrl: fileUrl || undefined,
            fileName: fileName || undefined,
            type: 'decrypt',
            dataType: dec.type,
            timestamp: Date.now(),
          }));
          setInputText(''); setAttachedFile(null); setAudioAttachment(null); setFileAnalysis(null); setSelectedCompressId('original');
          return;
        }

        const normalizedAttachmentText = activeDirectionOverride !== 'encrypt'
          ? await tryReadCiphertextAttachment(attachedFile)
          : null;

        if (normalizedAttachmentText) {
          const dec = await tryDecrypt(normalizedAttachmentText, secret);
          let audioDataUrl = '';
          let fileUrl = '';
          let fileName = '';
          if (dec.type === 'A') { audioDataUrl = dec.data; }
          else if (dec.type === 'F') {
            const parsed = parseDecryptedFilePayload(dec.data);
            if (!parsed) throw new Error('Decrypted file payload is corrupted.');
            fileName = parsed.fileName;
            fileUrl = parsed.fileUrl;
            await tryCopyBlobToClipboard(buildNamedFile(dataUrlToBlob(fileUrl), fileName));
          }

          const chatId = ensureChat('[file] ' + attachedFile.name);
          if (!procChatId) { unmarkBusy(procChatId); procChatId = chatId; markBusy(procChatId); }
          if (securityMode === 'password') {
            setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, lockedPassword: true } : c));
            if (!chats.some((c) => c.id === chatId && c.ephemeral)) void saveChatSecret(chatId, secret, kek);
          }
          addMessageToChat(chatId, withShareFile({
            id: crypto.randomUUID(),
            inputPreview: attachedFile.name,
            outputPreview: dec.type === 'A' ? 'Audio decrypted' : dec.type === 'F' ? `File decrypted: ${fileName}` : dec.data.slice(0, 120),
            outputFull: dec.data,
            audioUrl: audioDataUrl || undefined,
            fileUrl: fileUrl || undefined,
            fileName: fileName || undefined,
            type: 'decrypt',
            dataType: dec.type,
            timestamp: Date.now(),
          }));
          setInputText(''); setAttachedFile(null); setAudioAttachment(null); setFileAnalysis(null); setSelectedCompressId('original');
          return;
        }

        // Guard: if auto-detection flagged this as an encrypted file but runtime extraction
        // failed, do NOT silently encrypt the carrier. Unless user forced encrypt via override.
        if (detectedStegFile && activeDirectionOverride !== 'encrypt') {
          throw new Error('Encrypted data was detected in this file but could not be extracted. The file may be corrupted. To encrypt it anyway, switch to Encrypt mode using the direction chip (Advanced mode).');
        }

        if (activeDirectionOverride === 'decrypt') {
          throw new Error('Cannot decrypt — the file does not contain recognizable encrypted data.');
        }

        // Apply smart compression if option selected
        let fileToEncrypt: File | Blob = attachedFile;
        let encName = attachedFile.name;
        if (fileAnalysis && selectedCompressId !== 'original') {
          try {
            const ac = new AbortController();
            compressCancelRef.current = ac;
            const isMedia = fileAnalysis.kind === 'video' || fileAnalysis.kind === 'audio';
            const fileEta = isMedia ? (fileAnalysis.duration ?? 0) : 0;
            compressTimingRef.current.set(procChatId, { startedAt: Date.now(), eta: fileEta });
            markCompress(procChatId);
            setVideoProgress(0);
            setCompressEta(fileEta);
            const result = await applyCompression(
              attachedFile, fileAnalysis, selectedCompressId,
              isMedia ? (p) => { if (!ac.signal.aborted) setVideoProgress(p); } : undefined,
              ac.signal,
            );
            fileToEncrypt = result.blob;
            encName = result.name;
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') { return; }
            const label = fileAnalysis.kind === 'video'
              ? 'Video'
              : fileAnalysis.kind === 'audio'
                ? 'Audio'
                : fileAnalysis.kind === 'image'
                  ? 'Image'
                  : 'File';
            const reason = e instanceof Error ? e.message : 'Unknown error.';
            throw new Error(`${label} compression failed: ${reason}`);
          } finally {
            compressCancelRef.current = null;
            compressTimingRef.current.delete(procChatId);
            unmarkCompress(procChatId);
            setVideoProgress(0);
            setCompressEta(0);
          }
        }

        const dataUrl = await readDataUrl(fileToEncrypt);
        rawPayload = `${encName}::${dataUrl}`;
        modeType = 'F';
      }

      // Create thumbnail data URL for original image (for encrypt preview)
      let thumbUrl: string | undefined;
      if (attachedFile && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(attachedFile.name)) {
        try {
          const bmp = await createImageBitmap(attachedFile);
          const MAX = 200;
          const scale = Math.min(MAX / bmp.width, MAX / bmp.height, 1);
          const w = Math.round(bmp.width * scale);
          const h = Math.round(bmp.height * scale);
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d')!;
          ctx.drawImage(bmp, 0, 0, w, h);
          bmp.close();
          thumbUrl = cv.toDataURL('image/jpeg', 0.7);
        } catch { /* skip thumbnail */ }
      }

      const normalized = normalizeIncoming(rawPayload);
      const chatId = ensureChat(rawPayload.slice(0, 60));
      if (!procChatId) { unmarkBusy(procChatId); procChatId = chatId; markBusy(procChatId); }

      // Lock password after first use & persist to IDB
      if (securityMode === 'password') {
        setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, lockedPassword: true } : c));
        if (!chats.some((c) => c.id === chatId && c.ephemeral)) void saveChatSecret(chatId, secret, kek);
      }

      if (activeDirectionOverride !== 'encrypt' && isCipherEnvelope(normalized)) {
        const dec = await tryDecrypt(normalized, secret);
        let audioDataUrl = '';
        let decFileUrl = '';
        let decFileName = '';
        if (dec.type === 'A') { audioDataUrl = dec.data; }
        else if (dec.type === 'F') {
          const parsed = parseDecryptedFilePayload(dec.data);
          if (!parsed) throw new Error('Decrypted file payload is corrupted.');
          decFileName = parsed.fileName;
          decFileUrl = parsed.fileUrl;
          await tryCopyBlobToClipboard(buildNamedFile(dataUrlToBlob(decFileUrl), decFileName));
        }
        else if (dec.data.length <= AUTO_COPY_LIMIT) { await copyText(dec.data); }

        successMsg = dec.type === 'A' ? 'Audio decrypted' : dec.type === 'F' ? 'File decrypted' : dec.data.length > AUTO_COPY_LIMIT ? 'Decrypted (use Download)' : 'Decrypted & copied';

        addMessageToChat(chatId, withShareFile({
          id: crypto.randomUUID(),
          inputPreview: rawPayload.slice(0, 120),
          outputPreview: dec.type === 'A' ? 'Audio decrypted' : dec.type === 'F' ? `File decrypted: ${decFileName}` : dec.data.slice(0, 120),
          outputFull: dec.data,
          audioUrl: audioDataUrl || undefined,
          fileUrl: decFileUrl || undefined,
          fileName: decFileName || undefined,
          type: 'decrypt',
          dataType: dec.type,
          timestamp: Date.now(),
        }));
      } else {
        // Guard: user forced decrypt but content doesn't look like ciphertext
        if (activeDirectionOverride === 'decrypt') {
          throw new Error('Cannot decrypt — the input does not contain recognizable encrypted data (CT1|/CT2|/CT3|/CT4| prefix missing).');
        }
        // Auto-select random cover text if steg mode with no cover chosen
        let effectiveDecoy = decoyText;
        if (obfuscationMode === 'steg' && !carrierFile && !effectiveDecoy.trim() && allCoverTexts.length > 0) {
          // File steg requires a carrier — text cover auto-fill only for text input
          if (hasFileAttachment) {
            throw new Error('No carrier selected — tap the 🖼 or 🔊 button to choose a PNG image or WAV audio to hide your file in, then try again.');
          }
          const idx = Math.floor(Math.random() * allCoverTexts.length);
          effectiveDecoy = allCoverTexts[idx].text;
          setStegIndex(idx);
          setDecoyText(effectiveDecoy);
          setSelectedCoverCategory(allCoverTexts[idx].category);
        }

        const encrypted = await encryptData(rawPayload, secret, modeType, {
          compressionEnabled: hasCompression,
          compressionLevel,
        });
        const obfuscated = applyObfuscation(encrypted, obfuscationMode, effectiveDecoy);

        let encFileUrl: string | undefined;
        let encFileName: string | undefined;
        let encShareFile: File | undefined;
        let storedEncryptedPayload: string | undefined;

        // Media steganography: embed raw encrypted payload into image/audio carrier
        // Use `encrypted` directly (not `obfuscated`) — text-steg layer is redundant
        // inside a binary carrier and wastes capacity with cover text overhead
        if (carrierFile && carrierType && obfuscationMode === 'steg') {
          const payloadBytes = new TextEncoder().encode(encrypted);
          if (carrierType === 'image') {
            const { imageData } = await loadImageData(carrierFile);
            const cap = imageCapacity(imageData.width, imageData.height);
            if (payloadBytes.length > cap) {
              throw new Error(`Message too large for this image (needs ${Math.ceil(payloadBytes.length / 1024)} KB, image holds ${Math.floor(cap / 1024)} KB). Try a higher-resolution PNG, or shorten your message.`);
            }
            encodeIntoImage(imageData, payloadBytes);
            const pngBlob = await imageDataToPng(imageData);
            encFileName = `steg-${carrierFile.name.replace(/\.[^.]+$/, '')}.png`;
            encShareFile = buildNamedFile(pngBlob, encFileName);
          } else {
            const audioBuffer = await decodeAudioFile(carrierFile);
            const samples = audioBuffer.getChannelData(0);
            const cap = audioCapacity(samples.length);
            if (payloadBytes.length > cap) {
              throw new Error(`Message too large for this audio (needs ${Math.ceil(payloadBytes.length / 1024)} KB, audio holds ${Math.floor(cap / 1024)} KB). Try a longer WAV file, or shorten your message.`);
            }
            encodeIntoAudio(samples, payloadBytes);
            const wavBlob = audioBufferToWav(audioBuffer);
            encFileName = `steg-${carrierFile.name.replace(/\.[^.]+$/, '')}.wav`;
            encShareFile = buildNamedFile(wavBlob, encFileName);
          }
          setCarrierFile(null); setCarrierType(null);
        } else if (obfuscationMode === 'noise') {
          // Package encrypted data as noise WAV
          const wavBlob = encryptedToWav(encrypted);
          encFileName = `cipher-${Date.now()}.wav`;
          encShareFile = buildNamedFile(wavBlob, encFileName);
        } else if (obfuscationMode === 'snow') {
          // Package encrypted data as snow PNG
          const snowBlob = await encryptedToPngBlob(encrypted);
          encFileName = `cipher-${Date.now()}.png`;
          encShareFile = buildNamedFile(snowBlob, encFileName);
        } else if (modeType === 'F') {
          encFileName = `${attachedFile?.name || 'payload'}.ctx`;
          encShareFile = buildNamedFile(new Blob([obfuscated], { type: 'application/octet-stream' }), encFileName);
        } else if (obfuscationMode === 'qr') {
          // Generate QR code image
          const textBytes = new TextEncoder().encode(obfuscated);
          if (textBytes.length > QR_MAX_BYTES) {
            throw new Error(`Encrypted output (${textBytes.length} B) exceeds QR capacity (${QR_MAX_BYTES} B). Use shorter text or a different obfuscation mode.`);
          }
          const qrBlob = await generateQrPng(obfuscated);
          encFileName = getQrShareFileName();
          encShareFile = buildNamedFile(qrBlob, encFileName);
        } else {
          if (obfuscated.length <= AUTO_COPY_LIMIT) await copyText(obfuscated);
        }

        if (encShareFile) {
          encFileUrl = createMessageFileUrl(encShareFile, 'encrypt', encFileName);
          await tryCopyBlobToClipboard(encShareFile);
          storedEncryptedPayload = encFileName?.toLowerCase().endsWith('.ctx')
            ? obfuscated
            : await readDataUrl(encShareFile);
        }

        const wasCopied = !encFileName && obfuscated.length <= AUTO_COPY_LIMIT;
        successMsg = encFileName
          ? (obfuscationMode === 'qr' ? 'QR code saved'
            : obfuscationMode === 'noise' ? 'Noise file saved'
            : obfuscationMode === 'snow' ? 'Snow file saved'
            : 'File saved')
          : wasCopied
            ? (obfuscationMode === 'steg' ? 'Hidden in cover text & copied' : 'Encrypted & copied')
            : 'Encrypted (use Download)';

        addMessageToChat(chatId, withShareFile({
          id: crypto.randomUUID(),
          inputPreview: modeType === 'F' ? (attachedFile?.name || 'file') : modeType === 'A' ? (audioAttachment?.name || 'audio') : rawPayload.slice(0, 120),
          outputPreview: encFileName ? `[${encFileName.endsWith('.png') ? 'Image' : encFileName.endsWith('.wav') ? 'Audio' : 'File'}] ${encFileName}` : obfuscationMode === 'qr' ? '[QR Code]' : obfuscated.slice(0, 120),
          outputFull: encFileName && storedEncryptedPayload ? `${encFileName}::${storedEncryptedPayload}` : encFileName ? `Encrypted: ${encFileName}` : obfuscated,
          fileUrl: encFileUrl,
          fileName: encFileName,
          thumbUrl,
          type: 'encrypt',
          dataType: encShareFile ? 'F' : modeType,
          timestamp: Date.now(),
        }, encShareFile));
      }

      // Clear input only if user is still in the same chat
      if (activeChatIdRef.current === procChatId) {
        setInputText(''); setAttachedFile(null); setAudioAttachment(null); setFileAnalysis(null); setSelectedCompressId('original');
        if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
      }
    } catch (e) {
      // Only show error if user is still in the same chat
      if (activeChatIdRef.current === procChatId) {
        setError(e instanceof Error ? e.message : 'Operation failed.');
      }
    } finally {
      unmarkBusy(procChatId);
    }
  }

  /* ===== Close lightbox on Escape ===== */
  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(''); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxUrl]);

  /* ===== Global Escape handler for modals =====
   * Closes the topmost open modal/dialog. Priority: innermost (most
   * transient) first so a stack of dialogs unwinds correctly.
   * Lightbox is handled separately above. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (cameraScanOpen)       { stopCameraScanner();          return; }
      if (pastePreviewUrl)      { closePastePreview();          return; }
      if (pendingDeleteChatId)  { setPendingDeleteChatId('');   return; }
      if (eraseStep)            { setEraseStep(0);              return; }
      if (castleInfoChatId)     { setCastleInfoChatId('');      return; }
      if (showRemoveMp)         { setShowRemoveMp(false); setShowMpPw(false); return; }
      if (showChangeMp)         { setShowChangeMp(false); setShowMpPw(false); return; }
      if (showLockSetup)        { setShowLockSetup(false); setShowMpPw(false); return; }
      if (showLockWarning)      { setShowLockWarning(false);    return; }
      if (passwordPromptOpen)   { setPasswordPromptOpen(false); return; }
      if (settingsPanelOpen)    { closeSettingsPanel();         return; }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    cameraScanOpen, pastePreviewUrl, pendingDeleteChatId, eraseStep,
    castleInfoChatId, showRemoveMp, showChangeMp, showLockSetup,
    showLockWarning, passwordPromptOpen, settingsPanelOpen,
  ]);

  /* ===== Auto-lock timer ===== */
  useEffect(() => {
    if (!appUnlocked || !masterPasswordExists) return;
    if (autoLockMinutes <= 0) {
      void clearPersistedUnlockSession();
      return;
    }

    const expireAfterMs = autoLockMinutes * 60_000;
    const resetActivity = () => {
      activityRef.current = Date.now();
      void persistActiveUnlockSession(kek, activityRef.current);
    };
    const handlePageHide = () => {
      void persistActiveUnlockSession(kek, activityRef.current, true);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handlePageHide();
        return;
      }
      if (Date.now() - activityRef.current > expireAfterMs) {
        lockApp();
        return;
      }
      resetActivity();
      void persistActiveUnlockSession(kek, activityRef.current, true);
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
    events.forEach((e) => document.addEventListener(e, resetActivity, { passive: true }));
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void persistActiveUnlockSession(kek, activityRef.current, true);
    const interval = setInterval(() => {
      if (Date.now() - activityRef.current > expireAfterMs) {
        lockApp();
        return;
      }
      void persistActiveUnlockSession(kek, activityRef.current);
    }, 10_000);
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetActivity));
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [appUnlocked, autoLockMinutes, kek, masterPasswordExists]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(AUTO_LOCK_KEY, String(autoLockMinutes));
    if (autoLockMinutes <= 0) {
      void clearPersistedUnlockSession();
      return;
    }
    if (appUnlocked && kek) {
      void persistActiveUnlockSession(kek, activityRef.current, true);
    }
  }, [appUnlocked, autoLockMinutes, kek]);

  /* ===== Password immutability check ===== */
  const isPasswordLocked = activeChat?.lockedPassword === true;
  const chatHasHistory = (activeChat?.messageCount || 0) > 0;

  /* ===== Render ===== */
  const pairedReady = eccNameConfirmed && !!eccSessionName.trim() && eccCodeShared && eccFriendConfirmed && !!friendPublicKeyB64.trim();

  /* --- Lock Screen (only when master password exists and app is locked) --- */
  if (masterPasswordExists && unlockRestorePending) {
    return (
      <div className="lock-screen">
        <div className="lock-screen-card auth-dialog-card" role="status" aria-live="polite" aria-label={t('appLock.restoring')}>
          <div className="lock-screen-icon"><Lock size={28} /></div>
          <h1 className="lock-screen-title">{t('appLock.title')}</h1>
          <p className="lock-screen-desc">{t('appLock.restoring')}</p>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!appUnlocked && masterPasswordExists) {
    return (
      <div className="lock-screen">
        {themeId === 'retro' && (
          <>
            <div className="retro-marquee">
              <span className="retro-marquee-text">
                ★ ★ ★ Welcome to Cipher!!! ★ ★ ★ TOP SECRET AREA — AUTHORIZED PERSONNEL ONLY ★ ★ ★ Enter the password or face the consequences!!! ★ ★ ★
              </span>
            </div>
            <div className="retro-fire-bar" />
          </>
        )}
        <div className="lock-screen-card auth-dialog-card" role="dialog" aria-modal="true" aria-label={t('appLock.setAppPassword')}>
          <div className="lock-screen-icon"><Lock size={28} /></div>
          <h1 className="lock-screen-title">{t('appLock.title')}</h1>
          <p className="lock-screen-desc">{t('appLock.enterToUnlock')}</p>
          <input
            className="lock-screen-input"
            type="password"
            placeholder={t('password.appPassword')}
            value={lockPassword}
            onChange={(e) => setLockPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleUnlockMasterPassword()}
            autoFocus={!isMobile}
          />
          <button className="lock-screen-btn" onClick={() => void handleUnlockMasterPassword()} disabled={lockBusy}>
            {lockBusy ? (
              <span className="busy-btn-content"><span className="spinner" aria-hidden="true" />{t('appLock.unlocking')}</span>
            ) : t('appLock.unlock')}
          </button>
          {lockError && <p className="lock-screen-error">{lockError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Password prompt modal */}
      {passwordPromptOpen && (
        <div className="paste-preview-overlay auth-dialog-overlay" onClick={() => setPasswordPromptOpen(false)}>
          <div className="paste-preview-modal auth-dialog-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('appLock.modalUnlockChatLabel')}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t('appLock.enterPassword')}</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
              {t('appLock.chatPwNotInMem')}
            </p>
            <input
              type="password"
              className="lock-screen-input"
              placeholder={t('password.placeholder')}
              value={promptPassword}
              onChange={(e) => setPromptPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordPromptConfirm()}
              autoFocus={!isMobile}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="settings-link-btn" onClick={() => setPasswordPromptOpen(false)}>{t('common.cancel')}</button>
              <button className="lock-screen-btn" style={{ width: 'auto', padding: '8px 20px' }} onClick={handlePasswordPromptConfirm}>
                {t('appLock.unlockChat')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock warning dialog */}
      {showLockWarning && (
        <div className="paste-preview-overlay auth-dialog-overlay" onClick={() => setShowLockWarning(false)}>
          <div className="paste-preview-modal auth-dialog-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('appLock.modalWarningLabel')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('appLock.warningTitleEmoji')}</h3>
              <button className="icon-btn" onClick={() => setShowLockWarning(false)} aria-label={t('common.close')}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '12px 0 16px', lineHeight: 1.5 }}>
              {t('appLock.warningBody')}
              <br /><strong>{t('appLock.warningBodyStrong')}</strong>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="lock-screen-btn" style={{ width: 'auto', padding: '8px 20px' }} onClick={handleLockWarningAccept}>
                {t('appLock.iUnderstand')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock setup dialog (after warning acknowledged) */}
      {showLockSetup && (
        <div className="paste-preview-overlay auth-dialog-overlay" onClick={() => { setShowLockSetup(false); setShowMpPw(false); }}>
          <div className="paste-preview-modal auth-dialog-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('appLock.modalSetLabel')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('appLock.setAppPassword')}</h3>
              <button className="icon-btn" onClick={() => { setShowLockSetup(false); setShowMpPw(false); }} aria-label={t('common.close')}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '8px 0 12px' }}>
              {t('appLock.setupExplain')}
            </p>
            <div className="mp-input-wrap">
              <input
                className="lock-screen-input"
                type={showMpPw ? 'text' : 'password'}
                placeholder={t('password.appPassword')}
                value={lockPassword}
                onChange={(e) => setLockPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lockConfirm && void handleSetupMasterPassword()}
                autoFocus={!isMobile}
              />
              <button type="button" className="mp-eye-btn" onClick={() => setShowMpPw(v => !v)} tabIndex={-1} aria-label={showMpPw ? t('password.hideAria') : t('password.show')}>
                {showMpPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="mp-input-wrap">
              <input
                className="lock-screen-input"
                type={showMpPw ? 'text' : 'password'}
                placeholder={t('password.confirmPassword')}
                value={lockConfirm}
                onChange={(e) => setLockConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSetupMasterPassword()}
              />
            </div>
            <PasswordStrengthBar password={lockPassword} />
            {lockError && <p className="lock-screen-error" style={{ margin: '4px 0' }}>{lockError}</p>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="settings-link-btn" onClick={() => { setShowLockSetup(false); setShowMpPw(false); }}>{t('common.cancel')}</button>
              <button className="lock-screen-btn" style={{ width: 'auto', padding: '8px 20px' }} onClick={() => void handleSetupMasterPassword()} disabled={lockBusy}>
                {lockBusy ? (
                  <span className="busy-btn-content"><span className="spinner" aria-hidden="true" />{t('appLock.settingUp')}</span>
                ) : t('appLock.setPassword')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change master password dialog */}
      {showChangeMp && (
        <div className="paste-preview-overlay auth-dialog-overlay" onClick={() => { setShowChangeMp(false); setShowMpPw(false); }}>
          <div className="paste-preview-modal auth-dialog-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('appLock.modalChangeLabel')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('appLock.changeAppPassword')}</h3>
              <button className="icon-btn" onClick={() => { setShowChangeMp(false); setShowMpPw(false); }} aria-label={t('common.close')}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '8px 0 12px' }}>
              {t('appLock.changeExplain')}
            </p>
            <div className="mp-input-wrap">
              <input
                className="lock-screen-input"
                type={showMpPw ? 'text' : 'password'}
                placeholder={t('password.currentPassword')}
                value={mpOldPw}
                onChange={(e) => setMpOldPw(e.target.value)}
                autoFocus={!isMobile}
              />
              <button type="button" className="mp-eye-btn" onClick={() => setShowMpPw(v => !v)} tabIndex={-1} aria-label={showMpPw ? t('password.hideAria') : t('password.show')}>
                {showMpPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="mp-input-wrap">
              <input
                className="lock-screen-input"
                type={showMpPw ? 'text' : 'password'}
                placeholder={t('password.newPassword')}
                value={mpNewPw}
                onChange={(e) => setMpNewPw(e.target.value)}
              />
            </div>
            <PasswordStrengthBar password={mpNewPw} />
            <div className="mp-input-wrap">
              <input
                className="lock-screen-input"
                type={showMpPw ? 'text' : 'password'}
                placeholder={t('password.confirmNewPassword')}
                value={mpNewConfirm}
                onChange={(e) => setMpNewConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setMpActionBusy(true); setMpActionError('');
                    void handleChangeMasterPassword(mpOldPw, mpNewPw, mpNewConfirm).then((err) => {
                      if (err) setMpActionError(err);
                      else { setShowChangeMp(false); setShowMpPw(false); showSuccessToast(t('appLock.changedToast')); }
                    }).finally(() => setMpActionBusy(false));
                  }
                }}
              />
            </div>
            {mpActionError && <p className="lock-screen-error" style={{ margin: '4px 0' }}>{mpActionError}</p>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="settings-link-btn" onClick={() => { setShowChangeMp(false); setShowMpPw(false); }}>{t('common.cancel')}</button>
              <button
                className="lock-screen-btn" style={{ width: 'auto', padding: '8px 20px' }}
                disabled={mpActionBusy}
                onClick={() => {
                  setMpActionBusy(true); setMpActionError('');
                  void handleChangeMasterPassword(mpOldPw, mpNewPw, mpNewConfirm).then((err) => {
                    if (err) setMpActionError(err);
                    else { setShowChangeMp(false); setShowMpPw(false); showSuccessToast(t('appLock.changedToast')); }
                  }).finally(() => setMpActionBusy(false));
                }}
              >
                {mpActionBusy ? (
                  <span className="busy-btn-content"><span className="spinner" aria-hidden="true" />{t('appLock.changingPassword')}</span>
                ) : t('common.change')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove master password dialog */}
      {showRemoveMp && (
        <div className="paste-preview-overlay auth-dialog-overlay" onClick={() => { setShowRemoveMp(false); setShowMpPw(false); }}>
          <div className="paste-preview-modal auth-dialog-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('appLock.modalRemoveLabel')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('appLock.removeAppPassword')}</h3>
              <button className="icon-btn" onClick={() => { setShowRemoveMp(false); setShowMpPw(false); }} aria-label={t('common.close')}>
                <X size={16} />
              </button>
            </div>
            <div className="mp-warning-card">
              <AlertTriangle size={14} />
              <span>{t('appLock.removeWarnPrefix')} <strong>{t('appLock.removeWarnEmphasis')}</strong> {t('appLock.removeWarnSuffix')}</span>
            </div>
            <div className="mp-input-wrap">
              <input
                className="lock-screen-input"
                type={showMpPw ? 'text' : 'password'}
                placeholder={t('password.currentPassword')}
                value={mpOldPw}
                onChange={(e) => setMpOldPw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setMpActionBusy(true); setMpActionError('');
                    void handleRemoveMasterPassword(mpOldPw).then((err) => {
                      if (err) setMpActionError(err);
                      else { setShowRemoveMp(false); setShowMpPw(false); showSuccessToast(t('appLock.removedToast')); }
                    }).finally(() => setMpActionBusy(false));
                  }
                }}
                autoFocus={!isMobile}
              />
              <button type="button" className="mp-eye-btn" onClick={() => setShowMpPw(v => !v)} tabIndex={-1} aria-label={showMpPw ? t('password.hideAria') : t('password.show')}>
                {showMpPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {mpActionError && <p className="lock-screen-error" style={{ margin: '4px 0' }}>{mpActionError}</p>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="settings-link-btn" onClick={() => { setShowRemoveMp(false); setShowMpPw(false); }}>{t('common.cancel')}</button>
              <button
                className="lock-screen-btn mp-remove-btn"
                disabled={mpActionBusy}
                onClick={() => {
                  setMpActionBusy(true); setMpActionError('');
                  void handleRemoveMasterPassword(mpOldPw).then((err) => {
                    if (err) setMpActionError(err);
                    else { setShowRemoveMp(false); setShowMpPw(false); showSuccessToast(t('appLock.removedToast')); }
                  }).finally(() => setMpActionBusy(false));
                }}
              >
                {mpActionBusy ? (
                  <span className="busy-btn-content"><span className="spinner" aria-hidden="true" />{t('appLock.removingPassword')}</span>
                ) : t('common.remove')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ===== Sidebar ===== */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">Cipher</span>
          {themeId === 'retro' && (
            <button className="icon-btn retro-exit-x" onClick={() => setThemeId('auto')} aria-label={t('topbar.exitRetroAria')} title={t('topbar.exitRetro')}>
              <X size={16} />
            </button>
          )}
          <button
            className="icon-btn sidebar-lock-btn"
            onClick={handleLockBtnClick}
            aria-label={masterPasswordExists ? t('sidebar.lockApp') : t('sidebar.setAppPassword')}
            title={masterPasswordExists ? t('sidebar.lockApp') : t('sidebar.setAppPassword')}
          >
            <Lock size={16} />
          </button>
          <button className="icon-btn" onClick={() => setSidebarOpen(false)} aria-label={t('sidebar.closeSidebar')}>
            <PanelLeftClose size={16} />
          </button>
        </div>

        <div className="sidebar-new-row">
          <button className="new-chat-gem" aria-label={t('common.newChat')} onClick={() => { setEphemeralMode(false); startNewChat(); if (isMobile) setSidebarOpen(false); }}>
            <Pencil size={16} />
            <span>{t('common.newChat')}</span>
          </button>
          <button
            className={`ephemeral-toggle${ephemeralMode ? ' active' : ''}`}
            onClick={() => {
              setEphemeralMode((v) => !v);
              startNewChat();
              if (isMobile) setSidebarOpen(false);
            }}
            aria-label={ephemeralMode ? t('sidebar.disableTemporary') : t('sidebar.enableTemporary')}
            title={ephemeralMode ? t('sidebar.tempOn') : t('sidebar.tempOff')}
          >
            <SquareDashed size={16} />
          </button>
        </div>

        <div className="sidebar-sessions-head">{t('sidebar.sessions')}</div>

        <div className="sidebar-chats">
          {chats.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', padding: '16px 8px' }}>
              {t('sidebar.noSessionsYet')}
            </p>
          ) : (<>
            {/* Pinned section */}
            {sortedChats.some(c => starredChats.has(c.id)) && (
              <div className="chat-group-label">{t('sidebar.pinned')}</div>
            )}
            {sortedChats.filter(c => starredChats.has(c.id)).map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${chat.id === activeChatId ? 'active' : ''}${chat.ephemeral ? ' ephemeral' : ''}`}
              >
                {sidebarRenamingId === chat.id ? (
                  <input
                    className="chat-item-rename"
                    value={sidebarRenameValue}
                    aria-label={t('sidebar.renameInput')}
                    onChange={(e) => setSidebarRenameValue(e.target.value)}
                    onBlur={() => { renameChat(chat.id, sidebarRenameValue); setSidebarRenamingId(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { renameChat(chat.id, sidebarRenameValue); setSidebarRenamingId(''); } if (e.key === 'Escape') setSidebarRenamingId(''); }}
                    autoFocus
                  />
                ) : (
                  <button className="chat-item-main" onClick={() => loadChat(chat)}>
                    <strong>{chat.name}{busyChats.has(chat.id) && chat.id !== activeChatId && <RefreshCw size={11} className="chat-item-busy spin" />}</strong>
                    <span className="chat-meta">
                      {chat.ephemeral ? <><SquareDashed size={10} className="chat-meta-icon" /> {t('sidebar.tempLabel')}</> : chat.securityMode === 'ecc' ? <><Shield size={10} className="chat-meta-icon ecc" /> {t('sidebar.pairedLabel')}</> : <><Lock size={10} className="chat-meta-icon" /> {t('sidebar.personalLabel')}</>}
                      {' · '}
                      {t('sidebar.msgsShort', { count: chat.messageCount || 0 })}
                    </span>
                  </button>
                )}
                <div className="chat-item-actions" ref={sidebarMenuChatId === chat.id ? sidebarMenuRef : undefined}>
                  <button
                    className="chat-item-dots"
                    onClick={(e) => { e.stopPropagation(); setSidebarMenuChatId(sidebarMenuChatId === chat.id ? '' : chat.id); }}
                    aria-label={t('sidebar.chatOptions')}
                  >
                    <MoreVertical size={14} />
                  </button>
                  {sidebarMenuChatId === chat.id && (
                    <div className="chat-item-menu">
                      <button onClick={() => { toggleStarChat(chat.id); setSidebarMenuChatId(''); }}>
                        <Pin size={13} /> {t('sidebar.unpin')}
                      </button>
                      <button onClick={() => { setSidebarRenameValue(chat.name); setSidebarRenamingId(chat.id); setSidebarMenuChatId(''); }}>
                        <Pencil size={13} /> {t('sidebar.rename')}
                      </button>
                      {chat.castleId !== undefined && (
                        <button onClick={() => { setCastleInfoChatId(chat.id); setSidebarMenuChatId(''); }}>
                          <Castle size={13} /> {t('sidebar.about')}
                        </button>
                      )}
                      <div className="chat-item-menu-divider" />
                      <button className="chat-item-menu-danger" onClick={() => { setPendingDeleteChatId(chat.id); setSidebarMenuChatId(''); }}>
                        <Trash2 size={13} /> {t('common.delete')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Recent section */}
            {sortedChats.some(c => starredChats.has(c.id)) && sortedChats.some(c => !starredChats.has(c.id)) && (
              <div className="chat-group-label">{t('sidebar.recent')}</div>
            )}
            {sortedChats.filter(c => !starredChats.has(c.id)).map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${chat.id === activeChatId ? 'active' : ''}${chat.ephemeral ? ' ephemeral' : ''}`}
              >
                {sidebarRenamingId === chat.id ? (
                  <input
                    className="chat-item-rename"
                    value={sidebarRenameValue}
                    aria-label={t('sidebar.renameInput')}
                    onChange={(e) => setSidebarRenameValue(e.target.value)}
                    onBlur={() => { renameChat(chat.id, sidebarRenameValue); setSidebarRenamingId(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { renameChat(chat.id, sidebarRenameValue); setSidebarRenamingId(''); } if (e.key === 'Escape') setSidebarRenamingId(''); }}
                    autoFocus
                  />
                ) : (
                  <button className="chat-item-main" onClick={() => loadChat(chat)}>
                    <strong>{chat.name}{busyChats.has(chat.id) && chat.id !== activeChatId && <RefreshCw size={11} className="chat-item-busy spin" />}</strong>
                    <span className="chat-meta">
                      {chat.ephemeral ? <><SquareDashed size={10} className="chat-meta-icon" /> {t('sidebar.tempLabel')}</> : chat.securityMode === 'ecc' ? <><Shield size={10} className="chat-meta-icon ecc" /> {t('sidebar.pairedLabel')}</> : <><Lock size={10} className="chat-meta-icon" /> {t('sidebar.personalLabel')}</>}
                      {' · '}
                      {t('sidebar.msgsShort', { count: chat.messageCount || 0 })}
                    </span>
                  </button>
                )}
                <div className="chat-item-actions" ref={sidebarMenuChatId === chat.id ? sidebarMenuRef : undefined}>
                  <button
                    className="chat-item-dots"
                    onClick={(e) => { e.stopPropagation(); setSidebarMenuChatId(sidebarMenuChatId === chat.id ? '' : chat.id); }}
                    aria-label={t('sidebar.chatOptions')}
                  >
                    <MoreVertical size={14} />
                  </button>
                  {sidebarMenuChatId === chat.id && (
                    <div className="chat-item-menu">
                      <button onClick={() => { toggleStarChat(chat.id); setSidebarMenuChatId(''); }}>
                        <Pin size={13} /> {t('sidebar.pin')}
                      </button>
                      <button onClick={() => { setSidebarRenameValue(chat.name); setSidebarRenamingId(chat.id); setSidebarMenuChatId(''); }}>
                        <Pencil size={13} /> {t('sidebar.rename')}
                      </button>
                      {chat.castleId !== undefined && (
                        <button onClick={() => { setCastleInfoChatId(chat.id); setSidebarMenuChatId(''); }}>
                          <Castle size={13} /> {t('sidebar.about')}
                        </button>
                      )}
                      <div className="chat-item-menu-divider" />
                      <button className="chat-item-menu-danger" onClick={() => { setPendingDeleteChatId(chat.id); setSidebarMenuChatId(''); }}>
                        <Trash2 size={13} /> {t('common.delete')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>)}
        </div>

        <div className="sidebar-footer">
          {themeId === 'retro' && (
            <div className="retro-sidebar-section">
              <div className="retro-sidebar-badges">
                <span className="retro-sb construction">🚧 UNDER CONSTRUCTION</span>
                <span className="retro-sb netscape">NETSCAPE NOW!</span>
                <span className="retro-sb visitor">👁 31,337</span>
              </div>
              <div className="retro-sidebar-btns">
                <button className="retro-btn fake" onClick={() => { const d = document.createElement('div'); d.className = 'retro-popup'; d.innerHTML = '✅ Downloading 512MB RAM...<br>██████████ 100%<br><b>Done! Your PC is now FASTER!</b>'; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }}>💾 Download RAM</button>
                <button className="retro-btn fake" onClick={() => { const d = document.createElement('div'); d.className = 'retro-popup hacker'; d.innerHTML = '🔴 ACCESSING PENTAGON...<br>████░░░░░░ 42%<br><b>⛔ ACCESS DENIED ⛔</b><br><small>FBI has been notified!</small>'; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }}>🕵️ Hack Pentagon</button>
                <button className="retro-btn fake" onClick={() => { const d = document.createElement('div'); d.className = 'retro-popup winner'; d.innerHTML = '🎉🎊 CONGRATULATIONS!!! 🎊🎉<br>You are the <b>1,000,000th</b> visitor!<br>You have won...<br><b>absolutely nothing! 😂</b>'; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }}>🏆 Claim Prize!</button>
                <button className="retro-btn fake" onClick={() => { const d = document.createElement('div'); d.className = 'retro-popup source'; d.innerHTML = '&lt;html&gt;<br>&lt;body bgcolor=&quot;#ff00ff&quot;&gt;<br>&lt;marquee&gt;Nice try, hacker! 😎&lt;/marquee&gt;<br>&lt;blink&gt;TOP SECRET&lt;/blink&gt;<br>&lt;/body&gt;<br>&lt;/html&gt;'; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }}>👀 View Source</button>
              </div>
              <button className="retro-btn exit full" onClick={() => setThemeId('auto')}>🚪 ESCAPE THE 90s</button>
            </div>
          )}
          <div className="sidebar-footer-row">
            <Shield size={12} /> {t('sidebar.endToEndNotice')}
          </div>
          <button className="sidebar-settings-btn" onClick={openSettingsPanel} aria-label={t('common.settings')}>
            <Settings size={15} /> {t('common.settings')}
          </button>
          <button className="sidebar-erase-btn" onClick={() => setEraseStep(1)} aria-label={t('sidebar.eraseAllData')}>
            <Eraser size={15} /> {t('sidebar.eraseAllData')}
          </button>
        </div>
      </aside>

      {/* Erase confirmation dialogs */}
      {eraseStep === 1 && (
        <div className="modal-overlay" onClick={() => setEraseStep(0)}>
          <div
            className="erase-dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="erase-dialog-title"
            aria-describedby="erase-dialog-desc"
          >
            <AlertTriangle size={28} className="erase-icon" />
            <h3 id="erase-dialog-title">{t('erase.title')}</h3>
            <p id="erase-dialog-desc">{t('erase.body')}</p>
            <div className="erase-actions">
              <button className="erase-cancel" onClick={() => setEraseStep(0)}>{t('common.cancel')}</button>
              <button className="erase-continue" onClick={() => setEraseStep(2)}>{t('common.continue')}</button>
            </div>
          </div>
        </div>
      )}
      {eraseStep === 2 && (
        <div className="modal-overlay" onClick={() => setEraseStep(0)}>
          <div
            className="erase-dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="erase-confirm-title"
            aria-describedby="erase-confirm-desc"
          >
            <AlertTriangle size={28} className="erase-icon danger" />
            <h3 id="erase-confirm-title">{t('erase.sureTitle')}</h3>
            <p id="erase-confirm-desc">
              {t('erase.sureBody', {
                chatCount: t('erase.chats', { count: chats.length }),
                msgCount: t('erase.messages', { count: totalMsgCount }),
              })}
            </p>
            <div className="erase-actions">
              <button className="erase-cancel" onClick={() => setEraseStep(0)}>{t('common.cancel')}</button>
              <button className="erase-confirm" onClick={() => { setEraseStep(0); void nukeEverything().then(() => window.location.reload()); }}>
                {t('erase.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-chat confirmation */}
      {pendingDeleteChatId && (() => {
        const chat = chats.find(c => c.id === pendingDeleteChatId);
        if (!chat) {
          // Chat vanished while the dialog was open (e.g. erase-all fired) —
          // close the dialog instead of leaving a dangling modal.
          setTimeout(() => setPendingDeleteChatId(''), 0);
          return null;
        }
        const msgCount = chat.messageCount || 0;
        return (
          <div className="modal-overlay" onClick={() => setPendingDeleteChatId('')}>
            <div
              className="erase-dialog"
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-chat-title"
              aria-describedby="delete-chat-desc"
            >
              <AlertTriangle size={28} className="erase-icon" />
              <h3 id="delete-chat-title">{t('deleteChat.title')}</h3>
              <p id="delete-chat-desc">
                {t('deleteChat.body', {
                  name: chat.name,
                  msgCount: t('erase.messages', { count: msgCount }),
                })}
              </p>
              <div className="erase-actions">
                <button className="erase-cancel" onClick={() => setPendingDeleteChatId('')}>{t('common.cancel')}</button>
                <button className="erase-confirm" onClick={() => { const id = pendingDeleteChatId; setPendingDeleteChatId(''); removeChat(id); }}>
                  {t('deleteChat.confirm')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Castle info modal */}
      {castleInfoChatId && (() => {
        const chat = chats.find(c => c.id === castleInfoChatId);
        const castle = chat?.castleId !== undefined ? IRAN_CASTLES[chat.castleId] : null;
        if (!castle) return null;
        const useFa = isPersian(chat!.name);
        return (
          <div className="modal-overlay" onClick={() => setCastleInfoChatId('')}>
            <div
              className="castle-dialog"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="castle-dialog-title"
            >
              <Castle size={28} className="castle-dialog-icon" />
              <h3 id="castle-dialog-title">{useFa ? castle.nameFa : castle.nameEn}</h3>
              <div className="castle-meta">
                <span className="castle-province">{castle.province}</span>
                {useFa ? (
                  <span className="castle-alt-name">{castle.nameEn}</span>
                ) : (
                  <span className="castle-alt-name" dir="rtl">{castle.nameFa}</span>
                )}
              </div>
              <p className="castle-desc" dir={useFa ? 'rtl' : 'ltr'}>
                {useFa ? castle.descFa : castle.descEn}
              </p>
              <div className="castle-actions">
                <button className="castle-close" onClick={() => setCastleInfoChatId('')}>{t('common.close')}</button>
                <a
                  className="castle-wiki-link"
                  href={castle.wiki}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Wikipedia &rarr;
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== Mini sidebar rail (collapsed) ===== */}
      {!sidebarOpen && (
        <aside className="sidebar-rail">
          <button className="rail-btn rail-btn-open" onClick={() => setSidebarOpen(true)} aria-label={t('sidebar.openSidebar')}>
            <Menu size={18} />
          </button>
          <button className="rail-btn" onClick={startNewChat} aria-label={t('common.newChat')}>
            <Pencil size={18} />
          </button>
          <button
            className={`rail-btn${ephemeralMode ? ' rail-btn-active' : ''}`}
            onClick={() => setEphemeralMode((v) => !v)}
            aria-label={ephemeralMode ? t('sidebar.disableTemporary') : t('sidebar.enableTemporary')}
            title={ephemeralMode ? t('sidebar.tempOn') : t('sidebar.tempOff')}
          >
            <SquareDashed size={18} />
          </button>
          <div className="rail-spacer" />
          <button className="rail-btn" onClick={openSettingsPanel} aria-label={t('common.settings')}>
            <Settings size={18} />
          </button>
        </aside>
      )}

      {/* ===== Main ===== */}
      <div className={`main-area${!sidebarOpen ? ' with-rail' : ''}`}>
        {/* Top bar */}
        <header className="topbar">
          {/* Left zone: chat title */}
          <div className="topbar-left">
            {isMobile && !sidebarOpen && (
              <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label={t('sidebar.openSidebar')}>
                <Menu size={18} />
              </button>
            )}
            {activeChat && (
              <div className="chat-title-wrapper" ref={chatMenuRef}>
                {renamingChat ? (
                  <input
                    className="chat-title-rename"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => { renameActiveChat(renameValue); setRenamingChat(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { renameActiveChat(renameValue); setRenamingChat(false); } if (e.key === 'Escape') setRenamingChat(false); }}
                    autoFocus
                  />
                ) : (
                  <button className="chat-title-btn" onClick={() => setShowChatMenu((v) => !v)}>
                    {activeChat.ephemeral && <SquareDashed size={12} className="chat-title-ephemeral" />}
                    <span className="chat-title-text">{activeChat.name}</span>
                    <ChevronDown size={12} />
                  </button>
                )}
                {showChatMenu && !renamingChat && (
                  <div className="chat-title-menu">
                    <button onClick={() => { toggleStarChat(activeChat.id); setShowChatMenu(false); }}>
                      <Pin size={13} /> {starredChats.has(activeChat.id) ? 'Unpin' : 'Pin'}
                    </button>
                    <button onClick={() => { setRenameValue(activeChat.name); setRenamingChat(true); setShowChatMenu(false); }}>
                      <Pencil size={13} /> Rename
                    </button>
                    {activeChat.castleId !== undefined && (
                      <button onClick={() => { setCastleInfoChatId(activeChat.id); setShowChatMenu(false); }}>
                        <Castle size={13} /> About
                      </button>
                    )}
                    <div className="chat-title-menu-divider" />
                    <button className="chat-title-menu-danger" onClick={() => { setPendingDeleteChatId(activeChat.id); setShowChatMenu(false); }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center zone: security controls */}
          <div className="topbar-center">
          {chatHasHistory || pairedReady ? null : (
          <div className="mode-switch" role="tablist" aria-label={t('modes.securityMode')}>
            <button
              className={`mode-chip ${securityMode === 'password' ? 'active' : ''}`}
              role="tab"
              aria-selected={securityMode === 'password'}
              onClick={() => {
                setSecurityMode('password');
              }}
            >
              <Lock size={13} /> {t('modes.personal')}
            </button>
            <button
              className={`mode-chip ${securityMode === 'ecc' ? 'active ecc-active' : ''}`}
              role="tab"
              aria-selected={securityMode === 'ecc'}
              onClick={() => {
                setSecurityMode('ecc');
              }}
            >
              <Link2 size={13} /> {t('modes.paired')}
            </button>
          </div>
          )}

          {/* Password / ECC fields */}
          {securityMode === 'password' ? (
            <div className="security-strip">
              {isPasswordLocked ? (
                <div className="password-locked-notice">
                  <Lock size={12} />
                  <span className="password-locked-text">
                    {passwordPeeking ? (
                      <span className="password-peek-value">{password}</span>
                    ) : (
                      t('password.locked')
                    )}
                  </span>
                  <div className="pw-peek-actions">
                    {passwordPeeking && (
                      <button
                        className="pw-peek-btn"
                        onClick={() => void copyText(password, 'pw-peek')}
                        title={t('password.copy')}
                        aria-label={t('password.copy')}
                        type="button"
                      >
                        {copied === 'pw-peek' ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    )}
                    <button
                      className={`pw-peek-btn ${passwordPeeking ? 'active' : ''}`}
                      onClick={() => passwordPeeking ? stopPasswordPeek() : startPasswordPeek()}
                      title={passwordPeeking ? t('password.hide') : t('password.revealShort')}
                      aria-label={passwordPeeking ? t('password.hide') : t('password.reveal')}
                      aria-pressed={passwordPeeking}
                      type="button"
                    >
                      {passwordPeeking ? <EyeOff size={13} /> : <Eye size={13} />}
                      {passwordPeeking && <span className="pw-peek-timer" />}
                    </button>
                  </div>
                </div>
              ) : (
              <div className={`password-field${password ? ' has-value' : ''}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="sec-input"
                  placeholder={t('password.placeholder')}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); }}
                />
                {/* Left icon: Paste ↔ Copy */}
                {password ? (
                  <button
                    className="pw-action-btn pos-1"
                    onClick={() => copyText(password, 'pw')}
                    type="button"
                    title={t('password.copy')}
                    aria-label={t('password.copy')}
                  >
                    {copied === 'pw' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                ) : (
                  <button
                    className="pw-action-btn pos-1"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) { setPassword(text); }
                      } catch {
                        // Reading the clipboard can fail when the document
                        // isn't focused or when permission was denied. Surface
                        // a hint so the user knows to paste manually.
                        setError(t('errors.clipboardReadDenied'));
                      }
                    }}
                    type="button"
                    title={t('password.paste')}
                    aria-label={t('password.paste')}
                  >
                    <ClipboardPaste size={12} />
                  </button>
                )}
                {/* Right icon: Dice (generate) ↔ X (clear) */}
                {password ? (
                  <button
                    className="pw-action-btn pos-2"
                    onClick={() => { setPassword(''); setShowPassword(true); }}
                    type="button"
                    title={t('password.clear')}
                    aria-label={t('password.clear')}
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <button
                    className="pw-action-btn pos-2"
                    onClick={generateRandomPassword}
                    type="button"
                    title={t('password.generate')}
                    aria-label={t('password.generate')}
                  >
                    <Dices size={13} />
                  </button>
                )}
              </div>
              )}
            </div>
          ) : pairedReady ? (
            <div className="paired-active-notice">
              <Link2 size={12} />
              <span className="paired-active-name">{t('paired.pairedActive')}</span>
            </div>
          ) : (
            <div className="security-strip">
              <div className="paired-picker" ref={pairedPickerRef}>
                <button
                  className="paired-summary"
                  type="button"
                  onClick={() => setShowPairedPicker((v) => !v)}
                  title={t('paired.selectPaired')}
                >
                  <span>{eccSessionName.trim() || activeChat?.eccSessionName || t('paired.selectOrCreate')}</span>
                  <ChevronDown size={12} className={showPairedPicker ? 'rotate-180' : ''} />
                </button>
                {showPairedPicker && (
                  <div className="paired-picker-menu">
                    {pairedChats.length > 0 ? (
                      pairedChats.map((chat) => (
                        <button
                          key={chat.id}
                          className={`paired-picker-item${chat.id === activeChatId ? ' active' : ''}`}
                          type="button"
                          onClick={() => {
                            loadChat(chat);
                            setSecurityMode('ecc');
                            setShowPairedPicker(false);
                          }}
                        >
                          {chat.eccSessionName}
                        </button>
                      ))
                    ) : (
                      <div className="paired-picker-empty">{t('paired.noPairedYet')}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>{/* end topbar-center */}

          {/* Right zone: donate + retro exit */}
          <div className="topbar-right">
            {themeId === 'retro' && (
              <button className="retro-topbar-exit" onClick={() => setThemeId('auto')} title={t('topbar.exitRetro')}>
                <X size={14} />
              </button>
            )}
            <button className="icon-btn" onClick={() => setGuideOpen(true)} title={t('guide.openGuide')} aria-label={t('guide.openGuide')}>
              <HelpCircle size={16} />
            </button>
            <button className="icon-btn donate-btn" onClick={() => setShowDonatePanel((v) => !v)} title={t('topbar.supportTitle')} aria-label={t('topbar.supportToggle')}>
              <Heart size={16} />
            </button>
          </div>
        </header>

        {/* Donate panel */}
        {showDonatePanel && (
          <div className="donate-panel">
            <div className="donate-panel-head">
              <strong>{t('settings.supportCipher')}</strong>
              <button className="icon-btn" onClick={() => setShowDonatePanel(false)}><X size={14} /></button>
            </div>
            <div className="donate-panel-body">
              {themeId === 'retro' && <div className="retro-support-ascii">{'☆·.·´¯`·.·☆ SUPPORT ☆·.·´¯`·.·☆'}</div>}
              <p>{themeId === 'retro' ? 'This site is FREEWARE!! But u can buy the webmaster a coffee ☕' : t('settings.supportTagline')}</p>
              <a
                className="donate-panel-cta"
                href="https://buymeacoffee.com/cmos_jumper"
                target="_blank"
                rel="noopener noreferrer"
              >
                ☕ {t('settings.buyCoffee')}
              </a>
              {themeId === 'retro' && <div className="retro-visitor-counter">You are visitor #<span className="retro-counter-num">{Math.floor(Math.random() * 90000 + 10000)}</span></div>}
            </div>
          </div>
        )}

        {securityMode === 'ecc' && !pairedReady && (() => {
          const step1Done = eccNameConfirmed && !!eccSessionName.trim();
          const step2Done = eccCodeShared;
          const step3Done = eccFriendConfirmed && !!friendPublicKeyB64.trim();
          const activeStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 0;

          return (
          <div className="paired-panel" role="region" aria-label={t('paired.setupRegion')}>
            {/* Step 1: Name */}
            <div className={`paired-step${activeStep === 1 ? ' active' : ''}${step1Done ? ' done' : ''}`}>
              <div className="paired-step-header" onClick={() => { if (step1Done) setEccNameConfirmed(false); }} style={step1Done ? { cursor: 'pointer' } : undefined}>
                <span className="paired-step-num">{step1Done ? <Check size={11} /> : '1'}</span>
                <span className="paired-step-title">{t('paired.step1Title')}</span>
                {step1Done && <span className="paired-step-value">{eccSessionName}</span>}
              </div>
              {!step1Done && (
                <div className="paired-step-body">
                  <div className="paired-inline-row">
                    <input
                      type="text"
                      className="sec-input ecc"
                      placeholder={t('paired.namePlaceholder')}
                      value={eccSessionName}
                      onChange={(e) => setEccSessionName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && eccSessionName.trim()) void confirmEccName(); }}
                      aria-label={t('paired.pairedName')}
                      autoFocus
                    />
                    <button className="sec-btn primary" disabled={!eccSessionName.trim()} onClick={() => void confirmEccName()}>
                      {t('paired.next')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Share your code */}
            <div className={`paired-step${activeStep === 2 ? ' active' : ''}${step2Done ? ' done' : ''}${!step1Done ? ' locked' : ''}`}>
              <div className="paired-step-header" onClick={() => { if (step2Done) setEccCodeShared(false); }} style={step2Done ? { cursor: 'pointer' } : undefined}>
                <span className="paired-step-num">{step2Done ? <Check size={11} /> : '2'}</span>
                <span className="paired-step-title">{t('paired.step2Title')}</span>
                {advancedModeEnabled && step1Done && !step2Done && (
                  <button
                    className={`paired-step-badge ${showAdvanced ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setShowAdvanced((v) => { if (!v && mnemonicWords.length === 0) void rollMnemonic(); return !v; }); }}
                  >
                    {t('paired.advanced')}
                  </button>
                )}
                {step2Done && <span className="paired-step-check">{t('paired.sentBadge')}</span>}
              </div>
              {step1Done && !step2Done && (
                <div className="paired-step-body">
                  {showAdvanced && (
                    <>
                      <p className="paired-step-hint">{t('paired.mnemonicHint')}</p>
                      <div className="mnemonic-grid">
                        {mnemonicWords.map((word, i) => (
                          <div key={i} className="mnemonic-cell">
                            <span className="mnemonic-num">{i + 1}</span>
                            <span className="mnemonic-word">{word}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mnemonic-actions">
                        <button className="sec-btn" onClick={() => void rollMnemonic()} title={t('paired.generateNewWords')}>
                          <Dices size={13} />
                        </button>
                      </div>
                    </>
                  )}
                  <p className="paired-step-hint">{showAdvanced ? t('paired.yourPublicKey') : t('paired.step2Hint')}</p>
                  <div className="paired-code-row">
                    <code className="paired-code-preview">{myPublicKeyB64 ? `${myPublicKeyB64.slice(0, 24)}...` : t('paired.generatingKey')}</code>
                    <button className="sec-btn" disabled={!myPublicKeyB64} onClick={() => { void copyText(myPublicKeyB64, 'ecc-code'); completeStep2(); }}>
                      {copied === 'ecc-code' ? <><Check size={12} /> {t('common.copied')}</> : <><Copy size={12} /> {t('common.copy')}</>}
                    </button>
                    <button className="sec-btn" disabled={!myPublicKeyB64} onClick={() => { if (showEccQr) setShowEccQr(false); else void openEccQr(); }}>
                      <Image size={12} /> {showEccQr ? t('paired.hideQr') : t('paired.qrCode')}
                    </button>
                  </div>
                  <button className="paired-share-btn" disabled={!myPublicKeyB64} onClick={() => void shareMyKey()}>
                    <Share2 size={14} /> {t('paired.sendToFriend')}
                  </button>
                  {showEccQr && eccQrUrl && (
                    <div className="paired-qr-card">
                      <img src={eccQrUrl} alt={t('paired.qrAlt')} className="paired-qr-image" />
                      <div className="paired-qr-actions">
                        <button className="sec-btn" onClick={downloadEccQr}>
                          <Download size={12} /> {t('common.download')}
                        </button>
                        <button className="sec-btn primary" onClick={() => void shareEccQr()}>
                          <Share2 size={12} /> {t('common.share')}
                        </button>
                      </div>
                    </div>
                  )}
                  {step2Reminder && (
                    <div className="step2-reminder">
                      <Send size={13} />
                      <span>{t('paired.step2Reminder')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Paste friend code */}
            <div className={`paired-step${activeStep === 3 ? ' active' : ''}${step3Done ? ' done' : ''}${!step2Done ? ' locked' : ''}`}>
              <div className="paired-step-header" onClick={() => { if (step3Done) setEccFriendConfirmed(false); }} style={step3Done ? { cursor: 'pointer' } : undefined}>
                <span className="paired-step-num">{step3Done ? <Check size={11} /> : '3'}</span>
                <span className="paired-step-title">{t('paired.step3Title')}</span>
                {step3Done && <span className="paired-step-check">{t('paired.receivedBadge')}</span>}
              </div>
              {step2Done && !step3Done && (
                <div className="paired-step-body">
                  <p className="paired-step-hint">{t('paired.step3Hint')}</p>
                  <div className="paired-step-tools">
                    <button className="sec-btn" onClick={() => void handlePasteFriendCode()}>
                      <ClipboardPaste size={12} /> {t('paired.paste')}
                    </button>
                    <button className="sec-btn" onClick={() => void startCameraScanner()}>
                      <Camera size={12} /> {t('paired.camera')}
                    </button>
                    <button className="sec-btn" onClick={() => eccUploadInputRef.current?.click()}>
                      <Upload size={12} /> {t('paired.upload')}
                    </button>
                    <input
                      ref={eccUploadInputRef}
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(e) => { void handleUploadFriendQr(e.target.files?.[0] || null); e.currentTarget.value = ''; }}
                    />
                  </div>
                  <div className="paired-inline-row">
                    <input
                      type="text"
                      className={`sec-input ecc${step3InputFlash ? ' flash' : ''}`}
                      placeholder={t('paired.friendCodePlaceholder')}
                      value={friendPublicKeyB64}
                      onChange={(e) => setFriendPublicKeyB64(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && friendPublicKeyB64.trim().length >= 20) setEccFriendConfirmed(true); }}
                      aria-label={t('paired.friendCode')}
                    />
                    <button className="sec-btn primary" disabled={friendPublicKeyB64.trim().length < 20} onClick={() => setEccFriendConfirmed(true)}>
                      {t('paired.done')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Ready state */}
            {pairedReady && (
              <div className="paired-ready-bar">
                <div className="paired-ready-info">
                  <Shield size={14} />
                  <span>{t('paired.pairedReadyBanner')}</span>
                </div>
              </div>
            )}

            <div className="paired-note">{t('paired.perChatNotice')}</div>
          </div>
          );
        })()}

        {/* Workspace */}
        <div
          className="workspace"
          onDragEnter={(e) => {
            e.preventDefault();
            dragCounterRef.current++;
            if (e.dataTransfer.types.includes('Files')) setDragOver(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault();
            dragCounterRef.current--;
            if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setDragOver(false); }
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragCounterRef.current = 0;
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void onFileSelected(file);
          }}
        >
          {/* Drop zone overlay */}
          {dragOver && (
            <div className="drop-overlay">
              <div className="drop-overlay-inner">
                <Upload size={32} />
                <span>{t('composer.dropFileHere')}</span>
              </div>
            </div>
          )}
          {/* Messages area — full-width scroll container, scrollbar at edge */}
          <div className="messages-area" ref={messagesAreaRef}>
            {/* Retro desktop side panels */}
            {themeId === 'retro' && (
              <div className="retro-gutter retro-gutter-left">
                <div className="retro-gutter-inner">
                  <div className="retro-gutter-title">⚡ LINKS ⚡</div>
                  <div className="retro-gutter-link">🏠 <span>Home</span></div>
                  <div className="retro-gutter-link">📧 <span>Email Me!</span></div>
                  <div className="retro-gutter-link">🔗 <span>Cool Sites</span></div>
                  <div className="retro-gutter-link">📖 <span>Guestbook</span></div>
                  <div className="retro-gutter-sep" />
                  <div className="retro-gutter-title">🏆 AWARDS</div>
                  <div className="retro-gutter-award">⭐ Best of Web '99</div>
                  <div className="retro-gutter-award">🥇 5-Star Site</div>
                  <div className="retro-gutter-award">💎 Cool Site '98</div>
                  <div className="retro-gutter-sep" />
                  <div className="retro-gutter-counter">You are visitor<br/><strong>#31,337</strong></div>
                </div>
              </div>
            )}
            {themeId === 'retro' && (
              <div className="retro-gutter retro-gutter-right">
                <div className="retro-gutter-inner">
                  <div className="retro-gutter-title">🎮 FUN ZONE</div>
                  <button className="retro-gutter-btn" onClick={() => { const d = document.createElement('div'); d.className = 'retro-popup'; d.innerHTML = '✅ Downloading 512MB RAM...<br>██████████ 100%<br><b>PC is now FASTER!</b>'; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }}>💾 Download RAM</button>
                  <button className="retro-gutter-btn" onClick={() => { const d = document.createElement('div'); d.className = 'retro-popup hacker'; d.innerHTML = '🔴 ACCESSING PENTAGON...<br>████░░░░░░ 42%<br><b>⛔ ACCESS DENIED</b><br><small>FBI notified!</small>'; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }}>🕵️ Hack Pentagon</button>
                  <button className="retro-gutter-btn" onClick={() => { const d = document.createElement('div'); d.className = 'retro-popup winner'; d.innerHTML = '🎉 CONGRATULATIONS!!!<br>You are visitor <b>#1,000,000</b>!<br>You won...<br><b>nothing! 😂</b>'; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }}>🏆 Claim Prize!</button>
                  <button className="retro-gutter-btn" onClick={() => { const d = document.createElement('div'); d.className = 'retro-popup source'; d.innerHTML = '&lt;html&gt;<br>&lt;body bgcolor=&quot;#ff00ff&quot;&gt;<br>&lt;marquee&gt;Nice try! 😎&lt;/marquee&gt;<br>&lt;/body&gt;&lt;/html&gt;'; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }}>👀 View Source</button>
                  <div className="retro-gutter-sep" />
                  <div className="retro-gutter-title">📢 NEWS</div>
                  <div className="retro-gutter-news">NEW! v2.0 released!</div>
                  <div className="retro-gutter-news">Site redesigned!!!</div>
                  <div className="retro-gutter-news">Added encryption 🔒</div>
                  <div className="retro-gutter-sep" />
                  <button className="retro-gutter-btn exit" onClick={() => setThemeId('auto')}>🚪 Exit 90s Mode</button>
                </div>
              </div>
            )}
            <div className="messages-inner">
              {step3Notice && (
                <div className="step3-toast error" key={step3Notice.text}>
                  <AlertTriangle size={14} />
                  <span>{step3Notice.text}</span>
                </div>
              )}
              {activeChat?.ephemeral && (
                <div className="ephemeral-banner">
                  <SquareDashed size={14} />
                  <span>{t('welcome.ephemeralBanner')}</span>
                </div>
              )}
              {!activeChat && (
                <div className="welcome-state">
                  <div className="welcome-icon">{ephemeralMode ? <SquareDashed size={22} /> : <Lock size={22} />}</div>
                  <h2>{ephemeralMode ? t('welcome.tempTitle') : t('appName')}</h2>
                  <p>{ephemeralMode ? t('welcome.tempBody') : t('welcome.body')}</p>
                </div>
              )}

              {activeChat && hasMoreMessages && (
                <div style={{ textAlign: 'center', padding: '8px' }}>
                  <button className="settings-link-btn" onClick={() => void loadMoreMessages()} disabled={loadingMore}>
                    {loadingMore ? t('messages.loadingOlder') : t('messages.loadOlder')}
                  </button>
                </div>
              )}

              {visibleMessages.map((msg) => {
                const isExpanded = expandedMsgId === msg.id;
                const isLong = !msg.fileUrl && !msg.audioUrl && msg.outputFull.length > 200;
                const encryptedMessageFile = msg.type === 'encrypt' && msg.dataType === 'F'
                  ? (msg.shareFile || buildMessageFileFromMessage(msg))
                  : null;
                const isQrImage = msg.type === 'encrypt' && !!msg.fileUrl && isQrShareFileName(msg.fileName);
                const isFile = msg.dataType === 'F' && !isQrImage && (!!msg.fileUrl || !!encryptedMessageFile);
                const isAudio = msg.dataType === 'A' && msg.audioUrl;
                const mediaMime = isFile
                  ? ((encryptedMessageFile?.type || getDataUrlMime(msg.fileUrl) || '')).toLowerCase()
                  : '';
                const fileName = msg.fileName || '';
                const isImage = isFile && (mediaMime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fileName));
                const isFileAudio = isFile && (mediaMime.startsWith('audio/') || (!mediaMime && /\.(mp3|wav|ogg|aac|flac|m4a|wma|opus)$/i.test(fileName)));
                const isVideo = isFile && !isFileAudio && (mediaMime.startsWith('video/') || (!mediaMime && /\.(mp4|webm|mov|avi|mkv)$/i.test(fileName)));
                const isNoiseFile = msg.type === 'encrypt' && !!(msg.fileUrl || encryptedMessageFile) && /^cipher-\d+\.wav$/i.test(msg.fileName || '');
                const isSnowFile = msg.type === 'encrypt' && !!msg.fileUrl && /^cipher-\d+\.png$/i.test(msg.fileName || '') && !isQrImage;
                const isStegFile = msg.type === 'encrypt' && msg.fileUrl && /^steg-.*\.(png|wav)$/i.test(msg.fileName || '');
                const needsDocWarning = isNoiseFile || isSnowFile || isStegFile;

                return (
                  <div key={msg.id} className={`msg-bubble ${msg.type}${msg.id === highlightMsgId ? ' highlight' : ''}`}>
                    <div className="msg-header">
                      <span className={`msg-type-badge ${msg.type}`}>
                        {msg.type === 'encrypt' ? t('messages.encrypted') : t('messages.decrypted')}
                      </span>
                      <span className="msg-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Input preview — show thumbnail for encrypted images, audio icon for audio */}
                    {msg.type === 'encrypt' && msg.thumbUrl ? (
                      <div className="msg-input-thumb-row">
                        <img src={msg.thumbUrl} alt="" className="msg-input-thumb" onClick={() => setLightboxUrl(msg.thumbUrl || '')} />
                        <span className="msg-input-preview">{msg.inputPreview}</span>
                      </div>
                    ) : msg.type === 'encrypt' && msg.dataType === 'A' ? (
                      <div className="msg-input-thumb-row">
                        <div className="msg-input-audio-icon"><Music size={18} /></div>
                        <span className="msg-input-preview">{msg.inputPreview}</span>
                      </div>
                    ) : (
                      <div className="msg-input-preview">{msg.inputPreview}</div>
                    )}

                    {/* File / Image / Video preview card */}
                    {isFile && (
                      <div className="msg-file-card">
                        {isSnowFile ? (
                          <img src={msg.fileUrl} alt={msg.fileName} className="msg-file-preview-img" onClick={() => setLightboxUrl(msg.fileUrl || '')} style={{ cursor: 'pointer' }} />
                        ) : isNoiseFile ? (
                          <div className="msg-file-icon">
                            <Download size={20} />
                          </div>
                        ) : isImage && msg.type === 'decrypt' ? (
                          <img src={msg.fileUrl} alt={msg.fileName} className="msg-file-preview-img" onClick={() => setLightboxUrl(msg.fileUrl || '')} style={{ cursor: 'pointer' }} />
                        ) : isStegFile && isImage ? (
                          <img src={msg.fileUrl} alt={msg.fileName} className="msg-file-preview-img" onClick={() => setLightboxUrl(msg.fileUrl || '')} style={{ cursor: 'pointer' }} />
                        ) : isImage && msg.type === 'encrypt' && msg.thumbUrl ? (
                          <img src={msg.thumbUrl} alt={msg.fileName} className="msg-file-preview-img" onClick={() => setLightboxUrl(msg.thumbUrl || '')} style={{ cursor: 'pointer' }} />
                        ) : isVideo && msg.type === 'decrypt' ? (
                          <video src={msg.fileUrl} controls className="msg-file-preview-video" />
                        ) : (
                          <div className="msg-file-icon">
                            <Download size={20} />
                          </div>
                        )}
                        <div className="msg-file-info">
                          <span className="msg-file-name">{msg.fileName}</span>
                          <span className="msg-file-type">
                            {isSnowFile ? t('messages.snowEncoded') : isNoiseFile ? t('messages.noiseEncoded') : msg.type === 'encrypt' ? t('messages.encryptedFile') : t('messages.decryptedFile')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* QR code image preview */}
                    {isQrImage && (
                      <div className="msg-qr-card">
                        <img src={msg.fileUrl} alt="QR Code" className="msg-qr-image" onClick={() => setLightboxUrl(msg.fileUrl || '')} style={{ cursor: 'pointer' }} />
                      </div>
                    )}

                    {/* Warning: send as document, do not compress */}
                    {needsDocWarning && (
                      <div className="msg-doc-warning">
                        <AlertTriangle size={13} />
                        <span>{t('messages.docWarning')}</span>
                      </div>
                    )}

                    {/* Audio player — voice recording or decrypted audio file */}
                    {isAudio && (
                      <audio controls src={msg.audioUrl} className="audio-player" />
                    )}
                    {isFileAudio && msg.type === 'decrypt' && (
                      <audio controls src={msg.fileUrl} className="audio-player" />
                    )}

                    {/* Text output (only for non-file, non-audio, non-QR messages) */}
                    {!isFile && !isAudio && !isQrImage && (
                      <div className={`msg-output ${isExpanded ? 'expanded' : ''}`}>
                        {isLong && !isExpanded
                          ? msg.outputFull.slice(0, 200) + '…'
                          : msg.outputFull}
                      </div>
                    )}

                    <div className="msg-actions">
                      {/* Copy — QR: copy image blob; encrypted file: copy file blob; text: copy text */}
                      {isQrImage ? (
                        <button
                          className="msg-action-btn"
                          onClick={async () => {
                            const qrShareFile = await resolveShareFileFromMessage(msg);
                            if (qrShareFile && await tryCopyBlobToClipboard(qrShareFile, msg.id)) {
                              return;
                            }
                            setError(t('errors.cantCopyQr'));
                          }}
                          title={t('messages.copyQrImg')}
                        >
                          {copied === msg.id ? <Check size={13} /> : <Copy size={13} />}
                          {copied === msg.id ? t('messages.actionCopied') : t('messages.actionCopy')}
                        </button>
                      ) : msg.type === 'encrypt' && isFile ? (
                        <button
                          className="msg-action-btn"
                          onClick={async () => {
                            try {
                              if (encryptedMessageFile) {
                                await tryCopyBlobToClipboard(encryptedMessageFile, msg.id);
                              }
                            } catch { /* no fallback for file clipboard copy */ }
                          }}
                          title={t('messages.copyEncFile')}
                        >
                          {copied === msg.id ? <Check size={13} /> : <Copy size={13} />}
                          {copied === msg.id ? t('messages.actionCopied') : t('messages.actionCopy')}
                        </button>
                      ) : !isFile && !isAudio && (
                        <button
                          className="msg-action-btn"
                          onClick={() => void copyText(msg.outputFull, msg.id)}
                          title={t('messages.actionCopy')}
                        >
                          {copied === msg.id ? <Check size={13} /> : <Copy size={13} />}
                          {copied === msg.id ? t('messages.actionCopied') : t('messages.actionCopy')}
                        </button>
                      )}

                      {/* Expand/collapse for long text */}
                      {isLong && (
                        <button
                          className="msg-action-btn"
                          onClick={() => setExpandedMsgId(isExpanded ? '' : msg.id)}
                        >
                          <ChevronDown size={13} className={isExpanded ? 'rotate-180' : ''} />
                          {isExpanded ? t('messages.actionLess') : t('messages.actionMore')}
                        </button>
                      )}

                      {/* Download — for files, audio, and QR images */}
                      {(isFile || isAudio || isQrImage) && (
                        <button className="msg-action-btn" onClick={() => {
                          if (isFile) {
                            const fileToDownload = encryptedMessageFile;
                            const downloadUrl = fileToDownload ? URL.createObjectURL(fileToDownload) : msg.fileUrl;
                            if (!downloadUrl) return;
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            a.download = msg.type === 'decrypt' ? `decrypted-${msg.fileName}` : msg.fileName || 'encrypted.ctx';
                            a.click();
                            if (fileToDownload) URL.revokeObjectURL(downloadUrl);
                            return;
                          }
                          const a = document.createElement('a');
                          a.href = (isQrImage ? msg.fileUrl : msg.audioUrl) || '';
                          a.download = isQrImage
                            ? (msg.fileName || getQrShareFileName(msg.timestamp))
                            : 'audio.webm';
                          a.click();
                        }} title={t('messages.actionDownload')}>
                          <Download size={13} /> {t('messages.actionDownload')}
                        </button>
                      )}

                      {/* Download as text — for text-only messages */}
                      {!isFile && !isAudio && !isQrImage && (
                        <button className="msg-action-btn" onClick={() => {
                          const blob = new Blob([msg.outputFull], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `cipher-${msg.type}-${new Date(msg.timestamp).toISOString().slice(0, 10)}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }} title={t('messages.actionDownloadText')}>
                          <Download size={13} /> {t('messages.actionDownload')}
                        </button>
                      )}

                      {/* Fullscreen — for images, QR, and snow */}
                      {((isImage && (msg.type === 'decrypt' || msg.thumbUrl)) || isQrImage || isSnowFile) && (
                        <button className="msg-action-btn" onClick={() => setLightboxUrl((isImage && msg.type === 'encrypt' && !isNoiseFile && !isSnowFile ? msg.thumbUrl : msg.fileUrl) || '')} title={t('messages.actionFullscreen')}>
                          <Expand size={13} /> {t('messages.actionFullscreen')}
                        </button>
                      )}

                      {/* Share — always available */}
                      <button
                        className="msg-action-btn"
                        onClick={() => void shareContent(msg)}
                        title={t('messages.actionShare')}
                      >
                        <Share2 size={13} /> {t('messages.actionShare')}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
              {successToast && (
                <div className="success-toast" key={successToast}>
                  <Check size={14} />
                  <span>{successToast}</span>
                </div>
              )}
            </div>
          </div>

          {/* Scroll to bottom button */}
          {showScrollBtn && (
            <button className="scroll-to-bottom" onClick={scrollToBottom}>
              <ArrowDown size={18} />
            </button>
          )}

          {/* Composer — Gemini / Claude style */}
          <div className="composer-wrap">
            {error && <div className="error-toast">{error}</div>}
            <div
              className={`composer ${composerExpanded ? 'expanded' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void requestFileAttachment(e.dataTransfer.files?.[0] || null); }}
            >
              {/* File card (Gemini-style) */}
              {(attachedFile || audioAttachment || mediaCompressing) && !detectedStegFile && (
                <div className="composer-attachments">
                  {mediaCompressing ? (
                    <div className="file-card compress-active">
                      <div className="compress-active-header">
                        <div className="file-card-icon compressing"><RefreshCw size={20} className="spin" /></div>
                        <div className="file-card-info">
                          <span className="file-card-name">{videoProgress > 0 ? `${t('composer.compressing')} ${Math.round(videoProgress * 100)}%` : t('composer.compressing')}</span>
                          {compressEta > 0 && (
                            <span className="file-card-size">
                              {fmtDuration(compressElapsed) || '0s'} / ~{fmtDuration(compressEta)}
                            </span>
                          )}
                        </div>
                        <button
                          className="file-card-close"
                          onClick={cancelCompression}
                          title={t('composer.cancelCompress')}
                        ><X size={14} /></button>
                      </div>
                      {compressLoadContent.text && (
                        <div className={`compress-loading-content ${compressLoadContent.fade}`}>
                          <p className="compress-loading-text">{compressLoadContent.text}</p>
                          {compressLoadContent.sub && <p className="compress-loading-sub">{compressLoadContent.sub}</p>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="file-card">
                      <div className={`file-card-icon ${fileAnalysis?.kind || 'file'}`}>
                        {attachPreviewUrl ? <img src={attachPreviewUrl} alt="" className="file-card-thumb" /> :
                         fileAnalysis?.kind === 'video' ? <Film size={20} /> :
                         fileAnalysis?.kind === 'audio' ? <Music size={20} /> :
                         <FileText size={20} />}
                      </div>
                      <div className="file-card-info">
                        <span className="file-card-name" title={attachedFile?.name || audioAttachment?.name}>{attachedFile?.name || audioAttachment?.name}</span>
                        <span className="file-card-size">{fmt(fileAnalysis?.originalSize ?? (attachedFile?.size || 0))}</span>
                      </div>
                      <button
                        className="file-card-close"
                        onClick={() => {
                          setAttachedFile(null); setAudioAttachment(null);
                          setFileAnalysis(null); setSelectedCompressId('original');
                        }}
                      ><X size={14} /></button>
                    </div>
                  )}
                </div>
              )}

              {/* Steg cover text — spectrum bar (hide in decrypt mode) */}
              {obfuscationMode === 'steg' && !looksLikeDecrypt && (
                <div className="steg-section">
                  {/* Single-line: COVER + carrier buttons */}
                  <div className="steg-cover-row">
                    <span className="steg-label">{hasFileAttachment ? t('composer.carrier') : t('composer.cover')}</span>
                    {carrierFile ? (
                      <div className="steg-carrier-chip active">
                        <span>{carrierType === 'image' ? '🖼' : '🔊'} {carrierFile.name}</span>
                        <button className="steg-carrier-remove" onClick={() => { setCarrierFile(null); setCarrierType(null); }}>
                          <X size={12} />
                        </button>
                      </div>
                    ) : !hasFileAttachment ? (
                      <>
                        {stegEditing ? (
                          <input
                            className="steg-inline-input"
                            value={decoyText}
                            onChange={(e) => { setDecoyText(e.target.value); setStegIndex(-1); }}
                            onBlur={() => setStegEditing(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setStegEditing(false); }}
                            placeholder={t('composer.coverPlaceholder')}
                            autoFocus
                          />
                        ) : (
                          <button
                            className="steg-cover-preview"
                            onClick={() => setStegEditing(true)}
                            title={t('composer.tapToEdit')}
                          >
                            {decoyText || <span className="steg-placeholder">{t('composer.shuffleOrTapHint')}</span>}
                          </button>
                        )}
                      </>
                    ) : null}
                    {/* Carrier buttons — always visible in steg mode */}
                    {!carrierFile && (
                      <div className="steg-carrier-inline">
                        <button
                          className="steg-carrier-chip"
                          onClick={() => { setCarrierType('image'); carrierImageInputRef.current?.click(); }}
                          title={t('composer.hideInImage')}
                        >
                          <Image size={13} />
                        </button>
                        <button
                          className="steg-carrier-chip"
                          onClick={() => { setCarrierType('audio'); carrierAudioInputRef.current?.click(); }}
                          title={t('composer.hideInAudio')}
                        >
                          <Mic size={13} />
                        </button>
                        <input
                          ref={carrierImageInputRef}
                          type="file"
                          accept=".png,.bmp"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) { setCarrierFile(file); setCarrierType('image'); }
                            e.target.value = '';
                          }}
                        />
                        <input
                          ref={carrierAudioInputRef}
                          type="file"
                          accept=".wav"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) { setCarrierFile(file); setCarrierType('audio'); }
                            e.target.value = '';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Ordered segmented bar — hidden when carrier file selected or file attached */}
                  {!carrierFile && !hasFileAttachment && (
                  <div className="steg-spectrum">
                    <div
                      className={`steg-spectrum-track ${stegDragging ? 'dragging' : ''}`}
                      ref={spectrumTrackRef}
                      tabIndex={0}
                      role="slider"
                      aria-label={t('composer.spectrumLabel')}
                      aria-valuemin={0}
                      aria-valuemax={maxStegIndex}
                      aria-valuenow={Math.max(stegIndex, 0)}
                      aria-valuetext={t('composer.spectrumValueText', { percent: Math.round(stegPositionPct * 100) })}
                      onClick={(e) => {
                        const rect = spectrumTrackRef.current?.getBoundingClientRect();
                        if (!rect || allCoverTexts.length === 0) return;
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        setStegByPercent(pct);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft') {
                          e.preventDefault();
                          moveStegBy(-1);
                        } else if (e.key === 'ArrowRight') {
                          e.preventDefault();
                          moveStegBy(1);
                        } else if (e.key === 'Home') {
                          e.preventDefault();
                          setStegByPercent(0);
                        } else if (e.key === 'End') {
                          e.preventDefault();
                          setStegByPercent(1);
                        }
                      }}
                    >
                      <div className="steg-spectrum-gradient">
                        {spectrumLayout.map((seg) => (
                          <span
                            key={seg.id}
                            className="steg-segment"
                            style={{
                              left: `${seg.start}%`,
                              width: `${Math.max(seg.end - seg.start, 0.3)}%`,
                              background: seg.color,
                            }}
                            title={`${seg.label} (${seg.texts.length})`}
                          />
                        ))}
                      </div>
                      {stegDragging && stegIndex >= 0 && (
                        <div
                          className="steg-loupe"
                          style={{ left: `${stegPositionPct * 100}%` }}
                          aria-hidden="true"
                        >
                          <div className="steg-loupe-track">
                            <div
                              className="steg-loupe-zoom"
                              style={{
                                transform: `translateX(${(0.5 - stegPositionPct) * 220}%) scaleX(2.2)`,
                              }}
                            >
                              {spectrumLayout.map((seg) => (
                                <span
                                  key={`loupe-${seg.id}`}
                                  className="steg-segment"
                                  style={{
                                    left: `${seg.start}%`,
                                    width: `${Math.max(seg.end - seg.start, 0.3)}%`,
                                    background: seg.color,
                                  }}
                                />
                              ))}
                            </div>
                            <span
                              className="steg-loupe-center"
                              style={{ left: '50%' }}
                            />
                          </div>
                          <span className="steg-loupe-caret" />
                        </div>
                      )}
                      <div
                        className={`steg-spectrum-knob ${stegIndex < 0 ? 'hidden' : ''}`}
                        style={{ left: stegIndex >= 0 ? `${(stegIndex / Math.max(allCoverTexts.length - 1, 1)) * 100}%` : '0%' }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setStegDragging(true);
                          const move = (ev: MouseEvent) => {
                            const rect = spectrumTrackRef.current?.getBoundingClientRect();
                            if (!rect || allCoverTexts.length === 0) return;
                            const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                            setStegByPercent(pct);
                          };
                          const up = () => { setStegDragging(false); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                          window.addEventListener('mousemove', move);
                          window.addEventListener('mouseup', up);
                        }}
                        onTouchStart={(e) => {
                          setStegDragging(true);
                          const move = (ev: TouchEvent) => {
                            const rect = spectrumTrackRef.current?.getBoundingClientRect();
                            if (!rect || allCoverTexts.length === 0 || !ev.touches[0]) return;
                            const pct = Math.max(0, Math.min(1, (ev.touches[0].clientX - rect.left) / rect.width));
                            setStegByPercent(pct);
                          };
                          const up = () => { setStegDragging(false); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
                          window.addEventListener('touchmove', move, { passive: true });
                          window.addEventListener('touchend', up);
                        }}
                      />
                    </div>
                    <button
                      className="steg-shuffle-btn"
                      onClick={() => {
                        const idx = Math.floor(Math.random() * allCoverTexts.length);
                        setStegIndex(idx);
                        setDecoyText(allCoverTexts[idx].text);
                        setSelectedCoverCategory(allCoverTexts[idx].category);
                      }}
                      title={t('common.shuffle')}
                    >
                      <Shuffle size={14} />
                    </button>
                  </div>
                  )}
                </div>
              )}

              {/* Textarea area / Smart compression strip / Steg decrypt card */}
              <div className="composer-body">
                {detectedStegFile && stegPreviewUrl ? (
                  <div className="decrypt-card">
                    <div className="decrypt-card-visual">
                      <img src={stegPreviewUrl} alt="QR" className="decrypt-card-img" />
                      <div className="decrypt-card-badge"><Shield size={12} /></div>
                    </div>
                    <div className="decrypt-card-content">
                      <span className="decrypt-card-title">{attachedFile?.name}</span>
                      <span className="decrypt-card-status">
                        <Lock size={11} />
                        Encrypted · Ready to decrypt
                      </span>
                    </div>
                    <button className="decrypt-card-close" onClick={() => {
                      setAttachedFile(null); setAudioAttachment(null);
                      setFileAnalysis(null); setSelectedCompressId('original');
                    }}><X size={14} /></button>
                  </div>
                ) : detectedStegFile && attachedFile ? (
                  <div className="decrypt-card">
                    <div className="decrypt-card-visual audio">
                      <Music size={22} />
                      <div className="decrypt-card-badge"><Shield size={12} /></div>
                    </div>
                    <div className="decrypt-card-content">
                      <span className="decrypt-card-title">{attachedFile?.name}</span>
                      <span className="decrypt-card-status">
                        <Lock size={11} />
                        Encrypted · Ready to decrypt
                      </span>
                    </div>
                    <button className="decrypt-card-close" onClick={() => {
                      setAttachedFile(null); setAudioAttachment(null);
                      setFileAnalysis(null); setSelectedCompressId('original');
                    }}><X size={14} /></button>
                  </div>
                ) : mediaCompressing ? (
                  <div className="compress-timer-area">
                    <Hourglass size={18} className="compress-hourglass" />
                    <span className="compress-timer-text">
                      {compressEta > 0
                        ? (() => { const r = Math.max(0, compressEta - compressElapsed); return r > 0 ? `~${fmtDuration(r)} remaining` : 'Finishing…'; })()
                        : compressElapsed > 0 ? fmtDuration(compressElapsed) : 'Starting…'}
                    </span>
                  </div>
                ) : fileAnalysis && fileAnalysis.options.length > 1 && !looksLikeDecrypt && !mediaCompressing ? (
                  <div className="smart-compress">
                    {fileAnalysis.options.map((opt) => (
                      <button
                        key={opt.id}
                        className={`smart-compress-opt ${selectedCompressId === opt.id ? 'active' : ''}`}
                        onClick={() => setSelectedCompressId(opt.id)}
                        title={opt.estimatedEncryptedSize ? `Encrypted output ~${fmt(opt.estimatedEncryptedSize)}` : undefined}
                      >
                        <span className="smart-compress-label">{opt.label}</span>
                        <span className="smart-compress-size">{fmt(opt.estimatedSize)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <textarea
                      ref={textareaRef}
                      className="composer-input"
                      value={inputText}
                      onChange={handleInputChange}
                      onPaste={handleComposerPaste}
                      onKeyDown={handleKeyDown}
                      placeholder={looksLikeDecrypt ? t('composer.pressToDecrypt') : t('composer.placeholder')}
                      rows={1}
                      dir={composerInputIsRtl ? 'rtl' : 'ltr'}
                      style={{ textAlign: composerInputIsRtl ? 'right' : 'left' }}
                      disabled={looksLikeDecrypt && !!attachedFile}
                    />
                    {inputText.split('\n').length > 4 && (
                      <button
                        className="composer-expand-btn"
                        onClick={() => setComposerExpanded(!composerExpanded)}
                        title={composerExpanded ? 'Minimize' : 'Expand'}
                      >
                        {composerExpanded ? <Minimize2 size={14} /> : <Expand size={14} />}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Bottom toolbar — left: attach/mic, center: compression, right: obfuscation/send */}
              <div className="composer-toolbar">
                <div className="composer-toolbar-left">
                  {detectedStegFile ? (
                    <>
                      <button className="composer-icon composer-attach" title={t('composer.attachFile')} disabled={mediaCompressing} onClick={() => { setPendingReplacementFile(null); setReplaceStegConfirm('file'); }}>
                        <Plus size={18} />
                      </button>
                      <input ref={fileInputRef} hidden type="file" onChange={(e) => { setPendingReplacementFile(null); void onFileSelected(e.target.files?.[0] || null); setReplaceStegConfirm(null); }} accept="*/*" />
                    </>
                  ) : (
                    <label className={`composer-icon composer-attach${mediaCompressing ? ' disabled' : ''}`} title={t('composer.attachFile')}>
                      <Plus size={18} />
                      <input hidden type="file" onChange={(e) => void requestFileAttachment(e.target.files?.[0] || null)} accept="*/*" disabled={mediaCompressing} />
                    </label>
                  )}
                  <label className={`composer-icon composer-gallery${mediaCompressing ? ' disabled' : ''}`} title={t('composer.addFromGallery')}>
                    <Image size={18} />
                    <input hidden type="file" onChange={(e) => void requestFileAttachment(e.target.files?.[0] || null)} accept="image/*" disabled={mediaCompressing} />
                  </label>
                  {!isMobile && (
                  <div className={`mic-wrap ${recording ? 'recording' : ''}`} ref={micBtnRef} style={{ '--vol': '0' } as React.CSSProperties}>
                    <button
                      className={`composer-icon mic-btn ${recording ? 'recording' : ''}`}
                      disabled={mediaCompressing}
                      onClick={() => {
                        if (detectedStegFile && !recording) { setReplaceStegConfirm('mic'); return; }
                        recording ? stopRecording() : void startRecording();
                      }}
                      title={recording ? 'Stop' : 'Record'}
                      aria-label={recording ? t('composer.stopRecording') : t('composer.recordVoice')}
                      aria-pressed={recording}
                    >
                      <Mic size={recording ? 22 : 18} />
                    </button>
                    {recording && <span className="rec-timer">{Math.floor(recordingElapsed / 60)}:{String(recordingElapsed % 60).padStart(2, '0')}</span>}
                  </div>
                  )}
                </div>

                {/* Dynamic size: original → encrypted / QR capacity */}
                {qrUsage && qrUsage.level !== 'ok' ? (
                  <div className={`composer-toolbar-center qr-capacity ${qrUsage.level}`}>
                    <div className="qr-cap-bar">
                      <div className="qr-cap-fill" style={{ width: `${Math.min(qrUsage.ratio * 100, 100)}%` }} />
                    </div>
                    <span className="qr-cap-text">
                      {fmt(composerInputBytes)} → {fmt(qrUsage.estimated)}
                    </span>
                  </div>
                ) : fileAnalysis && !looksLikeDecrypt && !mediaCompressing ? (
                  <div className="composer-toolbar-center">
                    <span className="compression-size">
                      {fmt(fileAnalysis.originalSize)} → {fmt(
                        obfuscationMode === 'steg' && carrierFile
                          ? carrierFile.size
                          : selectedCompressionOption?.estimatedEncryptedSize
                            ?? selectedCompressionOption?.estimatedSize
                            ?? fileAnalysis.originalSize,
                      )}
                    </span>
                  </div>
                ) : null}

                <div className="composer-toolbar-right">
                  {/* Obfuscation popover trigger — hide in decrypt mode */}
                  {!looksLikeDecrypt && (
                  <div className="settings-anchor" ref={settingsRef}>
                    <button
                      className={`composer-settings-btn ${showSettings ? 'active' : ''}`}
                      disabled={mediaCompressing}
                      onClick={() => setShowSettings(!showSettings)}
                      title={t('composer.obfuscation')}
                      aria-label={t('composer.obfuscation')}
                      aria-haspopup="menu"
                      aria-expanded={showSettings}
                    >
                      <span>
                        {obfuscationMode === 'none' ? t('obfuscation.standard') : obfuscationMode === 'qr' ? t('obfuscation.qr') : obfuscationMode === 'steg' ? t('obfuscation.steg') : obfuscationMode === 'noise' ? t('obfuscation.noise') : obfuscationMode === 'snow' ? t('obfuscation.snow') : obfuscationMode === 'emoji' ? t('obfuscation.emoji') : t('obfuscation.persian')}
                      </span>
                      <ChevronDown size={12} className={showSettings ? 'rotate-180' : ''} />
                    </button>

                    {/* Obfuscation popover */}
                    {showSettings && (
                      <>
                      <div className="obf-backdrop" onClick={() => setShowSettings(false)} />
                      <div className="obf-popover">
                        <span className="obf-popover-title">{t('obfuscation.title')}</span>
                        {([
                          { id: 'none' as ObfuscationMode, name: t('obfuscation.standard'), desc: t('obfuscation.standardDesc'), textOnly: false },
                          { id: 'emoji' as ObfuscationMode, name: t('obfuscation.emoji'), desc: t('obfuscation.emojiDesc'), textOnly: true },
                          { id: 'persian' as ObfuscationMode, name: t('obfuscation.persian'), desc: t('obfuscation.persianDesc'), textOnly: true },
                          { id: 'steg' as ObfuscationMode, name: t('obfuscation.steg'), desc: hasFileAttachment ? t('obfuscation.stegInsideCarrier') : t('obfuscation.stegDesc'), textOnly: false },
                          { id: 'qr' as ObfuscationMode, name: t('obfuscation.qr'), desc: t('obfuscation.qrDesc'), textOnly: true },
                          { id: 'noise' as ObfuscationMode, name: t('obfuscation.noise'), desc: t('obfuscation.noiseDesc'), textOnly: false, needsOverflow: true },
                          { id: 'snow' as ObfuscationMode, name: t('obfuscation.snow'), desc: t('obfuscation.snowDesc'), textOnly: false, needsOverflow: true },
                        ]).filter((m) => (!m.textOnly || !hasFileAttachment) && (!m.needsOverflow || exceedsQr || hasFileAttachment)).map((m) => (
                          <button
                            key={m.id}
                            className={`obf-option ${obfuscationMode === m.id ? 'active' : ''}`}
                            onClick={() => { setObfuscationMode(m.id); setShowSettings(false); }}
                          >
                            <div className="obf-option-text">
                              <span className="obf-option-name">{m.name}</span>
                              <span className="obf-option-desc">{m.desc}</span>
                            </div>
                            {obfuscationMode === m.id && <Check size={18} className="obf-option-check" />}
                          </button>
                        ))}

                      </div>
                      </>
                    )}
                  </div>
                  )}

                  {/* Direction override chip (advanced mode only) */}
                  {advancedModeEnabled && (
                    <button
                      className={`direction-chip ${directionOverride !== 'auto' ? 'override' : ''} ${looksLikeDecrypt ? 'decrypt' : 'encrypt'}`}
                      onClick={() => setDirectionOverride((v) =>
                        v === 'auto' ? (looksLikeDecrypt ? 'encrypt' : 'decrypt')
                        : v === 'encrypt' ? 'decrypt'
                        : 'auto'
                      )}
                      title={
                        directionOverride === 'auto'
                          ? `Auto-detected: ${looksLikeDecrypt ? 'Decrypt' : 'Encrypt'} (click to override)`
                          : `Forced: ${directionOverride} (click to cycle)`
                      }
                      aria-label={
                        directionOverride === 'auto'
                          ? `Direction: Auto (currently ${looksLikeDecrypt ? 'decrypt' : 'encrypt'}). Click to force a direction.`
                          : `Direction: forced ${directionOverride}. Click to cycle.`
                      }
                    >
                      {directionOverride !== 'auto' && <span className="direction-chip-dot" />}
                      {looksLikeDecrypt ? <LockOpen size={12} /> : <Lock size={12} />}
                      <span className="direction-chip-label">{directionChipLabel}</span>
                    </button>
                  )}

                  {/* Send / Mic — on mobile, show mic when composer is empty, send when has content */}
                  {isMobile && (recording || (!inputText && !attachedFile && !audioAttachment)) ? (
                    <div className={`mic-wrap ${recording ? 'recording' : ''}`} ref={micBtnRef} style={{ '--vol': '0' } as React.CSSProperties}>
                      <button
                        className={`composer-icon mic-btn ${recording ? 'recording' : ''}`}
                        disabled={mediaCompressing}
                        onClick={() => {
                          if (detectedStegFile && !recording) { setReplaceStegConfirm('mic'); return; }
                          recording ? stopRecording() : void startRecording();
                        }}
                        title={recording ? 'Stop' : 'Record'}
                        aria-label={recording ? t('composer.stopRecording') : t('composer.recordVoice')}
                        aria-pressed={recording}
                      >
                        <Mic size={recording ? 22 : 18} />
                      </button>
                      {recording && <span className="rec-timer">{Math.floor(recordingElapsed / 60)}:{String(recordingElapsed % 60).padStart(2, '0')}</span>}
                    </div>
                  ) : (
                    <div className={`send-action-wrap${showSendActionMenu ? ' open' : ''}`} ref={sendActionRef}>
                      {showSendActionMenu && (
                        <div className="send-hold-menu" role="menu" aria-label={t('composer.chooseSendAction')}>
                          <button className="send-hold-option encrypt" type="button" onClick={() => handleForcedSend('encrypt')}>
                            <Lock size={14} />
                            <span>Encrypt</span>
                          </button>
                          <button className="send-hold-option decrypt" type="button" onClick={() => handleForcedSend('decrypt')}>
                            <LockOpen size={14} />
                            <span>Decrypt</span>
                          </button>
                        </div>
                      )}
                      <button
                        className={`composer-send${securityMode === 'ecc' ? ' ecc-mode' : ''}${looksLikeDecrypt ? ' decrypt-mode' : ''}`}
                        onClick={handleSendButtonClick}
                        onPointerDown={handleSendHoldStart}
                        onPointerUp={handleSendHoldEnd}
                        onPointerLeave={handleSendHoldEnd}
                        onPointerCancel={handleSendHoldEnd}
                        onContextMenu={(e) => e.preventDefault()}
                        disabled={sendButtonDisabled}
                        title={qrUsage?.level === 'over' ? t('composer.qrOverCapacity') : looksLikeDecrypt ? t('composer.decrypt') : t('composer.encryptAndSend')}
                        aria-label={qrUsage?.level === 'over' ? t('composer.qrOverCapacity') : looksLikeDecrypt ? t('composer.decrypt') : t('composer.encryptAndSend')}
                      >
                        {busy ? <div className="spinner" /> : looksLikeDecrypt ? <LockOpen size={16} /> : <Send size={16} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Replace steg confirmation bar */}
            {replaceStegConfirm && (
              <div className="steg-replace-confirm">
                <AlertTriangle size={15} />
                <span className="steg-replace-text">
                  {replaceStegConfirm === 'file' ? 'Attaching a new file' : 'Recording audio'} will remove the encrypted attachment
                </span>
                <button className="steg-replace-btn confirm" onClick={() => {
                  if (replaceStegConfirm === 'file') {
                    if (pendingReplacementFile) {
                      void onFileSelected(pendingReplacementFile);
                      setPendingReplacementFile(null);
                      setReplaceStegConfirm(null);
                    } else {
                      fileInputRef.current?.click();
                    }
                  } else {
                    setReplaceStegConfirm(null);
                    setPendingReplacementFile(null);
                    void startRecording();
                  }
                }}>{t('composer.replace')}</button>
                <button className="steg-replace-btn cancel" onClick={() => { setReplaceStegConfirm(null); setPendingReplacementFile(null); }}>{t('common.cancel')}</button>
              </div>
            )}

          </div>
        </div>
      </div>

      {pastePreviewOpen && (
        <div className="paste-preview-overlay" onClick={closePastePreview}>
          <div
            className="paste-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('paired.confirmClipboardImport')}
          >
            <img src={pastePreviewUrl} alt={t('paired.clipboardPreviewAlt')} className="paste-preview-image" />
            <p className="paste-preview-text">{t('paired.importImageQ')}</p>
            <div className="paste-preview-actions">
              <button className="sec-btn" onClick={closePastePreview}>{t('paired.importImageNo')}</button>
              <button className="sec-btn primary" onClick={() => void handleConfirmPasteImage()}>{t('paired.importImageYes')}</button>
            </div>
          </div>
        </div>
      )}

      {cameraScanOpen && (
        <div className="paste-preview-overlay" onClick={stopCameraScanner}>
          <div
            className="paste-preview-modal camera"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('paired.scanQrTitle')}
          >
            <video ref={cameraVideoRef} className="camera-scan-video" playsInline muted autoPlay />
            <p className="paste-preview-text">{cameraScanStatus}</p>
            <div className="paste-preview-actions">
              <button className="sec-btn" onClick={stopCameraScanner}>{t('paired.stopScanner')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Settings Panel Overlay ===== */}
      {settingsPanelOpen && (
        <div className="settings-overlay" onClick={closeSettingsPanel}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-panel-header">
              <h2>Settings</h2>
              <button className="icon-btn" onClick={closeSettingsPanel} aria-label={t('settings.closeSettings')}>
                <X size={18} />
              </button>
            </div>

            <div className="settings-panel-body">
              {/* ─── Language ─── */}
              <section className="settings-section">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">{t('settings.language')}</span>
                    <span className="settings-row-desc">{t('settings.languageDesc')}</span>
                  </div>
                  <LanguageSwitcher />
                </div>
              </section>

              {/* ─── Help / Guide ─── */}
              <section className="settings-section">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">{t('settings.help')}</span>
                    <span className="settings-row-desc">{t('settings.helpDesc')}</span>
                  </div>
                  <button
                    className="settings-help-btn"
                    onClick={() => { closeSettingsPanel(); setGuideOpen(true); }}
                    aria-label={t('guide.openGuide')}
                  >
                    <HelpCircle size={14} />
                    <span>{t('guide.openGuide')}</span>
                  </button>
                </div>
              </section>

              {/* ─── Appearance ─── */}
              <section className="settings-section">
                <h3 className="settings-section-title">{t('settings.appearance')}</h3>

                {/* All themes in a single compact row */}
                <div className="theme-strip">
                  {THEMES.map((th) => (
                    <button
                      key={th.id}
                      className={`theme-dot ${themeId === th.id ? 'active' : ''}`}
                      onClick={() => setThemeId(th.id)}
                      title={th.name}
                      aria-label={th.name}
                      aria-pressed={themeId === th.id}
                    >
                      {th.id === 'auto' ? (
                        <div className="theme-dot-preview split">
                          <div className="theme-dot-half light" />
                          <div className="theme-dot-half dark" />
                        </div>
                      ) : (
                        <div className="theme-dot-preview" style={{ background: `linear-gradient(135deg, ${th.preview[0]}, ${th.preview[1]}${th.preview[2] ? ', ' + th.preview[2] : ''})` }} />
                      )}
                      {themeId === th.id && <Check size={10} className="theme-dot-check" />}
                    </button>
                  ))}
                </div>
                <span className="theme-active-label">{THEMES.find(th => th.id === themeId)?.name ?? 'Auto'}</span>
              </section>

              {/* ─── Cover Text Categories ─── */}
              <section className="settings-section">
                <h3 className="settings-section-title">{t('settings.coverTextDataset')}</h3>
                <p className="settings-hint">
                  {t('settings.coverTextDesc')}
                </p>
                <div className="dataset-chips">
                  {allCategoryIds.map((cat) => {
                    const active = isCategoryEnabled(cat.id);
                    return (
                      <label key={cat.id} className={`dataset-chip ${active ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {
                            setEnabledCategories((prev) => {
                              const next = new Set(prev);
                              if (next.has(cat.id)) { next.delete(cat.id); } else { next.add(cat.id); }
                              return next;
                            });
                          }}
                        />
                        <span className="dataset-chip-dot" style={{ background: cat.color }} />
                        <span className="dataset-chip-label">{cat.label}</span>
                      </label>
                    );
                  })}
                </div>
                {!allCategoriesEnabled && (
                  <button className="settings-link-btn" onClick={() => setEnabledCategories(new Set())} style={{ marginTop: 6 }}>
                    {t('settings.enableAll')}
                  </button>
                )}
              </section>

              {/* ─── Advanced Mode ─── */}
              <section className="settings-section">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">{t('settings.advancedMode')}</span>
                    <span className="settings-row-desc">{t('settings.advancedModeDesc')}</span>
                  </div>
                  <button
                    className={`toggle-btn ${advancedModeEnabled ? 'on' : ''}`}
                    onClick={() => setAdvancedModeEnabled((v) => !v)}
                    aria-label={t('settings.toggleAdvanced')}
                    aria-pressed={advancedModeEnabled}
                    role="switch"
                  >
                    {advancedModeEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>
              </section>

              {/* ─── Auto-Delete Timer ─── */}
              <section className="settings-section">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">{t('settings.autoDeleteTimer')}</span>
                    <span className="settings-row-desc">{t('settings.autoDeleteDesc')}</span>
                  </div>
                  <button
                    className={`toggle-btn ${autoDeleteEnabled ? 'on' : ''}`}
                    onClick={() => setAutoDeleteEnabled((v) => !v)}
                    aria-label={t('settings.toggleAutoDelete')}
                    aria-pressed={autoDeleteEnabled}
                    role="switch"
                  >
                    {autoDeleteEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>
                {autoDeleteEnabled && (
                  <div className="settings-sub">
                    <div className="auto-delete-warning">
                      <AlertTriangle size={13} />
                      <span>{t('settings.autoDeleteWarning')}</span>
                    </div>
                    <div className="settings-chip-row">
                      {(['1h', '6h', '24h', '7d', '30d'] as const).map((dur) => (
                        <button
                          key={dur}
                          className={`settings-chip ${autoDeleteDuration === dur ? 'active' : ''}`}
                          onClick={() => setAutoDeleteDuration(dur)}
                        >
                          {t(`settings.durations.${dur}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* ─── Auto-Lock ─── */}
              {masterPasswordExists && (
              <section className="settings-section">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">{t('settings.autoLockTimer')}</span>
                    <span className="settings-row-desc">{t('settings.autoLockDesc')}</span>
                  </div>
                </div>
                <div className="settings-chip-row" style={{ marginTop: '8px' }}>
                  {([1, 5, 15, 30, 0] as const).map((m) => (
                    <button
                      key={m}
                      className={`settings-chip ${autoLockMinutes === m ? 'active' : ''}`}
                      onClick={() => setAutoLockMinutes(m)}
                    >
                      {m === 0 ? t('common.never') : t('common.minutesShort', { count: m })}
                    </button>
                  ))}
                </div>
              </section>
              )}

              {/* ─── App Password Management ─── */}
              <section className="settings-section">
                <h3 className="settings-section-title"><Lock size={14} /> {t('settings.appPassword')}</h3>
                {masterPasswordExists ? (
                  <>
                    <div className="settings-info-card">
                      <Shield size={14} />
                      <span>{t('settings.appPasswordActive')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <button className="settings-link-btn" onClick={() => { setShowChangeMp(true); setMpOldPw(''); setMpNewPw(''); setMpNewConfirm(''); setMpActionError(''); setShowMpPw(false); }}>
                        {t('common.change')}
                      </button>
                      <button className="settings-link-btn" style={{ color: 'var(--red)' }} onClick={() => { setShowRemoveMp(true); setMpOldPw(''); setMpActionError(''); setShowMpPw(false); }}>
                        {t('common.remove')}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="settings-info-card">
                      <Info size={14} />
                      <span>{t('settings.appPasswordNone')}</span>
                    </div>
                    <button className="lock-screen-btn" style={{ width: 'auto', padding: '8px 16px', marginTop: '10px', fontSize: '0.8125rem' }} onClick={() => { setShowLockWarning(true); setSettingsPanelOpen(false); }}>
                      <Lock size={13} style={{ marginRight: 6, verticalAlign: -2 }} />{t('appLock.setAppPassword')}
                    </button>
                  </>
                )}
              </section>

              {/* ─── About ─── */}
              <section className="settings-section">
                <h3 className="settings-section-title">{t('settings.about')}</h3>
                <div className="settings-about">
                  <p className="about-app-name">{t('appName')}</p>
                  <p className="about-version">{t('settings.aboutVersion')}</p>
                  <p className="about-tagline">{t('settings.aboutTagline')}</p>
                  <div className="about-details">
                    <div className="about-detail-row">
                      <Shield size={13} />
                      <span>{t('settings.aboutEnc')}</span>
                    </div>
                    <div className="about-detail-row">
                      <Lock size={13} />
                      <span>{t('settings.aboutOffline')}</span>
                    </div>
                    <div className="about-detail-row">
                      <Eye size={13} />
                      <span>{t('settings.aboutDisguise')}</span>
                    </div>
                    <div className="about-detail-row">
                      <Castle size={13} />
                      <span>{t('settings.aboutMedia')}</span>
                    </div>
                  </div>
                  <p className="about-license">{t('settings.aboutLicense')}</p>
                </div>
              </section>

              {/* ─── Delete All Data ─── */}
              <section className="settings-section settings-section-danger">
                <h3 className="settings-section-title">
                  <AlertTriangle size={14} /> {t('settings.dangerZone')}
                </h3>
                {!deleteAllConfirm ? (
                  <button className="settings-danger-btn" onClick={() => setDeleteAllConfirm(true)}>
                    {t('settings.deleteAllData')}
                  </button>
                ) : (
                  <div className="settings-danger-confirm">
                    <p>{t('settings.deleteAllConfirmText')}</p>
                    <div className="settings-danger-actions">
                      <button className="settings-danger-btn confirm" onClick={() => {
                        void nukeEverything().then(() => window.location.reload());
                      }}>
                        {t('settings.deleteAllConfirmBtn')}
                      </button>
                      <button className="settings-link-btn" onClick={() => setDeleteAllConfirm(false)}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* ─── Support ─── */}
              <section className="settings-section">
                <h3 className="settings-section-title">{t('settings.supportCipher')}</h3>
                <div className="settings-support-card">
                  {themeId === 'retro' ? (
                    <div className="retro-support-banner">
                      <div className="retro-support-ascii">{'★·.·´¯`·.·★ GUESTBOOK ★·.·´¯`·.·★'}</div>
                      <div className="retro-guestbook">
                        <p>👤 <b>xX_h4ck3r_Xx</b> says: <i>"cool encryption app dude!!"</i></p>
                        <p>👤 <b>~*CyberAngel*~</b> says: <i>"best site on the web ring 💯"</i></p>
                        <p>👤 <b>anonrider99</b> says: <i>"sign my guestbook too plz"</i></p>
                      </div>
                    </div>
                  ) : (
                    <Heart size={18} className="support-heart" />
                  )}
                  <p className="support-message">{themeId === 'retro' ? 'This page is best viewed in Netscape Navigator 4.0 at 800x600. Made with Notepad. If u like this site, buy the webmaster a coffee!!' : t('settings.supportMessage')}</p>
                  <a
                    className="support-cta"
                    href="https://buymeacoffee.com/cmos_jumper"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {themeId === 'retro' ? '>>> ☕ CLICK HERE TO BUY COFFEE <<<' : `☕ ${t('settings.buyCoffee')}`}
                  </a>
                  {themeId === 'retro' ? (
                    <div className="retro-support-footer">
                      <div className="retro-visitor-counter">🖥️ Visitors: <span className="retro-counter-num">{Math.floor(Math.random() * 90000 + 10000)}</span></div>
                      <p>⚠️ This site is Y2K compliant ⚠️</p>
                    </div>
                  ) : (
                    <p className="support-footer">{t('settings.supportFooter')}</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ─── In-app guide ─── */}
      <GuidePanel
        open={guideOpen || (firstRunOpen && appUnlocked)}
        onClose={() => { setGuideOpen(false); if (firstRunOpen) dismissFirstRun(); }}
      />

      {/* ─── Tutorial overlay (spotlight + tooltip) ─── */}
      <TutorialOverlay />

      {/* ─── First-run nudge toast — invites the user to start Scenario 1 ─── */}
      {appUnlocked && !firstRunOpen && <TutorialNudge />}

      {/* ─── Fullscreen image lightbox ─── */}
      {lightboxUrl && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxUrl('')}
          role="dialog"
          aria-modal="true"
          aria-label={t('lightbox.label')}
        >
          <button className="lightbox-close" onClick={() => setLightboxUrl('')} aria-label={t('lightbox.close')}><X size={24} /></button>
          <img src={lightboxUrl} className="lightbox-image" onClick={e => e.stopPropagation()} alt={t('lightbox.alt')} />
        </div>
      )}

      {/* ─── PWA: Offline indicator ─── */}
      {pwaOffline && (
        <div className="pwa-offline-bar">
          <span className="pwa-offline-dot" />
          {t('pwa.offline')}
        </div>
      )}

      {/* ─── PWA: Update notification ─── */}
      {pwaUpdateReady && (
        <div className="pwa-update-toast">
          <span>{t('pwa.updateAvailable')}</span>
          <button className="pwa-update-btn" onClick={pwaApplyUpdate}>{t('pwa.updateBtn')}</button>
          <button className="pwa-toast-dismiss" onClick={() => setPwaUpdateReady(false)}><X size={14} /></button>
        </div>
      )}

      {/* ─── PWA: Install prompt ─── */}
      {pwaInstallPrompt && !pwaInstalled && (
        <button className="pwa-install-fab" onClick={pwaInstall} title={t('pwa.installApp')}>
          <Download size={18} />
          <span>{t('pwa.install')}</span>
        </button>
      )}

      {/* ─── Retro Theme Overlays ─── */}
      {themeId === 'retro' && (
        <>
          <div className="retro-fire-bar" />
          <div className="retro-marquee">
            <span className="retro-marquee-text">
              ★ ★ ★ Welcome to Cipher!!! ★ ★ ★ The BEST Encryption App on the World Wide Web!!! ★ ★ ★ You are visitor #31,337 ★ ★ ★ Sign our guestbook!!! ★ ★ ★ Best viewed in Netscape Navigator 4.0 at 800x600 ★ ★ ★ This page is Bobby Approved! ★ ★ ★ Made with ♥ and &lt;table&gt; tags ★ ★ ★ WARNING: This site uses cutting-edge JavaScript technology!!! ★ ★ ★
            </span>
          </div>
        </>
      )}

      {/* ─── Anime Theme Overlays ─── */}
      {themeId === 'anime' && (
        <>
          <div className="anime-top-glow" />
          <div className="anime-corner-deco anime-corner-tl" />
          <div className="anime-corner-deco anime-corner-br" />
        </>
      )}
    </div>
  );
}
