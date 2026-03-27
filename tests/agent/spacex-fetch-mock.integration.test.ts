import { describe, expect, it } from "vitest";

import {
  installSpacexFetchMock,
  SPACEX_MOCK_BASE_URL,
} from "../setup/spacex-fetch-mock";

describe("SpaceX fetch mock (no LLM)", () => {
  installSpacexFetchMock({ mode: "next_launch_ok" });

  it("returns the next-launch fixture for POST /v5/launches/query with upcoming: true", async () => {
    const res = await fetch(`${SPACEX_MOCK_BASE_URL}/v5/launches/query`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { upcoming: true },
        options: {
          limit: 1,
          sort: { date_utc: 1 },
          populate: ["rocket", "launchpad"],
        },
      }),
    });

    expect(res.ok).toBe(true);
    const json = (await res.json()) as {
      docs: Array<{ name?: string }>;
    };
    expect(json.docs[0]?.name).toBe("Fixture Starlink Mission Gamma");
  });

  it("returns the company fixture for GET /v4/company", async () => {
    const res = await fetch(`${SPACEX_MOCK_BASE_URL}/v4/company`);
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { name?: string; headquarters?: { city?: string } };
    expect(json.name).toBe("SpaceX");
    expect(json.headquarters?.city).toBe("Hawthorne");
  });

  it("returns the roadster fixture for GET /v4/roadster", async () => {
    const res = await fetch(`${SPACEX_MOCK_BASE_URL}/v4/roadster`);
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { name?: string };
    expect(json.name).toContain("Roadster");
  });

  it("returns the latest launch fixture for GET /v5/launches/latest", async () => {
    const res = await fetch(`${SPACEX_MOCK_BASE_URL}/v5/launches/latest`);
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { name?: string };
    expect(json.name).toBe("Fixture Latest Mission");
  });
});

describe("SpaceX fetch mock HTTP error", () => {
  installSpacexFetchMock({ mode: "post_launches_query_500" });

  it("returns 500 for POST /v5/launches/query", async () => {
    const res = await fetch(`${SPACEX_MOCK_BASE_URL}/v5/launches/query`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { upcoming: true },
        options: { limit: 1, sort: { date_utc: 1 } },
      }),
    });

    expect(res.status).toBe(500);
  });
});
