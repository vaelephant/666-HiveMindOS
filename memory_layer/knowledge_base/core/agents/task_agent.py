"""
Task Agent — tool-calling agent backed by the knowledge base.
"""

from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.app.logging_config import get_logger
from memory_layer.knowledge_base.core.graph.memory_graph import MemoryGraph
from memory_layer.knowledge_base.core.tools.kb_toolkit import WikiToolExecutor, tool_runtime, tool_schemas
from memory_layer.knowledge_base.core.wiki.wiki_manager import WikiManager
from memory_layer.knowledge_base.models.task import Task
from memory_layer.knowledge_base.prompts import get
from model_layer import client as llm

log = get_logger("hivemind.agent.task")

_TASK = get("agents.task")
_RT = tool_runtime()


class TaskAgent:
    def __init__(self, wiki: WikiManager, graph: MemoryGraph):
        self._wiki = wiki
        self._graph = graph

    def run(self, task: Task, on_step=None) -> tuple[str, list[dict]]:
        log.info("[task] start  id=%s  input=%s…", task.id[:8], task.input[:50])
        tools = WikiToolExecutor(self._wiki, self._graph, task.org_id)

        def executor(name: str, args: dict) -> str:
            if name == "search_wiki":
                return tools.search_wiki(
                    args.get("query", ""),
                    preview_chars=_RT.get("task_search_preview_chars", 200),
                )
            if name == "list_entities":
                return tools.list_entities(args.get("entity_type"), include_attributes=True)
            return tools(name, args)

        answer, steps = llm.agentic_loop(
            system=_TASK.system,
            user_message=task.input,
            tools_schema=tool_schemas(),
            tool_executor=executor,
            model=_TASK.resolve_model(config),
            on_step=on_step,
        )

        log.info("[task] done   id=%s  steps=%d  answer_len=%d",
                 task.id[:8], len(steps), len(answer))
        return answer, steps
