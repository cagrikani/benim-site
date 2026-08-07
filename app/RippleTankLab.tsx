"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type WaveMode =
  | "reflection"
  | "measurement"
  | "diffraction"
  | "refraction"
  | "interference";
type Point = { x: number; y: number };
type Vector = { x: number; y: number };
type SourceType = "plane" | "circular" | "pulse";
type SourceBarType = SourceType | "double";
type ReflectorType = "straight" | "parabolic";
type DiffractionType = "edge" | "slit";

type ReflectionReading = {
  id: number;
  source: string;
  reflector: string;
  angle: number;
  result: string;
};
type MeasurementReading = {
  id: number;
  frequency: number;
  wavelength: number;
  period: number;
  speed: number;
  pattern: string;
};
type DiffractionReading = {
  id: number;
  kind: string;
  wavelength: number;
  opening: number | null;
  ratio: number | null;
  spread: number | null;
};
type RefractionReading = {
  id: number;
  deepDepth: number;
  shallowDepth: number;
  wavelengthDeep: number;
  wavelengthShallow: number;
  incidenceAngle: number;
  refractionAngle: number;
};
type InterferenceReading = {
  id: number;
  separation: number;
  wavelength: number;
  pathDifference: number;
  fringeOrder: number;
  result: string;
};

const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 560;
const TANK = { x: 48, y: 52, width: 660, height: 454 };
const GRAVITY = 9.81;
const SETUP_ORDER = ["tank", "motor", "source", "power", "apparatus"] as const;
type SetupKind = (typeof SETUP_ORDER)[number];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const format = (value: number, digits = 1) =>
  Number(value.toFixed(digits)).toLocaleString("tr-TR");

function add(point: Point, vector: Vector, scale = 1): Point {
  return { x: point.x + vector.x * scale, y: point.y + vector.y * scale };
}

function subtract(first: Point, second: Point): Vector {
  return { x: first.x - second.x, y: first.y - second.y };
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function dot(first: Vector, second: Vector) {
  return first.x * second.x + first.y * second.y;
}

function reflect(direction: Vector, normal: Vector): Vector {
  const projection = dot(direction, normal);
  return normalize({
    x: direction.x - 2 * projection * normal.x,
    y: direction.y - 2 * projection * normal.y,
  });
}

function speedForDepth(depthCm: number) {
  return Math.sqrt(GRAVITY * (depthCm / 100)) * 100;
}

function pointFromPointer(event: ReactPointerEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
  };
}

function prepareCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(rect.width, 320);
  const cssHeight = cssWidth * (CANVAS_HEIGHT / CANVAS_WIDTH);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(cssWidth * ratio);
  const pixelHeight = Math.round(cssHeight * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(
    (cssWidth / CANVAS_WIDTH) * ratio,
    0,
    0,
    (cssHeight / CANVAS_HEIGHT) * ratio,
    0,
    0,
  );
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  return context;
}

function clipTank(context: CanvasRenderingContext2D) {
  context.beginPath();
  context.roundRect(TANK.x + 13, TANK.y + 13, TANK.width - 26, TANK.height - 26, 16);
  context.clip();
}

function drawLabBench(context: CanvasRenderingContext2D) {
  const wood = context.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  wood.addColorStop(0, "#9d704f");
  wood.addColorStop(0.48, "#b9865d");
  wood.addColorStop(1, "#83583e");
  context.fillStyle = wood;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.strokeStyle = "rgba(77,45,29,0.11)";
  context.lineWidth = 2;
  for (let x = 28; x < CANVAS_WIDTH; x += 82) {
    context.beginPath();
    context.moveTo(x, 0);
    context.bezierCurveTo(x - 8, 170, x + 8, 370, x, CANVAS_HEIGHT);
    context.stroke();
  }
  context.save();
  context.shadowColor = "rgba(50,31,20,0.34)";
  context.shadowBlur = 22;
  context.fillStyle = "#e7ecea";
  context.beginPath();
  context.roundRect(22, 20, CANVAS_WIDTH - 44, CANVAS_HEIGHT - 40, 24);
  context.fill();
  context.shadowBlur = 0;
  const mat = context.createLinearGradient(22, 20, 22, CANVAS_HEIGHT - 20);
  mat.addColorStop(0, "#eef4f2");
  mat.addColorStop(1, "#d7e1de");
  context.fillStyle = mat;
  context.beginPath();
  context.roundRect(30, 28, CANVAS_WIDTH - 60, CANVAS_HEIGHT - 56, 19);
  context.fill();
  context.strokeStyle = "rgba(57,91,94,0.08)";
  context.lineWidth = 1;
  for (let x = 46; x < CANVAS_WIDTH - 30; x += 42) {
    context.beginPath();
    context.moveTo(x, 28);
    context.lineTo(x, CANVAS_HEIGHT - 28);
    context.stroke();
  }
  for (let y = 42; y < CANVAS_HEIGHT - 28; y += 42) {
    context.beginPath();
    context.moveTo(30, y);
    context.lineTo(CANVAS_WIDTH - 30, y);
    context.stroke();
  }
  context.restore();
}

