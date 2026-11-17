export const applicationBuildScripts = Object.freeze(["build:site", "build:editor"]);
export async function runApplicationBuilds(run) {
  const results = await Promise.allSettled(applicationBuildScripts.map((script) => run(script)));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length)
    throw new AggregateError(
      failed.map((result) => result.reason),
      "Application build failed",
    );
}
