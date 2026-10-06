/**
 * Talents: a bonus to a group of skills that the character does not pay for
 * in those skills.
 *
 * B89: a Talent gives "+1 per level with all affected skills, even for default
 * use", which "effectively raises your attribute scores for the purpose of
 * those skills only". So a skill's points buy its level *without* the bonus:
 * Arthur Vance's Accounting (IQ/H)-16 on IQ 14 with Mathematical Ability 2 is
 * IQ+0 bought, 4 points -- not the 12 that IQ+2 would cost. Every pricing path
 * in the app (the editor, the wizard, chat drafts, the checker) reads the
 * bonus from here, so none of them calls a correctly paid skill underpaid.
 *
 * B90 also fixes a Talent's price by the size of its skill list -- 6 or
 * fewer skills 5/level, 7 to 12 10/level, 13 or more 15/level -- which makes
 * a campaign's own Talent as fully determined as its own skills: name the
 * skills, and the cost follows.
 */

import { parseEntry } from "./pointBuild";
import type { CatalogueEntry } from "./traitResolver";

export type TalentDef = {
  name: string;
  /** Skill names as the book lists them, specialty where the book gives one. */
  skills: string[];
  /** Points per level. */
  perLevel: number;
  page: number | null;
  /** Declared in the campaign's System Rules. */
  campaign?: boolean;
};

/** The Talents the book calls standard, "in most campaigns" (B90). */
export const STANDARD_TALENTS: TalentDef[] = [
  { name: "Animal Friend", perLevel: 5, page: 90,
    skills: ["Animal Handling", "Falconry", "Packing", "Riding", "Teamster", "Veterinary"] },
  { name: "Artificer", perLevel: 10, page: 90,
    skills: ["Armoury", "Carpentry", "Electrician", "Electronics Repair", "Engineer", "Machinist", "Masonry", "Mechanic", "Smith"] },
  { name: "Business Acumen", perLevel: 10, page: 90,
    skills: ["Accounting", "Administration", "Economics", "Finance", "Gambling", "Market Analysis", "Merchant", "Propaganda"] },
  { name: "Gifted Artist", perLevel: 5, page: 90,
    skills: ["Artist", "Jeweler", "Leatherworking", "Photography", "Sewing"] },
  { name: "Green Thumb", perLevel: 5, page: 90,
    skills: ["Biology", "Farming", "Gardening", "Herb Lore", "Naturalist"] },
  { name: "Healer", perLevel: 10, page: 90,
    skills: ["Diagnosis", "Esoteric Medicine", "First Aid", "Pharmacy", "Physician", "Physiology", "Psychology", "Surgery", "Veterinary"] },
  { name: "Mathematical Ability", perLevel: 10, page: 90,
    skills: ["Accounting", "Astronomy", "Cryptography", "Engineer", "Finance", "Market Analysis", "Mathematics", "Physics"] },
  { name: "Musical Ability", perLevel: 5, page: 91,
    skills: ["Group Performance (Conducting)", "Musical Composition", "Musical Influence", "Musical Instrument", "Singing"] },
  { name: "Outdoorsman", perLevel: 10, page: 91,
    skills: ["Camouflage", "Fishing", "Mimicry", "Naturalist", "Navigation", "Survival", "Tracking"] },
  { name: "Smooth Operator", perLevel: 15, page: 91,
    skills: ["Acting", "Carousing", "Detect Lies", "Diplomacy", "Fast-Talk", "Intimidation", "Leadership", "Panhandling", "Politics", "Public Speaking", "Savoir-Faire", "Sex Appeal", "Streetwise"] },
];

/** A Talent never goes past this many levels (B89). Overlapping ones may. */
export const MAX_TALENT_LEVELS = 4;

/**
 * What a Talent costs per level, from how many skills it covers (B90). A
 * skill with several specialties counts once, so specialties are folded
 * before counting.
 */
export function talentCostPerLevel(skills: string[]): number | null {
  const count = talentSkillCount(skills);
  if (count === 0) return null;
  return count <= 6 ? 5 : count <= 12 ? 10 : 15;
}

