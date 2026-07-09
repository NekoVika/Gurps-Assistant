import ReactMarkdown from 'react-markdown';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useChatStore } from '../../stores/useChatStore';

export function BackendPanel() {
  const { health, healthError, providers, providerError } = useWorkspaceStore();
  const { rulesQuery, rulesResult, rulesError, rulesLoading, setRulesQuery, handleRulesSubmit } = useChatStore();

  return (
    <div className="workspace-grid workspace-centered">
      <section className="preview-card" style={{ padding: "32px", width: "100%" }}>
        <div className="preview-header">
          <p className="section-label">SysInfo</p>
          <h2>Backend Health</h2>
        </div>
        <div className="status-card" style={{ marginTop: "24px", background: "transparent", border: "none" }}>
          {health ? (
            <>
              <span className="status-pill online">Connected</span>
              <dl className="status-list" style={{ marginTop: "16px" }}>
                <div><dt>App</dt><dd>{health.app_name}</dd></div>
                <div><dt>Version</dt><dd>{health.version}</dd></div>
                <div><dt>Status</dt><dd>{health.status}</dd></div>
              </dl>
            </>
          ) : (
            <>
              <span className={`status-pill ${healthError ? "offline" : "pending"}`}>
                {healthError ? "Unavailable" : "Checking"}
              </span>
              <p className="status-copy" style={{ marginTop: "16px" }}>
                {healthError ? `Check failed: ${healthError}` : "Waiting for backend..."}
              </p>
            </>
          )}
        </div>
      </section>

      <section className="preview-card" style={{ padding: "32px", width: "100%" }}>
        <div className="preview-header">
          <p className="section-label">Services</p>
          <h2>Provider Status</h2>
        </div>
        {providerError ? <p className="error-copy compact-error" style={{marginTop: "16px"}}>{providerError}</p> : null}
        {providers.length > 0 ? (
          <div className="provider-list" style={{ marginTop: "24px" }}>
            {providers.map((provider) => (
              <article key={provider.name} className="provider-card">
                <div className="provider-card-header">
                  <div>
                    <h3>{provider.display_name}</h3>
                    <p className="provider-meta">{provider.base_url ?? provider.name}</p>
                  </div>
                  <span className={`status-pill ${provider.available ? "online" : "offline"}`}>
                    {provider.available ? "Available" : "Unavailable"}
                  </span>
                </div>

                <div className="provider-body">
                  <div className="provider-row"><span>Models</span><strong>{provider.models.length}</strong></div>
                </div>

                {provider.error_message ? <p className="provider-error">{provider.error_message}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="status-copy" style={{ marginTop: "16px" }}>Waiting for providers...</p>
        )}
      </section>

      <section className="preview-card" style={{ padding: "32px", width: "100%" }}>
        <div className="preview-header">
          <p className="section-label">Database</p>
          <h2>Rules QA Tooling</h2>
        </div>
        <form className="rules-form" onSubmit={handleRulesSubmit} style={{ marginTop: "24px" }}>
          <div className="rules-input-row">
            <input
              id="rules-query"
              className="rules-input"
              type="text"
              value={rulesQuery}
              onChange={(event) => setRulesQuery(event.target.value)}
              placeholder="Test the Rules DB directly..."
            />
            <button type="submit" className="primary-button" disabled={rulesLoading}>
              {rulesLoading ? "Querying..." : "Run QA"}
            </button>
          </div>
        </form>

        {rulesError ? <p className="error-copy" style={{ marginTop: "16px" }}>{rulesError}</p> : null}
        {rulesResult ? (
          <div className="rules-output-card" style={{ marginTop: "24px" }}>
            <div className="preview-header">
              <p className="section-label">Evidence Bundle</p>
              <h3>{rulesResult.query}</h3>
            </div>
            <div className="rules-output markdown-content">
              <ReactMarkdown>{rulesResult.output}</ReactMarkdown>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
