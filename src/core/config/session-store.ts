import * as fsSync from 'fs';

export function getSessionStorePath(): string {
  const envDir = process.env.WAHA_LOCAL_STORE_BASE_DIR;
  if (envDir) {
    return envDir;
  }
  const dockerVol = '/app/.waha';
  try {
    if (fsSync.existsSync(dockerVol)) {
      fsSync.accessSync(dockerVol, fsSync.constants.W_OK);
      return dockerVol;
    }
  } catch (e) {
    // Ignore
  }
  return './.sessions';
}
