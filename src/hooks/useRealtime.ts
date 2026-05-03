// src/hooks/useRealtime.ts
// Subscribe to Supabase realtime changes scoped to the caller's org.
//
// IMPORTANT: pass `orgId` so the channel filters on `org_id=eq.{orgId}` —
// without it every change in every tenant fires to every client. RLS hides
// the row content but websocket bandwidth still scales O(orgs × users).
//
// Requires `migration_denormalize_org_id.sql` to add `org_id` columns to
// `task_route_stops` and `task_comments`. Realtime publication must include
// these columns (already on by default for `public` schema).

import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../lib/supabase';

type ChangeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) => void;

let channelCounter = 0;

export function useRealtime(onChange: ChangeCallback, orgId?: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelName = useRef(`ministry-tracker-${++channelCounter}`);

  useEffect(() => {
    // Don't subscribe until we know the org — prevents listening to every
    // tenant's changes during the brief auth-loading window.
    if (!orgId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const orgFilter = `org_id=eq.${orgId}`;

    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: orgFilter },
        (payload) => onChange({ ...payload, table: 'tasks' } as Parameters<ChangeCallback>[0])
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_route_stops', filter: orgFilter },
        (payload) =>
          onChange({ ...payload, table: 'task_route_stops' } as Parameters<ChangeCallback>[0])
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments', filter: orgFilter },
        (payload) =>
          onChange({ ...payload, table: 'task_comments' } as Parameters<ChangeCallback>[0])
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'file_visibility_blocks', filter: orgFilter },
        (payload) =>
          onChange({ ...payload, table: 'file_visibility_blocks' } as Parameters<ChangeCallback>[0])
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [orgId]);
}
