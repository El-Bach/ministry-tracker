// src/screens/GlobalSearchScreen.tsx
// Truly global search: clients, files, documents, comments, requirements,
// transactions, external contacts, and team members

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { DashboardStackParamList } from '../types';
import { useAuth } from '../hooks/useAuth';

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

// ─── Result interfaces ────────────────────────────────────────
interface ClientResult   { id: string; name: string; phone?: string; client_id: string }
interface TaskResult     { id: string; notes?: string; clientName: string; serviceName: string; status: string }
interface DocumentResult { id: string; display_name: string; task_id: string; clientName: string; serviceName: string }
interface CommentResult  { id: string; body: string; task_id: string; clientName: string; actorName: string }
interface RequirementResult { id: string; title: string; task_id: string; clientName: string; isCompleted: boolean }
interface TransactionResult { id: string; description: string; type: 'expense' | 'revenue'; amount_usd: number; task_id: string; clientName: string }
interface ContactResult  { id: string; name: string; phone?: string; reference?: string; reference_phone?: string }
interface MemberResult   { id: string; name: string; email: string; role: string; phone?: string }

interface AllResults {
  clients:      ClientResult[];
  tasks:        TaskResult[];
  documents:    DocumentResult[];
  comments:     CommentResult[];
  requirements: RequirementResult[];
  transactions: TransactionResult[];
  contacts:     ContactResult[];
  members:      MemberResult[];
}

const EMPTY: AllResults = {
  clients: [], tasks: [], documents: [], comments: [],
  requirements: [], transactions: [], contacts: [], members: [],
};

