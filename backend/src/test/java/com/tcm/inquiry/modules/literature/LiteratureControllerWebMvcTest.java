package com.tcm.inquiry.modules.literature;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.tcm.inquiry.config.TcmApiPropertiesConfig;
import com.tcm.inquiry.modules.literature.ai.LiteratureRagService;
import com.tcm.inquiry.modules.literature.dto.resp.LiteratureFileView;
import com.tcm.inquiry.modules.literature.dto.resp.LiteratureQueryResponse;
import com.tcm.inquiry.modules.literature.entity.LiteratureUploadStatus;
import com.tcm.inquiry.modules.literature.service.LiteratureIngestionService;
import com.tcm.inquiry.modules.literature.service.LiteratureManageService;

@WebMvcTest(LiteratureController.class)
@Import(TcmApiPropertiesConfig.class)
class LiteratureControllerWebMvcTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private LiteratureIngestionService literatureIngestionService;
    @MockBean private LiteratureRagService literatureRagService;
    @MockBean private LiteratureManageService literatureManageService;

    @Test
    void healthOk() throws Exception {
        mockMvc.perform(get("/api/v1/literature/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").value("literature"));
    }

    @Test
    void listCollectionFiles() throws Exception {
        LiteratureFileView v =
                new LiteratureFileView(
                        1L,
                        "col-1",
                        "a.pdf",
                        "fu",
                        10L,
                        "application/pdf",
                        LiteratureUploadStatus.READY,
                        Instant.now(),
                        null);
        org.mockito.Mockito.when(literatureManageService.listCollection("col-1"))
                .thenReturn(List.of(v));

        mockMvc.perform(get("/api/v1/literature/collections/col-1/files"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].fileUuid").value("fu"));
    }

    @Test
    void queryOk() throws Exception {
        org.mockito.Mockito.when(literatureRagService.query(eq("col-1"), any()))
                .thenReturn(new LiteratureQueryResponse("ans", List.of("a.pdf"), 2));

        mockMvc.perform(
                        post("/api/v1/literature/collections/col-1/query")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"message\":\"m\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.answer").value("ans"));
    }

    @Test
    void deleteCollection() throws Exception {
        mockMvc.perform(delete("/api/v1/literature/collections/col-z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
        org.mockito.Mockito.verify(literatureManageService).deleteCollection("col-z");
    }
}
