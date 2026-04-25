with open('web/src/components/editors/CharacterEditor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add WorkspaceSelect import
if 'WorkspaceSelect' not in content:
    content = content.replace(
        '''import { StringArrayEditor } from './StringArrayEditor';''',
        '''import { WorkspaceSelect } from './WorkspaceSelect';\nimport { StringArrayEditor } from './StringArrayEditor';'''
    )

# Replace Location input
old_location = '''<div>
                    <label style={labelStyle}>Location</label>
                    <input type="text" style={inputStyle} value={data.location} onChange={e => handleUpdate('location', e.target.value)} />
                </div>'''

new_location = '''<div>
                    <label style={labelStyle}>Location</label>
                    <WorkspaceSelect category="Location" value={data.location} onChange={val => handleUpdate('location', val)} style={inputStyle} />
                </div>'''

content = content.replace(old_location, new_location)

# Replace StringArrayEditor category="Story"
old_appearance = '''<StringArrayEditor title="Appearances (Episodes/Chapters)" items={data.appearances || []} onChange={items => handleUpdate('appearances', items)} />'''
new_appearance = '''<StringArrayEditor title="Appearances (Episodes/Chapters)" items={data.appearances || []} onChange={items => handleUpdate('appearances', items)} category="Story" />'''

content = content.replace(old_appearance, new_appearance)

with open('web/src/components/editors/CharacterEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
