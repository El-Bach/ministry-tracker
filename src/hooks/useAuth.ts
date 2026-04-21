// src/hooks/useAuth.ts
// Auth state hook — exposes session, user, teamMember profile, organization, sign in/out
// Session 26 Phase 1: fetch teamMember by auth.uid(); expose Organization
// Session 26 Phase 2: role helpers (isOwner, isAdmin, canManage, canEdit, canView)

import { useState, useEffect } from 'react';
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

    return () => listener.subscription.unsubscribe();
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
      // Logged in but no team_member row — check if there's a pending invitation
      // If invited user registers, RegisterScreen handles joining; here just flag onboarding
      setTeamMember(null);
      setOrg(null);
      setNeedsOnboarding(true);
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
