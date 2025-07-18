import { Command } from "commander";
import { initCommand } from "../commands/init.js";
import { startCommand } from "../commands/start.js";
import { stopCommand } from "../commands/stop.js";

const program = new Command();

program.name("core").description("Core CLI - A Command-Line Interface for Core").version("0.1.0");

program
  .command("init")
  .description("Initialize Core development environment (run once)")
  .action(initCommand);

program
  .command("start")
  .description("Start Core development environment")
  .action(startCommand);

program
  .command("stop")
  .description("Stop Core development environment")
  .action(stopCommand);

program.parse(process.argv);
