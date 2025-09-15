import { useState, useEffect } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { useWallet } from '@/hooks/useWallet';

export const useProfile = () => {
  const { address, isConnected } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      loadProfile();
    } else {
      setProfile(null);
      setError(null);
    }
  }, [address, isConnected]);

  const loadProfile = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', address)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const createOrUpdateProfile = async (profileData: Partial<Profile>): Promise<Profile> => {
    if (!address) {
      throw new Error('No wallet connected');
    }

    setLoading(true);
    setError(null);

    try {
      const dataWithWallet = {
        ...profileData,
        wallet_address: address,
      };

      let result;
      
      if (profile?.id) {
        // Update existing profile
        const { data, error } = await supabase
          .from('profiles')
          .update(dataWithWallet)
          .eq('id', profile.id)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from('profiles')
          .insert(dataWithWallet)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      }

      setProfile(result);
      return result;
    } catch (err) {
      console.error('Error saving profile:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save profile';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const ensureProfile = async (fallbackData?: Partial<Profile>): Promise<Profile> => {
    if (profile) return profile;
    
    if (!address) {
      throw new Error('No wallet connected');
    }

    // Try to load profile first
    await loadProfile();
    
    if (profile) return profile;

    // Create a basic profile if none exists
    const basicProfileData = {
      wallet_address: address,
      full_name: fallbackData?.full_name || `User ${address.slice(0, 8)}`,
      username: fallbackData?.username || `user_${address.slice(0, 8)}`,
      bio: fallbackData?.bio || 'Web3 enthusiast',
      skills: fallbackData?.skills || [],
      hourly_rate: fallbackData?.hourly_rate || 50,
      availability_status: fallbackData?.availability_status || 'available',
      ...fallbackData,
    };

    return await createOrUpdateProfile(basicProfileData);
  };

  return {
    profile,
    loading,
    error,
    loadProfile,
    createOrUpdateProfile,
    ensureProfile,
    hasProfile: !!profile,
  };
};