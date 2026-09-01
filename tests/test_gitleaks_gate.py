from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


def run(arguments: list[str], *, cwd: Path, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        arguments,
        cwd=cwd,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


class LocalGitleaksGateTests(unittest.TestCase):
    def make_repository(self, root: Path, *, include_secret: bool) -> tuple[Path, Path]:
        repository = root / "repository"
        scripts = repository / "scripts"
        scripts.mkdir(parents=True)
        shutil.copy2(REPOSITORY_ROOT / "scripts/check-gitleaks", scripts / "check-gitleaks")
        shutil.copy2(
            REPOSITORY_ROOT / "scripts/public_boundary_policy.py",
            scripts / "public_boundary_policy.py",
        )

        scanner = root / "fake-gitleaks"
        scanner.write_text(
            textwrap.dedent(
                """\
                #!/usr/bin/env python3
                import subprocess
                import sys
                from pathlib import Path

                arguments = sys.argv[1:]
                if arguments == ["version"]:
                    print("8.30.1")
                    raise SystemExit(0)

                marker = "gh" + "p_" + ("A" * 24)
                content = ""
                if arguments and arguments[0] == "git":
                    log_options = next(
                        (value.removeprefix("--log-opts=") for value in arguments if value.startswith("--log-opts=")),
                        None,
                    )
                    if log_options == "HEAD":
                        content = subprocess.run(
                            ["git", "log", "-p", "--format=", "--binary", "HEAD"],
                            check=True,
                            capture_output=True,
                            text=True,
                        ).stdout
                    elif "--staged" in arguments:
                        content = subprocess.run(
                            ["git", "diff", "--cached"],
                            check=True,
                            capture_output=True,
                            text=True,
                        ).stdout
                elif arguments and arguments[0] == "dir":
                    candidate = Path(arguments[-1])
                    if candidate.is_file():
                        content = candidate.read_text(encoding="utf-8", errors="ignore")
                raise SystemExit(1 if marker in content else 0)
                """
            ),
            encoding="utf-8",
        )
        scanner.chmod(scanner.stat().st_mode | stat.S_IXUSR)

        self.assertEqual(run(["git", "init", "-q"], cwd=repository).returncode, 0)
        self.assertEqual(run(["git", "config", "user.name", "Test"], cwd=repository).returncode, 0)
        self.assertEqual(
            run(["git", "config", "user.email", "test@example.invalid"], cwd=repository).returncode,
            0,
        )
        fixture = "public fixture\n"
        if include_secret:
            fixture += "gh" + "p_" + ("A" * 24) + "\n"
        (repository / "fixture.txt").write_text(fixture, encoding="utf-8")
        self.assertEqual(run(["git", "add", "."], cwd=repository).returncode, 0)
        self.assertEqual(run(["git", "commit", "-qm", "test fixture"], cwd=repository).returncode, 0)
        (repository / "safe-follow-up.txt").write_text("safe follow-up\n", encoding="utf-8")
        self.assertEqual(run(["git", "add", "."], cwd=repository).returncode, 0)
        self.assertEqual(run(["git", "commit", "-qm", "safe follow-up"], cwd=repository).returncode, 0)
        return repository, scanner

    def run_gate(self, repository: Path, scanner: Path) -> subprocess.CompletedProcess[str]:
        environment = os.environ.copy()
        for inherited_name in ("GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "GITHUB_EVENT_PATH"):
            environment.pop(inherited_name, None)
        environment.update(
            {
                "PYTHONDONTWRITEBYTECODE": "1",
                "PYTEST_CURRENT_TEST": "local-head-regression",
                "SANGREP_GITLEAKS_TEST_BIN": str(scanner),
                "SANGREP_GITLEAKS_TEST_MODE": "true",
            }
        )
        return run(["./scripts/check-gitleaks"], cwd=repository, env=environment)

    def test_clean_index_scans_secret_retained_from_head_parent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository, scanner = self.make_repository(Path(directory), include_secret=True)

            result = self.run_gate(repository, scanner)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("category=gitleaks-nonzero", result.stderr)

    def test_clean_committed_head_passes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repository, scanner = self.make_repository(Path(directory), include_secret=False)

            result = self.run_gate(repository, scanner)

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("secret-scan: passed", result.stdout)


if __name__ == "__main__":
    unittest.main()
