import assert from 'node:assert/strict';

// Only call for this test's fresh, owned browser profile. Chrome can restore a
// scoped tab when that profile is restarted, alongside the requested blank tab.
export async function isolatePwaPage({ send, currentTargetId, origin, until }) {
  const closed = new Set();
  const closeRestored = async () => {
    const pages = (await send('Target.getTargets')).targetInfos.filter(target => target.type === 'page');
    assert.ok(pages.some(target => target.targetId === currentTargetId), 'PWA test page exists');
    for (const target of pages) {
      assert.ok(target.url === 'about:blank' || new URL(target.url).origin === origin, 'Unexpected page in the owned PWA test profile');
    }
    const restored = pages.filter(target => target.targetId !== currentTargetId);
    for (const target of restored) if (!closed.has(target.targetId)) {
      assert.equal((await send('Target.closeTarget', { targetId: target.targetId })).success, true, 'Restored PWA page closes');
      closed.add(target.targetId);
    }
    return restored.length === 0;
  };
  await closeRestored();
  let failure;
  await until(async () => {
    // A restored page may appear while an earlier close request is completing.
    // Validate that inventory too; never retry the same close request blindly.
    try { return await closeRestored(); }
    catch (error) { failure = error; return true; }
  }, 'one isolated PWA page');
  if (failure) throw failure;
  return { restoredPagesClosed: closed.size, isolatedPage: true };
}
