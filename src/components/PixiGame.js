import { useEffect, useRef, useState } from "react";
import { initializePixiApp, createElectricEffects } from "./core/PixiSetup";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";

export default function PixiGame({ onCanvasBoundsChange }) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const bgSpriteRef = useRef(null);

  const reelFrameSpriteRef = useRef(null);
  const outlineRef = useRef(null);
  const sparksRef = useRef(null);
  const neonRef = useRef(null);
  const bgFadeRef = useRef(null);
  const burstTimerRef = useRef(null);
  const modalEnterTimerRef = useRef(null);

  const [effectsOn, setEffectsOn] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalEnter, setModalEnter] = useState(false);
  const [canvasBounds, setCanvasBounds] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    scale: 1,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let mounted = true;
    initializePixiApp({ container }).then(
      async ({
        app,
        bgSprite,
        reelFrameSprite,
        electricOutline,
        electricSparks,
      }) => {
        if (!mounted) return;
        appRef.current = app;
        bgSpriteRef.current = bgSprite;
        reelFrameSpriteRef.current = reelFrameSprite;
        outlineRef.current = electricOutline || null;
        sparksRef.current = electricSparks || null;
      }
    );
    return () => {
      mounted = false;
      if (appRef.current?.destroy) {
        appRef.current.destroy(true, true);
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    function resizeApp() {
      if (!containerRef.current || !appRef.current?.view) return;
      const container = containerRef.current;
      const view = appRef.current.view;

      const scaleX = container.clientWidth / GAME_WIDTH;
      const scaleY = container.clientHeight / GAME_HEIGHT;
      const scale = Math.min(scaleX, scaleY, 1);

      const canvasWidth = GAME_WIDTH * scale;
      const canvasHeight = GAME_HEIGHT * scale;

      view.style.width = `${canvasWidth}px`;
      view.style.height = `${canvasHeight}px`;
      view.style.position = "absolute";
      view.style.left = `${(container.clientWidth - canvasWidth) / 2}px`;
      view.style.top = `${(container.clientHeight - canvasHeight) / 2}px`;

      // Report to parent for HUD anchoring + scaling
      const rect = view.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      const bounds = {
        left: rect.left - parentRect.left,
        top: rect.top - parentRect.top,
        width: rect.width,
        height: rect.height,
        scale,
      };
      setCanvasBounds(bounds);
      onCanvasBoundsChange?.(bounds);
    }
    window.addEventListener("resize", resizeApp);
    requestAnimationFrame(resizeApp);
    return () => window.removeEventListener("resize", resizeApp);
  }, [onCanvasBoundsChange]);

  function destroyEffects() {
    if (outlineRef.current) {
      outlineRef.current.destroy?.();
      outlineRef.current = null;
    }
    if (sparksRef.current) {
      sparksRef.current.destroy?.();
      sparksRef.current = null;
    }
    if (neonRef.current) {
      neonRef.current.destroy?.();
      neonRef.current = null;
    }
  }

  function createEffects() {
    if (!appRef.current || !reelFrameSpriteRef.current) return;
    const { outline, sparks, neon } = createElectricEffects({
      app: appRef.current,
      stage: appRef.current.stage,
      frameSprite: reelFrameSpriteRef.current,
    });
    outlineRef.current = outline;
    sparksRef.current = sparks;
    neonRef.current = neon;
  }

  function handleToggleEffects() {
    if (effectsOn) {
      if (burstTimerRef.current) {
        clearTimeout(burstTimerRef.current);
        burstTimerRef.current = null;
      }
      if (modalEnterTimerRef.current) {
        clearTimeout(modalEnterTimerRef.current);
        modalEnterTimerRef.current = null;
      }
      destroyEffects();
      fadeBackground(1.0, 700);
      setModalVisible(false);
      setModalEnter(false);
      setEffectsOn(false);
    } else {
      createEffects();
      fadeBackground(0.15, 700);
      // After 2 seconds, stop outline and sparks but keep neon particles
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => {
        if (outlineRef.current) {
          outlineRef.current.destroy?.();
          outlineRef.current = null;
        }
        if (sparksRef.current) {
          sparksRef.current.destroy?.();
          sparksRef.current = null;
        }
        // Prepare modal slide-in
        setModalEnter(false);
        setModalVisible(true);
        if (modalEnterTimerRef.current) clearTimeout(modalEnterTimerRef.current);
        modalEnterTimerRef.current = setTimeout(() => {
          setModalEnter(true);
          modalEnterTimerRef.current = null;
        }, 30);
        burstTimerRef.current = null;
      }, 2000);
      setEffectsOn(true);
    }
  }

  function fadeBackground(targetAlpha, durationMs = 600) {
    const app = appRef.current;
    const bg = bgSpriteRef.current;
    if (!app || !bg) return;
    // Cancel previous fade if any
    if (bgFadeRef.current) app.ticker.remove(bgFadeRef.current);
    const startAlpha = typeof bg.alpha === "number" ? bg.alpha : 1;
    const startTime = performance.now();
    const ease = (t) => t; // linear
    const tick = () => {
      const t = Math.min(1, (performance.now() - startTime) / durationMs);
      const k = ease(t);
      bg.alpha = startAlpha + (targetAlpha - startAlpha) * k;
      if (t >= 1) {
        app.ticker.remove(tick);
        bgFadeRef.current = null;
      }
    };
    bgFadeRef.current = tick;
    app.ticker.add(tick);
  }

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (modalEnterTimerRef.current) clearTimeout(modalEnterTimerRef.current);
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        className="canvas-container"
        style={{ width: "100%", height: "100%" }}
      />
      {/* Overlay that matches the canvas bounds for HUD/UI positioning */}
      <div
        onClick={() => {
          if (modalVisible) setModalVisible(false);
        }}
        style={{
          position: "absolute",
          left: `${canvasBounds.left}px`,
          top: `${canvasBounds.top}px`,
          width: `${canvasBounds.width}px`,
          height: `${canvasBounds.height}px`,
          pointerEvents: modalVisible ? "auto" : "none",
        }}
      >
        {/* Neon modal positioned to fit within the reel frame */}
        {modalVisible &&
          (() => {
            const frame = reelFrameSpriteRef.current;
            const scale = canvasBounds.scale || 1;
            const fx = frame ? frame.x * scale : 0;
            const fy = frame ? frame.y * scale : 0;
            const fw = frame ? frame.width * scale : 0;
            const fh = frame ? frame.height * scale : 0;
            // Allow easy adjustment of modal size relative to frame
            const modalW = fw * 0.9; // tweak as desired
            const modalH = fh * 0.9; // tweak as desired
            const mx = fx + (fw - modalW) / 2;
            const my = fy + (fh - modalH) / 2;
            return (
              <div
                style={{
                  position: "absolute",
                  left: `${mx}px`,
                  top: `${my}px`,
                  width: `${modalW}px`,
                  height: `${modalH}px`,
                  border: "2px solid #4dd9ff",
                  borderRadius: 12,
                  boxShadow:
                    "0 0 12px rgba(77,217,255,0.9), 0 0 28px rgba(77,217,255,0.5)",
                  background:
                    "linear-gradient(180deg, rgba(10,16,24,0.85), rgba(10,16,24,0.75))",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e6faff",
                  textAlign: "center",
                  gap: 8,
                  padding: 16,
                  pointerEvents: "auto",
                  transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 420ms ease",
                  transform: modalEnter ? "translateY(0px)" : `translateY(-${Math.round(modalH * 0.25)}px)`,
                  opacity: modalEnter ? 1 : 0,
                }}
              >
            <div style={{ transform: "translateY(-20px)", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Subtle animated image area */}
            <div
              className="modal-art-wrap"
              style={{ width: "min(40%, 320px)", position: "relative", marginBottom: 8 }}
            >
              <img
                className="modal-art"
                src="/imgs/bl1.png"
                alt=""
                style={{ width: "100%", display: "block" }}
              />
              {/* shimmer removed */}
            </div>
            <div
              style={{
                fontSize: Math.max(14, Math.round(modalH * 0.10)),
                fontWeight: 800,
                letterSpacing: 1,
                textShadow: "0 0 6px rgba(77,217,255,0.8)",
              }}
            >
              Congratulations
            </div>
            <div
              style={{
                fontSize: Math.max(12, Math.round(modalH * 0.075)),
                fontWeight: 600,
                opacity: 0.95,
              }}
            >
              You have won 8 Bonus Spins
            </div>
            </div>
              </div>
            );
          })()}
        <button
          onClick={handleToggleEffects}
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            pointerEvents: "auto",
            padding: "8px 12px",
            background: effectsOn ? "#1f2937" : "#374151",
            color: "#e5e7eb",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 6,
            fontSize: 12,
            cursor: "pointer",
            opacity: 0.85,
          }}
        >
          {effectsOn ? "Disable FX" : "Enable FX"}
        </button>
      </div>
    </div>
  );
}
