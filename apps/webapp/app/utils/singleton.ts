export function singleton<T>(name: string, getValue: () => T): T {
  const thusly = globalThis as any;
  thusly.__recall_singletons ??= {};
  thusly.__recall_singletons[name] ??= getValue();
  return thusly.__recall_singletons[name];
}
