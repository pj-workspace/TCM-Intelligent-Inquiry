# DashScope OpenAI 兼容 Chat Completions — 响应结构（非流式 + 流式 chunk）

本文档描述调用 **`POST …/compatible-mode/v1/chat/completions`** 时，HTTP 响应体的**关键字段**：**非流式**为单个 `chat.completion` JSON；**流式**（`stream: true`）为**多块** `chat.completion.chunk` JSON（常见为 `text/event-stream`，每行 `data: {…}`，以服务商与客户端为准）。用于排查上游千问返回、或与 LangChain / OpenAI SDK 解析结果对照。

**配对阅读**：请求体字段见 **`dashscope-openai-chat-completion-request.md`**。本仓库业务对外聊天为 **`/api/chat` SSE**，二者层级不同。

---

## 非流式：`chat.completion`

### 示例（最小可读形态）

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "我是阿里云开发的一款超大规模语言模型，我叫千问。"
      },
      "finish_reason": "stop",
      "index": 0,
      "logprobs": null
    }
  ],
  "object": "chat.completion",
  "usage": {
    "prompt_tokens": 3019,
    "completion_tokens": 104,
    "total_tokens": 3123,
    "prompt_tokens_details": {
      "cached_tokens": 2048
    }
  },
  "created": 1735120033,
  "system_fingerprint": null,
  "model": "qwen-plus",
  "id": "chatcmpl-6ada9ed2-7f33-9de2-8bb0-78bd4035025a",
  "service_tier": null
}
```

---

### 顶层字段（要点）

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | string | 本次调用唯一 id（如 `chatcmpl-…`）。 |
| `object` | string | **固定为** `chat.completion`。 |
| `created` | integer | Unix 时间戳（秒）。 |
| `model` | string | 实际使用的模型 id。 |
| `choices` | array | 生成结果列表；通常取 `choices[0]`。 |
| `usage` | object | Token 消耗汇总（见下表）；无用量场景可能省略，以实际响应为准。 |
| `system_fingerprint` | string \| null | 文档说明当前多为 **`null`**。 |
| `service_tier` | string \| null | 文档说明当前多为 **`null`**。 |

---

### `choices[]` 每个元素

| 字段 | 类型 | 含义 |
|------|------|------|
| `index` | integer | 在 `choices` 中的下标。 |
| `finish_reason` | string | **停止原因**：`stop`（含命中 `stop` 序列或自然结束）、`length`（触达 `max_tokens` 等长度上限）、`tool_calls`（需进一步 Function Calling）。 |
| `logprobs` | object \| null | 见下 **「`logprobs` 结构」**；未请求或无时为 **`null`**。 |
| `message` | object | 助手消息体（见下）。 |

#### `logprobs` 结构（`choices[i].logprobs`，非流式与流式形态一致时）

当请求 **`logprobs: true`** 且模型支持时，对象内常见：

| 字段 | 含义 |
|------|------|
| **`content`** | array：每个**已生成 token** 一条。 |
| **`content[].token`** | 该 token 文本。 |
| **`content[].bytes`** | UTF-8 原始字节序列，便于精确还原 emoji、中文等。 |
| **`content[].logprob`** | 对数概率；**`null`** 表示极低概率。 |
| **`content[].top_logprobs`** | array：该步**候选 token** 列表，长度与请求 **`top_logprobs`** 一致；每项含 **`token` / `bytes` / `logprob`**。 |

思考内容 **`reasoning_content`** 不返回 logprobs。

#### `message`（`role` 一般为 `assistant`）

| 字段 | 类型 | 含义 |
|------|------|------|
| `content` | string | 面向用户的正文。 |
| `reasoning_content` | string | **思维链 / 思考过程**（启用思考能力且模型支持时出现；流式下多在 `delta.reasoning_content` 增量返回）。 |
| `role` | string | **`assistant`**。 |
| `refusal` | string \| null | 官方说明当前多为 **`null`**（与流式 **`delta.refusal`** 类型表述略有差异，以实际 JSON 为准）。 |
| `audio` | object \| null | 文档说明当前多为 **`null`**（多模态/Omni 等场景以官方为准）。 |
| `function_call` | object \| null | **即将废弃**；固定参考 **`tool_calls`**。 |
| `tool_calls` | array \| null | Function Calling 时：每项含 `id`、`type`（当前为 `function`）、`function.name`、`function.arguments`（**JSON 字符串**，需解析并**校验**合法性）、`index`。有 `tool_calls` 时 `content` 可能为空。 |

---

### `usage`（Token 用量，非流式）

| 字段 | 类型 | 含义 |
|------|------|------|
| `prompt_tokens` | integer | 输入侧 token 数。 |
| `completion_tokens` | integer | 输出侧 token 数。 |
| `total_tokens` | integer | 一般为 `prompt_tokens + completion_tokens`。 |
| `prompt_tokens_details` | object | 输入细分（常为 VL / 多模态）。 |
| `completion_tokens_details` | object | 输出细分（VL 等）。 |
| `cache_creation` | object | 显式缓存创建（存在时）。 |

#### `prompt_tokens_details`（非流式 / 流式最后一包均可能出现）

| 字段 | 含义 |
|------|------|
| `cached_tokens` | Context Cache **命中** token 数。 |
| `text_tokens` | 输入**文本** token（如 Qwen-VL）。 |
| `image_tokens` | 输入**图像** token。 |
| `video_tokens` | **视频文件**或**图像列表**形式视频的 token。 |
| `audio_tokens` | 输入**音频** token；官方说明**视频文件中的音频**也可经此体现（以返回为准）。 |
| `cache_creation` | 显式缓存创建子对象（如 `ephemeral_5m_input_tokens`、`cache_creation_input_tokens`、`cache_type`；无显式缓存时可能不存在 **`cache_type`**）。 |

#### `completion_tokens_details`

| 字段 | 含义 |
|------|------|
| `text_tokens` | 输出**文本** token（如 Qwen-VL）。 |
| `reasoning_tokens` | **思考过程** token（若适用）。 |
| `audio_tokens` | **Qwen-Omni** 等**输出音频** token；官方亦可能标为当前 **`null` 占位**（以实际为准）。 |

（官方表格中部分字段曾描述为「当前固定 null」，以实时响应为准。）

### `cache_creation`（`usage` 内，摘录）

| 字段 | 含义 |
|------|------|
| `ephemeral_5m_input_tokens` | 创建显式缓存的 token 数（官方字段名）。 |
| `cache_creation_input_tokens` | 创建显式缓存的 token 数。 |
| `cache_type` | 显式缓存时为 **`ephemeral`**；非流式响应中若未使用显式缓存可能**无此字段**；流式最后一包若出现，官方亦表述为 **`ephemeral`**（以实际为准）。 |

---

## 流式：`chat.completion.chunk`

每个 chunk 为一条独立 JSON 对象；**同一轮流式会话内**各 chunk 的 **`id`**、**`created`**、**`model`** 通常一致。

### 示例行（节选；真实传输常见为 `data: ` + JSON）

首包常带 `role`，随后多为纯文本增量，结束前一条可带 `finish_reason`，最后可能单独一条 **`choices: []`** 且 **`usage` 有值**（见下节 `stream_options`）：

```text
{"choices":[{"delta":{"content":"","role":"assistant",...},"finish_reason":null,...}],"object":"chat.completion.chunk","usage":null,...}
{"choices":[{"delta":{"content":"我是",...},"finish_reason":null,...}],"object":"chat.completion.chunk","usage":null,...}
{"choices":[{"delta":{"content":"","...},"finish_reason":"stop",...}],"object":"chat.completion.chunk","usage":null,...}
{"choices":[],"object":"chat.completion.chunk","usage":{"completion_tokens":17,"prompt_tokens":22,"total_tokens":39,...}}
```

### 顶层字段（chunk）

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | string | 本次调用唯一 id；**每个 chunk 相同**。 |
| `object` | string | **固定为** `chat.completion.chunk`。 |
| `created` | integer | 请求创建时间戳（秒）；**每个 chunk 相同**。 |
| `model` | string | 本次使用的模型。 |
| `choices` | array | 见下。若请求体设置 **`stream_options.include_usage`**（或兼容字段 **`include_usage`：`true`**），**最后一个**统计 chunk 上 **`choices` 可为空数组 `[]`**，用量只在此时给出。 |
| `usage` | object \| null | **流式过程中多为 `null`**；仅当开启用量统计时，**在最后一个 chunk**（常与 `choices: []` 同现）填充 `prompt_tokens` / `completion_tokens` / `total_tokens` 等。 |
| `system_fingerprint` | string \| null | 文档说明当前多为 **`null`**。 |
| `service_tier` | string \| null | 文档说明当前多为 **`null`**。 |

### `choices[]` 每个元素（流式）

| 字段 | 类型 | 含义 |
|------|------|------|
| `index` | integer | 在 `choices` 中的索引。若请求 **`n` > 1**，需按 `index` 分别拼接多条候选的完整内容。 |
| `finish_reason` | string \| null | **`null`**：生成尚未结束；**`stop`**：触发 `stop` 或自然结束；**`length`**：长度上限结束；**`tool_calls`**：需工具调用后继续。 |
| `logprobs` | object \| null | 结构同上文 **「`logprobs` 结构」**（`choices[i].logprobs`）。 |
| `delta` | object | **增量**内容（见下），非完整 `message`。 |

### `delta`（增量）

| 字段 | 类型 | 含义 |
|------|------|------|
| `content` | string | 正文增量片段；客户端需**顺序拼接**成完整回复。 |
| `reasoning_content` | string | **思维链**增量（启用思考且模型支持时）；需拼接，对应非流式的 `message.reasoning_content`。 |
| `role` | string \| null | **`assistant`** 等；文档说明**通常仅在第一个 chunk** 出现，后续多为 `null`。 |
| `function_call` | object \| null | 多为 **`null`**，以 **`tool_calls`** 为准（旧字段）。 |
| `refusal` | object \| null | 文档说明当前多为 **`null`**（非流式 `message.refusal` 常为 string，类型以实际 JSON 为准）。 |
| `audio` | object \| null | **Qwen-Omni** 等：**增量音频**对象。 |
| `audio.data` | string | Base64 音频增量。 |
| `audio.expires_at` | integer | 官方与创建/过期时间相关的时间戳字段（以实际字段说明为准）。 |
| `tool_calls` | array \| null | **Function Calling**：工具调用增量列表。 |
| `tool_calls[].index` | integer | 在 `tool_calls` 中的索引。 |
| `tool_calls[].id` | string | 工具调用 id。 |
| `tool_calls[].type` | string | **`function`**。 |
| `tool_calls[].function` | object | `name`（**通常首包出现**）、`arguments`（**增量字符串**，全部分片拼接后为完整 JSON 参数字符串；**需校验**是否符合函数签名）。 |

### `usage`（流式、最后一包）

仅当请求中 **`stream_options: { "include_usage": true }`**（或与 SDK 等价的 `include_usage`）时，**最后一个 chunk** 携带用量（可能伴随 **`choices: []`**）。顶层 **`prompt_tokens` / `completion_tokens` / `total_tokens`** 及 **`prompt_tokens_details` / `completion_tokens_details` / `cache_creation`** 子字段含义与**非流式**章节中的子表一致。

---

## 与仓库实现的关联（便于跳转）

- 上游请求构造：`backend/app/llm/providers/qwen.py`（`ChatOpenAI` + `compatible-mode/v1`）。
- 流式下 `reasoning_content` 从 `choices[0].delta` 回补：`DashScopeChatOpenAI._convert_chunk_to_generation_chunk`。
- 应用侧 SSE 事件与枚举：`doc/frontend-integration.md`。
