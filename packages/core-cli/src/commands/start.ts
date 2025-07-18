import { intro, outro, note, log, confirm } from '@clack/prompts';
import { isValidCoreRepo } from '../utils/git.js';
import { executeDockerCommandInteractive } from '../utils/docker-interactive.js';
import { printCoreBrainLogo } from '../utils/ascii.js';
import path from 'path';

export async function startCommand() {
  // Display the CORE brain logo
  printCoreBrainLogo();
  
  intro('🚀 Starting Core Development Environment');

  // Step 1: Validate repository
  if (!isValidCoreRepo()) {
    log.warning('This directory is not a Core repository');
    note('The Core repository is required to run the development environment.\nWould you like to clone it in the current directory?', '🔍 Repository Not Found');
    
    const shouldClone = await confirm({
      message: 'Clone the Core repository here?',
    });

    if (!shouldClone) {
      outro('❌ Setup cancelled. Please navigate to the Core repository or clone it first.');
      process.exit(1);
    }

    // Clone the repository
    try {
      await executeDockerCommandInteractive('git clone https://github.com/redplanethq/core.git .', {
        cwd: process.cwd(),
        message: 'Cloning Core repository...',
        showOutput: true
      });
      
      log.success('Core repository cloned successfully!');
      note('You can now run "core start" to start the development environment.', '✅ Repository Ready');
      outro('🎉 Core repository is now available!');
      process.exit(0);
    } catch (error: any) {
      outro(`❌ Failed to clone repository: ${error.message}`);
      process.exit(1);
    }
  }

  const rootDir = process.cwd();
  const triggerDir = path.join(rootDir, 'trigger');

  try {
    // Start main services
    await executeDockerCommandInteractive('docker compose up -d', {
      cwd: rootDir,
      message: 'Starting Core services...',
      showOutput: true
    });

    // Start trigger services
    await executeDockerCommandInteractive('docker compose up -d', {
      cwd: triggerDir,
      message: 'Starting Trigger.dev services...',
      showOutput: true
    });

    // Final success message
    outro('🎉 Core Development Environment Started!');
    note('• Core Application: http://localhost:3033\n• Trigger.dev: http://localhost:8030\n• PostgreSQL: localhost:5432', '🌐 Your services are now running');
    log.success('Happy coding!');

  } catch (error: any) {
    outro(`❌ Failed to start services: ${error.message}`);
    process.exit(1);
  }
}