# Changelog

## 0.5.0 — Full Rules Ahead (unreleased)

The release that moves the rules into the app. GURPS prices a character by
arithmetic that is tedious by hand and unreliable from a model, so the app now
does it: it reads the Basic Set's own trait tables, prices what the book
prices, and says plainly when it cannot. Nothing is corrected automatically and
nothing is blocked. Where the rules are silent, so is the app.

### The book is in the app

Built from your own PDFs, so nothing is shipped that you did not buy.

- The Basic Set's Trait Lists (pp.299-306) are read into a catalogue of **809
  entries** — advantages, disadvantages, skills and modifiers — with each
  entry's printed cost, page and difficulty.
- A sheet's trait is matched to the book's entry even when the two are written
  differently: `Guns/TL8 (Pistol)` finds `Guns/TL`, `Research` finds
  `Research/TL`, `Damage Resistance 50` finds `Damage Resistance`.
- **Twenty-four traits had been going missing** and are now there, including
  Magery, Extra Attack, Code of Honor, Vow, Teeth and Striker. Their costs are
  printed in shapes the reader had never been taught — `25/attack`,
  `5 + 10/level`, `0, 1, or 2` — and an unfamiliar shape used to make the whole
  trait invisible rather than merely unpriced.

### The points add up

- The **points badge** on a character shows what the sheet's own brackets
  actually sum to, not the figure typed at the top. Where the two disagree it
  says so.
- A **running total** sits above the editor while you spend, counting against
  the character's own target first and the campaign's budget otherwise.
- Attributes, secondary characteristics, skills, advantages and disadvantages
  are all priced from the book: the attribute steps (B16-17), the skill cost
  table (B172), enhancements and limitations (B103), and self-control numbers
  (B123), so `Bad Temper (9)` is read as the book writes it.
- A template carries a nominal figure rather than a budget, so bestiary entries
  are not reported as overspending.

### Building an advantage

- The cost of an advantage is **worked out rather than typed**. Name the trait
  and the app prices it, asking for a level only where the book charges per
  level and a self-control number only where the printed cost carries an
  asterisk.
- The name box offers the whole catalogue, your campaign's own traits first.
- A cost already on the sheet is never rewritten. Where it disagrees with the
  book, the book's figure appears beside it with a button, and the choice stays
  yours.

### Traits you invented

- Declare a trait in **Custom Traits** and the app stops calling it
  unrecognised, counts its cost, and holds the sheet to it.
- Redefine a printed trait and **your price wins**. It is your table.
- Everything nothing prices is collected into one list — the gap in the
  catalogue and the candidates for declaring, in one place.

### What it will not claim

The checker reports, and stops there. These are the cases where saying nothing
is the correct answer, and it now says why rather than falling silent.

- A trait whose modifiers are named without values is not totalled.
  `Flight (Winged)` is correctly 30 and nothing here can prove it, so the app
  says so instead of charging you the unmodified 40.
- Percentages written in a note rather than in brackets are not read. Prose is
  prose, and a wrong cost is worse than no cost.
- A second specialty bought up from a default (B171, B175) is recognised as
  what it is rather than reported as underpaid.
- Where the points are right and the line describes itself wrongly — a level
  labelled `DX+1` that reaches `DX+0`, a skill called Hard that the book prices
  Average — that is reported as a wording problem, not as overspending.

### The assistant stops doing arithmetic

- The GM personas no longer compute point costs. A model chooses traits and
  levels; the app prices them. Measured across this campaign, sheets built the
  old way miss their own stated total by a third on average.
- Where the book does not price something with a single figure, the assistant
  is asked to name it for you rather than invent a number.
- **Create Entity builds sheets this way.** The model sends its choices, not
  costs; the app prices every line, writes it in the format your sheets
  already use, and states the total it added up. Attributes the model left at
  their default are written at [0], so a skill bought against Per is priced
  even when Per was never mentioned.
- A choice the app cannot price stays on the sheet with no cost and the reason
  beside it, and the total is shown as a floor. What the model said the book
  does not price — a Patron, a Secret — is added to the GM Summary under
  **Left to the GM**.
- Deepening an existing character prices its new skills against the scores
  already on the sheet, not the ones the model imagined.
- Skills based on Per or Will are priced; they had been read as `PER` and
  `WILL` and declined.
- A skill is written against the attribute the book bases it on, and keeps
  its tech level when the model leaves `/TL` off the name: Scuba asked for at
  HT+1 is written `Scuba/TL8 (IQ/A)-12`, as B219 has it.

### Correct when written, not repaired afterwards

- **AI Mend and Deep Mend File are gone**, with the Mending provider setting.
  Asked to fix a line, they asked a model for `Name [Points]` — so on a line
  the app had deliberately left unpriced, they invented the very cost it had
  declined to guess. A line the sheet cannot read now shows why, with an
  **Edit** button that opens the editor.
- The sheet reads traits and skills with the same parser as the point total,
  so a valid line such as `Chronic Pain [-10] (Result of EOD accident)` is no
  longer shown as broken.
- The assistant's personas are no longer told to put point costs in brackets
  when building a character.
- **Generated gear is written by the app.** The model sends each item's name,
  quantity, weight, cost and notes, and the app writes the line. A weight or
  cost the model did not give is written `?`, never 0. The success message
  counts any line, mechanical or gear, left for you to settle.
- Gear whose name has parentheses — `Commlink (Handheld)`, `Tactical Vest
  (Light)` — is read correctly. Six lines across the campaign had their weight
  shown as `Handheld) [1] (0.5 lbs`.
- The attribute editor no longer files `Dodge 10 [0]` or `Parry N/A [0]` under
  "Malformed": they appear under **Defences & Other**, and only lines it truly
  cannot read are listed as malformed. Every raw-text row now says what form
  it expected.
- The second, stricter trait parser is gone; nothing used it any more.
- **Characters drafted in chat are priced before you review them.** The
  assistant copies the sheet as it is and puts what it adds or changes under
  `build`, as the wizard does; the review panel prices those choices against
  the sheet's own scores and shows you the lines the app wrote. A choice
  replaces the line of the same name, so raising a skill raises it rather than
  adding a second one. Your stated point total is never changed by a draft.
- **A skill always arrives with its level.** The build lists attributes,
  advantages, disadvantages and skills separately, and a skill's level is
  required. With it optional, Gemini left the level off every skill that had
  a specialty — Guns (Pistol), Driving (Automobile) — and none of them could be
  priced.
- The advantage and disadvantage editor no longer writes `[0]` on a line the
  app left unpriced. A line you didn't touch is saved exactly as it was read;
  an unpriced line opens as a name and a note, and once you settle it the app
  prices it and drops the stale "not priced" note.
- The check that a generated character is a valid sheet runs again. Gear
  arriving as items made it fail on every generation, and the reply went
  through unchecked.
- A banner over the diff says how many lines the app priced, and lists any
  line the model wrote and priced itself, or that the sheet cannot read — so
  you can reject that hunk rather than discover it later.


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
