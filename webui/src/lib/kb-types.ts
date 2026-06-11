export type StepReflection = {
  score?: number;
  status?: string;
  reason?: string;
  problems?: string[];
  dimensions?: Record<string, number | string>;
  passed?: boolean;
};

export type TaskStep = {
  tool?: string;
  args?: Record<string, string>;
  result?: string;
  task_id?: string;
  name?: string;
  action?: string;
  status?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
  result_summary?: Record<string, unknown>;
  reflection?: StepReflection;
};

export type AgentExperience = {
  id: string;
  org_id: string;
  task_type: string;
  goal: string;
  success: boolean;
  score: number | null;
  created_at: string;
};

export type TaskPhase =
  | 'pending'
  | 'planning'
  | 'planned'
  | 'executing'
  | 'reflecting'
  | 'done'
  | 'error'
  | 'awaiting_approval';

export type QueueTaskItem = {
  id: string;
  name: string;
  action: string;
  status: string;
  reason?: string;
  gate?: string;
};

export type PlanningMinute = {
  role: string;
  label: string;
  summary: string;
  detail?: string;
  fallback?: boolean;
};

export type CommitteeRoleMeta = {
  id: string;
  label: string;
  description: string;
  order: number;
};

export type TaskPlan = {
  goal: string;
  task_type: string;
  rubric_id: string;
  success_criteria: string[];
  estimated_risk: string;
  tasks: QueueTaskItem[];
  planning_mode?: 'committee' | 'single';
  planning_minutes?: PlanningMinute[];
  planning_active_role?: string | null;
  committee_roles?: CommitteeRoleMeta[];
};

export type TaskConstraints = {
  source?: 'chat_upgrade' | 'task_center';
  session_id?: string;
  turn_index?: number;
  context?: {
    turns?: Array<{
      question: string;
      answer: string;
      sources?: { path: string; name: string }[];
      memories_used?: { id: number; title: string; memory_type: string }[];
    }>;
    wiki_paths?: string[];
    memory_ids?: number[];
  };
};

export type AgentTask = {
  id: string;
  org_id: string;
  input: string;
  status: 'pending' | 'running' | 'done' | 'error';
  phase?: TaskPhase;
  task_type?: string;
  constraints?: TaskConstraints & Record<string, unknown>;
  plan?: TaskPlan | null;
  queue?: QueueTaskItem[];
  steps: TaskStep[];
  reflections?: Record<string, unknown>[];
  score?: number | null;
  result: string | null;
  reflection_report?: string | null;
  error: string | null;
  pending_step_id?: string | null;
  experience_id?: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AutomationRun = {
  id: string;
  org_id: string;
  job_id: string;
  status: 'running' | 'done' | 'error';
  trigger: string;
  summary: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type AutomationJob = {
  id: string;
  label: string;
  description: string;
  category: string;
  category_label: string;
  cron_hint: string;
  defaults: Record<string, number | boolean | string>;
  builtin?: boolean;
  updated_at?: string | null;
  last_run: AutomationRun | null;
};

export type AutomationJobUpdate = {
  label?: string;
  description?: string;
  category?: string;
  cron_hint?: string;
  defaults?: Record<string, number | boolean | string>;
};

export type AgentSkillSummary = {
  name: string;
  path: string;
  preview: string;
};

export type AgentSkillDetail = {
  name: string;
  path: string;
  content: string;
};

export type AgentSkillCreate = {
  title: string;
  description: string;
  steps: string[];
  scenario?: string[];
};

export type OrgPlaybook = {
  source: 'default' | 'override';
  content: string;
  default_title: string;
  default_preview: string;
  pinned_sessions_cleared?: number;
};

export type OrgPlaybookPreview = {
  block: string;
  char_count: number;
  char_limit: number;
  truncated: boolean;
  memories_count: number;
  memories: {
    id: number;
    title: string;
    memory_type: string;
    memory_type_label: string;
    importance: number;
  }[];
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
  /** 虚拟集合名（逻辑分类，不改变 raw 物理路径） */
  collection?: string | null;
};

export type SourceCollection = {
  name: string;
  count: number;
};

export type SourceCollectionsResponse = {
  collections: SourceCollection[];
  uncategorized: number;
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
  candidate_pending?: number;
  candidates_pending_week?: number;
};

export type KnowledgeCandidate = {
  id: number;
  org_id: string;
  user_id: string | null;
  category: string;
  title: string;
  content: string;
  source_type: string;
  source_id: string | null;
  confidence: number;
  proposed_action: string;
  status: string;
  resolver_action: string | null;
  resolver_note: string | null;
  target_wiki_path: string | null;
  memory_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CandidateStats = {
  pending: number;
  approved: number;
  merged: number;
  rejected: number;
  conflict: number;
  pending_week: number;
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

export type CandidateActivityRecord = {
  kind: 'candidate';
  created_at: string;
  title: string;
  category: string;
  status: string;
  source_type: string;
  target_wiki_path: string | null;
};

export type ActivityRecord =
  | SourceActivityRecord
  | ChatActivityRecord
  | MemoryActivityRecord
  | CandidateActivityRecord;

export type PipelineStageStatus = 'idle' | 'active' | 'done';

export type PipelineStage = {
  id: string;
  label: string;
  description: string;
  status: PipelineStageStatus;
  hint: string;
};

export type PipelineRecentItem = {
  kind: 'memory' | 'candidate';
  id: number;
  title: string;
  detail: string;
  status: string;
  created_at: string;
  memory_type?: string;
  category?: string;
  target_wiki_path?: string | null;
};

export type SessionPipeline = {
  session_id: string;
  stats: {
    message_count: number;
    memory_count: number;
    candidate_pending: number;
    candidate_approved: number;
    candidate_merged: number;
    event_count: number;
  };
  stages: PipelineStage[];
  recent: PipelineRecentItem[];
};

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

export type MemoryType = 'project' | 'preference' | 'decision' | 'fact' | 'rule';

export type SkillUsed = {
  name: string;
  description: string;
  score: number;
  path?: string;
};

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
  skills_used?: SkillUsed[];
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

export type WikiSuggestionBrief = {
  title: string;
  reason: string;
  category: string;
  content_outline?: string;
};

export type MemoryConflictBrief = {
  field: string;
  description: string;
  resolution?: string;
};

export type SessionRecapResult = {
  session_id?: string;
  summary: string;
  memory_ids: number[];
  archived_ids: number[];
  conflicts: MemoryConflictBrief[];
  wiki_suggestions: WikiSuggestionBrief[];
};

export type DeleteSessionResponse = {
  deleted: string;
  recap?: SessionRecapResult;
};

export type ChatSendResponse = {
  session_id: string;
  answer: string;
  sources: ChatSource[];
  follow_ups: string[];
  memories_used?: MemoryUsed[];
  skills_used?: SkillUsed[];
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
  by_source_chat?: number;
  by_source_ingest?: number;
};

export type GraphSnapshot = {
  nodes: GraphSnapshotNode[];
  edges: GraphSnapshotEdge[];
  stats: {
    node_count: number;
    edge_count: number;
  };
};
