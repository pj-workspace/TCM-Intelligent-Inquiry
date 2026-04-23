"""Agent 运行时：基于 LangGraph create_react_agent 构建 ReAct 图。

- agent_id 为空：默认图按「LLM 配置指纹 + 工具名列表」缓存，配置或 MCP 工具变更后自动换新图。
- agent_id 非空：从数据库加载 AgentRecord，按配置组装工具与提示（每请求构建）。
"""

import hashlib
from collections import OrderedDict

from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent

from app.agent.tools.loader import ensure_tools_loaded
from app.agent.tools.registry import tool_registry
from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.core.safety import append_tcm_safety_to_system_prompt
from app.llm.registry import get_chat_model

logger = get_logger(__name__)

_MAX_DEFAULT_GRAPHS = 8
_default_graph_by_fp: dict[str, CompiledStateGraph] = {}

_MAX_NAMED_AGENT_GRAPHS = 16
_named_agent_graphs: OrderedDict[str, CompiledStateGraph] = OrderedDict()

_RAW_DEFAULT_SYSTEM_PROMPT = """\
你是面向中医领域的智能助手，回答需严谨、可引用知识库检索结果。
- 若需要文献支撑，请先调用 search_tcm_knowledge 工具检索知识库。
- 若已知方剂名，请调用 formula_lookup 查询组成与主治。
- 若用户以症状、证型求助，可调用 recommend_formulas 从本地方剂库做学习参考（不可替代诊疗）。
- 若需要公网最新网页摘要（非知识库），可调用 searx_web_search（依赖已部署的 SearXNG）。
- 名称以 mcp_ 开头的工具来自已注册的 MCP 服务，按需调用；参数使用 arguments 字典传入。
- 在工具结果的基础上综合推理，再给出最终答案。\
"""

_DEFAULT_SYSTEM_PROMPT = append_tcm_safety_to_system_prompt(_RAW_DEFAULT_SYSTEM_PROMPT)


def _load_all_tools():
    ensure_tools_loaded()
    return tool_registry.all()


def _default_graph_fingerprint() -> str:
    """LLM 相关配置 + 工具集变化时指纹变，用于热切换后换新图。"""
    ensure_tools_loaded()
    tool_names = tuple(sorted(tool_registry.names()))
    s = get_settings()
    blob = repr(
        (
            s.llm_provider,
            s.qwen_chat_model,
            s.dashscope_api_key,
            s.dashscope_base_url,
            s.openai_api_key,
            s.openai_base_url,
            s.openai_chat_model,
            s.anthropic_api_key,
            s.anthropic_chat_model,
            s.zhipu_api_key,
            s.glm_base_url,
            s.glm_chat_model,
            s.deepseek_api_key,
            s.deepseek_base_url,
            s.deepseek_chat_model,
            tool_names,
            # 默认系统提示变更须使缓存失效（指纹不含数据库 Agent 自定义提示）
            hashlib.sha256(_RAW_DEFAULT_SYSTEM_PROMPT.encode("utf-8")).hexdigest()[:16],
        )
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def get_default_graph() -> CompiledStateGraph:
    fp = _default_graph_fingerprint()
    cached = _default_graph_by_fp.get(fp)
    if cached is not None:
        return cached
    llm = get_chat_model()
    tools = _load_all_tools()
    logger.info("创建默认 ReAct Agent，工具: %s", [t.name for t in tools])
    graph = create_react_agent(llm, tools, prompt=_DEFAULT_SYSTEM_PROMPT)
    _default_graph_by_fp[fp] = graph
    while len(_default_graph_by_fp) > _MAX_DEFAULT_GRAPHS:
        _default_graph_by_fp.pop(next(iter(_default_graph_by_fp)))
    return graph


def invalidate_default_graph_cache() -> None:
    """MCP 工具增删等场景清空默认图缓存（下一请求按新指纹重建）。"""
    _default_graph_by_fp.clear()
    _named_agent_graphs.clear()


def invalidate_agent_graph_cache(agent_id: str | None = None) -> None:
    """Agent 配置变更或删除时丢弃对应编译图。"""
    if agent_id:
        _named_agent_graphs.pop(agent_id, None)
    else:
        _named_agent_graphs.clear()


async def build_agent_graph(agent_id: str | None) -> CompiledStateGraph:
    """构建 LangGraph Agent；无 agent_id 时返回缓存的默认图。"""
    if not agent_id:
        return get_default_graph()

    cached = _named_agent_graphs.get(agent_id)
    if cached is not None:
        _named_agent_graphs.move_to_end(agent_id)
        return cached

    from app.agent.models import AgentRecord

    async with async_session_factory() as session:
        row = await session.get(AgentRecord, agent_id)
        if row is None:
            logger.warning("Agent id=%s 不存在，回退默认 Agent", agent_id)
            return get_default_graph()

        ensure_tools_loaded()
        names = row.tool_names or []
        if names:
            tools = tool_registry.get(names)
            if len(tools) != len(names):
                found = {t.name for t in tools}
                missing = [n for n in names if n not in found]
                logger.warning("Agent 工具部分缺失，已忽略: %s", missing)
        else:
            tools = tool_registry.all()

        if not tools:
            tools = tool_registry.all()

        llm = get_chat_model()
        base = (row.system_prompt or "").strip() or _RAW_DEFAULT_SYSTEM_PROMPT
        prompt = append_tcm_safety_to_system_prompt(base)
        logger.info(
            "创建 Agent id=%s name=%s tools=%s",
            row.id,
            row.name,
            [t.name for t in tools],
        )
        graph = create_react_agent(llm, tools, prompt=prompt)
        _named_agent_graphs[agent_id] = graph
        _named_agent_graphs.move_to_end(agent_id)
        while len(_named_agent_graphs) > _MAX_NAMED_AGENT_GRAPHS:
            _named_agent_graphs.popitem(last=False)
        return graph
