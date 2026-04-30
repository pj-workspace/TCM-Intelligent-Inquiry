# DashScope OpenAI 兼容 Chat Completions — 请求体速查

本文档为 **正文速查** + **附录官方摘录**（像素、采样默认、`seed`、联网策略、`logprobs` 适用面等）。附录与[阿里云 OpenAI 兼容 Chat API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)冲突时以**官网**为准。

**配对阅读**：响应结构见 **`dashscope-openai-chat-completion-response.md`**。本仓库业务对外为 **`/api/chat` SSE**，与上游 DashScope 请求/响应不同层。

---

## 调用方式摘要

| 方式 | `base_url` 示例 | 鉴权 |
|------|-----------------|------|
| OpenAI Python SDK | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `api_key=os.getenv("DASHSCOPE_API_KEY")` |
| HTTP | 同上 + 路径 `/chat/completions` | `Authorization: Bearer <API Key>` |

**非 OpenAI 标准字段**（含 `top_k`、`repetition_penalty`、`enable_thinking`、`enable_search`、`search_options`、`vl_high_resolution_images`、`skill` 等）：用 **HTTP** 时可与标准字段并列放在 JSON body；用 **Python OpenAI SDK** 时多需写入 **`extra_body={...}`**，或 **`extra_headers={...}`**（如内容安全头）。

---

## 最小示例（Python SDK）

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

