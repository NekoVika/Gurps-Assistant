export function parseAttribute(attr: any) {
  if (typeof attr !== 'string') return attr;
  const match = attr.match(/^([a-zA-Z\s]+?)\s+([\d\w\(\)\s\.\-]+?)\s+\[(-?\d+)\]$/);
  if (match) return { name: match[1].trim(), level: match[2].trim(), points: match[3] };
  return attr;
}

export function serializeAttribute(attr: any): string {
   if (typeof attr === 'string') return attr;
   return `${attr.name} ${attr.level} [${attr.points}]`;
}

export function parseTrait(trait: any) {
  if (typeof trait !== 'string') return trait;
  const match = trait.match(/^(.*?)\s*\[(-?\d+)\](?:\s*-\s*(.*?))?(?:\s*\((B\d+)\))?$/);
  if (match) return { name: match[1].trim(), points: match[2], notes: match[3] ? match[3].trim() : '', reference: match[4] || '' };
  return trait;
}

export function serializeTrait(trait: any): string {
   if (typeof trait === 'string') return trait;
   let s = `${trait.name} [${trait.points}]`;
   if (trait.notes) s += ` - ${trait.notes}`;
   if (trait.reference) s += ` (${trait.reference})`;
   return s;
}

export function parseSkill(skill: any) {
  if (typeof skill !== 'string') return skill;
  const match = skill.match(/^(.*?)\s*\(([^()]+)\)-(\d+)\s*\[(-?\d+)\](?:\s*-\s*(.*))?$/);
  if (match) return { name: match[1].trim(), base: match[2].trim(), level: parseInt(match[3]), points: parseInt(match[4]), notes: match[5] ? match[5].trim() : '' };
  return skill;
}

export function serializeSkill(skill: any): string {
   if (typeof skill === 'string') return skill;
   let s = `${skill.name} (${skill.base})-${skill.level} [${skill.points}]`;
   if (skill.notes) s += ` - ${skill.notes}`;
   return s;
}

export function parseGear(gear: any) {
  if (typeof gear !== 'string') return gear;
  const match = gear.match(/^(.*?)(?:\s+\[(\d+)\])?\s*\((.*?),\s*(.*?)\)(?:\s*-\s*(.*))?$/);
  if (match) return { name: match[1].trim(), quantity: match[2] ? parseInt(match[2]) : 1, weight: match[3].trim(), cost: match[4].trim(), notes: match[5] ? match[5].trim() : '' };
  return gear;
}

export function serializeGear(gear: any): string {
   if (typeof gear === 'string') return gear;
   let s = `${gear.name}`;
   if (gear.quantity !== undefined && gear.quantity !== 1) s += ` [${gear.quantity}]`;
   s += ` (${gear.weight}, ${gear.cost})`;
   if (gear.notes) s += ` - ${gear.notes}`;
   return s;
}

export function parseHitLocation(hl: any) {
  if (typeof hl !== 'string') return hl;
  const match = hl.match(/^(.*?)\s*\((.*?)\):\s*DR\s*(\d+)(?:\s*-\s*(.*))?$/);
  if (match) return { location: match[1].trim(), roll: match[2].trim(), dr: parseInt(match[3]), notes: match[4] ? match[4].trim() : '' };
  return hl;
}

export function serializeHitLocation(hl: any): string {
   if (typeof hl === 'string') return hl;
   let s = `${hl.location} (${hl.roll}): DR ${hl.dr}`;
   if (hl.notes) s += ` - ${hl.notes}`;
   return s;
}
