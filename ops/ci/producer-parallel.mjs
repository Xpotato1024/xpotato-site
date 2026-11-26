import { pathToFileURL } from "node:url";
import { runNpmScript } from "./ci-source.mjs";

export const producerPhases = Object.freeze({
  prepare: Object.freeze(["release:build:hosted", "ci:browsers:prepare"]),
  validate: Object.freeze(["quality:webkit:hosted", "ci:final:public"]),
});

export async function runProducerPhase(
  phase,
  run = runNpmScript,
  { log = console.log, error = console.error, now = () => performance.now() } = {},
) {
  if (!Object.hasOwn(producerPhases, phase)) {
    throw Error("Expected producer phase: prepare or validate");
  }
  // Both lanes retain the runner's process group for cancellation. A failed lane
  // cannot bypass its sibling's browser cleanup or restoration of detached HEAD.
  const results = await Promise.allSettled(
    producerPhases[phase].map(async (script) => {
      const started = now();
      log(`[ci:producer:${phase}] ${script} START`);
      try {
        await run(script);
        log(
          `[ci:producer:${phase}] ${script} END status=PASS elapsedMs=${Math.round(now() - started)}`,
        );
      } catch (failure) {
        error(
          `[ci:producer:${phase}] ${script} END status=FAIL elapsedMs=${Math.round(now() - started)}`,
        );
        throw new Error(`${script}: ${failure?.message ?? failure}`, { cause: failure });
      }
    }),
  );
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (failures.length) {
    throw new AggregateError(
      failures,
      `Producer ${phase} failed: ${failures.map((failure) => failure.message).join("; ")}`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) {
      throw Error("Expected one producer phase: prepare or validate");
    }
    if (!process.env.npm_execpath) {
      throw Error("Run producer phases through the pinned npm entrypoint");
    }
    await runProducerPhase(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
