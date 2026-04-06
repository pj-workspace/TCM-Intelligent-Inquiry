package com.tcm.inquiry.bootstrap;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

/**
 * 从项目目录加载 {@code .env}（KEY=VAL），在未设置同名操作系统环境变量时写入 {@link System#setProperty}，
 * 以便 {@code application.yml} 中 {@code ${DASHSCOPE_API_KEY}} 等占位符在非 IDE 场景下可用。
 * <p>
 * 解析规则：忽略空行与 {@code #} 注释行；支持可选 {@code export } 前缀；值两端成对引号会去掉。
 * </p>
 */
public final class DotEnvLoader {

    private DotEnvLoader() {}

    public static void loadOptionalProjectDotEnv() {
        Path[] candidates = {
            Path.of(".env"),
            Path.of("backend", ".env"),
            Path.of("..", ".env")
        };
        for (Path p : candidates) {
            if (Files.isRegularFile(p)) {
                applyFile(p);
                return;
            }
        }
    }

    private static void applyFile(Path file) {
        try {
            for (String raw : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                String line = raw.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                if (line.toLowerCase(Locale.ROOT).startsWith("export ")) {
                    line = line.substring("export ".length()).trim();
                }
                int eq = line.indexOf('=');
                if (eq <= 0) {
                    continue;
                }
                String key = line.substring(0, eq).trim();
                if (key.isEmpty()) {
                    continue;
                }
                String val = line.substring(eq + 1).trim();
                val = stripOptionalQuotes(val);
                if (System.getenv(key) != null) {
                    continue;
                }
                if (System.getProperty(key) != null) {
                    continue;
                }
                System.setProperty(key, val);
            }
        } catch (IOException ignored) {
            // 开发环境只读失败时忽略，仍可通过系统环境变量注入
        }
    }

    private static String stripOptionalQuotes(String val) {
        if (val.length() >= 2
                && ((val.startsWith("\"") && val.endsWith("\""))
                        || (val.startsWith("'") && val.endsWith("'")))) {
            return val.substring(1, val.length() - 1);
        }
        return val;
    }
}
