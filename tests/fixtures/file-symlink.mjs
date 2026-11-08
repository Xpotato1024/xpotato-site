import {symlink} from 'node:fs/promises';

// Keep file symlink cases separate: an unavailable Windows privilege must not
// skip other security assertions. Every non-Windows creation error is fatal.
export async function fileSymlink(target, path, context) {
  try {await symlink(target, path, 'file');}
  catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code)) throw error;
    context.skip('Windows file-symlink privilege unavailable; required coverage runs in Linux CI');
  }
}
