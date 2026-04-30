"""Agent 运行时：基于 LangGraph create_react_agent 构建 ReAct 图。

- agent_id 为空：默认图按「LLM 配置指纹 + 工具名列表」缓存，配置或 MCP 工具变更后自动换新图。
- agent_id 非空：从数据库加载 AgentRecord，按配置组装工具与提示（每请求构建）。
"""

from __future__ import annotations

import hashlib
from collections import OrderedDict
from typing import Literal

from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent

from app.agent.tools.loader import ensure_tools_loaded
from app.agent.tools.registry import tool_registry
from app.core.config import (
    get_settings,
    list_qwen_chat_model_option_rows,
    primary_qwen_chat_model,
    qwen_option_for_model_id,
)
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
- 名称以 mcp_ 开头的工具来自已注册的 MCP 服务，按需调用；参数使用 arguments 字典传入。
- 在工具结果的基础上综合推理，再给出最终答案。
- 除非用户明确开启联网搜索，否则禁止调用 searx_web_search。\
"""

_DEFAULT_SYSTEM_PROMPT = append_tcm_safety_to_system_prompt(_RAW_DEFAULT_SYSTEM_PROMPT)

_RAW_CHAT_ONLY_SYSTEM_PROMPT = """\
你是面向中医领域的对话助手（当前模式不启用任何外部工具）。
- 请仅凭自身知识作答，不要使用或假设已调用检索、方剂库或联网搜索。
- 回答需严谨、符合中医科普与合规要求；若不足以判断请明确说明并及时建议就医。\
"""

_CHAT_ONLY_SYSTEM_PROMPT = append_tcm_safety_to_system_prompt(_RAW_CHAT_ONLY_SYSTEM_PROMPT)

_WEB_SEARCH_TOOL_NAME = "searx_web_search"

_DEEP_THINK_SUFFIX = """\
【深度思考模式】
- 在给出最终回答前，请先充分进行逐步推理：澄清用户意图、相关中医理论要点、是否需要工具及调用顺序。
- 推理过程应严谨、分步；若当前模型支持将推理与最终回答分离输出，请利用该能力展示思考过程。
- 最终回答仍需简洁可读，并符合中医咨询合规要求。"""

_WEB_SEARCH_FORCE_SUFFIX = """\
【联网检索·必搜】
- 本轮用户已开启「联网搜索」且要求必须检索：你须调用 searx_web_search，构造与用户问题相关的检索词，获取网页摘要后再组织答案。
- 至少完成一次有意的联网尝试：若工具报错、超时或结果为空，须在答复中如实说明，并基于已有知识做最佳努力说明（勿捏造网页内容）。
- 涉及政策法规、新闻时效、现代研究进展等问题时尤应检索核对。"""

_WEB_SEARCH_AUTO_SUFFIX = """\
【联网检索·自动】
- 用户已允许使用联网搜索：仅当回答依赖近期事实、法规政策、新闻动态，或你不确定且可通过公开网页核实的内容时，调用 searx_web_search。
- 若问题属于典籍、教材级中医知识且无核实必要，可直接作答，不必强行搜网。
- 调用检索后请归纳要点；信息源自网页摘要时请交代来源性质。"""


def _dynamic_prompt_suffix(
    effective_deep_think: bool,
    effective_web_search: bool,
    web_search_mode: Literal["auto", "force"],
) -> str:
    parts: list[str] = []
    if effective_deep_think:
        parts.append(_DEEP_THINK_SUFFIX)
    if effective_web_search:
        parts.append(
            _WEB_SEARCH_FORCE_SUFFIX
            if web_search_mode == "force"
            else _WEB_SEARCH_AUTO_SUFFIX
        )
    return "\n\n".join(parts)


def _load_all_tools(*, web_search_enabled: bool = True):
    """加载工具列表；web_search_enabled=False 时剔除联网搜索工具，让模型无法调用。"""
    ensure_tools_loaded()
    tools = tool_registry.all()
    if not web_search_enabled:
        tools = [t for t in tools if t.name != _WEB_SEARCH_TOOL_NAME]
    return tools


def _primary_supports_tool_calling_cached() -> bool:
    """与默认/有名编译缓存对齐的 primary 工具能力（OPTIONS 无时恒为 True）。"""
    s = get_settings()
    if (s.llm_provider or "").strip().lower() != "qwen":
        return True
    opts = list_qwen_chat_model_option_rows(s)
    if not opts:
        return True
    row = qwen_option_for_model_id(primary_qwen_chat_model(s), settings=s)
    if row is None:
        return True
    return row.supports_tool_calling


def _default_graph_fingerprint() -> str:
    """LLM 相关配置 + 工具集变化时指纹变，用于热切换后换新图。"""
    ensure_tools_loaded()
    tool_names = tuple(sorted(tool_registry.names()))
    s = get_settings()
    lp = (s.llm_provider or "qwen").strip().lower()
    opts = list_qwen_chat_model_option_rows(s)

    if lp == "qwen" and opts:
        pid = primary_qwen_chat_model(s)
        tc = _primary_supports_tool_calling_cached()
        raw_sign = (
            _RAW_DEFAULT_SYSTEM_PROMPT if tc else _RAW_CHAT_ONLY_SYSTEM_PROMPT
        )
        ph = hashlib.sha256(raw_sign.encode("utf-8")).hexdigest()[:16]
        blob = repr(
            (
                "qwen_opts_v3",
                pid,
                "with_tools" if tc else "chat_only",
                ph,
                s.dashscope_api_key,
                s.dashscope_base_url,
                tool_names,
            )
        )
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()

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
    primary_tc = _primary_supports_tool_calling_cached()
    if primary_tc:
        tools = _load_all_tools(web_search_enabled=False)
        prompt = _DEFAULT_SYSTEM_PROMPT
    else:
        tools = []
        prompt = _CHAT_ONLY_SYSTEM_PROMPT
    logger.info("创建默认 ReAct Agent（primary_tools=%s），工具: %s", primary_tc, [t.name for t in tools])
    graph = create_react_agent(llm, tools, prompt=prompt)
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
    primary_tc = _primary_supports_tool_calling_cached()

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

        llm = get_chat_model()
        if primary_tc:
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

            base = (row.system_prompt or "").strip() or _RAW_DEFAULT_SYSTEM_PROMPT
            prompt = append_tcm_safety_to_system_prompt(base)
            logger.info(
                "创建 Agent id=%s name=%s tools=%s",
                row.id,
                row.name,
                [t.name for t in tools],
            )
            graph = create_react_agent(llm, tools, prompt=prompt)
        else:
            tools = []
            prompt = _CHAT_ONLY_SYSTEM_PROMPT
            logger.info(
                "创建 Agent id=%s name=%s（primary 关闭工具挂载，仅用纯聊提示）tools=[]",
                row.id,
                row.name,
            )
            graph = create_react_agent(llm, tools, prompt=prompt)

        _named_agent_graphs[agent_id] = graph
        _named_agent_graphs.move_to_end(agent_id)
        while len(_named_agent_graphs) > _MAX_NAMED_AGENT_GRAPHS:
            _named_agent_graphs.popitem(last=False)
        return graph


async def _build_ephemeral_agent_graph(
    agent_id: str | None,
    suffix: str,
    *,
    effective_deep_think: bool = False,
    effective_web_search: bool = False,
    chat_model_override: str,
    effective_tool_calling: bool,
) -> CompiledStateGraph:
    mid = chat_model_override.strip()
    llm = get_chat_model(
        enable_thinking=effective_deep_think,
        chat_model_override=mid,
    )
    extra = suffix.strip()

    if not agent_id:
        if not effective_tool_calling:
            tools: list = []
            raw = _RAW_CHAT_ONLY_SYSTEM_PROMPT + ("\n\n" + extra if extra else "")
            prompt = append_tcm_safety_to_system_prompt(raw)
            logger.info(
                "临时 ReAct Agent（默认、纯聊、thinking=%s）tools=[]",
                effective_deep_think,
            )
        else:
            tools = _load_all_tools(web_search_enabled=effective_web_search)
            raw = _RAW_DEFAULT_SYSTEM_PROMPT + ("\n\n" + extra if extra else "")
            prompt = append_tcm_safety_to_system_prompt(raw)
            logger.info(
                "临时 ReAct Agent（默认），thinking=%s web=%s tools=%s",
                effective_deep_think,
                effective_web_search,
                [t.name for t in tools],
            )
        return create_react_agent(llm, tools, prompt=prompt)

    from app.agent.models import AgentRecord

    async with async_session_factory() as session:
        row = await session.get(AgentRecord, agent_id)
        if row is None:
            if not effective_tool_calling:
                tools = []
                raw = _RAW_CHAT_ONLY_SYSTEM_PROMPT + ("\n\n" + extra if extra else "")
                prompt = append_tcm_safety_to_system_prompt(raw)
                logger.warning(
                    "Agent id=%s 不存在，临时纯聊兜底 tools=[]",
                    agent_id,
                )
            else:
                tools = _load_all_tools(web_search_enabled=effective_web_search)
                raw = _RAW_DEFAULT_SYSTEM_PROMPT + ("\n\n" + extra if extra else "")
                prompt = append_tcm_safety_to_system_prompt(raw)
                logger.warning(
                    "Agent id=%s 不存在，使用默认提示 + 动态后缀；tools=%s",
                    agent_id,
                    [t.name for t in tools],
                )
            return create_react_agent(llm, tools, prompt=prompt)

        if not effective_tool_calling:
            tools = []
            raw = _RAW_CHAT_ONLY_SYSTEM_PROMPT + ("\n\n" + extra if extra else "")
            prompt = append_tcm_safety_to_system_prompt(raw)
            logger.info(
                "临时 Agent id=%s name=%s 纯聊 tools=[] thinking=%s",
                row.id,
                row.name,
                effective_deep_think,
            )
            return create_react_agent(llm, tools, prompt=prompt)

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
        if not effective_web_search:
            tools = [t for t in tools if t.name != _WEB_SEARCH_TOOL_NAME]

        base = (row.system_prompt or "").strip() or _RAW_DEFAULT_SYSTEM_PROMPT
        raw = base + ("\n\n" + extra if extra else "")
        prompt = append_tcm_safety_to_system_prompt(raw)
        logger.info(
            "临时 Agent id=%s name=%s tools=%s thinking=%s web=%s model=%s",
            row.id,
            row.name,
            [t.name for t in tools],
            effective_deep_think,
            effective_web_search,
            mid,
        )
        return create_react_agent(llm, tools, prompt=prompt)


async def build_agent_graph_for_chat_request(
    agent_id: str | None,
    *,
    chat_model_override: str,
    effective_deep_think: bool,
    effective_web_search: bool,
    web_search_mode: Literal["auto", "force"] = "force",
    effective_tool_calling: bool,
) -> CompiledStateGraph:
    """按本轮 effective 模型与能力构图；仅当满足缓存充要条件时命中 default/named 编译缓存。"""
    s = get_settings()
    lp = (s.llm_provider or "").strip().lower()

    suffix = _dynamic_prompt_suffix(
        effective_deep_think,
        effective_web_search,
        web_search_mode,
    )

    if lp != "qwen":
        if not suffix and not effective_deep_think:
            return await build_agent_graph(agent_id)
        return await _build_ephemeral_agent_graph(
            agent_id,
            suffix,
            effective_deep_think=effective_deep_think,
            effective_web_search=effective_web_search,
            chat_model_override=chat_model_override,
            effective_tool_calling=effective_tool_calling,
        )

    primary_mid = primary_qwen_chat_model(s)
    primary_tc = _primary_supports_tool_calling_cached()

    hits_cache = (
        (chat_model_override or "").strip() == primary_mid.strip()
        and not suffix
        and effective_tool_calling == primary_tc
    )

    if hits_cache:
        return await build_agent_graph(agent_id)

    return await _build_ephemeral_agent_graph(
        agent_id,
        suffix,
        effective_deep_think=effective_deep_think,
        effective_web_search=effective_web_search,
        chat_model_override=chat_model_override,
        effective_tool_calling=effective_tool_calling,
    )