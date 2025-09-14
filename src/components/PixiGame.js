import { useEffect, useRef, useState } from "react";
import { initializePixiApp, createElectricEffects } from "./core/PixiSetup";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";
import WinModal from "./WinModal";

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
  const fxPromiseRef = useRef(null);
  const fxResolveRef = useRef(null);

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
      if (fxResolveRef.current) {
        const resolve = fxResolveRef.current;
        fxResolveRef.current = null;
        fxPromiseRef.current = null;
        resolve(false);
      }
    };
  }, []);

  function handleToggleEffects() {
    // Start sequence and return a promise that resolves on modal dismiss
    if (effectsOn && fxPromiseRef.current) return fxPromiseRef.current;
    fxPromiseRef.current = new Promise((resolve) => {
      fxResolveRef.current = resolve;
    });
    createEffects();
    fadeBackground(0.15, 700);
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
      if (modalEnterTimerRef.current)
        clearTimeout(modalEnterTimerRef.current);
      modalEnterTimerRef.current = setTimeout(() => {
        setModalEnter(true);
        modalEnterTimerRef.current = null;
      }, 30);
      burstTimerRef.current = null;
    }, 2000);
    setEffectsOn(true);
    return fxPromiseRef.current;
  }

  function dismissModalAndCleanup() {
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
    if (fxResolveRef.current) {
      const resolve = fxResolveRef.current;
      fxResolveRef.current = null;
      fxPromiseRef.current = null;
      resolve(true);
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        className="canvas-container"
        style={{ width: "100%", height: "100%" }}
      />
      {/* Overlay that matches the canvas bounds for HUD/UI positioning */}
      <div
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
        {(() => {
          const frame = reelFrameSpriteRef.current;
          const scale = canvasBounds.scale || 1;
          const frameRect = frame
            ? {
                x: frame.x * scale,
                y: frame.y * scale,
                width: frame.width * scale,
                height: frame.height * scale,
              }
            : { x: 0, y: 0, width: 0, height: 0 };
          return (
            <WinModal
              visible={modalVisible}
              entering={modalEnter}
              frameRect={frameRect}
              onDismiss={dismissModalAndCleanup}
            />
          );
        })()}
        <button
          onClick={() => void handleToggleEffects()}
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            pointerEvents: "auto",
            padding: "8px 12px",
            background: effectsOn ? "#374151" : "#1f2937",
            color: "#e5e7eb",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 6,
            fontSize: 12,
            cursor: "pointer",
            opacity: 0.85,
          }}
          disabled={effectsOn}
        >
          {effectsOn ? "Running..." : "Trigger FX"}
        </button>
      </div>
    </div>
  );
}
