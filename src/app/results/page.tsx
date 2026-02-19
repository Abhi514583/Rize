"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import ResultSummary from "~/components/ResultSummary";
import WorldContribution from "~/components/WorldContribution";
import RecordingPreview from "~/components/RecordingPreview";
import ChallengeCard from "~/components/ChallengeCard";
import { getWorkoutStats, saveWorkoutSession, WorkoutStats } from "~/lib/workoutStats";

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const reps = parseInt(searchParams.get("reps") || "0");
  const duration = parseInt(searchParams.get("duration") || "0");
  
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    // Save session on mount ONLY ONCE and get updated stats
    if (reps > 0 && !hasSaved) {
      const updatedStats = saveWorkoutSession(reps);
      setStats(updatedStats);
      setHasSaved(true);
    } else if (!hasSaved) {
      setStats(getWorkoutStats());
    }
  }, [reps, hasSaved]);

  if (!stats) return null;

  return (
    <div className="flex flex-col items-center p-6 max-w-lg mx-auto pb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <ResultSummary reps={reps} duration={duration} />

      {/* Challenge Card - The Viral Engine */}
      <div className="w-full mb-12">
        <ChallengeCard reps={reps} stats={stats} />
      </div>

      <div className="w-full space-y-12">
        <RecordingPreview />
        <WorldContribution reps={reps} />
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-4 w-full mt-12">
        <Link href="/workout" className="w-full">
          <button className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-[0_10px_30px_rgba(99,102,241,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-tight relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10">Record Another</span>
          </button>
        </Link>
        <Link href="/" className="w-full">
          <button className="w-full py-5 glass text-white font-black rounded-2xl hover:bg-white/5 transition-all uppercase tracking-widest text-xs">
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  );
}