/** How many skills a Talent covers, as B90 counts them: specialties once. */
export function talentSkillCount(skills: string[]): number {
  return new Set(skills.map(s => skillKey(s).name).filter(Boolean)).size;
}

/** `Engineer/TL8 (Civil)` → engineer, civil. Tech level and case do not matter. */
function skillKey(skill: string): { name: string; specialty: string } {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(skill.trim());
  const name = (m ? m[1] : skill).replace(/\*\*/g, "").trim().replace(/\/TL\d*$/i, "").toLowerCase();
  return { name, specialty: (m ? m[2] : "").trim().toLowerCase() };
}

/** A campaign Talent, as the catalogue entry that prices it like the book's. */
export function talentEntry(t: TalentDef): CatalogueEntry {
  return {
    book_id: t.campaign ? 0 : 1, kind: "advantage", name: t.name,
    cost_text: `${t.perLevel}/level`, cost_kind: "per_level", cost_value: t.perLevel,
    page: t.page, campaign: Boolean(t.campaign), talent: true, skills: t.skills,
  };
}

/**
 * Every Talent a sheet can have in this campaign: the campaign's own first,
 * so a GM who redefines a standard Talent's skill list gets theirs, then the
 * book's.
 */
export function talentsIn(index: { byName: Map<string, CatalogueEntry[]> } | null): TalentDef[] {
  const own: TalentDef[] = [];
  if (index) {
    for (const entries of index.byName.values()) {
      for (const e of entries) {
        const skills = (e as { skills?: unknown }).skills;
        if (!(e as { campaign?: boolean }).campaign || !(e as { talent?: boolean }).talent || !Array.isArray(skills)) continue;
        own.push({ name: e.name, skills: skills as string[], perLevel: Number(e.cost_value) || 0, page: null, campaign: true });
      }
    }
  }
  const mine = new Set(own.map(t => t.name.toLowerCase()));
  return [...own, ...STANDARD_TALENTS.filter(t => !mine.has(t.name.toLowerCase()))];
}

export type TalentBonus = { bonus: number; from: Array<{ name: string; levels: number }> };

/**
 * The bonus each skill gets from the Talents on a sheet.
 *
 * Read from the sheet's own advantage lines -- `Mathematical Ability 2 [20]` --
 * against the standard Talents and the campaign's own. A Talent named
 * without a level counts as one. Overlapping Talents add (B89).
 */
export function talentBonuses(advantageLines: unknown, talents: TalentDef[] = STANDARD_TALENTS) {
  const owned: Array<{ def: TalentDef; levels: number }> = [];
  const byName = new Map(talents.map(t => [t.name.toLowerCase(), t]));
  for (const line of Array.isArray(advantageLines) ? advantageLines : []) {
    if (typeof line !== "string") continue;
    const entry = parseEntry(line, "advantage");
    const head = entry.name.replace(/\*\*/g, "").trim();
    const m = /^(.*?)\s+(\d+)$/.exec(head);
    const def = byName.get((m ? m[1] : head).toLowerCase());
    if (!def) continue;
    owned.push({ def, levels: m ? Number(m[2]) : 1 });
  }

  /** The bonus a skill gets: `bonusFor("Accounting")`, `bonusFor("Musical Instrument", "Guitar")`. */
  return function bonusFor(skillName: string, specialty = ""): TalentBonus {
    const key = skillKey(specialty ? `${skillName} (${specialty})` : skillName);
    const from: TalentBonus["from"] = [];
    for (const { def, levels } of owned) {
      const covers = def.skills.some(s => {
        const k = skillKey(s);
        return k.name === key.name && (!k.specialty || k.specialty === key.specialty);
      });
      if (covers) from.push({ name: def.name, levels });
    }
    return { bonus: from.reduce((n, f) => n + f.levels, 0), from };
  };
}

export type BonusFor = ReturnType<typeof talentBonuses>;

/** No Talents: every skill's bonus is nought. */
export const noTalents: BonusFor = () => ({ bonus: 0, from: [] });
