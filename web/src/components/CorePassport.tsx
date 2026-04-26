import ReactMarkdown from "react-markdown";

type Props = {
  data: Record<string, any>;
  title?: string;
};

export function CorePassport({ data, title }: Props) {
  // Filter out empty arrays and strings
  const entries = Object.entries(data).filter(([_, val]) => {
     if (Array.isArray(val) && val.length === 0) return false;
     if (typeof val === 'string' && val.trim() === '') return false;
     if (val === null || val === undefined) return false;
     return true;
  });

  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
  };

  return (
    <div className="character-passport" style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      <header className="passport-header" style={{ marginBottom: "32px" }}>
        <div className="passport-title-area">
          <h1>{title || data.title || data.name || data.campaignName || "Core Document"}</h1>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {entries.map(([key, val]) => {
          if (key === 'title' || key === 'name' || key === 'campaignName') return null;

          return (
            <section key={key} className="tactics-panel" style={{ border: "1px solid rgba(149, 181, 255, 0.2)", background: "rgba(11, 20, 37, 0.5)" }}>
              <span className="eyebrow" style={{ fontSize: "1rem", marginBottom: "12px", display: "inline-block", color: "#9fbeff" }}>
                {formatKey(key)}
              </span>
              <div className="markdown-content">
                {Array.isArray(val) ? (
                  <ul>
                    {val.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: "8px" }}>
                        <ReactMarkdown>{typeof item === 'string' ? item : JSON.stringify(item)}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ReactMarkdown>{typeof val === 'string' ? val : JSON.stringify(val)}</ReactMarkdown>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
