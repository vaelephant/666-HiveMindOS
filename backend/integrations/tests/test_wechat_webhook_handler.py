"""WeChatWork webhook handler tests."""

from __future__ import annotations

import pytest

from integrations.wechat_work.webhook_handler import parse_inbound_event


SAMPLE_TEXT_XML = """<xml>
<ToUserName><![CDATA[toUser]]></ToUserName>
<FromUserName><![CDATA[zhangsan]]></FromUserName>
<CreateTime>1348831860</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[你好]]></Content>
<MsgId>1234567890123456</MsgId>
<AgentID>1000002</AgentID>
</xml>"""


def test_parse_text_message_xml():
    event = parse_inbound_event(SAMPLE_TEXT_XML)
    assert event is not None
    assert event.msg_type == "text"
    assert event.content == "你好"
    assert event.from_user == "zhangsan"
    assert event.agent_id == "1000002"


def test_parse_non_text_message():
    xml = """<xml>
<MsgType><![CDATA[image]]></MsgType>
<FromUserName><![CDATA[zhangsan]]></FromUserName>
<AgentID>1</AgentID>
</xml>"""
    event = parse_inbound_event(xml)
    assert event is not None
    assert event.msg_type == "image"
    assert event.content == ""


def test_verify_url_invalid_signature():
    from integrations.wechat_work.webhook_handler import verify_url

    with pytest.raises(ValueError, match="invalid wechat work signature"):
        verify_url("bad", "123", "nonce", "echostr", "token", "a" * 43, "corp")
