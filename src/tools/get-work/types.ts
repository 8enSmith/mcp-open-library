export interface WorkAuthor {
  key: string;
  name?: string;
}

export interface WorkExcerpt {
  excerpt: string;
  comment?: string;
}

export interface WorkLink {
  title: string;
  url: string;
}

export interface WorkDetails {
  work_key: string;
  title?: string;
  subtitle?: string;
  authors?: WorkAuthor[];
  description?: string;
  first_publish_date?: string;
  subjects?: string[];
  subject_places?: string[];
  subject_people?: string[];
  subject_times?: string[];
  cover_url?: string;
  excerpts?: WorkExcerpt[];
  links?: WorkLink[];
}

export interface AuthorNamesDoc {
  author_key?: string[];
  author_name?: string[];
}

export interface AuthorNamesSearchResponse {
  docs?: AuthorNamesDoc[];
}
