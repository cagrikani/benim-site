"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SetupKind =
  | "air-table"
  | "trace-paper"
  | "compressor"
  | "spark-timer"
  | "puck-one"
  | "puck-two"
  | "velcro";
type CollisionMode = "elastic" | "inelastic";
type RunState = "ready" | "running" | "complete";
type GraphKind = "momentum" | "energy";
type Point = { x: number; y: number };
type Velocity = { x: number; y: number };
type TraceMark = Point & {
  id: number;
  puck: 1 | 2;
  phase: "before" | "after";
};
type CollisionResult = {
  id: number;
  mode: CollisionMode;
  massOne: number;
  massTwo: number;
  initialSpeed: number;
  sparkInterval: number;
  momentumOneBefore: number;
  momentumOneAfter: number;
  momentumTwoBefore: number;
  momentumTwoAfter: number;
  velocityOneAfterX: number;
  velocityOneAfterY: number;
  velocityTwoAfterX: number;
  velocityTwoAfterY: number;
  momentumOneAfterX: number;
  momentumOneAfterY: number;
  momentumTwoAfterX: number;
  momentumTwoAfterY: number;
  collisionX: number;
  collisionY: number;
  momentumBeforeX: number;
  momentumBeforeY: number;
  momentumAfterX: number;
  momentumAfterY: number;
  energyBefore: number;
  energyAfter: number;
  energyRetention: number;
};

type Simulation = {
  time: number;
  lastFrame: number;
  lastSpark: number;
  collided: boolean;
  collisionTime: number;
  positionOne: Point;
  positionTwo: Point;
  velocityOne: Velocity;
  velocityTwo: Velocity;
  result: CollisionResult | null;
  mode: CollisionMode;
  massOne: number;
  massTwo: number;
  sparkInterval: number;
};

const TABLE_WIDTH = 1.6;
const TABLE_HEIGHT = 1;
const PUCK_RADIUS = 0.07;
const REQUIRED_SETUP: SetupKind[] = [
  "air-table",
  "trace-paper",
  "compressor",
  "spark-timer",
  "puck-one",
  "puck-two",
];
const SETUP_ORDER: SetupKind[] = [...REQUIRED_SETUP, "velcro"];
const EQUIPMENT: Array<{
  kind: SetupKind;
  name: string;
  shortName: string;
  optional?: boolean;
}> = [
  {
    kind: "air-table",
    name: "Ayarlanabilir ayaklı hava masası",
    shortName: "Hava masası",
  },
  {
    kind: "trace-paper",
    name: "Hava masası yüzeyinde nokta izlerini kaydeder",
    shortName: "Yüzey iz kaydı",
  },
  { kind: "compressor", name: "Hava masası kompresörü", shortName: "Kompresör" },
  {
    kind: "spark-timer",
    name: "Ark kronometresi ve ayak pedalı",
    shortName: "Kronometre + pedal",
  },
  { kind: "puck-one", name: "Birinci hava diski, hareketli", shortName: "1. disk · 0,525 kg" },
  { kind: "puck-two", name: "İkinci hava diski, başlangıçta durgun", shortName: "2. disk · 0,530 kg" },
  {
    kind: "velcro",
    name: "Esnek olmayan çarpışma bandı",
    shortName: "Cırt cırt bant (esnek olmayan)",
    optional: true,
  },
];
const PHYSICS_EPSILON = 1e-10;
const AIR_TABLE_SURFACE = {
  left: 6,
  top: 9,
  width: 88,
  height: 82,
} as const;

const COLLISION_EQUIPMENT_PHOTOS: Partial<Record<SetupKind, string>> = {
  "air-table": "./collision-air-table-v2.webp",
  compressor: "./collision-compressor-v2.webp",
  "spark-timer": "./collision-spark-timer-v2.webp",
  "puck-one": "./collision-puck-one-v2.webp",
  "puck-two": "./collision-puck-two-v2.webp",
};

function exactZero(value: number) {
  return Math.abs(value) < PHYSICS_EPSILON ? 0 : value;
}

function formatPhysics(value: number, digits = 3) {
  const stableValue = exactZero(value);
  return stableValue === 0 ? "0" : stableValue.toFixed(digits);
}

function initialPositions(targetY: number) {
  return {
    one: { x: 0.2, y: 0.5 },
    two: { x: 0.88, y: targetY },
  };
}

function puckReachedTableEdge(position: Point) {
  return (
    position.x <= PUCK_RADIUS ||
    position.x >= TABLE_WIDTH - PUCK_RADIUS ||
    position.y <= PUCK_RADIUS ||
    position.y >= TABLE_HEIGHT - PUCK_RADIUS
  );
}

function keepPuckOnTable(position: Point): Point {
  return {
    x: Math.max(PUCK_RADIUS, Math.min(TABLE_WIDTH - PUCK_RADIUS, position.x)),
    y: Math.max(PUCK_RADIUS, Math.min(TABLE_HEIGHT - PUCK_RADIUS, position.y)),
  };
}

function EquipmentIcon({ kind }: { kind: SetupKind }) {
  const photo = COLLISION_EQUIPMENT_PHOTOS[kind];

  return (
    <span
      className={`collision-equipment-icon collision-icon-${kind}${photo ? " has-photo" : ""}`}
      aria-hidden="true"
    >
      {photo ? (
        <img src={photo} alt="" draggable={false} />
      ) : (
        <>
          <i />
          <i />
          <i />
        </>
      )}
    </span>
  );
}

function directionDegrees(x: number, y: number) {
  if (Math.hypot(x, y) < PHYSICS_EPSILON) return 0;
  return exactZero((Math.atan2(y, x) * 180) / Math.PI);
}

function roundedAngle(x: number, y: number) {
  return exactZero(Math.round(directionDegrees(x, y)));
}

function plannedCollisionAngle(targetY: number) {
  const verticalOffset = Math.max(
    -PUCK_RADIUS * 2,
    Math.min(PUCK_RADIUS * 2, 0.5 - targetY),
  );
  return exactZero(
    (Math.asin(verticalOffset / (PUCK_RADIUS * 2)) * 180) / Math.PI,
  );
}

