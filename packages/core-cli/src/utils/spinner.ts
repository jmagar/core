import { spinner } from '@clack/prompts';

export function createSpinner(message: string) {
  return spinner();
}

export async function withSpinner<T>(
  message: string,
  task: () => Promise<T>
): Promise<T> {
  const s = spinner();
  s.start(message);
  
  try {
    const result = await task();
    s.stop(message);
    return result;
  } catch (error) {
    s.stop(`${message} - Failed`);
    throw error;
  }
}