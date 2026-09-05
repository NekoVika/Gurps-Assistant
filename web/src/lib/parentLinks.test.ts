import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateParentChildLinks } from './parentLinks';
import { getFileContent, writeFileContent } from './api';

vi.mock('./api', () => ({
  getFileContent: vi.fn(),
  writeFileContent: vi.fn().mockResolvedValue({ success: true }),
}));

const mockedGet = vi.mocked(getFileContent);
const mockedWrite = vi.mocked(writeFileContent);

beforeEach(() => {
  vi.clearAllMocks();
});

// These tests pin the wizard-answer key contract: WizardModal keys answers by
// field id (ParentEpisode/ParentChapter/Name), and updateParentChildLinks must
// read exactly those keys (BUGS.md: episodes created but invisible).
describe('updateParentChildLinks', () => {
  it('registers a new Chapter in its parent Episode overview', async () => {
    mockedGet.mockResolvedValue({ path: '', content: JSON.stringify({ title: 'Sewer Descent', childLinks: [] }) } as any);

    await updateParentChildLinks(
      'Campaign/03_Story/Episode_Sewer_Descent/Chapter_The_Lower_Drains/Chapter_Overview.json',
      { ParentEpisode: 'Episode_Sewer_Descent', Name: 'The Lower Drains' },
    );

    expect(mockedGet).toHaveBeenCalledWith('Campaign/03_Story/Episode_Sewer_Descent/Episode_Overview.json');
    const [path, content] = mockedWrite.mock.calls[0];
    expect(path).toBe('Campaign/03_Story/Episode_Sewer_Descent/Episode_Overview.json');
    expect(JSON.parse(content).childLinks).toEqual(['The Lower Drains']);
  });

  it('registers a new Encounter in its parent Chapter overview', async () => {
    mockedGet.mockResolvedValue({ path: '', content: JSON.stringify({ title: 'The Lower Drains', childLinks: ['Existing'] }) } as any);

    await updateParentChildLinks(
      'Campaign/03_Story/Episode_S/Chapter_D/Encounters/Drone_Defense.json',
      { ParentEpisode: 'Episode_S', ParentChapter: 'Chapter_D', Name: 'Drone Defense' },
    );

    expect(mockedGet).toHaveBeenCalledWith('Campaign/03_Story/Episode_S/Chapter_D/Chapter_Overview.json');
    const [, content] = mockedWrite.mock.calls[0];
    expect(JSON.parse(content).childLinks).toEqual(['Existing', 'Drone Defense']);
  });

  it('registers a new Episode in the campaign overview, creating childLinks if absent', async () => {
    mockedGet.mockResolvedValue({ path: '', content: JSON.stringify({ title: 'My Campaign' }) } as any);

    await updateParentChildLinks(
      'Campaign/03_Story/Episode_Sewer_Descent/Episode_Overview.json',
      { Name: 'Sewer Descent' },
    );

    expect(mockedGet).toHaveBeenCalledWith('Campaign/03_Story/Campaign_Overview.json');
    const [, content] = mockedWrite.mock.calls[0];
    expect(JSON.parse(content).childLinks).toEqual(['Sewer Descent']);
  });

  it('does not duplicate an existing childLink', async () => {
    mockedGet.mockResolvedValue({ path: '', content: JSON.stringify({ childLinks: ['Sewer Descent'] }) } as any);

    await updateParentChildLinks(
      'Campaign/03_Story/Episode_Sewer_Descent/Episode_Overview.json',
      { Name: 'Sewer Descent' },
    );

    expect(mockedWrite).not.toHaveBeenCalled();
  });
});
