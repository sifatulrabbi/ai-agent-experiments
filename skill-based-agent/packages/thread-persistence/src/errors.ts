export class ThreadPersistenceError extends Error {
  readonly code:
    | "THREAD_NOT_FOUND"
    | "INVALID_STATE"
    | "READ_ERROR"
    | "WRITE_ERROR"
    | "VALIDATION_ERROR";
  readonly cause?: unknown;

  constructor(
    code: ThreadPersistenceError["code"],
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ThreadPersistenceError";
    this.code = code;
    this.cause = cause;
  }
}
