export interface OpenLibraryEditionRecord {
  key: string;
  title?: string;
  subtitle?: string;
  edition_name?: string;
  publishers?: string[];
  publish_date?: string;
  languages?: { key: string }[];
  isbn_13?: string[];
  isbn_10?: string[];
  number_of_pages?: number;
  physical_format?: string;
  covers?: number[];
}

export interface OpenLibraryEditionsResponse {
  size?: number;
  entries?: OpenLibraryEditionRecord[];
}

export interface EditionSummary {
  edition_key: string;
  title?: string;
  subtitle?: string;
  edition_name?: string;
  publishers?: string[];
  publish_date?: string;
  languages?: string[];
  isbn_13?: string;
  isbn_10?: string;
  number_of_pages?: number;
  physical_format?: string;
  cover_url?: string;
}

export interface WorkEditions {
  work_key: string;
  num_found: number;
  offset: number;
  limit: number;
  editions: EditionSummary[];
}
