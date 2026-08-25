#!/usr/bin/env python3
"""PR-scoped fresh-agent chain for the immersive production queue.

One unchecked queue item is handed to one brand-new ``hermes chat`` process.
The process receives no resumed session and coordinates only through QUEUE.md
and committed repository state.
"""

from __future__ import annotations

import argparse
import dataclasses
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Sequence

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
QUEUE_FILE = SCRIPT_DIR / "QUEUE.md"
TODO_FILE = REPO_ROOT / "TODO.md"

PR_RE = re.compile(r"^## PR\s+(\d+)\s+—\s+(.+?)\s*$")
TASK_RE = re.compile(
    r"^- \[([ xX])\] `([A-Z0-9-]+)` \*\*(.+?)\*\* — (.+?)\s*$"
)
DEPENDS_RE = re.compile(r"^\s+- \*\*Depends on:\*\*\s*(.+?)\s*$", re.MULTILINE)
EMPTY_REPLY_MARKERS = (
    "no reply: the model returned empty content after retries",
    "model returned empty content after retries",
)
PROTECTED_BRANCHES = {"main", "master"}


class ChainError(RuntimeError):
    """A safety or verification gate failed."""


@dataclasses.dataclass(frozen=True)
class Task:
    pr: int
    pr_title: str
    task_id: str
    title: str
    summary: str
    details: str
    checked: bool
    dependencies: tuple[str, ...]
    line_number: int

    @property
    def block(self) -> str:
        status = "x" if self.checked else " "
        first = f"- [{status}] `{self.task_id}` **{self.title}** — {self.summary}"
        return f"{first}\n{self.details}" if self.details else first


@dataclasses.dataclass(frozen=True)
class AgentResult:
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool = False

    @property
    def combined(self) -> str:
        return "\n".join(part for part in (self.stdout, self.stderr) if part)


class Logger:
    def __init__(self, log_file: Path | None = None) -> None:
        self.log_file = log_file

    def __call__(self, message: str) -> None:
        line = f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] {message}"
        print(line, flush=True)
        if self.log_file:
            self.log_file.parent.mkdir(parents=True, exist_ok=True)
            with self.log_file.open("a", encoding="utf-8") as handle:
                handle.write(f"{line}\n")


def parse_dependencies(details: str, task_id: str) -> tuple[str, ...]:
    match = DEPENDS_RE.search(details)
    if not match:
        raise ChainError(f"{task_id}: missing '**Depends on:**' metadata")
    value = match.group(1).strip()
    if value.lower() == "none":
        return ()
    return tuple(part.strip() for part in value.split(",") if part.strip())


def parse_queue(path: Path = QUEUE_FILE) -> list[Task]:
    lines = path.read_text(encoding="utf-8").splitlines()
    tasks: list[Task] = []
    current_pr: int | None = None
    current_pr_title = ""
    pending: tuple[int, re.Match[str], int, str] | None = None

    def finish(end_index: int) -> None:
        nonlocal pending
        if pending is None:
            return
        start_index, match, pr, pr_title = pending
        details = "\n".join(lines[start_index + 1 : end_index]).rstrip()
        task_id = match.group(2)
        tasks.append(
            Task(
                pr=pr,
                pr_title=pr_title,
                task_id=task_id,
                title=match.group(3).strip(),
                summary=match.group(4).strip(),
                details=details,
                checked=match.group(1).lower() == "x",
                dependencies=parse_dependencies(details, task_id),
                line_number=start_index + 1,
            )
        )
        pending = None

    for index, line in enumerate(lines):
        pr_match = PR_RE.match(line)
        if pr_match:
            finish(index)
            current_pr = int(pr_match.group(1))
            current_pr_title = pr_match.group(2).strip()
            continue
        if line.startswith("## "):
            finish(index)
            current_pr = None
            current_pr_title = ""
            continue

        task_match = TASK_RE.match(line)
        if task_match:
            finish(index)
            if current_pr is None:
                raise ChainError(f"line {index + 1}: task appears before a PR heading")
            pending = (index, task_match, current_pr, current_pr_title)

    finish(len(lines))
    if not tasks:
        raise ChainError(f"no tasks found in {path}")
    return tasks


