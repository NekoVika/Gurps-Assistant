import { WorkspaceSelect } from './WorkspaceSelect';


type Props = {
    title: string;
    items: string[];
    onChange: (items: string[]) => void;
    category?: "Character" | "Location" | "Story" | "Faction" | "All";
};

export function StringArrayEditor({ title, items, onChange, category }: Props) {
    const handleAdd = () => {
        onChange([...items, ""]);
    };

    const handleUpdate = (index: number, val: string) => {
        const newItems = [...items];
        newItems[index] = val;
        onChange(newItems);
    };

    const handleRemove = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        onChange(newItems);
    };

    const moveItem = (index: number, direction: -1 | 1) => {
        if (index + direction < 0 || index + direction >= items.length) return;
        const newItems = [...items];
        const temp = newItems[index];
        newItems[index] = newItems[index + direction];
        newItems[index + direction] = temp;
        onChange(newItems);
    };

    return (
        <div style={{ marginBottom: "16px", padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontWeight: "bold", fontSize: "0.9em", color: "var(--color-primary, #a8c7fa)" }}>{title}</span>
                <button type="button" className="ghost-button" style={{ padding: "4px 8px", fontSize: "0.8em" }} onClick={handleAdd}>
                    + Add Item
                </button>
            </div>
            {items.length === 0 && <p style={{ fontSize: "0.85em", opacity: 0.5, fontStyle: "italic" }}>No items.</p>}
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {items.map((item, i) => (
                    <li key={i} style={{ display: "flex", gap: "8px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <button type="button" onClick={() => moveItem(i, -1)} style={{ background: "none", border: "none", color: "white", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                            <button type="button" onClick={() => moveItem(i, 1)} style={{ background: "none", border: "none", color: "white", cursor: i === items.length - 1 ? "default" : "pointer", opacity: i === items.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                        </div>
                        {category ? (
                            <WorkspaceSelect 
                                category={category} 
                                value={item} 
                                onChange={(val) => handleUpdate(i, val)} 
                                style={{ flexGrow: 1, padding: "6px 12px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.5)", color: "white" }} 
                            />
                        ) : (
                            <input 
                                type="text" 
                                style={{ flexGrow: 1, padding: "6px 12px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.5)", color: "white" }}
                                value={item}
                                onChange={(e) => handleUpdate(i, e.target.value)}
                            />
                        )}
                        <button type="button" style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", padding: "0 8px" }} onClick={() => handleRemove(i)}>
                            ✕
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
