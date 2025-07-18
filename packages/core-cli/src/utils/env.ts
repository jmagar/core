import path from 'path';
import { fileExists, copyFile } from './file.js';

export async function setupEnvFile(directory: string, name: string = 'root'): Promise<void> {
  const envExamplePath = path.join(directory, '.env.example');
  const envPath = path.join(directory, '.env');
  
  if (!(await fileExists(envExamplePath))) {
    throw new Error(`❌ .env.example not found in ${name} directory`);
  }
  
  if (await fileExists(envPath)) {
    return; // .env already exists, skip copying
  }
  
  await copyFile(envExamplePath, envPath);
}