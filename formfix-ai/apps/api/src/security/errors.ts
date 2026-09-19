import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { ApiError } from "../../../../packages/contracts/index.js";
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}
export function envelope(e: AppError, requestId = randomUUID()) {
  return ApiError.parse({
    error: {
      code: e.code,
      message: e.message,
      retryable: e.retryable,
      requestId,
    },
  });
}
export const errors: ErrorRequestHandler = (err, req, res, _next) => {
  const e =
    err instanceof AppError
      ? err
      : err instanceof MulterError
        ? new AppError(
            err.code === "LIMIT_FILE_SIZE" ? 413 : 422,
            "UPLOAD_REJECTED",
            "Upload exceeds limits or contains unexpected parts.",
          )
        : err instanceof ZodError
          ? new AppError(
              422,
              "INVALID_INPUT",
              "Request does not match the API contract.",
            )
          : err?.type === "entity.too.large"
            ? new AppError(413, "BODY_TOO_LARGE", "Request body exceeds limit.")
            : err instanceof SyntaxError
              ? new AppError(
                  422,
                  "INVALID_JSON",
                  "Request contains invalid JSON.",
                )
              : new AppError(
                  503,
                  "DEPENDENCY_UNAVAILABLE",
                  "An internal dependency is unavailable; retry later.",
                  true,
                );
  res.status(e.status).json(envelope(e, res.locals.requestId));
};
