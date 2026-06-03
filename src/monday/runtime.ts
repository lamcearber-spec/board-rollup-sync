import mondaySdk from "monday-sdk-js";
import type { MondayApi } from "./client";
import type { MondayStorageLike } from "../storage";

export type MondayRuntime = {
  api: MondayApi;
  get(key: "context"): Promise<{ data: Record<string, unknown> }>;
  storage: {
    instance: MondayStorageLike;
  };
};

export function isEmbeddedInMonday(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function createMondayRuntime(): MondayRuntime {
  return mondaySdk() as MondayRuntime;
}
