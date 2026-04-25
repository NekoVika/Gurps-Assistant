import React, { useEffect, useState } from "react";
import { listMediaInDir, uploadMedia, getMediaUrl } from "../../lib/api";

type Props = {
  title?: string;
  items: string[];
  onChange: (items: string[]) => void;
  documentPath: string;
};

export function ImageArrayEditor({ title, items, onChange, documentPath }: Props) {
  const [availableMedia, setAvailableMedia] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (documentPath) {
      listMediaInDir(documentPath)
        .then(setAvailableMedia)
        .catch(err => console.error("Failed to load local media", err));
    }
  }, [documentPath]);

  const handleRemove = (idx: number) => {
    const next = [...items];
    next.splice(idx, 1);
    onChange(next);
  };

  const handleSelectLocal = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val && !items.includes(val)) {
      onChange([...items, val]);
    }
    e.target.value = ""; // reset dropdown
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const filename = await uploadMedia(documentPath, file);
      // Add to available media if it's new
      setAvailableMedia(prev => prev.includes(filename) ? prev : [...prev, filename]);
      // Add to the item list if not already there
      if (!items.includes(filename)) {
        onChange([...items, filename]);
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = ""; // reset input
    }
  };

  const wrapperStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background: "rgba(0,0,0,0.2)",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.1)",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px",
    background: "rgba(0,0,0,0.2)",
    borderRadius: "6px",
  };

  const thumbnailStyle: React.CSSProperties = {
    width: "48px",
    height: "48px",
    objectFit: "cover",
    borderRadius: "4px",
    backgroundColor: "rgba(0,0,0,0.4)"
  };

  // Filter out media that is already selected
  const unselectedMedia = availableMedia.filter(m => !items.includes(m));

  return (
    <div style={wrapperStyle}>
      {title && <span style={{ fontWeight: 600, fontSize: "0.95em", opacity: 0.9 }}>{title}</span>}
      
      {items.length === 0 ? (
        <span style={{ fontSize: "0.85em", opacity: 0.5, fontStyle: "italic" }}>No images assigned.</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {items.map((item, idx) => (
            <div key={idx} style={rowStyle}>
              <img src={getMediaUrl(item, documentPath)} alt={item} style={thumbnailStyle} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div style={{ flexGrow: 1, fontSize: "0.9em", wordBreak: "break-all" }}>{item}</div>
              <button
                type="button"
                className="action-button danger"
                onClick={() => handleRemove(idx)}
                style={{ padding: "4px 8px", fontSize: "0.8em" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <select 
          onChange={handleSelectLocal} 
          defaultValue=""
          className="search-input"
          style={{ flexGrow: 1, padding: "8px", cursor: "pointer" }}
        >
          <option value="" disabled>Select from folder...</option>
          {unselectedMedia.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
          {unselectedMedia.length === 0 && availableMedia.length > 0 && (
             <option value="" disabled>(All folder images assigned)</option>
          )}
        </select>
        
        <span style={{ fontSize: "0.9em", opacity: 0.6 }}>OR</span>
        
        <label style={{ cursor: isUploading ? "wait" : "pointer" }} className="action-button primary">
          {isUploading ? "Uploading..." : "Browse PC"}
          <input 
            type="file" 
            accept="image/*" 
            style={{ display: "none" }} 
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
      </div>
      
      {uploadError && <div style={{ color: "#ff6b6b", fontSize: "0.85em", marginTop: "4px" }}>{uploadError}</div>}
    </div>
  );
}
