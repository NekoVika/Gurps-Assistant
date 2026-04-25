const { parseAttribute, serializeAttribute } = require('../../lib/TraitFormatters');

const coreAttributes = ["ST", "DX", "IQ", "HT", "HP", "Will", "Per", "FP", "Basic Speed", "Basic Move"];

let items = [
  "ST 11 [10]",
  "Will 14 [0]; Per 14 [0]; HP 11 [0]; FP 10 [0]" // broken string
];

let parsed = items.map(parseAttribute);

const coreData = coreAttributes.map(ca => {
    const found = parsed.find(p => typeof p !== 'string' && p.name.toUpperCase() === ca.toUpperCase());
    if (found && typeof found !== 'string') {
        return { name: ca, level: found.level, points: found.points };
    }
    return { name: ca, level: "10", points: 0 };
});

const extras = parsed.filter(p => {
    if (typeof p === 'string') return true;
    return !coreAttributes.some(ca => ca.toUpperCase() === p.name.toUpperCase());
});

console.log("INITIAL EXTRAS:", extras);

// simulate deleteExtra(0)
const newExtras = [...extras];
newExtras.splice(0, 1);

const newItems = [
    ...coreData.map(serializeAttribute),
    ...newExtras.map(serializeAttribute)
];

console.log("NEW ITEMS:", newItems);
