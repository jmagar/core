export function singleton<T>(name: string, getValue: () => T): T {
  const thusly = globalThis as any;
  thusly.__core_singletons ??= {};
  thusly.__core_singletons[name] ??= getValue();
  return thusly.__core_singletons[name];
}
