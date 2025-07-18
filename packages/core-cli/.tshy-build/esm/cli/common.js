import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { logger } from "../utils/logger.js";
import { outro } from "@clack/prompts";
import { chalkError } from "../utils/cliOutput.js";
export const CommonCommandOptions = z.object({
    logLevel: z.enum(["debug", "info", "log", "warn", "error", "none"]).default("log"),
});
export function commonOptions(command) {
    return command.option("-l, --log-level <level>", "The CLI log level to use (debug, info, log, warn, error, none).", "log");
}
export class SkipLoggingError extends Error {
}
export class SkipCommandError extends Error {
}
export class OutroCommandError extends SkipCommandError {
}
export async function wrapCommandAction(name, schema, options, action) {
    try {
        const parsedOptions = schema.safeParse(options);
        if (!parsedOptions.success) {
            throw new Error(fromZodError(parsedOptions.error).toString());
        }
        logger.loggerLevel = parsedOptions.data.logLevel;
        logger.debug(`Running "${name}" with the following options`, {
            options: options,
        });
        const result = await action(parsedOptions.data);
        return result;
    }
    catch (e) {
        if (e instanceof SkipLoggingError) {
        }
        else if (e instanceof OutroCommandError) {
            outro("Operation cancelled");
        }
        else if (e instanceof SkipCommandError) {
            // do nothing
        }
        else {
            logger.log(`${chalkError("X Error:")} ${e instanceof Error ? e.message : String(e)}`);
        }
        throw e;
    }
}
export function installExitHandler() {
    process.on("SIGINT", () => {
        process.exit(0);
    });
    process.on("SIGTERM", () => {
        process.exit(0);
    });
}
//# sourceMappingURL=common.js.map