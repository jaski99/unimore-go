"""Tests for engine/train_categories.py."""

import pytest

from engine.repositories import JsonTrainRepository
from engine.train_categories import (
    HIGH_SPEED,
    INTERCITY,
    REGIONAL,
    allowed,
    category_code,
    category_group,
    normalize_groups,
    requires_different_ticket,
)


@pytest.mark.parametrize(
    ("raw", "code", "group", "different"),
    [
        ("Regionale", "R", REGIONAL, False),
        ("Regionale Veloce", "RV", REGIONAL, False),
        ("Intercity", "IC", INTERCITY, True),
        ("Intercity Notte", "ICN", INTERCITY, True),
        ("Frecciarossa", "FR", HIGH_SPEED, True),
    ],
)
def test_known_categories(raw: str, code: str, group: str, different: bool) -> None:
    assert category_code(raw) == code
    assert category_group(raw) == group
    assert requires_different_ticket(raw) is different


def test_every_category_in_data_is_known() -> None:
    raw = {t.category for t in JsonTrainRepository().all_trains()}
    assert {category_code(c) for c in raw} == {"R", "RV", "IC", "ICN", "FR"}


def test_unknown_category_is_conservative() -> None:
    assert category_code("Eurocity") == "Eurocity"
    assert requires_different_ticket("Eurocity")


def test_normalize_and_allowed() -> None:
    assert normalize_groups(None) is None
    assert normalize_groups([" Regional "]) == frozenset({REGIONAL})
    with pytest.raises(ValueError):
        normalize_groups(["bus"])
    assert allowed("Frecciarossa", None)
    assert not allowed("Frecciarossa", frozenset({REGIONAL}))
    assert allowed("Regionale", frozenset({REGIONAL}))