// ─── Phone press helper ───────────────────────────────────────
function handlePhonePress(phone: string) {
  const clean = phone.replace(/\s/g, '');
  Alert.alert(phone, undefined, [
    { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
    { text: '💬 WhatsApp',   onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

// ─── Section wrapper ──────────────────────────────────────────
function Section({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionLabel}>{label}</Text>
        <View style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{count}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

// ─── Row component ────────────────────────────────────────────
function ResultRow({
  icon, iconBg, title, sub, snippet, right, onPress,
}: {
  icon: string; iconBg?: string; title: string; sub?: string;
  snippet?: string; right?: React.ReactNode; onPress?: () => void;
}) {
  const Inner = (
    <View style={s.row}>
      <View style={[s.rowIcon, iconBg ? { backgroundColor: iconBg } : undefined]}>
        <Text style={s.rowIconText}>{icon}</Text>
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        {sub     ? <Text style={s.rowSub}     numberOfLines={1}>{sub}</Text>     : null}
        {snippet ? <Text style={s.rowSnippet} numberOfLines={2}>{snippet}</Text> : null}
      </View>
      {right ?? <Text style={s.rowArrow}>›</Text>}
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{Inner}</TouchableOpacity>;
  return Inner;
}

// ─── Main screen ──────────────────────────────────────────────
export default function GlobalSearchScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { permissions, teamMember } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AllResults>(EMPTY);

  const totalCount = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults(EMPTY); setLoading(false); return; }
    const orgId = teamMember?.org_id;
    if (!orgId) { setResults(EMPTY); setLoading(false); return; }
    setLoading(true);
    try {
      const like = `%${q.trim()}%`;

      const [
        clientsRes, notesTasksRes, commentsRes, reqsRes,
        docsRes, txRes, contactsRes, membersRes,
        serviceRes,
      ] = await Promise.all([
        // 1. Clients by name, phone, reference, client_id
        supabase.from('clients')
          .select('id, name, phone, client_id, reference_name')
          .eq('org_id', orgId)
          .or(`name.ilike.${like},phone.ilike.${like},reference_name.ilike.${like},client_id.ilike.${like}`)
          .limit(15),

        // 2. Tasks by notes
        supabase.from('tasks')
          .select('id, notes, current_status, client:clients(id,name), service:services(name)')
          .eq('org_id', orgId)
          .ilike('notes', like)
          .limit(15),

        // 3. Comments — filter via inner-join on tasks.org_id
        supabase.from('task_comments')
          .select('id, body, task_id, author:team_members(name), task:tasks!inner(org_id, client:clients(name))')
          .eq('task.org_id', orgId)
          .ilike('body', like)
          .limit(15),

        // 4. Stage requirements — filter via inner-join chain through task_route_stops → tasks
        supabase.from('stop_requirements')
          .select('id, title, is_completed, route_stop:task_route_stops!inner(task_id, task:tasks!inner(org_id, client:clients(name)))')
          .eq('route_stop.task.org_id', orgId)
          .ilike('title', like)
          .limit(15),

        // 5. Documents by display_name or file_name — filter via inner-join on tasks.org_id
        supabase.from('task_documents')
          .select('id, display_name, file_name, task_id, task:tasks!inner(org_id, client:clients(name), service:services(name))')
          .eq('task.org_id', orgId)
          .or(`display_name.ilike.${like},file_name.ilike.${like}`)
          .limit(15),

        // 6. Transactions by description — filter via inner-join on tasks.org_id
        supabase.from('file_transactions')
          .select('id, description, type, amount_usd, task_id, task:tasks!inner(org_id, client:clients(name))')
          .eq('task.org_id', orgId)
          .ilike('description', like)
          .limit(15),

        // 7. External contacts (assignees)
        supabase.from('assignees')
          .select('id, name, phone, reference, reference_phone')
          .eq('org_id', orgId)
          .or(`name.ilike.${like},phone.ilike.${like},reference.ilike.${like}`)
          .limit(15),

        // 8. Team members
        supabase.from('team_members')
          .select('id, name, email, role, phone')
          .eq('org_id', orgId)
          .or(`name.ilike.${like},email.ilike.${like}`)
          .limit(10),

        // 9. Services by name → get tasks with that service
        supabase.from('services')
          .select('id')
          .eq('org_id', orgId)
          .ilike('name', like)
          .limit(10),
      ]);

      // ── Clients ──────────────────────────────────────────────
      const clients: ClientResult[] = (clientsRes.data ?? []).map((c: any) => ({
        id: c.id, name: c.name, phone: c.phone, client_id: c.client_id,
      }));

      // ── Tasks: merge notes match + client tasks + service name tasks ──
      const taskMap = new Map<string, TaskResult>();
      const addTask = (t: any) => {
        if (!taskMap.has(t.id)) taskMap.set(t.id, {
          id: t.id, notes: t.notes,
          clientName:  t.client?.name  ?? '',
          serviceName: t.service?.name ?? '',
          status: t.current_status ?? '',
        });
      };
      for (const t of (notesTasksRes.data ?? []) as any[]) addTask(t);

      // Tasks for matching clients
      if (clients.length) {
        const { data: clientTasks } = await supabase.from('tasks')
          .select('id, notes, current_status, client:clients(id,name), service:services(name)')
          .eq('org_id', orgId)
          .in('client_id', clients.map((c) => c.id))
          .limit(20);
        for (const t of (clientTasks ?? []) as any[]) addTask(t);
      }

      // Tasks for matching services
      if ((serviceRes.data ?? []).length) {
        const serviceIds = (serviceRes.data as any[]).map((s) => s.id);
        const { data: svcTasks } = await supabase.from('tasks')
          .select('id, notes, current_status, client:clients(id,name), service:services(name)')
          .eq('org_id', orgId)
          .in('service_id', serviceIds)
          .limit(20);
        for (const t of (svcTasks ?? []) as any[]) addTask(t);
      }

      const tasks = Array.from(taskMap.values());

      // ── Documents ─────────────────────────────────────────────
      const documents: DocumentResult[] = (docsRes.data ?? []).map((d: any) => ({
        id: d.id,
        display_name:  d.display_name ?? d.file_name,
        task_id:       d.task_id,
        clientName:  (d.task as any)?.client?.name  ?? '',
        serviceName: (d.task as any)?.service?.name ?? '',
      }));

      // ── Comments ──────────────────────────────────────────────
      const comments: CommentResult[] = (commentsRes.data ?? []).map((c: any) => ({
        id: c.id, body: c.body, task_id: c.task_id,
        clientName: (c.task as any)?.client?.name ?? '',
        actorName:  (c.author as any)?.name        ?? '',
      }));

      // ── Requirements ──────────────────────────────────────────
      const requirements: RequirementResult[] = (reqsRes.data ?? [])
        .filter((r: any) => r.route_stop?.task_id)
        .map((r: any) => ({
          id: r.id, title: r.title,
          task_id:     r.route_stop?.task_id ?? '',
          clientName:  (r.route_stop?.task as any)?.client?.name ?? '',
          isCompleted: r.is_completed ?? false,
        }));

      // ── Transactions ──────────────────────────────────────────
      const transactions: TransactionResult[] = (txRes.data ?? []).map((t: any) => ({
        id: t.id, description: t.description,
        type:       t.type,
        amount_usd: t.amount_usd,
        task_id:    t.task_id,
        clientName: (t.task as any)?.client?.name ?? '',
      }));

      // ── Contacts ──────────────────────────────────────────────
      const contacts: ContactResult[] = (contactsRes.data ?? []).map((c: any) => ({
        id: c.id, name: c.name, phone: c.phone,
        reference: c.reference, reference_phone: c.reference_phone,
      }));

      // ── Members ───────────────────────────────────────────────
      const members: MemberResult[] = (membersRes.data ?? []).map((m: any) => ({
        id: m.id, name: m.name, email: m.email, role: m.role, phone: m.phone,
      }));

      // ── Task visibility filter ─────────────────────────────────
      // Build the set of task IDs that are blocked from this member
      const blocksRes = teamMember?.id
        ? await supabase.from('file_visibility_blocks').select('task_id').eq('team_member_id', teamMember.id)
        : { data: [] };
      const blockedIds = new Set<string>((blocksRes.data ?? []).map((b: any) => b.task_id as string));

      // If can_see_all_files is false, build an allowlist from task + stage assignments
      let allowedTaskIds: Set<string> | null = null;
      if (!permissions.can_see_all_files && teamMember?.id) {
        const [assignedTasksRes, assignedStagesRes] = await Promise.all([
          supabase.from('tasks').select('id').eq('assigned_to', teamMember.id),
          supabase.from('task_route_stops').select('task_id').eq('assigned_to', teamMember.id),
        ]);
        allowedTaskIds = new Set<string>();
        (assignedTasksRes.data ?? []).forEach((t: any) => allowedTaskIds!.add(t.id as string));
        (assignedStagesRes.data ?? []).forEach((s: any) => allowedTaskIds!.add(s.task_id as string));
        // Remove explicitly-blocked IDs from allowlist
        for (const id of blockedIds) allowedTaskIds.delete(id);
      }

      const isTaskVisible = (taskId: string): boolean => {
        if (blockedIds.has(taskId)) return false;
        if (allowedTaskIds !== null && !allowedTaskIds.has(taskId)) return false;
        return true;
      };

      setResults({
        clients,
        tasks:        tasks.filter((t) => isTaskVisible(t.id)),
        documents:    documents.filter((d) => isTaskVisible(d.task_id)),
        comments:     comments.filter((c) => isTaskVisible(c.task_id)),
        requirements: requirements.filter((r) => isTaskVisible(r.task_id)),
        transactions: transactions.filter((t) => isTaskVisible(t.task_id)),
        contacts,
        members,
      });
    } finally {
      setLoading(false);
    }
  }, [permissions, teamMember]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults(EMPTY); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const hasResults = totalCount > 0;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Search bar */}
      <View style={s.inputRow}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchInput")}
          placeholderTextColor={theme.color.textMuted}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator color={theme.color.primary} style={s.spinner} />}
      </View>

      {/* Result summary pill */}
      {!loading && hasResults && (
        <View style={s.summaryRow}>
          <Text style={s.summaryText}>{totalCount} result{totalCount !== 1 ? 's' : ''} for "{query.trim()}"</Text>
        </View>
      )}

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        {query.trim().length < 2 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🔍</Text>
            <Text style={s.emptyTitle}>Search Everything</Text>
            <Text style={s.emptyText}>
              Clients · Files · Documents · Comments{'\n'}
              Requirements · Transactions · Contacts · Team
            </Text>
          </View>
        ) : !loading && !hasResults ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>⊘</Text>
            <Text style={s.emptyTitle}>No results</Text>
            <Text style={s.emptyText}>Nothing matched "{query.trim()}"</Text>
          </View>
        ) : (
          <>
            {/* CLIENTS */}
            {results.clients.length > 0 && (
              <Section label="CLIENTS" count={results.clients.length}>
                {results.clients.map((c) => (
                  <ResultRow
                    key={c.id}
                    icon={c.name.charAt(0).toUpperCase()}
                    iconBg={theme.color.primary}
                    title={c.name}
                    sub={[c.client_id, c.phone].filter(Boolean).join('  ·  ')}
                    onPress={() => navigation.navigate('ClientProfile', { clientId: c.id })}
                  />
                ))}
              </Section>
            )}

            {/* FILES */}
            {results.tasks.length > 0 && (
              <Section label="FILES" count={results.tasks.length}>
                {results.tasks.map((t) => (
                  <ResultRow
                    key={t.id}
                    icon="📄"
                    iconBg={theme.color.border}
                    title={t.clientName || 'Unknown client'}
                    sub={t.serviceName}
                    snippet={t.notes ? t.notes : undefined}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}
                  />
                ))}
              </Section>
            )}

            {/* DOCUMENTS */}
            {results.documents.length > 0 && (
              <Section label="DOCUMENTS" count={results.documents.length}>
                {results.documents.map((d) => (
                  <ResultRow
                    key={d.id}
                    icon="🖼"
                    iconBg={theme.color.infoDim ?? theme.color.bgSurface}
                    title={d.display_name}
                    sub={[d.clientName, d.serviceName].filter(Boolean).join('  ·  ')}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: d.task_id })}
                  />
                ))}
              </Section>
            )}

            {/* COMMENTS */}
            {results.comments.length > 0 && (
              <Section label="COMMENTS" count={results.comments.length}>
                {results.comments.map((c) => (
                  <ResultRow
                    key={c.id}
                    icon="💬"
                    iconBg={theme.color.primaryDim}
                    title={c.clientName || 'Unknown file'}
                    sub={c.actorName}
                    snippet={c.body}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: c.task_id })}
                  />
                ))}
              </Section>
            )}

            {/* REQUIREMENTS */}
            {results.requirements.length > 0 && (
              <Section label="REQUIREMENTS" count={results.requirements.length}>
                {results.requirements.map((r) => (
                  <ResultRow
                    key={r.id}
                    icon={r.isCompleted ? '☑' : '☐'}
                    iconBg={r.isCompleted ? theme.color.successDim : theme.color.border}
                    title={r.title}
                    sub={r.clientName}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: r.task_id })}
                  />
                ))}
              </Section>
            )}

            {/* TRANSACTIONS */}
            {results.transactions.length > 0 && (
              <Section label="TRANSACTIONS" count={results.transactions.length}>
                {results.transactions.map((t) => (
                  <ResultRow
                    key={t.id}
                    icon={t.type === 'expense' ? '💸' : '💰'}
                    iconBg={t.type === 'expense' ? theme.color.danger + '22' : theme.color.successDim}
                    title={t.description}
                    sub={`${t.clientName}  ·  $${t.amount_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}  ·  ${t.type}`}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: t.task_id })}
                  />
                ))}
              </Section>
            )}

            {/* CONTACTS (external assignees) */}
            {results.contacts.length > 0 && (
              <Section label="CONTACTS" count={results.contacts.length}>
                {results.contacts.map((c) => (
                  <ResultRow
                    key={c.id}
                    icon="👤"
                    iconBg={theme.color.warning + '33'}
                    title={c.name}
                    sub={c.phone ?? c.reference}
                    right={
                      c.phone ? (
                        <TouchableOpacity
                          style={s.phoneBtn}
                          onPress={() => handlePhonePress(c.phone!)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.phoneBtnText}>📞</Text>
                        </TouchableOpacity>
                      ) : undefined
                    }
                  />
                ))}
              </Section>
            )}

            {/* TEAM MEMBERS */}
            {results.members.length > 0 && (
              <Section label="TEAM" count={results.members.length}>
                {results.members.map((m) => (
                  <ResultRow
                    key={m.id}
                    icon={m.name.charAt(0).toUpperCase()}
                    iconBg={theme.color.primary + '88'}
                    title={m.name}
                    sub={[m.role, m.email].join('  ·  ')}
                    right={
                      m.phone ? (
                        <TouchableOpacity
                          style={s.phoneBtn}
                          onPress={() => handlePhonePress(m.phone!)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.phoneBtnText}>📞</Text>
                        </TouchableOpacity>
                      ) : <View style={{ width: 20 }} />
                    }
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bgBase },

  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    gap:               theme.spacing.space2,
  },
  searchIcon: { fontSize: 18 },
  input: {
    flex:              1,
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2 + 2,
    color:             theme.color.textPrimary,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  spinner: { marginStart: theme.spacing.space2 },

  summaryRow: {
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   6,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  summaryText: { ...theme.typography.caption, color: theme.color.textMuted },

  scroll: { paddingBottom: 60 },

  emptyState: {
    alignItems: 'center',
    marginTop:  50,
    gap:        theme.spacing.space2,
    paddingHorizontal: theme.spacing.space6,
  },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '700', fontSize: 16 },
  emptyText: {
    ...theme.typography.body,
    color:     theme.color.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  section:    { marginTop: theme.spacing.space3 },
  sectionHeaderRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2,
  },
  sectionLabel: {
    ...theme.typography.sectionDivider,
  },
  sectionBadge: {
    backgroundColor: theme.color.primary + '22',
    borderRadius:    10,
    paddingHorizontal: 7,
    paddingVertical:   1,
    borderWidth:     1,
    borderColor:     theme.color.primary + '44',
  },
  sectionBadgeText: { ...theme.typography.caption, color: theme.color.primaryText, fontWeight: '700' },

  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
    backgroundColor:   theme.color.bgSurface,
    gap:               theme.spacing.space3,
    minHeight:         56,
  },
  rowIcon: {
    width:           38,
    height:          38,
    borderRadius:    theme.radius.full,
    backgroundColor: theme.color.border,
    justifyContent:  'center',
    alignItems:      'center',
    flexShrink:      0,
  },
  rowIconText:  { fontSize: 16, color: theme.color.white, fontWeight: '700' },
  rowBody:      { flex: 1 },
  rowTitle:     { ...theme.typography.body, fontWeight: '700', fontSize: 14 },
  rowSub:       { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  rowSnippet:   { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 3, fontStyle: 'italic' },
  rowArrow:     { color: theme.color.textMuted, fontSize: 20, fontWeight: '600' },

  phoneBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: theme.color.success + '22',
    borderWidth:     1,
    borderColor:     theme.color.success + '55',
    justifyContent:  'center',
    alignItems:      'center',
  },
  phoneBtnText: { fontSize: 16 },
});
