// src/hooks/useAuth.ts
// Auth state hook — exposes session, user, teamMember profile, organization, sign in/out
// Session 26: fetch teamMember by auth.uid() (not email); expose Organization

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
    // Primary: look up by auth_id (new multi-tenant way)
    let { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('auth_id', authUser.id)
      .maybeSingle();

    // Fallback: legacy lookup by email (for existing users before migration)
    if (!data && authUser.email) {
      const res = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();
      data = res.data;
      // Backfill auth_id if found by email but auth_id not yet set
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
      // Logged in but no team_member row → needs onboarding (new org registration)
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

  return { session, user, teamMember, organization, loading, needsOnboarding, signIn, signOut, refreshTeamMember };
}
