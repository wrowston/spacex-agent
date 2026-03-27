import "server-only";

import { getSpacexBaseUrl } from "./config";
import type { QueryBody, SpacexPaginated } from "./types";

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
    query: { id: launchId },
    options: {
      limit: 1,
      populate: ["rocket", "launchpad"],
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
