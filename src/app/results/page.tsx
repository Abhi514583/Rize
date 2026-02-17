"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ResultSummary from "~/components/ResultSummary";
import WorldContribution from "~/components/WorldContribution";
import RecordingPreview from "~/components/RecordingPreview";

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const reps = parseInt(searchParams.get("reps") || "0");
  const duration = parseInt(searchParams.get("duration") || "0");

  return (
    <div className="flex flex-col items-center p-6 max-w-lg mx-auto pb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <ResultSummary reps={reps} duration={duration} />

      {/* Section 2 - Personal Stats (Mock) */}
      <div className="w-full glass rounded-3xl p-8 mb-8 grid grid-cols-3 gap-6 text-center border-white/5 shadow-2xl">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Best Today</p>
          <p className="text-2xl font-black font-mono text-primary">32</p>
        </div>
        <div className="border-x border-white/10 space-y-1 px-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Today</p>
          <p className="text-2xl font-black font-mono">148</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sessions</p>
          <p className="text-2xl font-black font-mono">4</p>
        </div>
      </div>

      <div className="w-full space-y-8">
        <RecordingPreview />
        <WorldContribution reps={reps} />
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-4 w-full mt-4">
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
