# Changelog

## 0.4.0 — Everything In Its Place

The release for GMs who do not want to ask an AI to build their campaign. Every
entity can now be created, placed and linked by hand, and the assistant only
speaks when it is invited. Nothing was taken away from the AI side — it simply
stopped being the path of least resistance.

### One named trader

Creating an entity no longer means filling in a form you did not ask for.

- Type a name anywhere a name is expected and the entity is created where you
  are standing, with its placement inferred from the scene you are in.
- New entities are born blank. The editor shows only identity, and every other
  section collapses to a single "+ Add …" offer until it has something in it.
  Characters, locations, factions and story nodes all behave this way.
- A category word is refused as a name. Two episodes can each hold a
  "Chapter 04", and then neither can be told from the other.

### Where things are

Placement is resolved rather than stored, so a link is a relationship instead
of a coordinate.

- Characters are placed at a location, or travel with someone who is. A
  companion pointed at a PC follows the party for free.
- Locations nest inside locations. Containment rolls upward: being in a room
  means being in the building, never the reverse.
- An entity has one narrative home, qualified by *how* it belongs — an
  appearance stays in its scene, a fixture reaches down into everything below.
- Factions and story nodes join the same system through the fields they already
  had, `headquarters` and `primaryLocation`.

### Knowing what is unfinished

- The loose-ends report lists what exists but has not been put anywhere,
  separately from schema faults and dangling references. It is designed to
  reach zero: bestiary templates and PCs are exempt by nature, never dismissed
  by hand, and nothing is listed that has no honest way to close.
- Relations recorded on one side only, children claimed by two story nodes, and
  containment loops are all reported.

### One scene at a time

- A story passport shows what is in scope for that node, with its lineage.
- Focus narrows the sidebar to the cast of the scene you are running, and
  narrows nothing it cannot speak about — the story tree stays navigable and
  your party stays visible.

### When you do want the AI

- The wizard can be re-entered on an entity that already exists. Generated
  values fill blanks and never replace anything, so it is safe to run twice, or
  by accident.
- A pass that has nothing to fill says so immediately instead of generating a
  sheet and discarding it.
- Stat blocks come back parseable: the gear format is stated in the prompt with
  a worked example, and every field the model should write is required rather
  than optional.
- A visual anchor you write is kept as the appearance and never overwritten.

### Fixes

- Markdown links left by the JSON migration are flattened wherever they sit, so
  no file path is ever shown as a name. 65 files cleaned.
- Chat sessions whose filename lost a leading digit open again, and heal on
  save.
- References to a location's internal zones resolve to the location that holds
  them — 0.4's own migration had made fourteen of them invisible.
- A trailing qualifier no longer breaks a link: "Rain World (Decaying
  Megastructures)" finds Rain World.
- A PC referenced without their point total still resolves.
- Renaming an entity no longer moves it to the top of the list.
- The story picker lists titles, in story order, rather than filenames.

### For developers

- `.\dev.cmd` starts both servers, waits for them, opens the browser and streams
  both logs into one window. Ctrl+C stops both and leaves nothing orphaned.
- `npm run typecheck` is real and runs in CI; the previous invocation checked
  nothing.
- Version parity across the four places that declare one is enforced by a test.

## 0.3.0

See the GitHub release notes.
