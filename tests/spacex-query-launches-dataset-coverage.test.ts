import { afterEach, describe, expect, it, vi } from "vitest";

import { spacexTools } from "@/lib/ai/tools/spacex";
import * as spacexClient from "@/lib/spacex/client";
import type { QueryBody } from "@/lib/spacex/types";

function emptyPage() {
  return {
    docs: [] as unknown[],
    totalDocs: 0,
    limit: 20,
    totalPages: 0,
    page: 1,
    hasPrevPage: false,
    hasNextPage: false,
    prevPage: null,
    nextPage: null,
  };
}

describe("spacex_query_launches datasetCoverage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds datasetCoverage when empty date-only past query and range starts after latest completed launch", async () => {
    vi.spyOn(spacexClient, "queryLaunches").mockImplementation(async (body: QueryBody) => {
      const q = body.query as Record<string, unknown>;
      if (q.date_utc) {
        return emptyPage();
      }
      if (q.upcoming === false && !q.date_utc) {
        return {
          docs: [{ date_utc: "2022-12-31T00:00:00.000Z" }],
          totalDocs: 1,
          limit: 1,
          totalPages: 1,
          page: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        };
      }
      return emptyPage();
    });

    const tool = spacexTools.spacex_query_launches as {
      execute: (input: Record<string, unknown>) => Promise<string>;
    };
    const out = await tool.execute({
      dateUtcGte: "2024-01-01T00:00:00.000Z",
      dateUtcLte: "2024-12-31T23:59:59.999Z",
      upcoming: false,
      sortBy: "date_utc",
      sortOrder: "desc",
      limit: 20,
      populateRocketAndLaunchpad: true,
    });

    const parsed = JSON.parse(out) as {
      datasetCoverage?: {
        latestCompletedLaunchDateUtc: string;
        requestedRangeStartsAfterLatestInDataset: boolean;
      };
    };
    expect(parsed.datasetCoverage?.requestedRangeStartsAfterLatestInDataset).toBe(true);
    expect(parsed.datasetCoverage?.latestCompletedLaunchDateUtc).toBe(
      "2022-12-31T00:00:00.000Z",
    );
  });

  it("does not add datasetCoverage when success filter is set (non-date-only query)", async () => {
    vi.spyOn(spacexClient, "queryLaunches").mockImplementation(async (body: QueryBody) => {
      const q = body.query as Record<string, unknown>;
      if (q.date_utc && q.success === true) {
        return emptyPage();
      }
      if (q.upcoming === false && !q.date_utc) {
        return {
          docs: [{ date_utc: "2022-12-31T00:00:00.000Z" }],
          totalDocs: 1,
          limit: 1,
          totalPages: 1,
          page: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        };
      }
      return emptyPage();
    });

    const tool = spacexTools.spacex_query_launches as {
      execute: (input: Record<string, unknown>) => Promise<string>;
    };
    const out = await tool.execute({
      dateUtcGte: "2024-01-01T00:00:00.000Z",
      dateUtcLte: "2024-12-31T23:59:59.999Z",
      upcoming: false,
      success: true,
      sortBy: "date_utc",
      sortOrder: "desc",
      limit: 20,
      populateRocketAndLaunchpad: true,
    });

    const parsed = JSON.parse(out) as { datasetCoverage?: unknown };
    expect(parsed.datasetCoverage).toBeUndefined();
  });
});
