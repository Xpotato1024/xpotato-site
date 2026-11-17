/** Set before importing schema modules: even a caught Function probe violates strict CSP. */
const scope=globalThis as typeof globalThis & {__zod_globalConfig?:Record<string,unknown>};
scope.__zod_globalConfig={...(scope.__zod_globalConfig??{}),jitless:true};
export {};
