
import { supabase } from './supabaseClient';
import { FlashcardSet } from '../types';

export const fetchFlashcardSets = async (): Promise<FlashcardSet[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('flashcard_sets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching flashcards:', error);
    return [];
  }

  return data.map((d: any) => ({
    id: d.id,
    user_id: d.user_id,
    title: d.title,
    cards: d.cards, // JSONB column
    created_at: d.created_at
  }));
};

export const createFlashcardSet = async (set: Omit<FlashcardSet, 'id' | 'created_at' | 'user_id'>): Promise<FlashcardSet> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('flashcard_sets')
    .insert([{
      user_id: user.id,
      title: set.title,
      cards: set.cards
    }])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    cards: data.cards,
    created_at: data.created_at
  };
};

export const deleteFlashcardSet = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('flashcard_sets')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
