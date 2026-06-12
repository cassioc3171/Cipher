/**
 * Smart media-aware compression with automatic file analysis.
 *
 * - Image  : Canvas resize + WebP re-encode (by resolution) + EXIF strip
 * - Video  : Canvas downscale + MediaRecorder re-encode (by resolution)
 * - Audio  : Bitrate control (quality levels) with real duration probe
 * - File   : no pre-encryption byte transform; preserve exact file bytes
 *
 * The system analyzes each file and presents only meaningful compression
 * options — eliminating redundant levels that would produce the same output.
 */

/* ====== Types ====== */

export type MediaKind = 'image' | 'audio' | 'video' | 'file';

export interface CompressOption {
  id: string;
  label: string;       // "Original", "Best", "Good", "Smallest"
  sublabel: string;    // "1280×647" or ""
  isDefault: boolean;
  estimatedSize: number; // estimated compressed attachment size in bytes
  estimatedEncryptedSize?: number;
  targetRatio?: number;
}

export interface FileAnalysis {
  kind: MediaKind;
  originalSize: number;
  options: CompressOption[];
  width?: number;
  height?: number;
  duration?: number;
  preCompressed?: boolean;
}

/* ====== Helpers ====== */

export function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Estimate the final encrypted output size for a given raw payload size.
 * Accounts for: dataUrl base64 encoding, CT2 header, salt, IV, AES-GCM tag,
 * and fflate compression of the payload.
 */
export function estimateEncryptedSize(rawBytes: number, type: 'F' | 'A'): number {
  // File/audio payload: "filename::dataUrl" → dataUrl ≈ base64(raw) ≈ raw * 1.37
  const dataUrlSize = Math.ceil(rawBytes * 1.37) + 40; // +40 for "data:type;base64,"
  const payloadSize = type === 'F' ? dataUrlSize + 60 : dataUrlSize; // +filename:: prefix
  // No fflate compression is applied to 'F'/'A' payloads in encryptData (only 'T' is compressed).
  const compressed = payloadSize;
  // AES-GCM adds 16-byte tag
  const cipherBytes = compressed + 16;
  // Output: "CT2|type|base64(salt)|base64(iv)|base64(cipher)"
  const b64Cipher = Math.ceil(cipherBytes / 3) * 4;
  return 8 + 24 + 16 + b64Cipher; // header + salt + iv + cipher
}

function res(w: number, h: number): string {
  return `${w}×${h}`;
}

function replaceExtension(fileName: string, nextExt: string): string {
  return /\.[^.]+$/.test(fileName)
    ? fileName.replace(/\.[^.]+$/, `.${nextExt}`)
    : `${fileName}.${nextExt}`;
}

/* ====== Detect media type ====== */

export function detectMediaKind(file: File): MediaKind {
  const t = file.type.toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('video/')) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','gif','webp','bmp','avif','heic','svg'].includes(ext)) return 'image';
  if (['mp3','wav','ogg','flac','aac','m4a','wma','opus'].includes(ext)) return 'audio';
  if (['mp4','webm','mkv','avi','mov','wmv','flv','m4v'].includes(ext)) return 'video';
  return 'file';
}

/* ====== IMAGE ====== */

const IMG_TARGETS: Record<string, { maxDim: number; q: number }> = {
  high:   { maxDim: 1920, q: 0.82 },
  medium: { maxDim: 1280, q: 0.70 },
  low:    { maxDim: 720,  q: 0.55 },
  repack: { maxDim: 99999, q: 0.80 },
};

