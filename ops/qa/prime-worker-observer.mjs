// Configure independent observation domains together while the Worker is paused.
// Do not resume until every acknowledgement arrives: no unobserved startup window.
export async function preparePrimeWorkerObserver(send, sessionId) {
  await Promise.all([
    send('Network.enable', {}, sessionId),
    send('Network.setCacheDisabled', {cacheDisabled:true}, sessionId),
    send('Runtime.enable', {}, sessionId),
  ]);
  await send('Runtime.runIfWaitingForDebugger', {}, sessionId);
}
