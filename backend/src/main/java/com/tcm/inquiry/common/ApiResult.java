package com.tcm.inquiry.common;

/**
 * 统一 JSON 响应包装。
 */
public class ApiResult<T> {

    private int code;
    private String message;
    private T data;

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public static <T> ApiResult<T> ok(T data) {
        ApiResult<T> r = new ApiResult<>();
        r.code = 0;
        r.message = "ok";
        r.data = data;
        return r;
    }

    public static <T> ApiResult<T> fail(int code, String message) {
        ApiResult<T> r = new ApiResult<>();
        r.code = code;
        r.message = message;
        r.data = null;
        return r;
    }

    public static <T> ApiResult<T> fail(int code, String message, T data) {
        ApiResult<T> r = new ApiResult<>();
        r.code = code;
        r.message = message;
        r.data = data;
        return r;
    }
}
