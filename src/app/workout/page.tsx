"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PoseOverlay from "~/components/PoseOverlay";

export default function WorkoutPage() {
  const [reps, setReps] = useState(0);
  const [status, setStatus] = useState<"Ready" | "Recording" | "Finished">("Ready");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);
  const router = useRouter();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setIsInitializing(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "user"
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setCameraError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Camera access denied");
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startSession = () => {
    setStatus("Recording");
    setReps(0);
    setStartTime(Date.now());
  };

  const finishSession = () => {
    setStatus("Finished");
    const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    
    // Auto-redirect after short analysis delay
    setTimeout(() => {
      router.push(`/results?reps=${reps}&duration=${duration}`);
    }, 1500);
  };

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-black font-sans">
      {/* 1. Immersive Camera Layer */}
      <div className="absolute inset-0 z-0">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
            <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center text-secondary mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-2xl font-black italic uppercase text-gradient mb-4">{cameraError}</p>
            <button onClick={startCamera} className="px-8 py-3 bg-secondary text-white font-black rounded-full hover:scale-105 active:scale-95 transition-all uppercase text-xs tracking-widest shadow-lg shadow-secondary/20">
              Try Again
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-1000 ${isInitializing ? "opacity-0" : "opacity-100"}`}
            />
            {/* MediaPipe Pose Overlay */}
            <PoseOverlay 
              videoRef={videoRef} 
              isRunning={!isInitializing && !cameraError} 
              onRepChange={setReps}
            />
          </>
        )}
        {/* Cinematic Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)] pointer-events-none" style={{ zIndex: 6 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" style={{ zIndex: 6 }} />
      </div>

      {/* 2. ML Alignment Guide (HUD) — only when no pose detected yet */}
      {!isInitializing && !cameraError && status === "Ready" && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="relative w-full h-full max-w-4xl max-h-[70vh] border-2 border-white/10 rounded-[3rem] animate-in fade-in zoom-in duration-1000">
            {/* Guide Corners */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary/40 rounded-tl-[3rem]" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary/40 rounded-tr-[3rem]" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary/40 rounded-bl-[3rem]" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary/40 rounded-br-[3rem]" />
          </div>
        </div>
      )}

      {/* 3. Floating UI Controls Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none p-8 flex flex-col">
        {/* Top Floating Bar */}
        <div className="flex items-center justify-between w-full pointer-events-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="glass p-4 rounded-full hover:bg-white/10 transition-colors group">
              <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="glass px-6 py-2 rounded-full border-primary/20">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-primary italic">Live Session</span>
            </div>
          </div>
          
          <div className="glass px-6 py-3 rounded-2xl flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Status</span>
            <div className="flex items-center gap-2">
              {status === "Recording" && <span className="w-2 h-2 bg-secondary rounded-full animate-ping" />}
              <span className={`text-sm font-black uppercase tracking-widest ${status === "Recording" ? "text-secondary" : "text-white"}`}>
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Reps Display (Floating) */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h2 className={`text-[12rem] font-black tracking-tighter leading-none select-none drop-shadow-[0_0_60px_rgba(244,63,94,0.5)] transition-all duration-500 ${status === "Recording" ? "text-secondary opacity-100 scale-110" : "text-white opacity-20"}`}>
              {reps}
            </h2>
            <p className="text-xs font-black uppercase tracking-[0.5em] text-primary italic mt-6 opacity-60">Consecutive Reps</p>
            
            {status === "Ready" && !isInitializing && (
              <button 
                onClick={startSession}
                className="mt-12 pointer-events-auto px-12 py-5 bg-primary text-white font-black rounded-2xl hover:scale-105 active:scale-95 transition-all uppercase text-xl tracking-tighter shadow-2xl shadow-primary/40 border border-white/20"
              >
                Start Session
              </button>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500 fill-mode-both px-4">
          {status === "Recording" && (
            <button 
              onClick={finishSession}
              className="pointer-events-auto flex items-center gap-3 px-8 py-4 bg-black/40 hover:bg-secondary text-white font-black rounded-2xl border border-white/10 transition-all group lg:mb-4"
            >
              <span className="text-xs uppercase tracking-widest group-hover:block transition-all">Finish Session</span>
              <div className="w-4 h-4 rounded bg-secondary group-hover:bg-white transition-colors" />
            </button>
          )}
          
          {status === "Finished" && (
            <div className="flex flex-col items-center gap-4 py-8 pointer-events-none">
              <p className="font-black text-2xl uppercase italic text-gradient leading-tight">Analyzing Results</p>
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Initial Loading Overlay */}
      {isInitializing && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 w-16 h-16 border-4 border-primary/20 rounded-full" />
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-black italic uppercase text-gradient">Initializing AI</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mt-1">Calibrating your workspace...</p>
          </div>
        </div>
      )}
    </div>
  );
}