function drawTankFrame(context: CanvasRenderingContext2D) {
  context.save();
  context.shadowColor = "rgba(22, 52, 56, 0.34)";
  context.shadowBlur = 20;
  context.fillStyle = "#4e686b";
  context.beginPath();
  context.roundRect(TANK.x, TANK.y, TANK.width, TANK.height, 23);
  context.fill();
  context.shadowBlur = 0;
  const water = context.createLinearGradient(TANK.x, TANK.y, TANK.x + TANK.width, TANK.y + TANK.height);
  water.addColorStop(0, "#b8e6e4");
  water.addColorStop(0.48, "#7ec9ce");
  water.addColorStop(1, "#4b9ca7");
  context.fillStyle = water;
  context.beginPath();
  context.roundRect(TANK.x + 12, TANK.y + 12, TANK.width - 24, TANK.height - 24, 16);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.72)";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "rgba(255,255,255,0.16)";
  context.fillRect(TANK.x + 24, TANK.y + 24, TANK.width - 48, 24);
  [
    { x: TANK.x + 17, y: TANK.y + 17 },
    { x: TANK.x + TANK.width - 17, y: TANK.y + 17 },
    { x: TANK.x + 17, y: TANK.y + TANK.height - 17 },
    { x: TANK.x + TANK.width - 17, y: TANK.y + TANK.height - 17 },
  ].forEach((foot) => {
    context.fillStyle = "#233f43";
    context.beginPath();
    context.arc(foot.x, foot.y, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#c9d4d2";
    context.beginPath();
    context.arc(foot.x, foot.y, 4, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function drawPowerUnit(
  context: CanvasRenderingContext2D,
  frequency: number,
  running: boolean,
) {
  context.save();
  context.shadowColor = "rgba(21, 48, 51, 0.32)";
  context.shadowBlur = 16;
  context.fillStyle = "#d9e1df";
  context.beginPath();
  context.roundRect(738, 270, 154, 184, 14);
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "#29484c";
  context.beginPath();
  context.roundRect(750, 284, 130, 151, 10);
  context.fill();
  context.fillStyle = "#152c2f";
  context.beginPath();
  context.roundRect(762, 301, 106, 44, 7);
  context.fill();
  context.fillStyle = running ? "#72e39a" : "#739092";
  context.font = "900 16px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText(`${format(frequency)} Hz`, 815, 329);

  [
    { x: 815, label: "FREKANS", value: frequency / 8 },
  ].forEach((knob) => {
    context.fillStyle = "#8ba0a1";
    context.beginPath();
    context.arc(knob.x, 380, 22, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#edf5f3";
    context.lineWidth = 3;
    const knobAngle = -Math.PI * 0.75 + clamp(knob.value, 0, 1) * Math.PI * 1.5;
    context.beginPath();
    context.moveTo(knob.x, 380);
    context.lineTo(knob.x + Math.cos(knobAngle) * 16, 380 + Math.sin(knobAngle) * 16);
    context.stroke();
    context.fillStyle = "#c2d2d0";
    context.font = "800 7px Arial";
    context.fillText(knob.label, knob.x, 414);
  });

  context.fillStyle = running ? "#f5a72d" : "#61787a";
  context.beginPath();
  context.arc(815, 426, 6, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSourceBar(
  context: CanvasRenderingContext2D,
  sourceType: SourceBarType,
  angle = 0,
) {
  context.save();
  context.translate(378, 469);
  context.rotate(toRadians(angle));
  context.fillStyle = "#304d51";
  context.beginPath();
  context.roundRect(-150, -9, 300, 18, 7);
  context.fill();
  context.fillStyle = "#d6e3e1";
  context.fillRect(-134, -5, 268, 3);
  if (sourceType === "circular" || sourceType === "pulse") {
    context.fillStyle = "#ef9824";
    context.beginPath();
    context.arc(0, -19, 10, 0, Math.PI * 2);
    context.fill();
  }
  if (sourceType === "double") {
    [-34, 34].forEach((x) => {
      context.fillStyle = "#ef9824";
      context.beginPath();
      context.arc(x, -19, 9, 0, Math.PI * 2);
      context.fill();
    });
  }
  context.fillStyle = "rgba(255,255,255,0.9)";
  context.font = "900 9px Arial";
  context.textAlign = "center";
  context.fillText(
    sourceType === "plane"
      ? "DOĞRUSAL DALGA KAYNAĞI"
      : sourceType === "pulse"
        ? "TEK ATMA KAYNAĞI"
        : sourceType === "double"
          ? "İKİ NOKTASAL DALGA KAYNAĞI"
          : "DAİRESEL DALGA KAYNAĞI",
    0,
    24,
  );
  context.restore();
}

function drawMotorConnection(
  context: CanvasRenderingContext2D,
  running: boolean,
  sourceConnected: boolean,
  powerConnected: boolean,
) {
  context.save();
  if (powerConnected) {
    context.strokeStyle = "#243f43";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(414, 526);
    context.bezierCurveTo(545, 548, 666, 535, 750, 423);
    context.stroke();
  }
  if (sourceConnected) {
    context.strokeStyle = "#c9d5d3";
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(378, 478);
    context.lineTo(378, 505);
    context.stroke();
  }
  const housing = context.createLinearGradient(344, 505, 416, 542);
  housing.addColorStop(0, "#dfe7e5");
  housing.addColorStop(0.5, "#82999a");
  housing.addColorStop(1, "#425e62");
  context.fillStyle = housing;
  context.beginPath();
  context.roundRect(341, 504, 74, 38, 8);
  context.fill();
  context.fillStyle = running ? "#70e29a" : "#637d7f";
  context.beginPath();
  context.arc(400, 522, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#254b4f";
  context.font = "900 8px Arial";
  context.textAlign = "center";
  context.fillText("RIPPLE MOTOR", 378, 537);
  context.restore();
}

function clipToReflectorSide(
  context: CanvasRenderingContext2D,
  center: Point,
  tangent: Vector,
  referencePoint: Point,
) {
  const rawNormal = { x: -tangent.y, y: tangent.x };
  const sideSign = dot(subtract(referencePoint, center), rawNormal) >= 0 ? 1 : -1;
  const side = { x: rawNormal.x * sideSign, y: rawNormal.y * sideSign };
  const start = add(center, tangent, -1000);
  const end = add(center, tangent, 1000);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.lineTo(end.x + side.x * 1400, end.y + side.y * 1400);
  context.lineTo(start.x + side.x * 1400, start.y + side.y * 1400);
  context.closePath();
  context.clip();
}

function drawDirectionArrow(
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  label: string,
  color = "#f39b24",
) {
  const direction = normalize(subtract(end, start));
  const tangent = { x: -direction.y, y: direction.x };
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - direction.x * 13 + tangent.x * 7, end.y - direction.y * 13 + tangent.y * 7);
  context.lineTo(end.x - direction.x * 13 - tangent.x * 7, end.y - direction.y * 13 - tangent.y * 7);
  context.closePath();
  context.fill();
  context.font = "900 10px Arial";
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillText(label, (start.x + end.x) / 2 + tangent.x * 14, (start.y + end.y) / 2 + tangent.y * 14);
  context.restore();
}

function drawParallelWavefronts(
  context: CanvasRenderingContext2D,
  center: Point,
  direction: Vector,
  spacing: number,
  phase: number,
  count: number,
  lineLength: number,
  color: string,
  width = 2,
) {
  const waveDirection = normalize(direction);
  const tangent = { x: -waveDirection.y, y: waveDirection.x };
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.shadowColor = color;
  context.shadowBlur = 5;
  for (let index = -count; index <= count; index += 1) {
    const offset = index * spacing + phase;
    const waveCenter = add(center, waveDirection, offset);
    context.beginPath();
    context.moveTo(
      waveCenter.x - tangent.x * lineLength,
      waveCenter.y - tangent.y * lineLength,
    );
    context.lineTo(
      waveCenter.x + tangent.x * lineLength,
      waveCenter.y + tangent.y * lineLength,
    );
    context.stroke();
  }
  context.restore();
}

function drawCircularWaves(
  context: CanvasRenderingContext2D,
  source: Point,
  spacing: number,
  phase: number,
  color: string,
  maximumRadius = 430,
  startAngle = 0,
  endAngle = Math.PI * 2,
) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.shadowColor = color;
  context.shadowBlur = 5;
  for (let radius = ((phase % spacing) + spacing) % spacing; radius < maximumRadius; radius += spacing) {
    if (radius < 5) continue;
    context.beginPath();
    context.arc(source.x, source.y, radius, startAngle, endAngle);
    context.stroke();
  }
  context.restore();
}

function drawSinglePulse(
  context: CanvasRenderingContext2D,
  source: Point,
  radius: number,
  color: string,
) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 4;
  context.shadowColor = color;
  context.shadowBlur = 8;
  context.beginPath();
  context.arc(source.x, source.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawStraightReflector(
  context: CanvasRenderingContext2D,
  angle: number,
) {
  const center = { x: 378, y: 270 };
  const radians = toRadians(angle);
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  const start = add(center, tangent, -165);
  const end = add(center, tangent, 165);
  context.save();
  context.strokeStyle = "#68472e";
  context.lineWidth = 18;
  context.lineCap = "round";
  context.shadowColor = "rgba(37,52,53,0.3)";
  context.shadowBlur = 8;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = "#c69765";
  context.lineWidth = 4;
  context.stroke();
  context.restore();
  return { center, tangent };
}

function drawParabolicReflector(context: CanvasRenderingContext2D) {
  context.save();
  context.strokeStyle = "#6b4a30";
  context.lineWidth = 16;
  context.lineCap = "round";
  context.beginPath();
  for (let x = -180; x <= 180; x += 5) {
    const point = { x: 378 + x, y: 180 + (x * x) / 520 };
    if (x === -180) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.stroke();
  context.strokeStyle = "#c99d6d";
  context.lineWidth = 4;
  context.stroke();
  context.restore();
}

function drawReflectionMode(
  context: CanvasRenderingContext2D,
  time: number,
  frequency: number,
  wavelengthPixels: number,
  sourceType: SourceType,
  reflectorType: ReflectorType,
  reflectorAngle: number,
  circularSource: Point,
  focusDirection: "toward" | "from",
) {
  context.save();
  clipTank(context);
  const phase = (time * frequency * wavelengthPixels) % wavelengthPixels;
  if (reflectorType === "parabolic") {
    const focus = { x: 378, y: 330 };
    if (focusDirection === "toward") {
      context.save();
      context.beginPath();
      context.rect(92, 245, 572, 218);
      context.clip();
      drawParallelWavefronts(context, { x: 378, y: 425 }, { x: 0, y: -1 }, wavelengthPixels, -phase, 7, 260, "rgba(244,255,255,0.9)");
      context.restore();
      drawCircularWaves(context, focus, wavelengthPixels, phase, "rgba(255,229,127,0.92)", 170, Math.PI, Math.PI * 2);
      drawDirectionArrow(context, { x: 270, y: 410 }, { x: 270, y: 292 }, "GELEN DÜZ DALGA");
      drawDirectionArrow(context, { x: 246, y: 236 }, { x: 354, y: 315 }, "ODAĞA YANSIYAN DALGA", "#ffe176");
    } else {
      drawCircularWaves(context, focus, wavelengthPixels, phase, "rgba(244,255,255,0.92)", 190, Math.PI, Math.PI * 2);
      drawParallelWavefronts(context, { x: 378, y: 320 }, { x: 0, y: 1 }, wavelengthPixels, phase, 7, 260, "rgba(255,229,127,0.94)");
      drawDirectionArrow(context, { x: 354, y: 315 }, { x: 246, y: 236 }, "ODAKTAN GELEN DALGA");
      drawDirectionArrow(context, { x: 270, y: 285 }, { x: 270, y: 405 }, "YANSIYAN DÜZ DALGA", "#ffe176");
    }
    drawParabolicReflector(context);
    context.fillStyle = "#ffb22f";
    context.beginPath();
    context.arc(focus.x, focus.y, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#284f53";
    context.font = "900 11px Arial";
    context.textAlign = "center";
    context.fillText("ODAK", focus.x, focus.y + 24);
  } else {
    const center = { x: 378, y: 270 };
    const radians = toRadians(reflectorAngle);
    const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
    const normal = { x: -tangent.y, y: tangent.x };
    context.save();
    clipToReflectorSide(context, center, tangent, { x: 378, y: 445 });
    if (sourceType === "plane") {
      const incoming = { x: 0, y: -1 };
      const reflected = reflect(incoming, normal);
      drawParallelWavefronts(context, { x: 378, y: 410 }, incoming, wavelengthPixels, -phase, 5, 250, "rgba(244,255,255,0.92)");
      drawParallelWavefronts(context, add(center, reflected, 76), reflected, wavelengthPixels, phase, 5, 155, "rgba(255,223,111,0.93)");
    } else {
      const pulseRadius = (time * frequency * wavelengthPixels * 0.58) % 360;
      if (sourceType === "pulse") {
        drawSinglePulse(context, circularSource, pulseRadius, "rgba(244,255,255,0.95)");
      } else {
        drawCircularWaves(context, circularSource, wavelengthPixels, phase, "rgba(244,255,255,0.92)", 360);
      }
      const relative = subtract(circularSource, center);
      const projection = dot(relative, normal);
      const virtualCenter = add(circularSource, normal, -2 * projection);
      if (sourceType === "pulse") {
        drawSinglePulse(context, virtualCenter, pulseRadius, "rgba(255,223,111,0.88)");
      } else {
        drawCircularWaves(context, virtualCenter, wavelengthPixels, phase, "rgba(255,223,111,0.85)", 330);
      }
      context.fillStyle = "#f29b28";
      context.beginPath();
      context.arc(circularSource.x, circularSource.y, 9, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(255,255,255,0.9)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(circularSource.x, circularSource.y, 18, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
    drawStraightReflector(context, reflectorAngle);

    const sourceSideNormal = dot(subtract({ x: 378, y: 445 }, center), normal) >= 0
      ? normal
      : { x: -normal.x, y: -normal.y };
    const incomingEnd = add(center, sourceSideNormal, 28);
    if (sourceType === "plane") {
      const incoming = { x: 0, y: -1 };
      const reflected = reflect(incoming, normal);
      drawDirectionArrow(context, { x: 300, y: 405 }, { x: 300, y: 310 }, "GELEN DALGA");
      drawDirectionArrow(context, add(center, reflected, 28), add(center, reflected, 125), "YANSIYAN DALGA", "#ffe176");
    } else {
      const incidentDirection = normalize(subtract(incomingEnd, circularSource));
      const reflectedDirection = reflect(incidentDirection, normal);
      drawDirectionArrow(context, add(circularSource, incidentDirection, 24), incomingEnd, "GELEN DALGA");
      drawDirectionArrow(context, add(center, reflectedDirection, 34), add(center, reflectedDirection, 128), "YANSIYAN DALGA", "#ffe176");
    }
    context.strokeStyle = "rgba(48,92,97,0.72)";
    context.setLineDash([7, 6]);
    context.beginPath();
    context.moveTo(center.x - normal.x * 90, center.y - normal.y * 90);
    context.lineTo(center.x + normal.x * 90, center.y + normal.y * 90);
    context.stroke();
    context.setLineDash([]);
  }
  context.restore();
}

function drawMeasurementMode(
  context: CanvasRenderingContext2D,
  time: number,
  frequency: number,
  wavelengthPixels: number,
  standingWave: boolean,
) {
  context.save();
  clipTank(context);
  const phase = (time * frequency * wavelengthPixels) % wavelengthPixels;
  drawParallelWavefronts(context, { x: 378, y: 445 }, { x: 0, y: -1 }, wavelengthPixels, -phase, 11, 280, "rgba(247,255,255,0.96)", 2.4);
  drawDirectionArrow(context, { x: 238, y: 420 }, { x: 238, y: 290 }, "YAYILMA YÖNÜ");

  if (standingWave) {
    context.strokeStyle = "#714d34";
    context.lineWidth = 16;
    context.beginPath();
    context.moveTo(190, 165);
    context.lineTo(566, 165);
    context.stroke();
    context.fillStyle = "rgba(255,206,70,0.28)";
    for (let y = 165 + wavelengthPixels / 4; y < 450; y += wavelengthPixels / 2) {
      context.fillRect(85, y - 5, 586, 10);
    }
    context.fillStyle = "#31575b";
    context.font = "900 9px Arial";
    context.textAlign = "center";
    context.fillText("DÜĞÜMLER ARASI = λ / 2", 378, 138);
  } else {
    context.fillStyle = "#587174";
    context.beginPath();
    context.roundRect(175, 112, 406, 22, 8);
    context.fill();
    context.fillStyle = "rgba(255,255,255,0.88)";
    context.font = "900 9px Arial";
    context.textAlign = "center";
    context.fillText("DALGA SÖNÜMLEYİCİ", 378, 128);
  }

  const firstY = 365;
  const secondY = firstY - wavelengthPixels;
  context.strokeStyle = "#ef9a24";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(615, firstY);
  context.lineTo(615, secondY);
  context.stroke();
  [firstY, secondY].forEach((y) => {
    context.beginPath();
    context.moveTo(605, y);
    context.lineTo(625, y);
    context.stroke();
  });
  context.fillStyle = "#244f53";
  context.font = "900 12px Arial";
  context.textAlign = "left";
  context.fillText("λ", 632, (firstY + secondY) / 2 + 4);
  context.restore();
}

function drawDiffractionMode(
  context: CanvasRenderingContext2D,
  time: number,
  frequency: number,
  wavelengthPixels: number,
  diffractionType: DiffractionType,
  slitWidthCm: number,
) {
  const barrierY = 278;
  const centerX = 378;
  const slitPixels = slitWidthCm * 14;
  const spread = 2 * Math.asin(clamp((wavelengthPixels / 7) / slitWidthCm, 0, 1));
  const phase = (time * frequency * wavelengthPixels) % wavelengthPixels;
  context.save();
  clipTank(context);
  context.save();
  context.beginPath();
  context.rect(TANK.x + 13, barrierY, TANK.width - 26, TANK.y + TANK.height - barrierY);
  context.clip();
  drawParallelWavefronts(context, { x: centerX, y: 445 }, { x: 0, y: -1 }, wavelengthPixels, -phase, 8, 280, "rgba(247,255,255,0.94)");
  context.restore();

  context.strokeStyle = "#6c4a31";
  context.lineWidth = 18;
  context.lineCap = "round";
  if (diffractionType === "slit") {
    context.beginPath();
    context.moveTo(85, barrierY);
    context.lineTo(centerX - slitPixels / 2, barrierY);
    context.stroke();
    context.beginPath();
    context.moveTo(centerX + slitPixels / 2, barrierY);
    context.lineTo(670, barrierY);
    context.stroke();
    drawCircularWaves(
      context,
      { x: centerX, y: barrierY },
      wavelengthPixels,
      phase,
      "rgba(255,225,116,0.95)",
      260,
      -Math.PI / 2 - spread / 2,
      -Math.PI / 2 + spread / 2,
    );
    drawDirectionArrow(context, { x: 245, y: 420 }, { x: 245, y: 322 }, "GELEN DALGA");
    drawDirectionArrow(context, { x: centerX, y: 252 }, { x: centerX, y: 155 }, "KIRINAN DALGA", "#ffe176");
  } else {
    context.beginPath();
    context.moveTo(centerX - 30, barrierY);
    context.lineTo(670, barrierY);
    context.stroke();
    drawCircularWaves(context, { x: centerX - 30, y: barrierY }, wavelengthPixels, phase, "rgba(255,225,116,0.95)", 250, Math.PI, Math.PI * 2);
    drawDirectionArrow(context, { x: 245, y: 420 }, { x: 245, y: 322 }, "GELEN DALGA");
    drawDirectionArrow(context, { x: centerX - 48, y: 252 }, { x: centerX - 112, y: 172 }, "KENARDAN YAYILAN DALGA", "#ffe176");
  }
  context.restore();
}

function drawRefractionMode(
  context: CanvasRenderingContext2D,
  time: number,
  frequency: number,
  wavelengthDeepPixels: number,
  wavelengthShallowPixels: number,
  incidenceAngle: number,
  refractionAngle: number,
) {
  const boundaryY = 285;
  const incidentDirection = {
    x: Math.sin(toRadians(incidenceAngle)),
    y: -Math.cos(toRadians(incidenceAngle)),
  };
  const refractedDirection = {
    x: Math.sin(toRadians(refractionAngle)),
    y: -Math.cos(toRadians(refractionAngle)),
  };
  const deepPhase = (time * frequency * wavelengthDeepPixels) % wavelengthDeepPixels;
  const shallowPhase = (time * frequency * wavelengthShallowPixels) % wavelengthShallowPixels;

  context.save();
  clipTank(context);
  context.fillStyle = "rgba(239, 220, 151, 0.28)";
  context.beginPath();
  context.rect(105, 88, 546, boundaryY - 88);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgba(202,166,80,0.8)";
  context.lineWidth = 3;
  context.stroke();

  context.save();
  context.beginPath();
  context.rect(70, boundaryY - 3, 620, 205);
  context.clip();
  drawParallelWavefronts(context, { x: 330, y: 430 }, incidentDirection, wavelengthDeepPixels, -deepPhase, 8, 300, "rgba(247,255,255,0.95)");
  context.restore();

  context.save();
  context.beginPath();
  context.rect(70, 70, 620, boundaryY - 65);
  context.clip();
  drawParallelWavefronts(context, { x: 410, y: 238 }, refractedDirection, wavelengthShallowPixels, -shallowPhase, 11, 300, "rgba(255,225,118,0.96)");
  context.restore();

  context.strokeStyle = "rgba(46,87,91,0.7)";
  context.setLineDash([7, 6]);
  context.beginPath();
  context.moveTo(378, boundaryY - 100);
  context.lineTo(378, boundaryY + 100);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#2b595d";
  context.font = "900 10px Arial";
  context.textAlign = "left";
  context.fillText("SIĞ BÖLGE · CAM BLOK", 118, 111);
  context.fillText("DERİN BÖLGE", 118, 452);
  const boundaryPoint = { x: 378, y: boundaryY };
  drawDirectionArrow(
    context,
    add(boundaryPoint, incidentDirection, -125),
    add(boundaryPoint, incidentDirection, -28),
    "GELEN DALGA",
  );
  drawDirectionArrow(
    context,
    add(boundaryPoint, refractedDirection, 28),
    add(boundaryPoint, refractedDirection, 130),
    "KIRILAN DALGA",
    "#ffe176",
  );
  context.restore();
}

function drawInterferenceMode(
  context: CanvasRenderingContext2D,
  time: number,
  frequency: number,
  wavelengthPixels: number,
  sourceSeparationCm: number,
  selectedPoint: Point,
) {
  const separationPixels = sourceSeparationCm * 8;
  const source1 = { x: 378 - separationPixels / 2, y: 445 };
  const source2 = { x: 378 + separationPixels / 2, y: 445 };
  const phase = time * frequency * Math.PI * 2;
  const waveNumber = (Math.PI * 2) / wavelengthPixels;

  context.save();
  clipTank(context);
  for (let y = 85; y < 445; y += 7) {
    for (let x = 82; x < 675; x += 7) {
      const firstDistance = Math.hypot(x - source1.x, y - source1.y);
      const secondDistance = Math.hypot(x - source2.x, y - source2.y);
      const amplitude =
        Math.cos(waveNumber * firstDistance - phase) +
        Math.cos(waveNumber * secondDistance - phase);
      const intensity = Math.min(1, Math.abs(amplitude) / 2);
      context.fillStyle = amplitude >= 0
        ? `rgba(255, 239, 152, ${0.04 + intensity * 0.24})`
        : `rgba(26, 105, 128, ${0.03 + intensity * 0.2})`;
      context.fillRect(x, y, 7, 7);
    }
  }
  drawCircularWaves(context, source1, wavelengthPixels, (phase / (Math.PI * 2)) * wavelengthPixels, "rgba(255,255,255,0.3)", 430);
  drawCircularWaves(context, source2, wavelengthPixels, (phase / (Math.PI * 2)) * wavelengthPixels, "rgba(255,255,255,0.3)", 430);

  [source1, source2].forEach((source, index) => {
    context.fillStyle = "#ef9b25";
    context.beginPath();
    context.arc(source.x, source.y, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff";
    context.font = "900 8px Arial";
    context.textAlign = "center";
    context.fillText(String(index + 1), source.x, source.y + 3);
  });

  context.strokeStyle = "#ed3f49";
  context.lineWidth = 2;
  context.setLineDash([6, 5]);
  context.beginPath();
  context.moveTo(source1.x, source1.y);
  context.lineTo(selectedPoint.x, selectedPoint.y);
  context.lineTo(source2.x, source2.y);
  context.stroke();
  context.setLineDash([]);
  context.strokeStyle = "#fff";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(selectedPoint.x, selectedPoint.y, 11, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#ed3f49";
  context.beginPath();
  context.arc(selectedPoint.x, selectedPoint.y, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#28565a";
  context.font = "900 10px Arial";
  context.textAlign = "center";
  context.fillText("İKİ KAYNAKTAN ÇIKAN DALGALAR HER YÖNE YAYILIR", 378, 126);
  drawDirectionArrow(context, { x: source1.x, y: source1.y - 18 }, { x: source1.x - 55, y: source1.y - 112 }, "1. DALGA");
  drawDirectionArrow(context, { x: source2.x, y: source2.y - 18 }, { x: source2.x + 55, y: source2.y - 112 }, "2. DALGA", "#ffe176");
  context.restore();
}

function RippleTankCanvas({
  mode,
  running,
  installedCount,
  frequency,
  wavelengthPixels,
  sourceType,
  reflectorType,
  reflectorAngle,
  circularSource,
  focusDirection,
  standingWave,
  diffractionType,
  slitWidth,
  wavelengthDeepPixels,
  wavelengthShallowPixels,
  incidenceAngle,
  refractionAngle,
  sourceSeparation,
  selectedPoint,
  onCircularSourceChange,
  onSelectedPointChange,
}: {
  mode: WaveMode;
  running: boolean;
  installedCount: number;
  frequency: number;
  wavelengthPixels: number;
  sourceType: SourceType;
  reflectorType: ReflectorType;
  reflectorAngle: number;
  circularSource: Point;
  focusDirection: "toward" | "from";
  standingWave: boolean;
  diffractionType: DiffractionType;
  slitWidth: number;
  wavelengthDeepPixels: number;
  wavelengthShallowPixels: number;
  incidenceAngle: number;
  refractionAngle: number;
  sourceSeparation: number;
  selectedPoint: Point;
  onCircularSourceChange: (point: Point) => void;
  onSelectedPointChange: (point: Point) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let animationFrame = 0;
    const startedAt = performance.now();
    const draw = (now: number) => {
      const context = prepareCanvas(canvas);
      if (!context) return;
      const time = running ? (now - startedAt) / 1000 : 0;
      drawLabBench(context);
      const setupReady = installedCount === SETUP_ORDER.length;
      if (installedCount >= 1) drawTankFrame(context);
      if (setupReady && mode === "reflection") {
        drawReflectionMode(context, time, frequency, wavelengthPixels, sourceType, reflectorType, reflectorAngle, circularSource, focusDirection);
      } else if (setupReady && mode === "measurement") {
        drawMeasurementMode(context, time, frequency, wavelengthPixels, standingWave);
      } else if (setupReady && mode === "diffraction") {
        drawDiffractionMode(context, time, frequency, wavelengthPixels, diffractionType, slitWidth);
      } else if (setupReady && mode === "refraction") {
        drawRefractionMode(context, time, frequency, wavelengthDeepPixels, wavelengthShallowPixels, incidenceAngle, refractionAngle);
      } else if (setupReady) {
        drawInterferenceMode(context, time, frequency, wavelengthPixels, sourceSeparation, selectedPoint);
      }
      if (installedCount >= 3) {
        const barType: SourceBarType = mode === "interference"
          ? "double"
          : mode === "reflection"
            ? sourceType
            : "plane";
        drawSourceBar(context, barType, mode === "refraction" ? incidenceAngle : 0);
      }
      if (installedCount >= 2) {
        drawMotorConnection(context, running && setupReady, installedCount >= 3, installedCount >= 4);
      }
      if (installedCount >= 4) drawPowerUnit(context, frequency, running && setupReady);
      context.fillStyle = "rgba(255,255,255,0.94)";
      context.beginPath();
      context.roundRect(70, 68, 235, 38, 10);
      context.fill();
      context.fillStyle = "#28565a";
      context.font = "900 11px Arial";
      context.textAlign = "left";
      context.fillText(installedCount === 0 ? "BOŞ DENEY MASASI" : "DALGA LEĞENİ · TEK DENEY MASASI", 86, 92);
      if (running) animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, [circularSource, diffractionType, focusDirection, frequency, incidenceAngle, installedCount, mode, reflectorAngle, reflectorType, refractionAngle, running, selectedPoint, slitWidth, sourceSeparation, sourceType, standingWave, wavelengthDeepPixels, wavelengthPixels, wavelengthShallowPixels]);

  const updatePointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointFromPointer(event);
    const insideTank =
      point.x >= TANK.x + 20 &&
      point.x <= TANK.x + TANK.width - 20 &&
      point.y >= TANK.y + 20 &&
      point.y <= TANK.y + TANK.height - 45;
    if (!insideTank) return;
    if (mode === "reflection" && sourceType !== "plane") {
      onCircularSourceChange(point);
    }
    if (mode === "interference") onSelectedPointChange(point);
  };

  return (
    <canvas
      ref={canvasRef}
      className="rt-canvas"
      aria-label="Tek masada kurulan dalga leğeni, ripple motor ve güç kaynağı düzeneği"
      onPointerDown={(event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updatePointer(event);
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) updatePointer(event);
      }}
      onPointerUp={(event) => {
        draggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    />
  );
}

const modeLabels: Record<WaveMode, { step: string; title: string; text: string }> = {
  reflection: { step: "01", title: "Yansıma", text: "Düz, dairesel ve odaklanan dalga" },
  measurement: { step: "02", title: "Dalga ölçümü", text: "Dalga boyu, periyot ve hız" },
  diffraction: { step: "03", title: "Kırınım", text: "Engel kenarı veya yarık" },
  refraction: { step: "04", title: "Kırılma", text: "Derin ve sığ su bölgesi" },
  interference: { step: "05", title: "Girişim", text: "İki noktasal kaynak" },
};

const modeApparatus: Record<WaveMode, string> = {
  reflection: "Düz ve parabolik yansıtıcı",
  measurement: "Sönümleyici ve ölçüm cetveli",
  diffraction: "Engel ve ayarlı yarık",
  refraction: "Cam blok",
  interference: "İkinci dairesel kaynak",
};

function SetupIcon({ kind }: { kind: SetupKind }) {
  return <i className={`rt-setup-icon ${kind}`} aria-hidden="true" />;
}

function RippleTankSetup({
  mode,
  installedCount,
  onInstall,
  onReset,
}: {
  mode: WaveMode;
  installedCount: number;
  onInstall: (index: number) => void;
  onReset: () => void;
}) {
  const setupItems: Array<{ kind: SetupKind; name: string; detail: string }> = [
    { kind: "tank", name: "Dalga leğeni", detail: "Leğeni masaya koy ve suyu ekle" },
    { kind: "motor", name: "Ripple motor", detail: "Motoru taşıyıcıya tak" },
    { kind: "source", name: "Dalga kaynağı", detail: mode === "interference" ? "İki kaynak ucunu bağla" : "Kaynak ucunu motora bağla" },
    { kind: "power", name: "Güç kaynağı", detail: "Motor kablosunu bağla" },
    { kind: "apparatus", name: modeApparatus[mode], detail: "Deney parçasını leğene koy" },
  ];
  const setupReady = installedCount === SETUP_ORDER.length;
  const nextItem = setupItems[installedCount];

  return (
    <section className={`rt-inline-setup ${setupReady ? "complete" : ""}`}>
      <div className="rt-inline-setup-heading">
        <span>{setupReady ? "DÜZENEK HAZIR" : `KURULUM · ${installedCount + 1}/${SETUP_ORDER.length}`}</span>
        <b>{setupReady ? "Aynı masa üzerinde deneye başla." : nextItem?.detail}</b>
      </div>
      <ol>
        {setupItems.map((item, index) => (
          <li key={item.kind} className={index < installedCount ? "installed" : index === installedCount ? "next" : ""}>
            <span>{index < installedCount ? "✓" : index + 1}</span>
            <SetupIcon kind={item.kind} />
            <b>{item.name}</b>
          </li>
        ))}
      </ol>
      {!setupReady ? (
        <button type="button" className="rt-install-next" onClick={() => onInstall(installedCount)}>
          {nextItem?.name} ekle
        </button>
      ) : (
        <div className="rt-setup-complete"><i>✓</i><span>Leğen, motor, kaynak ve güç bağlantısı hazır.</span></div>
      )}
      <button className="rt-setup-reset" type="button" onClick={onReset}>Düzeneği sıfırla</button>
    </section>
  );
}

export default function RippleTankLab() {
  const [mode, setMode] = useState<WaveMode>("reflection");
  const [running, setRunning] = useState(false);
  const [installedCount, setInstalledCount] = useState(0);
  const previousModeRef = useRef(mode);
  const [frequency, setFrequency] = useState(4);
  const [waterDepth, setWaterDepth] = useState(1.2);
  const [sourceType, setSourceType] = useState<SourceType>("plane");
  const [reflectorType, setReflectorType] = useState<ReflectorType>("straight");
  const [reflectorAngle, setReflectorAngle] = useState(0);
  const [circularSource, setCircularSource] = useState<Point>({ x: 378, y: 405 });
  const [focusDirection, setFocusDirection] = useState<"toward" | "from">("toward");
  const [standingWave, setStandingWave] = useState(false);
  const [diffractionType, setDiffractionType] = useState<DiffractionType>("slit");
  const [slitWidth, setSlitWidth] = useState(4);
  const [shallowDepth, setShallowDepth] = useState(0.55);
  const [incidenceAngle, setIncidenceAngle] = useState(28);
  const [sourceSeparation, setSourceSeparation] = useState(8);
  const [selectedPoint, setSelectedPoint] = useState<Point>({ x: 470, y: 195 });
  const [reflectionReadings, setReflectionReadings] = useState<ReflectionReading[]>([]);
  const [measurementReadings, setMeasurementReadings] = useState<MeasurementReading[]>([]);
  const [diffractionReadings, setDiffractionReadings] = useState<DiffractionReading[]>([]);
  const [refractionReadings, setRefractionReadings] = useState<RefractionReading[]>([]);
  const [interferenceReadings, setInterferenceReadings] = useState<InterferenceReading[]>([]);
  const [answers, setAnswers] = useState(["", "", "", "", ""]);
  const setupReady = installedCount === SETUP_ORDER.length;

  useEffect(() => {
    if (previousModeRef.current === mode) return;
    previousModeRef.current = mode;
    setInstalledCount((current) => Math.min(current, SETUP_ORDER.length - 1));
    setRunning(false);
  }, [mode]);

  const waveSpeed = useMemo(() => speedForDepth(waterDepth), [waterDepth]);
  const wavelength = waveSpeed / frequency;
  const wavelengthPixels = clamp(wavelength * 6.2, 24, 94);
  const period = 1 / frequency;
  const shallowSpeed = speedForDepth(shallowDepth);
  const shallowWavelength = shallowSpeed / frequency;
  const refractionAngle = toDegrees(
    Math.asin(
      clamp((shallowSpeed / waveSpeed) * Math.sin(toRadians(incidenceAngle)), -1, 1),
    ),
  );
  const diffractionRatio = wavelength / slitWidth;
  const diffractionSpread = toDegrees(
    2 * Math.asin(clamp(diffractionRatio, 0, 1)),
  );
  const interferenceGeometry = useMemo(() => {
    const separationPixels = sourceSeparation * 8;
    const source1 = { x: 378 - separationPixels / 2, y: 445 };
    const source2 = { x: 378 + separationPixels / 2, y: 445 };
    const pixelToCm = 1 / 8;
    const firstDistance = Math.hypot(selectedPoint.x - source1.x, selectedPoint.y - source1.y) * pixelToCm;
    const secondDistance = Math.hypot(selectedPoint.x - source2.x, selectedPoint.y - source2.y) * pixelToCm;
    const pathDifference = Math.abs(firstDistance - secondDistance);
    const orderValue = pathDifference / wavelength;
    const fringeOrder = Math.round(orderValue);
    const distanceToBright = Math.abs(orderValue - fringeOrder);
    return {
      firstDistance,
      secondDistance,
      pathDifference,
      fringeOrder,
      result: distanceToBright < 0.16 ? "Yapıcı girişim · aydınlık saçak" : "Ara bölge · başka bir nokta seç",
    };
  }, [selectedPoint, sourceSeparation, wavelength]);

  const resetMode = () => {
    setFrequency(4);
    setWaterDepth(1.2);
    setSourceType("plane");
    setReflectorType("straight");
    setReflectorAngle(0);
    setCircularSource({ x: 378, y: 405 });
    setFocusDirection("toward");
    setStandingWave(false);
    setDiffractionType("slit");
    setSlitWidth(4);
    setShallowDepth(0.55);
    setIncidenceAngle(28);
    setSourceSeparation(8);
    setSelectedPoint({ x: 470, y: 195 });
  };

  const installSetupStep = (index: number) => {
    if (index !== installedCount) return;
    setInstalledCount(index + 1);
  };

  const resetSetup = () => {
    setRunning(false);
    setInstalledCount(0);
  };

  const selectIdealFringe = (order: number) => {
    if (order === 0) {
      setSelectedPoint({ x: 378, y: 190 });
      return;
    }
    const nextFrequency =
      order * wavelength >= sourceSeparation ? 8 : frequency;
    const nextWavelength = waveSpeed / nextFrequency;
    const nextSeparation = clamp(
      Math.max(sourceSeparation, order * nextWavelength + 0.6),
      4,
      14,
    );
    setFrequency(nextFrequency);
    setSourceSeparation(nextSeparation);
    const y = 175;
    const firstSourceX = 378 - (nextSeparation * 8) / 2;
    const secondSourceX = 378 + (nextSeparation * 8) / 2;
    const targetDifference = order * nextWavelength;
    let low = 378;
    let high = 675;
    for (let iteration = 0; iteration < 36; iteration += 1) {
      const middle = (low + high) / 2;
      const firstDistance = Math.hypot(middle - firstSourceX, y - 445) / 8;
      const secondDistance = Math.hypot(middle - secondSourceX, y - 445) / 8;
      if (Math.abs(firstDistance - secondDistance) < targetDifference) low = middle;
      else high = middle;
    }
    setSelectedPoint({ x: (low + high) / 2, y });
  };

  const recordCurrent = () => {
    if (mode === "reflection") {
      setReflectionReadings((current) => [...current, {
        id: Date.now(),
        source: sourceType === "plane" ? "Düzlemsel" : sourceType === "pulse" ? "Tek atma" : "Dairesel",
        reflector: reflectorType === "straight" ? "Düz engel" : "Parabolik engel",
        angle: reflectorAngle,
        result: sourceType === "pulse"
          ? "Her doğrultuda aynı hız"
          : reflectorType === "parabolic"
            ? (focusDirection === "toward" ? "Odakta toplandı" : "Düzlemsel yansıdı")
            : "Gelme açısı = yansıma açısı",
      }]);
    } else if (mode === "measurement") {
      setMeasurementReadings((current) => [...current, {
        id: Date.now(), frequency, wavelength, period, speed: waveSpeed,
        pattern: standingWave ? "Duran dalga" : "İlerleyen dalga",
      }]);
    } else if (mode === "diffraction") {
      setDiffractionReadings((current) => [...current, {
        id: Date.now(),
        kind: diffractionType === "slit" ? "Yarık" : "Engel kenarı",
        wavelength,
        opening: diffractionType === "slit" ? slitWidth : null,
        ratio: diffractionType === "slit" ? diffractionRatio : null,
        spread: diffractionType === "slit" ? diffractionSpread : null,
      }]);
    } else if (mode === "refraction") {
      setRefractionReadings((current) => [...current, {
        id: Date.now(), deepDepth: waterDepth, shallowDepth,
        wavelengthDeep: wavelength, wavelengthShallow: shallowWavelength,
        incidenceAngle, refractionAngle,
      }]);
    } else {
      setInterferenceReadings((current) => [...current, {
        id: Date.now(), separation: sourceSeparation, wavelength,
        pathDifference: interferenceGeometry.pathDifference,
        fringeOrder: interferenceGeometry.fringeOrder,
        result: interferenceGeometry.result,
      }]);
    }
  };

  return (
    <section className="rt-lab" id="dalga-legeni-deneyi">
      <div className="rt-hero">
        <div>
          <span>DALGALAR · DENEY 01 · TYMM</span>
          <h2>Tek masada kur, motoru çalıştır, su dalgalarını gözle.</h2>
          <p>Leğen, ripple motor, kaynak ve güç ünitesi gerçek bir deney masasında sırayla birleşir. Kurduğun aynı düzenek üzerinde yansıma, kırınım, kırılma ve girişimi inceleyebilirsin.</p>
        </div>
        <div className="rt-hero-visual" aria-label="Dalga leğeni çizimi"><i /><i /><i /><b>λ</b><small>SU DALGALARI</small></div>
      </div>

      <div className="rt-mode-switch" role="tablist" aria-label="Dalga leğeni deneyleri">
        {(Object.keys(modeLabels) as WaveMode[]).map((key) => (
          <button key={key} type="button" className={mode === key ? "active" : ""} onClick={() => setMode(key)}>
            <small>ÇALIŞMA {modeLabels[key].step}</small><b>{modeLabels[key].title}</b><span>{modeLabels[key].text}</span>
          </button>
        ))}
      </div>

      <div className="rt-panel">
        <div className="rt-panel-heading">
          <div><span>{setupReady ? `AKTİF ÇALIŞMA · ${modeLabels[mode].step}` : "TEK MASADA KURULUM"}</span><h3>{setupReady ? modeLabels[mode].title : "Dalga leğeni düzeneği"}</h3><p>{setupReady ? modeLabels[mode].text : "Parçaları sağdaki sırayla ekle; her parça doğrudan bu masada görünecek."}</p></div>
          {setupReady ? <div className="rt-live-badges"><span><b>{format(frequency)} Hz</b>frekans</span><span><b>{format(wavelength)} cm</b>dalga boyu</span><span><b>{format(waveSpeed)} cm/s</b>yayılma hızı</span></div> : <div className="rt-live-badges"><span><b>{installedCount}/{SETUP_ORDER.length}</b>parça hazır</span></div>}
        </div>

        <div className="rt-workspace">
          <div className="rt-stage">
            <RippleTankCanvas
              mode={mode}
              running={running && setupReady}
              installedCount={installedCount}
              frequency={frequency}
              wavelengthPixels={mode === "interference" ? wavelength * 8 : wavelengthPixels}
              sourceType={sourceType}
              reflectorType={reflectorType}
              reflectorAngle={reflectorAngle}
              circularSource={circularSource}
              focusDirection={focusDirection}
              standingWave={standingWave}
              diffractionType={diffractionType}
              slitWidth={slitWidth}
              wavelengthDeepPixels={wavelengthPixels}
              wavelengthShallowPixels={clamp(shallowWavelength * 6.2, 18, 84)}
              incidenceAngle={incidenceAngle}
              refractionAngle={refractionAngle}
              sourceSeparation={sourceSeparation}
              selectedPoint={selectedPoint}
              onCircularSourceChange={setCircularSource}
              onSelectedPointChange={setSelectedPoint}
            />
            <div className="rt-stage-note">
              {!setupReady && <span>Sıradaki parça aynı deney masasına eklenecek.</span>}
              {setupReady && mode === "reflection" && sourceType !== "plane" && <span>Turuncu kaynağı leğen içinde sürükleyebilirsin.</span>}
              {setupReady && mode === "interference" && <span>Analiz etmek istediğin noktayı leğen üzerinde seçebilirsin.</span>}
              {setupReady && mode !== "reflection" && mode !== "interference" && <span>Parlak çizgiler dalga tepelerini, oklar yayılma yönünü gösterir.</span>}
            </div>
          </div>

          <aside className="rt-controls">
            {!setupReady ? (
              <RippleTankSetup
                mode={mode}
                installedCount={installedCount}
                onInstall={installSetupStep}
                onReset={resetSetup}
              />
            ) : <>
            <div className="rt-power-row"><button type="button" className={running ? "active" : ""} onClick={() => setRunning((value) => !value)}><i />{running ? "Motor çalışıyor" : "Motor kapalı"}</button><button type="button" onClick={resetMode}>Başlangıca dön</button></div>
            <label><span>Ripple motor frekansı <b>{format(frequency)} Hz</b></span><input type="range" min="2" max="8" step="0.5" value={frequency} onChange={(event) => setFrequency(Number(event.target.value))} /></label>
            {mode === "reflection" && (
              <>
                <div className="rt-segmented rt-three-options"><button type="button" className={sourceType === "pulse" ? "active" : ""} onClick={() => { setSourceType("pulse"); setReflectorType("straight"); }}>Tek atma</button><button type="button" className={sourceType === "plane" ? "active" : ""} onClick={() => setSourceType("plane")}>Düzlemsel kaynak</button><button type="button" className={sourceType === "circular" ? "active" : ""} onClick={() => { setSourceType("circular"); setReflectorType("straight"); }}>Dairesel kaynak</button></div>
                <div className="rt-segmented"><button type="button" className={reflectorType === "straight" ? "active" : ""} onClick={() => setReflectorType("straight")}>Düz engel</button><button type="button" className={reflectorType === "parabolic" ? "active" : ""} onClick={() => { setReflectorType("parabolic"); setSourceType("plane"); }}>Parabolik engel</button></div>
                {reflectorType === "straight" ? <label><span>Engel açısı <b>{reflectorAngle}°</b></span><input type="range" min="-30" max="30" value={reflectorAngle} onChange={(event) => setReflectorAngle(Number(event.target.value))} /></label> : <div className="rt-segmented"><button type="button" className={focusDirection === "toward" ? "active" : ""} onClick={() => setFocusDirection("toward")}>Düz dalga → odak</button><button type="button" className={focusDirection === "from" ? "active" : ""} onClick={() => setFocusDirection("from")}>Odak → düz dalga</button></div>}
                <div className="rt-result-box"><small>İDEAL GÖZLEM</small><strong>{sourceType === "pulse" ? "Tek atma merkezden her doğrultuda aynı hızla yayılır." : reflectorType === "parabolic" ? (focusDirection === "toward" ? "Yansıyan dalgalar odakta toplanır." : "Odaktan çıkan dalga düzlemsel yansır.") : "Gelme açısı yansıma açısına eşittir."}</strong></div>
              </>
            )}

            {mode === "measurement" && (
              <>
                <label className="rt-check"><input type="checkbox" checked={standingWave} onChange={(event) => setStandingWave(event.target.checked)} /><span>Yansıtıcı engeli ekle · duran dalga</span></label>
                <div className="rt-result-box success"><small>CETVELLE DALGA ÖLÇÜMÜ</small><strong>{standingWave ? "Düğüm noktaları arasındaki uzaklık, dalga boyunun yarısıdır." : "İki komşu dalga tepesi arasındaki uzaklık dalga boyudur."}</strong><span>T = {format(period, 3)} s · λ = {format(wavelength)} cm · v = {format(waveSpeed)} cm/s</span></div>
              </>
            )}

            {mode === "diffraction" && (
              <>
                <div className="rt-segmented"><button type="button" className={diffractionType === "edge" ? "active" : ""} onClick={() => setDiffractionType("edge")}>Engel kenarı</button><button type="button" className={diffractionType === "slit" ? "active" : ""} onClick={() => setDiffractionType("slit")}>Ayarlı yarık</button></div>
                {diffractionType === "slit" && <label><span>Yarık genişliği <b>{format(slitWidth)} cm</b></span><input type="range" min="2" max="14" step="0.5" value={slitWidth} onChange={(event) => setSlitWidth(Number(event.target.value))} /></label>}
                <div className="rt-result-box"><small>KIRINIM GÜCÜ</small><strong>{diffractionType === "edge" ? "Dalga, engelin kenarından sonra bükülerek gölge bölgesine yayılır." : diffractionRatio >= 1 ? "Belirgin kırınım · dalga geniş alana yayılır." : diffractionRatio >= 0.5 ? "Orta düzey kırınım · kenarlar bükülür." : "Zayıf kırınım · dalga doğrultusunu büyük ölçüde korur."}</strong>{diffractionType === "slit" && <span>λ / yarık = {format(diffractionRatio, 2)} · yayılma açısı {format(diffractionSpread)}°</span>}</div>
              </>
            )}

            {mode === "refraction" && (
              <>
                <label><span>Derin bölge <b>{format(waterDepth, 2)} cm</b></span><input type="range" min="0.8" max="1.5" step="0.05" value={waterDepth} onChange={(event) => setWaterDepth(Number(event.target.value))} /></label>
                <label><span>Sığ bölge <b>{format(shallowDepth, 2)} cm</b></span><input type="range" min="0.3" max="0.75" step="0.05" value={shallowDepth} onChange={(event) => setShallowDepth(Number(event.target.value))} /></label>
                <label><span>Gelme açısı <b>{incidenceAngle}°</b></span><input type="range" min="0" max="55" value={incidenceAngle} onChange={(event) => setIncidenceAngle(Number(event.target.value))} /></label>
                <div className="rt-result-box"><small>SIĞ BÖLGEDE</small><strong>Dalga yavaşlar, dalga boyu küçülür ve normale yaklaşır.</strong><span>λ₁ = {format(wavelength)} cm · λ₂ = {format(shallowWavelength)} cm · r = {format(refractionAngle)}°</span></div>
              </>
            )}

            {mode === "interference" && (
              <>
                <label><span>Kaynaklar arası uzaklık · d <b>{format(sourceSeparation)} cm</b></span><input type="range" min="4" max="14" step="0.5" value={sourceSeparation} onChange={(event) => setSourceSeparation(Number(event.target.value))} /></label>
                <div className="rt-fringe-buttons"><span>Aydınlık saçağı seç</span>{[0, 1, 2, 3].map((order) => <button key={order} type="button" onClick={() => selectIdealFringe(order)}>n = {order}</button>)}</div>
                <div className={`rt-result-box ${interferenceGeometry.result.startsWith("Yapıcı") ? "success" : ""}`}><small>SEÇİLEN NOKTA</small><strong>{interferenceGeometry.result}</strong><span>r₁ = {format(interferenceGeometry.firstDistance)} cm · r₂ = {format(interferenceGeometry.secondDistance)} cm</span><span>Yol farkı = {format(interferenceGeometry.pathDifference)} cm · n = {interferenceGeometry.fringeOrder}</span></div>
              </>
            )}

            <button className="rt-record-button" type="button" onClick={recordCurrent}>Gözlemi kaydet +</button>
            </>}
          </aside>
        </div>

        {setupReady && <div className="rt-data-card">
          <div><span>İDEAL ÖLÇÜM TABLOSU</span><h4>{modeLabels[mode].title} kayıtları</h4><p>Bir değişkeni değiştir, gözlemi kaydet ve sonuçları karşılaştır.</p></div>
          <div className="rt-table-wrap">
            {mode === "reflection" && <table><thead><tr><th>#</th><th>Kaynak</th><th>Yansıtıcı</th><th>Açı</th><th>Sonuç</th></tr></thead><tbody>{reflectionReadings.length ? reflectionReadings.map((reading, index) => <tr key={reading.id}><td>{index + 1}</td><td>{reading.source}</td><td>{reading.reflector}</td><td>{reading.angle}°</td><td><b>{reading.result}</b></td></tr>) : <tr><td colSpan={5}>İlk yansıma gözlemini kaydet.</td></tr>}</tbody></table>}
            {mode === "measurement" && <table><thead><tr><th>#</th><th>f</th><th>T</th><th>λ</th><th>v</th><th>Görünüm</th></tr></thead><tbody>{measurementReadings.length ? measurementReadings.map((reading, index) => <tr key={reading.id}><td>{index + 1}</td><td>{format(reading.frequency)} Hz</td><td>{format(reading.period, 3)} s</td><td>{format(reading.wavelength)} cm</td><td>{format(reading.speed)} cm/s</td><td><b>{reading.pattern}</b></td></tr>) : <tr><td colSpan={6}>Dalga boyunu gözle ve ölçümü kaydet.</td></tr>}</tbody></table>}
            {mode === "diffraction" && <table><thead><tr><th>#</th><th>Düzenek</th><th>λ</th><th>Yarık</th><th>λ / yarık</th><th>Yayılma</th></tr></thead><tbody>{diffractionReadings.length ? diffractionReadings.map((reading, index) => <tr key={reading.id}><td>{index + 1}</td><td>{reading.kind}</td><td>{format(reading.wavelength)} cm</td><td>{reading.opening === null ? "—" : `${format(reading.opening)} cm`}</td><td>{reading.ratio === null ? "—" : format(reading.ratio, 2)}</td><td>{reading.spread === null ? "Kenar boyunca" : `${format(reading.spread)}°`}</td></tr>) : <tr><td colSpan={6}>Yarığı veya frekansı değiştir ve kaydet.</td></tr>}</tbody></table>}
            {mode === "refraction" && <table><thead><tr><th>#</th><th>Derinlik 1</th><th>Derinlik 2</th><th>λ₁</th><th>λ₂</th><th>i</th><th>r</th></tr></thead><tbody>{refractionReadings.length ? refractionReadings.map((reading, index) => <tr key={reading.id}><td>{index + 1}</td><td>{format(reading.deepDepth, 2)} cm</td><td>{format(reading.shallowDepth, 2)} cm</td><td>{format(reading.wavelengthDeep)} cm</td><td>{format(reading.wavelengthShallow)} cm</td><td>{reading.incidenceAngle}°</td><td>{format(reading.refractionAngle)}°</td></tr>) : <tr><td colSpan={7}>Cam bloğun derinliğini değiştir ve kaydet.</td></tr>}</tbody></table>}
            {mode === "interference" && <table><thead><tr><th>#</th><th>d</th><th>λ</th><th>Yol farkı</th><th>n</th><th>Sonuç</th></tr></thead><tbody>{interferenceReadings.length ? interferenceReadings.map((reading, index) => <tr key={reading.id}><td>{index + 1}</td><td>{format(reading.separation)} cm</td><td>{format(reading.wavelength)} cm</td><td>{format(reading.pathDifference)} cm</td><td>{reading.fringeOrder}</td><td><b>{reading.result}</b></td></tr>) : <tr><td colSpan={6}>Bir aydınlık saçak seç ve kaydet.</td></tr>}</tbody></table>}
          </div>
        </div>}
      </div>

      {setupReady && <div className="rt-report">
        <div><span>TYMM · DENEY RAPORU</span><h3>Desenden kanıta, kanıttan sonuca.</h3><p>Her çalışmada kaydettiğin ideal ölçümleri kullanarak kısa açıklamalar yaz.</p></div>
        <div className="rt-report-grid">
          {[
            "Düzlemsel ve dairesel dalgaların düz engelden yansıyan biçimlerini karşılaştır.",
            "Frekans arttığında dalga tepeleri arasındaki uzaklık nasıl değişti?",
            "Dalga boyu ile yarık genişliğinin oranı kırınım desenini nasıl değiştirdi?",
            "Dalga sığ bölgeye geçerken hız, dalga boyu ve yön birlikte nasıl değişti?",
            "İki kaynaktan seçtiğin noktaya gelen dalgaların yol farkı aydınlık saçağı nasıl belirledi?",
          ].map((question, index) => <label key={question}><span><b>{index + 1}</b>{question}</span><textarea value={answers[index]} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} placeholder="Kendi ölçümüne ve gözlemine göre yaz..." /></label>)}
        </div>
      </div>}
    </section>
  );
}
