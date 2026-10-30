import { MR_BASES, UINT64_CEILING } from './options.mjs';

const abs = value => value < 0n ? -value : value;
function gcd(a, b, budget) {
  while (b !== 0n) { budget.tick(); [a, b] = [b, a % b]; }
  return a;
}
function modPow(base, exponent, modulus, budget) {
  let result = 1n;
  base %= modulus;
  while (exponent > 0n) {
    budget.tick();
    if (exponent & 1n) result = result * base % modulus;
    exponent >>= 1n;
    if (exponent) base = base * base % modulus;
  }
  return result;
}

// Called only after all primes <= 97 have been removed.
export function assessPrime(n, budget) {
  let d = n - 1n, s = 0;
  while (!(d & 1n)) { budget.tick(); d >>= 1n; s++; }
  for (const base of MR_BASES) {
    budget.tick();
    if (base % n === 0n) continue;
    let x = modPow(base, d, n, budget);
    if (x === 1n || x === n - 1n) continue;
    let passed = false;
    for (let r = 1; r < s; r++) {
      budget.tick();
      x = x * x % n;
      if (x === n - 1n) { passed = true; break; }
    }
    if (!passed) return 'composite';
  }
  return n < UINT64_CEILING ? 'proven' : 'probable';
}
export function squareRoot(n, budget) {
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  while (true) {
    budget.tick();
    const next = (x + n / x) >> 1n;
    if (next >= x) return x;
    x = next;
  }
}
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return BigInt(state >>> 0);
  };
}
export function findDivisor(n, algorithm, random, budget) {
  const step = (x, c) => { budget.tick(); return (x * x + c) % n; };
  while (true) {
    let y = 2n + random() % (n - 3n);
    const c = 1n + random() % (n - 1n);
    let g = 1n;
    if (algorithm === 'floyd') {
      let x = y;
      while (g === 1n) {
        x = step(x, c); y = step(step(y, c), c);
        g = gcd(abs(x - y), n, budget);
      }
    } else {
      let r = 1, x = y, saved = y;
      while (g === 1n) {
        x = y;
        for (let i = 0; i < r; i++) y = step(y, c);
        for (let k = 0; k < r && g === 1n; k += 64) {
          saved = y;
          let q = 1n;
          for (let i = 0; i < Math.min(64, r - k); i++) {
            y = step(y, c);
            q = q * abs(x - y) % n;
          }
          g = gcd(q, n, budget);
        }
        r *= 2;
      }
      if (g === n) {
        do { saved = step(saved, c); g = gcd(abs(x - saved), n, budget); } while (g === 1n);
      }
    }
    if (g > 1n && g < n) return g;
  }
}
