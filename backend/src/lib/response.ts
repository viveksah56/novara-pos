import type { Response } from "express";

export type ApiSuccess<T> = {
  data: T;
  status: "success";
};

export type ApiFailure = {
  data: null;
  status: "error";
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

export function sendSuccess<T>(response: Response, data: T, httpStatus = 200): void {
  response.status(httpStatus).json({ data, status: "success" } satisfies ApiSuccess<T>);
}

export function errorEnvelope(code: string, message: string, requestId?: string) {
  return {
    data: null,
    status: "error" as const,
    error: { code, message, ...(requestId ? { requestId } : {}) },
  };
}
