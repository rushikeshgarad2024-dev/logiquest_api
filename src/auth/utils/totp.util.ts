import { createHmac, randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 20): string {
  const bytes = randomBytes(length);
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % 32];
  }
  return secret;
}

function base32Decode(base32: string): Buffer {
  const cleanBase32 = base32.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (let i = 0; i < cleanBase32.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleanBase32[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secret: string, timeStep = 30, counterOffset = 0): string {
  const counter = Math.floor(Date.now() / 1000 / timeStep) + counterOffset;
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const secretBuffer = base32Decode(secret);
  const hmac = createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const binaryCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binaryCode % 1_000_000;
  return otp.toString().padStart(6, '0');
}

export function verifyTotp(token: string, secret: string, window = 1): boolean {
  if (!token || !secret || token.length !== 6) return false;
  for (let offset = -window; offset <= window; offset++) {
    const expected = generateTotpCode(secret, 30, offset);
    if (expected === token) {
      return true;
    }
  }
  return false;
}

export function generateTotpUri(usernameOrEmail: string, secret: string, issuer = 'LogiQuest'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(usernameOrEmail)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function generateBackupCodes(count = 8): { rawCodes: string[]; hashedCodes: string[] } {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase(); // 8-character code
    rawCodes.push(code);
    hashedCodes.push(createHash('sha256').update(code).digest('hex'));
  }
  return { rawCodes, hashedCodes };
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function encryptSecret(secret: string, keyString = 'default-secret-encryption-key-32'): string {
  const key = createHash('sha256').update(keyString).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptSecret(encryptedData: string, keyString = 'default-secret-encryption-key-32'): string {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  const [ivHex, encrypted] = encryptedData.split(':');
  const key = createHash('sha256').update(keyString).digest();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
