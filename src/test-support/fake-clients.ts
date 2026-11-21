/* eslint-disable @typescript-eslint/no-explicit-any */
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Mock, vi } from "vitest";

import { OpenLibraryClients } from "../utils/http.js";

import { axiosErrorWithStatus } from "./axios-error.js";

export function fakeClients(routes: Record<string, unknown>): {
  clients: OpenLibraryClients;
  get: Mock;
} {
  const get = vi.fn(async (url: string) => {
    if (!(url in routes)) {
      throw axiosErrorWithStatus(404, "Not Found");
    }
    const route = routes[url];
    if (route instanceof Error) {
      throw route;
    }
    return { data: route };
  });

  const clients = {
    api: { get },
    covers: { head: vi.fn() },
  } as unknown as OpenLibraryClients;

  return { clients, get };
}

export function jsonBody(result: CallToolResult): any {
  const [first] = result.content;
  if (first?.type !== "text") {
    throw new Error("Expected a text result");
  }
  return JSON.parse(first.text);
}
