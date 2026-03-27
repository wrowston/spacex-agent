/** Public r/SpaceX REST API (same schema as r-spacex/SpaceX-API). */
export const DEFAULT_SPACEX_API_BASE = "https://api.spacexdata.com";

/**
 * Override only for a compatible self-hosted mirror; defaults to {@link DEFAULT_SPACEX_API_BASE}.
 *
 * The public host is community-maintained and may **lag badly** (e.g. recent launches missing from
 * the catalog). For up-to-date launch rows, run a self-hosted
 * [SpaceX-API](https://github.com/r-spacex/SpaceX-API) deployment or another compatible mirror and set
 * `SPACEX_API_BASE_URL` to its base URL.
 *
 * If crew queries return empty rows unexpectedly, confirm the mirror implements `POST /v4/crew/query`
 * or rely on the app’s GET `/v4/crew` fallback for unfiltered crew lists.
 */
export function getSpacexBaseUrl(): string {
  return process.env.SPACEX_API_BASE_URL ?? DEFAULT_SPACEX_API_BASE;
}
