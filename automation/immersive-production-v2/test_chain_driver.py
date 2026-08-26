from __future__ import annotations

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("chain_driver.py")
SPEC = importlib.util.spec_from_file_location("immersive_chain_driver", MODULE_PATH)
assert SPEC and SPEC.loader
DRIVER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = DRIVER
SPEC.loader.exec_module(DRIVER)


VALID_QUEUE = """# Queue

## PR 1 — Proposal

- [x] `IP-01A` **First** — Recorded.
  - **Depends on:** none
  - **Acceptance:** Exists.

## PR 2 — Determinism

- [ ] `IP-02A` **Second** — Implement it.
  - **Depends on:** IP-01A
  - **Acceptance:** Green.

- [ ] `IP-02B` **Third** — Prove it.
  - **Depends on:** IP-02A
  - **Acceptance:** Measured.

## Manual release gates

Not parsed as task content.
"""


class QueueTests(unittest.TestCase):
    def write_queue(self, content: str) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "QUEUE.md"
        path.write_text(content, encoding="utf-8")
        return path

    def test_parse_queue_preserves_pr_task_and_details(self) -> None:
        tasks = DRIVER.parse_queue(self.write_queue(VALID_QUEUE))
        DRIVER.validate_queue(tasks)
        self.assertEqual([task.task_id for task in tasks], ["IP-01A", "IP-02A", "IP-02B"])
        self.assertTrue(tasks[0].checked)
        self.assertEqual(tasks[1].pr, 2)
        self.assertEqual(tasks[1].dependencies, ("IP-01A",))
        self.assertIn("Acceptance", tasks[1].details)
        self.assertNotIn("Manual release gates", tasks[-1].details)

    def test_first_open_task_respects_pr_boundary(self) -> None:
        tasks = DRIVER.parse_queue(self.write_queue(VALID_QUEUE))
        self.assertIsNone(DRIVER.first_open_task(tasks, 1))
        self.assertEqual(DRIVER.first_open_task(tasks, 2).task_id, "IP-02A")

    def test_blocked_dependency_stops_instead_of_skipping(self) -> None:
        queue = VALID_QUEUE.replace("- [x] `IP-01A`", "- [ ] `IP-01A`")
        tasks = DRIVER.parse_queue(self.write_queue(queue))
        with self.assertRaisesRegex(DRIVER.ChainError, "blocked by unchecked dependencies"):
            DRIVER.first_open_task(tasks, 2)

    def test_dependency_must_exist_earlier(self) -> None:
        queue = VALID_QUEUE.replace("IP-01A\n  - **Acceptance:** Green", "IP-99Z\n  - **Acceptance:** Green")
        tasks = DRIVER.parse_queue(self.write_queue(queue))
        with self.assertRaisesRegex(DRIVER.ChainError, "missing or appears later"):
            DRIVER.validate_queue(tasks)

    def test_checked_task_cannot_depend_on_unchecked_task(self) -> None:
        queue = VALID_QUEUE.replace("- [ ] `IP-02B`", "- [x] `IP-02B`")
        tasks = DRIVER.parse_queue(self.write_queue(queue))
        with self.assertRaisesRegex(DRIVER.ChainError, "checked task depends on unchecked IP-02A"):
            DRIVER.validate_queue(tasks)

    def test_noncontiguous_pr_group_repetition_is_invalid(self) -> None:
        queue = VALID_QUEUE + """
## PR 1 — Repeated

- [ ] `IP-01Z` **Repeated group** — Invalid.
  - **Depends on:** none
  - **Acceptance:** Never runs.
"""
        tasks = DRIVER.parse_queue(self.write_queue(queue))
        with self.assertRaisesRegex(DRIVER.ChainError, "cannot repeat noncontiguously"):
            DRIVER.validate_queue(tasks)

    def test_missing_dependency_metadata_is_invalid(self) -> None:
        queue = VALID_QUEUE.replace("  - **Depends on:** IP-02A\n", "", 1)
        with self.assertRaisesRegex(DRIVER.ChainError, "missing '\*\*Depends on"):
            DRIVER.parse_queue(self.write_queue(queue))

    def test_queue_completion_accepts_only_exact_task_transition(self) -> None:
        before = VALID_QUEUE.encode("utf-8")
        expected = DRIVER.checked_queue_blob(before, "IP-02A")
        self.assertIsNotNone(expected)
        self.assertIn(b"- [x] `IP-02A`", expected)
        self.assertIn(b"- [ ] `IP-02B`", expected)
        self.assertIsNone(DRIVER.checked_queue_blob(before, "IP-NOT-THERE"))
        self.assertTrue(DRIVER.queue_task_completed(before, expected, "IP-02A"))
        self.assertFalse(DRIVER.queue_task_completed(before, before, "IP-02A"))
        with self.assertRaisesRegex(DRIVER.ChainError, "queue changed beyond"):
            DRIVER.queue_task_completed(
                before,
                expected.replace(b"Measured.", b"Rewritten."),
                "IP-02A",
            )
        with self.assertRaisesRegex(DRIVER.ChainError, "queue changed beyond"):
            DRIVER.queue_task_completed(before, expected.rstrip(b"\n"), "IP-02A")
        with self.assertRaisesRegex(DRIVER.ChainError, "queue changed beyond"):
            DRIVER.queue_task_completed(before, b"\n" + expected, "IP-02A")
        with self.assertRaisesRegex(DRIVER.ChainError, "queue changed beyond"):
            DRIVER.queue_task_completed(before, expected.replace(b"\n", b"\r\n"), "IP-02A")

    def test_empty_reply_detection(self) -> None:
        self.assertTrue(DRIVER.response_is_empty(DRIVER.AgentResult(0, "", "")))
        self.assertTrue(
            DRIVER.response_is_empty(
                DRIVER.AgentResult(0, "No reply: the model returned empty content after retries", "")
            )
        )
        self.assertFalse(DRIVER.response_is_empty(DRIVER.AgentResult(0, "Committed abc123", "")))

    def test_prompt_enforces_one_task_and_push(self) -> None:
        task = DRIVER.parse_queue(self.write_queue(VALID_QUEUE))[1]
        prompt = DRIVER.build_prompt(task, "feat/immersive-02")
        self.assertIn("Implement exactly IP-02A", prompt)
        self.assertIn("git push -u origin HEAD", prompt)
        self.assertIn("UNAVAILABLE, never PASS", prompt)
        self.assertNotIn("IP-02B`, **Third**", prompt)

    def test_fresh_agent_command_is_rules_isolated_and_non_resumed(self) -> None:
        command = DRIVER.build_agent_command(
            Path("/tmp/prompt.md"),
            timeout=300,
            max_turns=42,
            provider="provider-test",
            model="model-test",
        )
        self.assertIn("--ignore-rules", command)
        self.assertIn("--query-file", command)
        self.assertIn("--provider", command)
        self.assertIn("provider-test", command)
        self.assertIn("--model", command)
        self.assertIn("model-test", command)
        self.assertNotIn("--resume", command)
        self.assertNotIn("--continue", command)
        self.assertEqual(command[0:2], ["hermes", "chat"])

    def test_ancestry_and_linked_worktree_git_path(self) -> None:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        repo = root / "repo"
        linked = root / "linked"
        repo.mkdir()

        def git(cwd: Path, *args: str) -> str:
            result = subprocess.run(
                ["git", *args],
                cwd=cwd,
                text=True,
                capture_output=True,
                check=True,
            )
            return result.stdout.strip()

        git(repo, "init", "-b", "main")
        git(repo, "config", "user.name", "Test")
        git(repo, "config", "user.email", "test@example.invalid")
        queue_bytes = "\n- [ ] `IP-TEST` **Task** — Exact.  \n\n".encode("utf-8")
        repo.joinpath("state.txt").write_text("a\n", encoding="utf-8")
        repo.joinpath("queue.md").write_bytes(queue_bytes)
        git(repo, "add", "state.txt", "queue.md")
        git(repo, "commit", "-m", "a")
        commit_a = git(repo, "rev-parse", "HEAD")
        self.assertEqual(DRIVER.git_blob(commit_a, "queue.md", repo), queue_bytes)

        repo.joinpath("state.txt").write_text("b\n", encoding="utf-8")
        git(repo, "add", "state.txt")
        git(repo, "commit", "-m", "b")
        commit_b = git(repo, "rev-parse", "HEAD")
        self.assertTrue(DRIVER.commit_is_ancestor(commit_a, commit_b, repo))

        git(repo, "switch", "-c", "side", commit_a)
        repo.joinpath("side.txt").write_text("side\n", encoding="utf-8")
        git(repo, "add", "side.txt")
        git(repo, "commit", "-m", "side")
        commit_side = git(repo, "rev-parse", "HEAD")
        self.assertFalse(DRIVER.commit_is_ancestor(commit_b, commit_side, repo))

        git(repo, "worktree", "add", "-b", "linked-test", str(linked), commit_b)
        self.assertTrue(linked.joinpath(".git").is_file())
        internal = DRIVER.git_internal_path("wdu-agent-chain", linked)
        self.assertIn("worktrees", internal.parts)
        self.assertNotEqual(internal, linked / ".git" / "wdu-agent-chain")
        self.assertTrue(internal.parent.is_dir())

    def test_repository_queue_and_coverage_contract(self) -> None:
        tasks = DRIVER.parse_queue(DRIVER.QUEUE_FILE)
        DRIVER.validate_queue(tasks)
        self.assertEqual(len(tasks), 35)
        self.assertEqual(sum(task.checked for task in tasks), 28)
        self.assertEqual(sorted({task.pr for task in tasks}), list(range(1, 15)))
        self.assertEqual(tasks[0].task_id, "IP-01A")
        self.assertEqual(tasks[-1].task_id, "IP-11D")

        readme = DRIVER.SCRIPT_DIR.joinpath("README.md").read_text(encoding="utf-8")
        queue = DRIVER.QUEUE_FILE.read_text(encoding="utf-8")
        queue_flat = " ".join(queue.split())
        for contract in (
            "**1.10 = Tier 0 only.** Cut it only after PR 4 is merged and every T0.1–T0.3 acceptance gate is evidenced.",
            "**1.11 = Tier 1 only.** Cut it only after PR 7 is merged and every T1.1–T1.4 acceptance gate is evidenced.",
            "**1.12 = Tier 2 only.** Cut it only after PR 12 is merged and every T2.1–T2.4 acceptance gate is evidenced.",
            "**2.0 = Tier 3 plus closure.** Do not call any branch, tag, or changelog section “2.0” before PRs 13–14 are merged and `IP-11D` passes every definition-of-done line with linked fixture evidence.",
        ):
            self.assertIn(contract, queue_flat)
        self.assertIn(
            "Every 1.10/1.11/1.12/2.0 release must resolve to a real tag",
            queue_flat,
        )
        self.assertIn(
            "its changelog section must name the fixtures that proved that version's capability",
            queue_flat,
        )
        self.assertIn(
            "| T4.3 version discipline | `1.10`/Tier 0, `1.11`/Tier 1, `1.12`/Tier 2, `2.0`/Tier 3 plus `IP-11D` closure |",
            readme,
        )
        for item in (
            "T0.1",
            "T0.2",
            "T0.3",
            "T1.1",
            "T1.2",
            "T1.3",
            "T1.4",
            "T2.1",
            "T2.2",
            "T2.3",
            "T2.4",
            "T3.1",
            "T3.2",
            "T3.3",
            "T4.1",
            "T4.2",
            "T4.3",
            "T4.4",
            "T4.5",
        ):
            self.assertIn(f"| {item} ", readme)


if __name__ == "__main__":
    unittest.main()
