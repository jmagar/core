import { intro, outro, log, note } from "@clack/prompts";
import { executeCommandInteractive } from "../utils/docker-interactive.js";
import { printCoreBrainLogo } from "../utils/ascii.js";
import path from "path";
import * as fs from "fs";

export async function stopCommand() {
  // Display the CORE brain logo
  printCoreBrainLogo();

  intro("🛑 Stopping Core Development Environment");

  // Step 1: Confirm this is the Core repository
  // Check if package.json name has "core" in it, else exit
  const pkgPath = path.join(process.cwd(), "package.json");
  let isCoreRepo = false;
  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (typeof pkg.name === "string" && pkg.name.includes("core")) {
        isCoreRepo = true;
      }
    }
  } catch (err) {
    // ignore, will prompt below
  }
  if (!isCoreRepo) {
    note(
      'Please navigate to the Core repository first:\n\ngit clone https://github.com/redplanethq/core.git\ncd core\n\nThen run "core stop" again.',
      "📥 Core Repository Required"
    );
    outro("❌ Please navigate to the Core repository first.");
    process.exit(1);
  }

  const rootDir = process.cwd();
  const triggerDir = path.join(rootDir, "trigger");

  try {
    // Stop trigger services first
    await executeCommandInteractive("docker compose down", {
      cwd: triggerDir,
      message: "Stopping Trigger.dev services...",
      showOutput: true,
    });

    // Stop main services
    await executeCommandInteractive("docker compose down", {
      cwd: rootDir,
      message: "Stopping Core services...",
      showOutput: true,
    });

    // Final success message
    outro("🎉 Core Development Environment Stopped!");
    log.success("All services have been stopped.");
    log.info('Run "core start" to start services again.');
  } catch (error: any) {
    outro(`❌ Failed to stop services: ${error.message}`);
    process.exit(1);
  }
}
