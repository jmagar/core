import type { Message } from "esbuild";
export declare const LOGGER_LEVELS: {
    readonly none: -1;
    readonly error: 0;
    readonly warn: 1;
    readonly info: 2;
    readonly log: 3;
    readonly debug: 4;
};
export type LoggerLevel = keyof typeof LOGGER_LEVELS;
export type TableRow<Keys extends string> = Record<Keys, string>;
export declare class Logger {
    constructor();
    loggerLevel: "error" | "none" | "warn" | "info" | "log" | "debug";
    columns: number;
    debug: (...args: unknown[]) => void;
    ignore: (...args: unknown[]) => void;
    debugWithSanitization: (label: string, ...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    log: (...args: unknown[]) => void;
    /** @deprecated **ONLY USE THIS IN THE CLI** - It will hang the process when used in deployed code (!) */
    warn: (...args: unknown[]) => void;
    /** @deprecated **ONLY USE THIS IN THE CLI** - It will hang the process when used in deployed code (!) */
    error: (...args: unknown[]) => void;
    table<Keys extends string>(data: TableRow<Keys>[], level?: Exclude<LoggerLevel, "none">): void;
    private doLog;
    private formatMessage;
}
/**
 * A drop-in replacement for `console` for outputting logging messages.
 *
 * Errors and Warnings will get additional formatting to highlight them to the user.
 * You can also set a `logger.loggerLevel` value to one of "debug", "log", "warn" or "error",
 * to filter out logging messages.
 */
export declare const logger: Logger;
export declare function logBuildWarnings(warnings: Message[]): void;
/**
 * Logs all errors/warnings associated with an esbuild BuildFailure in the same
 * style esbuild would.
 */
export declare function logBuildFailure(errors: Message[], warnings: Message[]): void;