def validate_queue(tasks: Sequence[Task]) -> None:
    seen: dict[str, Task] = {}
    pr_numbers: list[int] = []
    for task in tasks:
        if task.task_id in seen:
            raise ChainError(
                f"duplicate task id {task.task_id} on lines "
                f"{seen[task.task_id].line_number} and {task.line_number}"
            )
        seen[task.task_id] = task
        if not pr_numbers or pr_numbers[-1] != task.pr:
            pr_numbers.append(task.pr)
        for dependency in task.dependencies:
            if dependency not in seen:
                raise ChainError(
                    f"{task.task_id}: dependency {dependency} is missing or appears later"
                )
            if task.checked and not seen[dependency].checked:
                raise ChainError(
                    f"{task.task_id}: checked task depends on unchecked {dependency}"
                )

    if len(set(pr_numbers)) != len(pr_numbers):
        raise ChainError(f"PR groups cannot repeat noncontiguously; found {pr_numbers}")
    expected = list(range(min(pr_numbers), max(pr_numbers) + 1))
    if pr_numbers != expected:
        raise ChainError(f"PR groups must be contiguous and ordered; found {pr_numbers}")


def task_by_id(tasks: Sequence[Task], task_id: str) -> Task:
    for task in tasks:
        if task.task_id == task_id:
            return task
    raise ChainError(f"unknown task id {task_id}")


def first_open_task(tasks: Sequence[Task], pr: int) -> Task | None:
    by_id = {task.task_id: task for task in tasks}
    for task in tasks:
        if task.pr != pr or task.checked:
            continue
        blocked = [dependency for dependency in task.dependencies if not by_id[dependency].checked]
        if blocked:
            raise ChainError(
                f"{task.task_id} is blocked by unchecked dependencies: {', '.join(blocked)}"
            )
        return task
    return None


def checked_queue_blob(content: bytes, task_id: str) -> bytes | None:
    task = re.escape(task_id.encode("ascii"))
    pattern = re.compile(rb"(?m)^(- \[) (\] `" + task + rb"` )")
    updated, count = pattern.subn(rb"\1x\2", content, count=1)
    return updated if count == 1 else None


def queue_task_completed(before: bytes, after: bytes, task_id: str) -> bool:
    expected = checked_queue_blob(before, task_id)
    if expected is None:
        raise ChainError(f"{task_id}: open marker was missing before the task commit")
    if after == expected:
        return True
    if after == before:
        return False
    raise ChainError(f"{task_id}: queue changed beyond its own checkbox; refusing to continue")