async function analyzeImage(file: File): Promise<FileAnalysis> {
  const bmp = await createImageBitmap(file);
  const w = bmp.width, h = bmp.height;
  bmp.close();
  const maxDim = Math.max(w, h);
  const origEnc = estimateEncryptedSize(file.size, 'F');

  const opts: CompressOption[] = [{
    id: 'original', label: 'Original',
    sublabel: `${res(w, h)} · ~${fmt(origEnc)}`,
    isDefault: false,
    estimatedSize: file.size,
    estimatedEncryptedSize: origEnc,
  }];

  // Tiny images (< 50 KB): compression won't save meaningful bytes
  if (file.size < 50_000) {
    opts[0].isDefault = true;
    return { kind: 'image', originalSize: file.size, options: opts, width: w, height: h };
  }

  // Estimate compressed image size: pixels ratio × quality factor
  const estImgSize = (scale: number, q: number) => {
    const pixels = (w * scale) * (h * scale);
    const origPixels = w * h;
    return Math.round(file.size * (pixels / origPixels) * (q / 0.92) * 0.6);
  };

  // Resolution-based tiers
  if (maxDim > 1920) {
    const s = 1920 / maxDim;
    const est = estImgSize(s, 0.82);
    const encEst = estimateEncryptedSize(est, 'F');
    opts.push({ id: 'high', label: 'Best', sublabel: `${res(Math.round(w * s), Math.round(h * s))} · ~${fmt(encEst)}`, isDefault: true, estimatedSize: est, estimatedEncryptedSize: encEst });
  }
  if (maxDim > 1280) {
    const s = 1280 / maxDim;
    const est = estImgSize(s, 0.70);
    const encEst = estimateEncryptedSize(est, 'F');
    opts.push({ id: 'medium', label: 'Good', sublabel: `${res(Math.round(w * s), Math.round(h * s))} · ~${fmt(encEst)}`, isDefault: maxDim <= 1920, estimatedSize: est, estimatedEncryptedSize: encEst });
  }
  if (maxDim > 720) {
    const lowS = 720 / maxDim;
    const medS = maxDim > 1280 ? 1280 / maxDim : 1;
    if (Math.abs(Math.round(h * medS) - Math.round(h * lowS)) > 50) {
      const est = estImgSize(lowS, 0.55);
      const encEst = estimateEncryptedSize(est, 'F');
      opts.push({ id: 'low', label: 'Smallest', sublabel: `${res(Math.round(w * lowS), Math.round(h * lowS))} · ~${fmt(encEst)}`, isDefault: maxDim <= 1280, estimatedSize: est, estimatedEncryptedSize: encEst });
    }
  }

  // Size-based: no resolution tiers but file is large → offer WebP re-encode at same resolution
  if (opts.length === 1 && file.size > 100_000) {
    const est = Math.round(file.size * 0.55);
    const encEst = estimateEncryptedSize(est, 'F');
    opts.push({
      id: 'repack', label: 'Optimized',
      sublabel: `WebP ${res(w, h)} · ~${fmt(encEst)}`,
      isDefault: true, estimatedSize: est, estimatedEncryptedSize: encEst,
    });
    opts[0].isDefault = false;
  }

  if (opts.length === 1) opts[0].isDefault = true;
  if (!opts.some(o => o.isDefault)) opts[0].isDefault = true;
  return { kind: 'image', originalSize: file.size, options: opts, width: w, height: h };
}

async function compressImage(
  file: Blob, optionId: string,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  let w = bmp.width, h = bmp.height;

  const target = optionId !== 'original' ? IMG_TARGETS[optionId] : null;
  const quality = target?.q ?? 0.92;

  if (target && Math.max(w, h) > target.maxDim) {
    const s = target.maxDim / Math.max(w, h);
    w = Math.round(w * s); h = Math.round(h * s);
  }

  const c = new OffscreenCanvas(w, h);
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  let blob = await c.convertToBlob({ type: 'image/webp', quality });
  if (blob.type !== 'image/webp')
    blob = await c.convertToBlob({ type: 'image/jpeg', quality });

  // Don't inflate: if re-encode is bigger, return original
  if ((optionId === 'original' || optionId === 'repack') && blob.size >= file.size)
    return { blob: file instanceof File ? file : new Blob([file]), width: w, height: h };

  return { blob, width: w, height: h };
}

/**
 * Strip EXIF/metadata from an image by redrawing through canvas.
 * Returns WebP if supported, JPEG fallback. Always preserves pixels.
 * Skips if redraw inflates size (e.g. small PNGs with few colors).
 */
async function stripExif(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const w = bmp.width, h = bmp.height;
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  // High quality to preserve visual fidelity
  let blob = await c.convertToBlob({ type: 'image/webp', quality: 0.95 });
  if (blob.type !== 'image/webp')
    blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
  // If stripping inflated the file, return original untouched
  if (blob.size >= file.size) return { blob: file instanceof File ? file : new Blob([file]), width: w, height: h };
  return { blob, width: w, height: h };
}

