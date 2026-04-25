import { useEffect, useState } from "react";
import { TrashItem, getTrashItems, restoreTrashItem, permanentDeleteTrashItem } from "../lib/api";
import { ConfirmModal } from "./ConfirmModal";

export function TrashbinPanel({ onRestore }: { onRestore?: () => void }) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TrashItem | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrashItems();
      setItems(data);
    } catch (err: any) {
      setError(err.message || "Failed to load trash items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleRestore = async (trashId: string) => {
    try {
      await restoreTrashItem(trashId);
      setItems(prev => prev.filter(i => i.trash_id !== trashId));
      onRestore?.();
    } catch (err: any) {
      alert("Failed to restore: " + err.message);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await permanentDeleteTrashItem(itemToDelete.trash_id);
      setItems(prev => prev.filter(i => i.trash_id !== itemToDelete.trash_id));
      setItemToDelete(null);
    } catch (err: any) {
      alert("Failed to delete permanently: " + err.message);
    }
  };

  const handleDeleteClick = (item: TrashItem) => {
    setItemToDelete(item);
  };

  if (loading) return <div style={{ padding: "32px", textAlign: "center" }}>Loading trashbin...</div>;

  return (
    <div className="workspace-grid workspace-centered">
      <section className="preview-card" style={{ padding: "32px", width: "100%", maxWidth: "800px" }}>
        <div className="preview-header" style={{ marginBottom: "24px" }}>
          <p className="section-label">Maintenance</p>
          <h2>🗑️ Trashbin</h2>
          <p className="lede">Deleted files are stored here before permanent deletion.</p>
        </div>

        {error && <p className="error-copy">{error}</p>}

        {items.length === 0 && !error ? (
          <div style={{ textAlign: "center", opacity: 0.7, padding: "40px" }}>
            <p>Trashbin is empty.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {items.map(item => (
              <div key={item.trash_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", gap: "16px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "#e2e8f0" }}>{item.name}</h4>
                  <p style={{ margin: 0, fontSize: "0.85em", opacity: 0.6, fontFamily: "monospace", wordBreak: "break-all" }}>{item.original_path}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8em", opacity: 0.5 }}>Deleted: {new Date(item.deleted_at).toLocaleString()}</p>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button onClick={() => handleRestore(item.trash_id)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#e2e8f0", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
                    Restore
                  </button>
                  <button onClick={() => handleDeleteClick(item)} style={{ background: "rgba(255, 60, 60, 0.2)", border: "1px solid rgba(255, 60, 60, 0.4)", color: "#ff7b72", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
                    Delete Forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={!!itemToDelete}
        title="Permanently Delete File?"
        message={`Are you sure you want to permanently delete "${itemToDelete?.name}"? This action cannot be undone and the file will be gone forever.`}
        confirmText="Delete Forever"
        cancelText="Keep in Trash"
        onConfirm={confirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
