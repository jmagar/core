import fs from 'fs/promises';
import path from 'path';

export async function copyFile(source: string, destination: string): Promise<void> {
  try {
    await fs.copyFile(source, destination);
  } catch (error: any) {
    throw new Error(`Failed to copy file: ${error.message}`);
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function updateEnvFile(filePath: string, key: string, value: string): Promise<void> {
  try {
    let content = '';
    if (await fileExists(filePath)) {
      content = await fs.readFile(filePath, 'utf8');
    }
    
    const lines = content.split('\n');
    const keyIndex = lines.findIndex(line => line.startsWith(`${key}=`));
    
    if (keyIndex !== -1) {
      lines[keyIndex] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
    
    await fs.writeFile(filePath, lines.join('\n'));
  } catch (error: any) {
    throw new Error(`Failed to update .env file: ${error.message}`);
  }
}