export interface OpenLibraryAuthorDoc {
  key: string;
  type: string;
  name: string;
  alternate_names?: string[];
  birth_date?: string;
  top_work?: string;
  work_count: number;
  top_subjects?: string[];
  _version_?: number;
}

export interface OpenLibraryAuthorSearchResponse {
  numFound: number;
  start: number;
  numFoundExact: boolean;
  docs: OpenLibraryAuthorDoc[];
}

export interface AuthorInfo {
  key: string;
  name: string;
  alternate_names?: string[];
  birth_date?: string;
  top_work?: string;
  work_count: number;
}

export interface AuthorSearchResults {
  num_found: number;
  offset: number;
  limit: number;
  results: AuthorInfo[];
}
