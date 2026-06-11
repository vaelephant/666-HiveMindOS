"""Tests for KV / prompt cache fields in usage parsing."""

from model_layer.providers import anthropic_provider, openai_provider
from model_layer.usage import TokenUsage


class _OpenAIDetails:
    cached_tokens = 120


class _OpenAIUsage:
    prompt_tokens = 200
    completion_tokens = 50
    total_tokens = 250
    prompt_tokens_details = _OpenAIDetails()


class _AnthropicUsage:
    input_tokens = 300
    output_tokens = 40
    cache_read_input_tokens = 180
    cache_creation_input_tokens = 25


def test_openai_usage_extracts_cached_tokens():
    raw = openai_provider._usage_from_openai(_OpenAIUsage())
    assert raw is not None
    usage = TokenUsage.from_counts(**raw)
    assert usage is not None
    assert usage.cached_prompt_tokens == 120
    assert usage.cache_hit_rate == 0.6


def test_anthropic_system_cache_wraps_long_prompt():
    from model_layer.providers.anthropic_provider import _system_with_cache

    short = _system_with_cache("hi")
    assert short == "hi"
    long = _system_with_cache("x" * 2000)
    assert isinstance(long, list)
    assert long[0]["cache_control"] == {"type": "ephemeral"}


def test_anthropic_usage_extracts_cache_fields():
    raw = anthropic_provider._usage_from_anthropic(_AnthropicUsage())
    assert raw is not None
    usage = TokenUsage.from_counts(**raw)
    assert usage is not None
    assert usage.cached_prompt_tokens == 180
    assert usage.cache_creation_tokens == 25
    assert usage.cache_hit_rate == 0.6
