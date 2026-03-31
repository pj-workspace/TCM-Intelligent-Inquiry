package com.tcm.inquiry.modules.knowledge;

public final class KnowledgeRagPrompts {

    private KnowledgeRagPrompts() {
    }

    public static final String RAG_SYSTEM =
            """
            你是中医药知识库问答助手。请**严格依据**用户消息中给出的「参考资料」片段作答；
            若资料不足以回答，请说明「资料中未提及」，不要编造出处或方剂剂量。
            回答宜通俗、有条理；涉及治疗须提醒用户遵医嘱、面诊。
            """;
}
