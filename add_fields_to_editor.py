with open('web/src/components/editors/CharacterEditor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '''import { AttributeEditorList, TraitEditorList, SkillEditorList, GearEditorList, HitLocationEditorList } from './StructuredArrayEditors';''',
    '''import { AttributeEditorList, TraitEditorList, SkillEditorList, GearEditorList, HitLocationEditorList, RelationEditorList } from './StructuredArrayEditors';'''
)

new_section = '''
            <div className="section-divider"><h3>Relationships & Links</h3></div>
            <RelationEditorList title="Relations" items={data.relations || []} onChange={items => handleUpdate('relations', items)} />
            <StringArrayEditor title="Appearances (Episodes/Chapters)" items={data.appearances || []} onChange={items => handleUpdate('appearances', items)} />
            
            <div className="section-divider"><h3>Core Traits</h3></div>'''

content = content.replace(
    '''<div className="section-divider"><h3>Core Traits</h3></div>''',
    new_section
)

with open('web/src/components/editors/CharacterEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
