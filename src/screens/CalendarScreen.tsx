// src/screens/CalendarScreen.tsx
// Calendar view: tasks appear as marked dates, tap to see tasks due that day

import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { Task, StatusLabel, DashboardStackParamList } from '../types';
import StatusBadge from '../components/StatusBadge';

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

export default function CalendarScreen() {
  const navigation = useNavigation<Nav>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [tasksRes, labelsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, client:clients(*), service:services(*), assignee:team_members!assigned_to(*)')
        .not('due_date', 'is', null),
      supabase.from('status_labels').select('*'),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (labelsRes.data) setStatusLabels(labelsRes.data as StatusLabel[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusColor = (label: string) =>
    statusLabels.find((s) => s.label === label)?.color ?? '#6366f1';

  // Build marked dates for the calendar
  const markedDates: Record<string, { dots: Array<{ color: string }> }> = {};
  tasks.forEach((task) => {
    if (!task.due_date) return;
    const date = task.due_date;
    const color = getStatusColor(task.current_status);
    if (!markedDates[date]) {
      markedDates[date] = { dots: [] };
    }
    if (markedDates[date].dots.length < 3) {
      markedDates[date].dots.push({ color });
    }
  });

  // Add selected date marker
  const selectedMarking = markedDates[selectedDate]
    ? {
        ...markedDates[selectedDate],
        selected: true,
        selectedColor: theme.color.primary,
      }
    : { selected: true, selectedColor: theme.color.primary };

  const calendarMarks = {
    ...markedDates,
    [selectedDate]: selectedMarking,
  };

  // Tasks for selected date
  const tasksForDate = tasks.filter((t) => t.due_date === selectedDate);

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
        <Text style={s.title}>Calendar</Text>
      </View>

      <Calendar
        markingType="multi-dot"
        markedDates={calendarMarks}
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
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Text style={s.dateCount}>
          {tasksForDate.length} file{tasksForDate.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {tasksForDate.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>No files due on this date</Text>
          </View>
        ) : (
          tasksForDate.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={s.eventCard}
              onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
              activeOpacity={0.75}
            >
              <View style={[s.eventStripe, { backgroundColor: getStatusColor(task.current_status) }]} />
              <View style={s.eventBody}>
                <View style={s.eventTop}>
                  <Text style={s.eventClient} numberOfLines={1}>
                    {task.client?.name}
                  </Text>
                  <StatusBadge
                    label={task.current_status}
                    color={getStatusColor(task.current_status)}
                    small
                  />
                </View>
                <Text style={s.eventService}>{task.service?.name}</Text>
                {task.due_date && (
                  <Text style={s.eventDue}>
                    Due: {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
                <Text style={s.eventAssignee}>
                  Assigned: {task.assignee?.name ?? 'Unassigned'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  header: {
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space4,
    paddingBottom:     theme.spacing.space2,
  },
  title:    { ...theme.typography.heading, fontSize: 24, fontWeight: '800' },
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
  dateTitle:    { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '700' },
  dateCount:    { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '600' },
  list:         { padding: theme.spacing.space4, gap: 0, paddingBottom: 40 },
  empty:        { alignItems: 'center', paddingVertical: 40 },
  emptyText:    { ...theme.typography.body, color: theme.color.border },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    marginBottom:    10,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  eventStripe: { width: 4 },
  eventBody: {
    flex:    1,
    padding: theme.spacing.space3,
    gap:     4,
  },
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
});
