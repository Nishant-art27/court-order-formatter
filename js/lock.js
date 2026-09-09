// Frontend-only access gate for the Order Formatter.
//
// The app is fully static (no backend), so this gate is a deterrent that keeps
// casual visitors out — it is not a substitute for server-side authentication.
// The passkey itself never appears in the source; only a salted SHA-256 hash
// does. Once unlocked, the browser remembers the unlock in localStorage until
// the user presses "Lock" in the header (or the passkey hash changes).
//
// The application code (main.js) is only imported after a successful unlock.
// To change the passkey, see README.md → "Access lock".

const PASSKEY_SALT = 'court-order-formatter/v1:';
const PASSKEY_HASH = '7b63f58a58ec3253582dbeb6301d638a1235e2f467fb72ccc60ec6614dab51df';

const UNLOCK_KEY = 'of.unlocked';
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30 * 1000;

const $ = (id) => document.getElementById(id);

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function readStoredUnlock() {
  try { return localStorage.getItem(UNLOCK_KEY); } catch { return null; }
}

function writeStoredUnlock(value) {
  try {
    if (value) localStorage.setItem(UNLOCK_KEY, value);
    else localStorage.removeItem(UNLOCK_KEY);
  } catch { /* storage unavailable — the unlock simply won't persist */ }
}

// ---------------------------------------------------------------------------
// Lock / unlock

let appStarted = false;

function unlockApp() {
  document.body.classList.remove('is-locked');
  $('lock-screen').hidden = true;
  if (!appStarted) {
    appStarted = true;
    import('./main.js');
  }
}

function lockApp() {
  writeStoredUnlock(null);
  location.reload();
}

// ---------------------------------------------------------------------------
// Lock screen UI

function showError(message) {
  const el = $('lock-error');
  el.textContent = message || '';
  el.hidden = !message;
}

function shake() {
  const card = $('lock-form');
  card.classList.remove('is-shake');
  void card.offsetWidth; // restart the animation on repeated failures
  card.classList.add('is-shake');
}

let failures = 0;
let cooldownUntil = 0;
let cooldownTimer = null;

function startCooldown() {
  cooldownUntil = Date.now() + COOLDOWN_MS;
  const input = $('lock-input');
  const submit = $('lock-submit');
  input.disabled = true;
  submit.disabled = true;

  const tick = () => {
    const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(cooldownTimer);
      failures = 0;
      input.disabled = false;
      submit.disabled = false;
      showError('');
      input.focus();
      return;
    }
    showError(`Too many wrong attempts. Try again in ${left}s.`);
  };
  tick();
  cooldownTimer = setInterval(tick, 500);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (Date.now() < cooldownUntil) return;

  const input = $('lock-input');
  const submit = $('lock-submit');
  const passkey = input.value.trim();

  if (!passkey) {
    showError('Please enter the passkey.');
    input.focus();
    return;
  }
  if (!(globalThis.crypto && crypto.subtle)) {
    showError('Secure context required — open this page over https:// or localhost.');
    return;
  }

  submit.disabled = true;
  try {
    const hash = await sha256Hex(PASSKEY_SALT + passkey);
    if (hash === PASSKEY_HASH) {
      writeStoredUnlock(hash);
      showError('');
      unlockApp();
      return;
    }

    failures++;
    input.value = '';
    shake();
    if (failures >= MAX_ATTEMPTS) {
      startCooldown();
      return;
    }
    const left = MAX_ATTEMPTS - failures;
    showError(`Incorrect passkey. ${left} attempt${left === 1 ? '' : 's'} left.`);
    input.focus();
  } finally {
    if (Date.now() >= cooldownUntil) submit.disabled = false;
  }
}

function bindVisibilityToggle() {
  const toggle = $('lock-toggle');
  const input = $('lock-input');
  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? '🙈' : '👁️';
    toggle.setAttribute('aria-label', show ? 'Hide passkey' : 'Show passkey');
    input.focus();
  });
}

function init() {
  $('lock-form').addEventListener('submit', handleSubmit);
  $('btn-lock').addEventListener('click', lockApp);
  bindVisibilityToggle();

  if (readStoredUnlock() === PASSKEY_HASH) {
    unlockApp();
    return;
  }
  $('lock-input').focus();
}

init();
