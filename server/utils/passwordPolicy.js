const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const DIGIT_REGEX = /\d/;

const validateStrongPassword = (password) => {
  const value = String(password || '');
  if (value.length < 8) {
    return { valid: false, message: 'A senha deve ter no minimo 8 caracteres.' };
  }
  if (!UPPERCASE_REGEX.test(value)) {
    return { valid: false, message: 'A senha deve conter ao menos 1 letra maiuscula.' };
  }
  if (!LOWERCASE_REGEX.test(value)) {
    return { valid: false, message: 'A senha deve conter ao menos 1 letra minuscula.' };
  }
  if (!DIGIT_REGEX.test(value)) {
    return { valid: false, message: 'A senha deve conter ao menos 1 numero.' };
  }
  if (!SPECIAL_CHAR_REGEX.test(value)) {
    return { valid: false, message: 'A senha deve conter ao menos 1 caractere especial.' };
  }
  return { valid: true, message: null };
};

module.exports = {
  validateStrongPassword,
};
