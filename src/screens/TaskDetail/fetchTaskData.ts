// src/screens/TaskDetail/fetchTaskData.ts
//
// Data layer for TaskDetailScreen — runs all the parallel Supabase queries
// needed to render the file detail page. Pulled out of the monolith as part
// of Phase 4 of the modular split (see ./README.md).
//
// The function returns a fully-populated `TaskDataBundle`. The caller owns
// React state setters and decides what to apply (this lets the parent stay
// in charge of optimistic-update semantics).

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Task, TaskComment, StatusLabel, TeamMember, City, Ministry, Service,
  MinistryContact,
} from '../../types';

export interface FetchedTransaction {
  id: string;
  task_id: string;
  type: 'expense' | 'revenue';
  description: string;
  amount_usd: number;
  amount_lbp: number;
  rate_usd_lbp?: number | null;
  stop_id?: string | null;
  stop?: { id: string; ministry?: { name: string } } | null;
  created_by?: string;
  creator?: { name: string };
  created_at: string;
}

export interface PriceHistoryEntry {
  id: string;
  old_price_usd: number;
  new_price_usd: number;
  old_price_lbp: number;
  new_price_lbp: number;
  note?: string | null;
  changer?: { name: string };
  created_at: string;
}

export interface StopHistoryEntry {
  id: string;
  task_id: string;
  stop_id?: string | null;
  old_status?: string | null;
  new_status: string;
  updater?: { name: string };
  created_at: string;
}

export interface TaskDataBundle {
  task: Task | null;
  comments: TaskComment[];
  statusLabels: StatusLabel[];
  allMembers: TeamMember[];
  allCities: City[];
  extAssignees: any[];
  stopHistories: Record<string, any[]>;
  transactions: FetchedTransaction[];
  priceHistory: PriceHistoryEntry[];
  documents: any[];
  allStages: Ministry[];
  allServices: Service[];
}

export async function fetchTaskData(
  supabase: SupabaseClient,
  taskId: string,
  orgId: string,
): Promise<TaskDataBundle> {
  const [taskRes, commentsRes, labelsRes, membersRes, citiesRes, assigneesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select(
        `*, client:clients(*), service:services(*), assignee:team_members!assigned_to(id,name,role,push_token),
         route_stops:task_route_stops(*, ministry:ministries(*, city:cities(id,name)), updater:team_members!updated_by(*), city:cities(id,name), assignee:team_members!assigned_to(id,name,role,push_token), ext_assignee:assignees!ext_assignee_id(id,name,phone))`,
      )
      .eq('id', taskId)
      .single(),
    supabase
      .from('task_comments')
      .select('*, author:team_members(*)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true }),
    supabase.from('status_labels').select('*').eq('org_id', orgId).order('sort_order'),
    supabase.from('team_members').select('*').eq('org_id', orgId).is('deleted_at', null).order('name'),
    supabase.from('cities').select('*').eq('org_id', orgId).order('name'),
    supabase.from('assignees').select('*, creator:team_members!created_by(name), city:cities(id,name)').eq('org_id', orgId).order('name'),
  ]);

  let task: Task | null = null;
  if (taskRes.data) {
    const t = taskRes.data as Task;
    if (t.route_stops) {
      t.route_stops = [...t.route_stops].sort((a, b) => a.stop_order - b.stop_order);

      // Per-stage selected ministry contacts. Done as a separate query (rather
      // than nested in the tasks select above) because Supabase's PostgREST
      // join syntax for many-to-many through a junction table is awkward; a
      // simple .in() query keeps things readable and is cheap (one round-trip).
      const stopIds = t.route_stops.map(s => s.id);
      if (stopIds.length > 0) {
        const { data: linkRows } = await supabase
          .from('stop_ministry_contacts')
          .select('stop_id, contact:ministry_contacts(*)')
          .in('stop_id', stopIds);
        if (linkRows) {
          const grouped: Record<string, MinistryContact[]> = {};
          for (const row of linkRows as any[]) {
            if (!row.contact) continue;
            (grouped[row.stop_id] ||= []).push(row.contact as MinistryContact);
          }
          for (const stop of t.route_stops) {
            stop.selected_contacts = grouped[stop.id] ?? [];
          }
        }
      }
    }
    task = t;
  }

  // Status update history grouped by stop
  const { data: statusHistData } = await supabase
    .from('status_updates')
    .select('*, updater:team_members!updated_by(*)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  const stopHistories: Record<string, StopHistoryEntry[]> = {};
  if (statusHistData) {
    for (const entry of statusHistData as StopHistoryEntry[]) {
      const key = entry.stop_id ?? 'task';
      if (!stopHistories[key]) stopHistories[key] = [];
      stopHistories[key].push(entry);
    }
  }

  // Financial transactions
  const { data: txData } = await supabase
    .from('file_transactions')
    .select('*, creator:team_members!created_by(name), stop:task_route_stops(id, ministry:ministries(name))')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  // Price history
  const { data: phData } = await supabase
    .from('task_price_history')
    .select('*, changer:team_members!changed_by(name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  // Task documents
  const { data: docsData } = await supabase
    .from('task_documents')
    .select('*, uploader:team_members!uploaded_by(name), requirement:stop_requirements!requirement_id(title)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  // Available stages + services
  const { data: stagesData } = await supabase
    .from('ministries')
    .select('*, city:cities(id,name)')
    .eq('org_id', orgId)
    .eq('type', 'parent')
    .order('name');

  const { data: servicesData } = await supabase
    .from('services')
    .select('*')
    .order('name');

  return {
    task,
    comments: (commentsRes.data ?? []) as TaskComment[],
    statusLabels: (labelsRes.data ?? []) as StatusLabel[],
    allMembers: (membersRes.data ?? []) as TeamMember[],
    allCities: (citiesRes.data ?? []) as City[],
    extAssignees: (assigneesRes.data ?? []) as any[],
    stopHistories,
    transactions: (txData ?? []) as FetchedTransaction[],
    priceHistory: (phData ?? []) as PriceHistoryEntry[],
    documents: (docsData ?? []) as any[],
    allStages: (stagesData ?? []) as Ministry[],
    allServices: (servicesData ?? []) as Service[],
  };
}
