// Password hashing and random codes, using only Web Crypto so it runs in the
// Worker and in Node (for tests).

const ITERATIONS = 100000; // the most Workers allow for PBKDF2
const encoder = new TextEncoder();

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text) =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
const toBase64Url = (bytes) =>
  toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

const derive = async (password, salt, iterations) =>
  new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits'],
      ),
      256,
    ),
  );

const sameBytes = (a, b) => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
};

export const hashPassword = async (password) => {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
};

export const verifyPassword = async (password, stored) => {
  const [scheme, iterations, salt, hash] = String(stored).split('$');
  if (scheme !== 'pbkdf2-sha256' || !salt || !hash) return false;
  const actual = await derive(password, fromBase64(salt), Number(iterations));
  return sameBytes(actual, fromBase64(hash));
};

export const sha256Hex = async (text) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(text)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/** An unguessable value for cookies (256 bits) */
export const randomToken = () => toBase64Url(randomBytes(32));

// 32 characters with no look-alikes (no I, O, 0 or 1), so 256 / 32 divides
// evenly and every character is equally likely
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** e.g. randomCode(4) -> "K7QM-X2PD-9RTA-WE4H" (80 bits) */
export const randomCode = (groups = 4, size = 4) =>
  Array.from({ length: groups }, () =>
    Array.from(randomBytes(size), (byte) => CODE_ALPHABET[byte % 32]).join(''),
  ).join('-');

/** Ignore case, dashes and spaces when someone types a code in */
export const normalizeCode = (text) =>
  String(text)
    .toUpperCase()
    .split('')
    .filter((char) => CODE_ALPHABET.includes(char))
    .join('');
