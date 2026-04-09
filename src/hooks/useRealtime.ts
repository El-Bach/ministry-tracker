// src/hooks/useRealtime.ts
// Subscribe to Supabase realtime changes on tasks, stops, and comments

import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../lib/supabase';

type ChangeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) => void;

let channelCounter = 0;

export function useRealtime(onChange: ChangeCallback) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelName = useRef(`ministry-tracker-${++channelCounter}`);

  useEffect(() => {
    // Remove any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => onChange({ ...payload, table: 'tasks' } as Parameters<ChangeCallback>[0])
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_route_stops' },
        (payload) =>
          onChange({ ...payload, table: 'task_route_stops' } as Parameters<ChangeCallback>[0])
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments' },
        (payload) =>
          onChange({ ...payload, table: 'task_comments' } as Parameters<ChangeCallback>[0])
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);
}
