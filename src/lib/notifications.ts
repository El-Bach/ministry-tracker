// src/lib/notifications.ts
// Push notification utilities — token registration + Expo Push API sender

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Request permission and return the Expo push token (or null if denied/unavailable)
export async function registerForPushNotifications(): Promise<string | null> {
  try {
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
