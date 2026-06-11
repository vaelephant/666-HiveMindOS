from model_layer.pricing import estimate_cost_usd, estimate_buckets_cost


def test_estimate_cost_gpt4o():
    cost = estimate_cost_usd(
        model="gpt-4o",
        prompt_tokens=1_000_000,
        completion_tokens=0,
    )
    assert cost == 2.5


def test_estimate_cost_with_cache():
    cost = estimate_cost_usd(
        model="claude-sonnet-4-6",
        prompt_tokens=10_000,
        completion_tokens=2_000,
        cached_prompt_tokens=8_000,
        cache_creation_tokens=1_000,
    )
    assert cost > 0


def test_estimate_buckets_cost_sums_models():
    rows = [
        {
            "model": "gpt-4o-mini",
            "prompt_tokens": 100_000,
            "completion_tokens": 10_000,
            "cached_prompt_tokens": 0,
            "cache_creation_tokens": 0,
        },
        {
            "model": "text-embedding-3-small",
            "prompt_tokens": 50_000,
            "completion_tokens": 0,
            "cached_prompt_tokens": 0,
            "cache_creation_tokens": 0,
        },
    ]
    total = estimate_buckets_cost(rows)
    assert total > 0
