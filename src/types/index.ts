// src/types/index.ts
// All shared TypeScript types matching the Supabase schema

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  plan: 'free' | 'starter' | 'business';
  usd_to_lbp_rate?: number;   // daily exchange rate, editable by owner/admin
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | string;
  avatar_url?: string;
  email: string;
  phone?: string;
  push_token?: string;
  org_id?: string;
  auth_id?: string;
  has_completed_onboarding?: boolean;
  deleted_at?: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  client_id: string;
  phone?: string;
  reference_name?: string;
  reference_phone?: string;
  created_at: string;
}

export interface Ministry {
  id: string;
  name: string;
  type: 'parent' | 'child';
  parent_id?: string;
  parent?: Ministry;
  city_id?: string | null;
  city?: { id: string; name: string } | null;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  ministry_id?: string;
  ministry?: Ministry;
  estimated_duration_days: number;
  base_price_usd: number;
  base_price_lbp: number;
  created_at: string;
}

export interface StatusLabel {
  id: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface TaskRouteStop {
  id: string;
  task_id: string;
  ministry_id: string;
  ministry?: Ministry;
  stop_order: number;
  status: string;
  updated_at?: string;
  updated_by?: string;
  updater?: TeamMember;
  gps_lat?: number;
  gps_lng?: number;
  notes?: string;
  created_at: string;
  // per-stage fields (added migration_stop_fields.sql)
  city_id?: string | null;
  city?: City | null;
  assigned_to?: string | null;
  assignee?: TeamMember | null;
  ext_assignee_id?: string | null;
  ext_assignee?: { id: string; name: string; phone?: string } | null;
  due_date?: string | null;
  rejection_reason?: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id?: string;
  author?: TeamMember;
  body: string;
  audio_url?: string | null;
  gps_lat?: number;
  gps_lng?: number;
  created_at: string;
}

export interface StatusUpdate {
  id: string;
  task_id: string;
  stop_id?: string;
  updated_by?: string;
  updater?: TeamMember;
  old_status?: string;
  new_status: string;
  gps_lat?: number;
  gps_lng?: number;
  created_at: string;
}

export interface City {
  id: string;
  name: string;
  created_at?: string;
}

export interface Assignee {
  id: string;
  name: string;
  phone?: string;
  reference?: string;
  reference_phone?: string;
  notes?: string;
  city_id?: string | null;
  city?: { id: string; name: string } | null;
  created_by?: string;
  creator?: { name: string };
  created_at: string;
}

export interface FileTransaction {
  id: string;
  task_id: string;
  type: 'expense' | 'revenue';
  description: string;
  amount_usd: number;
  amount_lbp: number;
  /** Exchange rate (LBP per $1) locked at the time this transaction was recorded. NULL on legacy rows. */
  rate_usd_lbp?: number | null;
  stop_id?: string | null;
  stop?: { id: string; ministry?: { name: string } } | null;
  created_by?: string;
  creator?: { name: string };
  created_at: string;
}

export interface ServiceDocumentRequirement {
  id: string;
  doc_id: string;
  title: string;
  sort_order: number;
  org_id?: string;
  created_at: string;
}

export interface ServiceDocument {
  id: string;
  service_id: string;
  title: string;
  sort_order: number;
  is_checked: boolean;
  created_at: string;
  requirements?: ServiceDocumentRequirement[];
}

export interface Task {
  id: string;
  client_id: string;
  client?: Client;
  service_id: string;
  service?: Service;
  assigned_to?: string;
  assignee?: TeamMember;
  ext_assignee_id?: string;
  ext_assignee?: Assignee;
  current_status: string;
  due_date?: string;
  notes?: string;
  price_usd: number;
  price_lbp: number;
  is_archived?: boolean;
  is_pinned?: boolean;
  city_id?: string | null;
  city?: City | null;
  closed_at?: string | null;  // set when all stages reach terminal status
  created_at: string;
  updated_at: string;
  // joined relations
  route_stops?: TaskRouteStop[];
  comments?: TaskComment[];
  transactions?: Array<{ type: 'expense' | 'revenue'; amount_usd: number; amount_lbp: number }>;
}

export interface TaskPriceHistory {
  id: string;
  task_id: string;
  old_price_usd: number;
  old_price_lbp: number;
  new_price_usd: number;
  new_price_lbp: number;
  note?: string;
  changed_by?: string;
  changer?: { name: string };
  created_at: string;
}

export interface OrgPermissions {
  can_see_all_files: boolean;
  can_create_files: boolean;
  can_edit_file_details: boolean;
  can_delete_files: boolean;
  can_update_stage_status: boolean;
  can_add_edit_stages: boolean;
  can_see_file_financials: boolean;   // gate for the entire Financials section inside a file
  can_see_contract_price: boolean;
  can_see_financial_report: boolean;
  can_add_revenue: boolean;
  can_add_expenses: boolean;
  can_edit_contract_price: boolean;
  can_delete_transactions: boolean;
  can_upload_documents: boolean;
  can_delete_documents: boolean;
  can_manage_clients: boolean;
  can_add_comments: boolean;
  can_delete_comments: boolean;
  can_manage_catalog: boolean;
  can_edit_delete_clients: boolean;
}

// Offline queue entry
export interface OfflineAction {
  id: string;
  type: 'status_update' | 'comment' | 'task_create';
  payload: Record<string, unknown>;
  created_at: string;
  retryCount?: number;  // incremented on each failed sync attempt; discarded after 5
}

// Navigation param types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Onboarding: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  Create: { openSection?: 'clients' | 'services' | 'stages' } | undefined;
  Settings: undefined;
};

export interface StopRequirement {
  id: string;
  stop_id: string;
  title: string;
  req_type: string;
  notes?: string;
  is_completed: boolean;
  attachment_url?: string;
  attachment_name?: string;
  sort_order: number;
  created_by?: string;
  creator?: { name: string };
  created_at: string;
  updated_at: string;
}

export interface MinistryRequirement {
  id: string;
  ministry_id: string;
  title: string;
  req_type: string;
  notes?: string;
  sort_order: number;
  created_at: string;
}

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Account: undefined;
  ClientFieldsSettings: undefined;
  TeamMemberFields: undefined;
  TeamMembers: undefined;
  VisibilitySettings: undefined;
  MemberFileVisibility: { memberId: string; memberName: string; memberRole: string };
  FinancialReport: undefined;
  NotificationSettings: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  NewTask: { preselectedClientId?: string } | undefined;
  TaskDetail: { taskId: string };
  ClientFieldsSettings: undefined;
  TeamMemberFields: undefined;
  ClientProfile: { clientId: string };
  EditClient: { clientId: string };
  ServiceStages: { serviceId: string; serviceName: string };
  StageRequirements: { stopId: string; stageName: string; taskId: string };
  MinistryRequirements: { ministryId: string; ministryName: string };
  FinancialReport: undefined;
  GlobalSearch: { query?: string } | undefined;
  Account: undefined;
  Activity: undefined;
  NotificationSettings: undefined;
};
