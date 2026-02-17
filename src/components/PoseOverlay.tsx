"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// MediaPipe Pose connections for full body skeleton
const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

interface PoseOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isRunning: boolean;
}

export default function PoseOverlay({ videoRef, isRunning }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);
  const [poseStatus, setPoseStatus] = useState<"loading" | "detecting" | "detected" | "none">("loading");

  // Initialize PoseLandmarker
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setPoseStatus("detecting");
        }
      } catch (err) {
        console.error("PoseLandmarker init error:", err);
        // Fallback to CPU if GPU fails
        try {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );
          const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          if (!cancelled) {
            landmarkerRef.current = landmarker;
            setPoseStatus("detecting");
          }
        } catch (cpuErr) {
          console.error("PoseLandmarker CPU fallback failed:", cpuErr);
          if (!cancelled) setPoseStatus("none");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Detection loop
  const detect = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    // Size canvas to match the video's rendered dimensions
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

    const now = performance.now();
    // Only detect if time has advanced (MediaPipe needs monotonically increasing timestamps)
    if (now <= lastTimeRef.current) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }
    lastTimeRef.current = now;

    try {
      const results = landmarker.detectForVideo(video, now);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);

        for (const landmarks of results.landmarks) {
          // Draw connectors (skeleton lines) — soft green
          drawingUtils.drawConnectors(landmarks, POSE_CONNECTIONS, {
            color: "rgba(166, 215, 132, 0.85)",
            lineWidth: 3,
          });

          // Draw landmarks (joints) — slightly brighter green dots
          drawingUtils.drawLandmarks(landmarks, {
            color: "rgba(200, 240, 180, 0.9)",
            fillColor: "rgba(166, 215, 132, 0.7)",
            lineWidth: 1,
            radius: 3,
          });
        }

        setPoseStatus("detected");
      } else {
        setPoseStatus("detecting");
      }
    } catch {
      // Silently skip frame on error
    }

    animFrameRef.current = requestAnimationFrame(detect);
  }, [videoRef]);

  // Start / stop the detection loop
  useEffect(() => {
    if (isRunning && landmarkerRef.current) {
      lastTimeRef.current = -1;
      animFrameRef.current = requestAnimationFrame(detect);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isRunning, detect]);

  // Also start detecting once landmarker loads if already running
  useEffect(() => {
    if (poseStatus === "detecting" && isRunning) {
      lastTimeRef.current = -1;
      animFrameRef.current = requestAnimationFrame(detect);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [poseStatus, isRunning, detect]);

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
