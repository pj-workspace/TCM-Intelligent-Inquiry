package com.tcm.inquiry.modules.literature;

import jakarta.validation.constraints.NotBlank;

public record LiteratureRegisterRequest(@NotBlank String filename) {
}
