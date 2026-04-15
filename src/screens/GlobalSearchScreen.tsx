// src/screens/GlobalSearchScreen.tsx
// Global search across clients, tasks, comments, and requirements

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { DashboardStackParamList } from '../types';

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

interface CommentResult {
  id: string;
  body: string;
  task_id: string;
  clientName: string;
}

interface RequirementResult {
  id: string;
  title: string;
  task_id: string;
  clientName: string;
}

interface ClientResult {
  id: string;
  name: string;
  phone?: string;
  client_id: string;
}

interface TaskResult {
  id: string;
  notes?: string;
  clientName: string;
  serviceName: string;
}

const EMPTY = {
  clients: [] as ClientResult[],
  tasks: [] as TaskResult[],
  comments: [] as CommentResult[],
  requirements: [] as RequirementResult[],
};

export default function GlobalSearchScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(EMPTY);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const like = `%${q.trim()}%`;
      const [clientsRes, tasksRes, commentsRes, reqsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, phone, client_id')
          .ilike('name', like)
          .limit(15),
        supabase
          .from('tasks')
          .select('id, notes, client:clients(id,name), service:services(name)')
          .ilike('notes', like)
          .limit(15),
        supabase
          .from('task_comments')
          .select('id, body, task_id, task:tasks(client:clients(name))')
          .ilike('body', like)
          .limit(15),
        supabase
          .from('stop_requirements')
          .select('id, title, route_stop:task_route_stops(task_id, task:tasks(client:clients(name)))')
          .ilike('title', like)
          .limit(15),
      ]);

      const clients: ClientResult[] = (clientsRes.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        client_id: c.client_id,
      }));

      // Build tasks from notes match
      const taskMap = new Map<string, TaskResult>();
      for (const t of (tasksRes.data ?? []) as any[]) {
        taskMap.set(t.id, {
          id: t.id,
          notes: t.notes,
          clientName: t.client?.name ?? '',
          serviceName: t.service?.name ?? '',
        });
      }

      // Also fetch tasks for matching clients (match by client name)
      if (clients.length > 0) {
        const clientIds = clients.map((c) => c.id);
        const { data: clientTasks } = await supabase
          .from('tasks')
          .select('id, notes, client:clients(id,name), service:services(name)')
          .in('client_id', clientIds)
          .limit(20);
        for (const t of (clientTasks ?? []) as any[]) {
          if (!taskMap.has(t.id)) {
            taskMap.set(t.id, {
              id: t.id,
              notes: t.notes,
              clientName: t.client?.name ?? '',
              serviceName: t.service?.name ?? '',
            });
          }
        }
      }

      const tasks = Array.from(taskMap.values());

      const comments: CommentResult[] = (commentsRes.data ?? []).map((c: any) => ({
        id: c.id,
        body: c.body,
        task_id: c.task_id,
        clientName: (c.task as any)?.client?.name ?? '',
      }));

      const requirements: RequirementResult[] = (reqsRes.data ?? [])
        .filter((r: any) => r.route_stop?.task_id)
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          task_id: r.route_stop?.task_id ?? '',
          clientName: (r.route_stop?.task as any)?.client?.name ?? '',
        }));

      setResults({ clients, tasks, comments, requirements });
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const hasResults =
    results.clients.length > 0 ||
    results.tasks.length > 0 ||
    results.comments.length > 0 ||
    results.requirements.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Search input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search clients, files, comments..."
          placeholderTextColor={theme.color.textMuted}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator color={theme.color.primary} style={s.spinner} />}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        {query.trim().length < 2 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🔍</Text>
            <Text style={s.emptyText}>Type at least 2 characters to search</Text>
          </View>
        ) : !loading && !hasResults ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>⊘</Text>
            <Text style={s.emptyText}>No results for "{query}"</Text>
          </View>
        ) : (
          <>
            {/* CLIENTS */}
            {results.clients.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>CLIENTS</Text>
                {results.clients.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={s.row}
                    onPress={() => navigation.navigate('ClientProfile', { clientId: c.id })}
                    activeOpacity={0.7}
                  >
                    <View style={s.rowIcon}>
                      <Text style={s.rowIconText}>{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={s.rowBody}>
                      <Text style={s.rowTitle}>{c.name}</Text>
                      {c.phone ? <Text style={s.rowSub}>{c.phone}</Text> : null}
                      <Text style={s.rowSub}>{c.client_id}</Text>
                    </View>
                    <Text style={s.rowArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* FILES */}
            {results.tasks.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>FILES</Text>
                {results.tasks.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={s.row}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })}
                    activeOpacity={0.7}
                  >
                    <View style={[s.rowIcon, s.rowIconFile]}>
                      <Text style={s.rowIconText}>📄</Text>
                    </View>
                    <View style={s.rowBody}>
                      <Text style={s.rowTitle}>{t.clientName}</Text>
                      <Text style={s.rowSub}>{t.serviceName}</Text>
                      {t.notes ? (
                        <Text style={s.rowSnippet} numberOfLines={1}>
                          {t.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={s.rowArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* COMMENTS */}
            {results.comments.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>COMMENTS</Text>
                {results.comments.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={s.row}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: c.task_id })}
                    activeOpacity={0.7}
                  >
                    <View style={[s.rowIcon, s.rowIconComment]}>
                      <Text style={s.rowIconText}>💬</Text>
                    </View>
                    <View style={s.rowBody}>
                      <Text style={s.rowTitle}>{c.clientName || 'Unknown file'}</Text>
                      <Text style={s.rowSnippet} numberOfLines={2}>
                        {c.body}
                      </Text>
                    </View>
                    <Text style={s.rowArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* REQUIREMENTS */}
            {results.requirements.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>REQUIREMENTS</Text>
                {results.requirements.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={s.row}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: r.task_id })}
                    activeOpacity={0.7}
                  >
                    <View style={[s.rowIcon, s.rowIconReq]}>
                      <Text style={s.rowIconText}>✓</Text>
                    </View>
                    <View style={s.rowBody}>
                      <Text style={s.rowTitle}>{r.title}</Text>
                      {r.clientName ? <Text style={s.rowSub}>{r.clientName}</Text> : null}
                    </View>
                    <Text style={s.rowArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
    paddingVertical:   theme.spacing.space2 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  input: {
    flex:              1,
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2 + 3,
    color:             theme.color.textPrimary,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  spinner: { marginStart: theme.spacing.space3 },
  scroll:  { paddingBottom: theme.spacing.space10 },
  emptyState: {
    alignItems: 'center',
    marginTop:  theme.spacing.space10,
    gap:        theme.spacing.space2,
  },
  emptyIcon: { fontSize: 40, color: theme.color.border },
  emptyText: { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', paddingHorizontal: theme.spacing.space6 },
  section: {
    marginTop: theme.spacing.space3,
  },
  sectionLabel: {
    ...theme.typography.sectionDivider,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2,
    backgroundColor:   theme.color.bgBase,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
    minHeight:         theme.touchTarget.min,
    backgroundColor:   theme.color.bgSurface,
    gap:               theme.spacing.space3,
  },
  rowIcon: {
    width:           38,
    height:          38,
    borderRadius:    theme.radius.full,
    backgroundColor: theme.color.primaryDim,
    justifyContent:  'center',
    alignItems:      'center',
  },
  rowIconFile:    { backgroundColor: theme.color.border },
  rowIconComment: { backgroundColor: theme.color.primaryDim + '88' },
  rowIconReq:     { backgroundColor: theme.color.successDim },
  rowIconText:    { fontSize: 16 },
  rowBody:        { flex: 1 },
  rowTitle:       { ...theme.typography.body, fontWeight: '700' },
  rowSub:         { ...theme.typography.caption, marginTop: 2 },
  rowSnippet:     { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 3, fontStyle: 'italic' },
  rowArrow:       { ...theme.typography.heading, color: theme.color.textMuted },
});
