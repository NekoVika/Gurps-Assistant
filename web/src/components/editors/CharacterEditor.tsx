import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { CharacterJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';
import { ImageArrayEditor } from './ImageArrayEditor';
import { KindField, WhereField, StoryPlacementField } from './PlacementFields';
import { CollapsibleSection, hasAnyValue } from './CollapsibleSection';
import { PointBudgetBar } from './PointBudgetBar';
import { AttributeEditorList, SkillEditorList, GearEditorList, HitLocationEditorList, EntityRelationEditorList } from './StructuredArrayEditors';
import { TraitCostEditor } from './TraitCostEditor';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function CharacterEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<CharacterJSON | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(value) as CharacterJSON;
            setData(parsed);
        } catch (e) {
            console.error("Parse error in CharacterEditor:", e);
        }
    }, []);

    // We do NOT want to update 'data' when 'value' changes globally after initial load,
    // otherwise it resets cursor positions in text fields.
    // Instead, we call onChange(JSON.stringify(updatedData)) whenever local 'data' changes!

    const handleUpdate = (field: keyof CharacterJSON, val: any) => {
        if (!data) return;
        const newData = { ...data, [field]: val };
        setData(newData);
        onChange(JSON.stringify(newData, null, 2));
    };

    if (!data) return <div style={{ padding: "20px" }}>Invalid JSON data. Cannot render editor.</div>;

    return (
        <div className="editor-glass-panel" data-color-mode="dark">
            {/* The budget while you spend it, recomputed from the editor's own
                state so it moves as you type rather than after a save. */}
            <PointBudgetBar data={data} />

            <h2 className="editor-section-title">Core Identity</h2>
            <div className="editor-grid-3">
                <div className="editor-field">
                    <label className="editor-label">Name</label>
                    <input type="text" className="editor-input" value={data.name} onChange={e => handleUpdate('name', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Concept</label>
                    <input type="text" className="editor-input" value={data.concept} onChange={e => handleUpdate('concept', e.target.value)} />
                </div>
                <KindField value={data.kind} onChange={v => handleUpdate('kind', v)} />
                <WhereField value={data.location || ""} onChange={v => handleUpdate('location', v)} />
                <StoryPlacementField value={data.storyPlacement} onChange={v => handleUpdate('storyPlacement', v)} />
                <div className="editor-field">
                    <label className="editor-label">Significance</label>
                    <select className="editor-select" value={data.significance} onChange={e => handleUpdate('significance', e.target.value)}>
                        <option value="">Select Significance</option>
                        <option value="core">Core</option>
                        <option value="supporting">Supporting</option>
                        <option value="featured">Featured</option>
                        <option value="background">Background</option>
                        {/* Shows a value from an unmigrated file so saving cannot silently drop it. */}
                        {!["core", "supporting", "featured", "background", ""].includes(data.significance) && <option value={data.significance}>{data.significance}</option>}
                    </select>
                </div>
                <div className="editor-field">
                    <label className="editor-label">Role</label>
                    <input type="text" className="editor-input" value={data.role} onChange={e => handleUpdate('role', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Status</label>
                    <input type="text" className="editor-input" value={data.status} onChange={e => handleUpdate('status', e.target.value)} />
                </div>
                {/* The one prose field every character has. A GM who wants to write
                    a paragraph and stop should not have to open a section to find it. */}
                <div className="editor-field" style={{ gridColumn: "1 / -1" }}>
                    <label className="editor-label">GM Summary (Hidden Archive)</label>
                    <MDEditor value={data.gmSummary} onChange={val => handleUpdate('gmSummary', val || "")} height={150} preview="edit" />
                </div>
                {/* Legacy field, keeping for fallback */}
                {data.locations && data.locations.length > 0 && (
                    <div style={{ gridColumn: "1 / -1" }}>
                        <StringArrayEditor title="Locations (Legacy)" items={data.locations} onChange={items => handleUpdate('locations', items)} category="Location" />
                    </div>
                )}
            </div>

            <CollapsibleSection
                title="Mechanics & Stats"
                addLabel="Add stats — attributes, skills, gear, tactics"
                hasContent={hasAnyValue(
                    data.pointTotal, data.attributes, data.skills, data.advantages,
                    data.disadvantages, data.gear, data.hitLocations, data.tactics,
                )}
            >
            <div className="editor-grid-3">
                <div className="editor-field">
                    <label className="editor-label">Point Total</label>
                    <input type="text" className="editor-input" value={data.pointTotal || ""} onChange={e => handleUpdate('pointTotal', e.target.value)} />
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <AttributeEditorList 
                    title="Attributes" 
                    items={(data.attributes || []).map(a => typeof a === 'string' ? a : JSON.stringify(a))} 
                    onChange={(val) => handleUpdate('attributes', val)} 
                />
                <SkillEditorList 
                    title="Skills" 
                    items={(data.skills || []).map(s => typeof s === 'string' ? s : JSON.stringify(s))} 
                    onChange={(val) => handleUpdate('skills', val)} 
                />
                <div className="editor-grid-2">
                    <TraitCostEditor
                        title="Advantages & Perks"
                        kind="advantage"
                        items={(data.advantages || []).map(a => typeof a === 'string' ? a : JSON.stringify(a))}
                        onChange={(val) => handleUpdate('advantages', val)}
                    />
                    <TraitCostEditor
                        title="Disadvantages & Quirks"
                        kind="disadvantage"
                        items={(data.disadvantages || []).map(d => typeof d === 'string' ? d : JSON.stringify(d))}
                        onChange={(val) => handleUpdate('disadvantages', val)}
                    />
                </div>
                <GearEditorList 
                    title="Gear & Weapons" 
                    items={(data.gear || []).map(g => typeof g === 'string' ? g : JSON.stringify(g))} 
                    onChange={(val) => handleUpdate('gear', val)} 
                />
                <div className="editor-field">
                    <label className="editor-label">Hit Locations & DR</label>
                    {typeof data.hitLocations === 'string' ? (
                       <MDEditor value={data.hitLocations} onChange={val => handleUpdate('hitLocations', val || "")} height={200} preview="live" />
                    ) : (
                       <HitLocationEditorList 
                           title="Hit Locations (JSON Objects)" 
                           items={(data.hitLocations || []).map((h: any) => typeof h === 'string' ? h : JSON.stringify(h))} 
                           onChange={(val) => handleUpdate('hitLocations', val)} 
                       />
                    )}
                </div>
                <div className="editor-field">
                    <label className="editor-label">Combat Tactics & AI</label>
                    <MDEditor value={data.tactics} onChange={val => handleUpdate('tactics', val || "")} height={200} preview="live" />
                </div>
            </div>
            </CollapsibleSection>

            <CollapsibleSection
                title="Narrative & Lore"
                addLabel="Add narrative — appearance, personality, relations, hooks"
                hasContent={hasAnyValue(
                    data.characterRelations, data.factionRelations, data.locationRelations,
                    data.storyAppearances, data.relations, data.appearances,
                    data.appearance, data.personality, data.motivation, data.speech, data.pcHooks,
                )}
            >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-grid-2">
                    <EntityRelationEditorList title="Character Relations" items={data.characterRelations || []} onChange={items => handleUpdate('characterRelations', items)} targetCategory="Character" />
                    <EntityRelationEditorList title="Faction Relations" items={data.factionRelations || []} onChange={items => handleUpdate('factionRelations', items)} targetCategory="Faction" />
                    <EntityRelationEditorList title="Location Relations" items={data.locationRelations || []} onChange={items => handleUpdate('locationRelations', items)} targetCategory="Location" />
                    <StringArrayEditor title="Story Appearances" items={data.storyAppearances || []} onChange={items => handleUpdate('storyAppearances', items)} category="Story" />
                </div>

                {data.relations && data.relations.length > 0 && (
                    <EntityRelationEditorList title="Relations (Legacy)" items={data.relations} onChange={items => handleUpdate('relations', items)} targetCategory="Character" />
                )}
                {data.appearances && data.appearances.length > 0 && (
                    <StringArrayEditor title="Appearances (Legacy)" items={data.appearances} onChange={items => handleUpdate('appearances', items)} category="Story" />
                )}
                
                <div className="editor-field">
                    <label className="editor-label">Appearance</label>
                    <MDEditor value={data.appearance} onChange={val => handleUpdate('appearance', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Personality & Quirks</label>
                    <MDEditor value={data.personality} onChange={val => handleUpdate('personality', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Motivation & Drive</label>
                    <MDEditor value={data.motivation} onChange={val => handleUpdate('motivation', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Speech & Quotes</label>
                    <MDEditor value={data.speech} onChange={val => handleUpdate('speech', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">PC Hooks</label>
                    <MDEditor value={data.pcHooks} onChange={val => handleUpdate('pcHooks', val || "")} height={150} preview="live" />
                </div>
            </div>
            </CollapsibleSection>

            <CollapsibleSection title="Media" addLabel="Add images" hasContent={hasAnyValue(data.images)}>
                <ImageArrayEditor title="Image Links" items={data.images || []} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />
            </CollapsibleSection>
        </div>
    );
}
