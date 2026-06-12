/**
 * Tutorial scenario registry.
 *
 * Each scenario is a short (3–8 step) walkthrough that teaches one
 * feature end-to-end. The engine resolves selectors at activation time
 * and falls back gracefully (center tooltip, no spotlight) when an
 * element is missing. See TutorialProvider for the resolver and the
 * `:last` custom suffix.
 *
 * Adding a new scenario:
 *   1. Define the steps array — each step picks a stable selector and
 *      declares whether it advances on `click`, `input`, or `next`.
 *   2. Append the scenario to SCENARIOS.
 *   3. Add `tutorial.scenarios.<id>.{title,summary,steps.<id>.{title,body}}`
 *      keys to `src/i18n/locales/{en,fa}.json`.
 *   4. Run the Playwright sweeps at desktop and mobile.
 */

import type { TutorialScenario } from './types';

/* ──── Stable selectors shared across scenarios ──────────────────────── */
// The send button changes aria-label between "Encrypt & send" and
// "Decrypt" depending on composer state, so target the stable class.
const SEND_BTN = 'button.composer-send';
const PASSWORD_INPUT = 'input.sec-input[placeholder]';
const OBF_TRIGGER = '.composer-settings-btn';
const OBF_POPOVER = '.obf-popover';
const OBF_STANDARD_ITEM = '.obf-popover .obf-option:first-of-type';
const OBF_EMOJI_ITEM = '.obf-popover .obf-option:nth-of-type(2)';
const OBF_STEG_ITEM = '.obf-popover .obf-option:nth-of-type(4)';
const OBF_QR_ITEM = '.obf-popover .obf-option:nth-of-type(5)';
const STEG_COVER_PREVIEW = '.steg-cover-preview, .steg-spectrum-track';
const STEG_SHUFFLE = '.steg-shuffle-btn';
const LAST_QR_IMAGE = '.msg-bubble.encrypt:last .msg-qr-image';
const LAST_ENCRYPT_FILECARD = '.msg-bubble.encrypt:last .msg-file-card';
const COMPOSER_ATTACH = '.composer-attach';
const COMPOSER_ATTACHMENTS = '.composer-attachments';
const PAIRED_TAB = '.mode-switch button:nth-child(2)';
const PAIRED_NAME_INPUT = '.paired-step input.sec-input.ecc';
const PAIRED_NAME_NEXT = '.paired-step .paired-inline-row .sec-btn.primary';
const PAIRED_COPY_BTN = '.paired-code-row .sec-btn:nth-of-type(1)';
const PAIRED_FRIEND_INPUT = '.paired-step input.sec-input.ecc';
const PAIRED_FRIEND_DONE = '.paired-step .paired-inline-row .sec-btn.primary';
const LOCK_SIDEBAR_BTN = '.sidebar-lock-btn';
const LOCK_WARNING_OK = '.auth-dialog-modal .lock-screen-btn';
const LOCK_SETUP_INPUT = '.auth-dialog-modal input.lock-screen-input';
const LOCK_SETUP_SAVE = '.auth-dialog-modal .lock-screen-btn';
const COMPOSER = '.composer-textarea, textarea.composer-textarea, .composer textarea';
// `:last` is a custom suffix understood by resolveSelector — CSS
// `:last-of-type` only checks tag name and breaks once unrelated siblings
// (decrypted bubble, scroll-end ref, success toast) appear after the target.
const LAST_ENCRYPT_OUTPUT = '.msg-bubble.encrypt:last .msg-output';
const LAST_ENCRYPT_COPY = '.msg-bubble.encrypt:last .msg-action-btn';
const LAST_DECRYPT_OUTPUT = '.msg-bubble.decrypt:last .msg-output';

/** Wait for a selector to appear in the DOM (up to `timeoutMs`). */
function waitForElement(selector: string, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) return resolve();
    const start = performance.now();
    const id = window.setInterval(() => {
      if (document.querySelector(selector) || performance.now() - start > timeoutMs) {
        window.clearInterval(id);
        resolve();
      }
    }, 60);
  });
}

