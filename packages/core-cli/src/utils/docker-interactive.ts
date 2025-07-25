import { spawn, ChildProcess } from "child_process";
import { spinner } from "@clack/prompts";

export interface CommandOptions {
  cwd: string;
  message: string;
  showOutput?: boolean;
  env?: Record<string, string>;
}

export function executeCommandInteractive(command: string, options: CommandOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = spinner();
    s.start(options.message);

    // Split command into parts
    const parts = command.split(" ");
    const cmd = parts[0];
    const args = parts.slice(1);

    if (!cmd) {
      reject(new Error("Invalid command"));
      return;
    }

    const child: ChildProcess = spawn(cmd, args, {
      cwd: options.cwd,
      stdio: options.showOutput ? ["ignore", "pipe", "pipe"] : "ignore",
      detached: false,
      env: options.env ? { ...process.env, ...options.env } : { ...process.env },
    });

    let output = "";

    // Handle stdout
    if (child.stdout && options.showOutput) {
      child.stdout.on("data", (data: Buffer) => {
        const text = data.toString();
        output += text;

        // Update spinner with latest output line
        const lines = text.trim().split("\n");
        const lastLine = lines[lines.length - 1];
        if (lastLine && lastLine.trim()) {
          s.message(`${options.message}\n${lastLine.trim()}`);
        }
      });
    }

    // Handle stderr
    if (child.stderr && options.showOutput) {
      child.stderr.on("data", (data: Buffer) => {
        const text = data.toString();
        output += text;
        // console.log(text);

        // Update spinner with error output
        const lines = text.trim().split("\n");
        const lastLine = lines[lines.length - 1];
        if (lastLine && lastLine.trim()) {
          s.message(`${options.message}\n❌ ${lastLine.trim()}`);
        }
      });
    }

    // Handle process exit
    child.on("exit", (code: number | null) => {
      if (code === 0) {
        s.stop(`✅ ${options.message.replace(/\.\.\.$/, "")} completed`);
        resolve();
      } else {
        s.stop(`❌ ${options.message.replace(/\.\.\.$/, "")} failed (exit code: ${code})`);
        if (options.showOutput && output) {
          console.log("\nOutput:");
          console.log(output);
        }
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    // Handle errors
    child.on("error", (error: Error) => {
      s.stop(`❌ ${options.message.replace(/\.\.\.$/, "")} failed`);
      reject(error);
    });

    // Handle Ctrl+C
    const handleSigint = () => {
      s.stop(`⏹️  ${options.message.replace(/\.\.\.$/, "")} interrupted`);
      child.kill("SIGTERM");

      // Give the process time to clean up
      setTimeout(() => {
        if (child.killed === false) {
          child.kill("SIGKILL");
        }
        process.exit(130); // Standard exit code for SIGINT
      }, 5000);
    };

    process.on("SIGINT", handleSigint);

    // Clean up event listener when done
    child.on("exit", () => {
      process.off("SIGINT", handleSigint);
    });
  });
}
