package com.tcm.inquiry.common;

/**
 * {@link ApiResult} 的简短工厂方法。
 */
public final class R {

    private R() {
    }

    public static <T> ApiResult<T> ok(T data) {
        return ApiResult.ok(data);
    }

    /** 业务语义：功能尚未实现（与 HTTP 501 配合使用）。 */
    public static ApiResult<Void> notImplemented() {
        return ApiResult.fail(501, "not implemented");
    }
}
