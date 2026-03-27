import "server-only";

import { tool, zodSchema } from "ai";
import { z } from "zod";

import {
  formatSpacexError,
  getCompany,
  getCrewById,
  getLaunchSnapshot,
  getLaunchWithPopulate,
  getRoadster,
  queryCrew,
  queryLaunchpads,
  queryLaunches,
  queryRockets,
  queryStarlink,
  queryV4Resource,
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

/** Shell missions are often stored as "Starlink Group X-Y"; shorthand "Starlink X-Y" is not a substring match. */
const STARLINK_SHELL_SHORTHAND = /^starlink\s+(\d+)-(\d+)$/i;

/**
 * Returns query fragment for `name`: either a single regex or `$or` of shorthand + "Starlink Group X-Y".
 */
function buildMissionNameClause(missionNameContains: string): Record<string, unknown> {
  const trimmed = missionNameContains.trim();
  if (!/group/i.test(trimmed)) {
    const m = trimmed.match(STARLINK_SHELL_SHORTHAND);
    if (m) {
      const a = m[1];
      const b = m[2];
      const shorthand = `Starlink ${a}-${b}`;
      const groupForm = `Starlink Group ${a}-${b}`;
      return {
        $or: [
          { name: { $regex: escapeRegexLiteral(shorthand), $options: "i" } },
          { name: { $regex: escapeRegexLiteral(groupForm), $options: "i" } },
        ],
      };
    }
  }
  return {
    name: {
      $regex: escapeRegexLiteral(missionNameContains),
      $options: "i",
    },
  };
}

const paginationSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(20),
  page: z.number().int().min(1).optional(),
});

function buildPaginatedOptions(
  limit: number,
  page: number | undefined,
  sort: Record<string, 1 | -1>,
): Record<string, unknown> {
  const options: Record<string, unknown> = {
    sort,
    limit,
    pagination: true,
  };
  if (page) options.page = page;
  return options;
}

