// src/hooks/useAuth.ts
// Auth state hook — exposes session, user, teamMember profile, organization, sign in/out
// Session 26 Phase 1: fetch teamMember by auth.uid(); expose Organization
// Session 26 Phase 2: role helpers (isOwner, isAdmin, canManage, canEdit, canView)

import { useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import supabase from '../lib/supabase';
import { TeamMember, Organization } from '../types';
import { registerForPushNotifications } from '../lib/notifications';

interface AuthState {
  session: Session | null;
  user: User | null;
  teamMember: TeamMember | null;
  organization: Organization | null;
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

export function useAuth(): AuthState {
  const [session, setSession]       = useState<Session | null>(null);
  const [user, setUser]             = useState<User | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [organization, setOrg]      = useState<Organization | null>(null);
  const [loading, setLoading]       = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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
    session, user, teamMember, organization, loading, needsOnboarding,
    isOwner, isAdmin, canManage, canView,
    signIn, signOut, refreshTeamMember,
  };
}
