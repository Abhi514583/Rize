"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface WorkoutControlsProps {
  onRepsChange: (reps: number) => void;
  onStateChange: (state: "idle" | "running" | "stopped") => void;
}

export default function WorkoutControls({ onRepsChange, onStateChange }: WorkoutControlsProps) {
  const [state, setState] = useState<"idle" | "running" | "stopped">("idle");
  const [reps, setReps] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && state === "running") {
        e.preventDefault();
        setReps((prev) => {
          const newReps = prev + 1;
          onRepsChange(newReps);
          return newReps;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, onRepsChange]);

  const startWorkout = () => {
    setState("running");
    onStateChange("running");
    setStartTime(Date.now());
    setReps(0);
  };

  const stopWorkout = () => {
    setState("stopped");
    onStateChange("stopped");
    const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    
    // Auto-redirect after short delay
    setTimeout(() => {
      router.push(`/results?reps=${reps}&duration=${duration}`);
    }, 1500);
  };

  return (
    <div className="w-full glass backdrop-blur-3xl rounded-[2.5rem] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.5)] border-white/10 relative overflow-hidden group">
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="flex flex-col items-center gap-6 relative z-10">
        {state === "idle" && (
          <button
            onClick={startWorkout}
            className="w-full py-6 bg-primary text-white font-black text-xl rounded-2xl shadow-[0_20px_50px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group uppercase tracking-tight"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10">Start Session</span>
          </button>
        )}

        {state === "running" && (
          <div className="flex flex-col items-center gap-6 w-full animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-3 glass px-4 py-2 rounded-full border-secondary/20 shadow-[0_0_20px_rgba(244,63,94,0.2)] bg-black/40">
              <div className="relative flex items-center justify-center">
                <span className="absolute w-3 h-3 bg-secondary rounded-full animate-ping opacity-75" />
                <span className="relative w-2 h-2 bg-secondary rounded-full" />
              </div>
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-secondary">Recording</span>
            </div>
            
            <div className="flex items-center gap-4 w-full">
              <button
                onClick={() => {
                  setReps((prev) => {
                    const newReps = prev + 1;
                    onRepsChange(newReps);
                    return newReps;
                  });
                }}
                className="flex-1 py-10 rounded-2xl glass border-white/5 flex flex-col items-center justify-center hover:bg-white/5 active:scale-95 transition-all group"
              >
                <span className="text-4xl font-black group-hover:scale-110 transition-transform">{reps}</span>
                <span className="text-[9px] font-black border-t border-white/10 mt-2 pt-1 uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Manual Rep</span>
              </button>

              <button
                onClick={stopWorkout}
                className="w-20 h-auto self-stretch bg-white/[0.03] border border-white/10 text-white font-black rounded-2xl hover:bg-secondary hover:border-secondary transition-all flex items-center justify-center group"
                title="Finish Workout"
              >
                <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <div className="w-3 h-3 bg-secondary group-hover:bg-white rounded-sm" />
                </div>
              </button>
            </div>
          </div>
        )}

        {state === "stopped" && (
          <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in duration-500">
            <div className="text-center">
              <p className="font-black text-2xl uppercase italic text-gradient leading-tight">Analyzing</p>
            </div>
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
