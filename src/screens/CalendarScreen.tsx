// src/screens/CalendarScreen.tsx
// Calendar view: task due dates + stage due dates as marked dots; tap to see items due that day

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { Task, StatusLabel, DashboardStackParamList } from '../types';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

interface StopWithTask {
  id: string;
  due_date: string;
  task_id: string;
  ministry?: { name: string } | null;
  task?: {
    id: string;
    current_status: string;
    assigned_to?: string | null;
    client?: { name: string } | null;
    service?: { name: string } | null;
  } | null;
}

type FileFilter = 'all' | 'mine';

export default function CalendarScreen() {
  const navigation = useNavigation<Nav>();
  const { teamMember } = useAuth();
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stops, setStops] = useState<StopWithTask[]>([]);
  const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [currentMonth, setCurrentMonth] = useState<string>(todayStr);
  const [calendarKey, setCalendarKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');

  const fetchData = useCallback(async () => {
    const [tasksRes, labelsRes, stopsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, client:clients(*), service:services(*), assignee:team_members!assigned_to(*)')
        .not('due_date', 'is', null),
      supabase.from('status_labels').select('*'),
      supabase
        .from('task_route_stops')
        .select('id, due_date, task_id, ministry:ministries(name), task:tasks!task_id(id, current_status, assigned_to, client:clients(name), service:services(name))')
        .not('due_date', 'is', null),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (labelsRes.data) setStatusLabels(labelsRes.data as StatusLabel[]);
    if (stopsRes.data) setStops(stopsRes.data as unknown as StopWithTask[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const getStatusColor = (label: string) =>
    statusLabels.find((s) => s.label === label)?.color ?? '#6366f1';

  // Apply My Files filter
  const filteredTasks = fileFilter === 'mine' && teamMember
    ? tasks.filter(t => t.assigned_to === teamMember.id)
    : tasks;

  const filteredStops = fileFilter === 'mine' && teamMember
    ? stops.filter(s => s.task?.assigned_to === teamMember.id)
    : stops;

  // Build marked dates — task due dates + stage due dates
  const markedDates: Record<string, { dots: Array<{ color: string }> }> = {};

  filteredTasks.forEach((task) => {
    if (!task.due_date) return;
    if (!markedDates[task.due_date]) markedDates[task.due_date] = { dots: [] };
    if (markedDates[task.due_date].dots.length < 3)
      markedDates[task.due_date].dots.push({ color: getStatusColor(task.current_status) });
  });

  filteredStops.forEach((stop) => {
    if (!stop.due_date) return;
    const isOverdue = stop.due_date < todayStr && stop.task?.current_status !== 'Done';
    if (!markedDates[stop.due_date]) markedDates[stop.due_date] = { dots: [] };
    if (markedDates[stop.due_date].dots.length < 3)
      markedDates[stop.due_date].dots.push({ color: isOverdue ? theme.color.danger : theme.color.warning });
  });

  // Add selected date marker
  const selectedMarking = markedDates[selectedDate]
    ? { ...markedDates[selectedDate], selected: true, selectedColor: theme.color.primary }
    : { selected: true, selectedColor: theme.color.primary };

  const calendarMarks = { ...markedDates, [selectedDate]: selectedMarking };

  // Items for selected date
  const tasksForDate = filteredTasks.filter((t) => t.due_date === selectedDate);
  const stopsForDate = filteredStops.filter((s) => s.due_date === selectedDate);
  const totalCount = tasksForDate.length + stopsForDate.length;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={s.title}>{t('calendar')}</Text>
        <TouchableOpacity
          style={s.todayBtn}
          onPress={() => {
            setSelectedDate(todayStr);
            setCurrentMonth(todayStr);
            setCalendarKey(k => k + 1); // force Calendar remount at today
          }}
        >
          <Text style={s.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* My Files / All Files filter */}
      <View style={s.filterRow}>
        <TouchableOpacity
          style={[s.filterChip, fileFilter === 'all' && s.filterChipActive]}
          onPress={() => setFileFilter('all')}
        >
          <Text style={[s.filterChipText, fileFilter === 'all' && s.filterChipTextActive]}>
            {t('allFiles')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterChip, fileFilter === 'mine' && s.filterChipActive]}
          onPress={() => setFileFilter('mine')}
        >
          <Text style={[s.filterChipText, fileFilter === 'mine' && s.filterChipTextActive]}>
            {t('myFiles')}
          </Text>
        </TouchableOpacity>
      </View>

      <Calendar
        key={calendarKey}
        firstDay={1}
        markingType="multi-dot"
        markedDates={calendarMarks}
        current={currentMonth}
        onMonthChange={(month: { dateString: string }) => setCurrentMonth(month.dateString)}
        onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
        theme={{
          backgroundColor: theme.color.bgBase,
          calendarBackground: theme.color.bgBase,
          textSectionTitleColor: theme.color.textMuted,
          selectedDayBackgroundColor: theme.color.primary,
          selectedDayTextColor: theme.color.white,
          todayTextColor: theme.color.primaryText,
          dayTextColor: theme.color.textSecondary,
          textDisabledColor: theme.color.border,
          dotColor: theme.color.primary,
          selectedDotColor: theme.color.white,
          arrowColor: theme.color.primary,
          monthTextColor: theme.color.textPrimary,
          textDayFontWeight: '600',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 14,
          textMonthFontSize: 16,
        }}
        style={s.calendar}
      />

      {/* Date header */}
      <View style={s.dateHeader}>
        <Text style={s.dateTitle}>
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </Text>
        <Text style={s.dateCount}>
          {totalCount} item{totalCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {totalCount === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>
              {t('noEventsToday')}
            </Text>
          </View>
        ) : (
          <>
            {/* ── File due dates ── */}
            {tasksForDate.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={s.eventCard}
                onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
                activeOpacity={0.75}
              >
                <View style={[s.eventStripe, { backgroundColor: getStatusColor(task.current_status) }]} />
                <View style={s.eventBody}>
                  <View style={s.eventTop}>
                    <Text style={s.eventClient} numberOfLines={1}>{task.client?.name}</Text>
                    <StatusBadge
                      label={task.current_status}
                      color={getStatusColor(task.current_status)}
                      small
                    />
                  </View>
                  <Text style={s.eventService}>{task.service?.name}</Text>
                  {task.due_date && (
                    <Text style={s.eventDue}>
                      {t('dueDate')}: {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                  <Text style={s.eventAssignee}>
                    Assigned: {task.assignee?.name ?? 'Unassigned'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* ── Stage due dates ── */}
            {stopsForDate.map((stop) => {
              const isOverdue = stop.due_date < todayStr && stop.task?.current_status !== 'Done';
              return (
              <TouchableOpacity
                key={stop.id}
                style={[s.stageCard, isOverdue && s.stageCardOverdue]}
                onPress={() => stop.task?.id && navigation.navigate('TaskDetail', { taskId: stop.task.id })}
                activeOpacity={0.75}
              >
                <View style={[s.stageStripe, isOverdue && { backgroundColor: theme.color.danger }]} />
                <View style={s.eventBody}>
                  <View style={s.eventTop}>
                    <Text style={s.eventClient} numberOfLines={1}>
                      {stop.task?.client?.name ?? '—'}
                    </Text>
                    <View style={s.stagePill}>
                      <Text style={s.stagePillText}>📋 {t('stageDue')}</Text>
                    </View>
                  </View>
                  <Text style={s.eventService}>{stop.task?.service?.name ?? '—'}</Text>
                  <Text style={s.stageLabel}>
                    {stop.ministry?.name ?? 'Stage'}
                  </Text>
                  {isOverdue && (
                    <Text style={s.overdueLabel}>⚠ {t('overdue')}</Text>
                  )}
                  {stop.task?.current_status && (
                    <StatusBadge
                      label={stop.task.current_status}
                      color={getStatusColor(stop.task.current_status)}
                      small
                    />
                  )}
                </View>
              </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space4,
    paddingBottom:     theme.spacing.space2,
  },
  title:    { ...theme.typography.heading, fontSize: 24, fontWeight: '800' },
  todayBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  todayBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },

  // My Files / All Files filter
  filterRow: {
    flexDirection:     'row',
    gap:               8,
    paddingHorizontal: theme.spacing.space4,
    paddingBottom:     theme.spacing.space3,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      theme.radius.xl,
    borderWidth:       1,
    borderColor:       theme.color.border,
    backgroundColor:   theme.color.bgSurface,
  },
  filterChipActive: {
    backgroundColor: theme.color.primary,
    borderColor:     theme.color.primary,
  },
  filterChipText: {
    fontSize:   13,
    fontWeight: '600',
    color:      theme.color.textSecondary,
  },
  filterChipTextActive: {
    color: theme.color.white,
  },

  calendar: { borderBottomWidth: 1, borderBottomColor: theme.color.bgSurface },
  dateHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  dateTitle: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '700' },
  dateCount: { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '600' },
  list:      { padding: theme.spacing.space4, gap: 0, paddingBottom: 40 },
  empty:     { alignItems: 'center', paddingVertical: 40 },
  emptyText: { ...theme.typography.body, color: theme.color.border },

  // File due date card
  eventCard: {
    flexDirection:   'row',
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    marginBottom:    10,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  eventStripe: { width: 4 },
  eventBody: { flex: 1, padding: theme.spacing.space3, gap: 4 },
  eventTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    gap:            theme.spacing.space2,
  },
  eventClient:   { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  eventService:  { ...theme.typography.body, color: theme.color.textSecondary },
  eventDue:      { ...theme.typography.label, color: theme.color.warning, fontWeight: '600' },
  eventAssignee: { ...theme.typography.label, color: theme.color.textMuted },

  // Stage due date card
  stageCard: {
    flexDirection:   'row',
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    marginBottom:    10,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     theme.color.warning + '55',
  },
  stageStripe: { width: 4, backgroundColor: theme.color.warning },
  stagePill: {
    backgroundColor: theme.color.warning + '22',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth:     1,
    borderColor:     theme.color.warning + '55',
  },
  stagePillText: { color: theme.color.warning, fontSize: 11, fontWeight: '700' },
  stageLabel:    { ...theme.typography.label, color: theme.color.warning, fontWeight: '600' },
  stageCardOverdue: {
    backgroundColor: theme.color.danger + '18',
    borderColor:     theme.color.danger + '55',
  },
  overdueLabel: { ...theme.typography.caption, color: theme.color.danger, fontWeight: '700' },
});
