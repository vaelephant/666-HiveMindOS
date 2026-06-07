from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ToolResult:
    success: bool
    data: dict
    error: str = ""


class BaseTool(ABC):
    name: str = ""
    description: str = ""
    requires_permission: bool = False
    audit: bool = True

    @abstractmethod
    def run(self, **kwargs) -> ToolResult:
        ...

    def to_claude_schema(self) -> dict:
        raise NotImplementedError
