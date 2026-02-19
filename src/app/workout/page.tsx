"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PoseOverlay, { type CameraMode } from "~/components/PoseOverlay";

const MODE_KEY = "rize_camera_mode";

export default function WorkoutPage() {
  const [reps, setReps] = useState(0);
  const [status, setStatus] = useState<"Ready" | "Recording" | "Finished">("Ready");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("front");
  const router = useRouter();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "front" || saved === "side") setCameraMode(saved);
    }
  }, []);

  const switchMode = (m: CameraMode) => {
    setCameraMode(m);
    localStorage.setItem(MODE_KEY, m);
  };

  const startCamera = async () => {
    setIsInitializing(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      setCameraError("Camera access denied");
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const startSession = () => {
    setStatus("Recording");
    setReps(0);
    setStartTime(Date.now());
  };

  const finishSession = () => {
    setStatus("Finished");
    const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    setTimeout(() => router.push(`/results?reps=${reps}&duration=${duration}`), 1500);
  };

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-black font-sans">
      <div className="absolute inset-0 z-0 text-white">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-8 text-center z-50">
            <p className="text-2xl font-black uppercase text-secondary mb-4">{cameraError}</p>
            <button onClick={startCamera} className="px-8 py-3 bg-secondary text-white font-black rounded-full uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all">Try Again</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-1000 ${isInitializing ? "opacity-0" : "opacity-100"}`} />
            <PoseOverlay videoRef={videoRef} isRunning={!isInitializing && !cameraError} mode={cameraMode} onRepChange={setReps} />
          </>
        )}
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none p-6 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between w-full pointer-events-auto">
          <Link href="/" className="glass p-4 rounded-full hover:bg-white/10 transition-colors group">
            <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          
          <div className="flex flex-col items-end gap-1">
             <div className="glass px-5 py-2 rounded-full border border-primary/20">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">Push-Up Mode</span>
             </div>
          </div>
        </div>

        {/* LARGE MODE SELECTOR */}
        <div className="flex flex-col items-center mt-6 pointer-events-auto">
          <div className="glass p-1.5 rounded-[2rem] flex border border-white/5 shadow-2xl backdrop-blur-3xl">
            <button
              onClick={() => switchMode("front")}
              className={`px-10 py-5 rounded-[1.7rem] text-sm font-black uppercase tracking-widest transition-all duration-500 flex items-center gap-3 ${
                cameraMode === "front" ? "bg-primary text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] scale-105" : "text-white/40 hover:text-white/60"
              }`}
            >
              <span className="text-xl">📱</span> Front View
            </button>
            <button
              onClick={() => switchMode("side")}
              className={`px-10 py-5 rounded-[1.7rem] text-sm font-black uppercase tracking-widest transition-all duration-500 flex items-center gap-3 ${
                cameraMode === "side" ? "bg-primary text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] scale-105" : "text-white/40 hover:text-white/60"
              }`}
            >
              <span className="text-xl">📐</span> Side View
            </button>
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.25em] text-white/30 text-center animate-pulse">
            {cameraMode === "front" ? "Laptop on desk • step back 1-2 steps" : "Laptop to the side • keep full body in frame"}
          </p>
        </div>

        {/* Center Reps */}
        <div className="flex-1 flex flex-col items-center justify-center">
            <h2 className={`text-[15rem] font-black tracking-tighter leading-none select-none drop-shadow-[0_0_80px_rgba(244,63,94,0.6)] transition-all duration-700 ${status === "Recording" ? "text-secondary scale-110" : "text-white/20"}`}>
              {reps}
            </h2>
            {status === "Ready" && !isInitializing && (
              <button onClick={startSession} className="mt-8 pointer-events-auto px-16 py-6 bg-primary text-white font-black rounded-[2rem] hover:scale-105 active:scale-95 transition-all uppercase text-2xl tracking-tight shadow-2xl shadow-primary/40 border border-white/20">
                Start Session
              </button>
            )}
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end p-4">
          {status === "Recording" && (
            <button onClick={finishSession} className="pointer-events-auto flex items-center gap-4 px-10 py-5 bg-black/60 hover:bg-secondary text-white font-black rounded-3xl border border-white/10 transition-all group lg:mb-4">
              <span className="text-xs uppercase tracking-widest">Finish Session</span>
              <div className="w-4 h-4 rounded bg-secondary group-hover:bg-white transition-colors" />
            </button>
          )}
        </div>
      </div>

      {isInitializing && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-2xl font-black italic uppercase text-gradient">Initializing AI</p>
        </div>
      )}
    </div>
  );
}
