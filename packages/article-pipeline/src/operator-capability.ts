// Private executable composition boundary. Neither marker can be imported
// from JSON or established by a mode/verified flag. These markers do not prove
// provider observations; the approved operation and Server policy/bytes are
// independently revalidated at every use.
const operations=new WeakSet<object>(),sessions=new WeakSet<object>();
export const rememberApprovedOperation=<T extends object>(value:T):T=>{operations.add(value);return value;};
export const isApprovedOperation=(value:object)=>operations.has(value);
export const rememberOperatorSession=<T extends object>(value:T):T=>{sessions.add(value);return value;};
export const isOperatorSession=(value:object)=>sessions.has(value);
