import "server-only";

import { getSpacexBaseUrl } from "./config";
import type { QueryBody, SpacexPaginated } from "./types";

function crewNameSortKey(doc: unknown): string {
  if (doc && typeof doc === "object" && "name" in doc) {
    return String((doc as { name: unknown }).name ?? "");
  }
  return "";
}

/** Sort by `name` ascending, then slice for limit/page (matches POST query behavior). */
function paginateCrewInMemory(
  all: unknown[],
  limit: number,
  page: number | undefined,
): SpacexPaginated<unknown> {
  const sorted = [...all].sort((a, b) =>
    crewNameSortKey(a).localeCompare(crewNameSortKey(b)),
  );
  const totalDocs = sorted.length;
  const pageNum = page ?? 1;
  const totalPages =
    totalDocs === 0 ? 1 : Math.max(1, Math.ceil(totalDocs / limit));
  const start = (pageNum - 1) * limit;
  const docs = sorted.slice(start, start + limit);
  return {
    docs,
    totalDocs,
    limit,
    totalPages,
    page: pageNum,
    hasPrevPage: pageNum > 1,
    hasNextPage: pageNum < totalPages,
    prevPage: pageNum > 1 ? pageNum - 1 : null,
    nextPage: pageNum < totalPages ? pageNum + 1 : null,
  };
}

const MAX_BODY_SNIPPET = 200;

export class SpacexApiError extends Error {
  readonly status: number;
  readonly bodySnippet: string;

  constructor(status: number, message: string, bodySnippet: string) {
    super(message);
    this.name = "SpacexApiError";
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

function trimForModel(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;

  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    const max = 40;
    const arr = value.slice(0, max).map((v) => trimForModel(v, depth + 1));
    return value.length > max
      ? [...arr, `… (${value.length - max} more items omitted)`]
      : arr;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(obj)) {
      if (k === "flickr" && v && typeof v === "object") {
        const flickr = v as { small?: unknown; original?: unknown };
        out[k] = {
          small: trimForModel(flickr.small, depth + 1),
          original: Array.isArray(flickr.original)
            ? `(${flickr.original.length} images; omitted)`
            : flickr.original,
        };
        continue;
      }
      out[k] = trimForModel(v, depth + 1);
    }
    return out;
  }

  return value;
}

export function formatSpacexError(err: unknown): string {
  if (err instanceof SpacexApiError) {
    return JSON.stringify({
      error: true,
      status: err.status,
      message: err.message,
      bodySnippet: err.bodySnippet,
    });
  }
  if (err instanceof Error) {
    return JSON.stringify({ error: true, message: err.message });
  }
  return JSON.stringify({ error: true, message: String(err) });
}

async function readBodySnippet(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, MAX_BODY_SNIPPET);
  } catch {
    return "";
  }
}

export async function spacexGetJson<T>(path: string): Promise<T> {
  const url = `${getSpacexBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const bodySnippet = await readBodySnippet(res);
    throw new SpacexApiError(
      res.status,
      `GET ${path} failed: ${res.status} ${res.statusText}`,
      bodySnippet,
    );
  }

  return (await res.json()) as T;
}

export async function spacexPostQuery<T>(
  path: string,
  body: QueryBody,
): Promise<SpacexPaginated<T>> {
  const url = `${getSpacexBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const bodySnippet = await readBodySnippet(res);
    throw new SpacexApiError(
      res.status,
      `POST ${path} failed: ${res.status} ${res.statusText}`,
      bodySnippet,
    );
  }

  return (await res.json()) as SpacexPaginated<T>;
}

export type LaunchSnapshotKind = "latest" | "next" | "upcoming" | "past";

export async function getLaunchSnapshot(kind: LaunchSnapshotKind): Promise<unknown> {
  if (kind === "latest") {
    const data = await spacexGetJson<unknown>("/v5/launches/latest");
    return trimForModel(data);
  }
  if (kind === "next") {
    const result = await spacexPostQuery<unknown>("/v5/launches/query", {
      query: { upcoming: true },
      options: {
        limit: 1,
        sort: { date_utc: 1 },
        populate: ["rocket", "launchpad"],
      },
    });
    const doc = result.docs[0];
    return trimForModel(doc ?? null);
  }
  if (kind === "upcoming") {
    const result = await spacexPostQuery<unknown>("/v5/launches/query", {
      query: { upcoming: true },
      options: {
        limit: 25,
        sort: { date_utc: 1 },
        populate: ["rocket", "launchpad"],
      },
    });
    return trimForModel(result);
  }
  const result = await spacexPostQuery<unknown>("/v5/launches/query", {
    query: { upcoming: false },
    options: {
      limit: 20,
      sort: { date_utc: -1 },
      populate: ["rocket", "launchpad"],
    },
  });
  return trimForModel(result);
}