export const spacexTools = {
  spacex_get_launch_snapshot: tool({
    description:
      "Get a quick snapshot of launches: latest completed launch, next scheduled (upcoming) launch—not earliest historical mission, all upcoming launches, or past launches (past is a long list—prefer spacex_query_launches for filters). Optionally enrich one launch by id with rocket, launchpad, and crew member names (nested under crew[].crew).",
    inputSchema: zodSchema(
      z.object({
        snapshot: snapshotKindSchema.describe(
          "latest = most recent completed launch; next = soonest scheduled upcoming launch (not oldest past); upcoming = all upcoming; past = historical list (large)",
        ),
        populateLaunchId: z
          .string()
          .optional()
          .describe(
            "If set, returns that launch (by launch document id) with rocket, launchpad, and crew.crew populated (name, agency) so astronaut names are available—use after latest/next for pad, vehicle, or crew names.",
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
            "Substring match on mission name, case-insensitive. Starlink shell flights are often stored as “Starlink Group X-Y”; if you pass shorthand “Starlink X-Y” (no “Group”), the tool also matches the Group form automatically.",
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
          Object.assign(query, buildMissionNameClause(input.missionNameContains));
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

  spacex_query_capsules: tool({
    description:
      "Dragon capsule inventory (serial, status, type, reuse stats). Prefer filters—full list can be large. Use totalDocs for counts.",
    inputSchema: zodSchema(
      paginationSchema.extend({
        serialContains: z
          .string()
          .optional()
          .describe("Substring match on capsule serial (e.g. C206), case-insensitive"),
        status: z
          .enum(["unknown", "active", "retired", "destroyed"])
          .optional()
          .describe("Exact capsule status"),
        type: z
          .enum(["Dragon 1.0", "Dragon 1.1", "Dragon 2.0"])
          .optional()
          .describe("Dragon variant"),
      }),
    ),
    execute: async ({ limit, page, serialContains, status, type }) => {
      try {
        const query: Record<string, unknown> = {};
        if (serialContains) {
          query.serial = {
            $regex: escapeRegexLiteral(serialContains),
            $options: "i",
          };
        }
        if (status) query.status = status;
        if (type) query.type = type;
        const body: QueryBody = {
          query,
          options: buildPaginatedOptions(limit, page, { serial: 1 }),
        };
        const result = await queryV4Resource("capsules", body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_query_cores: tool({
    description:
      "Serialized Falcon booster cores (serial, block, status, landing/reuse counts). Prefer filters; use totalDocs when listing.",
    inputSchema: zodSchema(
      paginationSchema.extend({
        serialContains: z
          .string()
          .optional()
          .describe("Substring match on core serial (e.g. B1060), case-insensitive"),
        status: z
          .enum(["active", "inactive", "unknown", "expended", "lost", "retired"])
          .optional(),
      }),
    ),
    execute: async ({ limit, page, serialContains, status }) => {
      try {
        const query: Record<string, unknown> = {};
        if (serialContains) {
          query.serial = {
            $regex: escapeRegexLiteral(serialContains),
            $options: "i",
          };
        }
        if (status) query.status = status;
        const body: QueryBody = {
          query,
          options: buildPaginatedOptions(limit, page, { serial: 1 }),
        };
        const result = await queryV4Resource("cores", body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_query_crew: tool({
    description:
      "Astronaut/crew catalog (name, agency, status). For one person by id, pass crewId (GET /v4/crew/:id). For a mission roster, pass crewDocumentIds from launch.crew[].crew, or use spacex_get_launch_snapshot with populateLaunchId (includes names). An unfiltered list query returns a page of all crew—not the crew of a given launch.",
    inputSchema: zodSchema(
      paginationSchema.extend({
        crewId: z
          .string()
          .optional()
          .describe(
            "Single crew member document id; uses GET /v4/crew/:id. When set, other filters are ignored.",
          ),
        crewDocumentIds: z
          .array(z.string())
          .optional()
          .describe(
            "Crew document ids from launch.crew[].crew—filters with Mongo $in on _id to resolve those astronauts’ names for that launch.",
          ),
        nameContains: z
          .string()
          .optional()
          .describe(
            "Substring on crew member name, case-insensitive (ignored if crewId or crewDocumentIds is set)",
          ),
        agency: z
          .string()
          .optional()
          .describe("Exact or partial agency (e.g. NASA); uses case-insensitive regex"),
        status: z.enum(["active", "inactive", "retired", "unknown"]).optional(),
      }),
    ),
    execute: async ({
      limit,
      page,
      crewId,
      crewDocumentIds,
      nameContains,
      agency,
      status,
    }) => {
      try {
        if (crewId) {
          const crew = await getCrewById(crewId);
          return JSON.stringify({ crewId, crew });
        }
        const query: Record<string, unknown> = {};
        if (crewDocumentIds && crewDocumentIds.length > 0) {
          query._id = { $in: crewDocumentIds };
        } else if (nameContains) {
          query.name = {
            $regex: escapeRegexLiteral(nameContains),
            $options: "i",
          };
        }
        if (agency) {
          query.agency = { $regex: escapeRegexLiteral(agency), $options: "i" };
        }
        if (status) query.status = status;
        const unfiltered = Object.keys(query).length === 0;
        const body: QueryBody = {
          query,
          options: buildPaginatedOptions(limit, page, { name: 1 }),
        };
        const result = await queryCrew(body, { unfiltered, limit, page });
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_query_dragons: tool({
    description:
      "Dragon vehicle types (Crew/Cargo variants, capacity, mass). Not individual flight capsules—use spacex_query_capsules for those.",
    inputSchema: zodSchema(
      paginationSchema.extend({
        nameContains: z
          .string()
          .optional()
          .describe("Substring on dragon name, case-insensitive"),
        active: z.boolean().optional(),
        type: z.string().optional().describe("Dragon type string from the dataset (e.g. crew/cargo)"),
      }),
    ),
    execute: async ({ limit, page, nameContains, active, type }) => {
      try {
        const query: Record<string, unknown> = {};
        if (nameContains) {
          query.name = {
            $regex: escapeRegexLiteral(nameContains),
            $options: "i",
          };
        }
        if (active !== undefined) query.active = active;
        if (type) query.type = type;
        const body: QueryBody = {
          query,
          options: buildPaginatedOptions(limit, page, { name: 1 }),
        };
        const result = await queryV4Resource("dragons", body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_query_landpads: tool({
    description:
      "Landing zones and drone-ship landing sites (OCISLY, JRTI, LZ-1, etc.)—distinct from launchpads. Search by name, locality, or region; omit search for a paged list.",
    inputSchema: zodSchema(
      paginationSchema.extend({
        search: z
          .string()
          .optional()
          .describe(
            "Matches name, full_name, locality, or region (case-insensitive substring). Omit for unfiltered list.",
          ),
      }),
    ),
    execute: async ({ limit, page, search }) => {
      try {
        const query: Record<string, unknown> =
          search && search.length > 0
            ? {
                $or: [
                  {
                    name: {
                      $regex: escapeRegexLiteral(search),
                      $options: "i",
                    },
                  },
                  {
                    full_name: {
                      $regex: escapeRegexLiteral(search),
                      $options: "i",
                    },
                  },
                  {
                    locality: {
                      $regex: escapeRegexLiteral(search),
                      $options: "i",
                    },
                  },
                  {
                    region: {
                      $regex: escapeRegexLiteral(search),
                      $options: "i",
                    },
                  },
                ],
              }
            : {};
        const body: QueryBody = {
          query,
          options: buildPaginatedOptions(limit, page, { name: 1 }),
        };
        const result = await queryV4Resource("landpads", body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_query_payloads: tool({
    description:
      "Satellite/payload records (customers, orbit, mass, NORAD ids). Optional populateLaunch links the launch document.",
    inputSchema: zodSchema(
      paginationSchema.extend({
        nameContains: z
          .string()
          .optional()
          .describe("Substring on payload name, case-insensitive"),
        customerContains: z
          .string()
          .optional()
          .describe("Substring match against customer strings, case-insensitive"),
        orbitContains: z
          .string()
          .optional()
          .describe("Substring on orbit field (e.g. LEO, GTO)"),
        populateLaunch: z
          .boolean()
          .optional()
          .default(false)
          .describe("When true, populate the linked launch document"),
      }),
    ),
    execute: async ({
      limit,
      page,
      nameContains,
      customerContains,
      orbitContains,
      populateLaunch,
    }) => {
      try {
        const query: Record<string, unknown> = {};
        if (nameContains) {
          query.name = {
            $regex: escapeRegexLiteral(nameContains),
            $options: "i",
          };
        }
        if (customerContains) {
          query.customers = {
            $regex: escapeRegexLiteral(customerContains),
            $options: "i",
          };
        }
        if (orbitContains) {
          query.orbit = {
            $regex: escapeRegexLiteral(orbitContains),
            $options: "i",
          };
        }
        const options = buildPaginatedOptions(limit, page, { name: 1 });
        if (populateLaunch) {
          options.populate = ["launch"];
        }
        const body: QueryBody = { query, options };
        const result = await queryV4Resource("payloads", body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_query_ships: tool({
    description:
      "Recovery fleet ships (drone ships, support vessels): name, type, roles, active flag.",
    inputSchema: zodSchema(
      paginationSchema.extend({
        nameContains: z
          .string()
          .optional()
          .describe("Substring on ship name, case-insensitive"),
        active: z.boolean().optional(),
        typeContains: z
          .string()
          .optional()
          .describe("Substring on ship type field"),
        roleContains: z
          .string()
          .optional()
          .describe("Substring match on roles entries"),
      }),
    ),
    execute: async ({ limit, page, nameContains, active, typeContains, roleContains }) => {
      try {
        const query: Record<string, unknown> = {};
        if (nameContains) {
          query.name = {
            $regex: escapeRegexLiteral(nameContains),
            $options: "i",
          };
        }
        if (active !== undefined) query.active = active;
        if (typeContains) {
          query.type = {
            $regex: escapeRegexLiteral(typeContains),
            $options: "i",
          };
        }
        if (roleContains) {
          query.roles = {
            $regex: escapeRegexLiteral(roleContains),
            $options: "i",
          };
        }
        const body: QueryBody = {
          query,
          options: buildPaginatedOptions(limit, page, { name: 1 }),
        };
        const result = await queryV4Resource("ships", body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_query_starlink: tool({
    description:
      "Starlink satellite catalog (position, height, velocity, version). Thousands of docs—always use filters or small limits. By default omits heavy Space Track / TLE data; set includeOrbitData true only when TLEs or raw ephemeris are needed.",
    inputSchema: zodSchema(
      paginationSchema.extend({
        limit: z.number().int().min(1).max(50).optional().default(15),
        version: z
          .string()
          .optional()
          .describe("Starlink shell/version label (e.g. v1.0, v0.9)"),
        launchId: z.string().optional().describe("Launch document id to filter satellites"),
        noradCatId: z
          .number()
          .int()
          .optional()
          .describe("NORAD catalog id (matches spaceTrack.NORAD_CAT_ID)"),
        sortBy: z
          .enum(["height_km", "latitude", "longitude", "version"])
          .optional()
          .default("height_km"),
        sortOrder: sortOrderSchema.optional().default("desc"),
        includeOrbitData: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include full spaceTrack TLE/ephemeris (large payloads)"),
      }),
    ),
    execute: async ({
      limit,
      page,
      version,
      launchId,
      noradCatId,
      sortBy,
      sortOrder,
      includeOrbitData,
    }) => {
      try {
        const query: Record<string, unknown> = {};
        if (version) query.version = version;
        if (launchId) query.launch = launchId;
        if (noradCatId !== undefined) {
          query["spaceTrack.NORAD_CAT_ID"] = noradCatId;
        }
        const dir = sortOrder === "asc" ? 1 : -1;
        const body: QueryBody = {
          query,
          options: buildPaginatedOptions(limit, page, { [sortBy]: dir }),
        };
        const result = await queryStarlink(body, includeOrbitData ?? false);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_query_history: tool({
    description:
      "Curated SpaceX historical milestone events (titles, dates, article links).",
    inputSchema: zodSchema(
      paginationSchema.extend({
        titleContains: z
          .string()
          .optional()
          .describe("Substring on event title, case-insensitive"),
        eventDateUtcGte: z
          .string()
          .optional()
          .describe("Lower bound on event_date_utc ISO string"),
        eventDateUtcLte: z
          .string()
          .optional()
          .describe("Upper bound on event_date_utc ISO string"),
      }),
    ),
    execute: async ({ limit, page, titleContains, eventDateUtcGte, eventDateUtcLte }) => {
      try {
        const query: Record<string, unknown> = {};
        if (titleContains) {
          query.title = {
            $regex: escapeRegexLiteral(titleContains),
            $options: "i",
          };
        }
        if (eventDateUtcGte ?? eventDateUtcLte) {
          const range: Record<string, string> = {};
          if (eventDateUtcGte) range.$gte = eventDateUtcGte;
          if (eventDateUtcLte) range.$lte = eventDateUtcLte;
          query.event_date_utc = range;
        }
        const body: QueryBody = {
          query,
          options: buildPaginatedOptions(limit, page, { event_date_utc: -1 }),
        };
        const result = await queryV4Resource("history", body);
        return JSON.stringify(result);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),

  spacex_get_roadster: tool({
    description:
      "Starman Tesla Roadster: heliocentric orbit parameters, distances to Earth/Mars, speed—single GET snapshot (public dataset).",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      try {
        const data = await getRoadster();
        return JSON.stringify(data);
      } catch (e) {
        return formatSpacexError(e);
      }
    },
  }),
};
