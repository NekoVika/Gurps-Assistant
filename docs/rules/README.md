# Rules the app implements

The GURPS 4e rules the app applies when it prices a sheet, each with its page in
the Basic Set and where it lives in the code. Paraphrased, never quoted at
length: the book is the GM's, and the catalogue is built from their own PDFs
([0004](../decisions/0004-catalogue-from-the-gms-own-books.md)).

| Topic | File |
|---|---|
| Skills: cost, attribute, difficulty, defaults, Talents | [skills.md](skills.md) |

Rules for attributes (B14-19), modifiers (B101-103) and self-control (B123) are
cited in the code itself — `web/src/lib/gurpsRules.ts`, `modifiers.ts` — and
get their own page here when next changed.
