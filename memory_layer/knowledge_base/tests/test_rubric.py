from memory_layer.knowledge_base.core.domain.rubric import format_rubric_for_prompt, load_rubric, match_task_type


def test_load_wiki_rubric():
    r = load_rubric("wiki_organize_decisions")
    assert r["pass_score"] == 75
    assert len(r["criteria"]) >= 4


def test_match_task_type():
    assert match_task_type("帮我整理本周项目决策进 Wiki") == "wiki_organize_decisions"
    assert match_task_type("生成销售方案") == "sales_proposal"
    assert match_task_type("随便做个事") == "generic_goal"


def test_format_rubric():
    text = format_rubric_for_prompt(load_rubric("generic_goal"))
    assert "通过分数" in text
