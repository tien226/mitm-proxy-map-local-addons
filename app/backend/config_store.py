"""Read and write map local configuration and local files."""

import json
from pathlib import Path
from typing import Any, Dict, List

from pydantic import BaseModel, Field

from project_paths import get_project_root

PROJECT_ROOT = get_project_root()
CONFIG_PATH = PROJECT_ROOT / "config.json"
LOCAL_FILES_DIR = PROJECT_ROOT / "local-files"


class MapLocalRule(BaseModel):
    method: str = "GET"
    url: str
    local_file: str
    status_code: int = 200
    delay_ms: int = 0


class MapLocalRuleUpdate(BaseModel):
    method: str = "GET"
    url: str
    local_file: str
    status_code: int = 200
    delay_ms: int = 0


class ConfigStore:
    def list_rules(self) -> List[MapLocalRule]:
        if not CONFIG_PATH.exists():
            return []
        with CONFIG_PATH.open("r", encoding="utf-8") as config_file:
            data = json.load(config_file)
        return [MapLocalRule.model_validate(entry) for entry in data]

    def save_rules(self, rules: List[MapLocalRule]) -> List[MapLocalRule]:
        LOCAL_FILES_DIR.mkdir(parents=True, exist_ok=True)
        payload: List[Dict[str, Any]] = [rule.model_dump() for rule in rules]
        with CONFIG_PATH.open("w", encoding="utf-8") as config_file:
            json.dump(payload, config_file, indent=2)
            config_file.write("\n")
        return rules

    def add_rule(self, rule: MapLocalRuleUpdate) -> List[MapLocalRule]:
        rules = self.list_rules()
        rules.append(MapLocalRule.model_validate(rule.model_dump()))
        return self.save_rules(rules)

    def update_rule(self, index: int, rule: MapLocalRuleUpdate) -> List[MapLocalRule]:
        rules = self.list_rules()
        if index < 0 or index >= len(rules):
            raise IndexError("Rule index out of range")
        rules[index] = MapLocalRule.model_validate(rule.model_dump())
        return self.save_rules(rules)

    def delete_rule(self, index: int) -> List[MapLocalRule]:
        rules = self.list_rules()
        if index < 0 or index >= len(rules):
            raise IndexError("Rule index out of range")
        del rules[index]
        return self.save_rules(rules)

    def list_local_files(self) -> List[str]:
        LOCAL_FILES_DIR.mkdir(parents=True, exist_ok=True)
        return sorted(
            file_path.name
            for file_path in LOCAL_FILES_DIR.iterdir()
            if file_path.is_file() and not file_path.name.startswith(".")
        )

    def read_local_file(self, filename: str) -> str:
        file_path = self._resolve_local_file(filename)
        return file_path.read_text(encoding="utf-8")

    def write_local_file(self, filename: str, content: str) -> None:
        file_path = self._resolve_local_file(filename)
        file_path.write_text(content, encoding="utf-8")

    def _resolve_local_file(self, filename: str) -> Path:
        safe_name = Path(filename).name
        if safe_name != filename or ".." in filename:
            raise ValueError("Invalid filename")
        LOCAL_FILES_DIR.mkdir(parents=True, exist_ok=True)
        return LOCAL_FILES_DIR / safe_name
