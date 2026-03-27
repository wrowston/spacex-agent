/** Public r/SpaceX REST API (same schema as r-spacex/SpaceX-API). */
export const DEFAULT_SPACEX_API_BASE = "https://api.spacexdata.com";

/** Override only for a compatible self-hosted mirror; defaults to {@link DEFAULT_SPACEX_API_BASE}. */
export function getSpacexBaseUrl(): string {
  return process.env.SPACEX_API_BASE_URL ?? DEFAULT_SPACEX_API_BASE;
}