function CollisionSurfaceVectors({
  result,
  targetY,
}: {
  result: CollisionResult | null;
  targetY: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    const height = Math.max(rect.height, 180);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const toCanvas = (point: Point) => ({
      x: (point.x / TABLE_WIDTH) * width,
      y: (point.y / TABLE_HEIGHT) * height,
    });

    const writeLabel = (
      text: string,
      x: number,
      y: number,
      color: string,
    ) => {
      context.font = "800 9px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = 3;
      context.strokeStyle = "rgba(250,252,251,0.92)";
      context.strokeText(text, x, y);
      context.fillStyle = color;
      context.fillText(text, x, y);
    };

    const drawArrow = (
      from: Point,
      to: Point,
      color: string,
      label: string,
      dashed = false,
    ) => {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      context.save();
      if (dashed) context.setLineDash([5, 5]);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.strokeStyle = color;
      context.globalAlpha = dashed ? 0.52 : 0.76;
      context.lineWidth = 1.35;
      context.stroke();
      context.restore();
      context.beginPath();
      context.moveTo(to.x, to.y);
      context.lineTo(
        to.x - Math.cos(angle - Math.PI / 6) * 7,
        to.y - Math.sin(angle - Math.PI / 6) * 7,
      );
      context.lineTo(
        to.x - Math.cos(angle + Math.PI / 6) * 7,
        to.y - Math.sin(angle + Math.PI / 6) * 7,
      );
      context.closePath();
      context.fillStyle = color;
      context.globalAlpha = 0.8;
      context.fill();
      context.globalAlpha = 1;
      writeLabel(
        label,
        to.x + Math.cos(angle) * 14,
        to.y + Math.sin(angle) * 14,
        color,
      );
    };

    if (!result) {
      const start = toCanvas({ x: 0.2, y: 0.5 });
      const target = { x: 0.88, y: targetY };
      const verticalOffset = target.y - 0.5;
      const horizontalContact = Math.sqrt(
        Math.max(0, (PUCK_RADIUS * 2) ** 2 - verticalOffset ** 2),
      );
      const contact = toCanvas({
        x: target.x - horizontalContact,
        y: 0.5,
      });
      const targetPoint = toCanvas(target);
      const incomingEnd = { x: contact.x - 8, y: contact.y };
      const screenAngle = Math.atan2(
        targetPoint.y - contact.y,
        targetPoint.x - contact.x,
      );
      const angle = plannedCollisionAngle(targetY);

      drawArrow(start, incomingEnd, "#c98220", "gelen doğrultu · 0°", true);
      drawArrow(contact, targetPoint, "#397d78", "çarpışma doğrultusu", true);

      if (Math.abs(angle) >= 1) {
        context.beginPath();
        context.arc(contact.x, contact.y, 24, 0, screenAngle, screenAngle < 0);
        context.strokeStyle = "rgba(94, 89, 126, 0.68)";
        context.lineWidth = 1.2;
        context.stroke();
      }

      const labelAngle = Math.abs(angle) < 1 ? 0 : screenAngle / 2;
      writeLabel(
        `α = ${formatPhysics(angle, 0)}°`,
        contact.x + Math.cos(labelAngle) * 39,
        contact.y + Math.sin(labelAngle) * 39,
        "#66577c",
      );
      writeLabel(
        "2. diski düşey sürükle",
        targetPoint.x,
        targetPoint.y - 37,
        "#365f64",
      );
      return;
    }

    const origin = toCanvas({ x: result.collisionX, y: result.collisionY });
    const largestMomentum = Math.max(
      result.momentumOneBefore,
      result.momentumOneAfter,
      result.momentumTwoAfter,
      0.001,
    );
    const vectorLength = (magnitude: number) =>
      44 + (magnitude / largestMomentum) * Math.min(62, width * 0.08);
    const vectorEnd = (x: number, y: number, magnitude: number) => {
      if (magnitude < PHYSICS_EPSILON) return { ...origin };
      const length = vectorLength(magnitude);
      return {
        x: origin.x + (x / magnitude) * length,
        y: origin.y - (y / magnitude) * length,
      };
    };
    const incomingStart = {
      x: origin.x - vectorLength(result.momentumOneBefore),
      y: origin.y,
    };

    drawArrow(incomingStart, origin, "#c98220", "pᵢ", true);

    context.beginPath();
    context.arc(origin.x, origin.y, 5, 0, Math.PI * 2);
    context.fillStyle = "rgba(115, 79, 109, 0.86)";
    context.fill();
    context.lineWidth = 1.5;
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.stroke();
    writeLabel("çarpışma", origin.x, origin.y - 15, "#70506b");

    if (result.mode === "inelastic") {
      const totalMagnitude = Math.hypot(
        result.momentumAfterX,
        result.momentumAfterY,
      );
      drawArrow(
        origin,
        vectorEnd(result.momentumAfterX, result.momentumAfterY, totalMagnitude),
        "#76566f",
        "birlikte",
      );
      return;
    }

    const oneEnd = vectorEnd(
      result.momentumOneAfterX,
      result.momentumOneAfterY,
      result.momentumOneAfter,
    );
    const twoEnd = vectorEnd(
      result.momentumTwoAfterX,
      result.momentumTwoAfterY,
      result.momentumTwoAfter,
    );
    drawArrow(origin, oneEnd, "#d4861f", `p₁ · ${formatPhysics(roundedAngle(result.momentumOneAfterX, result.momentumOneAfterY), 0)}°`);
    drawArrow(origin, twoEnd, "#168178", `p₂ · ${formatPhysics(roundedAngle(result.momentumTwoAfterX, result.momentumTwoAfterY), 0)}°`);

    for (const [end, color] of [
      [oneEnd, "#d4861f"],
      [twoEnd, "#168178"],
    ] as const) {
      context.save();
      context.setLineDash([3, 4]);
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(end.x, origin.y);
      context.lineTo(end.x, end.y);
      context.strokeStyle = color;
      context.globalAlpha = 0.24;
      context.lineWidth = 1;
      context.stroke();
      context.restore();
    }
  }, [result, targetY]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return (
    <canvas
      className="collision-scattering-overlay collision-surface-vectors"
      ref={canvasRef}
      aria-label={
        result
          ? "Çarpışma anındaki gelen ve çarpışma sonrasındaki momentum doğrultuları"
          : `Çarpışma öncesi doğrultu ayarı: ${formatPhysics(plannedCollisionAngle(targetY), 0)} derece`
      }
    />
  );
}

function VectorAnalysisCanvas({ result }: { result: CollisionResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.getBoundingClientRect().width, 320);
    const height = 230;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f8fbfa";
    context.fillRect(0, 0, width, height);

    const largestMomentum = Math.max(
      result.momentumOneBefore,
      result.momentumOneAfter,
      result.momentumTwoAfter,
      0.001,
    );
    const scale = Math.min(82 / largestMomentum, width * 0.13 / largestMomentum);
    const leftOrigin = { x: width * 0.25, y: 132 };
    const rightOrigin = { x: width * 0.72, y: 132 };

    const drawAxes = (origin: Point, title: string) => {
      context.beginPath();
      context.moveTo(origin.x - 92, origin.y);
      context.lineTo(origin.x + 100, origin.y);
      context.moveTo(origin.x, origin.y + 65);
      context.lineTo(origin.x, origin.y - 72);
      context.strokeStyle = "#d5e1de";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = "#39585e";
      context.font = "900 11px Arial";
      context.textAlign = "center";
      context.fillText(title, origin.x, 24);
      context.font = "800 8px Arial";
      context.fillText("+x", origin.x + 105, origin.y + 3);
      context.fillText("+y", origin.x + 9, origin.y - 73);
    };

    const drawArrow = (
      origin: Point,
      x: number,
      y: number,
      color: string,
      label: string,
      offsetY = 0,
      dashed = false,
    ) => {
      const startY = origin.y + offsetY;
      const dx = x * scale;
      const dy = -y * scale;
      const length = Math.hypot(dx, dy);
      if (length < 0.5) {
        context.beginPath();
        context.arc(origin.x, startY, 4, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
        context.font = "800 8px Arial";
        context.fillText(`${label} = 0`, origin.x + 25, startY - 7);
        return;
      }
      const angle = Math.atan2(dy, dx);
      const endX = origin.x + dx;
      const endY = startY + dy;
      context.save();
      if (dashed) context.setLineDash([8, 5]);
      context.beginPath();
      context.moveTo(origin.x, startY);
      context.lineTo(endX, endY);
      context.strokeStyle = color;
      context.lineWidth = 2.2;
      context.stroke();
      context.restore();
      context.beginPath();
      context.moveTo(endX, endY);
      context.lineTo(
        endX - Math.cos(angle - Math.PI / 6) * 8,
        endY - Math.sin(angle - Math.PI / 6) * 8,
      );
      context.lineTo(
        endX - Math.cos(angle + Math.PI / 6) * 8,
        endY - Math.sin(angle + Math.PI / 6) * 8,
      );
      context.closePath();
      context.fillStyle = color;
      context.fill();
      context.font = "900 8px Arial";
      context.textAlign = "center";
      context.fillText(label, endX + Math.cos(angle) * 12, endY + Math.sin(angle) * 12);
    };

    context.beginPath();
    context.moveTo(width * 0.5, 18);
    context.lineTo(width * 0.5, height - 18);
    context.strokeStyle = "#e0e9e7";
    context.lineWidth = 1;
    context.stroke();

    drawAxes(leftOrigin, "ÖNCE");
    drawAxes(rightOrigin, "SONRA");
    drawArrow(
      leftOrigin,
      result.momentumOneBefore,
      0,
      "#d98619",
      "1. disk",
    );
    drawArrow(leftOrigin, 0, 0, "#167f75", "2. disk durgun", 12);

    if (result.mode === "inelastic") {
      drawArrow(
        rightOrigin,
        result.momentumAfterX,
        result.momentumAfterY,
        "#76566f",
        "birlikte",
      );
    } else {
      drawArrow(
        rightOrigin,
        result.momentumOneAfterX,
        result.momentumOneAfterY,
        "#d98619",
        "1. disk",
        -4,
      );
      drawArrow(
        rightOrigin,
        result.momentumTwoAfterX,
        result.momentumTwoAfterY,
        "#167f75",
        "2. disk",
        4,
      );
    }
  }, [result]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Çarpışma öncesi ve sonrası sade, ölçekli momentum vektörleri"
    />
  );
}