def run(command: Sequence[str], cwd: Path = REPO_ROOT, timeout: int = 120) -> str:
    result = subprocess.run(
        list(command),
        cwd=str(cwd),
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise ChainError(f"command failed ({' '.join(command)}): {detail}")
    return result.stdout.strip()


def git(*args: str, timeout: int = 120) -> str:
    return run(("git", *args), timeout=timeout)


def current_branch() -> str:
    return git("branch", "--show-current")


def current_head() -> str:
    return git("rev-parse", "HEAD")


def clean_worktree() -> bool:
    return git("status", "--porcelain") == ""


def remote_head(branch: str) -> str | None:
    output = git("ls-remote", "--heads", "origin", f"refs/heads/{branch}")
    if not output:
        return None
    return output.split()[0]


def changed_commit_count(before: str, after: str) -> int:
    return int(git("rev-list", "--count", f"{before}..{after}"))


def commit_is_ancestor(ancestor: str, descendant: str, cwd: Path = REPO_ROOT) -> bool:
    result = subprocess.run(
        ["git", "merge-base", "--is-ancestor", ancestor, descendant],
        cwd=str(cwd),
        text=True,
        capture_output=True,
        timeout=120,
    )
    if result.returncode == 0:
        return True
    if result.returncode == 1:
        return False
    detail = (result.stderr or result.stdout).strip()
    raise ChainError(f"could not verify commit ancestry: {detail or result.returncode}")


def git_internal_path(relative: str, cwd: Path = REPO_ROOT) -> Path:
    raw = run(("git", "rev-parse", "--git-path", relative), cwd=cwd)
    path = Path(raw)
    return path if path.is_absolute() else cwd / path


def git_blob(commit: str, relative: str, cwd: Path = REPO_ROOT) -> bytes:
    result = subprocess.run(
        ["git", "show", f"{commit}:{relative}"],
        cwd=str(cwd),
        capture_output=True,
        timeout=120,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).decode("utf-8", errors="replace").strip()
        raise ChainError(f"could not read {relative} at {commit}: {detail}")
    return result.stdout


def build_prompt(task: Task, branch: str) -> str:
    return f"""You are a fresh implementation agent with no inherited chat context.
Work alone in this repository: {REPO_ROOT}
Current implementation branch: {branch}

READ FIRST, fully:
1. {TODO_FILE}
2. {QUEUE_FILE}
3. {SCRIPT_DIR / 'README.md'}
4. {REPO_ROOT / 'docs/adr/ADR-011-immersive-production-distribution.md'}
5. {REPO_ROOT / 'website-design-ultra/README.md'}
6. Every path named under 'Read first' in your task block.

YOUR ONE TASK — PR {task.pr}, {task.task_id}
{task.block}

NON-NEGOTIABLE SCOPE:
- Implement exactly {task.task_id}. Do not start, partially implement, or mark any later item.
- Treat TODO.md as the product authority and this task block as the bounded execution unit.
- Inspect current code before editing. If the task is already complete, prove it with the
  task's verification commands; then change only the queue state and commit that correction.
- Keep starters, lab, immersive implementation fixtures, and automation outside the installed
  website-design-ultra/ plugin tree, per ADR-011.
- Preserve progressive disclosure and negative gates. Ordinary 2D and ordinary 3D-hero cases
  must not start loading advanced immersive modules.
- Do not add paid design-tool dependencies, committed credentials, placeholder marketing copy,
  a generic VDB exporter, an npm package for copied references, or an 'apply all effects' path.
- PASS requires evidence. Browser/GPU/tool unavailability is UNAVAILABLE, never PASS, and a
  required unavailable acceptance test means the task stays unchecked.
- Run every verification command in the task block plus all directly affected existing gates.
  Fix failures caused by your change; do not weaken tests to make them green.
- Keep the working tree clean except for this task. Use selective git add, never git add -A.

COMPLETION PROTOCOL:
1. Re-run the task's acceptance checks and inspect git diff.
2. Only if every required acceptance check passes, change the QUEUE.md line for
   {task.task_id} from unchecked to checked; do not alter its text.
3. If a required gate FAILS or is UNAVAILABLE, leave the item unchecked. You may
   commit and push useful bounded partial work, but the driver will stop for review.
4. Create at most one meaningful commit for the task.
5. Push it with `git push -u origin HEAD`. A completed task is incomplete without a verified push.
6. Leave a clean worktree on the same branch.

Final response: 3-6 concise sentences naming deliverables, exact checks and results,
commit hash, pushed branch, and any honest UNAVAILABLE gate. Do not return an empty reply.
"""


def response_is_empty(result: AgentResult) -> bool:
    combined = result.combined.strip()
    if not combined:
        return True
    lowered = combined.lower()
    return any(marker in lowered for marker in EMPTY_REPLY_MARKERS)


def build_agent_command(
    prompt_path: Path,
    timeout: int,
    max_turns: int,
    provider: str | None,
    model: str | None,
) -> list[str]:
    command = [
        "hermes",
        "chat",
        "--query-file",
        str(prompt_path),
        "--in",
        str(REPO_ROOT),
        "-Q",
        "--yolo",
        "--ignore-rules",
        "--max-turns",
        str(max_turns),
        "--run-budget",
        str(max(60, timeout - 30)),
        "--source",
        "automation",
    ]
    if provider:
        command.extend(("--provider", provider))
    if model:
        command.extend(("--model", model))
    return command


def execute_agent(
    task: Task,
    branch: str,
    timeout: int,
    max_turns: int,
    provider: str | None,
    model: str | None,
    log_dir: Path,
    attempt: int,
) -> AgentResult:
    log_dir.mkdir(parents=True, exist_ok=True)
    prompt = build_prompt(task, branch)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        suffix=".md",
        prefix=f"{task.task_id.lower()}-",
        dir=log_dir,
        delete=False,
    ) as handle:
        handle.write(prompt)
        prompt_path = Path(handle.name)

    command = build_agent_command(prompt_path, timeout, max_turns, provider, model)

    try:
        result = subprocess.run(
            command,
            cwd=str(REPO_ROOT),
            text=True,
            capture_output=True,
            timeout=timeout,
        )
        agent_result = AgentResult(result.returncode, result.stdout or "", result.stderr or "")
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout.decode() if isinstance(error.stdout, bytes) else (error.stdout or "")
        stderr = error.stderr.decode() if isinstance(error.stderr, bytes) else (error.stderr or "")
        agent_result = AgentResult(124, stdout, stderr, timed_out=True)
    finally:
        prompt_path.unlink(missing_ok=True)

    (log_dir / f"{task.task_id}-attempt-{attempt}.stdout.log").write_text(
        agent_result.stdout, encoding="utf-8"
    )
    (log_dir / f"{task.task_id}-attempt-{attempt}.stderr.log").write_text(
        agent_result.stderr, encoding="utf-8"
    )
    return agent_result


