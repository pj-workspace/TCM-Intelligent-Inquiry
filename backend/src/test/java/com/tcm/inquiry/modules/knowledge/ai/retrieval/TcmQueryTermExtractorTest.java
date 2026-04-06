package com.tcm.inquiry.modules.knowledge.ai.retrieval;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TcmQueryTermExtractorTest {

    @Test
    void extractsHanPhrasesAndStripsStopwords() {
        var terms =
                TcmQueryTermExtractor.extractTerms(
                        "患者出现口渴多饮，是否与消渴相关？想用黄芪配伍桂枝。", 8);
        assertThat(terms).isNotEmpty();
        assertThat(terms).doesNotContain("什么", "患者", "症状");
        assertThat(String.join("", terms)).contains("黄芪");
    }
}
