import { intro, outro, note, log, confirm } from "@clack/prompts";
import { executeCommandInteractive } from "../utils/docker-interactive.js";
import { printCoreBrainLogo } from "../utils/ascii.js";
import path from "path";

export async function startCommand() {
  // Display the CORE brain logo
  printCoreBrainLogo();

  intro("🚀 Starting Core Development Environment");

  // Step 1: Confirm this is the Core repository
  const isCoreRepo = await confirm({
    message: "Are you currently in the Core repository directory?",
  });

  if (!isCoreRepo) {
    note(
      'Please navigate to the Core repository first:\n\ngit clone https://github.com/redplanethq/core.git\ncd core\n\nThen run "core start" again.',
      "📥 Core Repository Required"
    );
    outro("❌ Please navigate to the Core repository first.");
    process.exit(1);
  }

  const rootDir = process.cwd();
  const triggerDir = path.join(rootDir, "trigger");

  try {
    // Start main services
    await executeCommandInteractive("docker compose up -d", {
      cwd: rootDir,
      message: "Starting Core services...",
      showOutput: true,
    });

    // Start trigger services
    await executeCommandInteractive("docker compose up -d", {
      cwd: triggerDir,
      message: "Starting Trigger.dev services...",
      showOutput: true,
    });

    // Final success message
    outro("🎉 Core Development Environment Started!");
    note(
      "• Core Application: http://localhost:3033\n• Trigger.dev: http://localhost:8030\n• PostgreSQL: localhost:5432",
      "🌐 Your services are now running"
    );
    log.success("Happy coding!");
  } catch (error: any) {
    outro(`❌ Failed to start services: ${error.message}`);
    process.exit(1);
  }
}
