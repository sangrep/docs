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


def validate_anonymous_ruleset(
    ruleset: dict[str, Any],
    *,
    expected_ruleset_id: int,
    expected_ruleset_name: str,
    expected_required_check: str,
    expected_required_integration_id: int,
) -> None:
    if (
        ruleset.get("id") != expected_ruleset_id
        or ruleset.get("name") != expected_ruleset_name
        or ruleset.get("target") != "branch"
        or ruleset.get("enforcement") != "active"
        or ruleset.get("conditions", {}).get("ref_name")
        != {"exclude": [], "include": ["~DEFAULT_BRANCH"]}
    ):
        raise PublicationAuthorityError("anonymous-ruleset-authority")

    bypass_actors = ruleset.get("bypass_actors")
    if bypass_actors is not None and bypass_actors != []:
        raise PublicationAuthorityError("anonymous-ruleset-bypass-authority")

    rule_rows = ruleset.get("rules")
    if not isinstance(rule_rows, list) or not all(isinstance(rule, dict) for rule in rule_rows):
        raise PublicationAuthorityError("anonymous-ruleset-authority")
    rules = {rule.get("type"): rule for rule in rule_rows}
    if len(rule_rows) != 4 or len(rules) != 4 or set(rules) != {
        "deletion",
        "non_fast_forward",
        "pull_request",
        "required_status_checks",
    }:
        raise PublicationAuthorityError("anonymous-ruleset-authority")
    pull_parameters = rules["pull_request"].get("parameters", {})
    status_parameters = rules["required_status_checks"].get("parameters", {})
    required_status_checks = status_parameters.get("required_status_checks")
    if (
        pull_parameters.get("allowed_merge_methods") != ["squash"]
        or pull_parameters.get("required_review_thread_resolution") is not True
        or status_parameters.get("strict_required_status_checks_policy") is not True
        or not isinstance(required_status_checks, list)
        or len(required_status_checks) != 1
        or not isinstance(required_status_checks[0], dict)
        or required_status_checks[0].get("context") != expected_required_check
        or required_status_checks[0].get("integration_id")
        != expected_required_integration_id
    ):
        raise PublicationAuthorityError("anonymous-ruleset-authority")