/* ====== Helpers: duration formatting ====== */

export function fmtDuration(s: number): string {
  if (s <= 0) return '';
  if (s >= 60) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  return `${Math.round(s)}s`;
}

function getMediaDuration(file: Blob, tag: 'audio' | 'video'): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(tag);
    el.preload = 'metadata'; el.src = url;
    el.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    el.onloadedmetadata = async () => {
      const duration = tag === 'video'
        ? await resolveFiniteVideoDuration(el as HTMLVideoElement)
        : (isFinite(el.duration) ? el.duration : 0);
      URL.revokeObjectURL(url);
      resolve(duration);
    };
  });
}

/* ====== VIDEO ====== */

type SupportedVideoRecorder = {
  mimeType: string;
  playbackType: string;
};

type CaptureCapableMediaElement = HTMLMediaElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

type VideoCompressionResult = {
  blob: Blob;
  compressed: boolean;
};

type VideoCompressionTarget = {
  ratio: number;
  targetBytes: number;
  width: number;
  height: number;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
};

const VIDEO_RATIO_OPTIONS = [
  { id: 'video-70', label: '70%', ratio: 0.7 },
  { id: 'video-50', label: '50%', ratio: 0.5 },
  { id: 'video-25', label: '25%', ratio: 0.25 },
] as const;

const VIDEO_MIN_AUDIO_BPS = 24_000;
const VIDEO_MAX_AUDIO_BPS = 96_000;
const VIDEO_MIN_VIDEO_BPS = 120_000;

const VIDEO_RECORDER_CANDIDATES: SupportedVideoRecorder[] = [
  { mimeType: 'video/webm;codecs=vp8,opus', playbackType: 'video/webm; codecs="vp8, opus"' },
  { mimeType: 'video/webm;codecs=vp9,opus', playbackType: 'video/webm; codecs="vp9, opus"' },
  { mimeType: 'video/webm', playbackType: 'video/webm' },
];

function canPlayVideoType(playbackType: string): boolean {
  if (typeof document === 'undefined') return true;
  const probe = document.createElement('video');
  const support = probe.canPlayType(playbackType);
  return support === 'probably' || support === 'maybe';
}

function getSupportedVideoRecorder(): SupportedVideoRecorder | null {
  if (typeof MediaRecorder === 'undefined') return null;
  if (typeof document === 'undefined') return null;
  const probe = document.createElement('video') as CaptureCapableMediaElement;
  if (typeof probe.captureStream !== 'function' && typeof probe.mozCaptureStream !== 'function') {
    return null;
  }

  for (const candidate of VIDEO_RECORDER_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType) && canPlayVideoType(candidate.playbackType)) {
      return candidate;
    }
  }

  return null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundEven(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function stopTracks(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

function buildVideoCompressionTarget(
  originalSize: number,
  width: number,
  height: number,
  duration: number,
  ratio: number,
): VideoCompressionTarget {
  const safeDuration = duration > 0 && Number.isFinite(duration) ? duration : 30;
  const targetBytes = Math.max(Math.round(originalSize * ratio), 96_000);
  const targetTotalBps = Math.max(Math.round((targetBytes * 8) / safeDuration), VIDEO_MIN_VIDEO_BPS + VIDEO_MIN_AUDIO_BPS);

  const audioShare = ratio <= 0.25 ? 0.18 : ratio <= 0.5 ? 0.15 : 0.12;
  const audioCap = Math.max(VIDEO_MIN_AUDIO_BPS, Math.round(targetTotalBps * 0.35));
  const audioBitsPerSecond = clampNumber(Math.round(targetTotalBps * audioShare), VIDEO_MIN_AUDIO_BPS, Math.min(VIDEO_MAX_AUDIO_BPS, audioCap));
  const videoBitsPerSecond = Math.max(VIDEO_MIN_VIDEO_BPS, targetTotalBps - audioBitsPerSecond);

  const scale = Math.min(1, Math.max(0.5, Math.pow(ratio, 0.6)));
  const targetHeight = roundEven(Math.max(240, Math.min(height, Math.round(height * scale))));
  const targetWidth = roundEven(Math.max(320, Math.round(width * (targetHeight / Math.max(height, 1)))));

  return {
    ratio,
    targetBytes,
    width: targetWidth,
    height: targetHeight,
    videoBitsPerSecond,
    audioBitsPerSecond,
  };
}

function resolveFiniteVideoDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return Promise.resolve(video.duration);
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => finish(0), 4000);

    function cleanup() {
      clearTimeout(timeoutId);
      video.ondurationchange = null;
      video.ontimeupdate = null;
    }

    function finish(duration: number) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(duration > 0 && Number.isFinite(duration) ? duration : 0);
    }

    const maybeFinish = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        finish(video.duration);
      }
    };

    video.ondurationchange = maybeFinish;
    video.ontimeupdate = maybeFinish;

    try {
      video.currentTime = Number.MAX_SAFE_INTEGER;
    } catch {
      finish(0);
    }
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.05) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => finish(), 1000);

    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      video.removeEventListener('seeked', finish);
      resolve();
    }

    video.addEventListener('seeked', finish);
    try {
      video.currentTime = time;
    } catch {
      finish();
    }
  });
}

