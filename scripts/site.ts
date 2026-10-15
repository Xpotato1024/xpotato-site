import { articleCli } from "../packages/article-pipeline/src/cli.js";
import { repository, loadRepository } from "./article-repository.js";
process.exitCode=await articleCli(process.argv.slice(2),repository,loadRepository);
