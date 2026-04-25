import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MainWorkspace } from './MainWorkspace';

// Mock the API calls so the component doesn't try to actually fetch from the backend
vi.mock('../lib/api', () => ({
  getHealthStatus: vi.fn().mockResolvedValue({ status: 'ok', version: '0.2.4', db_status: 'ok', api_version: '1.0' }),
  getProviderStatuses: vi.fn().mockResolvedValue([]),
  getProviderSettings: vi.fn().mockResolvedValue({}),
  getFileTree: vi.fn().mockResolvedValue([]),
  getCampaignSettings: vi.fn().mockResolvedValue({}),
  getSessions: vi.fn().mockResolvedValue([]),
  checkUpdate: vi.fn().mockResolvedValue({ update_available: false, latest_version: '0.2.4' })
}));

describe('MainWorkspace', () => {
  it('renders the top header navigation', () => {
    render(<MainWorkspace />);
    // Workspace button should be in the document
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Rules DB')).toBeInTheDocument();
  });
});
