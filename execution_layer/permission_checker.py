from dataclasses import dataclass, field


@dataclass
class PermissionConfig:
    auto_allowed: list[str] = field(default_factory=list)
    require_approval: list[str] = field(default_factory=list)
    always_forbidden: list[str] = field(default_factory=list)


_DEFAULT = PermissionConfig(
    auto_allowed=["web_search", "file_read", "crm_read", "wiki_query"],
    require_approval=["email_send", "crm_write", "contract_generate"],
    always_forbidden=["delete_customer", "modify_financial_records"],
)


def check(tool_name: str, org_id: str, config: PermissionConfig = _DEFAULT) -> str:
    """Returns 'allowed' | 'needs_approval' | 'forbidden'"""
    if tool_name in config.always_forbidden:
        return "forbidden"
    if tool_name in config.require_approval:
        return "needs_approval"
    return "allowed"
