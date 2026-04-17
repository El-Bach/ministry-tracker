// src/types/index.ts
// All shared TypeScript types matching the Supabase schema

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar_url?: string;
  email: string;
  push_token?: string;
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
  notes?: string;
  created_by?: string;
  creator?: { name: string };
  created_at: string;
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
  city_id?: string | null;
  city?: City | null;
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

// Offline queue entry
export interface OfflineAction {
  id: string;
  type: 'status_update' | 'comment' | 'task_create';
  payload: Record<string, unknown>;
  created_at: string;
}

// Navigation param types
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  Create: undefined;
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

export type DashboardStackParamList = {
  DashboardHome: undefined;
  NewTask: { preselectedClientId?: string } | undefined;
  TaskDetail: { taskId: string };
  ClientFieldsSettings: undefined;
  ClientProfile: { clientId: string };
  EditClient: { clientId: string };
  ServiceStages: { serviceId: string; serviceName: string };
  StageRequirements: { stopId: string; stageName: string; taskId: string };
  MinistryRequirements: { ministryId: string; ministryName: string };
  FinancialReport: undefined;
  GlobalSearch: { query?: string } | undefined;
};
