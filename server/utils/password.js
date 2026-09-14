const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DEFAULT_ROUNDS = 10;
const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS || `${DEFAULT_ROUNDS}`, 10) || DEFAULT_ROUNDS;

const isBcryptHash = (hash) => typeof hash === 'string' && /^\$2[abxy]\$/.test(hash);
const isSha256Hash = (hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash);
const isPbkdf2Hash = (hash) => typeof hash === 'string' && hash.startsWith('pbkdf2:');

const safeEqualHex = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length || a.length % 2 !== 0) return false;
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

const verifyPassword = async (password, storedHash) => {
  if (!password || !storedHash) {
    return { valid: false, needsUpgrade: false, scheme: 'missing' };
  }

  if (isBcryptHash(storedHash)) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsUpgrade: false, scheme: 'bcrypt' };
  }

  if (isSha256Hash(storedHash)) {
    const sha = crypto.createHash('sha256').update(password).digest('hex');
    const valid = safeEqualHex(sha, storedHash.toLowerCase());
    return { valid, needsUpgrade: valid, scheme: 'sha256' };
  }

  if (isPbkdf2Hash(storedHash)) {
    const parts = storedHash.split(':');
    if (parts.length !== 4) {
      return { valid: false, needsUpgrade: false, scheme: 'pbkdf2' };
    }
    const [, iterStr, salt, digest] = parts;
    const iterations = Number.parseInt(iterStr, 10);
    if (!iterations || !salt || !digest) {
      return { valid: false, needsUpgrade: false, scheme: 'pbkdf2' };
    }
    const keyLen = Math.floor(digest.length / 2);
    if (!keyLen || digest.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(digest)) {
      return { valid: false, needsUpgrade: false, scheme: 'pbkdf2' };
    }
    const computed = crypto.pbkdf2Sync(password, salt, iterations, keyLen, 'sha512').toString('hex');
    const valid = safeEqualHex(computed, digest.toLowerCase());
    return { valid, needsUpgrade: valid, scheme: 'pbkdf2' };
  }

  return { valid: false, needsUpgrade: false, scheme: 'unknown' };
};

module.exports = {
  hashPassword,
  verifyPassword,
  isBcryptHash,
  isSha256Hash,
  isPbkdf2Hash,
};
