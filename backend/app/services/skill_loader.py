"""Loads Claude-style SKILL.md skill files from disk at runtime for use as agent prompts.

Skills live under backend/app/skills/<skill-name>/SKILL.md, with optional
references/*.md files. Editing a SKILL.md changes agent behavior on the next
call — nothing is baked into Python.
"""
from pathlib import Path

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"


class SkillNotFoundError(FileNotFoundError):
    pass


def skill_exists(name: str) -> bool:
    return (SKILLS_DIR / name / "SKILL.md").is_file()


def load_skill(name: str, include_references: bool = True) -> str:
    """Reads a skill's SKILL.md (and its references/*.md files) and returns the combined text."""
    skill_dir = SKILLS_DIR / name
    skill_md = skill_dir / "SKILL.md"

    if not skill_md.is_file():
        raise SkillNotFoundError(
            f"Skill '{name}' not found at {skill_md}. "
            f"Unzip the .skill file into backend/app/skills/{name}/ (SKILL.md at the top level, "
            f"references/ alongside it if present)."
        )

    content = skill_md.read_text(encoding="utf-8")

    if include_references:
        refs_dir = skill_dir / "references"
        if refs_dir.is_dir():
            for ref_file in sorted(refs_dir.glob("*.md")):
                content += f"\n\n---\n# Reference: {ref_file.name}\n\n{ref_file.read_text(encoding='utf-8')}"

    return content
