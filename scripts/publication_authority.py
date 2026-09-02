from __future__ import annotations

from typing import Any


class PublicationAuthorityError(ValueError):
    pass


def validate_anonymous_repository(
    repository: dict[str, Any],
    *,
    expected_repository: str,
    expected_default_branch: str,
) -> None:
    if (
        repository.get("full_name") != expected_repository
        or repository.get("private") is not False
        or repository.get("visibility") != "public"
        or repository.get("default_branch") != expected_default_branch
        or repository.get("has_pages") is not False
        or repository.get("has_discussions") is not False
    ):
        raise PublicationAuthorityError("anonymous-repository-authority")

    merge_authority = (
        repository.get("allow_squash_merge"),
        repository.get("allow_merge_commit"),
        repository.get("allow_rebase_merge"),
    )
    if any(value is not None for value in merge_authority) and merge_authority != (
        True,
        False,
        False,
    ):
        raise PublicationAuthorityError("anonymous-repository-merge-authority")
