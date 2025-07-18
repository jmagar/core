import { intro, outro, log, confirm, note } from '@clack/prompts';
import { isValidCoreRepo } from '../utils/git.js';
import { executeDockerCommandInteractive } from '../utils/docker-interactive.js';
import { printCoreBrainLogo } from '../utils/ascii.js';
import path from 'path';

export async function stopCommand() {
  // Display the CORE brain logo
  printCoreBrainLogo();
  
  intro('🛑 Stopping Core Development Environment');

  // Step 1: Validate repository
  if (!isValidCoreRepo()) {
    log.warning('This directory is not a Core repository');
    note('The Core repository is required to stop the development environment.\nWould you like to clone it in the current directory?', '🔍 Repository Not Found');
    
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
      note('You can now run "core stop" to stop the development environment.', '✅ Repository Ready');
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
    // Stop trigger services first
    await executeDockerCommandInteractive('docker compose down', {
      cwd: triggerDir,
      message: 'Stopping Trigger.dev services...',
      showOutput: true
    });

    // Stop main services
    await executeDockerCommandInteractive('docker compose down', {
      cwd: rootDir,
      message: 'Stopping Core services...',
      showOutput: true
    });

    // Final success message
    outro('🎉 Core Development Environment Stopped!');
    log.success('All services have been stopped.');
    log.info('Run "core start" to start services again.');

  } catch (error: any) {
    outro(`❌ Failed to stop services: ${error.message}`);
    process.exit(1);
  }
}