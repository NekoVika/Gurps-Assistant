with open('web/src/components/editors/StructuredArrayEditors.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_editor = '''
export function RelationEditorList({ title, items, onChange }: ListProps) {
    const handleAdd = () => {
        onChange([...items, { name: "New Relation", relationship: "Description" }]);
    };
    const handleRemove = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };
    const updateItem = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        onChange(newItems);
    };

    return (
        <div className="editor-section">
            <div className="section-header">
                <h3>{title}</h3>
                <button type="button" onClick={handleAdd} className="add-button">+ Add</button>
            </div>
            <div className="structured-list">
                {items.map((item, i) => (
                    <div key={i} className="structured-item">
                        <div className="item-row">
                            <input 
                                type="text" 
                                value={item.name || ""} 
                                onChange={(e) => updateItem(i, "name", e.target.value)} 
                                placeholder="Name" 
                                style={{ flex: 1 }}
                            />
                            <button type="button" onClick={() => handleRemove(i)} className="remove-button" title="Remove">&times;</button>
                        </div>
                        <input 
                            type="text" 
                            value={item.relationship || ""} 
                            onChange={(e) => updateItem(i, "relationship", e.target.value)} 
                            placeholder="Relationship" 
                            style={{ flex: 2, marginTop: "8px" }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
'''
if 'RelationEditorList' not in content:
    with open('web/src/components/editors/StructuredArrayEditors.tsx', 'a', encoding='utf-8') as f:
        f.write(new_editor)
