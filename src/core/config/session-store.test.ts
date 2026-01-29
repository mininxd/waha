import { getSessionStorePath } from './session-store';
import * as fsSync from 'fs';

jest.mock('fs');

describe('getSessionStorePath', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    // Clear mocks
    (fsSync.existsSync as jest.Mock).mockReturnValue(false);
    (fsSync.accessSync as jest.Mock).mockReturnValue(undefined);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('should use WAHA_LOCAL_STORE_BASE_DIR if set', () => {
    process.env.WAHA_LOCAL_STORE_BASE_DIR = '/custom/path';
    expect(getSessionStorePath()).toBe('/custom/path');
  });

  it('should use /app/.waha if it exists and is writable', () => {
    delete process.env.WAHA_LOCAL_STORE_BASE_DIR;
    (fsSync.existsSync as jest.Mock).mockReturnValue(true);
    (fsSync.accessSync as jest.Mock).mockReturnValue(undefined);

    expect(getSessionStorePath()).toBe('/app/.waha');
    expect(fsSync.existsSync).toHaveBeenCalledWith('/app/.waha');
    expect(fsSync.accessSync).toHaveBeenCalledWith('/app/.waha', fsSync.constants.W_OK);
  });

  it('should fallback to ./.sessions if /app/.waha does not exist', () => {
    delete process.env.WAHA_LOCAL_STORE_BASE_DIR;
    (fsSync.existsSync as jest.Mock).mockReturnValue(false);

    expect(getSessionStorePath()).toBe('./.sessions');
  });

  it('should fallback to ./.sessions if /app/.waha is not writable', () => {
    delete process.env.WAHA_LOCAL_STORE_BASE_DIR;
    (fsSync.existsSync as jest.Mock).mockReturnValue(true);
    (fsSync.accessSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    expect(getSessionStorePath()).toBe('./.sessions');
  });
});
