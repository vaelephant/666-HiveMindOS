from abc import ABC, abstractmethod


class BaseAgent(ABC):
    name: str = ""
    description: str = ""
    allowed_tools: list[str] = []
    memory_access: list[str] = []
    requires_human_approval: list[str] = []

    @abstractmethod
    def run(self, *args, **kwargs) -> dict:
        ...
