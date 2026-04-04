package com.tcm.inquiry.modules.literature.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.tcm.inquiry.modules.literature.repository.LiteratureUploadRepository;

@ExtendWith(MockitoExtension.class)
class LiteratureTTLCleanupServiceTest {

    @Mock private LiteratureUploadRepository literatureUploadRepository;
    @Mock private LiteratureManageService literatureManageService;

    @InjectMocks private LiteratureTTLCleanupService literatureTTLCleanupService;

    @Test
    void purgeExpiredCollectionsDeletesEachId() {
        when(literatureUploadRepository.findDistinctExpiredCollectionIds(any(Instant.class)))
                .thenReturn(List.of("c1", "c2"));

        literatureTTLCleanupService.purgeExpiredCollections();

        verify(literatureManageService).deleteCollection("c1");
        verify(literatureManageService).deleteCollection("c2");
    }
}
