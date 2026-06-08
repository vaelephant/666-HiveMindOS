export type TaskStep = {
  tool: string;
  args: Record<string, string>;
  result: string;
};

export type AgentTask = {
  id: string;
  org_id: string;
  input: string;
  status: 'pending' | 'running' | 'done' | 'error';
  steps: TaskStep[];
  result: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

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
  wiki_pages?: string[];
};

export type WikiPage = {
  path: string;
  name: string;
  category: string;
  kind?: string;
  entity_type?: string;
  updated_at?: string | null;
  source_count?: number;
  has_conflicts?: boolean;
  relation_count?: number;
};

export type WikiCategory = {
  key: string;
  label: string;
  description: string;
  page_count: number;
};

export type WikiRawSource = {
  id: string | null;
  filename: string;
  source_type: string;
  source_type_label: string;
  created_at: string;
  status?: string;
};

export type WikiRelation = {
  target: string;
  relation_type: string;
  target_path?: string;
};

export type WikiConflict = {
  field: string;
  existing_value: string;
  new_value: string;
  source: string;
};

export type WikiVersionEntry = {
  date: string;
  source: string;
  changes: string[];
  summary?: string;
};

export type WikiCitation = {
  source: string;
  date: string;
  note: string;
  location: string | null;
  page?: number | null;
  source_id?: string | null;
};

export type WikiAttribute = {
  key: string;
  value: string;
  source?: string;
  source_id?: string | null;
  page?: number | null;
  excerpt?: string | null;
  confidence?: string | null;
};

export type WikiPipelineStage = {
  stage: string;
  label: string;
  count: number;
};

export type WikiPageDetail = {
  path: string;
  name: string;
  title: string;
  category: string;
  category_label: string;
  kind: 'entity' | 'workflow' | 'rule' | 'decision' | 'other';
  meta: Record<string, string>;
  updated_at?: string | null;
  has_conflicts?: boolean;
  raw_sources: WikiRawSource[];
  extraction: {
    summary?: string | null;
    attributes: WikiAttribute[];
    workflow_steps?: string[];
    workflow_conditions?: string[];
    workflow_participants?: string | null;
    trigger?: string;
    duration?: string;
    output?: string;
    rule_condition?: string | null;
    rule_action?: string | null;
    rule_penalty?: string | null;
    rule_source?: string;
  };
  conflicts: WikiConflict[];
  relations: WikiRelation[];
  graph_neighbors: Array<{
    name: string;
    entity_type: string;
    wiki_path?: string;
  }>;
  citations: WikiCitation[];
  version_log: WikiVersionEntry[];
  pipeline: WikiPipelineStage[];
};

export type WikiPageResponse = {
  path: string;
  content: string;
  detail?: WikiPageDetail;
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

export type OverviewStats = {
  source_count: number;
  source_count_week: number;
  entity_count: number;
  wiki_page_count: number;
  chat_session_count: number;
  chat_message_count: number;
  chat_sessions_week: number;
  memory_count: number;
  memories_week: number;
};

export type SourceActivityRecord = {
  kind: 'source';
  created_at: string;
  filename: string;
  status: 'uploaded' | 'compiling' | 'done' | 'error';
  entities_extracted: number;
  wiki_pages_created: number;
  error: string | null;
};

export type ChatActivityRecord = {
  kind: 'chat';
  created_at: string;
  session_id: string;
  title: string;
};

export type MemoryActivityRecord = {
  kind: 'memory';
  created_at: string;
  event_type: string;
  memory_title: string;
  memory_type: string;
};

export type ActivityRecord = SourceActivityRecord | ChatActivityRecord | MemoryActivityRecord;

/** @deprecated Use ActivityRecord */
export type LegacyActivityRecord = SourceActivityRecord;

export type OverviewData = {
  stats: OverviewStats;
  recent_activity: ActivityRecord[];
};

export type EntityDetail = {
  entity: Entity;
  neighbors: Entity[];
  relations?: EntityRelation[];
};

export type EntityRelation = {
  id: string;
  relation_type: string;
  direction: 'incoming' | 'outgoing';
  neighbor_name: string;
  neighbor_type: string;
  neighbor_wiki_path?: string;
  source_name: string;
  target_name: string;
};

export type GraphSnapshotNode = {
  id: string;
  name: string;
  entity_type: string;
  wiki_path: string;
};

export type GraphSnapshotEdge = {
  id: string;
  source_id: string;
  target_id: string;
  source_name: string;
  target_name: string;
  relation_type: string;
  weight: number;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatSource = {
  path: string;
  name: string;
  excerpt: string;
};

export type MemoryType = 'project' | 'preference' | 'decision';

export type MemoryUsed = {
  id: number;
  memory_type: MemoryType;
  title: string;
  content: string;
  importance: number;
};

export type ChatTurn = {
  question: string;
  answer: string;
  sources: ChatSource[];
  follow_ups: string[];
  memories_used?: MemoryUsed[];
};

export type ChatSessionSummary = {
  id: string;
  org_id: string;
  user_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ChatSession = ChatSessionSummary & {
  turns: ChatTurn[];
};

export type ChatSendResponse = {
  session_id: string;
  answer: string;
  sources: ChatSource[];
  follow_ups: string[];
  memories_used?: MemoryUsed[];
  turn: ChatTurn;
};

export type MemoryRecord = {
  id: number;
  org_id: string;
  user_id: string | null;
  memory_type: MemoryType;
  title: string;
  content: string;
  importance: number;
  status: string;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MemoryEventRecord = {
  id: number;
  memory_id: number;
  org_id: string;
  event_type: 'created' | 'updated' | 'merged' | 'conflict' | 'archived' | 'deleted' | 'decayed' | 'accessed';
  old_content: string | null;
  new_content: string | null;
  created_at: string;
  memory_title: string;
  memory_type: MemoryType;
  source_id: string | null;
};

export type MemoryStats = {
  total: number;
  project: number;
  preference: number;
  decision: number;
  events_this_week: number;
  memories_this_week: number;
  vector_indexed?: number;
};

export type GraphSnapshot = {
  nodes: GraphSnapshotNode[];
  edges: GraphSnapshotEdge[];
  stats: {
    node_count: number;
    edge_count: number;
  };
};
