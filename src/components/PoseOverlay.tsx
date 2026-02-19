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
  BodyDepthTracker,
  type RepPhase,
  type Point,
} from "~/lib/poseMath";

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

// ─── Constants ───────────────────────────────────────────────────────
const A_DOWN = 95; // Fixed down threshold for stability
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

  // Calibration state
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const dynamicUpRef = useRef(150);
  const calibrationFramesRef = useRef(0);
  const maxAngleAccumRef = useRef<number[]>([]);

  // ─── Refs for zero-lag state (never causes re-render) ──────────────
  const repEngineRef = useRef(createRepEngine());
  const lastRepCountRef = useRef(0);
  const lastPhaseRef = useRef<RepPhase>("UP");
  const depthTrackerRef = useRef(new BodyDepthTracker());
  const isValidRepRef = useRef(true);

  // Smoothers
  const smoothersRef = useRef({
    shoulder: new PositionSmoother(0.45),
    elbow: new PositionSmoother(0.45),
    wrist: new PositionSmoother(0.45),
    hip: new PositionSmoother(0.45),
    knee: new PositionSmoother(0.45),
    ankle: new PositionSmoother(0.45),
  });

  const frontSmoothersRef = useRef({
    lShoulder: new PositionSmoother(0.45),
    rShoulder: new PositionSmoother(0.45),
    lElbow: new PositionSmoother(0.45),
    rElbow: new PositionSmoother(0.45),
    lWrist: new PositionSmoother(0.45),
    rWrist: new PositionSmoother(0.45),
  });

  const elbowEMA = useRef(new EMA(0.35));
  const hipEMA = useRef(new EMA(0.35));
  const kneeEMA = useRef(new EMA(0.35));
  const leftElbowEMA = useRef(new EMA(0.35));
  const rightElbowEMA = useRef(new EMA(0.35));

  // Sync status
  useEffect(() => {
    if (modelError) setPoseStatus("none");
    else if (isModelLoading) setPoseStatus("loading");
    else if (landmarker) setPoseStatus("detecting");
  }, [isModelLoading, modelError, landmarker]);

  // ─── Drawing Helpers ───────────────────────────────────────────────
  function drawLine(ctx: CanvasRenderingContext2D, pts: Point[], w: number, h: number, color: string, lineW = 4) {
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
    ctx.stroke();
  }

  function drawJoint(ctx: CanvasRenderingContext2D, p: Point, w: number, h: number, color = "#a6d784", radius = 7) {
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

  function drawMirroredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, font: string, color: string, align: CanvasTextAlign = "center") {
    ctx.save();
    ctx.translate(x * w, y * h);
    ctx.scale(-1, 1);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.shadowBlur = 4;
    ctx.shadowColor = "black";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drawMirroredTextPx(ctx: CanvasRenderingContext2D, text: string, xPx: number, yPx: number, font: string, color: string, align: CanvasTextAlign = "center") {
    ctx.save();
    ctx.translate(xPx, yPx);
    ctx.scale(-1, 1);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.shadowBlur = 4;
    ctx.shadowColor = "black";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drawBigIndicator(ctx: CanvasRenderingContext2D, text: string, color: string, W: number, H: number) {
    ctx.save();
    ctx.translate(W / 2, H * 0.2);
    ctx.scale(-1, 1);
    ctx.font = "black 900 48px Inter";
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // ─── Main Detection Loop ──────────────────────────────────────────
  const detect = useCallback((timestamp: number) => {
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
    if (!ctx) return;
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

        drawingUtils.drawConnectors(lm, POSE_CONNECTIONS, { color: "rgba(255,255,255,0.1)", lineWidth: 1 });

        let elbowAngle = 0;
        let isSymmetric = true;
        let angleDiff = 0;
        let depthOk = false;
        let shoulderWidthPx = 0;
        let currentDepthSignal = 0;
        let targetDepth = 0;

        if (mode === "side") {
          const lVis = (lm[11].visibility || 0) + (lm[13].visibility || 0) + (lm[15].visibility || 0) + (lm[23].visibility || 0) + (lm[25].visibility || 0) + (lm[27].visibility || 0);
          const rVis = (lm[12].visibility || 0) + (lm[14].visibility || 0) + (lm[16].visibility || 0) + (lm[24].visibility || 0) + (lm[26].visibility || 0) + (lm[28].visibility || 0);
          const o = lVis >= rVis ? 0 : 1;
          const rawS = lm[11+o], rawE = lm[13+o], rawW = lm[15+o], rawH = lm[23+o], rawK = lm[25+o], rawA = lm[27+o];

          const allVisible = [rawS, rawE, rawW, rawH, rawK, rawA].every(p => (p.visibility || 0) > VIS_SIDE);
          if (!allVisible) {
            setPoseStatus("detecting");
            animFrameRef.current = requestAnimationFrame(detect);
            return;
          }
          setPoseStatus("detected");

          const sm = smoothersRef.current;
          const S = sm.shoulder.add(rawS), E = sm.elbow.add(rawE), Wt = sm.wrist.add(rawW), Hi = sm.hip.add(rawH), K = sm.knee.add(rawK), A = sm.ankle.add(rawA);
          
          elbowAngle = elbowEMA.current.add(calculateAngle(S, E, Wt));
          const hipAngle = hipEMA.current.add(calculateAngle(S, Hi, A));
          const kneeAngle = kneeEMA.current.add(calculateAngle(Hi, K, A));
          const bodyErr = calculateErrorPct(180, hipAngle);
          const kneeErr = calculateErrorPct(180, kneeAngle);

          // Proximity
          shoulderWidthPx = distance(lm[11], lm[12]) * W;
          if (shoulderWidthPx < 100) drawBigIndicator(ctx, "MOVE CLOSER", "#facc15", W, H);
          else if (shoulderWidthPx > 350) drawBigIndicator(ctx, "MOVE BACK", "#facc15", W, H);

          // Anti-cheat depth
          const depthTracker = depthTrackerRef.current;
          depthTracker.setRequiredDrop(shoulderWidthPx, "side");
          if (repEngineRef.current.phase === "UP") depthTracker.updateBaseline(S.y * H);
          else depthTracker.trackDepth(S.y * H);
          depthOk = depthTracker.checkValidity();
          currentDepthSignal = depthTracker.depthSignal;
          targetDepth = depthTracker.target;

          // Drawing SIDE
          drawLine(ctx, [S, Hi, A], W, H, bodyErr > 15 ? "#ff3b30" : "#a6d784", 5);
          drawLine(ctx, [Hi, K, A], W, H, kneeErr > 15 ? "#ffa032" : "rgba(255,255,255,0.5)", 3);
          drawLine(ctx, [S, E, Wt], W, H, "#78c8ff", 3);
          [S, E, Wt, Hi, K, A].forEach(p => drawJoint(ctx, p, W, H, "#a6d784"));
          drawMirroredText(ctx, `${Math.round(elbowAngle)}°`, E.x, E.y - 0.03, W, H, "700 18px Inter", "#78c8ff");
        } else {
          // FRONT MODE
          const nose = lm[0], rawLS = lm[11], rawRS = lm[12], rawLE = lm[13], rawRE = lm[14], rawLW = lm[15], rawRW = lm[16];
          const upperVisible = [rawLS, rawRS, rawLE, rawRE, rawLW, rawRW].every(p => (p.visibility || 0) > VIS_FRONT) && (nose.visibility || 0) > VIS_FRONT;

          if (!upperVisible) {
            setPoseStatus("detecting");
            animFrameRef.current = requestAnimationFrame(detect);
            return;
          }
          setPoseStatus("detected");

          const fsm = frontSmoothersRef.current;
          const LS = fsm.lShoulder.add(rawLS), RS = fsm.rShoulder.add(rawRS), LE = fsm.lElbow.add(rawLE), RE = fsm.rElbow.add(rawRE), LW = fsm.lWrist.add(rawLW), RW = fsm.rWrist.add(rawRW);
          const LA = leftElbowEMA.current.add(calculateAngle(LS, LE, LW));
          const RA = rightElbowEMA.current.add(calculateAngle(RS, RE, RW));

          angleDiff = Math.abs(LA - RA);
          isSymmetric = angleDiff <= 30;
          elbowAngle = isSymmetric ? (LA + RA) / 2 : Math.min(LA, RA);

          // Proximity
          shoulderWidthPx = distance(LS, RS) * W;
          if (shoulderWidthPx < 180) drawBigIndicator(ctx, "MOVE CLOSER", "#facc15", W, H);
          else if (shoulderWidthPx > 450) drawBigIndicator(ctx, "MOVE BACK", "#facc15", W, H);

          // Anti-cheat depth
          const depthTracker = depthTrackerRef.current;
          depthTracker.setRequiredDrop(shoulderWidthPx, "front");
          const midShoulderY = (LS.y + RS.y) / 2 * H;
          if (repEngineRef.current.phase === "UP") depthTracker.updateBaseline(midShoulderY);
          else depthTracker.trackDepth(midShoulderY);
          depthOk = depthTracker.checkValidity();

          // Drawing FRONT
          drawLine(ctx, [LS, LE, LW], W, H, "#78c8ff", 4);
          drawLine(ctx, [RS, RE, RW], W, H, "#78c8ff", 4);
          drawLine(ctx, [LS, RS], W, H, "rgba(166,215,132,0.5)", 3);
          [LS, LE, LW, RS, RE, RW].forEach(p => drawJoint(ctx, p, W, H, "#a6d784"));
          drawMirroredText(ctx, `${Math.round(LA)}°`, LE.x, LE.y - 0.03, W, H, "700 18px Inter", "#78c8ff");
          drawMirroredText(ctx, `${Math.round(RA)}°`, RE.x, RE.y - 0.03, W, H, "700 18px Inter", "#78c8ff");
        }

        // ─── Shared Counting & Calibration ──────────────────────────
        if (calibrationFramesRef.current < 60) {
          calibrationFramesRef.current++;
          maxAngleAccumRef.current.push(elbowAngle);
          setCalibrationProgress(Math.round((calibrationFramesRef.current / 60) * 100));
          if (calibrationFramesRef.current === 60) {
            const avgMax = maxAngleAccumRef.current.reduce((a,b)=>a+b,0) / 60;
            dynamicUpRef.current = clamp(avgMax - 5, 140, 160);
          }
        } else {
          const engine = repEngineRef.current;
          const prevPhase = engine.phase;
          tickRepEngine(engine, elbowAngle, performance.now(), dynamicUpRef.current, A_DOWN);

          if (prevPhase === "GOING_UP" && engine.phase === "UP") {
             if (!isValidRepRef.current) engine.reps--; // Rollback if depth failed
             depthTrackerRef.current.resetRep();
             isValidRepRef.current = true;
          }

          if (engine.phase === "GOING_UP" && prevPhase === "DOWN") {
             if (!depthOk) isValidRepRef.current = false;
          }

          if (engine.reps !== lastRepCountRef.current) {
            lastRepCountRef.current = engine.reps;
            onRepChange?.(engine.reps);
          }
          if (engine.phase !== lastPhaseRef.current) {
            lastPhaseRef.current = engine.phase;
            onPhaseChange?.(engine.phase);
          }
        }

        // ─── Shared HUD ─────────────────────────────────────────────
        const engine = repEngineRef.current;
        const rawProgress = (elbowAngle - A_DOWN) / (dynamicUpRef.current - A_DOWN);
        const pUp = clamp(rawProgress, 0, 1), pDown = 1 - pUp;
        const isD = engine.phase === "UP" || engine.phase === "GOING_DOWN";

        // Progress bars
        const barW = 36, barH = 160, margin = 50, barY = H/2 - barH/2;
        drawProgressBar(ctx, W-margin, barY, barW, barH, pUp, "#a6d784", isD ? "▼" : "UP", `${Math.round(pUp*100)}%`);
        drawProgressBar(ctx, margin+barW, barY, barW, barH, pDown, "#ff3b30", isD ? "DOWN" : "▲", `${Math.round(pDown*100)}%`);

        // Analysis Box
        const bx = W-20, by = 24, bw = 240, bh = 78;
        ctx.save(); ctx.translate(bx, by); ctx.scale(-1, 1);
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(0, 0, bw, bh, 12); ctx.fill();
        ctx.font = "800 10px Inter"; ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillText("FORM ANALYSIS", 14, 18);
        ctx.font = "700 14px Inter"; 
        ctx.fillStyle = depthOk ? "#a6d784" : "#ff3b30";
        ctx.fillText(depthOk ? "Depth: OK ✓" : "Depth: SHALLOW", 14, 40);
        if (mode === "front") {
          ctx.fillStyle = isSymmetric ? "#a6d784" : "#fb923c";
          ctx.fillText(isSymmetric ? "Symmetry: OK ✓" : "Symmetry: UNEVEN", 14, 60);
        } else {
          ctx.font = "700 12px Inter"; ctx.fillStyle = "white";
          ctx.fillText(`Lockout: ${Math.round(dynamicUpRef.current)}°`, 14, 60);
        }
        ctx.restore();

        // Big Rep Counter
        drawMirroredTextPx(ctx, `${engine.reps}`, W/2, H-60, "900 80px Inter", "white");
      } else {
        setPoseStatus("detecting");
      }
    } catch (err) { console.warn(err); }
    animFrameRef.current = requestAnimationFrame(detect);
  }, [videoRef, landmarker, mode, onRepChange, onPhaseChange]);

  useEffect(() => {
    let active = true;
    const start = () => { if (active && isRunning && landmarker) animFrameRef.current = requestAnimationFrame(detect); };
    setTimeout(start, 600);
    return () => { active = false; cancelAnimationFrame(animFrameRef.current); };
  }, [isRunning, detect, landmarker]);

  // Reset on mode change
  useEffect(() => {
    repEngineRef.current = createRepEngine();
    lastRepCountRef.current = 0;
    calibrationFramesRef.current = 0;
    maxAngleAccumRef.current = [];
    depthTrackerRef.current = new BodyDepthTracker();
    setCalibrationProgress(0);
  }, [mode]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none" style={{ zIndex: 11 }} />
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-3">
        {poseStatus === "detecting" && (
          <div className="glass px-10 py-6 rounded-[2rem] border border-white/10 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
            <h3 className="text-xl font-black uppercase italic text-primary">Setup Checklist</h3>
            <ul className="text-sm font-bold opacity-80 space-y-2 text-center">
              {mode === "front" ? (
                <><li>✓ Laptop on desk</li><li>✓ Step back 1-2 steps</li><li>✓ Arms in frame</li></>
              ) : (
                <><li>✓ Laptop to the side</li><li>✓ Full body in frame</li><li>✓ Good lighting</li></>
              )}
            </ul>
          </div>
        )}
        {calibrationProgress > 0 && calibrationProgress < 100 && (
          <div className="glass px-6 py-2 rounded-full border border-primary/40 flex items-center gap-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Calibrating Lockout: {calibrationProgress}%</span>
          </div>
        )}
        {poseStatus === "detected" && calibrationProgress === 100 && (
          <div className="glass px-5 py-2 rounded-full border border-emerald-500/20 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Tracking Active</span>
          </div>
        )}
      </div>
    </>
  );
}

function drawProgressBar(ctx: CanvasRenderingContext2D, x: number, y: number, barW: number, barH: number, progress: number, color: string, label: string, pct: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(-barW, 0, barW, barH, 8); ctx.fill();
  const fillH = barH * clamp(progress, 0, 1); ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(-barW, barH - fillH, barW, fillH, 8); ctx.fill();
  ctx.font = "900 24px Inter"; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(label, -barW/2, -10);
  ctx.font = "700 14px Inter"; ctx.fillStyle = "white"; ctx.fillText(pct, -barW/2, barH + 20);
  ctx.restore();
}
