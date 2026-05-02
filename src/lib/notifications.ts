// src/lib/notifications.ts
// Push notification utilities — token registration + Expo Push API sender

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Request permission and return the Expo push token (or null if denied/unavailable)
// Returns null silently inside Expo Go (SDK 53+: remote push removed from Expo Go)
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Expo Go no longer supports remote push notifications (SDK 53+).
    // getExpoPushTokenAsync() throws in Expo Go — detect and bail out silently.
    const isExpoGo = typeof expo !== 'undefined' &&
      (expo as any)?.modules?.ExpoConstants?.executionEnvironment === 'storeClient';
    if (isExpoGo) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    // Catches the Expo Go warning — returns null without crashing
    return null;
  }
}

// ─── Overdue task check ─────────────────────────────────────────────────────
// Called on app foreground. Fires a single grouped local notification if there
// are overdue files assigned to the current user. Throttled to once per day.

const OVERDUE_CHECK_KEY = '@overdue_last_check';
const TERMINAL_STATUSES = ['Done', 'Closed', 'Rejected'];

export async function checkAndNotifyOverdue(
  teamMemberId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<void> {
  try {
    // Throttle: skip if already checked today
    const today = new Date().toISOString().slice(0, 10);
    const lastCheck = await AsyncStorage.getItem(OVERDUE_CHECK_KEY);
    if (lastCheck === today) return;

    // Query overdue tasks (due_date < today, status not terminal, assigned to me)
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, current_status, due_date, clients(name), services(name)')
      .eq('assigned_to', teamMemberId)
      .lt('due_date', today)
      .not('current_status', 'in', `(${TERMINAL_STATUSES.map(s => `"${s}"`).join(',')})`)
      .eq('is_archived', false);

    if (error || !tasks?.length) {
      await AsyncStorage.setItem(OVERDUE_CHECK_KEY, today);
      return;
    }

    // Check notification permission
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const count = tasks.length;
    const firstTask = tasks[0] as any;
    const clientName = firstTask?.clients?.name ?? 'a client';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ ${count} Overdue File${count > 1 ? 's' : ''}`,
        body: count === 1
          ? `${clientName} · ${firstTask?.services?.name ?? ''} is past due`
          : `${clientName} and ${count - 1} other file${count - 1 > 1 ? 's' : ''} are past due`,
        sound: true,
        data: { type: 'overdue', count },
      },
      trigger: null, // fire immediately
    });

    await AsyncStorage.setItem(OVERDUE_CHECK_KEY, today);
  } catch {
    // Never block app startup
  }
}

// Send activity notification to ALL team members except the actor,
// respecting each recipient's notification_prefs row (if it exists).
// notifType: 'comment' | 'status' | 'file'
export async function sendActivityNotificationToAll(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  actorId: string | undefined | null,
  title: string,
  body: string,
  notifType: 'comment' | 'status' | 'file',
  data?: Record<string, unknown>
): Promise<void> {
  try {
    // 1. All team members with a push token, excluding the actor
    let query = supabase
      .from('team_members')
      .select('id, push_token')
      .not('push_token', 'is', null);
    if (actorId) query = query.neq('id', actorId);
    const { data: members } = await query;
    if (!members?.length) return;

    // 2. Fetch preferences for all recipients in one round-trip
    // Uses SECURITY DEFINER RPC because notification_prefs RLS only allows
    // each user to read their own row; the RPC validates org membership and
    // returns prefs for the requested team_member_ids that are in the same org.
    const memberIds = (members as { id: string; push_token: string }[]).map((m) => m.id);
    const { data: prefs } = await supabase
      .rpc('get_notification_prefs_for_send', { p_team_member_ids: memberIds });

    const prefsMap = new Map(
      ((prefs ?? []) as any[]).map((p) => [p.team_member_id as string, p])
    );

    // 3. Filter and send
    for (const member of members as { id: string; push_token: string }[]) {
      if (!member.push_token) continue;
      const pref = prefsMap.get(member.id) as any;
      if (pref) {
        if (!pref.enabled) continue;
        if (notifType === 'comment' && !pref.notify_comments) continue;
        if (notifType === 'status'  && !pref.notify_status_changes) continue;
        if (notifType === 'file'    && !pref.notify_new_files) continue;
        if (actorId && Array.isArray(pref.muted_actor_ids) && pref.muted_actor_ids.includes(actorId)) continue;
      }
      await sendPushNotification(member.push_token, title, body, data);
    }
  } catch {
    // Never block the main action
  }
}

// Send a push notification via Expo's push service — best-effort, never throws
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch('https://exp.host/--/push/v2/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data: data ?? {},
        sound: 'default',
      }),
    });
  } catch {
    // Push is best-effort — never block the main action
  }
}
