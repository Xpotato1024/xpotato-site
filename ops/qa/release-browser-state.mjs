import assert from 'node:assert/strict';

// Splitting the old sequential lane must not silently change its inherited
// browser state. Each process still owns a fresh profile, tab and HTTP server.
export async function setReleaseBrowserBoundaryState(send, boundary, {primeAsync} = {}) {
  assert.ok(['tools-start', 'remaining-resume'].includes(boundary), 'Known release browser boundary');
  if (boundary === 'remaining-resume') assert.equal(typeof primeAsync, 'boolean', 'Prime mode required to restore its exit viewport');
  await send('Network.setCacheDisabled', {cacheDisabled:true});
  await send('Network.emulateNetworkConditions', {offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  // No emulated feature override was active before the private previews, and
  // Prime clears its motion/color-scheme overrides before the later search.
  await send('Emulation.setEmulatedMedia', {features:[]});
  // The current Worker-based Prime check restores 1487x1058. Its retained
  // synchronous fallback keeps the 1440x1000 presentation-test exit viewport.
  const legacyPrime = boundary === 'remaining-resume' && !primeAsync;
  await send('Emulation.setDeviceMetricsOverride', {width:legacyPrime ? 1440 : 1487,height:legacyPrime ? 1000 : 1058,deviceScaleFactor:1,mobile:false});
  // The private Tool/Prime checks leave bypass enabled; the preceding public
  // search/tag checks did not. Do not carry their service workers across lanes.
  await send('Network.setBypassServiceWorker', {bypass:boundary === 'remaining-resume'});
}
