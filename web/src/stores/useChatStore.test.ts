import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../lib/api', () => api);

import { useChatStore } from './useChatStore';

const session = (id: string, text: string) => ({
  id,
  title: `Chat ${id}`,
  messages: [{ role: 'user', content: text }],
});

const defer = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({
    sessions: [session('a', 'first'), session('b', 'second')] as any,
    activeSessionId: 'a',
    chatMessages: [{ role: 'user', content: 'first' }] as any,
    chatError: null,
    chatLoading: false,
    streamingMessage: null,
    pendingDraft: null,
  });
});

describe('switching chats', () => {
  it('shows the target transcript without waiting for the server', async () => {
    const pending = defer<any>();
    api.getSession.mockReturnValue(pending.promise);

    const switching = useChatStore.getState().setActiveSessionId('b');

    // Before the request resolves, the panel already shows session b.
    expect(useChatStore.getState().activeSessionId).toBe('b');
    expect(useChatStore.getState().chatMessages[0].content).toBe('second');

    pending.resolve(session('b', 'second'));
    await switching;
  });

  it('discards a slow response when a newer switch already won', async () => {
    const slow = defer<any>();
    api.getSession.mockReturnValueOnce(slow.promise);
    api.getSession.mockResolvedValueOnce(session('a', 'first'));

    const first = useChatStore.getState().setActiveSessionId('b');
    await useChatStore.getState().setActiveSessionId('a');

    slow.resolve({ ...session('b', 'STALE'), messages: [{ role: 'user', content: 'STALE' }] });
    await first;

    expect(useChatStore.getState().activeSessionId).toBe('a');
    expect(useChatStore.getState().chatMessages[0].content).not.toBe('STALE');
  });

  it('reports a failed switch instead of silently doing nothing', async () => {
    api.getSession.mockRejectedValue(new Error('session file is corrupt'));
    await useChatStore.getState().setActiveSessionId('b');
    expect(useChatStore.getState().chatError).toContain('session file is corrupt');
  });
});

describe('recovering from a failed exchange', () => {
  it('drops the half-finished turn so the next message is not poisoned', async () => {
    // The stream announces a tool call, then dies before the result arrives.
    api.streamChat.mockImplementation(async (_p: any, _m: any, _msgs: any, onChunk: any) => {
      onChunk({ type: 'tool_calls', tool_calls: [{ id: 'c1', name: 'read_file', arguments: {} }] });
      throw new Error('Gemini is temporarily overloaded.');
    });

    const sent = [{ role: 'user', content: 'read the episode' }] as any;
    await useChatStore.getState().executeChatLoop(sent, false, null, 0, 'gemini', 'x');

    const state = useChatStore.getState();
    expect(state.chatError).toContain('overloaded');
    expect(state.chatLoading).toBe(false);
    const orphaned = state.chatMessages.some((m: any) => m.tool_calls?.length);
    expect(orphaned).toBe(false);
    expect(state.chatMessages).toEqual(sent);
  });

  it('clears the error banner on demand', () => {
    useChatStore.setState({ chatError: 'boom' });
    useChatStore.getState().clearChatError();
    expect(useChatStore.getState().chatError).toBeNull();
  });
});
