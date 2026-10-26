const MAX_INPUT_LENGTH = 4096;
const MAX_VALUE_DIGITS = 1024;
const MAX_EXPONENT = '10000';
const INPUT_GRAMMAR = /^\+?([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/;

export class IntegerInputError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IntegerInputError';
    this.code = code;
  }
}

function fail(code) {
  throw new IntegerInputError(code);
}

function readExponent(text) {
  const digits = text.replace(/^[+-]/, '').replace(/^0+/, '') || '0';
  if (digits.length > MAX_EXPONENT.length ||
      (digits.length === MAX_EXPONENT.length && digits > MAX_EXPONENT)) {
    fail('EXPONENT_OUT_OF_RANGE');
  }
  return Number(digits) * (text.startsWith('-') ? -1 : 1);
}

function normalizeDigits(digits, shift) {
  if (shift < 0) {
    const remove = -shift;
    const trailingZeros = /0*$/.exec(digits)[0].length;
    if (remove > trailingZeros) fail('NOT_AN_INTEGER');
    digits = digits.slice(0, -remove);
  } else {
    if (digits.length + shift > MAX_VALUE_DIGITS) fail('VALUE_TOO_LARGE');
    digits += '0'.repeat(shift);
  }
  if (digits.length > MAX_VALUE_DIGITS) fail('VALUE_TOO_LARGE');
  return digits;
}

export function parseIntegerInput(text) {
  if (typeof text !== 'string') fail('INVALID_TYPE');
  if (text.length > MAX_INPUT_LENGTH) fail('INPUT_TOO_LONG');
  const match = INPUT_GRAMMAR.exec(text.trim());
  if (!match) fail('INVALID_SYNTAX');
  const [, whole, fraction = '', exponentText = '0'] = match;
  const exponent = readExponent(exponentText);
  const significant = (whole + fraction).replace(/^0+/, '');
  if (!significant) return { value: 0n, canonical: '0' };
  const canonical = normalizeDigits(significant, exponent - fraction.length);
  return { value: BigInt(canonical), canonical };
}
