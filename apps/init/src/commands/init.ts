import { intro, outro, note } from "@clack/prompts";
import { printCoreBrainLogo } from "../utils/ascii.js";
import { initTriggerDatabase, updateWorkerImage } from "../utils/trigger.js";

export async function initCommand() {
  // Display the CORE brain logo
  printCoreBrainLogo();

  intro("🚀 Core Development Environment Setup");

  try {
    await initTriggerDatabase();
    await updateWorkerImage();

    note(
      [
        "Your services will start running:",
        "",
        "• Core Application: http://localhost:3033",
        "• Trigger.dev: http://localhost:8030",
        "• PostgreSQL: localhost:5432",
        "",
        "You can now start developing with Core!",
        "",
        "ℹ️  When logging in to the Core Application, you can find the login URL in the Docker container logs:",
        "    docker logs core-app --tail 50",
      ].join("\n"),
      "🚀 Services Running"
    );
    outro("🎉 Setup Complete!");
    process.exit(0);
  } catch (error: any) {
    outro(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}
