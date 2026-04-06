package com.tcm.inquiry.modules.knowledge.ai.retrieval;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.util.StringUtils;

/**
 * 轻量级中医检索词抽取：从用户问句中提取连续汉字片段作为 Redis 全文检索词，
 * 避免额外 LLM 调用以控制首包延迟；药材/方剂名多为 2～6 字，亦覆盖常见证候用语。
 */
public final class TcmQueryTermExtractor {

    private static final Pattern HAN_RUN = Pattern.compile("[\\p{IsHan}]{2,12}");

    /** 泛化问句虚词，降低噪声命中 */
    private static final Set<String> STOP =
            Set.of(
                    "什么",
                    "怎么",
                    "如何",
                    "哪些",
                    "是否",
                    "可以",
                    "应该",
                    "患者",
                    "症状",
                    "治疗",
                    "方剂",
                    "中药",
                    "中医",
                    "病因",
                    "病机",
                    "辨证",
                    "诊断",
                    "作用",
                    "功效",
                    "主治",
                    "配伍",
                    "用量",
                    "禁忌",
                    "注意事项",
                    "临床表现",
                    "请问",
                    "谢谢");

    private TcmQueryTermExtractor() {}

    /**
     * @param rawUserMessage 用户原问句
     * @param maxTerms 上限，避免 FT 查询过长
     * @return 去重后的候选词（较长词优先保留）
     */
    public static List<String> extractTerms(String rawUserMessage, int maxTerms) {
        if (!StringUtils.hasText(rawUserMessage) || maxTerms <= 0) {
            return List.of();
        }
        String text = rawUserMessage.trim();
        Matcher m = HAN_RUN.matcher(text);
        LinkedHashSet<String> raw = new LinkedHashSet<>();
        while (m.find()) {
            String g = m.group();
            if (!STOP.contains(g)) {
                raw.add(g);
            }
        }
        if (raw.isEmpty()) {
            return List.of();
        }
        List<String> sorted = new ArrayList<>(raw);
        sorted.sort(Comparator.comparingInt(String::length).reversed());
        List<String> pruned = new ArrayList<>();
        for (String term : sorted) {
            if (pruned.size() >= maxTerms) {
                break;
            }
            boolean subsumed = false;
            for (String kept : pruned) {
                if (kept.contains(term) && !kept.equals(term)) {
                    subsumed = true;
                    break;
                }
            }
            if (!subsumed) {
                pruned.add(term);
            }
        }
        return pruned.stream().limit(maxTerms).toList();
    }
}
