export type SourceRecord = {
  id: string;
  org_id: string;
  filename: string;
  file_path: string;
  source_type: string;
  status: 'uploaded' | 'compiling' | 'done' | 'error';
  created_at: string;
  error: string | null;
  entities_extracted: number | null;
  workflows_extracted: number | null;
  wiki_pages_created: number | null;
};

export type WikiPage = {
  path: string;
  name: string;
  category: string;
};

export type Entity = {
  id: string;
  org_id: string;
  name: string;
  entity_type: string;
  wiki_path: string;
  attributes: Record<string, string>;
  updated_at?: string;
};

export type Relation = {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  weight: number;
};

export type IngestResult = {
  file_id: string;
  filename: string;
  content_hash: string;
  entities_extracted: number;
  workflows_extracted: number;
  rules_extracted: number;
  wiki_pages_created: number;
  pages: string[];
};

export type QueryResult = {
  question: string;
  answer: string;
  source_pages: string[];
};

export type EntityDetail = {
  entity: Entity;
  neighbors: Entity[];
};
