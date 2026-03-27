export type SpacexPaginated<T> = {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

export type QueryBody = {
  query: Record<string, unknown>;
  options?: Record<string, unknown>;
};
