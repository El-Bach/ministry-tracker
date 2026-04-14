// src/hooks/useAuth.ts
// Auth state hook — exposes session, user, teamMember profile, sign in/out

import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import supabase from '../lib/supabase';
import { TeamMember } from '../types';
import { registerForPushNotifications } from '../lib/notifications';

interface AuthState {
  session: Session | null;
  user: User | null;
  teamMember: TeamMember | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchTeamMember(data.session.user.email!);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchTeamMember(sess.user.email!);
      } else {
        setTeamMember(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchTeamMember = async (email: string) => {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('email', email)
      .single();
    if (data) {
      setTeamMember(data as TeamMember);
      // Register for push notifications and store token — graceful if column missing
      registerForPushNotifications().then((token) => {
        if (token && token !== data.push_token) {
          supabase
            .from('team_members')
            .update({ push_token: token })
            .eq('id', data.id)
            .then(() => {});
        }
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, teamMember, loading, signIn, signOut };
}
