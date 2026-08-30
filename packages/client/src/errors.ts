/**
 * Error classes for DITroy AI SDK.
 */

export class DitroyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DitroyError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DitroyAPIError extends DitroyError {
  public readonly status: number;
  public readonly responseBody?: unknown;

  constructor(status: number, message: string, responseBody?: unknown) {
    super(`Ditroy API error (${status}): ${message}`);
    this.name = "DitroyAPIError";
    this.status = status;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DitroyNetworkError extends DitroyError {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(`Ditroy Network error: ${message}`);
    this.name = "DitroyNetworkError";
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