/** Ensure a chat is open so the composer / mode-switch are mounted. */
async function ensureChatOpen(): Promise<void> {
  if (!document.querySelector('.composer-send')) {
    // `.new-chat-gem` lives in the sidebar header and is always rendered
    // (the sidebar is just toggled with a `collapsed` CSS class). Class-
    // based selector so it works in any locale.
    const newChatBtn = document.querySelector<HTMLElement>('.new-chat-gem');
    newChatBtn?.click();
    await waitForElement('.composer-send');
  }
}

/** Programmatically inject a password into the security-strip input so a
 *  scenario can demonstrate its core feature without making the user
 *  re-type a password they've already set. No-op if the password is
 *  locked (input element is hidden behind a peek strip). */
function ensurePasswordSet(value = 'tutorial-pass'): void {
  const el = document.querySelector<HTMLInputElement>('input.sec-input[placeholder]');
  if (!el) return;
  if (el.value.length >= 4) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ──── Scenario 1 — Encrypt a simple message ────────────────────────── *
 * Trimmed from 11 → 8 steps. Three pure-Next recap steps (intro,
 * encryptedOutput, finished) got merged into the action step that
 * follows them. The pasteBack input step stays separate from the
 * Decrypt click step because the engine can't bind two different
 * advance modes (input + click) to one step.
 */
export const ENCRYPT_SIMPLE: TutorialScenario = {
  id: 'encryptSimple',
  estimatedMinutes: 2,
  setup: ensureChatOpen,
  steps: [
    {
      id: 'passwordField',
      selector: PASSWORD_INPUT,
      side: 'bottom',
      advanceOn: 'input',
      inputMinLength: 4,
    },
    {
      id: 'openObf',
      selector: OBF_TRIGGER,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'pickStandard',
      selector: OBF_STANDARD_ITEM,
      side: 'top',
      advanceOn: 'click',
      setup: () => {
        if (!document.querySelector(OBF_POPOVER)) {
          (document.querySelector('.composer-settings-btn') as HTMLElement | null)?.click();
        }
      },
    },
    {
      id: 'typeMessage',
      selector: COMPOSER,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 1,
    },
    {
      id: 'pressEncrypt',
      selector: SEND_BTN,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'pressCopy',
      selector: LAST_ENCRYPT_COPY,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'pasteBack',
      selector: COMPOSER,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 8,
    },
    {
      id: 'pressDecrypt',
      selector: SEND_BTN,
      side: 'top',
      advanceOn: 'click',
    },
  ],
};

/* ──── Scenario 2 — Send an emoji-disguised message ─────────────────── *
 * The user has already learned how to encrypt. This scenario shows
 * them how to disguise the output as an emoji stream. 6 steps.
 */
export const ENCRYPT_EMOJI: TutorialScenario = {
  id: 'encryptEmoji',
  estimatedMinutes: 1,
  // Auto-set a password so the scenario can demonstrate the Emoji
  // disguise without re-teaching the password basics — that's the job
  // of Scenario 1. Empty composer too, so the user starts fresh.
  setup: async () => {
    await ensureChatOpen();
    ensurePasswordSet();
    const ta = document.querySelector<HTMLTextAreaElement>(
      '.composer-textarea, textarea.composer-textarea, .composer textarea',
    );
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(ta, '');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  steps: [
    {
      id: 'openObf',
      selector: OBF_TRIGGER,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'pickEmoji',
      selector: OBF_EMOJI_ITEM,
      side: 'top',
      advanceOn: 'click',
      setup: () => {
        if (!document.querySelector(OBF_POPOVER)) {
          (document.querySelector('.composer-settings-btn') as HTMLElement | null)?.click();
        }
      },
    },
    {
      id: 'typeMessage',
      selector: COMPOSER,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 1,
    },
    {
      id: 'pressEncrypt',
      selector: SEND_BTN,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'lookEmoji',
      selector: LAST_ENCRYPT_OUTPUT,
      side: 'top',
      advanceOn: 'next',
    },
  ],
};

/* ──── Scenario 3 — Hide a message inside cover text (Steg) ─────────── *
 * 7 steps. Demonstrates the plausible-deniability mode: the encrypted
 * output is wrapped inside a normal-looking sentence using zero-width
 * characters. Pre-seeds a password so the user focuses on the cover.
 */
export const ENCRYPT_STEG: TutorialScenario = {
  id: 'encryptSteg',
  estimatedMinutes: 1,
  setup: async () => {
    await ensureChatOpen();
    ensurePasswordSet();
    const ta = document.querySelector<HTMLTextAreaElement>(
      '.composer-textarea, textarea.composer-textarea, .composer textarea',
    );
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(ta, '');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  steps: [
    {
      id: 'openObf',
      selector: OBF_TRIGGER,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'pickSteg',
      selector: OBF_STEG_ITEM,
      side: 'top',
      advanceOn: 'click',
      setup: () => {
        if (!document.querySelector(OBF_POPOVER)) {
          (document.querySelector('.composer-settings-btn') as HTMLElement | null)?.click();
        }
      },
    },
    {
      id: 'lookAtCover',
      selector: STEG_COVER_PREVIEW,
      side: 'top',
      advanceOn: 'next',
    },
    {
      id: 'rollCover',
      selector: STEG_SHUFFLE,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'typeMessage',
      selector: COMPOSER,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 1,
    },
    {
      id: 'pressEncrypt',
      selector: SEND_BTN,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'lookSteg',
      selector: LAST_ENCRYPT_OUTPUT,
      side: 'top',
      advanceOn: 'next',
    },
  ],
};

/* ──── Scenario 4 — Send a QR-coded message ─────────────────────────── *
 * 5 steps. Output is a scannable QR image — ideal for in-person hand-
 * offs or screen sharing.
 */
export const ENCRYPT_QR: TutorialScenario = {
  id: 'encryptQR',
  estimatedMinutes: 1,
  setup: async () => {
    await ensureChatOpen();
    ensurePasswordSet();
    const ta = document.querySelector<HTMLTextAreaElement>(
      '.composer-textarea, textarea.composer-textarea, .composer textarea',
    );
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(ta, '');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  steps: [
    {
      id: 'openObf',
      selector: OBF_TRIGGER,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'pickQR',
      selector: OBF_QR_ITEM,
      side: 'top',
      advanceOn: 'click',
      setup: () => {
        if (!document.querySelector(OBF_POPOVER)) {
          (document.querySelector('.composer-settings-btn') as HTMLElement | null)?.click();
        }
      },
    },
    {
      id: 'typeMessage',
      selector: COMPOSER,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 1,
    },
    {
      id: 'pressEncrypt',
      selector: SEND_BTN,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'lookQR',
      selector: LAST_QR_IMAGE,
      side: 'top',
      advanceOn: 'next',
    },
  ],
};

/* ──── Scenario 5 — Encrypt an image ─────────────────────────────── *
 * 5 steps. The user attaches any image; Cipher wraps it in an
 * encrypted file. The Next button on the attach step is gated by
 * canAdvance() so the user can't skip past it without actually
 * attaching something. */
export const ENCRYPT_IMAGE: TutorialScenario = {
  id: 'encryptImage',
  estimatedMinutes: 1,
  setup: async () => {
    await ensureChatOpen();
    ensurePasswordSet('tutorial-image-pw');
    // Ensure obfuscation is Standard (the file flow only works in modes
    // that accept arbitrary content, not text-only modes).
    const ta = document.querySelector<HTMLTextAreaElement>(
      '.composer-textarea, textarea.composer-textarea, .composer textarea',
    );
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(ta, '');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  steps: [
    {
      // Merged "open attach" + "pick a photo" into one step — the
      // attach button opens the file picker, which then surfaces an
      // attachment in the composer. Next stays disabled until the
      // attachment actually appears in the DOM.
      id: 'attachImage',
      selector: COMPOSER_ATTACH,
      side: 'top',
      advanceOn: 'next',
      canAdvance: () => !!document.querySelector(COMPOSER_ATTACHMENTS),
    },
    {
      id: 'typeCaption',
      selector: COMPOSER,
      side: 'top',
      advanceOn: 'next',
      canAdvance: () => true,
    },
    {
      id: 'pressEncrypt',
      selector: SEND_BTN,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'lookFile',
      selector: LAST_ENCRYPT_FILECARD,
      side: 'top',
      advanceOn: 'next',
    },
  ],
};

/** Generate a real P-256 public key on the fly for the Paired scenario.
 *  No matching private key is kept — the tutorial only demonstrates the
 *  UI flow, not real-message exchange. Each tutorial run uses a fresh
 *  random key so the user sees the actual format. */
async function generateFakeFriendCode(): Promise<string> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
  const raw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  let binary = '';
  for (const b of new Uint8Array(raw)) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Set the value of a React-controlled input so onChange fires. */
function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ──── Scenario 6 — Set up a Paired chat ─────────────────────────── *
 * 7 steps. Shows the no-shared-password flow end-to-end. The fake
 * friend's code is generated at runtime as a real P-256 public key —
 * we don't keep the matching private key, so this can only demonstrate
 * the setup UI, not a real two-way exchange. */
export const PAIRED_SETUP: TutorialScenario = {
  id: 'pairedSetup',
  estimatedMinutes: 2,
  setup: async () => {
    // Start a fresh chat in paired mode. ensureChatOpen creates one if
    // none exists; we then click the Paired tab.
    await ensureChatOpen();
    const pairedTab = document.querySelector<HTMLElement>(PAIRED_TAB);
    if (pairedTab && !pairedTab.classList.contains('ecc-active')) {
      pairedTab.click();
      await waitForElement('.paired-panel');
    }
  },
  steps: [
    {
      id: 'nameTheChat',
      selector: PAIRED_NAME_INPUT,
      side: 'bottom',
      advanceOn: 'input',
      inputMinLength: 2,
    },
    {
      id: 'confirmName',
      selector: PAIRED_NAME_NEXT,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'copyMyCode',
      selector: PAIRED_COPY_BTN,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'pasteFriendCode',
      selector: PAIRED_FRIEND_INPUT,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 20,
      // Pre-fill the field with a freshly-generated demo friend code
      // so the user sees the real key format without needing a partner.
      setup: async () => {
        const input = document.querySelector<HTMLInputElement>(PAIRED_FRIEND_INPUT);
        if (input && (!input.value || input.value.length < 20)) {
          try {
            const code = await generateFakeFriendCode();
            setInputValue(input, code);
          } catch { /* swallow */ }
        }
      },
    },
    {
      id: 'confirmPairing',
      selector: PAIRED_FRIEND_DONE,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'typeMessage',
      selector: COMPOSER,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 1,
    },
    {
      id: 'pressEncrypt',
      selector: SEND_BTN,
      side: 'top',
      advanceOn: 'click',
    },
  ],
};

/* ──── Scenario 7 — Set the app password ─────────────────────────── *
 * 4 steps. Walks the user through the master-password lifecycle. The
 * final Save click really does encrypt all the local state — the
 * tutorial copy says so up front so it's an informed action, not a
 * surprise. */
export const SET_APP_PASSWORD: TutorialScenario = {
  id: 'setAppPassword',
  estimatedMinutes: 1,
  setup: async () => {
    // On mobile the sidebar is collapsed by default — open it so the
    // lock button in the sidebar header is reachable.
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('collapsed')) {
      const open = document.querySelector<HTMLElement>('.rail-btn-open');
      open?.click();
      await waitForElement('.sidebar:not(.collapsed)');
    }
  },
  steps: [
    {
      id: 'openLockBtn',
      selector: LOCK_SIDEBAR_BTN,
      side: 'right',
      advanceOn: 'click',
    },
    {
      id: 'acknowledgeWarning',
      selector: LOCK_WARNING_OK,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'typeNewPassword',
      selector: LOCK_SETUP_INPUT,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 4,
    },
    {
      id: 'pressSave',
      selector: LOCK_SETUP_SAVE,
      side: 'top',
      advanceOn: 'click',
    },
  ],
};

/* ──── Scenario 8 — Hide a message in a carrier image (LSB steg) ───── *
 * 6 steps. Enables Steg mode, picks a PNG carrier, types the secret,
 * encrypts. The output PNG looks identical but carries the ciphertext in
 * the least-significant bits of its color channels.
 */
const STEG_CARRIER_IMAGE_BTN = '.steg-carrier-inline button:first-of-type';
const STEG_CARRIER_AUDIO_BTN = '.steg-carrier-inline button:nth-of-type(2)';
const STEG_CARRIER_ACTIVE = '.steg-carrier-chip.active';

export const STEG_CARRIER_IMAGE: TutorialScenario = {
  id: 'stegCarrierImage',
  estimatedMinutes: 2,
  setup: async () => {
    await ensureChatOpen();
    ensurePasswordSet();
    const ta = document.querySelector<HTMLTextAreaElement>(
      '.composer-textarea, textarea.composer-textarea, .composer textarea',
    );
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(ta, '');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  steps: [
    {
      id: 'openObf',
      selector: OBF_TRIGGER,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'pickSteg',
      selector: OBF_STEG_ITEM,
      side: 'top',
      advanceOn: 'click',
      setup: () => {
        if (!document.querySelector(OBF_POPOVER)) {
          (document.querySelector('.composer-settings-btn') as HTMLElement | null)?.click();
        }
      },
    },
    {
      id: 'pickImageCarrier',
      selector: STEG_CARRIER_IMAGE_BTN,
      side: 'top',
      advanceOn: 'next',
      canAdvance: () => !!document.querySelector(STEG_CARRIER_ACTIVE),
    },
    {
      id: 'typeMessage',
      selector: COMPOSER,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 1,
    },
    {
      id: 'pressEncrypt',
      selector: SEND_BTN,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'lookResult',
      selector: LAST_ENCRYPT_FILECARD,
      side: 'top',
      advanceOn: 'next',
    },
  ],
};

/* ──── Scenario 9 — Hide a message in a carrier audio (LSB steg) ────── *
 * 6 steps. Enables Steg mode, picks a WAV carrier, types the secret,
 * encrypts. The output WAV sounds identical but carries the ciphertext in
 * the least-significant bits of its PCM samples.
 */
export const STEG_CARRIER_AUDIO: TutorialScenario = {
  id: 'stegCarrierAudio',
  estimatedMinutes: 2,
  setup: async () => {
    await ensureChatOpen();
    ensurePasswordSet();
    const ta = document.querySelector<HTMLTextAreaElement>(
      '.composer-textarea, textarea.composer-textarea, .composer textarea',
    );
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(ta, '');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },
  steps: [
    {
      id: 'openObf',
      selector: OBF_TRIGGER,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'pickSteg',
      selector: OBF_STEG_ITEM,
      side: 'top',
      advanceOn: 'click',
      setup: () => {
        if (!document.querySelector(OBF_POPOVER)) {
          (document.querySelector('.composer-settings-btn') as HTMLElement | null)?.click();
        }
      },
    },
    {
      id: 'pickAudioCarrier',
      selector: STEG_CARRIER_AUDIO_BTN,
      side: 'top',
      advanceOn: 'next',
      canAdvance: () => !!document.querySelector(STEG_CARRIER_ACTIVE),
    },
    {
      id: 'typeMessage',
      selector: COMPOSER,
      side: 'top',
      advanceOn: 'input',
      inputMinLength: 1,
    },
    {
      id: 'pressEncrypt',
      selector: SEND_BTN,
      side: 'top',
      advanceOn: 'click',
    },
    {
      id: 'lookResult',
      selector: LAST_ENCRYPT_FILECARD,
      side: 'top',
      advanceOn: 'next',
    },
  ],
};

export const SCENARIOS: Record<string, TutorialScenario> = {
  encryptSimple: ENCRYPT_SIMPLE,
  encryptEmoji: ENCRYPT_EMOJI,
  encryptSteg: ENCRYPT_STEG,
  encryptQR: ENCRYPT_QR,
  encryptImage: ENCRYPT_IMAGE,
  pairedSetup: PAIRED_SETUP,
  setAppPassword: SET_APP_PASSWORD,
  stegCarrierImage: STEG_CARRIER_IMAGE,
  stegCarrierAudio: STEG_CARRIER_AUDIO,
};

export type ScenarioId = keyof typeof SCENARIOS;

export function getScenario(id: string): TutorialScenario | null {
  return (SCENARIOS as Record<string, TutorialScenario>)[id] ?? null;
}

// Suppress unused-export warnings — kept exported for future scenarios.
export { LAST_DECRYPT_OUTPUT };