function buildOriginalVideoResult(file: Blob): VideoCompressionResult {
  return {
    blob: file instanceof File ? file : new Blob([file], { type: file.type || 'application/octet-stream' }),
    compressed: false,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read blob as data URL.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlobForRoundTrip(dataUrl: string): Blob {
  // Split on the FIRST comma only — `split(',', 2)` would drop everything
  // after a second comma, truncating any payload that contains one.
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx >= 0 ? dataUrl.slice(0, commaIdx) : '';
  const data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
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

async function validateCipherVideoRoundTrip(blob: Blob): Promise<Blob | null> {
  try {
    const dataUrl = await blobToDataUrl(blob);
    const roundTrippedBlob = dataUrlToBlobForRoundTrip(dataUrl);
    const playable = await probeVideoBlob(roundTrippedBlob);
    return playable ? roundTrippedBlob : null;
  } catch {
    return null;
  }
}

function probeVideoBlob(blob: Blob): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(true);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    let settled = false;
    const timeoutId = setTimeout(() => finish(false), 5000);
    let playbackTimeoutId: number | undefined;
    let targetPlaybackTime = 0.25;

    function finish(playable: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (playbackTimeoutId) window.clearTimeout(playbackTimeoutId);
      URL.revokeObjectURL(url);
      video.pause();
      video.onerror = null;
      video.onloadedmetadata = null;
      video.onplaying = null;
      video.ontimeupdate = null;
      video.removeAttribute('src');
      video.load();
      resolve(playable);
    }

    const finishIfPlaying = () => {
      if (video.currentTime >= targetPlaybackTime || video.ended) {
        finish(true);
      }
    };

    video.preload = 'auto';
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.onerror = () => finish(false);
    video.onplaying = () => {
      playbackTimeoutId = window.setTimeout(() => {
        finish(video.currentTime > 0.05 || video.ended);
      }, 1200);
    };
    video.ontimeupdate = finishIfPlaying;
    video.onloadedmetadata = () => {
      void resolveFiniteVideoDuration(video)
        .then((duration) => {
          const metadataValid = video.videoWidth > 0 && video.videoHeight > 0 && Number.isFinite(duration) && duration > 0;
          if (!metadataValid) {
            finish(false);
            return;
          }

          targetPlaybackTime = Math.min(Math.max(duration * 0.15, 0.25), 1.5);

          void seekVideo(video, 0)
            .then(() => video.play())
            .catch(() => finish(false));
        })
        .catch(() => finish(false));
    };
    video.src = url;
    video.load();
  });
}

