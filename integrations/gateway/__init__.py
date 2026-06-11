"""Unified messaging gateway — channel adapters share one interface."""

from integrations.gateway.base import ChannelAdapter, truncate_reply

__all__ = ["ChannelAdapter", "truncate_reply"]
