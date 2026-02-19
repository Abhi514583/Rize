/**
 * Utility for managing workout stats in local storage.
 * Handles persistence of personal bests, daily totals, and session history.
 */

export interface WorkoutStats {
  allTimeBest: number;
  todayBest: number;
  todayTotal: number;
  totalSessions: number;
  lastWorkoutDate: string; // ISO date string YYYY-MM-DD
}

const STORAGE_KEY = 'rize_workout_stats';

const getInitialStats = (): WorkoutStats => ({
  allTimeBest: 0,
  todayBest: 0,
  todayTotal: 0,
  totalSessions: 0,
  lastWorkoutDate: new Date().toISOString().split('T')[0],
});

export function getWorkoutStats(): WorkoutStats {
  if (typeof window === 'undefined') return getInitialStats();
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return getInitialStats();
  
  try {
    const stats: WorkoutStats = JSON.parse(stored);
    const today = new Date().toISOString().split('T')[0];
    
    // Reset daily stats if it's a new day
    if (stats.lastWorkoutDate !== today) {
      return {
        ...stats,
        todayBest: 0,
        todayTotal: 0,
        lastWorkoutDate: today,
      };
    }
    
    return stats;
  } catch (e) {
    console.error('Failed to parse workout stats', e);
    return getInitialStats();
  }
}

export function saveWorkoutSession(reps: number): WorkoutStats {
  if (typeof window === 'undefined' || reps <= 0) return getWorkoutStats();
  
  const stats = getWorkoutStats();
  const today = new Date().toISOString().split('T')[0];
  
  const newStats: WorkoutStats = {
    allTimeBest: Math.max(stats.allTimeBest, reps),
    todayBest: Math.max(stats.todayBest, reps),
    todayTotal: stats.todayTotal + reps,
    totalSessions: stats.totalSessions + 1,
    lastWorkoutDate: today,
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newStats));
  return newStats;
}
