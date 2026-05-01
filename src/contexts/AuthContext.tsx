// src/contexts/AuthContext.tsx
// Single shared auth state for the entire app.
// All screens that call useAuth() read from the SAME instance — so when
// permissions update (role change via Realtime), every screen re-renders.

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import supabase from '../lib/supabase';
import { TeamMember, Organization, OrgPermissions } from '../types';
import { registerForPushNotifications } from '../lib/notifications';

// ─── Permission presets ──────────────────────────────────────────────────────

export const ALL_PERMISSIONS: OrgPermissions = {
  can_see_all_files: true, can_create_files: true, can_edit_file_details: true,
  can_delete_files: true, can_update_stage_status: true, can_add_edit_stages: true,
  can_see_file_financials: true,
  can_see_contract_price: true, can_see_financial_report: true, can_add_revenue: true,
  can_add_expenses: true, can_edit_contract_price: true, can_delete_transactions: true,
  can_upload_documents: true, can_delete_documents: true, can_manage_clients: true,
  can_add_comments: true, can_delete_comments: true, can_manage_catalog: true,
  can_edit_delete_clients: true,
};

const MEMBER_DEFAULTS: OrgPermissions = {
  can_see_all_files: true, can_create_files: true, can_edit_file_details: true,
  can_delete_files: false, can_update_stage_status: true, can_add_edit_stages: true,
  can_see_file_financials: false,
  can_see_contract_price: true, can_see_financial_report: false, can_add_revenue: true,
  can_add_expenses: true, can_edit_contract_price: false, can_delete_transactions: false,
  can_upload_documents: true, can_delete_documents: false, can_manage_clients: true,
  can_add_comments: true, can_delete_comments: false, can_manage_catalog: false,
  can_edit_delete_clients: false,
};

const VIEWER_DEFAULTS: OrgPermissions = {
  // Restrictive by default — viewer sees only files assigned to them,
  // cannot create/edit/delete files, cannot access financial data.
  // Matches VisibilitySettingsScreen.VIEWER_DEFAULTS exactly.
  can_see_all_files: false, can_create_files: false, can_edit_file_details: false,
  can_delete_files: false, can_update_stage_status: true, can_add_edit_stages: false,
  can_see_file_financials: false,
  can_see_contract_price: false, can_see_financial_report: false, can_add_revenue: false,
  can_add_expenses: true, can_edit_contract_price: false, can_delete_transactions: false,
  can_upload_documents: true, can_delete_documents: false, can_manage_clients: false,
  can_add_comments: true, can_delete_comments: false, can_manage_catalog: false,
  can_edit_delete_clients: false,
};

// ─── Helper ──────────────────────────────────────────────────────────────────

async function loadPermissionsForRole(
  role: string,
  orgId: string | null,
  setPermissions: (p: OrgPermissions) => void,
) {
  if (role === 'owner' || role === 'admin') {
    setPermissions(ALL_PERMISSIONS);
    return;
  }
  if (orgId) {
    const { data } = await supabase
      .from('org_visibility_settings')
      .select('*')
      .eq('org_id', orgId)
      .eq('role', role)
      .maybeSingle();
    setPermissions(data ?? (role === 'viewer' ? VIEWER_DEFAULTS : MEMBER_DEFAULTS));
  } else {
    setPermissions(role === 'viewer' ? VIEWER_DEFAULTS : MEMBER_DEFAULTS);
  }
}

