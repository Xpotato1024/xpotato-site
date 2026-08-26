const expectedNode = "24.19.0";
const expectedNpm = "11.19.0";
const npmVersion = /npm\/(\d+\.\d+\.\d+)/u.exec(process.env.npm_config_user_agent ?? "")?.[1];
const errors: string[] = [];
if (process.versions.node !== expectedNode) errors.push(`Node ${expectedNode} required; received ${process.versions.node}`);
if (npmVersion !== expectedNpm) errors.push(`npm ${expectedNpm} required; received ${npmVersion ?? "unknown"}`);
if (errors.length > 0) throw new Error(errors.join("\n"));
console.log(`Toolchain PASS: Node ${expectedNode}, npm ${expectedNpm}`);
