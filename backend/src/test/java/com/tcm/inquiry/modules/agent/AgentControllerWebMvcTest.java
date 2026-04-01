package com.tcm.inquiry.modules.agent;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.tcm.inquiry.config.TcmApiPropertiesConfig;

@WebMvcTest(AgentController.class)
@Import(TcmApiPropertiesConfig.class)
class AgentControllerWebMvcTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private AgentService agentService;

    @Test
    void moduleInfoOk() throws Exception {
        mockMvc.perform(get("/api/v1/agent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.module").value("agent"));
    }

    @Test
    void healthOk() throws Exception {
        mockMvc.perform(get("/api/v1/agent/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").value("agent"));
    }

    @Test
    void runJsonOk() throws Exception {
        org.mockito.Mockito.when(agentService.runJson(any()))
                .thenReturn(new AgentRunResponse("ok", List.of(), "chat"));

        mockMvc.perform(
                        post("/api/v1/agent/run")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"task\":\"hello\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.assistant").value("ok"))
                .andExpect(jsonPath("$.data.mode").value("chat"));
    }
}
