import fs from 'fs/promises';

export async function checkEnvValue(filePath: string, key: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const line = lines.find(l => l.startsWith(`${key}=`));
    if (line) {
      const value = line.split('=')[1]?.trim();
      return value && value.length > 0 ? value : null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function hasTriggerConfig(envPath: string): Promise<boolean> {
  const projectId = await checkEnvValue(envPath, 'TRIGGER_PROJECT_ID');
  const secretKey = await checkEnvValue(envPath, 'TRIGGER_SECRET_KEY');
  
  return !!(projectId && secretKey);
}