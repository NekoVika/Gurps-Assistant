import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUpdate } from './api';

describe('API functions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('checkUpdate parses the response correctly', async () => {
    const mockResponse = {
      update_available: true,
      latest_version: '1.0.0',
      download_url: 'http://example.com'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse)
    });

    const result = await checkUpdate();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:8000/update/check');
  });
});
