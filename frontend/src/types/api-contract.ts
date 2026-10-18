import type { paths } from "@/types/api";

type Operation<Path extends keyof paths, Method extends keyof paths[Path]> = NonNullable<paths[Path][Method]>;
type JsonBody<Body> = Body extends { content: { "application/json": infer Json } } ? Json : never;
type JsonResponse<Responses> = Responses extends object
  ? { [Status in keyof Responses]: Status extends 200 | 201 | 202 | 203 | 204 | 205 | 206
      ? Responses[Status] extends { content: { "application/json": infer Json } } ? Json : never
      : never }[keyof Responses]
  : never;

/** Request and success response types generated from the backend OpenAPI document. */
export type ApiRequestBody<Path extends keyof paths, Method extends keyof paths[Path]> =
  Operation<Path, Method> extends { requestBody?: infer Body } ? JsonBody<NonNullable<Body>> : never;

export type ApiQueryParams<Path extends keyof paths, Method extends keyof paths[Path]> =
  Operation<Path, Method> extends { parameters: { query?: infer Query } } ? NonNullable<Query> : never;

export type ApiResponseEnvelope<Path extends keyof paths, Method extends keyof paths[Path]> =
  Operation<Path, Method> extends { responses: infer Responses } ? JsonResponse<Responses> : never;

export type ApiResponseData<Path extends keyof paths, Method extends keyof paths[Path]> =
  ApiResponseEnvelope<Path, Method> extends { data: infer Data } ? Data : never;
