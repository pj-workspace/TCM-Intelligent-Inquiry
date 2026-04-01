package com.tcm.inquiry.common;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.tcm.inquiry.config.TcmApiProperties;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final String GENERIC_SERVER_ERROR = "Internal error";
    private static final String GENERIC_IO = "IO error";
    private static final String GENERIC_BAD_REQUEST = "Bad request";

    private final TcmApiProperties apiProperties;

    public GlobalExceptionHandler(TcmApiProperties apiProperties) {
        this.apiProperties = apiProperties;
    }

    @ExceptionHandler(IOException.class)
    public ResponseEntity<ApiResult<Void>> handleIo(IOException ex) {
        log.debug("IOException in request handling", ex);
        String msg =
                apiProperties.isExposeErrorDetails()
                        ? (ex.getMessage() != null ? ex.getMessage() : GENERIC_IO)
                        : GENERIC_IO;
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResult.fail(400, msg));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResult<Void>> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(
                        ApiResult.fail(
                                400,
                                ex.getMessage() != null ? ex.getMessage() : GENERIC_BAD_REQUEST));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResult<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String msg =
                ex.getBindingResult().getFieldErrors().stream()
                        .findFirst()
                        .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                        .orElse("validation error");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResult.fail(400, msg));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResult<Void>> handleException(Exception ex) {
        log.error("Unhandled exception", ex);
        String msg =
                apiProperties.isExposeErrorDetails()
                        ? (ex.getMessage() != null ? ex.getMessage() : GENERIC_SERVER_ERROR)
                        : GENERIC_SERVER_ERROR;
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResult.fail(500, msg));
    }
}
