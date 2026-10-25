import { SMALL_PRIMES, UINT64_CEILING } from './options.mjs';
import { assessPrime } from './arithmetic.mjs';

function integer(text) {
  if (typeof text !== 'string' || text.length > 1024 || !/^(0|[1-9][0-9]*)$/.test(text)) {
    throw new TypeError('Invalid canonical integer');
  }
  return BigInt(text);
}
function fail() { throw new TypeError('Invalid factor result'); }
export function verifySnapshot(snapshot, expectedInput) {
  const input = integer(expectedInput);
  if (!snapshot || snapshot.input !== expectedInput || !Array.isArray(snapshot.factors) ||
      snapshot.factors.length > 4096 || !Number.isSafeInteger(snapshot.operations) ||
      snapshot.operations < 0 || snapshot.operations > 50000000 ||
      !Number.isFinite(snapshot.elapsedMs) || snapshot.elapsedMs < 0) fail();
  const remaining = integer(snapshot.remaining);
  if (input < 2n && (snapshot.factors.length || remaining !== input)) fail();
  let quotient = input, previous = 1n;
  const checkedPrimes = new Set();
  const factors = snapshot.factors.map(factor => {
    if (!factor || typeof factor !== 'object') fail();
    const value = integer(factor.value);
    if (value < 2n || value < previous || value > quotient || quotient % value !== 0n) fail();
    if (factor.certainty === 'proven') {
      if (factor.method === 'small-prime') { if (!SMALL_PRIMES.includes(value)) fail(); }
      else {
        if (factor.method !== 'mr64' || value >= UINT64_CEILING) fail();
        if (!checkedPrimes.has(value)) {
          if (assessPrime(value, { tick() {} }) !== 'proven') fail();
          checkedPrimes.add(value);
        }
      }
    } else if (factor.certainty !== 'probable' || factor.method !== 'mr-fixed7' || value < UINT64_CEILING) fail();
    quotient /= value; previous = value;
    return { value: factor.value, certainty: factor.certainty, method: factor.method };
  });
  if (quotient !== remaining) fail();
  return { input: expectedInput, factors, remaining: snapshot.remaining,
    operations: snapshot.operations, elapsedMs: snapshot.elapsedMs };
}
export function resolvedPrimality(snapshot) {
  if (snapshot.factors.length === 1 && snapshot.factors[0].value === snapshot.input) {
    return snapshot.factors[0].certainty === 'proven' ? 'proven-prime' : 'probable-prime';
  }
  return 'composite';
}
export function verifyFactorResult(result, expectedInput) {
  const snapshot = verifySnapshot(result, expectedInput);
  if (!['brent', 'floyd', 'tinyqs', 'gmp-brent', 'gmp-ecm', 'siqs'].includes(result.algorithm) || !Number.isSafeInteger(result.seed) ||
      result.seed < 1 || result.seed > 4294967295) fail();
  if (result.status === 'neither') {
    if (BigInt(expectedInput) >= 2n || result.primality !== 'neither' || result.reason !== null) fail();
  } else if (['complete', 'probable'].includes(result.status)) {
    if (snapshot.remaining !== '1' || !snapshot.factors.length ||
        result.primality !== resolvedPrimality(snapshot) || result.reason !== null) fail();
    const probable = snapshot.factors.some(f => f.certainty === 'probable');
    if ((result.status === 'probable') !== probable) fail();
  } else if (result.status === 'incomplete') {
    if (BigInt(snapshot.remaining) < 2n || !['time-budget', 'operation-budget', 'algorithm-range', 'algorithm-exhausted', 'algorithm-resource'].includes(result.reason) ||
        !['unknown', 'composite'].includes(result.primality)) fail();
    if (snapshot.factors.length && result.primality !== 'composite') fail();
    if (result.reason==='algorithm-resource' && result.algorithm!=='siqs') fail();
    if (result.reason.startsWith('algorithm-') &&
        (!['tinyqs', 'gmp-brent', 'gmp-ecm', 'siqs'].includes(result.algorithm) || result.primality !== 'composite')) fail();
  } else fail();
  return { ...snapshot, status: result.status, reason: result.reason, primality: result.primality,
    algorithm: result.algorithm, seed: result.seed };
}
