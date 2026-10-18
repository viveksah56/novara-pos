import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const config = JSON.parse(await readFile(path.join(root, "shared/system-constants.json"), "utf8"));
const enumNames = Object.keys(config.enums);
const constantSets = { ...config.enums, ...config.choiceSets };
const toConstant = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase() + "_VALUES";
const toCamel = (name) => name[0].toLowerCase() + name.slice(1);
const toType = (name) => name;
const quote = (value) => JSON.stringify(value);

function validateConfig() {
  const businessRoles = config.enums.BusinessRole;
  if (Object.keys(config.roleCapabilities).length !== businessRoles.length || businessRoles.some((role) => !(role in config.roleCapabilities))) {
    throw new Error("roleCapabilities must contain exactly one entry per BusinessRole.");
  }
  for (const [domain, mapping] of Object.entries(config.presentation.badges)) {
    const values = config.enums[domain];
    if (!values || values.length !== Object.keys(mapping).length || values.some((value) => !(value in mapping))) {
      throw new Error(`Badge configuration must cover every value of ${domain}.`);
    }
  }
  for (const [domain, mapping] of [["MeasureUnit", config.presentation.units], ["PaymentMethod", config.presentation.paymentMethods]]) {
    const values = config.enums[domain];
    if (values.length !== Object.keys(mapping).length || values.some((value) => !(value in mapping))) {
      throw new Error(`Presentation configuration must cover every value of ${domain}.`);
    }
  }
}

function renderBackend() {
  const lines = ["// Generated from shared/system-constants.json. Do not edit by hand.", 'import { z } from "zod";', ""];
  for (const name of Object.keys(constantSets)) {
    const constant = toConstant(name);
    lines.push(`export const ${constant} = ${JSON.stringify(constantSets[name])} as const;`);
    lines.push(`export type ${toType(name)} = (typeof ${constant})[number];`);
    lines.push(`export const ${toCamel(name)}Schema = z.enum(${constant});`, "");
  }
  lines.push(`export const APP_ROLES = [...BUSINESS_ROLE_VALUES, "PLATFORM_ADMIN"] as const;`);
  lines.push("export type AppRole = (typeof APP_ROLES)[number];");
  lines.push("export const appRoleSchema = z.enum(APP_ROLES);", "");
  lines.push(`export const CAPABILITIES = ${JSON.stringify(config.capabilities)} as const;`);
  lines.push("export type Capability = (typeof CAPABILITIES)[number];");
  lines.push(`export const BUSINESS_ROLE_CAPABILITIES = ${JSON.stringify(config.roleCapabilities, null, 2)} as const satisfies Record<BusinessRole, readonly Capability[]>;`);
  return `${lines.join("\n")}\n`;
}

function renderFrontend() {
  const lines = ["// Generated from shared/system-constants.json. Do not edit by hand.", ""];
  for (const name of Object.keys(constantSets)) {
    const constant = toConstant(name);
    lines.push(`export const ${constant} = ${JSON.stringify(constantSets[name])} as const;`);
    lines.push(`export type ${toType(name)} = (typeof ${constant})[number];`, "");
  }
  lines.push(`export const APP_ROLES = [...BUSINESS_ROLE_VALUES, "PLATFORM_ADMIN"] as const;`);
  lines.push("export type AppRole = (typeof APP_ROLES)[number];", "");
  lines.push(`export const CAPABILITIES = ${JSON.stringify(config.capabilities)} as const;`);
  lines.push("export type Capability = (typeof CAPABILITIES)[number];", "");
  lines.push(`export const BUSINESS_ROLE_CAPABILITIES = ${JSON.stringify(config.roleCapabilities, null, 2)} as const satisfies Record<BusinessRole, readonly Capability[]>;`, "");
  lines.push('export type StatusTone = "positive" | "warning" | "danger" | "info" | "neutral";');
  lines.push("export interface StatusPresentation { readonly label: string; readonly tone: StatusTone; readonly description: string }");
  lines.push("export const STATUS_PRESENTATION = {");
  for (const [domain, entries] of Object.entries(config.presentation.badges)) {
    const constant = toConstant(domain);
    lines.push(`  ${domain}: {`);
    for (const [value, [label, tone, description]] of Object.entries(entries)) {
      lines.push(`    ${value}: { label: ${quote(label)}, tone: ${quote(tone)}, description: ${quote(description)} },`);
    }
    lines.push(`  } satisfies Record<(typeof ${constant})[number], StatusPresentation>,`);
  }
  lines.push("} as const;", "");
  lines.push("export type StatusDomain = keyof typeof STATUS_PRESENTATION;");
  lines.push("export type StatusFor<Domain extends StatusDomain> = keyof (typeof STATUS_PRESENTATION)[Domain];");
  lines.push("export function getStatusPresentation<Domain extends StatusDomain>(domain: Domain, status: StatusFor<Domain>): StatusPresentation {");
  lines.push("  return STATUS_PRESENTATION[domain][status] as StatusPresentation;", "}", "");
  lines.push("export const UNIT_PRESENTATION = {");
  for (const [unit, [label, abbreviation]] of Object.entries(config.presentation.units)) lines.push(`  ${unit}: { label: ${quote(label)}, abbreviation: ${quote(abbreviation)} },`);
  lines.push("} as const satisfies Record<MeasureUnit, { label: string; abbreviation: string }>;");
  lines.push("export const PAYMENT_METHOD_LABELS = {");
  for (const [method, label] of Object.entries(config.presentation.paymentMethods)) lines.push(`  ${method}: ${quote(label)},`);
  lines.push("} as const satisfies Record<PaymentMethod, string>;", "");
  return `${lines.join("\n")}\n`;
}

