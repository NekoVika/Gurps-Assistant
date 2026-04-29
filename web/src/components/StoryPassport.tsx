import { EpisodePassport } from "./EpisodePassport";
import { ChapterPassport } from "./ChapterPassport";
import { EncounterPassport } from "./EncounterPassport";
import type { StoryJSON } from "../lib/types";

type Props = {
  data: StoryJSON;
  documentPath: string;
  onNavigate?: (target: string) => void;
};

export function StoryPassport({ data, documentPath, onNavigate }: Props) {
  const typeStr = (data.type || "").toLowerCase();
  
  if (typeStr === "episode") {
    return <EpisodePassport data={data} documentPath={documentPath} onNavigate={onNavigate} />;
  }
  
  if (typeStr === "encounter") {
    return <EncounterPassport data={data} documentPath={documentPath} onNavigate={onNavigate} />;
  }

  // Fallback to Chapter for everything else ("Chapter", "", "Story Part")
  return <ChapterPassport data={data} documentPath={documentPath} onNavigate={onNavigate} />;
}
