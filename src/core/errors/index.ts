/**
 * Core error types
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: any;

  constructor(code: string, message?: string, status = 400, details?: any) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static BadRequest(code: string, message?: string, details?: any) {
    return new AppError(code, message, 400, details);
  }

  static Unauthorized(code: string, message?: string) {
    return new AppError(code, message || "Unauthorized", 401);
  }

  static Forbidden(code: string, message?: string) {
    return new AppError(code, message || "Forbidden", 403);
  }

  static NotFound(code: string, message?: string) {
    return new AppError(code, message || "Not Found", 404);
  }

  static Internal(message?: string) {
    return new AppError(
      "internal_server_error",
      message || "Internal Server Error",
      500,
    );
  }
}

export function isAppError(err: any): err is AppError {
  return (
    err instanceof AppError ||
    (err && typeof err.code === "string" && typeof err.status === "number")
  );
}
