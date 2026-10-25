export const SMALL_PRIMES = Object.freeze([2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n,
  31n, 37n, 41n, 43n, 47n, 53n, 59n, 61n, 67n, 71n, 73n, 79n, 83n, 89n, 97n]);
export const MR_BASES = Object.freeze([2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n]);
export const UINT64_CEILING = 1n << 64n;
export const INPUT_CEILING = 10n ** 1024n;

export function normalizeOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Invalid options');
  const allowed = ['algorithm', 'seed', 'timeBudgetMs', 'operationBudget'];
  if (Object.keys(options).some(key => !allowed.includes(key))) throw new TypeError('Unknown option');
  const out = { algorithm: 'brent', seed: 1, timeBudgetMs: 1000, operationBudget: 1000000, ...options };
  if (!['brent', 'floyd', 'tinyqs', 'gmp-brent', 'gmp-ecm', 'siqs'].includes(out.algorithm)) throw new RangeError('Unknown algorithm');
  for (const [key, minimum, maximum] of [
    ['seed', 1, 4294967295], ['timeBudgetMs', 0, 60000], ['operationBudget', 0, 50000000],
  ]) {
    if (!Number.isSafeInteger(out[key]) || out[key] < minimum || out[key] > maximum) {
      throw new RangeError('Invalid ' + key);
    }
  }
  return Object.freeze(out);
}

export class BudgetExceeded extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}
export class Budget {
  constructor(options, now, pulse) {
    this.options = options;
    this.now = now;
    this.pulse = pulse;
    this.started = now();
    this.lastPulse = this.started;
    this.operations = 0;
  }
  tick() {
    if (this.operations >= this.options.operationBudget) throw new BudgetExceeded('operation-budget');
    const time = this.now();
    if (time - this.started >= this.options.timeBudgetMs) throw new BudgetExceeded('time-budget');
    this.operations++;
    if (time - this.lastPulse >= 100) { this.lastPulse = time; this.pulse(); }
  }
  elapsed() { return Math.max(0, this.now() - this.started); }
}
