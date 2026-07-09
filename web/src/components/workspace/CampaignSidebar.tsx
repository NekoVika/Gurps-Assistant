import { useCampaignStore } from '../../stores/useCampaignStore';
import { CampaignRegistry } from '../CampaignRegistry';
import { WIZARDS, type WizardDef } from '../../lib/wizards';

interface CampaignSidebarProps {
  setActiveWizard: (w: WizardDef | null) => void;
}

export function CampaignSidebar({ setActiveWizard }: CampaignSidebarProps) {
  const { campaignPath, fileTreeError, fileTree, selectedPath, setSelectedPath } = useCampaignStore();

  return (
    <aside className="panel sidebar" style={{ overflowY: "auto" }}>
      <div className="panel-header">
        <p className="eyebrow">Campaign</p>
        <h1>{campaignPath ? "Loaded" : "Not Selected"}</h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", marginTop: "12px" }}>
        {fileTreeError ? <p className="error-copy compact-error">{fileTreeError}</p> : null}
        {fileTree.length > 0 ? (
          <CampaignRegistry 
            tree={fileTree} 
            selectedPath={selectedPath} 
            onSelect={setSelectedPath} 
            onActivateWizard={(wizardId) => {
              const w = WIZARDS.find(w => w.id === wizardId);
              if (w) setActiveWizard(w);
            }}
          />
        ) : (
          <p className="status-copy">Loading file tree...</p>
        )}
      </div>
    </aside>
  );
}
