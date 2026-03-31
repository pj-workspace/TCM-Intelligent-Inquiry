package com.tcm.inquiry.modules.literature;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LiteratureService {

    private final LiteratureUploadRepository literatureUploadRepository;

    public LiteratureService(LiteratureUploadRepository literatureUploadRepository) {
        this.literatureUploadRepository = literatureUploadRepository;
    }

    @Transactional
    public LiteratureRegisterResponse registerUpload(String originalFilename) {
        LiteratureUpload upload = new LiteratureUpload();
        upload.setOriginalFilename(originalFilename);
        upload.setTempCollectionId(UUID.randomUUID().toString());
        upload.setStatus(LiteratureUploadStatus.PENDING);
        literatureUploadRepository.save(upload);
        return new LiteratureRegisterResponse(upload.getTempCollectionId());
    }

    public List<LiteratureUpload> getStatus() {
        return literatureUploadRepository.findAll();
    }
}
