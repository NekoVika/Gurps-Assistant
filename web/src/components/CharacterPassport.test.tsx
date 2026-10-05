import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CharacterPassport } from './CharacterPassport';
import type { CharacterJSON } from '../lib/types';

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  resolvePlacement: vi.fn().mockResolvedValue(null),
}));

const sheet = (fields: Partial<CharacterJSON>) => ({ name: 'Rook', ...fields }) as CharacterJSON;

describe('reading a sheet the way the point total does', () => {
  it('reads a trait whose note follows the cost', () => {
    // The old parser wanted the cost last and showed this as broken, though
    // the total had always counted it. Handoff 0.5, item 3.
    render(<CharacterPassport data={sheet({
      disadvantages: ['Chronic Pain [-10] (Result of EOD accident)'],
    })} documentPath="x.json" />);
    expect(screen.getByText('Chronic Pain')).toBeTruthy();
    expect(screen.getByText('[-10]')).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('splits a skill into its base and level', () => {
    render(<CharacterPassport data={sheet({
      skills: ['Guns/TL8 (Pistol) (DX/E)-14 [4]'],
    })} documentPath="x.json" />);
    expect(screen.getByText('Guns/TL8 (Pistol)')).toBeTruthy();
    expect(screen.getByText('DX/E')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
  });
});

describe('a line the sheet cannot read', () => {
  it('offers the editor, never a model', () => {
    const onEdit = vi.fn();
    render(<CharacterPassport data={sheet({
      disadvantages: ['Curiosity - not priced: this name is in no catalogue'],
    })} documentPath="x.json" onEdit={onEdit} />);
    expect(screen.queryByText(/AI Mend/)).toBeNull();
    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalled();
  });

  it('says why, unless the line already does', () => {
    render(<CharacterPassport data={sheet({
      advantages: ['Combat Reflexes costs fifteen'],
      disadvantages: ['Curiosity - not priced: this name is in no catalogue'],
    })} documentPath="x.json" />);
    expect(screen.getAllByText('no cost in brackets')).toHaveLength(1);
  });
});
