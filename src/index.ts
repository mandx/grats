import * as ts from "typescript";
import { ParsedCommandLineGrats, validateGratsOptions } from "./lib";
import {
  ReportableDiagnostics,
  Result,
  err,
  ok,
} from "./utils/DiagnosticError";

export { printSDLWithoutDirectives } from "./printSchema";
export * from "./Types";
export * from "./lib";
// Used by the experimental TypeScript plugin
export { extract } from "./Extractor";
export { codegen } from "./codegen";

// #FIXME: Report diagnostics instead of throwing!
export function getParsedTsConfig(
  configFile: string,
): Result<ParsedCommandLineGrats, ReportableDiagnostics> {
  if (!configFile) {
    throw new Error("Grats: Could not find tsconfig.json");
  }

  // https://github.com/microsoft/TypeScript/blob/46d70d79cd0dd00d19e4c617d6ebb25e9f3fc7de/src/compiler/watch.ts#L216
  const configFileHost: ts.ParseConfigFileHost = ts.sys as any;
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configFile,
    undefined,
    configFileHost,
  );

  if (!parsed) {
    throw new Error("Grats: Could not locate tsconfig.json");
  }

  if (parsed.errors.length > 0) {
    return err(ReportableDiagnostics.fromDiagnostics(parsed.errors));
  }

  return ok(validateGratsOptions(parsed));
}
