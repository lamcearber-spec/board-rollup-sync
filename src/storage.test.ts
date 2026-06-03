import { describe, expect, it } from "vitest";
import { loadJson, saveJson } from "./storage";

describe("storage helpers", () => {
  it("returns a fallback when storage has no value", async () => {
    const storage = {
      async getItem() {
        return { data: { value: null } };
      },
      async setItem() {
        throw new Error("should not save");
      }
    };

    await expect(loadJson(storage, "missing", { enabled: false })).resolves.toEqual({ enabled: false });
  });

  it("parses string values and saves JSON strings", async () => {
    const writes: unknown[] = [];
    const storage = {
      async getItem() {
        return { data: { value: "{\"enabled\":true}" } };
      },
      async setItem(_key: string, value: unknown) {
        writes.push(value);
        return { data: { value } };
      }
    };

    await expect(loadJson(storage, "config", { enabled: false })).resolves.toEqual({ enabled: true });
    await saveJson(storage, "config", { enabled: true });
    expect(writes).toEqual(["{\"enabled\":true}"]);
  });
});