function analyzeVideo(file: File): Promise<FileAnalysis> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata'; v.src = url;
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cannot load video')); };
    v.onloadedmetadata = async () => {
      const w = v.videoWidth, h = v.videoHeight;
      const dur = await resolveFiniteVideoDuration(v);
      URL.revokeObjectURL(url);
      const origEnc = estimateEncryptedSize(file.size, 'F');
      const durLabel = isFinite(dur) ? fmtDuration(dur) : '';
      const supportedRecorder = getSupportedVideoRecorder();

      const opts: CompressOption[] = [{
        id: 'original', label: 'Original',
        sublabel: durLabel ? `${res(w, h)} · ${durLabel} · ~${fmt(origEnc)}` : `${res(w, h)} · ~${fmt(origEnc)}`,
        isDefault: true,
        estimatedSize: file.size,
        estimatedEncryptedSize: origEnc,
      }];

      if (!supportedRecorder) {
        resolve({ kind: 'video', originalSize: file.size, options: opts, width: w, height: h, duration: dur });
        return;
      }

      if (file.size < 512_000) {
        resolve({ kind: 'video', originalSize: file.size, options: opts, width: w, height: h, duration: dur });
        return;
      }

      for (const preset of VIDEO_RATIO_OPTIONS) {
        const target = buildVideoCompressionTarget(file.size, w, h, dur, preset.ratio);
        const encryptedEstimate = estimateEncryptedSize(target.targetBytes, 'F');
        if (target.targetBytes >= file.size) continue;
        opts.push({
          id: preset.id,
          label: preset.label,
          sublabel: `Target ~${fmt(encryptedEstimate)} encrypted`,
          isDefault: false,
          estimatedSize: target.targetBytes,
          estimatedEncryptedSize: encryptedEstimate,
          targetRatio: preset.ratio,
        });
      }

      resolve({ kind: 'video', originalSize: file.size, options: opts, width: w, height: h, duration: dur });
    };
  });
}

function compressVideo(
  file: Blob,
  analysis: FileAnalysis,
  optionId: string,
  onProgress?: (f: number) => void,
  signal?: AbortSignal,
): Promise<VideoCompressionResult> {
  if (optionId === 'original') return Promise.resolve(buildOriginalVideoResult(file));
  const supportedRecorder = getSupportedVideoRecorder();
  const selectedOption = analysis.options.find((option) => option.id === optionId);
  const ratio = selectedOption?.targetRatio;

  if (!supportedRecorder || !ratio) {
    return Promise.reject(new Error('Video compression is not supported on this device/browser.'));
  }

  const target = buildVideoCompressionTarget(
    analysis.originalSize || file.size,
    analysis.width ?? 0,
    analysis.height ?? 0,
    analysis.duration ?? 0,
    ratio,
  );

  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUrl;
    video.onerror = () => { URL.revokeObjectURL(videoUrl); reject(new Error('Cannot load video')); };

    video.onloadedmetadata = async () => {
      const duration = await resolveFiniteVideoDuration(video);
      if (!isFinite(duration) || duration <= 0) { URL.revokeObjectURL(videoUrl); reject(new Error('Invalid duration')); return; }
      await seekVideo(video, 0);

      const mediaElement = video as CaptureCapableMediaElement;
      let recorder: MediaRecorder | null = null;
      let captureStream: MediaStream | null = null;
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        URL.revokeObjectURL(videoUrl);
        stopTracks(captureStream);
        video.pause();
        video.onended = null;
        video.ontimeupdate = null;
        video.onplaying = null;
        video.removeAttribute('src');
        video.load();
      };
      const chunks: Blob[] = [];
      let cancelled = false;
      const handleStop = () => {
        cleanup();
        if (cancelled) return;

        void (async () => {
          const blob = new Blob(chunks, { type: supportedRecorder.mimeType });
          if (blob.size === 0 || blob.size >= file.size) {
            resolve(buildOriginalVideoResult(file));
            return;
          }

          const normalizedBlob = await validateCipherVideoRoundTrip(blob);
          resolve(normalizedBlob ? { blob: normalizedBlob, compressed: true } : buildOriginalVideoResult(file));
        })().catch(() => resolve(buildOriginalVideoResult(file)));
      };
      const startRecording = () => {
        if (cancelled || recorder) return;
        captureStream = typeof mediaElement.captureStream === 'function'
          ? mediaElement.captureStream()
          : typeof mediaElement.mozCaptureStream === 'function'
            ? mediaElement.mozCaptureStream()
            : null;

        if (!captureStream) {
          cleanup();
          reject(new Error('Video compression is not supported on this device/browser.'));
          return;
        }

        try {
          recorder = new MediaRecorder(captureStream, {
            mimeType: supportedRecorder.mimeType,
            videoBitsPerSecond: target.videoBitsPerSecond,
            audioBitsPerSecond: target.audioBitsPerSecond,
          });
        } catch {
          cleanup();
          reject(new Error('Video compression is not supported on this device/browser.'));
          return;
        }

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = handleStop;
        recorder.onerror = () => { cleanup(); reject(new Error('Re-encode failed')); };
        recorder.start();
      };

      if (signal) {
        signal.addEventListener('abort', () => {
          cancelled = true;
          video.pause();
          if (recorder?.state === 'recording') {
            try { recorder.stop(); } catch { /* already stopped */ }
          }
          cleanup();
          reject(new DOMException('Compression cancelled', 'AbortError'));
        }, { once: true });
      }

      video.onplaying = () => {
        startRecording();
      };
      video.ontimeupdate = () => {
        onProgress?.(Math.min(video.currentTime / duration, 1));
      };
      video.onended = () => {
        onProgress?.(1);
        if (recorder?.state === 'recording') {
          recorder.stop();
        } else {
          cleanup();
          resolve(buildOriginalVideoResult(file));
        }
      };
      void video.play().catch((error) => {
        cleanup();
        reject(error instanceof Error ? error : new Error('Could not play video for compression.'));
      });
    };
  });
}