def verify_agent_commit(
    task: Task,
    before: str,
    branch: str,
) -> str:
    if current_branch() != branch:
        raise ChainError(f"agent changed branch from {branch} to {current_branch()}")
    if not clean_worktree():
        raise ChainError("agent left a dirty worktree; refusing to continue")

    after = current_head()
    if after == before:
        raise ChainError("agent exited successfully but created no commit")
    if not commit_is_ancestor(before, after):
        raise ChainError("agent rewrote task history; previous HEAD is not an ancestor")
    count = changed_commit_count(before, after)
    if count != 1:
        raise ChainError(f"expected exactly one task commit, found {count}")

    queue_relative = str(QUEUE_FILE.relative_to(REPO_ROOT))
    before_queue = git_blob(before, queue_relative)
    after_queue = git_blob(after, queue_relative)
    completed = queue_task_completed(before_queue, after_queue, task.task_id)

    remote = remote_head(branch)
    if remote != after:
        raise ChainError(
            f"push verification failed: local {after}, remote {remote or 'missing'}"
        )

    if not completed:
        raise ChainError(
            f"{task.task_id}: task remains unchecked; partial/UNAVAILABLE work is preserved "
            "but the chain stops for review"
        )
    return after


def preflight(expected_branch: str | None) -> str:
    if git("rev-parse", "--is-inside-work-tree") != "true":
        raise ChainError(f"{REPO_ROOT} is not a git worktree")
    branch = current_branch()
    if not branch:
        raise ChainError("detached HEAD is not allowed")
    if branch in PROTECTED_BRANCHES:
        raise ChainError(f"refusing to run agents directly on protected branch {branch}")
    if expected_branch and branch != expected_branch:
        raise ChainError(f"expected branch {expected_branch}, found {branch}")
    if not clean_worktree():
        raise ChainError("worktree is not clean; commit/stash changes before starting the chain")
    remote = remote_head(branch)
    head = current_head()
    if remote is not None and remote != head:
        raise ChainError(
            f"remote branch is not synchronized before the run: local {head}, remote {remote}"
        )
    return branch


