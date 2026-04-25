import sys

with open('web/src/lib/api.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if line.startswith('export async function deleteCampaignFile'):
        skip = True
        
        # Insert corrected content
        new_lines.append('''export async function deleteCampaignFile(path: string): Promise<{ success: boolean; trash_id: string }> {
  const response = await fetch(${apiBaseUrl()}/campaign/file, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path })
  });
  if (!response.ok) {
    throw new Error(Failed to delete file);
  }
  return await response.json();
}

export async function getTrashItems(): Promise<TrashItem[]> {
  const response = await fetch(${apiBaseUrl()}/campaign/trash);
  if (!response.ok) {
    return [];
  }
  return await response.json();
}

export async function restoreTrashItem(trash_id: string): Promise<{ success: boolean }> {
  const response = await fetch(${apiBaseUrl()}/campaign/trash/restore, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trash_id })
  });
  if (!response.ok) {
    throw new Error(Failed to restore trash item);
  }
  return await response.json();
}

export async function permanentDeleteTrashItem(trash_id: string): Promise<{ success: boolean }> {
  const response = await fetch(${apiBaseUrl()}/campaign/trash/, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(Failed to permanently delete trash item);
  }
  return await response.json();
}
''')
    elif skip and line.strip() == '}':
        # we need to skip 4 functions, each ending in '}'
        # This simple parser just skips until line 681. It's better to just skip everything until the end of file since these are the last 4 functions.
        pass
    
    if not skip:
        new_lines.append(line)

with open('web/src/lib/api.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