/* ====== AUDIO ====== */

const AUDIO_BPS: Record<string, number> = { balanced: 32_000, compact: 16_000 };

/**
 * Audio compression analysis using actual duration and bitrate.
 * Probes the file for real duration instead of guessing from file size.
 * Works correctly for any source format (WAV, MP3, FLAC, WebM, etc.).
 */
async function analyzeAudio(file: File): Promise<FileAnalysis> {
  const origEnc = estimateEncryptedSize(file.size, 'A');

  // Probe actual duration for accurate bitrate calculation
  let duration = await getMediaDuration(file, 'audio');
  let actualBps = duration > 0 ? (file.size * 8) / duration : 48_000;
  if (duration <= 0) duration = (file.size * 8) / actualBps; // fallback estimate

  const durLabel = fmtDuration(duration);
  const opts: CompressOption[] = [{
    id: 'original', label: 'Original',
    sublabel: durLabel ? `${durLabel} · ~${fmt(origEnc)}` : `~${fmt(origEnc)}`,
    isDefault: true, estimatedSize: file.size, estimatedEncryptedSize: origEnc,
  }];

  // Balanced (32 kbps): offer when source bitrate has headroom and file is non-trivial
  if (actualBps > 40_000 && file.size > 30_000) {
    const estBytes = Math.round((32_000 / 8) * duration);
    const encEst = estimateEncryptedSize(estBytes, 'A');
    opts.push({
      id: 'balanced', label: 'Balanced',
      sublabel: `32 kbps · ~${fmt(encEst)}`,
      isDefault: true, estimatedSize: estBytes, estimatedEncryptedSize: encEst,
    });
    opts[0].isDefault = false;
  }

  // Compact (16 kbps): offer when source bitrate has headroom and file is large enough
  if (actualBps > 24_000 && file.size > 100_000) {
    const estBytes = Math.round((16_000 / 8) * duration);
    const encEst = estimateEncryptedSize(estBytes, 'A');
    opts.push({
      id: 'compact', label: 'Compact',
      sublabel: `16 kbps · ~${fmt(encEst)}`,
      isDefault: false, estimatedSize: estBytes, estimatedEncryptedSize: encEst,
    });
  }

  return { kind: 'audio', originalSize: file.size, options: opts, duration };
}

/** Default voice recording: always 48 kbps Opus for good quality */
export function getVoiceRecorderOptions(): MediaRecorderOptions {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
    return { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 48_000 };
  return { mimeType: 'audio/webm', audioBitsPerSecond: 48_000 };
}

