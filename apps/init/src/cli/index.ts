import { Command } from "commander";
import { initCommand } from "../commands/init.js";
import { VERSION } from "./version.js";

const program = new Command();

program.name("core").description("Core CLI - A Command-Line Interface for Core").version(VERSION);

program
  .command("init")
  .description("Initialize Core development environment (run once)")
  .action(initCommand);

program.parse(process.argv);
