from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
AUTHORITY_PATH = REPOSITORY_ROOT / "scripts" / "publication_authority.py"


def load_authority_module():
    if not AUTHORITY_PATH.is_file():
        return None
    spec = importlib.util.spec_from_file_location("publication_authority", AUTHORITY_PATH)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def anonymous_ruleset() -> dict[str, object]:
    return {
        "id": 22036297,
        "node_id": "RRS_lADOExample",
        "name": "master-prs",
        "target": "branch",
        "source_type": "Repository",
        "source": "sangrep/docs",
        "enforcement": "active",
        "created_at": "2026-09-01T00:00:00Z",
        "updated_at": "2026-09-01T00:00:00Z",
        "_links": {
            "self": {"href": "https://api.github.com/repos/sangrep/docs/rulesets/22036297"},
            "html": {"href": "https://github.com/sangrep/docs/rules/22036297"},
        },
        "conditions": {
            "ref_name": {
                "exclude": [],
                "include": ["~DEFAULT_BRANCH"],
            }
        },
        "rules": [
            {"type": "deletion"},
            {"type": "non_fast_forward"},
            {
                "type": "pull_request",
                "parameters": {
                    "allowed_merge_methods": ["squash"],
                    "required_approving_review_count": 0,
                    "dismiss_stale_reviews_on_push": False,
                    "required_reviewers": [],
                    "require_code_owner_review": False,
                    "dismissal_restriction": {"enabled": False, "allowed_actors": []},
                    "require_last_push_approval": False,
                    "required_review_thread_resolution": True,
                    "require_extra_approval_for_unattributed_changes": True,
                },
            },
            {
                "type": "required_status_checks",
                "parameters": {
                    "strict_required_status_checks_policy": True,
                    "do_not_enforce_on_create": False,
                    "required_status_checks": [
                        {"context": "check", "integration_id": 15368}
                    ],
                },
            },
        ],
    }


class AnonymousRepositoryAuthorityTests(unittest.TestCase):
    def test_accepts_observed_public_shape_with_authenticated_merge_fields_omitted(self) -> None:
        authority = load_authority_module()
        self.assertIsNotNone(authority, "publication authority module must exist")
        repository = {
            "full_name": "sangrep/docs",
            "private": False,
            "visibility": "public",
            "default_branch": "master",
            "has_pages": False,
            "has_discussions": False,
            "allow_forking": True,
        }

        authority.validate_anonymous_repository(
            repository,
            expected_repository="sangrep/docs",
            expected_default_branch="master",
        )

    def test_rejects_wrong_merge_policy_when_anonymous_api_exposes_it(self) -> None:
        authority = load_authority_module()
        self.assertIsNotNone(authority, "publication authority module must exist")
        repository = {
            "full_name": "sangrep/docs",
            "private": False,
            "visibility": "public",
            "default_branch": "master",
            "has_pages": False,
            "has_discussions": False,
            "allow_squash_merge": True,
            "allow_merge_commit": True,
            "allow_rebase_merge": False,
        }

        with self.assertRaisesRegex(
            authority.PublicationAuthorityError,
            "anonymous-repository-merge-authority",
        ):
            authority.validate_anonymous_repository(
                repository,
                expected_repository="sangrep/docs",
                expected_default_branch="master",
            )


class AnonymousRulesetAuthorityTests(unittest.TestCase):
    def test_accepts_observed_public_shape_with_authenticated_bypass_actors_omitted(self) -> None:
        authority = load_authority_module()
        self.assertIsNotNone(authority, "publication authority module must exist")
        self.assertTrue(
            hasattr(authority, "validate_anonymous_ruleset"),
            "publication authority must validate the anonymous ruleset shape",
        )

        authority.validate_anonymous_ruleset(
            anonymous_ruleset(),
            expected_ruleset_id=22036297,
            expected_ruleset_name="master-prs",
            expected_required_check="check",
            expected_required_integration_id=15368,
        )

    def test_rejects_nonempty_bypass_actors_when_anonymous_api_exposes_them(self) -> None:
        authority = load_authority_module()
        self.assertIsNotNone(authority, "publication authority module must exist")
        self.assertTrue(
            hasattr(authority, "validate_anonymous_ruleset"),
            "publication authority must validate the anonymous ruleset shape",
        )
        ruleset = anonymous_ruleset()
        ruleset["bypass_actors"] = [{"actor_type": "RepositoryRole", "actor_id": 5}]

        with self.assertRaisesRegex(
            authority.PublicationAuthorityError,
            "anonymous-ruleset-bypass-authority",
        ):
            authority.validate_anonymous_ruleset(
                ruleset,
                expected_ruleset_id=22036297,
                expected_ruleset_name="master-prs",
                expected_required_check="check",
                expected_required_integration_id=15368,
            )

    def test_rejects_duplicate_rules_in_anonymous_ruleset(self) -> None:
        authority = load_authority_module()
        self.assertIsNotNone(authority, "publication authority module must exist")
        ruleset = anonymous_ruleset()
        ruleset["rules"] = [*ruleset["rules"], {"type": "deletion"}]

        with self.assertRaisesRegex(
            authority.PublicationAuthorityError,
            "anonymous-ruleset-authority",
        ):
            authority.validate_anonymous_ruleset(
                ruleset,
                expected_ruleset_id=22036297,
                expected_ruleset_name="master-prs",
                expected_required_check="check",
                expected_required_integration_id=15368,
            )

    def test_rejects_required_check_bound_to_wrong_integration(self) -> None:
        authority = load_authority_module()
        self.assertIsNotNone(authority, "publication authority module must exist")
        ruleset = anonymous_ruleset()
        ruleset["rules"][3]["parameters"]["required_status_checks"][0][
            "integration_id"
        ] = 15369

        try:
            with self.assertRaisesRegex(
                authority.PublicationAuthorityError,
                "anonymous-ruleset-authority",
            ):
                authority.validate_anonymous_ruleset(
                    ruleset,
                    expected_ruleset_id=22036297,
                    expected_ruleset_name="master-prs",
                    expected_required_check="check",
                    expected_required_integration_id=15368,
                )
        except TypeError:
            self.fail("ruleset validator must bind the required check to its integration")


if __name__ == "__main__":
    unittest.main()