/** Re-encode audio blob at a lower bitrate using AudioContext + MediaRecorder */
async function compressAudio(
  file: Blob, optionId: string, onProgress?: (f: number) => void, signal?: AbortSignal,
): Promise<Blob> {
  const bps = AUDIO_BPS[optionId] ?? 32_000;
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus' : 'audio/webm';
  const audioCtx = new AudioContext();
  try {
    const buf = await file.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(buf);
    const duration = decoded.duration;
    const dest = audioCtx.createMediaStreamDestination();
    const src = audioCtx.createBufferSource();
    src.buffer = decoded;
    src.connect(dest);
    const rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: bps });
    const chunks: Blob[] = [];
    let cancelled = false;
    const done = new Promise<Blob>((resolve, reject) => {
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => { if (!cancelled) resolve(new Blob(chunks, { type: mime })); };
      if (signal) {
        signal.addEventListener('abort', () => {
          cancelled = true;
          try { src.stop(); } catch { /* already stopped */ }
          try { rec.stop(); } catch { /* already stopped */ }
          reject(new DOMException('Compression cancelled', 'AbortError'));
        }, { once: true });
      }
    });
    rec.start();
    src.start(0);
    const playStart = audioCtx.currentTime;
    let progressIv: number | undefined;
    if (onProgress && duration > 0) {
      progressIv = window.setInterval(() => {
        onProgress(Math.min((audioCtx.currentTime - playStart) / duration, 1));
      }, 250);
    }
    src.onended = () => {
      if (progressIv) clearInterval(progressIv);
      onProgress?.(1);
      if (!cancelled) rec.stop();
    };
    const result = await done;
    return result.size < file.size ? result : file instanceof File ? file : new Blob([file]);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return file instanceof File ? file : new Blob([file]);
  } finally {
    void audioCtx.close();
  }
}

async function analyzeGenericFile(file: File): Promise<FileAnalysis> {
  const origEnc = estimateEncryptedSize(file.size, 'F');

  const opts: CompressOption[] = [{
    id: 'original', label: 'Original', sublabel: `~${fmt(origEnc)}`, isDefault: true, estimatedSize: file.size, estimatedEncryptedSize: origEnc,
  }];

  return { kind: 'file', originalSize: file.size, options: opts, preCompressed: false };
}

/* ====== PUBLIC API ====== */

/** Analyze file → smart compression options */
export async function smartAnalyze(file: File): Promise<FileAnalysis> {
  const kind = detectMediaKind(file);
  switch (kind) {
    case 'image': return analyzeImage(file);
    case 'video': return analyzeVideo(file);
    case 'audio': return analyzeAudio(file);
    default:      return analyzeGenericFile(file);
  }
}

/** Apply chosen compression option to file */
export async function applyCompression(
  file: File,
  analysis: FileAnalysis,
  optionId: string,
  onProgress?: (f: number) => void,
  signal?: AbortSignal,
): Promise<{ blob: Blob; name: string }> {
  if (optionId === 'original' && analysis.kind !== 'image') return { blob: file, name: file.name };

  switch (analysis.kind) {
    case 'image': {
      if (optionId === 'original') {
        // Strip EXIF metadata even for "Original" — saves space & removes GPS/device info
        const stripped = await stripExif(file);
        const ext = stripped.blob.type === 'image/webp' ? 'webp' : stripped.blob.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop() || 'img';
        return { blob: stripped.blob, name: file.name.replace(/\.[^.]+$/, `.${ext}`) };
      }
      const r = await compressImage(file, optionId);
      const ext = r.blob.type === 'image/webp' ? 'webp' : 'jpg';
      return { blob: r.blob, name: file.name.replace(/\.[^.]+$/, `.${ext}`) };
    }
    case 'video': {
      const r = await compressVideo(file, analysis, optionId, onProgress, signal);
      return { blob: r.blob, name: r.compressed ? replaceExtension(file.name, 'webm') : file.name };
    }
    case 'audio': {
      const reEncoded = await compressAudio(file, optionId, onProgress, signal);
      const reEncodedName = reEncoded !== file && reEncoded.type.includes('webm')
        ? replaceExtension(file.name, 'webm')
        : file.name;
      return { blob: reEncoded, name: reEncodedName };
    }
    case 'file': {
      return { blob: file, name: file.name };
    }
    default:
      return { blob: file, name: file.name };
  }
}
