import * as path from 'path';
import * as fs from 'fs';

export function getSessionStorePath(): string {
  // If explicitly set, use it
  if (process.env.WAHA_LOCAL_STORE_BASE_DIR) {
    return process.env.WAHA_LOCAL_STORE_BASE_DIR;
  }

  // Check if /app/.waha exists (Docker volume mount point)
  const wahaDir = path.resolve('/app/.waha');
  if (fs.existsSync(wahaDir)) {
    return '/app/.waha';
  }

  // Default to .sessions
  return './.sessions';
}