completion = client.chat.completions.create(
    model="qwen-plus",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "你是谁？"},
    ],
)
print(completion.model_dump_json())
```

---

## 顶层字段（必选与常用）

| 字段 | 类型 | 说明 |
|------|------|------|
| **`model`** | string | **必选**。模型 id；支持 Qwen 主系列、Qwen-VL、Qwen-Coder、Qwen-Omni、Qwen-Math 等。**Qwen-Audio** 不兼容本协议（仅 DashScope 协议）。 |
| **`messages`** | array | **必选**。按时间顺序的消息列表（见下）。 |
| `stream` | boolean | 默认 `false`。`true` 为流式 chunk。 |
| `stream_options` | object | 仅 `stream=true` 时有效。子字段 **`include_usage`**：是否在**最后一个 chunk** 返回 token 用量。 |
| `tools` | array | Function Calling 工具列表。 |
| `tool_choice` | string / object | 默认 `auto`；`none`；或强制指定 `{"type":"function","function":{"name":"..."}}`（思考模式模型不支持强制指定）。 |
| `parallel_tool_calls` | boolean | 默认 `false`。并行工具调用。 |
| `temperature` | float | `[0, 2)`。与 `top_p` 建议只调一个。按模型的默认值差异大，以官方为准。 |
| `top_p` | float | `(0, 1.0]`。 |
| `presence_penalty` | float | `[-2.0, 2.0]`。正负含义与按模型默认值见官方；**QVQ 等不建议改默认**。 |
| `frequency_penalty` | float | OpenAI 兼容常见字段；是否与 `presence_penalty` 同时调参以官方/控制台为准。 |
| `response_format` | object | 默认 `{"type":"text"}`。子字段 **`type`**：`text` \| **`json_object`**（须在提示中明确要求 JSON）；结构化输出详见官方。 |
| `max_tokens` | integer | 限制**输出** token；触顶时 `finish_reason` 为 `length`。**不限制思考模型思维链长度**（见官方说明）。 |
| `stop` | string / array | 停止词。数组内勿混用字符串与 token_id。 |
| `logprobs` | boolean | 默认 `false`。`reasoning_content` 不对其返回 logprobs。支持的模型子集见官方。 |
| `top_logprobs` | integer | `[0, 5]`，仅 `logprobs=true` 时生效。 |
| `modalities` | array | 默认 `["text"]`。**仅 Qwen-Omni**：如 `["text","audio"]`。 |
| `audio` | object | **仅 Omni**，且 `modalities` 含 audio：`voice`（必选）、`format`（如 `wav`）。 |
| `n` | integer | 默认 `1`，范围 `1–4`；**仅部分模型**（如部分 Qwen3 非思考、`qwen-plus-character`）；若传 **`tools`** 须 **`n=1`**。增大 **`n` 主要增加输出侧 Token 消耗**，输入不变。 |
| `enable_search` | boolean | 默认 `false`。联网搜索（多经 `extra_body` 传入 SDK）。 |
| `search_options` | object | `forced_search`、`search_strategy`（`turbo` / `max` / `agent` / `agent_max` 等）、`enable_search_extension` 等；部分策略**仅特定模型**可用（以官方为准）。 |

### 常放 `extra_body` 的扩展（Python SDK）

| 键 | 用途摘要 |
|----|----------|
| `top_k` | 非标准；`null` 或 `>100` 则仅 `top_p` 生效。 |
| `repetition_penalty` | `>0`，`1.0` 为不惩罚。 |
| `vl_high_resolution_images` | 高分辨率图像策略；为 `true` 时与 `max_pixels` 关系见官方。 |
| `enable_thinking` | 混合思考模型是否开启思考；`true` 时经 **`reasoning_content`** 返回。适用于 **Qwen3.6 / Qwen3.5 / Qwen3 / Qwen3-Omni-Flash / Qwen3-VL** 等（以官方「深度思考」为准）。 |
| `preserve_thinking` | 是否把历史中 assistant 的 **`reasoning_content`** 拼进模型输入。当前文档示例模型含 **qwen3.6-max-preview、qwen3.6-plus、qwen3.6-plus-2026-04-02、kimi-k2.6（百炼部署）** 等；开启后历史思考会计费。 |
| `thinking_budget` | 思考过程最大 token。 |
| `enable_code_interpreter` | 代码解释器。 |
| `seed` | `[0, 2^31−1]`，可复现性。 |
| `enable_search` / `search_options` | 同顶层联网能力在 SDK 中的常见写法。 |
| `skill` | **仅 `qwen-doc-turbo`**。**使用 `skill` 时 `stream` 必须为 `true`**。数组元素含 **`type`**（当前 **`ppt`**）、可选 **`mode`**：`general`（模板 HTML，可配 **`template_id`**）或 **`creative`**（图版 PPT）；`template_id` 如 `news_01`、`summary_01`、`internet_01`、`thesis_01` 等（见官方「生成 PPT」）。 |

---

## `messages` 消息类型

### System（可选）

| 字段 | 说明 |
|------|------|
| `role` | 固定 **`system`**。 |
| `content` | string，**必选**。 |

说明：QwQ **不建议**设 system；QVQ 设 system **不生效**。

### User（必选）

| 字段 | 说明 |
|------|------|
| `role` | 固定 **`user`**。 |
| `content` | **string**（纯文本）或 **array**（多模态 / 显式缓存等多段内容）。 |

### Assistant（可选，多轮回填）

| 字段 | 说明 |
|------|------|
| `role` | **`assistant`**。 |
| `content` | 有 `tool_calls` 时可为空，否则通常必填。 |
| `partial` | boolean，默认 `false`，前缀续写（支持模型见官方）。 |
| `tool_calls` | 上一轮模型返回的工具调用，用于续跑。每项含 **`id`**、**`type`**（`function`）、**`function.name`** / **`function.arguments`**（JSON 字符串）、**`index`**（与响应中 `tool_calls` 一致）。 |

### Tool（可选，工具结果）

| 字段 | 说明 |
|------|------|
| `role` | **`tool`**。 |
| `content` | string，**必选**（结构化结果需序列化为字符串）。 |
| `tool_call_id` | **必选**，对应 `choices[0].message.tool_calls[i].id`。 |

---

## 多模态 / 缓存：`content` 为 array 时的片段

每段为 object，**`type`（必选）** 决定其余字段：

| `type` | 要点 |
|--------|------|
| **`text`** | **`text`**（string）必选。 |
| **`image_url`** | **`image_url.url`**（string）必选：图片 URL 或 Base64 Data URL。可选 **`min_pixels` / `max_pixels`**（VL/QVQ；阈值与 `vl_high_resolution_images` 联动，按模型查官方）。 |
| **`input_audio`** | `input_audio.data`（URL 或 Base64）、**`format`**（如 mp3/wav）。 |
| **`video`** | 图片 URL **数组** 表示帧序列；可选 **`fps`**、`min_pixels`、`max_pixels`、`total_pixels`（长视频控 token，见官方）。 |
| **`video_url`** | **`video_url.url`** 必填；可选 **`fps`** `[0.1, 10]` 默认约 `2.0`；另有 **min/max/total_pixels**。Qwen-VL 偏视觉；Omni 可含音频。 |

另可含 **`cache_control`**：`{"type":"ephemeral"}` 等显式缓存（见官方「显式缓存」）。

---

## 其它说明（易错点）

- **流式**：官方建议长输出用 `stream: true`。**非流式**若超过 **约 300 秒**未完成，服务可能**中断并返回已生成内容**（非整段报错）；长输出务必流式。详见官方「文本生成模型概述」超时说明。  
- **`enable_search`**：可能增加 Token；若开启后未触发搜索，可优化提示词，或对 `search_options` 设 **`forced_search: true`**。  
- **`tools`**：每项 `type: function`；**`function.name`** 仅字母、数字、**`_`、`-`**，最长约 **64 token**；**`description`** 必填；**`parameters`** 为合法 JSON Schema，可 `{}` 表示无参。  
- **采样默认值**：`temperature` / `top_p` / `top_k` / `repetition_penalty` / `presence_penalty` **随模型与是否思考模式变化极大**；**QVQ、QwQ、Qwen-VL 部分型号**官方建议勿改默认 **`temperature` / `top_p` / `top_k` / `repetition_penalty` / `presence_penalty`**，全文表见官方。  
- **`logprobs`**：仅部分模型（如部分 qwen-plus/qwen-turbo **快照**、qwen3-vl-plus/flash、Qwen3 开源等）支持，详见官方列表。  
- **`fps`（视频 / 帧列）**：除抽帧频率外，还可表达相邻帧时间间隔，利于时间理解；适用模型子集见官方（Qwen3.6、Qwen3-VL、QVQ 等）。  
- **请求头 `X-DashScope-DataInspection`**：JSON 字符串，如进一步做输入输出护栏；HTTP 用 `-H`；Python SDK 用 `extra_headers`；示例取值如 `'{"input":"cip","output":"cip"}'`（见官方「AI 安全护栏」）。Node SDK 文档称**不支持**该头（以官方最新为准）。  
- **PPT `skill`**：字段与 `mode` / `template_id` 见上表 **`extra_body.skill`**；**必须流式**。

---

需要最新、可计费字段时，以百炼控制台 + 阿里云帮助中心为准；下文**附录**为便于离线查阅的**摘录快照**，与官网冲突时以**官网**为准。

---

## 与仓库实现的关联

- 上游对话客户端：`backend/app/llm/providers/qwen.py`（`ChatOpenAI`、`enable_thinking` 等通过 `extra_body` / `model_kwargs` 与官方对齐）。
- 业务侧 SSE：`doc/frontend-integration.md`。

---

## 附录 A：`vl_high_resolution_images` 与像素（官方摘录）

- **`vl_high_resolution_images: true`**：将输入图像像素上限提升到 **16384 Token 对应像素**；使用**固定分辨率策略**，超过则缩小；此时 **`max_pixels` 对输入图像无效**（各型号实际上限见官方「处理高分辨率图像」）。
- **`false`（默认）**：像素上限主要由 **`max_pixels`** 控制；超过则缩小至 `max_pixels` 内。

### `min_pixels`（可选，VL / QVQ）

输入图像或视频帧**小于** `min_pixels` 时会放大，直至总像素高于阈值。

**输入图像**

| 模型分组 | 默认与最小 |
|----------|------------|
| Qwen3.6、Qwen3.5、Qwen3-VL | **65536** |
| Qwen3.5-Omni | **24576** |
| qwen-vl-max、qwen-vl-max-latest、qwen-vl-max-0813、qwen-vl-plus、qwen-vl-plus-latest、qwen-vl-plus-0815、qwen-vl-plus-0710 | **4096** |
| 其他 qwen-vl-plus / qwen-vl-max、Qwen2.5-VL 开源、QVQ | **3136** |

**输入视频文件或图像列表**

| 模型分组 | 默认 | 最小 |
|----------|------|------|
| Qwen3.6、Qwen3.5、Qwen3.5-Omni、Qwen3-VL（含商业/开源）、qwen-vl-max 等系列、qwen-vl-plus 等系列（同上枚举） | **65536** | **4096** |
| 其他 qwen-vl-plus / qwen-vl-max、Qwen2.5-VL 开源、QVQ | **50176** | **3136** |

### `max_pixels`（可选，VL / QVQ）

图像/视频帧在 **`[min_pixels, max_pixels]`** 内按原图识别；**大于** `max_pixels` 则缩小。与 **`vl_high_resolution_images`** 联动：

**输入图像 — `vl_high_resolution_images` 为 false**

| 模型分组 | 默认 | 最大 |
|----------|------|------|
| Qwen3.6、Qwen3.5、Qwen3-VL | 2621440 | 16777216 |
| Qwen3.5-Omni | 1310720 | 16777216 |
| qwen-vl-max / qwen-vl-plus（同上枚举的具体型号） | 1310720 | 16777216 |
| 其他 qwen-vl-plus / qwen-vl-max、Qwen2.5-VL 开源、QVQ | 1003520 | 12845056 |

**输入图像 — `vl_high_resolution_images` 为 true**

| 模型分组 | 说明 |
|----------|------|
| Qwen3.6、Qwen3.5-Omni、Qwen3.5、Qwen3-VL、qwen-vl-max / qwen-vl-plus（同上枚举） | **`max_pixels` 无效**，上限固定 **16777216** |
| 其他 qwen-vl-plus / qwen-vl-max、Qwen2.5-VL 开源、QVQ | **`max_pixels` 无效**，上限固定 **12845056** |

**输入视频文件或图像列表**

| 模型分组 | 默认 | 最大 |
|----------|------|------|
| Qwen3.6 / 3.5 全系、Qwen3.5-Omni、Qwen3-VL **闭源**、qwen3-vl-235b-a22b-thinking、qwen3-vl-235b-a22b-instruct | 655360 | 2048000 |
| 其他 Qwen3-VL **开源**、qwen-vl-max / qwen-vl-plus（同上枚举型号） | 655360 | 786432 |
| 其他 qwen-vl-plus / qwen-vl-max、Qwen2.5-VL 开源、QVQ | 501760 | 602112 |

### `total_pixels`（可选，VL / QVQ）

限制**从视频抽取的各帧总像素**（单帧像素 × 帧数）；超限时缩放帧，且单帧仍在 `[min_pixels, max_pixels]`。长视频可调低以省 Token，可能损失细节。官方给出默认值与「对应图像 Token 数」换算，摘录如下：

| 模型分组 | 默认（= 通常最大值） | 备注（官方） |
|----------|----------------------|--------------|
| Qwen3.6 / Qwen3.5 系列 | **819200000** | 约 800000 图像 Token（32×32 像素 / Token） |
| Qwen3-VL 闭源、qwen3-vl-235b-a22b-thinking、qwen3-vl-235b-a22b-instruct | **134217728** | 约 131072 图像 Token（32×32） |
| Qwen3.5-Omni | **184549376** | 约 180224 图像 Token（32×32） |
| 其他 Qwen3-VL 开源、qwen-vl-max / qwen-vl-plus（同上枚举） | **67108864** | 约 65536 图像 Token（32×32） |
| 其他 qwen-vl-plus / qwen-vl-max、Qwen2.5-VL 开源、QVQ | **51380224** | 约 65536 图像 Token（**28×28** / Token，官方表述） |

---

## 附录 B：采样与惩罚参数默认值（官方摘录）

以下与 **`temperature` / `top_p` 建议只设其一**；**QVQ** 等官方不建议改默认 `temperature`、`top_p`、`top_k`、`repetition_penalty`、`presence_penalty`。

### `temperature` 默认

| 取值 | 模型分组（节选，同官方列举） |
|------|------------------------------|
| **0.7** | Qwen3.6（非思考）、Qwen3.5-Omni、Qwen3.5（非思考）、Qwen3（非思考）、Qwen3-Instruct/Coder、qwen-max、qwen-plus（非思考）、qwen-flash（非思考）、qwen-turbo（非思考）、qwen 开源、qwen-coder、qwen-doc-turbo、qwen-vl-max-2025-08-13、Qwen3-VL（非思考）等 |
| **0.5** | QVQ 系列；qwen-vl-plus-2025-07-10、qwen-vl-plus-2025-08-15 |
| **0.00001** | qwen-audio-turbo 系列 |
| **0.01** | qwen-vl 系列、qwen2.5-omni-7b、qvq-72b-preview |
| **0** | qwen-math 系列 |
| **0.6** | Qwen3.6/3.5/3（思考模式）、Qwen3-Thinking、Qwen3-Omni-Captioner、QwQ |
| **1.0** | qwen3-max-preview（思考）、qwen-long 系列 |
| **0.92** | qwen-plus-character |
| **0.9** | qwen3-omni-flash 系列 |
| **0.8** | Qwen3-VL（思考模式） |

### `top_p` 默认

| 取值 | 模型分组（节选） |
|------|------------------|
| **0.8** | 与官方列出的「非思考主系列」大体一致，含 qwen-max/plus/flash/turbo、Qwen3-Instruct/Coder、qwen-long、qwq-32b-preview、qwen-doc-turbo、qwen-vl-max-2025-08-13、Qwen3-VL（非思考）等 |
| **0.01** | qwen-vl-max-2024-11-19、qwen-omni-turbo 系列 |
| **0.001** | 大量 qwen-vl-plus / qwen-vl-max 历史快照、Qwen2.5-VL instruct、qwen2.5-omni-7b、qvq-72b-preview 等 |
| **0.5** | QVQ；qwen-vl-plus-2025-07-10、qwen-vl-plus-2025-08-15 |
| **1.0** | qwen3-max-preview（思考）、qwen-math、Qwen3-Omni-Flash |
| **0.95** | Qwen3.6/3.5/3（思考）、Qwen3-VL（思考）、Qwen3-Thinking、QwQ、Qwen3-Omni-Captioner、qwen-plus-character |

### `top_k` 默认（须 `extra_body`，非 OpenAI 标准）

| 默认 | 模型分组 |
|------|----------|
| **10** | QVQ；qwen-vl-plus-2025-07-10、2025-08-15 |
| **40** | QwQ |
| **1** | qwen-math；多数 qwen-vl-plus（除上条）；qwen-vl-max 2025-08-13 之前型号；qwen-audio-turbo；qwen2.5-omni-7b；qvq-72b-preview |
| **50** | Qwen3-Omni-Flash |
| **20** | **其余模型** |

### `repetition_penalty` 默认（常 `extra_body`）

| 默认 | 模型分组（节选） |
|------|------------------|
| **1.0** | qwen-max 系列、qwen-math、qwen-vl-max、qvq-72b-preview、多档 qwen-vl-plus 快照、Qwen2.5-VL instruct、qwen-audio-turbo、QVQ、QwQ、qwq-32b-preview、**Qwen3-VL** 等 |
| **1.1** | qwen-coder、部分 qwen2.5 小模型、qwen2.5-omni-7b |
| **1.2** | qwen-vl-plus、qwen-vl-plus-2025-01-25 |
| **1.05** | **其余模型** |

文字提取：官方建议 **qwen-vl-plus_2025-01-25** 时 **`repetition_penalty=1.0`**。

### `presence_penalty` 默认与含义

- **范围** `[-2.0, 2.0]`：**正**降低与已生成内容的重复倾向；**负**增强重复倾向。 creative 场景可调高；严谨文档可调低。
- **默认（节选）**：`1.5`（多组非思考主模型 + QVQ + 多条 vl）；`1.2`（qwen-vl-plus-latest 等三条）；`1.0`（qwen-vl-plus-2025-01-25）；`0.5`（多规格思考模式 qwen-plus/turbo 等）；**其余 0.0**。
- 官方含「英译中」示例对比 **2.0 / 0.0 / -2.0** 输出风格，此处从略。
- **qwen-vl-plus-2025-01-25** 做文字提取时官方建议 **`presence_penalty=1.5`**。

---

## 附录 C：`seed` 默认值（官方摘录）

| 默认 | 模型分组 |
|------|----------|
| **3407** | qwen-vl-plus-2025-01-02、qwen-vl-max 多条、qvq-72b-preview、**qvq-max** 系列等 |
| **无默认** | qwen-vl-max-2025-01-25、2024-11-19、2024-02-01；qwen-vl-plus、qwen-vl-plus-latest、qwen-vl-plus-2025-05-07、2025-01-25 |
| **1234** | **其余模型** |

范围：`[0, 2^31−1]`。

---

## 附录 D：联网 `search_options.search_strategy` 适用模型（官方摘录）

- **`turbo`（默认）**：速度与效果平衡。  
- **`max`**：多源、更全、更慢。  
- **`agent`**：多轮检索与整合；**仅适用于**：qwen3.5-plus、qwen3.5-plus-2026-02-15、qwen3.5-flash、qwen3.5-flash-2026-02-23、qwen3-max、qwen3-max-2026-01-23、qwen3-max-2025-09-23、qwen3.5-omni-plus、qwen3.5-omni-plus-2026-03-15、qwen3.5-omni-flash、qwen3.5-omni-flash-2026-03-15。  
- **`agent_max`**：`agent` + 网页抓取；**仅适用于**：**qwen3-max、qwen3-max-2026-01-23 的思考模式**。
- **`enable_search_extension`**：垂域搜索；`extra_body={"search_options": {...}}` 等与 SDK 传参方式见官方。

---

## 附录 E：`logprobs` 支持的模型（官方摘录）

仅在请求体 `logprobs: true` 时有意义；**`reasoning_content` 不返回 logprobs**。

- **qwen-plus 系列快照模型**（**不包含**稳定版）
- **qwen-turbo 系列快照模型**（**不包含**稳定版）
- **qwen3-vl-plus** 系列（**包含**稳定版）
- **qwen3-vl-flash** 系列（**包含**稳定版）
- **Qwen3 开源**模型
