import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createOpenApiDocument } from "../src/lib/openapi.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../openapi/openapi.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`, "utf8");
console.info(`OpenAPI document written to ${outputPath}`);
