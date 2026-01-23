import * as fs from 'fs';

export function getSessionStorePath(): string {
  // 1. Check environment variable
  if (process.env.WAHA_LOCAL_STORE_BASE_DIR) {
    return process.env.WAHA_LOCAL_STORE_BASE_DIR;
  }

  // 2. Check for docker volume at /app/.waha
  // We check if the directory exists.
  const dockerVolumePath = '/app/.waha';
  if (fs.existsSync(dockerVolumePath)) {
    return dockerVolumePath;
  }

  // 3. Default
  return './.sessions';
}
