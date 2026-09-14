const normalizeEmail = (value) => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.toLowerCase() : null;
};

// Accepts CNPJ or CPF and returns digits only.
const normalizeCnpj = (value) => {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length ? digits : null;
};

const allDigitsEqual = (digits) => /^(\d)\1+$/.test(digits);

const isValidCpf = (digits) => {
  if (!/^\d{11}$/.test(digits)) return false;
  if (allDigitsEqual(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(digits[10]);
};

const isValidCnpj = (digits) => {
  if (!/^\d{14}$/.test(digits)) return false;
  if (allDigitsEqual(digits)) return false;

  const calc = (base, factors) => {
    const sum = base.split('').reduce((acc, n, idx) => acc + Number(n) * factors[idx], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(digits.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${d1}${d2}`);
};

const validateCpfCnpj = (value) => {
  const digits = normalizeCnpj(value);
  if (!digits) return false;
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
};

module.exports = {
  normalizeEmail,
  normalizeCnpj,
  validateCpfCnpj,
};
