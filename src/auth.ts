/**
 * Password handling. Passwords are never stored: each account keeps a random
 * salt and a PBKDF2-SHA256 hash derived with the browser's WebCrypto API.
 */

const ITERATIONS = 310_000;
const encoder = new TextEncoder();

const toB64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
};
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface PasswordHash {
  salt: string;
  hash: string;
  iterations: number;
}

export async function hashPassword(password: string, saltB64?: string, iterations: number = ITERATIONS): Promise<PasswordHash> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Secure sign-in needs HTTPS. Open the site over https:// and try again.');
  }
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, key, 256);
  return { salt: toB64(salt), hash: toB64(bits), iterations };
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Human-readable list of what a password is still missing. Empty = acceptable. */
export function passwordProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 8) out.push('at least 8 characters');
  if (!/[a-z]/.test(pw)) out.push('a lowercase letter');
  if (!/[A-Z]/.test(pw)) out.push('an uppercase letter');
  if (!/\d/.test(pw)) out.push('a number');
  return out;
}

/** 0 (empty) to 4 (strong), for the strength meter. */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) score++;
  return score;
}
