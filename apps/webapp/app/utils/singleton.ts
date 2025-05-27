export function singleton<T>(name: string, getValue: () => T): T {
  const thusly = globalThis as any;
  thusly.__echo_singletons ??= {};
  thusly.__echo_singletons[name] ??= getValue();
  return thusly.__echo_singletons[name];
}
