import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, vi } from "vitest";

/** Fixed origin so tests never hit the real SpaceX API; only this origin is mocked. */
export const SPACEX_MOCK_BASE_URL = "http://spacex.test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixturePath(name: string): string {
  return path.join(__dirname, "../fixtures/spacex", name);
}

function readJsonFixture(name: string): unknown {
  const raw = readFileSync(fixturePath(name), "utf8");
  return JSON.parse(raw) as unknown;
}

export type SpacexFetchMockMode =
  | { mode: "next_launch_ok" }
  | { mode: "post_launches_query_500" };

/**
 * Stubs `global.fetch` for URLs under {@link SPACEX_MOCK_BASE_URL} and sets
 * `process.env.SPACEX_API_BASE_URL` for the duration of the test.
 * OpenRouter and other HTTPS calls pass through to the original `fetch`.
 */
export function installSpacexFetchMock(config: SpacexFetchMockMode) {
  const originalFetch = globalThis.fetch.bind(globalThis);

  beforeEach(() => {
    process.env.SPACEX_API_BASE_URL = SPACEX_MOCK_BASE_URL;

    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;

        if (!url.startsWith(SPACEX_MOCK_BASE_URL)) {
          return originalFetch(input, init);
        }

        const pathname = new URL(url).pathname;

        if (config.mode === "post_launches_query_500") {
          if (pathname === "/v5/launches/query") {
            return new Response("Internal Server Error", { status: 500 });
          }
        }

        if (config.mode === "next_launch_ok") {
          const method = init?.method ?? "GET";

          if (pathname === "/v4/company" && method === "GET") {
            const payload = readJsonFixture("company.json");
            return new Response(JSON.stringify(payload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (pathname === "/v4/roadster" && method === "GET") {
            const payload = readJsonFixture("roadster.json");
            return new Response(JSON.stringify(payload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (pathname === "/v5/launches/latest" && method === "GET") {
            const payload = readJsonFixture("latest-launch.json");
            return new Response(JSON.stringify(payload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (pathname === "/v5/launches/query" && method === "POST") {
            const body = init?.body ? JSON.parse(String(init.body)) : {};
            const query = body.query as Record<string, unknown> | undefined;
            if (query?.upcoming === true) {
              const payload = readJsonFixture("next-launch-query-response.json");
              return new Response(JSON.stringify(payload), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
          }
        }

        return new Response(
          JSON.stringify({ error: true, message: `Unhandled mock: ${pathname}` }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SPACEX_API_BASE_URL;
  });
}
