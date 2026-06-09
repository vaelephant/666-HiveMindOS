from memory_layer.knowledge_base.core.execution.condition_eval import eval_when


def test_when_true():
    ck = {"t3": {"count": 5}}
    assert eval_when("$t3.count > 0", ck) is True


def test_when_false():
    ck = {"t3": {"count": 0}}
    assert eval_when("$t3.count > 0", ck) is False


def test_when_none():
    assert eval_when(None, {}) is True
