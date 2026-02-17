"use client";

import { useState } from "react";
import Link from "next/link";
import WorkoutControls from "~/components/WorkoutControls";

export default function WorkoutPage() {
  const [reps, setReps] = useState(0);
  const [status, setStatus] = useState<"Ready" | "Recording" | "Finished">("Ready");

  const handleStateChange = (state: "idle" | "running" | "stopped") => {
    if (state === "idle") setStatus("Ready");
    if (state === "running") setStatus("Recording");
    if (state === "stopped") setStatus("Finished");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="glass p-2 rounded-full hover:bg-white/5 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <span className={`text-sm font-black uppercase tracking-widest ${status === "Recording" ? "text-red-500" : "text-muted-foreground"}`}>
          {status}
        </span>
        <div className="glass p-2 rounded-full opacity-40">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>

      {/* Camera Section */}
      <div className="flex-1 glass rounded-3xl border-2 border-white/5 overflow-hidden relative mb-8 flex flex-col items-center justify-center bg-black/20 group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        <div className="flex flex-col items-center gap-4 z-10 opacity-30 group-hover:opacity-50 transition-opacity">
          <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-bold">Camera preview will appear here</p>
        </div>
      </div>

      {/* Counter & Controls */}
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h2 className="text-7xl font-black tracking-tighter mb-1 select-none">Reps: {reps}</h2>
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground opacity-60 italic">Keep elbows visible in frame</p>
        </div>

        <WorkoutControls 
          onRepsChange={setReps} 
          onStateChange={handleStateChange}
        />
      </div>
    </div>
  );
}
