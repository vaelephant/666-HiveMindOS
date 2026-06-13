"""Workflow YAML parser tests."""

from __future__ import annotations

import pytest

from knowledge_base.core.parsers.workflow_yaml import parse_workflow_yaml, workflow_to_yaml


SAMPLE = """
id: nightly_knowledge_pipeline
label: 夜间知识管线
description: 测试
category: wiki
cron_hint: "0 2 * * *"
enabled: true
steps:
  - id: recap
    action: automation.recap_sessions
    params:
      limit: 5
  - id: compile
    action: automation.compile_candidates
    when: "$recap.sessions_recapped >= 1"
    params:
      limit: 10
"""


def test_parse_workflow_yaml():
    wf = parse_workflow_yaml(SAMPLE)
    assert wf["id"] == "nightly_knowledge_pipeline"
    assert len(wf["steps"]) == 2
    assert wf["steps"][1]["when"] == "$recap.sessions_recapped >= 1"


def test_parse_rejects_bad_action():
    bad = SAMPLE.replace("automation.recap_sessions", "unknown.action")
    with pytest.raises(ValueError, match="automation"):
        parse_workflow_yaml(bad)


def test_roundtrip_yaml():
    wf = parse_workflow_yaml(SAMPLE)
    again = parse_workflow_yaml(workflow_to_yaml(wf))
    assert again["id"] == wf["id"]
    assert again["steps"][0]["action"] == "automation.recap_sessions"
