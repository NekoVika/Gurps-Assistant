import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getSessions: vi.fn(),
  getSession: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  streamChat: vi.fn(),
  validateFileContent: vi.fn(),
  getFileContent: vi.fn(),
  runRulesQa: vi.fn(),
}));
vi.mock('../../lib/api', () => api);

import { ChatSessionList } from './ChatSessionList';
import { useChatStore } from '../../stores/useChatStore';

const now = Date.now() / 1000;
const sessions = [
  { id: 'a', title: 'Sewer prep', updated_at: now - 30, messages: [{ role: 'user', content: 'one' }] },
  { id: 'b', title: 'Rat king statblock', updated_at: now - 7200, messages: [{ role: 'user', content: 'two' }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.getSession.mockImplementation(async (id: string) => sessions.find(s => s.id === id));
  api.updateSession.mockImplementation(async (id: string, title: string) => ({
    ...sessions.find(s => s.id === id), title,
  }));
  api.deleteSession.mockResolvedValue(undefined);
  useChatStore.setState({
    sessions: sessions as any,
    activeSessionId: 'a',
    chatMessages: [] as any,
    chatError: null,
    sessionsLoading: false,
  });
});

const expand = () => fireEvent.click(screen.getByTitle('Show all chats'));

describe('ChatSessionList', () => {
  it('names the active chat while collapsed and hides the rest', () => {
    render(<ChatSessionList />);
    expect(screen.getByText('Sewer prep')).toBeInTheDocument();
    expect(screen.queryByText('Rat king statblock')).not.toBeInTheDocument();
  });

  it('lists every chat with its age once expanded', () => {
    render(<ChatSessionList />);
    expand();
    expect(screen.getByText('Rat king statblock')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('switches chats from the row', async () => {
    render(<ChatSessionList />);
    expand();
    fireEvent.click(screen.getByText('Rat king statblock'));
    await waitFor(() => expect(useChatStore.getState().activeSessionId).toBe('b'));
  });

  it('renames in place without a prompt dialog', async () => {
    render(<ChatSessionList />);
    expand();
    fireEvent.click(screen.getAllByTitle('Rename')[0]);
    const input = screen.getByDisplayValue('Sewer prep');
    fireEvent.change(input, { target: { value: 'Sewer prep v2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.updateSession).toHaveBeenCalledWith('a', 'Sewer prep v2', undefined));
  });

  it('asks before deleting rather than deleting on the first click', async () => {
    render(<ChatSessionList />);
    expand();
    fireEvent.click(screen.getAllByTitle('Delete')[0]);
    expect(api.deleteSession).not.toHaveBeenCalled();
    expect(screen.getByText('Delete this chat?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(api.deleteSession).toHaveBeenCalledWith('a'));
  });

  it('backs out of a delete on cancel', () => {
    render(<ChatSessionList />);
    expand();
    fireEvent.click(screen.getAllByTitle('Delete')[0]);
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete this chat?')).not.toBeInTheDocument();
    expect(api.deleteSession).not.toHaveBeenCalled();
  });
});
