import { GMP_BASE64 } from './gmp-bytes.mjs';

export async function createGmpSplit(bytes = Uint8Array.from(atob(GMP_BASE64), c => c.charCodeAt(0)), audit = {}) {
  let activeBudget = null, stopped = null, api, poisoned = false;
  const module = await WebAssembly.compile(bytes);
  const allowed = new Set(['env.budget_tick', 'wasi_snapshot_preview1.proc_exit',
    'wasi_snapshot_preview1.fd_write', 'wasi_snapshot_preview1.fd_close',
    'wasi_snapshot_preview1.fd_seek', 'wasi_snapshot_preview1.clock_time_get',
    'wasi_snapshot_preview1.fd_read', 'env.__syscall_unlinkat']);
  if (WebAssembly.Module.imports(module).some(i => i.kind !== 'function' || !allowed.has(i.module + '.' + i.name))) {
    throw new TypeError('Unexpected GMP WASM imports');
  }
  const unexpected = () => { throw new Error('Unexpected GMP WASM I/O or exit'); };
  const instance = await WebAssembly.instantiate(module, {
    env: { __syscall_unlinkat: unexpected, budget_tick() {
      if (stopped) return 0;
      try { activeBudget.tick(); return 1; }
      catch (error) { stopped = error; return 0; }
    } },
    wasi_snapshot_preview1: {
      proc_exit: unexpected, fd_write: unexpected, fd_close: unexpected, fd_seek: unexpected, fd_read: unexpected,
      clock_time_get(clockId, precision, pointer) {
        if (![0, 1, 2, 3].includes(clockId) || !Number.isInteger(pointer) ||
            pointer < 0 || pointer + 8 > api.memory.buffer.byteLength) return 28;
        // ECM's informational clock uses wall time, never an asserted CPU measurement.
        const time = clockId === 0 ? BigInt(Date.now()) * 1000000n :
          BigInt(Math.floor(performance.now() * 1000000));
        new DataView(api.memory.buffer).setBigUint64(pointer, time, true);
        return 0;
      },
    },
  });
  api = instance.exports;
  api._initialize?.();
  if (!(api.memory instanceof WebAssembly.Memory) || api.memory.buffer.byteLength !== 67108864 ||
      ['input_ptr', 'factor_ptr', 'brent_split', 'ecm_split', 'configure_ecm_audit',
        ...['mask','point','injected','gmp_allocations','direct_allocations','df','k','s','repr','ntt'].map(k => 'ecm_audit_' + k)].some(k => typeof api[k] !== 'function')) {
    throw new TypeError('Invalid GMP WASM exports');
  }
  function configureAudit(value = {}) {
    if (activeBudget || poisoned) throw Error('GMP instance retired or active');
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(k => !['stop','domain','allocation','trap'].includes(k))) throw TypeError('Invalid audit');
    const { stop = 0, domain = 0, allocation = 0, trap = 0 } = value;
    for (const [v, max] of [[stop,10],[domain,2],[allocation,1000000],[trap,10]])
      if (!Number.isSafeInteger(v) || v < 0 || v > max) throw TypeError('Invalid audit bound');
    if ((domain === 0) !== (allocation === 0)) throw TypeError('Invalid audit allocation');
    api.configure_ecm_audit(stop, domain, allocation, trap);
  }
  configureAudit(audit);
  const split = (value, budget, { algorithm, seed }) => {
    if (poisoned) throw Error('GMP instance retired after fatal error');
    if (typeof value !== 'bigint') throw new TypeError('Expected bigint');
    if (value < 5n || value >= (1n << 256n) || value % 2n === 0n) throw new RangeError('GMP range');
    if (!['gmp-brent', 'gmp-ecm'].includes(algorithm) || !Number.isSafeInteger(seed) ||
        seed < 1 || seed > 4294967295) throw new TypeError('Invalid GMP configuration');
    if (!budget || typeof budget.tick !== 'function' || activeBudget) throw new TypeError('Invalid budget');
    const memory = new Uint8Array(api.memory.buffer), pointer = api.input_ptr(), output = api.factor_ptr();
    if (pointer < 0 || pointer + 80 > memory.length || output < 0 || output + 80 > memory.length) {
      throw new TypeError('GMP WASM pointer out of bounds');
    }
    memory.fill(0, pointer, pointer + 80);
    memory.set(new TextEncoder().encode(value.toString()), pointer);
    activeBudget = budget; stopped = null;
    try {
      let status;
      try { status = api[algorithm === 'gmp-brent' ? 'brent_split' : 'ecm_split'](seed); }
      catch (error) { poisoned = true; throw error; }
      if (stopped) throw stopped;
      if (status === 0) return null;
      if (status !== 1) throw new TypeError('Invalid GMP WASM status');
      const view = memory.subarray(output, output + 80), end = view.indexOf(0);
      if (end <= 0) throw new TypeError('Invalid GMP WASM output');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(view.subarray(0, end));
      if (!/^[1-9][0-9]{0,77}$/.test(text)) throw new TypeError('Invalid GMP WASM divisor');
      const divisor = BigInt(text);
      if (divisor <= 1n || divisor >= value || value % divisor !== 0n) throw new TypeError('Invalid divisor');
      return divisor;
    } catch (error) { if (error !== stopped) poisoned = true; throw error; }
    finally { activeBudget = null; stopped = null; }
  };
  split.configureAudit = configureAudit;
  split.stats = () => {
    const mask = api.ecm_audit_mask();
    return { mask, point: api.ecm_audit_point(), injected: !!api.ecm_audit_injected(), poisoned,
      gmpAllocations: api.ecm_audit_gmp_allocations(), directAllocations: api.ecm_audit_direct_allocations(),
      parameters: mask & 2 ? { dF: api.ecm_audit_df(), k: api.ecm_audit_k(), S: api.ecm_audit_s(),
        repr: api.ecm_audit_repr(), ntt: api.ecm_audit_ntt() } : null };
  };
  return split;
}
