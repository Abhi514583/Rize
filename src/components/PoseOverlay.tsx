"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { usePose } from "./PoseProvider";
import {
  calculateAngle,
  EMA,
  PositionSmoother,
  calculateErrorPct,
  clamp,
  createRepEngine,
  tickRepEngine,
  type RepPhase,
} from "~/lib/poseMath";

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

// ─── Thresholds ──────────────────────────────────────────────────────
const A_UP = 155;
const A_DOWN = 90;
const VIS_THRESHOLD = 0.5;

interface PoseOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isRunning: boolean;
  onRepChange?: (reps: number) => void;
  onPhaseChange?: (phase: RepPhase) => void;
}

export default function PoseOverlay({
  videoRef,
  isRunning,
  onRepChange,
  onPhaseChange,
}: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { landmarker, isLoading: isModelLoading, error: modelError } = usePose();
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);

  // Status for top pill
  const [poseStatus, setPoseStatus] = useState<
    "loading" | "detecting" | "detected" | "none"
  >("loading");

  // ─── Refs for zero-lag state (never causes re-render) ──────────────
  const repEngineRef = useRef(createRepEngine());
  const lastRepCountRef = useRef(0);

  // Smoothers — one per joint we care about (6 joints)
  const smoothersRef = useRef({
    shoulder: new PositionSmoother(0.45),
    elbow: new PositionSmoother(0.45),
    wrist: new PositionSmoother(0.45),
    hip: new PositionSmoother(0.45),
    knee: new PositionSmoother(0.45),
    ankle: new PositionSmoother(0.45),
  });
  const elbowEMA = useRef(new EMA(0.35));
  const hipEMA = useRef(new EMA(0.35));
  const kneeEMA = useRef(new EMA(0.35));

  // Sync status with global loader
  useEffect(() => {
    if (modelError) setPoseStatus("none");
    else if (isModelLoading) setPoseStatus("loading");
    else if (landmarker) setPoseStatus("detecting");
  }, [isModelLoading, modelError, landmarker]);

  // ─── Drawing Helpers ───────────────────────────────────────────────
  function drawLine(
    ctx: CanvasRenderingContext2D,
    pts: { x: number; y: number }[],
    w: number,
    h: number,
    color: string,
    lineW = 4,
  ) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = p.x * w;
      const py = p.y * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawJoint(
    ctx: CanvasRenderingContext2D,
    p: { x: number; y: number },
    w: number,
    h: number,
    color = "#a6d784",
    radius = 7,
  ) {
    const px = p.x * w;
    const py = p.y * h;
    // Outer glow
    ctx.beginPath();
    ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = color + "33"; // 20% alpha glow
    ctx.fill();
    // Main dot
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /** Draws text that reads correctly on the CSS-mirrored canvas. */
  function drawMirroredText(
    ctx: CanvasRenderingContext2D,
    text: string,
    normX: number,
    normY: number,
    w: number,
    h: number,
    font: string,
    color: string,
    align: CanvasTextAlign = "left",
  ) {
    ctx.save();
    const px = normX * w;
    const py = normY * h;
    // The canvas is CSS scale-x-[-1], so we counter-mirror at this point
    ctx.translate(px, py);
    ctx.scale(-1, 1);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /** Draws text at pixel positions with counter-mirror. */
  function drawMirroredTextPx(
    ctx: CanvasRenderingContext2D,
    text: string,
    px: number,
    py: number,
    font: string,
    color: string,
    align: CanvasTextAlign = "left",
  ) {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(-1, 1);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drawProgressBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    barW: number,
    barH: number,
    progress: number,
    color: string,
    label: string,
    pct: string,
  ) {
    ctx.save();
    // We need to counter-mirror the whole block
    ctx.translate(x, y);
    ctx.scale(-1, 1);

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(-barW, 0, barW, barH, 8);
    ctx.fill();

    // Fill
    const fillH = barH * clamp(progress, 0, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-barW, barH - fillH, barW, fillH, 8);
    ctx.fill();

    // Label
    ctx.font = "900 28px 'Inter', sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText(label, -barW / 2, -14);

    // Percentage
    ctx.font = "700 18px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(pct, -barW / 2, -40);

    ctx.restore();
  }

  // ─── Main Detection Loop ──────────────────────────────────────────
  const detect = useCallback(
    (timestamp: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !landmarker || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

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

      if (timestamp <= lastTimeRef.current) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }
      lastTimeRef.current = timestamp;

      try {
        const results = landmarker.detectForVideo(video, timestamp);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const W = canvas.width;
        const H = canvas.height;

        if (results.landmarks && results.landmarks.length > 0) {
          const lm = results.landmarks[0];
          const drawingUtils = new DrawingUtils(ctx);

          // ─── 1. Side Selection ───────────────────────────────
          const lVis =
            (lm[11].visibility || 0) +
            (lm[13].visibility || 0) +
            (lm[15].visibility || 0) +
            (lm[23].visibility || 0) +
            (lm[25].visibility || 0) +
            (lm[27].visibility || 0);
          const rVis =
            (lm[12].visibility || 0) +
            (lm[14].visibility || 0) +
            (lm[16].visibility || 0) +
            (lm[24].visibility || 0) +
            (lm[26].visibility || 0) +
            (lm[28].visibility || 0);
          const o = lVis >= rVis ? 0 : 1; // offset

          const rawShoulder = lm[11 + o];
          const rawElbow = lm[13 + o];
          const rawWrist = lm[15 + o];
          const rawHip = lm[23 + o];
          const rawKnee = lm[25 + o];
          const rawAnkle = lm[27 + o];

          // ─── 2. Visibility Gate ──────────────────────────────
          const allVisible =
            rawShoulder.visibility! > VIS_THRESHOLD &&
            rawElbow.visibility! > VIS_THRESHOLD &&
            rawWrist.visibility! > VIS_THRESHOLD &&
            rawHip.visibility! > VIS_THRESHOLD &&
            rawKnee.visibility! > VIS_THRESHOLD &&
            rawAnkle.visibility! > VIS_THRESHOLD;

          if (!allVisible) {
            // Still draw faint skeleton
            drawingUtils.drawConnectors(lm, POSE_CONNECTIONS, {
              color: "rgba(255,255,255,0.08)",
              lineWidth: 1,
            });
            setPoseStatus("detecting");
            animFrameRef.current = requestAnimationFrame(detect);
            return;
          }

          setPoseStatus("detected");

          // ─── 3. Smooth Positions ─────────────────────────────
          const sm = smoothersRef.current;
          const shoulder = sm.shoulder.add(rawShoulder);
          const elbow = sm.elbow.add(rawElbow);
          const wrist = sm.wrist.add(rawWrist);
          const hip = sm.hip.add(rawHip);
          const knee = sm.knee.add(rawKnee);
          const ankle = sm.ankle.add(rawAnkle);

          // ─── 4. Angles (smoothed) ────────────────────────────
          const rawElbowAngle = calculateAngle(shoulder, elbow, wrist);
          const elbowAngle = elbowEMA.current.add(rawElbowAngle);

          const rawHipAngle = calculateAngle(shoulder, hip, ankle);
          const hipAngle = hipEMA.current.add(rawHipAngle);

          const rawKneeAngle = calculateAngle(hip, knee, ankle);
          const kneeAngle = kneeEMA.current.add(rawKneeAngle);

          const bodyErr = calculateErrorPct(180, hipAngle);
          const kneeErr = calculateErrorPct(180, kneeAngle);

          // ─── 5. Rep Engine ───────────────────────────────────
          const engine = repEngineRef.current;
          tickRepEngine(engine, elbowAngle, performance.now(), A_UP, A_DOWN);

          // Notify parent only when reps actually change
          if (engine.reps !== lastRepCountRef.current) {
            lastRepCountRef.current = engine.reps;
            onRepChange?.(engine.reps);
          }

          // Progress %
          const rawProgress =
            (elbowAngle - A_DOWN) / (A_UP - A_DOWN);
          const progressUp = clamp(rawProgress, 0, 1);
          const progressDown = 1 - progressUp;

          const isDescending =
            engine.phase === "UP" || engine.phase === "GOING_DOWN";

          // ─── 6. DRAW ─────────────────────────────────────────

          // A. Faint full skeleton (subtle)
          drawingUtils.drawConnectors(lm, POSE_CONNECTIONS, {
            color: "rgba(255,255,255,0.12)",
            lineWidth: 1,
          });

          // B. Body line (Shoulder → Hip → Ankle)
          const bodyColor =
            bodyErr > 15
              ? "rgba(255, 59, 48, 0.85)"
              : "rgba(166, 215, 132, 0.85)";
          drawLine(ctx, [shoulder, hip, ankle], W, H, bodyColor, 5);

          // C. Knee line (Hip → Knee → Ankle)
          const kneeColor =
            kneeErr > 15
              ? "rgba(255, 160, 50, 0.7)"
              : "rgba(255, 255, 255, 0.5)";
          drawLine(ctx, [hip, knee, ankle], W, H, kneeColor, 3);

          // D. Arm line (Shoulder → Elbow → Wrist)
          drawLine(
            ctx,
            [shoulder, elbow, wrist],
            W,
            H,
            "rgba(120, 200, 255, 0.6)",
            3,
          );

          // E. Joints
          const goodColor = "#a6d784";
          const warnColor = "#ff3b30";
          drawJoint(ctx, shoulder, W, H, bodyErr > 15 ? warnColor : goodColor);
          drawJoint(ctx, hip, W, H, bodyErr > 15 ? warnColor : goodColor);
          drawJoint(ctx, ankle, W, H, goodColor);
          drawJoint(ctx, knee, W, H, kneeErr > 15 ? "#ffa032" : goodColor);
          drawJoint(ctx, elbow, W, H, "#78c8ff", 8);
          drawJoint(ctx, wrist, W, H, "#78c8ff");

          // F. Angle labels (mirrored text)
          drawMirroredText(
            ctx,
            `${Math.round(elbowAngle)}°`,
            elbow.x,
            elbow.y - 0.03,
            W,
            H,
            "700 18px 'Inter', sans-serif",
            "#78c8ff",
            "center",
          );
          drawMirroredText(
            ctx,
            `${Math.round(hipAngle)}°`,
            hip.x,
            hip.y - 0.025,
            W,
            H,
            "600 14px 'Inter', sans-serif",
            bodyErr > 15 ? warnColor : goodColor,
            "center",
          );
          drawMirroredText(
            ctx,
            `${Math.round(kneeAngle)}°`,
            knee.x,
            knee.y + 0.04,
            W,
            H,
            "600 14px 'Inter', sans-serif",
            kneeErr > 15 ? "#ffa032" : "rgba(255,255,255,0.6)",
            "center",
          );

          // G. Error Dashboard (top-left, counter-mirrored)
          {
            // Draw from the right side (because canvas is CSS-mirrored, right → appears left)
            const bx = W - 20;
            const by = 24;
            const bw = 240;
            const bh = 78;

            ctx.save();
            ctx.translate(bx, by);
            ctx.scale(-1, 1);

            // BG
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.beginPath();
            ctx.roundRect(0, 0, bw, bh, 12);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.06)";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Title
            ctx.font = "800 9px 'Inter', sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.textAlign = "left";
            ctx.letterSpacing = "2px";
            ctx.fillText("FORM ANALYSIS", 14, 18);

            // Body Error
            ctx.font = "700 13px 'SF Mono', 'Fira Code', monospace";
            ctx.fillStyle = bodyErr > 15 ? "#ff3b30" : "#a6d784";
            ctx.fillText(
              `Core straight error:  ${Math.round(bodyErr)}%`,
              14,
              38,
            );

            // Knee Error
            ctx.fillStyle = kneeErr > 15 ? "#ffa032" : "#a6d784";
            ctx.fillText(
              `Knee straight error:  ${Math.round(kneeErr)}%`,
              14,
              58,
            );

            ctx.restore();
          }

          // H. Progress Indicators (UP green left, DOWN red right)
          {
            const barW = 36;
            const barH = 160;
            const margin = 50;
            const barY = H / 2 - barH / 2;

            // UP bar on the right side (appears left because mirrored)
            drawProgressBar(
              ctx,
              W - margin,
              barY,
              barW,
              barH,
              progressUp,
              "#a6d784",
              isDescending ? "▼" : "UP",
              `${Math.round(progressUp * 100)}%`,
            );

            // DOWN bar on the left side (appears right because mirrored)
            drawProgressBar(
              ctx,
              margin + barW,
              barY,
              barW,
              barH,
              progressDown,
              "#ff3b30",
              isDescending ? "DOWN" : "▲",
              `${Math.round(progressDown * 100)}%`,
            );
          }

          // I. Rep counter badge on canvas (bottom center, mirrored)
          {
            const reps = engine.reps;
            drawMirroredTextPx(
              ctx,
              `${reps}`,
              W / 2,
              H - 55,
              "900 64px 'Inter', sans-serif",
              "rgba(255,255,255,0.9)",
              "center",
            );
            drawMirroredTextPx(
              ctx,
              "PUSH UPS",
              W / 2,
              H - 32,
              "800 11px 'Inter', sans-serif",
              "rgba(166, 215, 132, 0.7)",
              "center",
            );
          }
        } else {
          setPoseStatus("detecting");
        }
      } catch (err) {
        console.warn("MediaPipe detect error:", err);
        lastTimeRef.current = -1;
      }

      animFrameRef.current = requestAnimationFrame(detect);
    },
    [videoRef, landmarker, onRepChange, onPhaseChange],
  );

  // ─── Loop Control ──────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const startLoop = () => {
      if (active && isRunning && landmarker) {
        lastTimeRef.current = -1;
        animFrameRef.current = requestAnimationFrame(detect);
      }
    };
    const timeout = setTimeout(startLoop, 600);
    return () => {
      active = false;
      clearTimeout(timeout);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, [isRunning, detect, landmarker]);

  // ─── JSX ───────────────────────────────────────────────────────────
  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none"
        style={{ zIndex: 11 }}
      />

      {/* Status Pills */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        {poseStatus === "loading" && (
          <div className="glass px-5 py-2.5 rounded-full flex items-center gap-2.5 animate-pulse border border-yellow-500/20">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400">
              Loading AI Model…
            </span>
          </div>
        )}
        {poseStatus === "detecting" && (
          <div className="glass px-5 py-2.5 rounded-full flex items-center gap-2.5 border border-amber-500/20">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
              Position yourself for push-ups
            </span>
          </div>
        )}
        {poseStatus === "detected" && (
          <div className="glass px-5 py-2.5 rounded-full flex items-center gap-2.5 border border-emerald-500/20">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
              Tracking Active
            </span>
          </div>
        )}
      </div>
    </>
  );
}
