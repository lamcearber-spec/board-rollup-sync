// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(() => cleanup());

describe("App", () => {
  it("previews a fixture rollup plan without monday", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Board Rollup Sync" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preview sync" }));

    await waitFor(() => {
      expect(screen.getByText("2 creates")).toBeInTheDocument();
      expect(screen.getByText("0 updates")).toBeInTheDocument();
      expect(screen.getByText("0 skipped")).toBeInTheDocument();
    });
  });
});
