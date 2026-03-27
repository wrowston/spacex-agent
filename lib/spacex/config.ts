export const DEFAULT_SPACEX_API_BASE = "https://api.spacexdata.com";

export function getSpacexBaseUrl(): string {
  return process.env.SPACEX_API_BASE_URL ?? DEFAULT_SPACEX_API_BASE;
}
