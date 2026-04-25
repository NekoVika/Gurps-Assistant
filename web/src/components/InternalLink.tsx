import React from "react";

type Props = {
  target: string;
  onNavigate?: (targetName: string) => void;
  className?: string;
  style?: React.CSSProperties;
};

export function InternalLink({ target, onNavigate, className, style }: Props) {
  if (!target) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onNavigate) {
      onNavigate(target);
    }
  };

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
