// src/store/offlineQueue.ts
// Persisted offline action queue — syncs when connection is restored

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineAction } from '../types';
import supabase from '../lib/supabase';

const QUEUE_KEY = 'offline_queue';

interface OfflineQueueState {
  queue: OfflineAction[];
  isOnline: boolean;
  isSyncing: boolean;
  setOnline: (online: boolean) => void;
  enqueue: (action: Omit<OfflineAction, 'id' | 'created_at'>) => Promise<void>;
  syncQueue: () => Promise<void>;
  loadQueue: () => Promise<void>;
}

export const useOfflineQueue = create<OfflineQueueState>((set, get) => ({
  queue: [],
  isOnline: true,
  isSyncing: false,

  setOnline: (online) => {
    set({ isOnline: online });
    if (online) {
      get().syncQueue();
    }
  },

  loadQueue: async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (raw) {
        set({ queue: JSON.parse(raw) });
      }
    } catch (e) {
      console.error('Failed to load offline queue', e);
    }
  },

  enqueue: async (action) => {
    const entry: OfflineAction = {
      ...action,
      id: `${Date.now()}-${Math.random()}`,
      created_at: new Date().toISOString(),
    };
    const newQueue = [...get().queue, entry];
    set({ queue: newQueue });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
  },

  syncQueue: async () => {
    const { queue, isSyncing } = get();
    if (isSyncing || queue.length === 0) return;

    set({ isSyncing: true });
    const remaining: OfflineAction[] = [];

    for (const action of queue) {
      try {
        if (action.type === 'status_update') {
          const { stopId, newStatus, taskId, updatedBy, gpsLat, gpsLng, oldStatus } =
            action.payload as {
              stopId: string;
              newStatus: string;
              taskId: string;
              updatedBy: string;
              gpsLat?: number;
              gpsLng?: number;
              oldStatus?: string;
            };

          const { error: stopError } = await supabase
            .from('task_route_stops')
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
              updated_by: updatedBy,
              gps_lat: gpsLat,
              gps_lng: gpsLng,
            })
            .eq('id', stopId);

          if (stopError) throw stopError;

          await supabase.from('status_updates').insert({
            task_id: taskId,
            stop_id: stopId,
            updated_by: updatedBy,
            old_status: oldStatus,
            new_status: newStatus,
            gps_lat: gpsLat,
            gps_lng: gpsLng,
          });

          await supabase
            .from('tasks')
            .update({ current_status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', taskId);
        } else if (action.type === 'comment') {
          const { taskId, authorId, body, gpsLat, gpsLng } = action.payload as {
            taskId: string;
            authorId: string;
            body: string;
            gpsLat?: number;
            gpsLng?: number;
          };
          const { error } = await supabase.from('task_comments').insert({
            task_id: taskId,
            author_id: authorId,
            body,
            gps_lat: gpsLat,
            gps_lng: gpsLng,
          });
          if (error) throw error;
        }
        // success — don't re-add
      } catch (e) {
        console.error('Sync failed for action', action.id, e);
        remaining.push(action); // keep for retry
      }
    }

    set({ queue: remaining, isSyncing: false });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  },
}));