// ─── Context shape ───────────────────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  teamMember: TeamMember | null;
  organization: Organization | null;
  permissions: OrgPermissions;
  loading: boolean;
  needsOnboarding: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  canManage: boolean;
  canView: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshTeamMember: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]         = useState<Session | null>(null);
  const [user, setUser]               = useState<User | null>(null);
  const [teamMember, setTeamMember]   = useState<TeamMember | null>(null);
  const [organization, setOrg]        = useState<Organization | null>(null);
  const [permissions, setPermissions] = useState<OrgPermissions>(VIEWER_DEFAULTS);
  const [loading, setLoading]         = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const roleChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const permChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Derived role booleans
  const role      = teamMember?.role ?? 'viewer';
  const isOwner   = role === 'owner';
  const isAdmin   = role === 'owner' || role === 'admin';
  const canManage = role === 'owner' || role === 'admin' || role === 'member';
  const canView   = true;

  // ── Auth listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchTeamMember(data.session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchTeamMember(sess.user);
      } else {
        setTeamMember(null);
        setOrg(null);
        setPermissions(VIEWER_DEFAULTS);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    // Re-check membership on every app foreground (catches deleted members + role changes)
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) fetchTeamMember(data.user);
        });
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      listener.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  // ── Realtime: instant role/permission update ──────────────────────────────
  // Subscribes to the current user's team_members row.
  // When owner changes their role, permissions update across ALL screens instantly.
  useEffect(() => {
    if (!teamMember?.id) return;

    const memberId = teamMember.id;
    const orgId    = teamMember.org_id ?? null;

    // Remove any existing channel before creating a new one
    if (roleChannelRef.current) {
      supabase.removeChannel(roleChannelRef.current);
      roleChannelRef.current = null;
    }

    const channel = supabase
      .channel(`role-watch-${memberId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_members', filter: `id=eq.${memberId}` },
        async (payload) => {
          const row = payload.new as any;

          // Member was soft-deleted — force immediate sign out
          if (row?.deleted_at) {
            await supabase.auth.signOut();
            return;
          }

          // Merge all updated fields (name, phone, role, etc.) into local state instantly
          setTeamMember((prev) => prev ? { ...prev, ...row } : prev);

          // If role changed, reload permissions
          const newRole = row?.role as string | undefined;
          if (newRole) {
            await loadPermissionsForRole(newRole, orgId, setPermissions);
          }
        },
      )
      .subscribe();

    roleChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      roleChannelRef.current = null;
    };
  }, [teamMember?.id]);

  // ── Realtime: instant visibility-settings update ──────────────────────────
  // Watches org_visibility_settings for the user's role.
  // When the owner toggles a permission, all members with that role get it immediately.
  useEffect(() => {
    const currentRole = teamMember?.role ?? 'viewer';
    const orgId       = teamMember?.org_id ?? null;

    // Owner/admin always have ALL_PERMISSIONS — no subscription needed
    if (!orgId || currentRole === 'owner' || currentRole === 'admin') return;

    if (permChannelRef.current) {
      supabase.removeChannel(permChannelRef.current);
      permChannelRef.current = null;
    }

    const channel = supabase
      .channel(`perm-watch-${orgId}-${currentRole}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'org_visibility_settings',
          filter: `org_id=eq.${orgId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          // Only reload if the changed row is for our role
          if (row?.role !== currentRole) return;
          await loadPermissionsForRole(currentRole, orgId, setPermissions);
        },
      )
      .subscribe();

    permChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      permChannelRef.current = null;
    };
  }, [teamMember?.org_id, teamMember?.role]);

  // ── Core fetch ────────────────────────────────────────────────────────────
  const fetchTeamMember = async (authUser: User) => {
    let data: any = null;
    try {
      const res1 = await supabase
        .from('team_members')
        .select('*')
        .eq('auth_id', authUser.id)
        .maybeSingle();
      if (res1.error) throw res1.error;
      data = res1.data;

      if (!data && authUser.email) {
        const res2 = await supabase
          .from('team_members')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle();
        if (res2.error) throw res2.error;
        data = res2.data;
        if (data && !data.auth_id) {
          supabase.from('team_members').update({ auth_id: authUser.id }).eq('id', data.id).then(() => {});
        }
      }
    } catch (e: any) {
      console.error('[AuthContext] fetchTeamMember error:', e);
      Alert.alert(
        'Connection Error',
        'Could not load your account. Please check your internet connection.',
        [{ text: 'Retry', onPress: () => fetchTeamMember(authUser) }],
      );
      setLoading(false);
      return;
    }

    if (data) {
      // Soft-deleted members are permanently blocked — sign them out immediately
      if ((data as any).deleted_at) {
        setTeamMember(null);
        setOrg(null);
        setNeedsOnboarding(false);
        setLoading(false);
        await supabase.auth.signOut();
        return;
      }

      setTeamMember(data as TeamMember);
      setNeedsOnboarding(false);

      if (data.org_id) {
        const { data: orgData } = await supabase
          .from('organizations').select('*').eq('id', data.org_id).maybeSingle();
        if (orgData) setOrg(orgData as Organization);
      }

      await loadPermissionsForRole(data.role ?? 'member', data.org_id ?? null, setPermissions);

      registerForPushNotifications().then((token) => {
        if (token && token !== data.push_token) {
          supabase.from('team_members').update({ push_token: token }).eq('id', data.id).then(() => {});
        }
      });
    } else {
      // No team_members row found.
      // If the auth user was JUST created (within 120s) OR onboarding flag not yet set,
      // show the onboarding wizard so they can complete setup.
      // Otherwise (stale/orphaned auth user) — sign out to avoid a stuck state.
      //
      // The primary signal is now `has_completed_onboarding` on the team_members row.
      // The 120s fallback guards against the window between auth.signUp() and the
      // register_new_org RPC completing (race condition on slow networks).
      const createdAt     = authUser.created_at ? new Date(authUser.created_at).getTime() : 0;
      const isVeryNew     = Date.now() - createdAt < 120_000;
      if (isVeryNew) {
        setTeamMember(null);
        setOrg(null);
        setNeedsOnboarding(true);
      } else {
        setTeamMember(null);
        setOrg(null);
        setNeedsOnboarding(false);
        await supabase.auth.signOut();
      }
    }

    setLoading(false);
  };

  const refreshTeamMember = async () => {
    if (user) await fetchTeamMember(user);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthContextValue = {
    session, user, teamMember, organization, permissions, loading, needsOnboarding,
    isOwner, isAdmin, canManage, canView,
    signIn, signOut, refreshTeamMember,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
