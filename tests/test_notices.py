"""Tests for engine/notices.py: deduplication, merge rules and priority order."""

from __future__ import annotations

from engine.notices import (
    ESTIMATE,
    FESTIVE_DAY,
    GENERIC,
    HOME_FAR,
    INFO,
    NO_SERVICE,
    NOT_REALTIME,
    OUT_OF_VALIDITY,
    WARNING,
    FestiveIntoNoService,
    MergeRule,
    Notice,
    NoticeComposer,
    OutOfValiditySupersedes,
    notice,
)


def test_default_levels_follow_priority() -> None:
    assert notice(OUT_OF_VALIDITY, "x").level == WARNING
    assert notice(HOME_FAR, "x").level == WARNING
    assert notice(FESTIVE_DAY, "x").level == INFO
    assert notice(NOT_REALTIME, "x").level == INFO
    assert notice(NOT_REALTIME, "x", "error").level == "error"
    assert Notice("unknown", INFO, "x").priority == Notice(GENERIC, INFO, "x").priority


def test_out_of_validity_supersedes_no_service_and_festive() -> None:
    # Review B4: Sunday 20/12 showed validity + Sunday + "no train" separately.
    composed = NoticeComposer().compose(
        [
            notice(NOT_REALTIME, "Non in tempo reale."),
            notice(FESTIVE_DAY, "Festivo."),
            notice(NO_SERVICE, "Nessun treno."),
            notice(OUT_OF_VALIDITY, "Fuori validità."),
        ]
    )
    assert [n.code for n in composed] == [OUT_OF_VALIDITY, NOT_REALTIME]


def test_festive_is_folded_into_no_service() -> None:
    composed = NoticeComposer().compose(
        [notice(FESTIVE_DAY, "È Natale."), notice(NO_SERVICE, "Nessun treno.")]
    )
    assert composed == (Notice(NO_SERVICE, WARNING, "Nessun treno. È Natale."),)


def test_duplicates_removed_and_sorted_by_priority_stably() -> None:
    composed = NoticeComposer().compose(
        [
            notice(ESTIMATE, "Stima A."),
            notice(HOME_FAR, "Lontano."),
            notice(ESTIMATE, "Stima A."),
            notice(GENERIC, "Altro."),
            notice(ESTIMATE, "Stima B."),
        ]
    )
    assert [n.message for n in composed] == ["Lontano.", "Stima A.", "Stima B.", "Altro."]


def test_rules_leave_unrelated_lists_untouched() -> None:
    notices = [notice(ESTIMATE, "Stima.")]
    assert OutOfValiditySupersedes().apply(notices) == notices
    assert FestiveIntoNoService().apply(notices) == notices
    assert FestiveIntoNoService().apply([notice(FESTIVE_DAY, "F.")]) == [notice(FESTIVE_DAY, "F.")]


def test_custom_rules_can_be_injected() -> None:
    class DropInfo(MergeRule):
        def apply(self, notices: list[Notice]) -> list[Notice]:
            return [n for n in notices if n.level != INFO]

    composed = NoticeComposer([DropInfo()]).compose(
        [notice(NOT_REALTIME, "Info."), notice(HOME_FAR, "Lontano.")]
    )
    assert [n.code for n in composed] == [HOME_FAR]
