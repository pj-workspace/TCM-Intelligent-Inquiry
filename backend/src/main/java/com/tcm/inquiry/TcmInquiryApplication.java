package com.tcm.inquiry;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class TcmInquiryApplication {

    public static void main(String[] args) {
        ensureSqliteParentDirectory();
        SpringApplication.run(TcmInquiryApplication.class, args);
    }

    /** SQLite 的 file:./data/... 需先有父目录，否则启动阶段会 SQLITE_CANTOPEN。 */
    private static void ensureSqliteParentDirectory() {
        try {
            Files.createDirectories(Path.of("data"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
