import "server-only";

import { tool, zodSchema } from "ai";
import { z } from "zod";

import {
  formatSpacexError,
  getCompany,
  getLaunchSnapshot,
  getLaunchWithPopulate,
  queryLaunchpads,
  queryLaunches,
  queryRockets,
} from "@/lib/spacex/client";
import type { QueryBody } from "@/lib/spacex/types";

const snapshotKindSchema = z.enum(["latest", "next", "upcoming", "past"]);

const sortFieldSchema = z.enum(["date_utc", "flight_number"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

function buildSort(
  sortBy: z.infer<typeof sortFieldSchema>,
  order: z.infer<typeof sortOrderSchema>,
): Record<string, 1 | -1> {
  const dir = order === "asc" ? 1 : -1;
  return { [sortBy]: dir };
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const spacexTools = {
  spacex_get_launch_snapshot: tool({
    description:
      "Get a quick snapshot of launches: latest completed launch, next scheduled (upcoming) launch—not earliest historical mission, all upcoming launches, or past launches (past is a long list—prefer spacex_query_launches for filters). Optionally enrich one launch with rocket and launchpad details by id.",
    inputSchema: zodSchema(
      z.object({
        snapshot: snapshotKindSchema.describe(
          "latest = most recent completed launch; next = soonest scheduled upcoming launch (not oldest past); upcoming = all upcoming; past = historical list (large)",
        ),
        populateLaunchId: z
          .string()
          .optional()
          .describe(
            "If set, returns a single launch (by SpaceX API id) with rocket and launchpad populated—use after latest/next to resolve 'where' or vehicle name.",
          ),
      }),
    ),
    execute: async ({ snapshot, populateLaunchId }) => {
      try {
        if (populateLaunchId) {
          const enriched = await getLaunchWithPopulate(populateLaunchId);
          return JSON.stringify({ populateLaunchId, launch: enriched });
        }
        const data = await getLaunchSnapshot(snapshot);
        return JSON.stringify({ snapshot, data });
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_query_launches: tool({
    description:
      "Search and filter launches (dates, success, rocket, launchpad, mission name). Sort semantics: soonest upcoming launch → upcoming: true, sortOrder: asc; most recent completed → upcoming: false, sortOrder: desc. upcoming: false with sortOrder: asc lists oldest missions first (misleading for “next launch”). Results are paginated; large lists are truncated. Use spacex_resolve_rocket or spacex_resolve_launchpad first when you only have a vehicle or site name.",
    inputSchema: zodSchema(
      z.object({
        dateUtcGte: z
          .string()
          .optional()
          .describe("ISO date lower bound for date_utc, e.g. 2024-01-01T00:00:00.000Z"),
        dateUtcLte: z
          .string()
          .optional()
          .describe("ISO date upper bound for date_utc"),
        upcoming: z
          .boolean()
          .optional()
          .describe(
            "true = scheduled/not yet flown; false = flown. For ‘next’ launch use true with sortOrder asc, not false with asc (that orders oldest past launches).",
          ),
        success: z.boolean().optional().describe("Launch success when not upcoming"),
        rocketId: z.string().optional().describe("Rocket document id from spacex_resolve_rocket"),
        launchpadId: z
          .string()
          .optional()
          .describe("Launchpad id from spacex_resolve_launchpad"),
        missionNameContains: z
          .string()
          .optional()
          .describe(
            "Literal substring for mission name (e.g. Starlink 9-1), case-insensitive",
          ),
        useFullTextSearch: z
          .boolean()
          .optional()
          .describe("Use Mongo $text search on mission name / indexed fields when true"),
        fullTextQuery: z.string().optional().describe("Search string when useFullTextSearch is true"),
        sortBy: sortFieldSchema.optional().default("date_utc"),
        sortOrder: sortOrderSchema
          .optional()
          .default("desc")
          .describe(
            "With upcoming: true and date_utc, asc = soonest first; desc = furthest first. With upcoming: false and date_utc, desc = most recent past; asc = oldest past (not ‘next launch’).",
          ),
        limit: z.number().int().min(1).max(50).optional().default(20),
        page: z.number().int().min(1).optional(),
        populateRocketAndLaunchpad: z.boolean().optional().default(true),
      }),
    ),
    execute: async (input) => {
      try {
        const query: Record<string, unknown> = {};

        if (input.dateUtcGte ?? input.dateUtcLte) {
          const range: Record<string, string> = {};
          if (input.dateUtcGte) range.$gte = input.dateUtcGte;
          if (input.dateUtcLte) range.$lte = input.dateUtcLte;
          query.date_utc = range;
        }

        if (input.upcoming !== undefined) query.upcoming = input.upcoming;
        if (input.success !== undefined) query.success = input.success;
        if (input.rocketId) query.rocket = input.rocketId;
        if (input.launchpadId) query.launchpad = input.launchpadId;

        if (input.useFullTextSearch && input.fullTextQuery) {
          query.$text = { $search: input.fullTextQuery };
        } else if (input.missionNameContains) {
          query.name = {
            $regex: escapeRegexLiteral(input.missionNameContains),
            $options: "i",
          };
        }

        const options: Record<string, unknown> = {
          sort: buildSort(input.sortBy, input.sortOrder),
          limit: input.limit,
          pagination: true,
        };

        if (input.page) options.page = input.page;

        if (input.populateRocketAndLaunchpad) {
          options.populate = ["rocket", "launchpad"];
        }

        const body: QueryBody = { query, options };
        const result = await queryLaunches(body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_resolve_rocket: tool({
    description:
      "Find a rocket document by name (e.g. Falcon 9, Falcon Heavy) to obtain its id for launch queries.",
    inputSchema: zodSchema(
      z.object({
        nameContains: z
          .string()
          .describe("Substring to match against rocket name (case-insensitive)"),
        limit: z.number().int().min(1).max(20).optional().default(5),
      }),
    ),
    execute: async ({ nameContains, limit }) => {
      try {
        const body: QueryBody = {
          query: {
            name: { $regex: escapeRegexLiteral(nameContains), $options: "i" },
          },
          options: { limit, sort: { name: 1 } },
        };
        const result = await queryRockets(body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_resolve_launchpad: tool({
    description:
      "Find launchpads by name, locality, or region (e.g. Vandenberg, Cape Canaveral). Returns ids for spacex_query_launches.",
    inputSchema: zodSchema(
      z.object({
        search: z
          .string()
          .describe(
            "Matches name, full_name, locality, or region (case-insensitive substring)",
          ),
        limit: z.number().int().min(1).max(20).optional().default(10),
      }),
    ),
    execute: async ({ search, limit }) => {
      try {
        const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const body: QueryBody = {
          query: {
            $or: [
              { name: { $regex: pattern, $options: "i" } },
              { full_name: { $regex: pattern, $options: "i" } },
              { locality: { $regex: pattern, $options: "i" } },
              { region: { $regex: pattern, $options: "i" } },
            ],
          },
          options: { limit, sort: { name: 1 } },
        };
        const result = await queryLaunchpads(body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_company: tool({
    description:
      "Static company profile for SpaceX (headquarters, leadership summary, links). Figures like employee count may lag real-world changes.",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      try {
        const data = await getCompany();
        return JSON.stringify(data);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),
};
