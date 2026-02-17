"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

interface PoseContextType {
  landmarker: PoseLandmarker | null;
  isLoading: boolean;
  error: string | null;
}

const PoseContext = createContext<PoseContextType>({
  landmarker: null,
  isLoading: true,
  error: null,
});

export const usePose = () => useContext(PoseContext);

export default function PoseProvider({ children }: { children: React.ReactNode }) {
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializing = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations in dev/strict mode
    if (isInitializing.current || landmarker) return;
    isInitializing.current = true;

    async function init() {
      try {
        console.log("Global Pose AI: Initializing...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const instance = await PoseLandmarker.createFromOptions(vision, {
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
          outputSegmentationMasks: false,
        });

        setLandmarker(instance);
        setIsLoading(false);
        console.log("Global Pose AI: Ready.");
      } catch (err) {
        console.error("Global Pose AI: GPU init failed, trying CPU...", err);
        try {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );
          const instance = await PoseLandmarker.createFromOptions(vision, {
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
            outputSegmentationMasks: false,
          });
          setLandmarker(instance);
          setIsLoading(false);
          console.log("Global Pose AI: Ready (CPU).");
        } catch (cpuErr) {
          console.error("Global Pose AI: Fatal init error:", cpuErr);
          setError("Failed to load AI model");
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      // We keep the landmarker alive for the session duration
      // but if the provider itself unmounts (rare), we close it.
    };
  }, []);

  return (
    <PoseContext.Provider value={{ landmarker, isLoading, error }}>
      {children}
    </PoseContext.Provider>
  );
}