export async function getLaunchWithPopulate(
  launchId: string,
): Promise<unknown> {
  const result = await spacexPostQuery<unknown>("/v5/launches/query", {
    query: { _id: launchId },
    options: {
      limit: 1,
      populate: [
        "rocket",
        "launchpad",
        { path: "crew.crew", select: { name: 1, agency: 1 } },
      ],
    },
  });
  const doc = result.docs[0];
  return doc ? trimForModel(doc) : null;
}

export async function queryLaunches(body: QueryBody): Promise<unknown> {
  const result = await spacexPostQuery<unknown>("/v5/launches/query", body);
  return {
    ...result,
    docs: trimForModel(result.docs) as unknown[],
  };
}

export async function queryRockets(body: QueryBody): Promise<unknown> {
  const result = await spacexPostQuery<unknown>("/v4/rockets/query", body);
  return {
    ...result,
    docs: trimForModel(result.docs) as unknown[],
  };
}

export async function queryLaunchpads(body: QueryBody): Promise<unknown> {
  const result = await spacexPostQuery<unknown>("/v4/launchpads/query", body);
  return {
    ...result,
    docs: trimForModel(result.docs) as unknown[],
  };
}

export async function getCompany(): Promise<unknown> {
  const data = await spacexGetJson<unknown>("/v4/company");
  return trimForModel(data);
}

/** POST `/v4/{resource}/query` — capsules, cores, crew, dragons, landpads, payloads, ships, history */
export type SpacexV4QueryResource =
  | "capsules"
  | "cores"
  | "crew"
  | "dragons"
  | "landpads"
  | "payloads"
  | "ships"
  | "history";

export async function queryV4Resource(
  resource: SpacexV4QueryResource,
  body: QueryBody,
): Promise<unknown> {
  const result = await spacexPostQuery<unknown>(
    `/v4/${resource}/query`,
    body,
  );
  return {
    ...result,
    docs: trimForModel(result.docs) as unknown[],
  };
}

/** Single crew member: GET `/v4/crew/:id`. */
export async function getCrewById(id: string): Promise<unknown> {
  const data = await spacexGetJson<unknown>(
    `/v4/crew/${encodeURIComponent(id)}`,
  );
  return trimForModel(data);
}

/**
 * POST `/v4/crew/query`. If the POST returns no rows for an **unfiltered** query,
 * retries using GET `/v4/crew` and paginates in memory (helps mirrors that mishandle POST).
 */
export async function queryCrew(
  body: QueryBody,
  opts: { unfiltered: boolean; limit: number; page?: number },
): Promise<unknown> {
  const result = await spacexPostQuery<unknown>("/v4/crew/query", body);
  if (result.totalDocs === 0 && opts.unfiltered) {
    const all = await spacexGetJson<unknown>("/v4/crew");
    if (!Array.isArray(all)) {
      return {
        ...result,
        docs: trimForModel(result.docs) as unknown[],
      };
    }
    const paginated = paginateCrewInMemory(all, opts.limit, opts.page);
    return {
      ...paginated,
      docs: trimForModel(paginated.docs) as unknown[],
    };
  }
  return {
    ...result,
    docs: trimForModel(result.docs) as unknown[],
  };
}

function stripStarlinkSpaceTrack(docs: unknown[]): unknown[] {
  return docs.map((doc) => {
    if (doc && typeof doc === "object" && "spaceTrack" in doc) {
      const { spaceTrack: _omit, ...rest } = doc as Record<string, unknown>;
      return trimForModel({
        ...rest,
        spaceTrack: "(omitted; pass includeOrbitData: true for full Space Track / TLE data)",
      });
    }
    return trimForModel(doc);
  });
}

/** Starlink docs are large when `spaceTrack` is included; omit it by default. */
export async function queryStarlink(
  body: QueryBody,
  includeOrbitData: boolean,
): Promise<unknown> {
  const result = await spacexPostQuery<unknown>("/v4/starlink/query", body);
  if (includeOrbitData) {
    return {
      ...result,
      docs: trimForModel(result.docs) as unknown[],
    };
  }
  return {
    ...result,
    docs: stripStarlinkSpaceTrack(result.docs as unknown[]),
  };
}

export async function getRoadster(): Promise<unknown> {
  const data = await spacexGetJson<unknown>("/v4/roadster");
  return trimForModel(data);
}
