"use client";

import { WorkoutStats } from "~/lib/workoutStats";

interface ChallengeCardProps {
  reps: number;
  stats: WorkoutStats;
}

export default function ChallengeCard({ reps, stats }: ChallengeCardProps) {
  const shareChallenge = async () => {
    const text = `I just crushed ${reps} pushups on Rize! My best today is ${stats.todayBest}. Can you beat me? 🔥`;
    const url = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Rize Pushup Challenge',
          text: text,
          url: url,
        });
      } catch (err) {
        console.error('Sharing failed', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        alert("Challenge link copied to clipboard! Send it to your friends. 🔥");
      } catch (err) {
        console.error('Copy failed', err);
      }
    }
  };

  return (
    <div className="w-full relative overflow-hidden rounded-[2.5rem] p-1 group">
      {/* Animated Gradient Border */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-primary animate-gradient-xy opacity-50 blur-sm group-hover:opacity-100 transition-opacity" />
      
      <div className="relative glass-dark rounded-[2.3rem] p-8 flex flex-col items-center bg-black/40 backdrop-blur-3xl border border-white/10">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Mission Complete</span>
          </div>
          <h3 className="text-3xl font-black italic uppercase text-gradient">The Challenge</h3>
        </div>

        {/* Hero Score */}
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full" />
          <div className="relative flex flex-col items-center">
            <span className="text-[10rem] font-black leading-none tracking-tighter text-secondary drop-shadow-[0_0_30px_rgba(244,63,94,0.4)]">
              {reps}
            </span>
            <span className="text-xs font-black uppercase tracking-[0.4em] opacity-40 -mt-2">Push Ups This Set</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="w-full grid grid-cols-2 gap-4 mb-10">
          <div className="glass rounded-2xl p-4 border-white/5 bg-white/[0.02] flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-40 text-center mb-1">Today's Best</span>
            <span className="text-2xl font-black font-mono text-primary">{stats.todayBest}</span>
          </div>
          <div className="glass rounded-2xl p-4 border-white/5 bg-white/[0.02] flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-40 text-center mb-1">Personal Best</span>
            <span className="text-2xl font-black font-mono text-secondary">{stats.allTimeBest}</span>
          </div>
          <div className="glass rounded-2xl p-4 border-white/5 bg-white/[0.02] col-span-2 flex justify-between items-center px-6">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Today's Contribution</span>
            <span className="text-2xl font-black font-mono text-white glow-sm">{stats.todayTotal}</span>
          </div>
        </div>

        {/* Share Button */}
        <button
          onClick={shareChallenge}
          className="w-full py-6 bg-primary text-white font-black text-xl rounded-2xl shadow-[0_20px_50px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group uppercase tracking-tight"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <div className="relative z-10 flex items-center justify-center gap-3">
            <span>Challenge a Friend</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.2em] opacity-30 text-center">
          Tap the button above to copy challenge link
        </p>

      </div>
    </div>
  );
}
