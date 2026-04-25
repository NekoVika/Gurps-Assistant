with open('web/src/components/editors/CharacterEditor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace WorkspaceSelect for primary location with StringArrayEditor for locations
old_location = '''<div>
                    <label style={labelStyle}>Location</label>
                    <WorkspaceSelect category="Location" value={data.location} onChange={val => handleUpdate('location', val)} style={inputStyle} />
                </div>'''

new_location = '''<div style={{ gridColumn: "1 / -1" }}>
                    <StringArrayEditor title="Locations (Linked)" items={data.locations || []} onChange={items => handleUpdate('locations', items)} category="Location" />
                </div>'''

content = content.replace(old_location, new_location)

with open('web/src/components/editors/CharacterEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
