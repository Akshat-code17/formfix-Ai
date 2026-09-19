import fs from "node:fs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import * as C from "../packages/contracts/index.js";
fs.mkdirSync("docs", { recursive: true });
const schemas: Record<string, unknown> = {};
for (const [name, schema] of Object.entries(C))
  if (schema instanceof z.ZodType)
    schemas[name] = zodToJsonSchema(schema, {
      $refStrategy: "none",
      target: "openApi3",
    });
const ref = (name: string) => ({ $ref: "#/components/schemas/" + name });
const routes: [string, string, string, string?, string?][] = [
  ["get", "/api/config", "Config"],
  ["post", "/api/sessions", "SessionResult"],
  ["post", "/api/forms/analyze", "AnalyzeResult", "multipart"],
  ["get", "/api/jobs/{jobId}", "JobResult"],
  ["get", "/api/forms/{formId}", "SessionState"],
  ["get", "/api/forms/{formId}/document", "binary"],
  ["get", "/api/forms/{formId}/sources", "Extraction"],
  ["patch", "/api/forms/{formId}/answers", "SavedAnswers", "AnswerPatch"],
  ["patch", "/api/forms/{formId}/documents", "SavedDocuments", "DocumentPatch"],
  ["post", "/api/forms/{formId}/language", "SessionState", "LanguageInput"],
  [
    "get",
    "/api/forms/{formId}/fields/{fieldId}/explanation",
    "Explanation",
    undefined,
    "language",
  ],
  ["post", "/api/forms/{formId}/ask", "ChatAnswer", "Ask"],
  ["post", "/api/forms/{formId}/validate", "ValidationReport", "ValidateInput"],
  ["get", "/api/forms/{formId}/export", "ExportSummary", undefined, "format"],
  ["delete", "/api/sessions/current", "empty"],
];
const paths: Record<string, any> = {};
for (const [method, path, out, input, query] of routes) {
  const parameters: any[] = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: ref("Id"),
  }));
  if (query)
    parameters.push({
      name: query,
      in: "query",
      required: query === "format",
      schema:
        query === "language"
          ? ref("Language")
          : { type: "string", enum: ["json"] },
    });
  if (method !== "get")
    parameters.push(
      {
        name: "Origin",
        in: "header",
        required: true,
        schema: { type: "string" },
      },
      ...(path === "/api/sessions"
        ? []
        : [
            {
              name: "X-CSRF-Token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ]),
    );
  const status =
    out === "empty"
      ? "204"
      : out === "AnalyzeResult"
        ? "202"
        : out === "SessionResult"
          ? "201"
          : "200";
  const responses: any = {
    [status]: {
      description: "Success",
      ...(out === "empty"
        ? {}
        : {
            content: {
              [out === "binary" ? "application/pdf" : "application/json"]: {
                schema:
                  out === "binary"
                    ? { type: "string", format: "binary" }
                    : ref(out),
              },
            },
          }),
    },
  };
  for (const status of [401, 403, 404, 409, 413, 415, 422, 429, 503])
    responses[status] = {
      description: "Consistent API error",
      content: { "application/json": { schema: ref("ApiError") } },
    };
  const op: any = {
    operationId: method + "_" + path.replace(/[^a-zA-Z0-9]/g, "_"),
    parameters,
    responses,
    security:
      path === "/api/config" || path === "/api/sessions"
        ? []
        : [{ guestCookie: [] }],
  };
  if (input)
    op.requestBody = {
      required: true,
      content: {
        [input === "multipart" ? "multipart/form-data" : "application/json"]: {
          schema:
            input === "multipart"
              ? {
                  type: "object",
                  required: ["file", "language"],
                  properties: {
                    file: { type: "string", format: "binary" },
                    language: ref("Language"),
                  },
                }
              : ref(input),
        },
      },
    };
  paths[path] ??= {};
  paths[path][method] = op;
}
paths["/api/sessions"].post.responses["200"] = {
  description: "Existing valid guest session",
  content: { "application/json": { schema: ref("SessionResult") } },
};
fs.writeFileSync(
  "docs/openapi.json",
  JSON.stringify(
    {
      openapi: "3.0.3",
      info: { title: "FormFix AI", version: "1.0" },
      servers: [{ url: "/" }],
      paths,
      components: {
        schemas,
        securitySchemes: {
          guestCookie: { type: "apiKey", in: "cookie", name: "ff_session" },
        },
      },
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  "packages/contracts/schema.json",
  JSON.stringify(
    Object.fromEntries(
      Object.entries(C)
        .filter(([, s]) => s instanceof z.ZodType)
        .map(([n, s]) => [
          n,
          zodToJsonSchema(s as z.ZodType, { $refStrategy: "none" }),
        ]),
    ),
    null,
    2,
  ),
);
console.log("Generated OpenAPI and shared JSON schemas.");
