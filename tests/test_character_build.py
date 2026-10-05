"""The schema a model answers when it builds a character.

A structured output is only as good as the shape it is constrained to, so what
matters here is as much what the schema refuses to carry as what it holds. The
whole point of the exercise is that there is nowhere to put a point cost.
"""
import json

import pytest
from pydantic import ValidationError

from gurpsai.domain.character_build import BuildEntry, CharacterBuild, Modifier


def field_names(model) -> set[str]:
    return set(model.model_json_schema()["properties"].keys())


class TestNowhereToPutACost:
    """The constraint that does the work."""

    def test_an_entry_has_no_field_for_points(self):
        names = field_names(BuildEntry)
        assert not {"points", "cost", "cost_value", "value"} & names

    def test_a_build_states_no_point_total(self):
        assert "pointTotal" not in field_names(CharacterBuild)
        assert "point_total" not in field_names(CharacterBuild)

    def test_a_cost_offered_anyway_is_dropped_rather_than_stored(self):
        # Pydantic ignores unknown keys by default, so a model that writes one
        # out of habit does not get it onto the sheet.
        entry = BuildEntry(kind="advantage", name="Combat Reflexes", points=15)
        assert not hasattr(entry, "points")

    def test_no_description_teaches_the_bracket_notation(self):
        # The storage schema's own examples ("Combat Reflexes [15]") are where
        # the habit comes from. This one must not repeat it.
        schema = json.dumps(BuildEntry.model_json_schema())
        assert "[15]" not in schema
        assert "[Points]" not in schema


class TestWhatItAsksFor:
    def test_a_skill_is_asked_for_a_relative_level(self):
        entry = BuildEntry(kind="skill", name="Guns/TL", specialty="Rifle", tl=8, level="DX+2")
        assert entry.level == "DX+2"
        assert entry.score is None

    def test_the_level_description_forbids_the_final_number(self):
        described = BuildEntry.model_json_schema()["properties"]["level"]["description"]
        assert "never the final number" in described

    def test_an_attribute_is_asked_for_a_score(self):
        assert BuildEntry(kind="attribute", name="DX", score=13).score == 13

    def test_basic_speed_may_carry_a_quarter(self):
        assert BuildEntry(kind="attribute", name="Basic Speed", score=6.25).score == 6.25

    def test_a_self_control_number_is_one_the_book_uses(self):
        assert BuildEntry(kind="disadvantage", name="Bad Temper", self_control=9).self_control == 9

    @pytest.mark.parametrize("bad", [7, 10, 11, 13, 0])
    def test_a_self_control_number_the_book_does_not_use_is_refused(self, bad):
        # B123 gives four: 6, 9, 12 and 15. A schema that accepts 10 invites a
        # multiplier nobody can apply.
        with pytest.raises(ValidationError):
            BuildEntry(kind="disadvantage", name="Bad Temper", self_control=bad)

    def test_a_modifier_carries_its_percentage(self):
        entry = BuildEntry(kind="advantage", name="Insubstantiality",
                           modifiers=[Modifier(name="Always On", percent=-50)])
        assert entry.modifiers[0].percent == -50

    def test_a_section_outside_the_sheet_is_refused(self):
        with pytest.raises(ValidationError):
            BuildEntry(kind="equipment", name="Pistol")

    def test_entries_default_to_empty_rather_than_missing(self):
        build = CharacterBuild(name="Rick")
        assert build.entries == []
        assert build.unpriceable == []


class TestTheHonestEscapeHatch:
    """Where a model should put what the book does not price with a figure."""

    def test_a_build_can_name_what_it_could_not_price(self):
        build = CharacterBuild(name="Rick", unpriceable=["A Patron: the Hunters, appears often"])
        assert build.unpriceable == ["A Patron: the Hunters, appears often"]

    def test_the_description_tells_it_to_name_rather_than_guess(self):
        described = CharacterBuild.model_json_schema()["properties"]["unpriceable"]["description"]
        assert "rather than guessing" in described


class TestTheWizardAsksForTheSameThing:
    """The wizard sends an inlined copy of this schema, because Gemini takes no
    `$ref`. `wizards.test.ts` pins the same names, so neither side can drift
    alone: change a field here and that test must change with it."""

    ENTRY_FIELDS = {"kind", "name", "score", "level", "levels", "specialty", "tl",
                    "self_control", "modifiers", "notes"}

    def test_entry_fields_match_the_wizard(self):
        assert field_names(BuildEntry) == self.ENTRY_FIELDS

    def test_modifier_fields_match_the_wizard(self):
        assert field_names(Modifier) == {"name", "percent"}


class TestTheSchemaSurvivesTheRoundTrip:
    def test_a_build_serialises_to_json_and_back(self):
        build = CharacterBuild(
            name="Rick", concept="A tired scavenger.",
            entries=[
                BuildEntry(kind="attribute", name="DX", score=12),
                BuildEntry(kind="skill", name="Stealth", level="DX+1"),
                BuildEntry(kind="disadvantage", name="Bad Temper", self_control=9),
            ],
            unpriceable=["An Ally: his dog"],
        )
        again = CharacterBuild.model_validate(json.loads(build.model_dump_json()))
        assert again == build

    def test_the_schema_is_valid_json_schema_for_a_provider_to_enforce(self):
        schema = CharacterBuild.model_json_schema()
        assert schema["type"] == "object"
        assert "entries" in schema["properties"]
        # Nested models have to resolve, or a provider will reject the schema.
        assert "$defs" in schema and "BuildEntry" in schema["$defs"]
