import * as PIXI from "pixi.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import ElectricOutlineEffect from "./ElectricOutlineEffect";
import ElectricFrameEffect from "./LightningEffect";
import NeonParticleFlow from "./NeonParticleFlow";

export function createElectricEffects({ app, stage, frameSprite }) {
  const outline = new ElectricOutlineEffect({
    app,
    stage,
    frameSprite,
    options: {
      margin: 10,
      segmentsPerEdge: 90,
      amplitude: 12,
      speed: 4.2,
      colorGlow: 0x4dd9ff,
      lineWidthGlow: 20,
      lineWidthCore: 1,
      blur: 10,
      zIndex: 15,
    },
  });
  const sparks = new ElectricFrameEffect({
    app,
    stage,
    frameSprite,
    options: {
      margin: 15,
      maxBolts: 7,
      spawnChance: 0.3,
      minLife: 50,
      maxLife: 140,
      amplitude: 22,
      segments: 7,
      colorGlow: 0x4dd9ff,
      lineWidthGlow: 10,
      lineWidthCore: 2,
      blur: 10,
      zIndex: 20,
    },
  });
  const neon = new NeonParticleFlow({
    app,
    stage,
    frameSprite,
    options: {
      zIndex: 18,
      spawnRate: 140,
      maxParticles: 240,
      minLife: 0.6,
      maxLife: 1.6,
      minSpeed: 140,
      maxSpeed: 260,
      sizeMin: 2,
      sizeMax: 5,
      inwardChance: 0.55,
      tangentialJitter: 80,
      fadeDistance: 260,
      inward: {
        speedMul: 0.85,
        lifeMul: 1.25,
        sizeMul: 0.95,
        color: 0x66eeff,
        drag: 0.93,
        alphaBias: 0.10,
        alphaMul: 1.0,
        fadeDistMul: 0.8,
      },
      outward: {
        speedMul: 1.35,
        lifeMul: 1.2,
        sizeMul: 1.05,
        color: 0x33ccff,
        drag: 0.97,
        alphaBias: 0.12,
        alphaMul: 1.1,
        fadeDistMul: 2.5,
      },
    },
  });
  return { outline, sparks, neon };
}

export async function initializePixiApp({ container }) {
  const app = new PIXI.Application({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 0x1e1e1e,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.appendChild(app.view);
  // Enable zIndex-based layering
  app.stage.sortableChildren = true;

  const path = "/imgs/abg1.png";
  const bgTexture = PIXI.Texture.from(path);
  const bgSprite = new PIXI.Sprite(bgTexture);
  bgSprite.width = GAME_WIDTH;
  bgSprite.height = GAME_HEIGHT;
  bgSprite.zIndex = 0;
  app.stage.addChild(bgSprite);

  const reelFrameTexture = PIXI.Texture.from("/imgs/gf.png");
  const reelFrameSprite = new PIXI.Sprite(reelFrameTexture);
  reelFrameSprite.width = 130 * 5 + 80;
  reelFrameSprite.height = 130 * 4 + 60;
  reelFrameSprite.x = 275;
  reelFrameSprite.y = 70;
  reelFrameSprite.zIndex = 10;
  app.stage.addChild(reelFrameSprite);

  return {
    app,
    bgSprite,
    reelFrameSprite,
  };
}
