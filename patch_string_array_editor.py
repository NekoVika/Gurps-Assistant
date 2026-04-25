with open('web/src/components/editors/StringArrayEditor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add WorkspaceSelect import
if 'WorkspaceSelect' not in content:
    content = '''import { WorkspaceSelect } from './WorkspaceSelect';\n''' + content

# Update Props
content = content.replace(
    '''type Props = {
    title: string;
    items: string[];
    onChange: (items: string[]) => void;
};''',
    '''type Props = {
    title: string;
    items: string[];
    onChange: (items: string[]) => void;
    category?: "Character" | "Location" | "Story" | "Faction" | "All";
};'''
)

# Update signature
content = content.replace(
    '''export function StringArrayEditor({ title, items, onChange }: Props) {''',
    '''export function StringArrayEditor({ title, items, onChange, category }: Props) {'''
)

# Update input
old_input = '''<input 
                            type="text" 
                            style={{ flex: 1, padding: "8px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", color: "white" }} 
                            value={item} 
                            onChange={(e) => handleUpdate(i, e.target.value)} 
                        />'''

new_input = '''{category ? (
                            <WorkspaceSelect 
                                category={category} 
                                value={item} 
                                onChange={(val) => handleUpdate(i, val)} 
                                style={{ flex: 1, padding: "8px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", color: "white" }} 
                            />
                        ) : (
                            <input 
                                type="text" 
                                style={{ flex: 1, padding: "8px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", color: "white" }} 
                                value={item} 
                                onChange={(e) => handleUpdate(i, e.target.value)} 
                            />
                        )}'''

content = content.replace(old_input, new_input)

with open('web/src/components/editors/StringArrayEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