def display_tasks(tasks: Iterable[Task]) -> None:
    for task in tasks:
        status = "x" if task.checked else " "
        dependencies = ",".join(task.dependencies) or "none"
        print(
            f"PR {task.pr:>2} [{status}] {task.task_id:<7} "
            f"depends={dependencies:<10} {task.title}"
        )


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr", type=int, help="run/list only this PR group")
    parser.add_argument("--rounds", type=int, default=1, help="fresh agents to run (default: 1)")
    parser.add_argument("--timeout", type=int, default=3600, help="seconds per agent")
    parser.add_argument("--max-turns", type=int, default=500)
    parser.add_argument("--provider", help="pin a configured Hermes provider")
    parser.add_argument("--model", help="pin a model for every fresh chat")
    parser.add_argument("--expected-branch", help="require this exact implementation branch")
    parser.add_argument("--dry-run", action="store_true", help="print next prompt, run nothing")
    parser.add_argument("--list", action="store_true", help="list queue status")
    parser.add_argument("--check", action="store_true", help="validate queue structure")
    parser.add_argument(
        "--empty-retries",
        type=int,
        default=1,
        help="retry empty/no-reply runs only when repository state did not change",
    )
    parser.add_argument("--empty-retry-delay", type=int, default=120)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_argument_parser().parse_args(argv)
    try:
        if args.rounds < 1 or args.timeout < 60 or args.max_turns < 1:
            raise ChainError("rounds/max-turns must be positive and timeout must be at least 60")
        if args.empty_retries < 0 or args.empty_retry_delay < 0:
            raise ChainError("empty retry values cannot be negative")

        tasks = parse_queue()
        validate_queue(tasks)

        if args.check:
            checked = sum(task.checked for task in tasks)
            print(f"QUEUE_OK tasks={len(tasks)} checked={checked} open={len(tasks) - checked}")
            if not args.list and not args.dry_run:
                return 0

        selected = [task for task in tasks if args.pr is None or task.pr == args.pr]
        if args.list:
            display_tasks(selected)
            if not args.dry_run:
                return 0

        if args.pr is None:
            raise ChainError("--pr N is required for dry-run or execution; combined runs are forbidden")
        if not selected:
            raise ChainError(f"PR {args.pr} does not exist in the queue")

        next_task = first_open_task(tasks, args.pr)
        if args.dry_run:
            if not next_task:
                print(f"PR {args.pr}: QUEUE_EMPTY")
                return 0
            branch = args.expected_branch or current_branch() or "<implementation-branch>"
            print(
                f"DRY_RUN PR={args.pr} task={next_task.task_id} line={next_task.line_number}\n"
            )
            print(build_prompt(next_task, branch))
            return 0

        branch = preflight(args.expected_branch)
        run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        log_dir = git_internal_path("wdu-agent-chain") / run_id
        logger = Logger(log_dir / "chain.log")
        logger(f"chain start branch={branch} pr={args.pr} rounds={args.rounds}")

        for round_number in range(1, args.rounds + 1):
            tasks = parse_queue()
            validate_queue(tasks)
            task = first_open_task(tasks, args.pr)
            if not task:
                logger(f"PR {args.pr}: QUEUE_EMPTY — stop at PR boundary")
                break

            before = current_head()
            logger(
                f"round={round_number}/{args.rounds} task={task.task_id} "
                f"before={before[:12]}"
            )

            result: AgentResult | None = None
            for attempt in range(1, args.empty_retries + 2):
                result = execute_agent(
                    task=task,
                    branch=branch,
                    timeout=args.timeout,
                    max_turns=args.max_turns,
                    provider=args.provider,
                    model=args.model,
                    log_dir=log_dir,
                    attempt=attempt,
                )
                logger(
                    f"task={task.task_id} attempt={attempt} exit={result.returncode} "
                    f"stdout={len(result.stdout)}B stderr={len(result.stderr)}B"
                )
                if result.returncode != 0:
                    detail = result.combined.strip()[-1200:]
                    raise ChainError(
                        f"{task.task_id}: agent failed with exit {result.returncode}: {detail}"
                    )
                if not response_is_empty(result):
                    break

                if current_head() != before or not clean_worktree():
                    raise ChainError(
                        f"{task.task_id}: empty reply after repository mutation; stop for inspection"
                    )
                if attempt > args.empty_retries:
                    raise ChainError(f"{task.task_id}: empty reply after all retries")
                logger(
                    f"{task.task_id}: empty/no-reply result; retrying fresh in "
                    f"{args.empty_retry_delay}s"
                )
                time.sleep(args.empty_retry_delay)

            assert result is not None
            after = verify_agent_commit(
                task=task,
                before=before,
                branch=branch,
            )
            stat = git("show", "--stat", "--oneline", "--summary", after)
            logger(f"task={task.task_id} verified head={after[:12]}\n{stat}")

        logger("chain finished")
        return 0
    except (ChainError, OSError, subprocess.SubprocessError) as error:
        print(f"CHAIN_STOP: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
