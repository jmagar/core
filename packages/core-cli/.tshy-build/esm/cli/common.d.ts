import { Command } from "commander";
import { z } from "zod";
export declare const CommonCommandOptions: z.ZodObject<{
    logLevel: z.ZodDefault<z.ZodEnum<["debug", "info", "log", "warn", "error", "none"]>>;
}, "strip", z.ZodTypeAny, {
    logLevel: "error" | "none" | "warn" | "info" | "log" | "debug";
}, {
    logLevel?: "error" | "none" | "warn" | "info" | "log" | "debug" | undefined;
}>;
export type CommonCommandOptions = z.infer<typeof CommonCommandOptions>;
export declare function commonOptions(command: Command): Command;
export declare class SkipLoggingError extends Error {
}
export declare class SkipCommandError extends Error {
}
export declare class OutroCommandError extends SkipCommandError {
}
export declare function wrapCommandAction<T extends z.AnyZodObject, TResult>(name: string, schema: T, options: unknown, action: (opts: z.output<T>) => Promise<TResult>): Promise<TResult | undefined>;
export declare function installExitHandler(): void;
