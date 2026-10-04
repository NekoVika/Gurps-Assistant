"""Parsing the book's own Trait Lists into a priced catalogue.

These tables are the catalogue's source of truth, so a silent regression here
would quietly mis-price characters rather than fail. Every fixture below is a
real shape from the Basic Set's pp.299-306, including the three column wraps
that made the first parse produce traits called "Detect Lies Psychology-4" and
"M/P/Soc tells whether an advantage is mental, physical, or social. ... Detect".

The parser is pure, so none of this needs the rules database -- which is just
as well, since it is not in version control.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from rulesdb_lib.extractors.trait_lists import (  # noqa: E402
    classify_cost, clean, mend, parse_modifiers, parse_skills, parse_traits,
    split_defaults, suspect,
)


def lines(text: str) -> list[str]:
    return clean([l.strip() for l in text.strip().split("\n") if l.strip()])


ADVANTAGES = """
Advantage
M/P/Soc X/Sup
Cost
Page
360� Vision
P
X
25
34
Acute Hearing
P
�
2/level
35
Allies
Soc
�
Variable
36
Alternate Identity
Soc
�
5 or 15
39
"""

DISADVANTAGES = """
Advantage
M/P/Soc X/Sup
Cost
Page
Lame
P
�
-10 to -30
143
Addiction
M/P
�
Variable
122, 164, 165
"""


class TestAdvantageTable:
    def test_every_row_carries_a_cost_and_a_page(self):
        rows = parse_traits(lines(ADVANTAGES), "advantage")
        assert [(r["name"], r["cost_text"], r["page"]) for r in rows] == [
            ("360° Vision", "25", 34),
            ("Acute Hearing", "2/level", 35),
            ("Allies", "Variable", 36),
            ("Alternate Identity", "5 or 15", 39),
        ]

    def test_a_lost_glyph_after_a_digit_was_a_degree_sign(self):
        rows = parse_traits(lines(ADVANTAGES), "advantage")
        assert rows[0]["name"] == "360° Vision"
        assert not any(suspect(r) for r in rows)

    def test_the_exotic_column_is_read_not_guessed(self):
        rows = parse_traits(lines(ADVANTAGES), "advantage")
        assert rows[0]["exotic"] is True      # X
        assert rows[1]["exotic"] is False     # a dash means mundane

    def test_a_cost_printed_as_a_range_still_parses(self):
        rows = parse_traits(lines(DISADVANTAGES), "disadvantage")
        lame = next(r for r in rows if r["name"] == "Lame")
        assert (lame["cost_text"], lame["cost_kind"]) == ("-10 to -30", "range")

    def test_several_pages_keep_the_first(self):
        # "Addiction  M/P  -  Variable  122, 164, 165" used to break the row.
        rows = parse_traits(lines(DISADVANTAGES), "disadvantage")
        assert next(r for r in rows if r["name"] == "Addiction")["page"] == 122


PREAMBLE_THEN_TABLE = """
TRAIT LISTS
M/P/Soc tells whether an advantage is mental, physical, or social. X/Sup tells whether an advantage is exotic or supernatural. Detect
P
X
Variable
48
"""


def test_the_table_preamble_is_not_a_trait():
    """One advantage used to be named after the paragraph above the table."""
    rows = parse_traits(lines(PREAMBLE_THEN_TABLE), "advantage")
    assert [r["name"] for r in rows] == ["Detect"]


MODIFIERS = """
Name
Type
Value
Page
Incendiary (inc)
A
+10%
105
Increased Range
�
+10%/level
106
"""


def test_modifiers_parse_with_their_percentage():
    rows = parse_modifiers(lines(MODIFIERS))
    assert [(r["name"], r["cost_text"], r["page"]) for r in rows] == [
        ("Incendiary (inc)", "+10%", 105),
        ("Increased Range", "+10%/level", 106),
    ]
    assert all(r["kind"] == "modifier" for r in rows)


SKILLS = """
Skill
Attr Diff
Defaults
Page
Climbing
DX
A
DX-5
183
Cloak
DX
A
DX-5, Net-4, Shield (any)-4 184
Computer
IQ
E
IQ-4
184
Operation/TL
Detect Lies
Per
H
Psychology-4
187
"""


class TestSkillTable:
    def test_a_plain_row_parses(self):
        rows = parse_skills(lines(SKILLS))
        climbing = next(r for r in rows if r["name"] == "Climbing")
        assert (climbing["attr"], climbing["difficulty"], climbing["defaults"]) == ("DX", "A", "DX-5")

    def test_a_page_glued_to_the_defaults_is_split_off(self):
        rows = parse_skills(lines(SKILLS))
        cloak = next(r for r in rows if r["name"] == "Cloak")
        assert cloak["page"] == 184
        assert cloak["defaults"] == "DX-5, Net-4, Shield (any)-4"

    def test_a_name_wrapping_past_its_own_page_is_rejoined(self):
        # "Computer / IQ / E / IQ-4 / 184 / Operation/TL" is one skill.
        rows = parse_skills(lines(SKILLS))
        assert "Computer Operation/TL" in [r["name"] for r in rows]

    def test_a_default_is_never_mistaken_for_the_rest_of_a_name(self):
        # This produced "Detect Lies Psychology-4" across 29 rows.
        rows = parse_skills(lines(SKILLS))
        detect = next(r for r in rows if r["name"].startswith("Detect"))
        assert detect["name"] == "Detect Lies"
        assert "Psychology-4" in detect["defaults"]

    def test_nothing_in_the_fixture_is_left_suspect(self):
        assert [suspect(r) for r in parse_skills(lines(SKILLS))] == [[], [], [], []]


class TestCostShapes:
    @pytest.mark.parametrize("text, expected", [
        ("15", ("flat", 15)),
        ("-15", ("flat", -15)),
        ("2/level", ("per_level", 2)),
        ("5 or 15", ("choice", None)),
        ("-10 to -30", ("range", None)),
        ("Variable", ("variable", None)),
        ("Variable*", ("variable", None)),
        ("", ("unknown", None)),
    ])
    def test_a_printed_cost_becomes_a_shape_and_a_value(self, text, expected):
        assert classify_cost(text) == expected

    def test_variable_is_a_value_not_a_failure(self):
        # An advisory checker has to be able to say "this one depends".
        kind, value = classify_cost("Variable")
        assert kind == "variable" and value is None


class TestHelpers:
    def test_split_defaults_leaves_a_clean_name_alone(self):
        assert split_defaults("Climbing") == ("Climbing", "")

    def test_split_defaults_cuts_at_the_first_penalty(self):
        assert split_defaults("Knife Main-Gauche-3, Shortsword-3") == (
            "Knife", "Main-Gauche-3, Shortsword-3")

    def test_mend_keeps_only_what_follows_a_finished_sentence(self):
        assert mend("...a self-control number of 12. Enemies") == "Enemies"

    def test_mend_strips_a_trailing_footnote_dagger(self):
        assert mend("Connoisseur�") == "Connoisseur"

    @pytest.mark.parametrize("name, reason", [
        ("Tactics 303", "a page number leaked into the name"),
        ("Detect Lies Psychology-4", "a default leaked into the name"),
        ("Flying Leap TRAIT LISTS", "page furniture in the name"),
    ])
    def test_wreckage_is_reported_rather_than_discarded(self, name, reason):
        assert reason in suspect({"name": name, "kind": "skill"})

    def test_a_trait_name_containing_digits_is_not_wreckage(self):
        assert suspect({"name": "360° Vision", "kind": "advantage", "cost_text": "25"}) == []


SPECIALISED = """
Skill
Attr Diff
Defaults
Page
Guns/TL\u2020
DX
E
DX-4
198
Hazardous
IQ
A
IQ-5
199
Materials/TL\u2020
Heraldry
IQ
A
IQ-5
199
"""


class TestFootnoteMarkers:
    """The book's two markers carry meaning and must not stay in the text."""

    def test_a_dagger_means_the_skill_requires_specialisation(self):
        rows = parse_skills(lines(SPECIALISED))
        guns = next(r for r in rows if r["name"].startswith("Guns"))
        assert guns["name"] == "Guns/TL"      # a sheet writes Guns/TL8 (Pistol)
        assert guns["specialised"] is True

    def test_a_marker_on_a_wrapped_name_is_still_read(self):
        # "Hazardous" + "Materials/TL<dagger>" only becomes readable once the
        # row above is rejoined, which happens after the first strip has run.
        rows = parse_skills(lines(SPECIALISED))
        hazmat = next(r for r in rows if r["name"].startswith("Hazardous"))
        assert hazmat["name"] == "Hazardous Materials/TL"
        assert hazmat["specialised"] is True

    def test_an_asterisk_on_a_cost_means_a_self_control_number(self):
        # Printed costs are for CR 12, so a sheet may legitimately differ and
        # the checker must not call -5 a disagreement with -10.
        rows = parse_traits(lines("""
Advantage
M/P/Soc X/Sup
Cost
Page
Bad Temper
M
\ufffd
-10*
124
Bowlegged
P
\ufffd
-1
165
"""), "disadvantage")
        bad_temper, bowlegged = rows
        assert bad_temper["self_control"] is True
        assert bad_temper["cost_value"] == -10
        assert bowlegged["self_control"] is False

    def test_no_marker_survives_into_a_name(self):
        assert all("\u2020" not in r["name"] for r in parse_skills(lines(SPECIALISED)))


