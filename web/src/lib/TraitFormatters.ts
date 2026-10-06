export function parseAttribute(attr: any) {
  if (typeof attr !== 'string') return attr;
  // `Parry N/A [0]` is how a sheet says it has no parry; 28 lines across the
  // campaign are written that way, and the editor called every one malformed.
  const match = attr.match(/^([a-zA-Z\s]+?)\s+(N\/A|[-\d][\d\w\(\)\s\.\-]*?)\s+\[(-?\d+)\]$/);
  if (match) return { name: match[1].trim(), level: match[2].trim(), points: match[3] };
  return attr;
}

export function serializeAttribute(attr: any): string {
   if (typeof attr === 'string') return attr;
   return `${attr.name} ${attr.level} [${attr.points}]`;
}

export function parseGear(gear: any) {
  if (typeof gear !== 'string') return gear;
  // The weight-and-cost group holds no parentheses of its own. Without that,
  // a name that carries one -- `Commlink (Handheld)`, `Ammo, Pistol (9mm)` --
  // was read as the start of the group, and the weight came out as
  // `9mm) [20] (0.5 lbs`: wrong, and quietly so, which is worse than failing.
  const match = gear.match(/^(.*?)(?:\s+\[(\d+)\])?\s*\(([^()]*?),\s*([^()]*)\)(?:\s*-\s*(.*))?$/);
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
