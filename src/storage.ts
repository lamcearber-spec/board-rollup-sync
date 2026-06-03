export type MondayStorageLike = {
  getItem(key: string): Promise<{ data?: { value?: unknown } }>;
  setItem(key: string, value: string): Promise<unknown>;
};

export async function loadJson<T>(storage: MondayStorageLike, key: string, fallback: T): Promise<T> {
  const response = await storage.getItem(key);
  const value = response.data?.value;
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
}

export async function saveJson<T>(storage: MondayStorageLike, key: string, value: T): Promise<void> {
  await storage.setItem(key, JSON.stringify(value));
}
