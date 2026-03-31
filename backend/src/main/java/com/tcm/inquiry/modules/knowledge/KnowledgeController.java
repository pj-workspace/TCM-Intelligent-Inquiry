package com.tcm.inquiry.modules.knowledge;

import java.io.IOException;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.tcm.inquiry.common.ApiResult;
import com.tcm.inquiry.common.R;
import com.tcm.inquiry.modules.knowledge.dto.KnowledgeFileView;
import com.tcm.inquiry.modules.knowledge.dto.KnowledgeQueryRequest;
import com.tcm.inquiry.modules.knowledge.dto.KnowledgeQueryResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/knowledge")
public class KnowledgeController {

    private final KnowledgeService knowledgeService;
    private final KnowledgeIngestionService knowledgeIngestionService;
    private final KnowledgeFileService knowledgeFileService;
    private final KnowledgeRagService knowledgeRagService;

    public KnowledgeController(
            KnowledgeService knowledgeService,
            KnowledgeIngestionService knowledgeIngestionService,
            KnowledgeFileService knowledgeFileService,
            KnowledgeRagService knowledgeRagService) {
        this.knowledgeService = knowledgeService;
        this.knowledgeIngestionService = knowledgeIngestionService;
        this.knowledgeFileService = knowledgeFileService;
        this.knowledgeRagService = knowledgeRagService;
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResult<String>> health() {
        return ResponseEntity.ok(R.ok("knowledge"));
    }

    @GetMapping("/bases")
    public ResponseEntity<ApiResult<List<KnowledgeBase>>> listBases() {
        return ResponseEntity.ok(R.ok(knowledgeService.listBases()));
    }

    @PostMapping("/bases")
    public ResponseEntity<ApiResult<KnowledgeBase>> createBase(
            @RequestBody CreateKnowledgeBaseRequest body) {
        return ResponseEntity.ok(
                R.ok(knowledgeService.createBase(body.name(), body.embeddingModel())));
    }

    @GetMapping("/bases/{kbId}/documents")
    public ResponseEntity<ApiResult<List<KnowledgeFileView>>> listDocuments(
            @PathVariable("kbId") Long knowledgeBaseId) {
        return ResponseEntity.ok(R.ok(knowledgeFileService.listFiles(knowledgeBaseId)));
    }

    @PostMapping(value = "/bases/{kbId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResult<KnowledgeFileView>> uploadDocument(
            @PathVariable("kbId") Long knowledgeBaseId,
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "chunkSize", required = false) Integer chunkSize)
            throws IOException {
        return ResponseEntity.ok(
                R.ok(knowledgeIngestionService.ingest(knowledgeBaseId, file, chunkSize)));
    }

    @DeleteMapping("/bases/{kbId}/documents/{fileUuid}")
    public ResponseEntity<ApiResult<Void>> deleteDocument(
            @PathVariable("kbId") Long knowledgeBaseId, @PathVariable String fileUuid) {
        knowledgeFileService.deleteFile(knowledgeBaseId, fileUuid);
        return ResponseEntity.ok(R.ok(null));
    }

    @PostMapping("/bases/{kbId}/query")
    public ResponseEntity<ApiResult<KnowledgeQueryResponse>> query(
            @PathVariable("kbId") Long knowledgeBaseId,
            @Valid @RequestBody KnowledgeQueryRequest body) {
        return ResponseEntity.ok(R.ok(knowledgeRagService.query(knowledgeBaseId, body)));
    }
}
