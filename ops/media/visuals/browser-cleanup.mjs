import {
  hasLiveLinuxGroup,
  closeOwnedGroup,
  waitForOwnedGroupExit,
} from "../../qa/parallel-browser-suites.mjs";
import { cleanupBrowserStorage } from "./browser-storage.mjs";
const pidAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
};

/** The Linux group outlives its leader; its children must exit before storage is removed. */
export async function finishBrowserRuntime(
  binding,
  {
    platform = process.platform,
    liveGroup = hasLiveLinuxGroup,
    livePid = pidAlive,
    stopGroup = closeOwnedGroup,
    waitGroup = waitForOwnedGroupExit,
    removeStorage = cleanupBrowserStorage,
  } = {},
) {
  if (!binding || !Number.isSafeInteger(binding.pid) || binding.pid < 2)
    throw Error("Invalid owned browser identity");
  let forced = false;
  if (platform === "linux") {
    if (binding.ownedGroup !== true) throw Error("Linux browser requires an owned process group");
    if (liveGroup(binding.pid)) {
      await stopGroup({ pid: binding.pid });
      forced = true;
    }
    await waitGroup(binding.pid);
  } else if (livePid(binding.pid)) {
    await stopGroup({ pid: binding.pid, exitCode: null, signalCode: null });
    forced = true;
    if (livePid(binding.pid)) throw Error("Owned browser process still alive after cleanup");
  }
  await removeStorage(binding.storage);
  return { forced, processExited: true, storageRemoved: true };
}
