import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { test } from "node:test";
import { closeBrowserToolFixtureServer } from "./browser-tool-interaction.mjs";

function withinDeadline(operation, message) {
  let timer;
  return Promise.race([
    operation,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), 2000);
    }),
  ]).finally(() => clearTimeout(timer));
}

for (const [name, requestPrefix] of [
  ["an accepted browser preconnect", ""],
  ["an unfinished HTTP request", "GET /pending HTTP/1.1\r\nHost: localhost\r\n"],
]) {
  test(`fixture cleanup closes ${name} without waiting for the browser`, async () => {
    let requests = 0;
    const server = createServer((_, response) => {
      requests += 1;
      response.end();
    });
    await new Promise((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolveListen);
    });
    const accepted = once(server, "connection");
    const serverClosed = once(server, "close");
    const client = createConnection({ host: "127.0.0.1", port: server.address().port });
    client.on("error", () => {});
    const clientClosed = new Promise((resolveClose) => client.once("close", resolveClose));
    let connection;
    try {
      [connection] = await withinDeadline(accepted, "fixture connection was not accepted");
      if (requestPrefix) {
        const received = once(connection, "data");
        client.write(requestPrefix);
        await withinDeadline(received, "fixture did not receive the incomplete request");
      }
      assert.equal(client.destroyed, false);
      assert.equal(connection.destroyed, false);
      await withinDeadline(
        closeBrowserToolFixtureServer(server),
        "fixture shutdown waited for an unfinished browser connection",
      );
      await withinDeadline(clientClosed, "fixture left the browser connection open");
      assert.equal(server.listening, false);
      assert.equal(client.destroyed, true);
      assert.equal(connection.destroyed, true);
      assert.equal(requests, 0, "the connection must remain unfinished until cleanup");
    } finally {
      client.destroy();
      connection?.destroy();
      if (server.listening) {
        server.close();
      }
      await serverClosed;
    }
  });
}