function CollisionVectorAnalysis({
  result,
  onClose,
}: {
  result: CollisionResult;
  onClose: () => void;
}) {
  const angleOne = roundedAngle(
    result.momentumOneAfterX,
    result.momentumOneAfterY,
  );
  const angleTwo = roundedAngle(
    result.momentumTwoAfterX,
    result.momentumTwoAfterY,
  );
  const speedOneAfter = Math.hypot(
    result.velocityOneAfterX,
    result.velocityOneAfterY,
  );
  const speedTwoAfter = Math.hypot(
    result.velocityTwoAfterX,
    result.velocityTwoAfterY,
  );
  const energyChange = exactZero(result.energyAfter - result.energyBefore);
  const energyLoss = Math.max(0, exactZero(result.energyBefore - result.energyAfter));
  const totalMomentumBefore = Math.hypot(
    result.momentumBeforeX,
    result.momentumBeforeY,
  );
  const totalMomentumAfter = Math.hypot(
    result.momentumAfterX,
    result.momentumAfterY,
  );

  return (
    <section className="collision-vector-analysis" aria-labelledby="vector-analysis-title">
      <header>
        <div>
          <span>DENEY #{result.id} · SADE ÇARPIŞMA ANALİZİ</span>
          <h3 id="vector-analysis-title">Çarpışmayı sade oku</h3>
          <p>
            Okların yönü hareket doğrultusunu, uzunluğu momentum büyüklüğünü
            gösterir.
          </p>
        </div>
        <button type="button" onClick={onClose}>
          Analizi kapat
        </button>
      </header>

      <div className="collision-analysis-canvas">
        <VectorAnalysisCanvas result={result} />
      </div>

      <div className="collision-analysis-legend" aria-label="Vektör renkleri">
        <span className="puck-one">1. disk</span>
        <span className="puck-two">2. disk</span>
        {result.mode === "inelastic" && <span className="together">Birlikte hareket</span>}
      </div>

      <div className="collision-analysis-summary">
        <article className="puck-one">
          <header><i /><b>1. disk</b><small>turuncu</small></header>
          <div><span>Önce</span><b>{formatPhysics(result.momentumOneBefore)} kg·m/s</b></div>
          <div><span>Sonra</span><b>{formatPhysics(result.momentumOneAfter)} kg·m/s</b></div>
          <div><span>Son doğrultu</span><b>{formatPhysics(angleOne, 0)}°</b></div>
          <small>
            pₓ {formatPhysics(result.momentumOneAfterX)} · pᵧ {formatPhysics(result.momentumOneAfterY)}
          </small>
        </article>

        <article className="puck-two">
          <header><i /><b>2. disk</b><small>turkuaz</small></header>
          <div><span>Önce</span><b>0 kg·m/s</b></div>
          <div><span>Sonra</span><b>{formatPhysics(result.momentumTwoAfter)} kg·m/s</b></div>
          <div><span>Son doğrultu</span><b>{formatPhysics(angleTwo, 0)}°</b></div>
          <small>
            pₓ {formatPhysics(result.momentumTwoAfterX)} · pᵧ {formatPhysics(result.momentumTwoAfterY)}
          </small>
        </article>

        <article className="momentum-proof">
          <header><i>✓</i><b>Toplam momentum</b><small>korunum kontrolü</small></header>
          <div><span>Çarpışmadan önce</span><b>{formatPhysics(totalMomentumBefore)} kg·m/s</b></div>
          <div><span>Çarpışmadan sonra</span><b>{formatPhysics(totalMomentumAfter)} kg·m/s</b></div>
          <strong>İdeal sistemde momentum korundu.</strong>
        </article>

        <article className="energy-proof">
          <header><i>KE</i><b>Kinetik enerji</b><small>önce ve sonra</small></header>
          <div><span>Önce</span><b>{formatPhysics(result.energyBefore)} J</b></div>
          <div><span>Sonra</span><b>{formatPhysics(result.energyAfter)} J</b></div>
          <strong>
            {energyChange === 0
              ? "Enerji korundu."
              : `${formatPhysics(energyLoss)} J başka enerji türlerine dönüştü.`}
          </strong>
        </article>
      </div>

      <div className="collision-analysis-conclusion">
        <b>SONUÇ</b>
        <span>
          {result.mode === "elastic"
            ? `Esnek çarpışma: momentum ve kinetik enerji korundu. Son hızlar: 1. disk ${formatPhysics(speedOneAfter)} m/s, 2. disk ${formatPhysics(speedTwoAfter)} m/s.`
            : `Esnek olmayan çarpışma: diskler birlikte hareket etti. Momentum korundu; ${formatPhysics(energyLoss)} J kinetik enerji başka enerji türlerine dönüştü.`}
        </span>
      </div>
    </section>
  );
}

