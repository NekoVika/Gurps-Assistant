"""The schema a model answers when it builds a character.

A structured output is only as good as the shape it is constrained to, so what
matters here is as much what the schema refuses to carry as what it holds. The
whole point of the exercise is that there is nowhere to put a point cost -- and,
since the 0.5 manual check, that a skill cannot arrive without its level.
"""
import json

import pytest
from pydantic import ValidationError

from gurpsai.domain.character_build import (
    Attribute, CharacterBuild, GearItem, Modifier, Skill, Trait,
)

PARTS = (Attribute, Trait, Skill)


def field_names(model) -> set[str]:
    return set(model.model_json_schema()["properties"].keys())


class TestNowhereToPutACost:
    """The constraint that does the work."""

    @pytest.mark.parametrize("model", PARTS)
    def test_no_part_has_a_field_for_points(self, model):
        assert not {"points", "cost", "cost_value", "value"} & field_names(model)

    def test_a_build_states_no_point_total(self):
        assert "pointTotal" not in field_names(CharacterBuild)
        assert "point_total" not in field_names(CharacterBuild)

    def test_a_cost_offered_anyway_is_dropped_rather_than_stored(self):
        # Pydantic ignores unknown keys by default, so a model that writes one
        # out of habit does not get it onto the sheet.
        trait = Trait(name="Combat Reflexes", points=15)
        assert not hasattr(trait, "points")

    @pytest.mark.parametrize("model", PARTS)
    def test_no_description_teaches_the_bracket_notation(self, model):
        # The storage schema's own examples ("Combat Reflexes [15]") are where
        # the habit comes from. These must not repeat it.
        schema = json.dumps(model.model_json_schema())
        assert "[15]" not in schema
        assert "[Points]" not in schema


class TestASkillCannotArriveWithoutItsLevel:
    """Found in the 0.5 manual check, and reproduced: with `level` optional on
    an entry shared with attributes and traits, Gemini 2.5 Flash left it out of
    every skill that had a specialty, and the app could price none of them."""

    def test_a_skill_without_a_level_is_refused(self):
        with pytest.raises(ValidationError):
            Skill(name="Guns/TL", specialty="Pistol", tl=8)

    def test_the_schema_requires_it(self):
        assert "level" in Skill.model_json_schema()["required"]

    def test_a_specialty_skill_carries_its_level(self):
        skill = Skill(name="Guns/TL", specialty="Rifle", tl=8, level="DX+2")
        assert skill.level == "DX+2"

    def test_the_description_says_so_for_specialties_too(self):
        described = Skill.model_json_schema()["properties"]["level"]["description"]
        assert "never the final number" in described
        assert "specialty too" in described

    def test_an_attribute_requires_its_score(self):
        with pytest.raises(ValidationError):
            Attribute(name="DX")
        assert Attribute(name="Basic Speed", score=6.25).score == 6.25


class TestWhatItAsksFor:
    def test_a_self_control_number_is_one_the_book_uses(self):
        assert Trait(name="Bad Temper", self_control=9).self_control == 9

    @pytest.mark.parametrize("bad", [7, 10, 11, 13, 0])
    def test_a_self_control_number_the_book_does_not_use_is_refused(self, bad):
        # B123 gives four: 6, 9, 12 and 15. A schema that accepts 10 invites a
        # multiplier nobody can apply.
        with pytest.raises(ValidationError):
            Trait(name="Bad Temper", self_control=bad)

    def test_a_modifier_carries_its_percentage(self):
        trait = Trait(name="Insubstantiality", modifiers=[Modifier(name="Always On", percent=-50)])
        assert trait.modifiers[0].percent == -50

    def test_sections_default_to_empty_rather_than_missing(self):
        build = CharacterBuild(name="Rick")
        assert build.attributes == build.advantages == build.disadvantages == build.skills == []
        assert build.unpriceable == []

    def test_gear_defaults_its_quantity(self):
        assert GearItem(name="Medkit").quantity == 1


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

    def test_sections(self):
        assert field_names(CharacterBuild) == {
            "name", "concept", "attributes", "advantages", "disadvantages", "skills", "unpriceable"}

    def test_attribute_fields(self):
        assert field_names(Attribute) == {"name", "score", "notes"}

    def test_trait_fields(self):
        assert field_names(Trait) == {"name", "levels", "specialty", "self_control", "modifiers", "notes"}

    def test_skill_fields(self):
        assert field_names(Skill) == {"name", "specialty", "level", "tl", "notes"}

    def test_modifier_fields(self):
        assert field_names(Modifier) == {"name", "percent"}

    def test_gear_fields(self):
        assert field_names(GearItem) == {"name", "quantity", "weight", "cost", "notes"}


class TestTheChatAssistantIsToldTheSameShape:
    """draft_file describes the build in prose (a schema would ride along with
    every chat turn). The review panel prices exactly these fields, so a field
    the description forgets is a choice the assistant cannot make."""

    @pytest.mark.parametrize("model", (*PARTS, Modifier, GearItem))
    def test_every_field_is_named(self, model):
        from gurpsai.app.services.chat import DRAFT_FILE_DESCRIPTION
        for name in field_names(model):
            assert f'"{name}"' in DRAFT_FILE_DESCRIPTION, name

    def test_every_section_is_named(self):
        from gurpsai.app.services.chat import DRAFT_FILE_DESCRIPTION
        for name in ("attributes", "advantages", "disadvantages", "skills", "unpriceable"):
            assert f'"{name}"' in DRAFT_FILE_DESCRIPTION, name

    def test_it_says_not_to_price_and_that_a_skill_needs_its_level(self):
        from gurpsai.app.services.chat import DRAFT_FILE_DESCRIPTION
        assert "give no point costs" in DRAFT_FILE_DESCRIPTION
        assert "every skill needs" in DRAFT_FILE_DESCRIPTION


class TestTheSchemaSurvivesTheRoundTrip:
    def test_a_build_serialises_to_json_and_back(self):
        build = CharacterBuild(
            name="Rick", concept="A tired scavenger.",
            attributes=[Attribute(name="DX", score=12)],
            skills=[Skill(name="Stealth", level="DX+1")],
            disadvantages=[Trait(name="Bad Temper", self_control=9)],
            unpriceable=["An Ally: his dog"],
        )
        again = CharacterBuild.model_validate(json.loads(build.model_dump_json()))
        assert again == build

    def test_the_schema_is_valid_json_schema_for_a_provider_to_enforce(self):
        schema = CharacterBuild.model_json_schema()
        assert schema["type"] == "object"
        # Nested models have to resolve, or a provider will reject the schema.
        assert {"Attribute", "Trait", "Skill"} <= set(schema["$defs"])
