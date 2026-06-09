from agent_engine.tools.task_toolkit import format_tools_for_prompt, list_actions


def test_registry_lists_known_actions():
    actions = list_actions()
    assert "search_memories" in actions
    assert "compile_candidates" in actions
    assert "extract_facts" in actions


def test_format_tools_for_prompt():
    text = format_tools_for_prompt()
    assert "search_memories" in text
