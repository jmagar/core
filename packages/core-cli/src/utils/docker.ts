import { execSync } from 'child_process';

export function checkPostgresHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const result = execSync('curl -f http://localhost:5432 || nc -z localhost 5432', { 
        encoding: 'utf8',
        timeout: 5000 
      });
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

export function executeDockerCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const result = execSync(command, { 
        cwd,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      resolve(result);
    } catch (error: any) {
      reject(new Error(`Docker command failed: ${error.message}`));
    }
  });
}