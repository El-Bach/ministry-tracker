// src/hooks/useAuth.ts
// Auth state hook — exposes session, user, teamMember profile, organization, sign in/out
// Session 26 Phase 1: fetch teamMember by auth.uid(); expose Organization
// Session 26 Phase 2: role helpers (isOwner, isAdmin, canManage, canEdit, canView)

import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import supabase from '../lib/supabase';
import { TeamMember, Organization, OrgPermissions } from '../types';
import { registerForPushNotifications } from '../lib/notifications';

// Full permissions for owner/admin — no restrictions
const ALL_PERMISSIONS: OrgPermissions = {
  can_see_all_files: true, can_create_files: true, can_edit_file_details: true,
  can_delete_files: true, can_update_stage_status: true, can_add_edit_stages: true,
  can_see_contract_price: true, can_see_financial_report: true, can_add_revenue: true,
  can_add_expenses: true, can_edit_contract_price: true, can_delete_transactions: true,
  can_upload_documents: true, can_delete_documents: true, can_manage_clients: true,
  can_add_comments: true, can_delete_comments: true,
};

// Default permissions for member when no DB row exists
const MEMBER_DEFAULTS: OrgPermissions = {
  can_see_all_files: true, can_create_files: true, can_edit_file_details: true,
  can_delete_files: false, can_update_stage_status: true, can_add_edit_stages: true,
  can_see_contract_price: true, can_see_financial_report: false, can_add_revenue: true,
  can_add_expenses: true, can_edit_contract_price: false, can_delete_transactions: false,
  can_upload_documents: true, can_delete_documents: false, can_manage_clients: true,
  can_add_comments: true, can_delete_comments: false,
};

// Default permissions for viewer when no DB row exists
const VIEWER_DEFAULTS: OrgPermissions = {
  can_see_all_files: true, can_create_files: false, can_edit_file_details: false,
  can_delete_files: false, can_update_stage_status: true, can_add_edit_stages: false,
  can_see_contract_price: false, can_see_financial_report: false, can_add_revenue: false,
  can_add_expenses: false, can_edit_contract_price: false, can_delete_transactions: false,
  can_upload_documents: false, can_delete_documents: false, can_manage_clients: false,
  can_add_comments: false, can_delete_comments: false,
};

interface AuthState {
  session: Session | null;
  user: User | null;
  teamMember: TeamMember | null;
  organization: Organization | null;
  permissions: OrgPermissions;
  loading: boolean;
  needsOnboarding: boolean;   // true when logged in but no team_member row yet

  // Role helpers — derived from teamMember.role
  isOwner: boolean;     // role === 'owner'
  isAdmin: boolean;     // role === 'owner' | 'admin'
  canManage: boolean;   // can create/edit/delete records (owner | admin | member)
  canView: boolean;     // read-only minimum — all roles

  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshTeamMember: () => Promise<void>;
}

// Helper — fetch and apply permissions for a given role + org
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

export function useAuth(): AuthState {
  const [session, setSession]       = useState<Session | null>(null);
  const [user, setUser]             = useState<User | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [organization, setOrg]      = useState<Organization | null>(null);
  const [permissions, setPermissions] = useState<OrgPermissions>(ALL_PERMISSIONS);
  const [loading, setLoading]       = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Keep a ref to current teamMember so the realtime callback can read it
  const teamMemberRef = useRef<TeamMember | null>(null);
  useEffect(() => { teamMemberRef.current = teamMember; }, [teamMember]);

  // Derived role booleans
  const role      = teamMember?.role ?? 'viewer';
  const isOwner   = role === 'owner';
  const isAdmin   = role === 'owner' || role === 'admin';
  const canManage = role === 'owner' || role === 'admin' || role === 'member';
  const canView   = true; // all authenticated users can view

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
        setPermissions(ALL_PERMISSIONS);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });

    // AppState: re-check membership every time the app comes back to foreground.
    // If this user's team_members row was deleted while they were away,
    // fetchTeamMember will find no row and sign them out automatically.
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

  const fetchTeamMember = async (authUser: User) => {
    // Primary: look up by auth_id (multi-tenant)
    let { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('auth_id', authUser.id)
      .maybeSingle();

    // Fallback: legacy lookup by email (for users before migration_organizations.sql)
    if (!data && authUser.email) {
      const res = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();
      data = res.data;
      // Backfill auth_id automatically
      if (data && !data.auth_id) {
        supabase
          .from('team_members')
          .update({ auth_id: authUser.id })
          .eq('id', data.id)
          .then(() => {});
      }
    }

    if (data) {
      setTeamMember(data as TeamMember);
      setNeedsOnboarding(false);

      // Fetch organization
      if (data.org_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', data.org_id)
          .maybeSingle();
        if (orgData) setOrg(orgData as Organization);
      }

      // Load permissions — owner/admin always get full access
      await loadPermissionsForRole(data.role ?? 'member', data.org_id ?? null, setPermissions);

      // Register for push notifications
      registerForPushNotifications().then((token) => {
        if (token && token !== data.push_token) {
          supabase
            .from('team_members')
            .update({ push_token: token })
            .eq('id', data.id)
            .then(() => {});
        }
      });
    } else {
      // No team_member row found for this auth user.
      // Two cases:
      //   A) Brand-new registration — go to Onboarding (needsOnboarding = true)
      //   B) Member was removed from the org — sign them out immediately
      // Distinguish by checking if the auth account is less than 60 seconds old.
      const createdAt = authUser.created_at ? new Date(authUser.created_at).getTime() : 0;
      const isNewAccount = Date.now() - createdAt < 60_000;
      if (isNewAccount) {
        // Fresh registration — show onboarding wizard
        setTeamMember(null);
        setOrg(null);
        setNeedsOnboarding(true);
      } else {
        // Existing account with no team_member row → removed from org → sign out
        setTeamMember(null);
        setOrg(null);
        setNeedsOnboarding(false);
        await supabase.auth.signOut();
      }
    }

    setLoading(false);
  };

  // ── Realtime: watch for role changes on this user's team_members row ──
  // When the owner changes this user's role, permissions update immediately
  // without requiring sign-out or app restart.
  useEffect(() => {
    if (!teamMember?.id) return;

    const memberId = teamMember.id;
    const orgId    = teamMember.org_id ?? null;

    const channel = supabase
      .channel(`role-watch-${memberId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_members', filter: `id=eq.${memberId}` },
        async (payload) => {
          const newRole = (payload.new as any)?.role as string | undefined;
          if (!newRole) return;
          // Update teamMember state with the new role
          setTeamMember((prev) => prev ? { ...prev, role: newRole } : prev);
          // Reload permissions for the new role
          await loadPermissionsForRole(newRole, orgId, setPermissions);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamMember?.id]);

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

  return {
    session, user, teamMember, organization, permissions, loading, needsOnboarding,
    isOwner, isAdmin, canManage, canView,
    signIn, signOut, refreshTeamMember,
  };
}
