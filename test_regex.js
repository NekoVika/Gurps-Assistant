const trait = ' [0]'.match(/^(.*?)\s*\[(-?\d+)\](?:\s*-\s*(.*?))?(?:\s*\((B\d+)\))?$/);
console.log('Trait:', trait ? {name: trait[1].trim(), points: trait[2]} : 'fail');

const skill = ' (-)-0 [0]'.match(/^(.*?)\s*\(([^()]+)\)-(\d+)\s*\[(-?\d+)\](?:\s*-\s*(.*))?$/);
console.log('Skill:', skill ? {name: skill[1].trim(), base: skill[2], level: skill[3]} : 'fail');

const gear = ' (0, 0)'.match(/^(.*?)(?:\s+\[(\d+)\])?\s*\((.*?),\s*(.*?)\)(?:\s*-\s*(.*))?$/);
console.log('Gear:', gear ? {name: gear[1].trim(), wt: gear[3], cost: gear[4]} : 'fail');

const hl = ' (-): DR 0'.match(/^(.*?)\s*\((.*?)\):\s*DR\s*(\d+)(?:\s*-\s*(.*))?$/);
console.log('HL:', hl ? {loc: hl[1].trim(), roll: hl[2], dr: hl[3]} : 'fail');