class TestRowCoverage:
    """Every row the book prints has to come out, whatever it costs.

    The parser's job is to carry the book's own tables across intact. A cost
    shape nobody anticipated is a reason to record the row with an honest
    "we cannot price this", never a reason to lose the row -- but the cost
    pattern used to sit in the gate that decides whether four lines *are* a
    row, so an unfamiliar cost made the whole trait invisible. Twenty-four
    rows went missing from pp.299-302 that way, including Magery, Extra
    Attack, Code of Honor, Vow, Teeth and Striker.

    Each case below is a real row from the Basic Set, quoted as the columns
    come out of extraction.
    """

    #: name, category, exotic, printed cost, page, expected shape
    PRINTED_ROWS = [
        # The shapes that always worked.
        ("Combat Reflexes", "M", "�", "15", "43", "flat"),
        ("Acute Hearing", "P", "�", "2/level", "35", "per_level"),
        ("Allies", "Soc", "�", "Variable", "36", "variable"),
        ("Alternate Identity", "Soc", "�", "5 or 15", "39", "choice"),
        ("Lame", "P", "�", "-10 to -30", "143", "range"),
        # Priced per something that is not a level. B53, B54, B23, B55.
        ("Extra Attack", "P", "�", "25/attack", "53", "per_level"),
        ("Extra Head", "P", "X", "15/head", "54", "per_level"),
        ("Extra Life", "P", "X", "25/life", "55", "per_level"),
        ("Extra Mouth", "P", "X", "5/mouth", "55", "per_level"),
        ("Duplication", "P", "X", "35/copy", "35", "per_level"),
        ("Gizmos", "P", "�", "5/gizmo", "57", "per_level"),
        ("Protected Sense", "P", "X", "5/sense", "78", "per_level"),
        # A flat entry fee plus a price per level. B66, B93, B94, B96.
        ("Magery", "M", "Sup", "5 + 10/level", "66", "base_plus_per_level"),
        ("Terror", "M", "Sup", "30 + 10/level", "93", "base_plus_per_level"),
        ("Tunneling", "P", "X", "30 + 5/level", "94", "base_plus_per_level"),
        ("Vampiric Bite", "P", "X", "30 + 5/level", "96", "base_plus_per_level"),
        # A choice written with commas rather than "or". B91, B22, B154, B156.
        ("Teeth", "P", "X", "0, 1, or 2", "91", "choice"),
        ("Odious Personal Habits", "Soc", "�", "-5, -10, or -15", "22", "choice"),
        ("Shyness", "M", "�", "-5, -10, or -20", "154", "choice"),
        ("Terminally Ill", "P", "�", "-50, -75, or -100", "158", "choice"),
        # A range written with a hyphen, and an open-ended minimum. B88, B40.
        ("Striker", "P", "X", "5-8", "88", "range"),
        ("Blessed", "M", "Sup", "10+", "40", "range"),
        # A choice between a figure and a range. B127, B130, B162, B159.
        ("Code of Honor", "M", "�", "-1 or -5 to -15", "127", "choice"),
        ("Delusions", "M", "�", "-1 or -5 to -15", "130", "choice"),
        ("Trademark", "M", "�", "-1 or -5 to -15", "159", "choice"),
        ("Vow", "M", "�", "-1 or -5 to -15", "162", "choice"),
        # Per level, where the level's price itself is a choice. B40.
        ("Arm ST", "P", "X", "3, 5, or 8/level", "40", "choice"),
        ("Cultural Familiarity", "Soc", "�", "1 or 2/culture", "23", "choice"),
        # A self-control cost that is also a choice must keep both facts. B146.
        ("Obsession", "M", "�", "-1, -5, or -10*", "146", "choice"),
    ]

    @staticmethod
    def _table(rows):
        body = "\n".join(
            "\n".join([name, category, exotic, cost, page])
            for name, category, exotic, cost, page, _ in rows)
        return lines("Advantage\nM/P/Soc X/Sup\nCost\nPage\n" + body)

    def test_no_printed_row_is_lost(self):
        parsed = parse_traits(self._table(self.PRINTED_ROWS), "advantage")
        missing = ({r[0] for r in self.PRINTED_ROWS}
                   - {r["name"] for r in parsed})
        assert not missing, f"the book prints these and the parser dropped them: {sorted(missing)}"
        assert len(parsed) == len(self.PRINTED_ROWS)

    @pytest.mark.parametrize(
        "name, category, exotic, cost, page, shape", PRINTED_ROWS,
        ids=[f"{r[0]} = {r[3]}" for r in PRINTED_ROWS])
    def test_a_printed_row_keeps_its_name_cost_and_page(
            self, name, category, exotic, cost, page, shape):
        row = parse_traits(
            self._table([(name, category, exotic, cost, page, shape)]), "advantage")
        assert len(row) == 1, f"{cost!r} cost {name!r} its row"
        assert row[0]["name"] == name
        assert row[0]["cost_text"] == cost
        assert row[0]["cost_kind"] == shape
        assert row[0]["page"] == int(page)

    def test_an_unclassifiable_cost_is_recorded_rather_than_dropped(self):
        # The invariant the gate used to break. A shape from a book we have not
        # read yet must still produce a trait the GM can see and price by hand.
        rows = parse_traits(self._table(
            [("Someday Advantage", "M", "�", "7 per fortnight", "999", "unknown")]),
            "advantage")
        assert len(rows) == 1
        assert rows[0]["name"] == "Someday Advantage"
        assert rows[0]["cost_kind"] == "unknown"
        assert rows[0]["cost_value"] is None

    def test_a_cost_cell_that_is_not_a_cost_does_not_invent_a_row(self):
        # The gate still has to be a gate: loosening the cost column must not
        # turn stray prose between two tables into traits.
        rows = parse_traits(lines("""
Advantage
M/P/Soc X/Sup
Cost
Page
Luck
M
�
15
66
See the rules for
M
all of these on
299
"""), "advantage")
        assert [r["name"] for r in rows] == ["Luck"]

    def test_a_self_control_marker_survives_a_choice_of_costs(self):
        rows = parse_traits(self._table(
            [("Obsession", "M", "�", "-1, -5, or -10*", "146", "choice")]),
            "advantage")
        assert rows[0]["self_control"] is True
        assert rows[0]["cost_kind"] == "choice"
