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
  distance,
  avgPoint,
  FrontRepTracker,
  type RepPhase,
  type Point,
} from "~/lib/poseMath";

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

// ─── Thresholds ──────────────────────────────────────────────────────
const A_UP = 155;
const A_DOWN = 90;
const VIS_SIDE = 0.5;
const VIS_FRONT = 0.55;

export type CameraMode = "front" | "side";

interface PoseOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isRunning: boolean;
  mode: CameraMode;
  onRepChange?: (reps: number) => void;
  onPhaseChange?: (phase: RepPhase) => void;
}

export default function PoseOverlay({
  videoRef,
  isRunning,
  mode,
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
  const lastPhaseRef = useRef<RepPhase>("UP");

  // ─── SIDE mode smoothers (existing) ────────────────────────────────
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

  // ─── FRONT mode smoothers ─────────────────────────────────────────
  const frontSmoothersRef = useRef({
    lShoulder: new PositionSmoother(0.45),
    rShoulder: new PositionSmoother(0.45),
    lElbow: new PositionSmoother(0.45),
    rElbow: new PositionSmoother(0.45),
    lWrist: new PositionSmoother(0.45),
    rWrist: new PositionSmoother(0.45),
  });
  const leftElbowEMA = useRef(new EMA(0.35));
  const rightElbowEMA = useRef(new EMA(0.35));
  const frontRepTracker = useRef(new FrontRepTracker());

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
    ctx.beginPath();
    ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = color + "33";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

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
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(-barW, 0, barW, barH, 8);
    ctx.fill();
    const fillH = barH * clamp(progress, 0, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-barW, barH - fillH, barW, fillH, 8);
    ctx.fill();
    ctx.font = "900 28px 'Inter', sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText(label, -barW / 2, -14);
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

          // Always draw faint full skeleton
          drawingUtils.drawConnectors(lm, POSE_CONNECTIONS, {
            color: "rgba(255,255,255,0.12)",
            lineWidth: 1,
          });

          if (mode === "side") {
            // ═══════════════════════════════════════════════════════
            // SIDE MODE — original strict full-body logic
            // ═══════════════════════════════════════════════════════
            const lVis =
              (lm[11].visibility || 0) + (lm[13].visibility || 0) +
              (lm[15].visibility || 0) + (lm[23].visibility || 0) +
              (lm[25].visibility || 0) + (lm[27].visibility || 0);
            const rVis =
              (lm[12].visibility || 0) + (lm[14].visibility || 0) +
              (lm[16].visibility || 0) + (lm[24].visibility || 0) +
              (lm[26].visibility || 0) + (lm[28].visibility || 0);
            const o = lVis >= rVis ? 0 : 1;

            const rawShoulder = lm[11 + o];
            const rawElbow = lm[13 + o];
            const rawWrist = lm[15 + o];
            const rawHip = lm[23 + o];
            const rawKnee = lm[25 + o];
            const rawAnkle = lm[27 + o];

            const allVisible =
              rawShoulder.visibility! > VIS_SIDE &&
              rawElbow.visibility! > VIS_SIDE &&
              rawWrist.visibility! > VIS_SIDE &&
              rawHip.visibility! > VIS_SIDE &&
              rawKnee.visibility! > VIS_SIDE &&
              rawAnkle.visibility! > VIS_SIDE;

            if (!allVisible) {
              setPoseStatus("detecting");
              animFrameRef.current = requestAnimationFrame(detect);
              return;
            }

            setPoseStatus("detected");

            const sm = smoothersRef.current;
            const shoulder = sm.shoulder.add(rawShoulder);
            const elbow = sm.elbow.add(rawElbow);
            const wrist = sm.wrist.add(rawWrist);
            const hip = sm.hip.add(rawHip);
            const knee = sm.knee.add(rawKnee);
            const ankle = sm.ankle.add(rawAnkle);

            const rawElbowAngle = calculateAngle(shoulder, elbow, wrist);
            const elbowAngle = elbowEMA.current.add(rawElbowAngle);
            const rawHipAngle = calculateAngle(shoulder, hip, ankle);
            const hipAngle = hipEMA.current.add(rawHipAngle);
            const rawKneeAngle = calculateAngle(hip, knee, ankle);
            const kneeAngle = kneeEMA.current.add(rawKneeAngle);

            const bodyErr = calculateErrorPct(180, hipAngle);
            const kneeErr = calculateErrorPct(180, kneeAngle);

            const engine = repEngineRef.current;
            tickRepEngine(engine, elbowAngle, performance.now(), A_UP, A_DOWN);

            if (engine.reps !== lastRepCountRef.current) {
              lastRepCountRef.current = engine.reps;
              onRepChange?.(engine.reps);
            }
            if (engine.phase !== lastPhaseRef.current) {
              lastPhaseRef.current = engine.phase;
              onPhaseChange?.(engine.phase);
            }

            const rawProgress = (elbowAngle - A_DOWN) / (A_UP - A_DOWN);
            const progressUp = clamp(rawProgress, 0, 1);
            const progressDown = 1 - progressUp;
            const isDescending = engine.phase === "UP" || engine.phase === "GOING_DOWN";

            // ─── SIDE DRAW ──────────────────────────────────────
            const bodyColor = bodyErr > 15 ? "rgba(255, 59, 48, 0.85)" : "rgba(166, 215, 132, 0.85)";
            drawLine(ctx, [shoulder, hip, ankle], W, H, bodyColor, 5);

            const kneeColor = kneeErr > 15 ? "rgba(255, 160, 50, 0.7)" : "rgba(255, 255, 255, 0.5)";
            drawLine(ctx, [hip, knee, ankle], W, H, kneeColor, 3);
            drawLine(ctx, [shoulder, elbow, wrist], W, H, "rgba(120, 200, 255, 0.6)", 3);

            const goodColor = "#a6d784";
            const warnColor = "#ff3b30";
            drawJoint(ctx, shoulder, W, H, bodyErr > 15 ? warnColor : goodColor);
            drawJoint(ctx, hip, W, H, bodyErr > 15 ? warnColor : goodColor);
            drawJoint(ctx, ankle, W, H, goodColor);
            drawJoint(ctx, knee, W, H, kneeErr > 15 ? "#ffa032" : goodColor);
            drawJoint(ctx, elbow, W, H, "#78c8ff", 8);
            drawJoint(ctx, wrist, W, H, "#78c8ff");

            drawMirroredText(ctx, `${Math.round(elbowAngle)}°`, elbow.x, elbow.y - 0.03, W, H, "700 18px 'Inter', sans-serif", "#78c8ff", "center");
            drawMirroredText(ctx, `${Math.round(hipAngle)}°`, hip.x, hip.y - 0.025, W, H, "600 14px 'Inter', sans-serif", bodyErr > 15 ? warnColor : goodColor, "center");
            drawMirroredText(ctx, `${Math.round(kneeAngle)}°`, knee.x, knee.y + 0.04, W, H, "600 14px 'Inter', sans-serif", kneeErr > 15 ? "#ffa032" : "rgba(255,255,255,0.6)", "center");

            // Error dashboard
            {
              const bx = W - 20;
              const by = 24;
              const bw = 240;
              const bh = 78;
              ctx.save();
              ctx.translate(bx, by);
              ctx.scale(-1, 1);
              ctx.fillStyle = "rgba(0,0,0,0.55)";
              ctx.beginPath();
              ctx.roundRect(0, 0, bw, bh, 12);
              ctx.fill();
              ctx.strokeStyle = "rgba(255,255,255,0.06)";
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.font = "800 9px 'Inter', sans-serif";
              ctx.fillStyle = "rgba(255,255,255,0.35)";
              ctx.textAlign = "left";
              ctx.letterSpacing = "2px";
              ctx.fillText("FORM ANALYSIS", 14, 18);
              ctx.font = "700 13px 'SF Mono', 'Fira Code', monospace";
              ctx.fillStyle = bodyErr > 15 ? "#ff3b30" : "#a6d784";
              ctx.fillText(`Core straight error:  ${Math.round(bodyErr)}%`, 14, 38);
              ctx.fillStyle = kneeErr > 15 ? "#ffa032" : "#a6d784";
              ctx.fillText(`Knee straight error:  ${Math.round(kneeErr)}%`, 14, 58);
              ctx.restore();
            }

            // Progress bars
            {
              const barW = 36;
              const barH = 160;
              const margin = 50;
              const barY = H / 2 - barH / 2;
              drawProgressBar(ctx, W - margin, barY, barW, barH, progressUp, "#a6d784", isDescending ? "▼" : "UP", `${Math.round(progressUp * 100)}%`);
              drawProgressBar(ctx, margin + barW, barY, barW, barH, progressDown, "#ff3b30", isDescending ? "DOWN" : "▲", `${Math.round(progressDown * 100)}%`);
            }

            // Rep counter
            {
              drawMirroredTextPx(ctx, `${engine.reps}`, W / 2, H - 55, "900 64px 'Inter', sans-serif", "rgba(255,255,255,0.9)", "center");
              drawMirroredTextPx(ctx, "PUSH UPS", W / 2, H - 32, "800 11px 'Inter', sans-serif", "rgba(166, 215, 132, 0.7)", "center");
            }

          } else {
            // ═══════════════════════════════════════════════════════
            // FRONT MODE — compact, bilateral, with depth anti-cheat
            // ═══════════════════════════════════════════════════════

            // Landmarks: 0=nose, 11=lShoulder, 12=rShoulder, 13=lElbow, 14=rElbow, 15=lWrist, 16=rWrist
            const nose = lm[0];
            const rawLS = lm[11];
            const rawRS = lm[12];
            const rawLE = lm[13];
            const rawRE = lm[14];
            const rawLW = lm[15];
            const rawRW = lm[16];

            // Visibility gate: both arms + nose (or mouth corners 9/10 as fallback)
            const noseVis = (nose.visibility || 0) > VIS_FRONT;
            const mouthVis = ((lm[9].visibility || 0) > VIS_FRONT) || ((lm[10].visibility || 0) > VIS_FRONT);
            const headVisible = noseVis || mouthVis;

            const upperVisible =
              headVisible &&
              (rawLS.visibility || 0) > VIS_FRONT &&
              (rawRS.visibility || 0) > VIS_FRONT &&
              (rawLE.visibility || 0) > VIS_FRONT &&
              (rawRE.visibility || 0) > VIS_FRONT &&
              (rawLW.visibility || 0) > VIS_FRONT &&
              (rawRW.visibility || 0) > VIS_FRONT;

            if (!upperVisible) {
              setPoseStatus("detecting");
              animFrameRef.current = requestAnimationFrame(detect);
              return;
            }

            setPoseStatus("detected");

            // Smooth positions
            const fsm = frontSmoothersRef.current;
            const lShoulder = fsm.lShoulder.add(rawLS);
            const rShoulder = fsm.rShoulder.add(rawRS);
            const lElbow = fsm.lElbow.add(rawLE);
            const rElbow = fsm.rElbow.add(rawRE);
            const lWrist = fsm.lWrist.add(rawLW);
            const rWrist = fsm.rWrist.add(rawRW);

            // Angles — both arms
            const rawLeftAngle = calculateAngle(lShoulder, lElbow, lWrist);
            const rawRightAngle = calculateAngle(rShoulder, rElbow, rWrist);
            const leftAngle = leftElbowEMA.current.add(rawLeftAngle);
            const rightAngle = rightElbowEMA.current.add(rawRightAngle);

            // Combined angle: average if symmetric, else min
            const angleDiff = Math.abs(leftAngle - rightAngle);
            const isSymmetric = angleDiff <= 25;
            const elbowAngle = isSymmetric
              ? (leftAngle + rightAngle) / 2
              : Math.min(leftAngle, rightAngle);

            // ─── Anti-cheat depth tracker ────────────────────────
            const tracker = frontRepTracker.current;
            const midShoulder = avgPoint(lShoulder, rShoulder);
            const shoulderWidthPx = distance(lShoulder, rShoulder) * W;
            tracker.updateShoulderWidth(shoulderWidthPx);
            const midShoulderYPx = midShoulder.y * H;

            // ─── Rep Engine with drop gate ───────────────────────
            const engine = repEngineRef.current;
            const prevPhase = engine.phase;

            // Feed angle to state machine
            tickRepEngine(engine, elbowAngle, performance.now(), A_UP, A_DOWN);

            // Drop tracker integration
            if (engine.phase === "GOING_DOWN" || engine.phase === "DOWN") {
              if (prevPhase === "UP") {
                tracker.startDescent(midShoulderYPx);
              }
              tracker.onFrame(midShoulderYPx);
            }

            // Gate: block DOWN confirmation if drop requirement not met
            if (engine.phase === "DOWN" && prevPhase === "GOING_DOWN") {
              if (!tracker.meetsDropRequirement()) {
                engine.phase = "GOING_DOWN"; // reject transition
              }
            }

            // Reset tracker when back to UP
            if (engine.phase === "UP" && prevPhase !== "UP") {
              tracker.resetRep();
            }

            if (engine.reps !== lastRepCountRef.current) {
              lastRepCountRef.current = engine.reps;
              onRepChange?.(engine.reps);
            }
            if (engine.phase !== lastPhaseRef.current) {
              lastPhaseRef.current = engine.phase;
              onPhaseChange?.(engine.phase);
            }

            // Progress
            const rawProgress = (elbowAngle - A_DOWN) / (A_UP - A_DOWN);
            const progressUp = clamp(rawProgress, 0, 1);
            const progressDown = 1 - progressUp;
            const isDescending = engine.phase === "UP" || engine.phase === "GOING_DOWN";

            const depthOk = tracker.meetsDropRequirement();

            // ─── FRONT DRAW ─────────────────────────────────────

            // Arms
            drawLine(ctx, [lShoulder, lElbow, lWrist], W, H, "rgba(120, 200, 255, 0.6)", 3);
            drawLine(ctx, [rShoulder, rElbow, rWrist], W, H, "rgba(120, 200, 255, 0.6)", 3);
            // Shoulder bar
            drawLine(ctx, [lShoulder, rShoulder], W, H, "rgba(166, 215, 132, 0.5)", 3);

            // Joints
            drawJoint(ctx, lShoulder, W, H, "#a6d784");
            drawJoint(ctx, rShoulder, W, H, "#a6d784");
            drawJoint(ctx, lElbow, W, H, "#78c8ff", 8);
            drawJoint(ctx, rElbow, W, H, "#78c8ff", 8);
            drawJoint(ctx, lWrist, W, H, "#78c8ff");
            drawJoint(ctx, rWrist, W, H, "#78c8ff");

            // Angle labels on both elbows
            drawMirroredText(ctx, `${Math.round(leftAngle)}°`, lElbow.x, lElbow.y - 0.03, W, H, "700 18px 'Inter', sans-serif", "#78c8ff", "center");
            drawMirroredText(ctx, `${Math.round(rightAngle)}°`, rElbow.x, rElbow.y - 0.03, W, H, "700 18px 'Inter', sans-serif", "#78c8ff", "center");

            // Front-mode HUD: Depth + Symmetry
            {
              const bx = W - 20;
              const by = 24;
              const bw = 240;
              const bh = 78;
              ctx.save();
              ctx.translate(bx, by);
              ctx.scale(-1, 1);
              ctx.fillStyle = "rgba(0,0,0,0.55)";
              ctx.beginPath();
              ctx.roundRect(0, 0, bw, bh, 12);
              ctx.fill();
              ctx.strokeStyle = "rgba(255,255,255,0.06)";
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.font = "800 9px 'Inter', sans-serif";
              ctx.fillStyle = "rgba(255,255,255,0.35)";
              ctx.textAlign = "left";
              ctx.letterSpacing = "2px";
              ctx.fillText("FORM ANALYSIS", 14, 18);
              ctx.font = "700 13px 'SF Mono', 'Fira Code', monospace";

              // Depth status
              const inDescent = engine.phase === "GOING_DOWN" || engine.phase === "DOWN";
              const depthLabel = inDescent
                ? (depthOk ? "Depth:  OK ✓" : "Depth:  Too shallow")
                : "Depth:  —";
              ctx.fillStyle = inDescent ? (depthOk ? "#a6d784" : "#ff3b30") : "rgba(255,255,255,0.4)";
              ctx.fillText(depthLabel, 14, 38);

              // Symmetry status
              const symLabel = isSymmetric ? "Symmetry:  OK ✓" : `Symmetry:  Uneven (${Math.round(angleDiff)}°)`;
              ctx.fillStyle = isSymmetric ? "#a6d784" : "#ffa032";
              ctx.fillText(symLabel, 14, 58);

              ctx.restore();
            }

            // Progress bars
            {
              const barW = 36;
              const barH = 160;
              const margin = 50;
              const barY = H / 2 - barH / 2;
              drawProgressBar(ctx, W - margin, barY, barW, barH, progressUp, "#a6d784", isDescending ? "▼" : "UP", `${Math.round(progressUp * 100)}%`);
              drawProgressBar(ctx, margin + barW, barY, barW, barH, progressDown, "#ff3b30", isDescending ? "DOWN" : "▲", `${Math.round(progressDown * 100)}%`);
            }

            // Rep counter
            {
              drawMirroredTextPx(ctx, `${engine.reps}`, W / 2, H - 55, "900 64px 'Inter', sans-serif", "rgba(255,255,255,0.9)", "center");
              drawMirroredTextPx(ctx, "PUSH UPS", W / 2, H - 32, "800 11px 'Inter', sans-serif", "rgba(166, 215, 132, 0.7)", "center");
            }
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
    [videoRef, landmarker, mode, onRepChange, onPhaseChange],
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

  // ─── Reset engine when mode changes ───────────────────────────────
  useEffect(() => {
    repEngineRef.current = createRepEngine();
    lastRepCountRef.current = 0;
    lastPhaseRef.current = "UP";
    frontRepTracker.current.resetRep();
  }, [mode]);

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
              {mode === "front"
                ? "Keep shoulders & elbows in frame"
                : "Position yourself for push-ups"}
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