function CollisionGraph({
  kind,
  latest,
  records,
}: {
  kind: GraphKind;
  latest: CollisionResult | null;
  records: CollisionResult[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.getBoundingClientRect().width, 300);
    const height = 275;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fbfdfc";
    context.fillRect(0, 0, width, height);

    const margin = { top: 20, right: 20, bottom: 42, left: 48 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    context.font = "700 10px Arial";
    context.textAlign = "center";
    context.textBaseline = "top";

    if (kind === "momentum") {
      const values = latest
        ? [
            latest.momentumBeforeX,
            latest.momentumAfterX,
            latest.momentumBeforeY,
            latest.momentumAfterY,
          ]
        : [0, 0, 0, 0];
      const labels = ["pₓ önce", "pₓ sonra", "pᵧ önce", "pᵧ sonra"];
      const maxValue = Math.max(0.5, ...values.map((value) => Math.abs(value) * 1.18));
      const zeroY = margin.top + plotHeight / 2;

      for (let index = -2; index <= 2; index += 1) {
        const value = (maxValue / 2) * index;
        const y = zeroY - (value / maxValue) * (plotHeight / 2);
        context.beginPath();
        context.moveTo(margin.left, y);
        context.lineTo(width - margin.right, y);
        context.strokeStyle = index === 0 ? "#9cb2b1" : "#e2ece9";
        context.lineWidth = index === 0 ? 1.5 : 1;
        context.stroke();
        context.fillStyle = "#6d8387";
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.fillText(value.toFixed(2), margin.left - 7, y);
      }

      const barSpace = plotWidth / values.length;
      values.forEach((value, index) => {
        const barWidth = Math.min(48, barSpace * 0.56);
        const barHeight = (Math.abs(value) / maxValue) * (plotHeight / 2);
        const x = margin.left + barSpace * index + (barSpace - barWidth) / 2;
        const y = value >= 0 ? zeroY - barHeight : zeroY;
        context.fillStyle =
          index % 2 === 0 ? "rgba(239, 159, 40, 0.86)" : "rgba(22, 127, 117, 0.88)";
        context.fillRect(x, y, barWidth, Math.max(barHeight, value === 0 ? 2 : 0));
        context.fillStyle = "#526c70";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(labels[index], x + barWidth / 2, margin.top + plotHeight + 10);
      });

      context.save();
      context.translate(14, margin.top + plotHeight / 2);
      context.rotate(-Math.PI / 2);
      context.fillStyle = "#38575d";
      context.font = "800 10px Arial";
      context.textAlign = "center";
      context.fillText("Momentum bileşeni (kg·m/s)", 0, 0);
      context.restore();
    } else {
      const yMax = 110;
      const pointX = (index: number) =>
        records.length < 2
          ? margin.left + plotWidth / 2
          : margin.left + (index / (records.length - 1)) * plotWidth;
      const pointY = (value: number) =>
        margin.top + plotHeight - (value / yMax) * plotHeight;

      for (let index = 0; index <= 5; index += 1) {
        const value = index * 20;
        const y = pointY(value);
        context.beginPath();
        context.moveTo(margin.left, y);
        context.lineTo(width - margin.right, y);
        context.strokeStyle = value === 100 ? "#efc27d" : "#e1ebe8";
        context.lineWidth = value === 100 ? 1.5 : 1;
        context.stroke();
        context.fillStyle = "#6d8387";
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.fillText(`${value}%`, margin.left - 7, y);
      }

      if (records.length) {
        context.beginPath();
        records.forEach((record, index) => {
          const x = pointX(index);
          const y = pointY(Math.min(record.energyRetention, yMax));
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.strokeStyle = "#9b6b92";
        context.lineWidth = 2.5;
        context.stroke();

        records.forEach((record, index) => {
          const x = pointX(index);
          const y = pointY(Math.min(record.energyRetention, yMax));
          context.beginPath();
          context.arc(x, y, 5, 0, Math.PI * 2);
          context.fillStyle = record.mode === "elastic" ? "#167f75" : "#ef9f28";
          context.fill();
          context.strokeStyle = "#ffffff";
          context.lineWidth = 2;
          context.stroke();
          context.fillStyle = "#536d72";
          context.textAlign = "center";
          context.textBaseline = "top";
          context.fillText(`#${record.id}`, x, margin.top + plotHeight + 10);
        });
      }

      context.save();
      context.translate(14, margin.top + plotHeight / 2);
      context.rotate(-Math.PI / 2);
      context.fillStyle = "#38575d";
      context.font = "800 10px Arial";
      context.textAlign = "center";
      context.fillText("Kinetik enerji korunumu (%)", 0, 0);
      context.restore();
    }
  }, [kind, latest, records]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return (
    <article className="collision-graph">
      <div className="collision-graph-heading">
        <b>
          {kind === "momentum"
            ? "Momentum bileşenleri"
            : "Denemelerde kinetik enerji"}
        </b>
        <span>
          {kind === "momentum"
            ? "Turuncu: önce · Yeşil: sonra"
            : "Yeşil: esnek · Turuncu: esnek olmayan"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={
          kind === "momentum"
            ? "Çarpışma öncesi ve sonrası momentum bileşenleri grafiği"
            : "Denemelerin kinetik enerji korunumu grafiği"
        }
      />
    </article>
  );
}

export default function CollisionLab() {
  const airTableRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);
  const draggingTargetRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const simulationRef = useRef<Simulation | null>(null);
  const nextMarkIdRef = useRef(1);
  const nextResultIdRef = useRef(1);

  const [installed, setInstalled] = useState<SetupKind[]>([]);
  const [balanced, setBalanced] = useState(false);
  const [compressorOn, setCompressorOn] = useState(false);
  const [timerReady, setTimerReady] = useState(false);
  const [mode, setMode] = useState<CollisionMode>("elastic");
  const [runState, setRunState] = useState<RunState>("ready");
  const [initialSpeed, setInitialSpeed] = useState(0.9);
  const [massOne, setMassOne] = useState(0.525);
  const [massTwo, setMassTwo] = useState(0.53);
  const [sparkInterval, setSparkInterval] = useState(0.1);
  const [targetY, setTargetY] = useState(0.55);
  const [positions, setPositions] = useState(() => initialPositions(0.55));
  const [marks, setMarks] = useState<TraceMark[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [latestResult, setLatestResult] = useState<CollisionResult | null>(null);
  const [records, setRecords] = useState<CollisionResult[]>([]);
  const [showVectorAnalysis, setShowVectorAnalysis] = useState(false);
  const [notice, setNotice] = useState(
    "İlk olarak hava masasını deney alanına yerleştir.",
  );

  const setupReady = REQUIRED_SETUP.every((kind) => installed.includes(kind));
  const velcroInstalled = installed.includes("velcro");
  const nextSetupKind = SETUP_ORDER.find((kind) => !installed.includes(kind));
  const setupProgress = installed.filter((kind) =>
    REQUIRED_SETUP.includes(kind),
  ).length;

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!showVectorAnalysis) return;
    const frame = requestAnimationFrame(() => {
      analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [showVectorAnalysis]);

  const resetPuckPositions = useCallback(
    (nextTargetY = targetY) => {
      setPositions(initialPositions(nextTargetY));
      setMarks([]);
      setElapsed(0);
      setRunState("ready");
      setLatestResult(null);
      setShowVectorAnalysis(false);
    },
    [targetY],
  );

  const installEquipment = (kind: SetupKind) => {
    if (installed.includes(kind)) {
      setNotice("Bu parça düzeneğe zaten yerleştirildi.");
      return;
    }
    if (kind !== nextSetupKind) {
      const expected = EQUIPMENT.find((item) => item.kind === nextSetupKind);
      setNotice(`Önce ${expected?.shortName.toLocaleLowerCase("tr-TR")} yerleştirilmeli.`);
      return;
    }
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    if (kind === "velcro") {
      setMode("inelastic");
      resetPuckPositions();
      setNotice(
        "Cırt cırt bant disklere takıldı; deney otomatik olarak esnek olmayan çarpışmaya geçti.",
      );
      return;
    }
    const nextRequired = REQUIRED_SETUP.find(
      (item) => !nextInstalled.includes(item),
    );
    if (nextRequired) {
      const nextName = EQUIPMENT.find(
        (item) => item.kind === nextRequired,
      )?.shortName;
      setNotice(`${nextName} deney alanına yerleştirilebilir.`);
    } else {
      setNotice(
        "Temel düzenek hazır. Masayı dengele, kompresörü aç ve kronometreyi sıfırla.",
      );
    }
  };

  const onEquipmentDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    kind: SetupKind,
  ) => {
    event.dataTransfer.setData("application/x-collision-equipment", kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData(
      "application/x-collision-equipment",
    ) as SetupKind;
    if (SETUP_ORDER.includes(kind)) installEquipment(kind);
  };

  const selectMode = (nextMode: CollisionMode) => {
    if (runState === "running") return;
    if (nextMode === "inelastic" && !velcroInstalled) {
      setNotice(
        "Esnek olmayan çarpışma için cırt cırt bandı malzeme panelinden disklere tak.",
      );
      return;
    }
    setMode(nextMode);
    resetPuckPositions();
    setNotice(
      nextMode === "elastic"
        ? "Esnek çarpışma seçildi. Diskler çarpışmadan sonra ayrılacak."
        : "Esnek olmayan çarpışma seçildi. Diskler çarpışmadan sonra birlikte ilerleyecek.",
    );
  };

  const startTargetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setupReady || runState === "running") return;
    draggingTargetRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveTarget = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingTargetRef.current || !airTableRef.current) return;
    const rect = airTableRef.current.getBoundingClientRect();
    const localY = (event.clientY - rect.top) / rect.height;
    const surfaceY = (localY - AIR_TABLE_SURFACE.top / 100) /
      (AIR_TABLE_SURFACE.height / 100);
    const nextY = Math.max(0.42, Math.min(0.58, surfaceY)) * TABLE_HEIGHT;
    setTargetY(nextY);
    setPositions((current) => ({
      ...current,
      two: { ...current.two, y: nextY },
    }));
    setMarks([]);
    setLatestResult(null);
    setRunState("ready");
    const angle = plannedCollisionAngle(nextY);
    setNotice(
      nextY < 0.48
        ? `Durgun disk üst doğrultuya taşındı; çarpışma doğrultusu ${formatPhysics(angle, 0)}°.`
        : nextY > 0.52
          ? `Durgun disk alt doğrultuya taşındı; çarpışma doğrultusu ${formatPhysics(angle, 0)}°.`
          : `Merkeze yakın çarpışma ayarlandı; doğrultu ${formatPhysics(angle, 0)}°.`,
    );
  };

  const stopTargetDrag = () => {
    draggingTargetRef.current = false;
  };

  const balanceTable = () => {
    if (!installed.includes("air-table") || runState === "running") return;
    setBalanced(true);
    setNotice("Su terazisi merkezlendi; hava masası yatay konumda.");
  };

  const toggleCompressor = () => {
    if (!installed.includes("compressor") || runState === "running") return;
    setCompressorOn((current) => !current);
    setNotice(
      compressorOn
        ? "Kompresör kapatıldı."
        : "Kompresör açıldı; disklerin altında hava yastığı oluştu.",
    );
  };

  const resetTimer = () => {
    if (!installed.includes("spark-timer") || runState === "running") return;
    setTimerReady(true);
    setElapsed(0);
    setNotice(
      `Ark kronometresi sıfırlandı. Noktalar ${sparkInterval.toFixed(2)} s aralıklarla kaydedilecek.`,
    );
  };

  const buildMeasuredResult = (
    simulation: Simulation,
    exactVelocityOne: Velocity,
    exactVelocityTwo: Velocity,
  ) => {
    const velocityOneAfterX = exactZero(exactVelocityOne.x);
    const velocityOneAfterY = exactZero(-exactVelocityOne.y);
    const velocityTwoAfterX = exactZero(exactVelocityTwo.x);
    const velocityTwoAfterY = exactZero(-exactVelocityTwo.y);
    const speedOneAfter = Math.hypot(velocityOneAfterX, velocityOneAfterY);
    const speedTwoAfter = Math.hypot(velocityTwoAfterX, velocityTwoAfterY);
    const momentumOneBefore = exactZero(simulation.massOne * initialSpeed);
    const momentumOneAfterX = exactZero(simulation.massOne * velocityOneAfterX);
    const momentumOneAfterY = exactZero(simulation.massOne * velocityOneAfterY);
    const momentumTwoAfterX = exactZero(simulation.massTwo * velocityTwoAfterX);
    const momentumTwoAfterY = exactZero(simulation.massTwo * velocityTwoAfterY);
    const momentumOneAfter = Math.hypot(momentumOneAfterX, momentumOneAfterY);
    const momentumTwoBefore = 0;
    const momentumTwoAfter = Math.hypot(momentumTwoAfterX, momentumTwoAfterY);
    const momentumBeforeX = momentumOneBefore;
    const momentumBeforeY = 0;
    const rawMomentumAfterX = momentumOneAfterX + momentumTwoAfterX;
    const rawMomentumAfterY = momentumOneAfterY + momentumTwoAfterY;
    const momentumAfterX =
      Math.abs(rawMomentumAfterX - momentumBeforeX) < PHYSICS_EPSILON
        ? momentumBeforeX
        : exactZero(rawMomentumAfterX);
    const momentumAfterY = exactZero(rawMomentumAfterY);
    const energyBefore = 0.5 * simulation.massOne * initialSpeed ** 2;
    const rawEnergyAfter =
      0.5 * simulation.massOne * speedOneAfter ** 2 +
      0.5 * simulation.massTwo * speedTwoAfter ** 2;
    const energyAfter =
      simulation.mode === "elastic" &&
      Math.abs(rawEnergyAfter - energyBefore) < PHYSICS_EPSILON
        ? energyBefore
        : exactZero(rawEnergyAfter);
    const rawEnergyRetention = (energyAfter / energyBefore) * 100;
    const energyRetention =
      Math.abs(rawEnergyRetention - 100) < PHYSICS_EPSILON
        ? 100
        : exactZero(rawEnergyRetention);

    return {
      id: nextResultIdRef.current++,
      mode: simulation.mode,
      massOne: simulation.massOne,
      massTwo: simulation.massTwo,
      initialSpeed,
      sparkInterval: simulation.sparkInterval,
      momentumOneBefore,
      momentumOneAfter,
      momentumTwoBefore,
      momentumTwoAfter,
      velocityOneAfterX,
      velocityOneAfterY,
      velocityTwoAfterX,
      velocityTwoAfterY,
      momentumOneAfterX,
      momentumOneAfterY,
      momentumTwoAfterX,
      momentumTwoAfterY,
      collisionX: simulation.positionOne.x,
      collisionY: simulation.positionOne.y,
      momentumBeforeX,
      momentumBeforeY,
      momentumAfterX,
      momentumAfterY,
      energyBefore,
      energyAfter,
      energyRetention,
    } satisfies CollisionResult;
  };

  const finishRun = (simulation: Simulation) => {
    if (!simulation.result) return;
    setRecords((current) => [...current, simulation.result as CollisionResult]);
    setLatestResult(simulation.result);
    setRunState("complete");
    setTimerReady(false);
    setNotice(
      simulation.result.mode === "elastic"
        ? `Deneme #${simulation.result.id} tamamlandı. Momentum ve kinetik enerji korundu.`
        : `Deneme #${simulation.result.id} tamamlandı. Momentum korundu; kinetik enerji azaldı.`,
    );
    simulationRef.current = null;
    animationFrameRef.current = null;
  };

  const runSimulation = () => {
    if (runState === "running") return;
    if (!setupReady) {
      setNotice("Çarpışmadan önce temel düzeneği tamamla.");
      return;
    }
    if (!balanced) {
      setNotice("Önce hava masasını su terazisiyle dengele.");
      return;
    }
    if (!compressorOn) {
      setNotice("Disklerin sürtünmesiz hareketi için kompresörü aç.");
      return;
    }
    if (!timerReady) {
      setNotice("İzlerin zaman aralığını belirlemek için kronometreyi sıfırla.");
      return;
    }
    if (mode === "inelastic" && !velcroInstalled) {
      setNotice("Esnek olmayan çarpışma için cırt cırt bandı disklere tak.");
      return;
    }

    const start = initialPositions(targetY);
    const now = performance.now();
    const simulation: Simulation = {
      time: 0,
      lastFrame: now,
      lastSpark: 0,
      collided: false,
      collisionTime: 0,
      positionOne: { ...start.one },
      positionTwo: { ...start.two },
      velocityOne: { x: initialSpeed, y: 0 },
      velocityTwo: { x: 0, y: 0 },
      result: null,
      mode,
      massOne,
      massTwo,
      sparkInterval,
    };
    simulationRef.current = simulation;
    setPositions(start);
    setMarks([
      {
        id: nextMarkIdRef.current++,
        puck: 1,
        phase: "before",
        ...start.one,
      },
      {
        id: nextMarkIdRef.current++,
        puck: 2,
        phase: "before",
        ...start.two,
      },
    ]);
    setLatestResult(null);
    setShowVectorAnalysis(false);
    setRunState("running");
    setElapsed(0);
    setNotice("Pedala basıldı; ark kronometresi nokta izlerini kaydediyor.");

    const tick = (frameNow: number) => {
      const current = simulationRef.current;
      if (!current) return;
      const delta = Math.min((frameNow - current.lastFrame) / 1000, 0.025);
      current.lastFrame = frameNow;
      current.time += delta;

      current.positionOne.x += current.velocityOne.x * delta;
      current.positionOne.y += current.velocityOne.y * delta;
      current.positionTwo.x += current.velocityTwo.x * delta;
      current.positionTwo.y += current.velocityTwo.y * delta;

      if (!current.collided) {
        const dx = current.positionTwo.x - current.positionOne.x;
        const dy = current.positionTwo.y - current.positionOne.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= PUCK_RADIUS * 2) {
          const normal = {
            x: dx / Math.max(distance, 0.001),
            y: dy / Math.max(distance, 0.001),
          };
          if (current.mode === "inelastic") {
            const commonVelocity = {
              x:
                (current.massOne * current.velocityOne.x +
                  current.massTwo * current.velocityTwo.x) /
                (current.massOne + current.massTwo),
              y:
                (current.massOne * current.velocityOne.y +
                  current.massTwo * current.velocityTwo.y) /
                (current.massOne + current.massTwo),
            };
            current.velocityOne = { ...commonVelocity };
            current.velocityTwo = { ...commonVelocity };
          } else {
            const relativeNormalSpeed =
              (current.velocityOne.x - current.velocityTwo.x) * normal.x +
              (current.velocityOne.y - current.velocityTwo.y) * normal.y;
            const impulse =
              (2 * relativeNormalSpeed) /
              (1 / current.massOne + 1 / current.massTwo);
            current.velocityOne = {
              x: current.velocityOne.x - (impulse / current.massOne) * normal.x,
              y: current.velocityOne.y - (impulse / current.massOne) * normal.y,
            };
            current.velocityTwo = {
              x: current.velocityTwo.x + (impulse / current.massTwo) * normal.x,
              y: current.velocityTwo.y + (impulse / current.massTwo) * normal.y,
            };
          }
          current.collided = true;
          current.collisionTime = current.time;
          current.result = buildMeasuredResult(
            current,
            current.velocityOne,
            current.velocityTwo,
          );
          setLatestResult(current.result);
          setNotice(
            current.mode === "elastic"
              ? "Diskler çarpıştı ve farklı doğrultularda ayrıldı."
              : "Cırt bantlar birleşti; diskler çarpışmadan sonra birlikte ilerliyor.",
          );
        }
      }

      const reachedTableEdge =
        current.collided &&
        (puckReachedTableEdge(current.positionOne) ||
          puckReachedTableEdge(current.positionTwo));

      if (reachedTableEdge) {
        current.positionOne = keepPuckOnTable(current.positionOne);
        current.positionTwo = keepPuckOnTable(current.positionTwo);
      }

      if (current.time - current.lastSpark >= current.sparkInterval) {
        current.lastSpark = current.time;
        setMarks((previous) => [
          ...previous,
          {
            id: nextMarkIdRef.current++,
            puck: 1,
            phase: current.collided ? "after" : "before",
            ...current.positionOne,
          },
          {
            id: nextMarkIdRef.current++,
            puck: 2,
            phase: current.collided ? "after" : "before",
            ...current.positionTwo,
          },
        ].slice(-32));
      }

      setElapsed(current.time);
      setPositions({
        one: { ...current.positionOne },
        two: { ...current.positionTwo },
      });

      if (
        current.collided &&
        (current.time - current.collisionTime >= 0.92 || reachedTableEdge)
      ) {
        finishRun(current);
        return;
      }
      if (current.time >= 3.2) {
        setRunState("ready");
        setTimerReady(false);
        setNotice(
          "Diskler çarpışmadı. Durgun diski merkeze yaklaştırıp tekrar dene.",
        );
        simulationRef.current = null;
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const prepareNextRun = () => {
    if (runState === "running") return;
    resetPuckPositions();
    setTimerReady(false);
    setNotice(
      "Diskler başlangıç konumuna alındı. Yeni ayarlarını yap ve kronometreyi sıfırla.",
    );
  };

  const clearExperiment = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    simulationRef.current = null;
    setInstalled([]);
    setBalanced(false);
    setCompressorOn(false);
    setTimerReady(false);
    setMode("elastic");
    setRunState("ready");
    setInitialSpeed(0.9);
    setMassOne(0.525);
    setMassTwo(0.53);
    setSparkInterval(0.1);
    setTargetY(0.55);
    setPositions(initialPositions(0.55));
    setMarks([]);
    setElapsed(0);
    setLatestResult(null);
    setRecords([]);
    setShowVectorAnalysis(false);
    nextMarkIdRef.current = 1;
    nextResultIdRef.current = 1;
    setNotice("İlk olarak hava masasını deney alanına yerleştir.");
  };

  const apparatusStyle = {
    "--puck-one-x": `${AIR_TABLE_SURFACE.left + (positions.one.x / TABLE_WIDTH) * AIR_TABLE_SURFACE.width}%`,
    "--puck-one-y": `${AIR_TABLE_SURFACE.top + (positions.one.y / TABLE_HEIGHT) * AIR_TABLE_SURFACE.height}%`,
    "--puck-two-x": `${AIR_TABLE_SURFACE.left + (positions.two.x / TABLE_WIDTH) * AIR_TABLE_SURFACE.width}%`,
    "--puck-two-y": `${AIR_TABLE_SURFACE.top + (positions.two.y / TABLE_HEIGHT) * AIR_TABLE_SURFACE.height}%`,
  } as CSSProperties;

  const readiness = useMemo(
    () => [
      { label: "Düzenek", ready: setupReady },
      { label: "Yataylık", ready: balanced },
      { label: "Hava akışı", ready: compressorOn },
      { label: "Zamanlayıcı", ready: timerReady },
    ],
    [balanced, compressorOn, setupReady, timerReady],
  );

  return (
    <section className="collision-lab-section" id="carpismalar-deneyi">
      <div className="collision-heading">
        <div>
          <span>DENEY 4 · FİZ.12.1.4 · MOMENTUMUN KORUNUMU</span>
          <h2>Çarpışmayı kur, izlerini ölç ve kanıtla.</h2>
        </div>
        <p>
          Hava masasını kur; esnek ve esnek olmayan iki boyutlu
          çarpışmalarda momentum bileşenleriyle kinetik enerjiyi karşılaştır.
        </p>
      </div>

      <div className="collision-builder">
        <aside className="collision-equipment-panel">
          <div className="collision-panel-heading">
            <span>TÜM MALZEMELER AÇIK</span>
            <b>Düzeneği kur</b>
          </div>
          <div className="collision-equipment-list">
            {EQUIPMENT.map((item) => (
              <button
                type="button"
                draggable
                className={installed.includes(item.kind) ? "installed" : ""}
                disabled={installed.includes(item.kind)}
                onClick={() => installEquipment(item.kind)}
                onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                key={item.kind}
              >
                <EquipmentIcon kind={item.kind} />
                <span>
                  <b>{item.shortName}</b>
                  <small>
                    {installed.includes(item.kind)
                      ? "Yerleştirildi"
                      : item.optional
                        ? "Seçince türü değiştirir"
                        : "Sürükle veya dokun"}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button
            className="collision-clear-button"
            type="button"
            onClick={clearExperiment}
          >
            Deneyi baştan kur
          </button>
        </aside>

        <div
          className="collision-stage"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onStageDrop}
        >
          <div className="collision-stage-toolbar">
            <span>
              <small>SİSTEMİN TANIDIĞI DÜZENEK</small>
              <b>{setupReady ? "İki boyutlu çarpışma düzeneği" : "Kurulum bekleniyor"}</b>
            </span>
            <span className={setupReady ? "ready" : ""}>
              {setupProgress} / {REQUIRED_SETUP.length} temel parça
            </span>
          </div>

          <div className="collision-notice" role="status">
            <i aria-hidden="true">{setupReady ? "✓" : setupProgress + 1}</i>
            <span>{notice}</span>
          </div>

          <div className="collision-apparatus">
            {installed.includes("air-table") && (
              <div
                className={`collision-air-table ${balanced ? "balanced" : ""} ${compressorOn ? "air-on" : ""}`}
                ref={airTableRef}
                style={apparatusStyle}
                aria-label="Üstten görünüşlü hava masası"
              >
                <img
                  className="collision-air-table-photo"
                  src="./collision-air-table-v2.webp"
                  alt=""
                  draggable={false}
                />
                <span className="collision-table-rim" />
                <span className="collision-table-corner corner-one" />
                <span className="collision-table-corner corner-two" />
                <span className="collision-table-corner corner-three" />
                <span className="collision-table-corner corner-four" />
                <span className="collision-level">
                  <i />
                  <b>{balanced ? "YATAY" : "AYARLA"}</b>
                </span>
                <span className="collision-table-air-inlet" aria-hidden="true">
                  <i />
                </span>

                {installed.includes("trace-paper") && (
                  <div className="collision-trace-paper">
                    <div className="collision-coordinate-system" aria-hidden="true">
                      <span className="collision-coordinate-origin">O</span>
                      <span className="collision-coordinate-line coordinate-x">
                        <i />
                        <b>+x</b>
                      </span>
                      <span className="collision-coordinate-line coordinate-y">
                        <i />
                        <b>+y</b>
                      </span>
                    </div>
                    {marks.map((mark) => (
                      <i
                        className={`collision-trace-mark puck-${mark.puck} ${mark.phase}`}
                        style={{
                          left: `${(mark.x / TABLE_WIDTH) * 100}%`,
                          top: `${(mark.y / TABLE_HEIGHT) * 100}%`,
                        }}
                        key={mark.id}
                      />
                    ))}
                    {installed.includes("puck-one") &&
                      installed.includes("puck-two") && (
                        <CollisionSurfaceVectors
                          result={latestResult}
                          targetY={targetY}
                        />
                      )}
                  </div>
                )}

                {installed.includes("puck-one") && (
                  <span
                    className={`collision-puck collision-puck-one ${mode === "inelastic" && velcroInstalled ? "velcro" : ""}`}
                  >
                    <img src="./collision-puck-one-v2.webp" alt="" draggable={false} />
                    <b>1</b>
                    <small>{massOne.toFixed(3)} kg</small>
                  </span>
                )}

                {installed.includes("puck-two") && (
                  <button
                    type="button"
                    className={`collision-puck collision-puck-two ${mode === "inelastic" && velcroInstalled ? "velcro" : ""}`}
                    onPointerDown={startTargetDrag}
                    onPointerMove={moveTarget}
                    onPointerUp={stopTargetDrag}
                    onPointerCancel={stopTargetDrag}
                    aria-label="İkinci disk. Düşey sürükleyerek çarpışma doğrultusunu ayarla."
                  >
                    <img src="./collision-puck-two-v2.webp" alt="" draggable={false} />
                    <b>2</b>
                    <small>{massTwo.toFixed(3)} kg</small>
                  </button>
                )}

              </div>
            )}

            {installed.includes("air-table") &&
              installed.includes("compressor") && (
                <span className="collision-air-hose" aria-hidden="true">
                  <i />
                  <i />
                </span>
              )}

            {installed.includes("spark-timer") && (
              <span className="collision-pedal-cable" aria-hidden="true">
                <i />
                <i />
              </span>
            )}

            {installed.includes("compressor") && (
              <div className={`collision-compressor ${compressorOn ? "running" : ""}`}>
                <img
                  className="collision-compressor-photo"
                  src="./collision-compressor-v2.webp"
                  alt=""
                  draggable={false}
                />
                <span className="compressor-fan" aria-hidden="true"><i /></span>
                <em className="compressor-status">
                  {compressorOn ? "HAVA AKIŞI AÇIK" : "KOMPRESÖR KAPALI"}
                </em>
              </div>
            )}

            {installed.includes("spark-timer") && (
              <div className={`collision-spark-timer ${runState === "running" ? "recording" : ""}`}>
                <img
                  className="collision-spark-timer-photo"
                  src="./collision-spark-timer-v2.webp"
                  alt=""
                  draggable={false}
                />
                <span>ARK KRONOMETRESİ</span>
                <b>{elapsed.toFixed(2)}</b>
                <small>s</small>
                <em>Δt {sparkInterval.toFixed(2)} s</em>
                <i />
              </div>
            )}

            {installed.includes("spark-timer") && (
              <div className={`collision-pedal ${runState === "running" ? "pressed" : ""}`}>
                <img
                  src="./collision-foot-pedal-v2.webp"
                  alt=""
                  draggable={false}
                />
                <b>PEDAL</b>
              </div>
            )}

            {!installed.includes("air-table") && (
              <div className="collision-empty-target">
                <i>＋</i>
                <b>Hava masasını bu alana sürükle</b>
              </div>
            )}
          </div>

          <div className="collision-mode-panel">
            <div>
              <span>Çarpışma türü</span>
              <div className="collision-mode-buttons">
                <button
                  type="button"
                  className={mode === "elastic" ? "active" : ""}
                  aria-pressed={mode === "elastic"}
                  onClick={() => selectMode("elastic")}
                  disabled={runState === "running"}
                >
                  Esnek
                </button>
                <button
                  type="button"
                  className={mode === "inelastic" ? "active" : ""}
                  aria-pressed={mode === "inelastic"}
                  onClick={() => selectMode("inelastic")}
                  disabled={runState === "running"}
                >
                  Esnek olmayan
                </button>
              </div>
            </div>
            <label>
              <span>1. diskin ilk hızı</span>
              <b>{initialSpeed.toFixed(2)} m/s</b>
              <input
                type="range"
                min="0.6"
                max="1.4"
                step="0.05"
                value={initialSpeed}
                disabled={runState === "running"}
                onChange={(event) => {
                  setInitialSpeed(Number(event.target.value));
                  resetPuckPositions();
                }}
              />
            </label>
            <label>
              <span>Çarpışma doğrultusu</span>
              <b>α = {formatPhysics(plannedCollisionAngle(targetY), 0)}°</b>
              <input
                type="range"
                min="0.42"
                max="0.58"
                step="0.005"
                value={targetY}
                disabled={runState === "running"}
                aria-label="İkinci diskin düşey konumuyla çarpışma doğrultusunu ayarla"
                onChange={(event) => {
                  const nextTargetY = Number(event.target.value);
                  setTargetY(nextTargetY);
                  resetPuckPositions(nextTargetY);
                  setNotice(
                    `Çarpışma doğrultusu ${formatPhysics(plannedCollisionAngle(nextTargetY), 0)}° olarak ayarlandı.`,
                  );
                }}
              />
            </label>
            <label>
              <span>İzler arası süre</span>
              <select
                value={sparkInterval}
                disabled={runState === "running"}
                onChange={(event) => {
                  setSparkInterval(Number(event.target.value));
                  setTimerReady(false);
                }}
              >
                <option value="0.05">0,05 s</option>
                <option value="0.10">0,10 s</option>
                <option value="0.15">0,15 s</option>
                <option value="0.20">0,20 s</option>
              </select>
            </label>
          </div>

          <div className="collision-mass-panel">
            <label>
              <span>1. disk kütlesi</span>
              <b>{massOne.toFixed(3)} kg</b>
              <input
                type="range"
                min="0.3"
                max="0.8"
                step="0.025"
                value={massOne}
                disabled={runState === "running"}
                onChange={(event) => {
                  setMassOne(Number(event.target.value));
                  resetPuckPositions();
                }}
              />
            </label>
            <label>
              <span>2. disk kütlesi</span>
              <b>{massTwo.toFixed(3)} kg</b>
              <input
                type="range"
                min="0.3"
                max="0.8"
                step="0.025"
                value={massTwo}
                disabled={runState === "running"}
                onChange={(event) => {
                  setMassTwo(Number(event.target.value));
                  resetPuckPositions();
                }}
              />
            </label>
          </div>

          <div className="collision-controls">
            <button
              type="button"
              className={balanced ? "done" : ""}
              onClick={balanceTable}
              disabled={!installed.includes("air-table") || runState === "running"}
            >
              {balanced ? "Masa yatay" : "Masayı dengele"}
            </button>
            <button
              type="button"
              className={compressorOn ? "done" : ""}
              onClick={toggleCompressor}
              disabled={!installed.includes("compressor") || runState === "running"}
            >
              {compressorOn ? "Kompresör açık" : "Kompresörü aç"}
            </button>
            <button
              type="button"
              className={timerReady ? "done" : ""}
              onClick={resetTimer}
              disabled={!installed.includes("spark-timer") || runState === "running"}
            >
              {timerReady ? "Kronometre hazır" : "Kronometreyi sıfırla"}
            </button>
            {runState === "complete" ? (
              <button type="button" className="primary" onClick={prepareNextRun}>
                Yeni deneme hazırla
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={runSimulation}
                disabled={runState === "running"}
              >
                {runState === "running" ? "Çarpışma sürüyor" : "Pedala bas ve diski gönder"}
              </button>
            )}
          </div>
          {runState === "complete" && latestResult && (
            <div className="collision-analysis-prompt">
              <span>
                <small>ÇARPIŞMA TAMAMLANDI</small>
                <b>Önce–sonra momentum ve enerji karşılaştırmasını incele.</b>
              </span>
              <button
                type="button"
                onClick={() => setShowVectorAnalysis((current) => !current)}
              >
                {showVectorAnalysis
                  ? "Sade analizi gizle"
                  : "Sade analizi göster"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showVectorAnalysis && latestResult && (
        <div className="collision-vector-analysis-wrap" ref={analysisRef}>
          <CollisionVectorAnalysis
            result={latestResult}
            onClose={() => setShowVectorAnalysis(false)}
          />
        </div>
      )}

      <div className="collision-readiness">
        {readiness.map((item) => (
          <span className={item.ready ? "done" : ""} key={item.label}>
            <i>{item.ready ? "✓" : "·"}</i>
            {item.label}
          </span>
        ))}
      </div>

      <div className="collision-evidence-heading">
        <div>
          <span>CANLI DENEY KANITLARI</span>
          <h3>İzlerden hıza, hızdan korunuma</h3>
        </div>
        <div className="collision-live-results">
          <span>
            <small>Momentum korunumu</small>
            <b>
              {latestResult
                ? "İdeal sistemde tam korundu"
                : "—"}
            </b>
          </span>
          <span>
            <small>Enerji korunumu</small>
            <b>
              {latestResult
                ? latestResult.energyRetention === 100
                  ? "Korundu · %100"
                  : `Korunmadı · %${formatPhysics(latestResult.energyRetention, 1)}`
                : "—"}
            </b>
          </span>
          <span>
            <small>Çarpışma türü</small>
            <b>
              {latestResult
                ? latestResult.mode === "elastic"
                  ? "Esnek"
                  : "Esnek olmayan"
                : "—"}
            </b>
          </span>
        </div>
      </div>

      <article className="collision-data-table">
        <div className="collision-data-table-heading">
          <span>CİSİMLERİN MOMENTUMLARI VE SİSTEMİN ENERJİSİ</span>
          <b>{records.length} deneme</b>
        </div>
        <div className="collision-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Deneme</th>
                <th>Çarpışma</th>
                <th>1. cismin ilk momentumu</th>
                <th>1. cismin son momentumu</th>
                <th>2. cismin ilk momentumu</th>
                <th>2. cismin son momentumu</th>
                <th>İlk kinetik enerji</th>
                <th>Son kinetik enerji</th>
              </tr>
            </thead>
            <tbody>
              {records.length ? (
                [...records].reverse().map((record) => (
                  <tr key={record.id}>
                    <th>#{record.id}</th>
                    <td>{record.mode === "elastic" ? "Esnek" : "Esnek olmayan"}</td>
                    <td>{formatPhysics(record.momentumOneBefore)} kg·m/s</td>
                    <td>{formatPhysics(record.momentumOneAfter)} kg·m/s</td>
                    <td>{formatPhysics(record.momentumTwoBefore)} kg·m/s</td>
                    <td>{formatPhysics(record.momentumTwoAfter)} kg·m/s</td>
                    <td>{formatPhysics(record.energyBefore)} J</td>
                    <td>{formatPhysics(record.energyAfter)} J</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    İlk çarpışmadan sonra iki cismin ilk ve son momentumları ile
                    sistemin ilk ve son kinetik enerjisi burada görünür.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <div className="collision-graphs">
        <CollisionGraph kind="momentum" latest={latestResult} records={records} />
        <CollisionGraph kind="energy" latest={latestResult} records={records} />
      </div>

      <section className="collision-report">
        <div className="collision-report-heading">
          <span>KISA DENEY RAPORU · KANITA DAYALI YARGI</span>
          <h3>Sonucunu kayıtlarından savun.</h3>
          <p>
            En az bir esnek ve bir esnek olmayan denemeyi kullanarak yanıtla.
          </p>
        </div>
        <div className="collision-report-grid">
          <label>
            <span>1</span>
            Çarpışma öncesi ve sonrası x ile y momentum bileşenlerini
            karşılaştır. Momentumun korunduğunu hangi veriler destekliyor?
            <textarea rows={4} aria-label="Momentum bileşenlerini karşılaştırma" />
          </label>
          <label>
            <span>2</span>
            Esnek ve esnek olmayan çarpışmalarda kinetik enerji yüzdeleri nasıl
            değişti? Momentum sonucu ile birlikte yorumla.
            <textarea rows={4} aria-label="Kinetik enerji sonuçlarını karşılaştırma" />
          </label>
          <label>
            <span>3</span>
            İkinci diskin konumunu değiştirdiğinde iz kâğıdındaki hareket yolları
            nasıl değişti?
            <textarea rows={4} aria-label="Çarpışma doğrultularını yorumlama" />
          </label>
          <label>
            <span>4</span>
            İz kâğıdındaki nokta aralıkları hızlar hakkında hangi kanıtı
            sağlıyor? Çarpışmadan önceki ve sonraki aralıkları karşılaştır.
            <textarea rows={4} aria-label="Nokta izlerinden hızları yorumlama" />
          </label>
        </div>
        <label className="collision-report-conclusion">
          <span>SONUÇ</span>
          Bir ve iki boyutlu çarpışmalar için momentumun korunumu hakkında
          verilerine dayalı bir yargı oluştur.
          <textarea rows={5} aria-label="Çarpışmalar deneyi sonucu" />
        </label>
      </section>
    </section>
  );
}
