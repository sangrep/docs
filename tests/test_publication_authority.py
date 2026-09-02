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


if __name__ == "__main__":
    unittest.main()
