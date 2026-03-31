package com.tcm.inquiry.modules.literature;

import java.util.List;

import com.tcm.inquiry.common.ApiResult;
import com.tcm.inquiry.common.R;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/literature")
public class LiteratureController {

    private final LiteratureService literatureService;

    public LiteratureController(LiteratureService literatureService) {
        this.literatureService = literatureService;
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResult<String>> health() {
        return ResponseEntity.ok(R.ok("literature"));
    }

    @GetMapping("/uploads")
    public ResponseEntity<ApiResult<List<LiteratureUpload>>> listUploads() {
        return ResponseEntity.ok(R.ok(literatureService.getStatus()));
    }

    @PostMapping("/uploads")
    public ResponseEntity<ApiResult<LiteratureRegisterResponse>> registerUpload(
            @Valid @RequestBody LiteratureRegisterRequest request) {
        return ResponseEntity.ok(R.ok(literatureService.registerUpload(request.filename())));
    }
}