async function syncPrismaEnums() {
  const enumFiles = new Map([
    ["BusinessRole", "backend/prisma/schema/membership.prisma"],
    ["PlatformRole", "backend/prisma/schema/platform-staff.prisma"],
    ["TenantStatus", "backend/prisma/schema/tenant.prisma"],
    ["SubscriptionStatus", "backend/prisma/schema/subscription.prisma"],
    ["MeasureUnit", "backend/prisma/schema/operations.prisma"],
    ["PurchaseStatus", "backend/prisma/schema/operations.prisma"],
    ["StocktakeStatus", "backend/prisma/schema/operations.prisma"],
    ["StockMovementType", "backend/prisma/schema/operations.prisma"],
    ["SalesOrderStatus", "backend/prisma/schema/operations.prisma"],
    ["KitchenOrderStatus", "backend/prisma/schema/operations.prisma"],
    ["KitchenItemStatus", "backend/prisma/schema/operations.prisma"],
    ["PaymentMethod", "backend/prisma/schema/operations.prisma"],
    ["ShiftStatus", "backend/prisma/schema/operations.prisma"],
    ["CashMovementType", "backend/prisma/schema/expense.prisma"],
    ["PlatformTicketType", "backend/prisma/schema/platform-ticket.prisma"],
    ["PlatformTicketStatus", "backend/prisma/schema/platform-ticket.prisma"],
    ["PlatformTicketPriority", "backend/prisma/schema/platform-ticket.prisma"],
  ]);
  for (const name of enumNames) if (!enumFiles.has(name)) throw new Error(`No Prisma enum target is configured for ${name}.`);
  const grouped = new Map();
  for (const [name, file] of enumFiles) grouped.set(file, [...(grouped.get(file) ?? []), name]);
  for (const [file, names] of grouped) {
    const fullPath = path.join(root, file);
    let source = await readFile(fullPath, "utf8");
    for (const name of names) {
      const expression = new RegExp(`enum\\s+${name}\\s*\\{[^}]*\\}`, "m");
      if (!expression.test(source)) throw new Error(`Prisma enum ${name} was not found in ${file}.`);
      source = source.replace(expression, `enum ${name} {\n${config.enums[name].map((value) => `  ${value}`).join("\n")}\n}`);
    }
    await writeFile(fullPath, source);
  }
}

validateConfig();
await mkdir(path.join(root, "backend/src/constants"), { recursive: true });
await mkdir(path.join(root, "frontend/src/constants"), { recursive: true });
await writeFile(path.join(root, "backend/src/constants/system-constants.ts"), renderBackend());
await writeFile(path.join(root, "frontend/src/constants/system-constants.ts"), renderFrontend());
await syncPrismaEnums();
console.log(`Synchronized ${enumNames.length} system domains across backend, frontend, and Prisma.`);
