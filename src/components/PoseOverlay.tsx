"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { usePose } from "./PoseProvider";

// MediaPipe Pose connections for full body skeleton
const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

interface PoseOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isRunning: boolean;
}

export default function PoseOverlay({ videoRef, isRunning }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { landmarker, isLoading: isModelLoading, error: modelError } = usePose();
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);
  const [poseStatus, setPoseStatus] = useState<"loading" | "detecting" | "detected" | "none">("loading");

  // Sync state with global loader
  useEffect(() => {
    if (modelError) setPoseStatus("none");
    else if (isModelLoading) setPoseStatus("loading");
    else if (landmarker) setPoseStatus("detecting");
  }, [isModelLoading, modelError, landmarker]);

  // Detection loop
  const detect = useCallback((timestamp: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Safety checks
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    // Ensure canvas matches video render size
    const rect = video.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    // MediaPipe requires strictly increasing timestamps. 
    // requestAnimationFrame's timestamp is perfect for this.
    if (timestamp <= lastTimeRef.current) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }
    lastTimeRef.current = timestamp;

    try {
      const results = landmarker.detectForVideo(video, timestamp);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);

        for (const landmarks of results.landmarks) {
          // Draw connectors (skeleton lines)
          drawingUtils.drawConnectors(landmarks, POSE_CONNECTIONS, {
            color: "rgba(166, 215, 132, 0.85)",
            lineWidth: 3,
          });

          // Draw landmarks (joints)
          drawingUtils.drawLandmarks(landmarks, {
            color: "rgba(200, 240, 180, 0.9)",
            fillColor: "rgba(166, 215, 132, 0.7)",
            lineWidth: 1,
            radius: 3,
          });
        }

        setPoseStatus(prev => prev !== "detected" ? "detected" : prev);
      } else {
        setPoseStatus(prev => prev !== "detecting" ? "detecting" : prev);
      }
    } catch (err) {
      // Packet timestamp mismatch can happen during tab switching, just reset and continue
      console.warn("MediaPipe detect error:", err);
      lastTimeRef.current = -1; 
    }

    animFrameRef.current = requestAnimationFrame(detect);
  }, [videoRef, landmarker, poseStatus]);

  // Unified loop control
  useEffect(() => {
    let active = true;

    const startLoop = () => {
      if (active && isRunning && landmarker) {
        lastTimeRef.current = -1;
        animFrameRef.current = requestAnimationFrame(detect);
      }
    };

    // Delay slightly to ensure video is hot
    const timeout = setTimeout(startLoop, 1000);

    return () => {
      active = false;
      clearTimeout(timeout);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, [isRunning, detect, landmarker]);

  return (
    <>
      {/* Canvas overlay — same position as video, also mirrored */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none"
        style={{ zIndex: 5 }}
      />

      {/* Status indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        {poseStatus === "loading" && (
          <div className="glass px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">
              Loading AI Model...
            </span>
          </div>
        )}
        {poseStatus === "detecting" && (
          <div className="glass px-4 py-2 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              Scanning for Pose...
            </span>
          </div>
        )}
        {poseStatus === "detected" && (
          <div className="glass px-4 py-2 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Pose Detected
            </span>
          </div>
        )}
      </div>
    </>
  );
}
