"""Deterministic installer tests only: no model/runtime calls, no application tests.

Run with Python 3.11+: test_install_agent_pack.py --pack <complete pack directory>.
"""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("installer", Path(__file__).with_name("install_agent_pack.py"))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
PACK = None
TEMP_ROOT = None


def snapshot(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="agent pack test ", dir=TEMP_ROOT)
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.pack = self.base / "source pack with spaces"
        shutil.copytree(PACK, self.pack, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        self.project = self.base / "project with spaces è"
        self.project.mkdir()

    def run_cli(self, *args):
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            code = installer.main(["--pack", str(self.pack), "--project", str(self.project), *args])
        return code, output.getvalue()

    def install(self):
        code, log = self.run_cli("--apply")
        self.assertEqual(code, 0, log)

    def test_preview_and_check_never_write(self):
        before = snapshot(self.project)
        self.assertEqual(self.run_cli()[0], 0)
        self.assertEqual(self.run_cli("--check")[0], 1)
        self.assertEqual(before, snapshot(self.project))

    def test_install_idempotent_and_equivalent(self):
        self.install()
        before = snapshot(self.project)
        self.install()
        self.assertEqual(before, snapshot(self.project))
        self.assertEqual(self.run_cli("--check")[0], 0)
        self.assertEqual(snapshot(self.project / ".agents/skills"), snapshot(self.project / ".claude/skills"))

    def test_owned_update(self):
        self.install()
        source = self.pack / "Agents/ReviewerAgent_General.md"
        source.write_text(source.read_text(encoding="utf-8") + "\nNota di prova.\n", encoding="utf-8")
        self.assertEqual(self.run_cli("--check")[0], 1)
        self.install()
        body = (self.project / ".claude/agents/reviewer.md").read_text(encoding="utf-8")
        self.assertIn("Nota di prova.", body)
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_modified_owned_file_blocks_all_writes(self):
        self.install()
        file = self.project / ".claude/agents/reviewer.md"
        file.write_bytes(file.read_bytes() + b"\nUser customization\n")
        before = snapshot(self.project)
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(before, snapshot(self.project))

    def test_unowned_file_conflict(self):
        file = self.project / ".claude/agents/reviewer.md"
        file.parent.mkdir(parents=True)
        file.write_text("Custom file", encoding="utf-8")
        before = snapshot(self.project)
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(before, snapshot(self.project))

    def test_identical_existing_file_not_adopted_for_updates(self):
        outputs = installer.prepare(self.pack, self.project, "project")
        path = self.project / ".claude/agents/reviewer.md"
        path.parent.mkdir(parents=True)
        path.write_bytes(outputs[".claude/agents/reviewer.md"])
        self.install()
        source = self.pack / "Agents/ReviewerAgent_General.md"
        source.write_bytes(source.read_bytes() + b"\nNew revision\n")
        before = snapshot(self.project)
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(before, snapshot(self.project))

    def test_project_instruction_customization_preserved(self):
        original = b"# Existing instructions\r\nPreserve this.\r\n"
        (self.project / "AGENTS.md").write_bytes(original)
        self.install()
        file = self.project / "AGENTS.md"
        self.assertTrue(file.read_bytes().startswith(original))
        file.write_bytes(file.read_bytes() + b"\nAnother user rule\n")
        before = file.read_bytes()
        self.install()
        self.assertEqual(before, file.read_bytes())
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_modified_section_blocks(self):
        self.install()
        file = self.project / "CLAUDE.md"
        file.write_bytes(file.read_bytes().replace(b"coordina", b"CUSTOM"))
        before = snapshot(self.project)
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(before, snapshot(self.project))

    def test_duplicate_role_descriptor(self):
        file = self.pack / "pack.json"
        data = json.loads(file.read_text())
        data["phases"]["project"].append(data["phases"]["project"][0])
        file.write_text(json.dumps(data))
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(snapshot(self.project), {})

    def test_duplicate_runtime_agent(self):
        file = self.project / ".claude/agents/another-reviewer.md"
        file.parent.mkdir(parents=True)
        file.write_text("---\nname: reviewer\ndescription: Custom reviewer\n---\n")
        before = snapshot(self.project)
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(before, snapshot(self.project))

    def test_missing_resource(self):
        (self.pack / "Skills/codebase-design/DEEPENING.md").unlink()
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(snapshot(self.project), {})

    def test_missing_transitive_skill(self):
        file = self.pack / "pack.json"
        data = json.loads(file.read_text())
        data["skills"].remove("project-graph-context")
        file.write_text(json.dumps(data))
        self.assertEqual(self.run_cli("--apply")[0], 2)

    def test_manual_policy_preserved(self):
        self.install()
        for root in installer.SKILL_ROOTS:
            for name in ("handoff", "retro"):
                path = self.project / root / name
                self.assertIn("disable-model-invocation: true", (path / "SKILL.md").read_text())
                self.assertIn("allow_implicit_invocation: false", (path / "agents/openai.yaml").read_text())
        for path in (self.project / ".claude/agents").glob("*.md"):
            self.assertNotIn("\nskills:", path.read_text(encoding="utf-8"))

    def test_manual_policy_must_be_structured_and_symmetric(self):
        skill = self.pack / "Skills/handoff/SKILL.md"
        metadata = self.pack / "Skills/handoff/agents/openai.yaml"
        original_skill, original_metadata = skill.read_text(encoding="utf-8"), metadata.read_text(encoding="utf-8")
        interface = 'interface:\n  display_name: "Handoff"\n'
        manual = "disable-model-invocation: true"
        self.assertIn(manual, original_skill)
        invalid = {
            "policy absent": (original_skill, interface),
            "policy only in a comment": (original_skill, interface + "# policy:\n#   allow_implicit_invocation: false\n"),
            "key under the wrong mapping": (original_skill, interface + "  allow_implicit_invocation: false\n"),
            "non-boolean value": (original_skill, interface + "policy:\n  allow_implicit_invocation: falsey\n"),
            "true plus a commented false": (original_skill, interface + "policy:\n  allow_implicit_invocation: true\n# allow_implicit_invocation: false\n"),
            "duplicate key": (original_skill, interface + "policy:\n  allow_implicit_invocation: false\n  allow_implicit_invocation: true\n"),
            "two policy mappings": (original_skill, interface + "policy:\n  allow_implicit_invocation: false\npolicy:\n  other: 1\n"),
            "key nested one level too deep": (original_skill, interface + "policy:\n  extra:\n    allow_implicit_invocation: false\n"),
            "flow-style policy": (original_skill, interface + "policy: {allow_implicit_invocation: false}\n"),
            "tab indentation": (original_skill, interface + "policy:\n\tallow_implicit_invocation: false\n"),
            # Without a policy these two would pass if the flag were silently ignored.
            "capitalised frontmatter flag": (original_skill.replace(manual, "disable-model-invocation: True"), interface),
            "frontmatter flag with trailing comment": (original_skill.replace(manual, manual + " # manual"), interface),
            "manual only in openai.yaml": (original_skill.replace(manual + "\n", ""), original_metadata),
            "manual only in openai.yaml, quoted mapping key": (original_skill.replace(manual + "\n", ""),
                                                               interface + '"policy":\n  allow_implicit_invocation: false\n'),
            "manual skill without openai.yaml": (original_skill, None),
        }
        for label, (skill_text, metadata_text) in invalid.items():
            with self.subTest(label):
                skill.write_text(skill_text, encoding="utf-8")
                if metadata_text is None:
                    metadata.unlink(missing_ok=True)
                else:
                    metadata.write_text(metadata_text, encoding="utf-8")
                code, log = self.run_cli()
                self.assertEqual(code, 2, log)
                self.assertEqual({}, snapshot(self.project))
        valid = {
            "inline comment after the value": (original_skill, interface + "policy:\n  allow_implicit_invocation: false  # manual only\n"),
            "model-invoked in both formats": (original_skill.replace(manual + "\n", ""), interface),
            "model-invoked without openai.yaml": (original_skill.replace(manual + "\n", ""), None),
            "explicit false flag, explicit true policy": (original_skill.replace(manual, "disable-model-invocation: false"),
                                                          interface + "policy:\n  allow_implicit_invocation: true\n"),
        }
        for label, (skill_text, metadata_text) in valid.items():
            with self.subTest(label):
                skill.write_text(skill_text, encoding="utf-8")
                if metadata_text is None:
                    metadata.unlink(missing_ok=True)
                else:
                    metadata.write_text(metadata_text, encoding="utf-8")
                code, log = self.run_cli()
                self.assertEqual(code, 0, log)

    def test_divergent_compatibility_skill(self):
        destination = self.project / ".cursor/skills/handoff"
        shutil.copytree(self.pack / "Skills/handoff", destination)
        (destination / "extra.txt").write_text("different resources")
        before = snapshot(self.project)
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(before, snapshot(self.project))

    def test_extra_resource_in_managed_skill(self):
        self.install()
        (self.project / ".claude/skills/handoff/extra.txt").write_text("User resource")
        before = snapshot(self.project)
        self.assertEqual(self.run_cli("--check")[0], 2)
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(before, snapshot(self.project))

    def test_change_between_prepare_and_apply(self):
        outputs = installer.prepare(self.pack, self.project, "project")
        file = self.project / "AGENTS.md"
        file.write_bytes(b"Concurrent user rule")
        before = snapshot(self.project)
        with self.assertRaises(installer.InvalidPack):
            installer.apply_outputs(self.project, outputs)
        self.assertEqual(before, snapshot(self.project))

    def test_actual_app_and_evaluation_pack_merge(self):
        self.install()
        # Expected roles come from the manifests, not from a count that goes stale.
        expected = set(json.loads((self.pack / "pack.json").read_text(encoding="utf-8"))["phases"]["project"])
        for name in ("App_starter_pack", "Evaluation_pack"):
            pack = PACK.parent / name
            self.assertTrue(pack.is_dir(), f"Required sibling fixture: {name}")
            expected |= set(json.loads((pack / "pack.json").read_text(encoding="utf-8"))["phases"]["project"])
            output = installer.prepare(pack, self.project, "project")
            installer.apply_outputs(self.project, output)
        manifest = json.loads((self.project / installer.MANIFEST).read_text())
        self.assertEqual(set(manifest["roles"]), expected)
        self.assertIn("evaluation", manifest["roles"])
        self.assertNotIn("agent-optimizer", manifest["roles"])
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_optimizer_phase_separate_project(self):
        pack = PACK.parent / "Evaluation_pack"
        output = installer.prepare(pack, self.project, "optimizer")
        installer.apply_outputs(self.project, output)
        manifest = json.loads((self.project / installer.MANIFEST).read_text())
        self.assertEqual(list(manifest["roles"]), ["agent-optimizer"])

    def test_second_pack_shared_files(self):
        self.install()
        file = self.pack / "pack.json"
        data = json.loads(file.read_text())
        data["id"] = "second-pack"
        file.write_text(json.dumps(data))
        self.install()
        self.assertEqual(self.run_cli("--check")[0], 0)
        manifest = json.loads((self.project / installer.MANIFEST).read_text())
        self.assertEqual(len(manifest["packs"]), 2)
        self.assertEqual(len(manifest["files"][".claude/agents/reviewer.md"]["owners"]), 2)

    def test_shared_version_conflict(self):
        self.install()
        file = self.pack / "pack.json"
        data = json.loads(file.read_text())
        data["id"] = "second-pack"
        file.write_text(json.dumps(data))
        source = self.pack / "Agents/ReviewerAgent_General.md"
        source.write_bytes(source.read_bytes() + b"\nDifferent revision\n")
        before = snapshot(self.project)
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(before, snapshot(self.project))

    def test_role_formats_readonly_and_models(self):
        self.install()
        codex = (self.project / ".codex/agents/prompt-agent.toml").read_text(encoding="utf-8")
        parsed = installer.tomllib.loads(codex)
        self.assertNotIn("sandbox_mode", parsed)
        self.assertNotIn("model", parsed)
        for runtime in (".claude", ".cursor"):
            text = (self.project / runtime / "agents/prompt-agent.md").read_text(encoding="utf-8")
            self.assertNotIn("gpt-6.1-sol", text)
            self.assertIn("model: inherit", text)
        self.assertIn("readonly: true", (self.project / ".cursor/agents/reviewer.md").read_text(encoding="utf-8"))
        self.assertIn("tools: Read, Glob, Grep, Skill", (self.project / ".claude/agents/reviewer.md").read_text(encoding="utf-8"))

    def test_manifest_path_escape(self):
        self.install()
        path = self.project / installer.MANIFEST
        data = json.loads(path.read_text())
        data["files"]["../escape.txt"] = {"sha256": "bad"}
        path.write_text(json.dumps(data))
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertFalse((self.base / "escape.txt").exists())

    def test_source_lab_protected(self):
        marker = self.project / ".codex/skills/prompt-repository-maintenance/SKILL.md"
        marker.parent.mkdir(parents=True)
        marker.write_text("lab")
        before = snapshot(self.project)
        self.assertEqual(self.run_cli("--apply")[0], 2)
        self.assertEqual(before, snapshot(self.project))

    def test_rollback_on_replace_failure(self):
        (self.project / "AGENTS.md").write_bytes(b"User instructions")
        before = snapshot(self.project)
        outputs = installer.prepare(self.pack, self.project, "project")
        original = installer.os.replace
        count = 0
        def failing(source, target):
            nonlocal count
            count += 1
            if count == 4:
                raise OSError("Injected write failure")
            original(source, target)
        with patch.object(installer.os, "replace", side_effect=failing):
            with self.assertRaises(OSError):
                installer.apply_outputs(self.project, outputs)
        self.assertEqual(before, snapshot(self.project))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--pack", required=True, type=Path)
    parser.add_argument("--temp-root", type=Path, help="Existing writable directory for isolated test folders")
    args, remaining = parser.parse_known_args()
    PACK = args.pack.resolve()
    TEMP_ROOT = args.temp_root.resolve() if args.temp_root else None
    unittest.main(argv=[sys.argv[0], *remaining])
