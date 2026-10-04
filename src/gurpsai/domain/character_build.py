"""What a model is asked for when it builds a character.

Measured across the Anomaly Hunters campaign, not one of twenty-three sheets
with a stated point total adds up to its own brackets, and the median error is
34%: a hundred-point NPC came out thirty-four points over. The cause is not a
prompt that needs tightening. The cost of a line is not a property of the line.
Guns (Rifle) is priced partly by whether Guns (Pistol) is on the same sheet
(B171, B175); a disadvantage by its self-control number (B123); a skill by a
difficulty printed in the book and not on the sheet. A model writing prose
cannot hold that graph, and `CharacterData` currently asks it to -- its own
field descriptions give "Combat Reflexes [15]" and "Brawling (DX+1)-13 [2]" as
the shape to produce.

So this is the other half of the contract: the model chooses, and the app
prices. Every field below is something a person decides. There is deliberately
nowhere to put a point cost, because a schema with no such field cannot carry a
wrong one -- which is worth more than any instruction telling it not to.

`CharacterData` is unchanged and the campaign's files keep their present shape.
The app renders these choices into exactly the strings it already stores.
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class Modifier(BaseModel):
    """An enhancement or limitation, with the value the book gives it (B103)."""

    name: str = Field(..., title="Name",
        description="The modifier as the book names it, e.g. 'Affect Substantial'.")
    percent: int = Field(..., title="Percent",
        description="Its value as a whole percentage: 100 for +100%, -50 for -50%. "
        "Give this only when the book states a figure for the modifier. If you do not "
        "know the figure, leave the modifier out and mention it in notes instead -- a "
        "half-priced list is worse than none, because it cannot be totalled.")


class BuildEntry(BaseModel):
    """One line of a character sheet, as a choice rather than as arithmetic."""

    kind: Literal["attribute", "advantage", "disadvantage", "skill"] = Field(
        ..., title="Kind", description="Which section of the sheet this belongs to.")
    name: str = Field(..., title="Name",
        description="The trait exactly as the Basic Set names it, with no level, "
        "specialty or cost attached: 'Guns/TL', not 'Guns/TL8 (Rifle) (DX/E)-14 [8]'. "
        "An attribute is 'ST', 'DX', 'IQ', 'HT', or a secondary characteristic such as "
        "'HP', 'Will', 'Per', 'FP', 'Basic Speed', 'Basic Move'.")

    score: Optional[float] = Field(None, title="Score",
        description="Attributes only: the final score, e.g. 13 for DX 13. For Basic "
        "Speed this may carry a quarter, e.g. 6.25.")

    level: Optional[str] = Field(None, title="Level",
        description="Skills only: the level relative to the attribute it is based on, "
        "e.g. 'DX+2', 'IQ-1', or plain 'IQ' for no difference. Give the relative level, "
        "never the final number -- the app works that out from the character's own "
        "attributes, which is a step you cannot be expected to get right while writing.")

    levels: Optional[int] = Field(None, title="Levels",
        description="Traits the book prices per level: how many levels. 50 for "
        "'Damage Resistance 50'. Leave empty for a trait with a flat cost.")

    specialty: Optional[str] = Field(None, title="Specialty",
        description="The parenthesised qualifier where the trait takes one: 'Rifle' for "
        "Guns, 'Arctic' for Survival. Also the variety, where the book prices several "
        "under one name.")

    tl: Optional[int] = Field(None, title="Tech Level",
        description="For a skill the book prints as '/TL': the tech level it is learned "
        "at, e.g. 8. The campaign's own tech level is the default.")

    self_control: Optional[Literal[6, 9, 12, 15]] = Field(None, title="Self-Control Number",
        description="Required for any disadvantage whose printed cost carries an "
        "asterisk, meaning it offers a chance to resist (B123). 12 is the default and "
        "leaves the cost as printed; 9 raises it by half, 6 doubles it, 15 halves it. "
        "Choose the number that fits the character; the app applies the multiplier.")

    modifiers: List[Modifier] = Field(default_factory=list, title="Modifiers",
        description="Enhancements and limitations applied to this trait, each with its "
        "percentage. Give all of them or none.")

    notes: str = Field("", title="Notes",
        description="One short line the GM should read: what the trait does at the "
        "table, or a page citation. Never a point cost.")


class CharacterBuild(BaseModel):
    """A character as a set of choices, for the app to price.

    Nothing here states a point total. The app computes it from the entries and
    writes it onto the sheet, which is the only total worth stating -- one that
    was added up rather than asserted.
    """

    name: str = Field(..., title="Name")
    concept: str = Field("", title="Concept",
        description="A sentence on who this is. Prose, not mechanics.")

    entries: List[BuildEntry] = Field(default_factory=list, title="Entries",
        description="Every mechanical line of the sheet. Put the four primary "
        "attributes first; the app handles anything priced against them.")

    unpriceable: List[str] = Field(default_factory=list, title="Left To The GM",
        description="Anything you wanted on this character that the Basic Set does not "
        "price with a single figure -- a Patron, an Ally, a Secret, a trait priced "
        "'Variable' or as a range. Name it here in plain words rather than guessing a "
        "cost. The GM will settle it, and saying so is more useful than a number that "
        "looks right.")
