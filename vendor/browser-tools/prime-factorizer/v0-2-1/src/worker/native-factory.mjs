import { WORKER_SOURCE } from './native-worker-source.mjs';
import { makeWorkerFromSource } from './source-factory.mjs';
export function makeNativeWorker(dependencies) {
  return makeWorkerFromSource(WORKER_SOURCE,dependencies);
}
