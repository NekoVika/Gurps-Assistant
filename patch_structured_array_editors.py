with open('web/src/components/editors/StructuredArrayEditors.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add WorkspaceSelect import
if 'WorkspaceSelect' not in content:
    content = content.replace(
        '''import { parseAttribute''',
        '''import { WorkspaceSelect } from './WorkspaceSelect';\nimport { parseAttribute'''
    )

# Update RelationEditorList
old_relation_input = '''<input 
                                type="text" 
                                value={item.name || ""} 
                                onChange={(e) => updateItem(i, "name", e.target.value)} 
                                placeholder="Name" 
                                style={{ flex: 1 }}
                            />'''

new_relation_input = '''<WorkspaceSelect 
                                category="Character"
                                value={item.name || ""} 
                                onChange={(val) => updateItem(i, "name", val)} 
                                placeholder="Select Character..."
                                style={{ flex: 1, margin: 0 }}
                            />'''

content = content.replace(old_relation_input, new_relation_input)

with open('web/src/components/editors/StructuredArrayEditors.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
