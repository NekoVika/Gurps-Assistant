import React from "react";
import { useCampaignStore } from "../stores/useCampaignStore";
import { entityExists, isReferenceName } from "../lib/entityResolution";

type Props = {
  target: string;
  onNavigate?: (targetName: string) => void;
  className?: string;
  style?: React.CSSProperties;
  /** Passed to the create-stub prompt when the target has no backing file. */
  suggestedType?: string;
};

export function InternalLink({ target, onNavigate, className, style, suggestedType }: Props) {
  const entityRegistry = useCampaignStore(s => s.entityRegistry);
  const handleNavigateTo = useCampaignStore(s => s.handleNavigateTo);

  if (!target) return null;

  const isMissing = isReferenceName(target) && !entityExists(entityRegistry, target);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMissing) {
      // No file backs this name — route through the store so the user gets
      // the "create stub?" prompt instead of a silent no-op.
      handleNavigateTo(target, suggestedType);
    } else if (onNavigate) {
      onNavigate(target);
    }
  };

  if (isMissing) {
    return (
      <span
        onClick={handleClick}
        className={`internal-link internal-link-missing ${className || ''}`}
        style={{
          cursor: "pointer",
          color: "#ffb44d",
          border: "1px dashed rgba(255, 180, 77, 0.5)",
          borderRadius: "4px",
          padding: "0 4px",
          fontStyle: "italic",
          transition: "color 0.2s",
          ...style
        }}
        title={`No file exists for "${target}" yet — click to create a stub`}
      >
        {target}<span style={{ fontSize: "0.7em", opacity: 0.8 }}> (proposed)</span>
      </span>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`internal-link ${className || ''}`}
      style={{
        cursor: onNavigate ? "pointer" : "default",
        color: onNavigate ? "#58a6ff" : "inherit",
        textDecoration: onNavigate ? "underline" : "none",
        textDecorationStyle: "dotted",
        textUnderlineOffset: "4px",
        transition: "color 0.2s",
        ...style
      }}
      onMouseOver={(e) => {
        if (onNavigate) (e.currentTarget as HTMLElement).style.color = "#79c0ff";
      }}
      onMouseOut={(e) => {
        if (onNavigate) (e.currentTarget as HTMLElement).style.color = "#58a6ff";
      }}
      title={onNavigate ? `Go to ${target}` : undefined}
    >
      {target}
    </span>
  );
}
