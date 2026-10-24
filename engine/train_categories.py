"""Train category groups and the fare implications of each group.

Raw categories come from the PDF ("Regionale", "Regionale Veloce",
"Intercity", "Intercity Notte", "EuroCity", "Frecciarossa"). Groups let users filter
by ticket type; adding a category is a one-line change in ``CATEGORY_GROUPS``.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

REGIONAL = "regional"
INTERCITY = "intercity"
HIGH_SPEED = "high_speed"


@dataclass(frozen=True)
class CategoryGroup:
    key: str
    label: str
    codes: tuple[str, ...]
    regional_ticket: bool  # True when the regional ticket/subscription is valid


GROUPS: dict[str, CategoryGroup] = {
    REGIONAL: CategoryGroup(REGIONAL, "Regionale (R/RV)", ("R", "RV"), regional_ticket=True),
    INTERCITY: CategoryGroup(
        INTERCITY, "Intercity (IC/ICN/EC)", ("IC", "ICN", "EC"), regional_ticket=False
    ),
    HIGH_SPEED: CategoryGroup(HIGH_SPEED, "Frecciarossa (FR)", ("FR",), regional_ticket=False),
}

# Raw PDF category name -> (short code, group key)
CATEGORY_GROUPS: dict[str, tuple[str, str]] = {
    "regionale": ("R", REGIONAL),
    "regionale veloce": ("RV", REGIONAL),
    "intercity": ("IC", INTERCITY),
    "intercity notte": ("ICN", INTERCITY),
    "eurocity": ("EC", INTERCITY),
    "frecciarossa": ("FR", HIGH_SPEED),
}

DIFFERENT_TICKET_LABEL = "Biglietto diverso / supplemento"


def category_group(category: str) -> str:
    """Group key for a raw category; unknown categories are treated as non-regional."""
    entry = CATEGORY_GROUPS.get(category.strip().lower())
    return entry[1] if entry else INTERCITY


def category_code(category: str) -> str:
    """Short code (R, RV, IC, ICN, EC, FR); unknown categories return the raw value."""
    entry = CATEGORY_GROUPS.get(category.strip().lower())
    return entry[0] if entry else category


def requires_different_ticket(category: str) -> bool:
    """True when a regional ticket is not enough (IC/FR need their own fare)."""
    return not GROUPS[category_group(category)].regional_ticket


def normalize_groups(groups: Iterable[str] | None) -> frozenset[str] | None:
    """Validate group keys. None means 'all categories' (backward compatible)."""
    if groups is None:
        return None
    normalized = frozenset(g.strip().lower() for g in groups)
    unknown = normalized - GROUPS.keys()
    if unknown:
        raise ValueError(f"Unknown train category group(s): {sorted(unknown)}")
    return normalized


def allowed(category: str, groups: frozenset[str] | None) -> bool:
    return groups is None or category_group(category) in groups
