package com.tcm.inquiry.modules.knowledge;

final class KnowledgeFilenameUtil {

    private KnowledgeFilenameUtil() {}

    static String sanitize(String original) {
        if (original == null || original.isBlank()) {
            return "upload.bin";
        }
        String name = original.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        name = slash >= 0 ? name.substring(slash + 1) : name;
        if (name.isBlank()) {
            return "upload.bin";
        }
        String cleaned =
                name.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fa5]", "_");
        if (cleaned.isBlank()) {
            return "upload.bin";
        }
        return cleaned.length() > 180 ? cleaned.substring(0, 180) : cleaned;
    }
}
