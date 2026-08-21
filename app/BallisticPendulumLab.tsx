"use client";
/* eslint-disable @next/next/no-img-element */

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SetupKind =
  | "frame"
  | "launcher"
  | "speed-sensor"
  | "pendulum"
  | "protractor"
  | "indicator"
  | "ball-rack"
  | "ruler";
type BallKind = "small-steel" | "large-steel" | "wood";
type RunState = "ready" | "running" | "complete";
type Phase =
  | "Kurulum"
  | "Fırlatma"
  | "Tam esnek olmayan çarpışma"
  | "Sarkaç yükseliyor"
  | "Ölçüm tamam";

type Trial = {
  id: number;
  ball: BallKind;
  ballName: string;
  mass: number;
  level: number;
  pendulumMass: number;
  length: number;
  angle: number;
  rise: number;
  sensorSpeed: number;
  pendulumSpeed: number;
  calculatedSpeed: number;
};

const G = 9.81;
const BASE_PENDULUM_MASS = 0.3;
const MIN_PENDULUM_LENGTH = 0.25;
const MAX_PENDULUM_LENGTH = 0.42;
const MIME = "application/x-ballistic-equipment";
const SETUP_ORDER: SetupKind[] = [
  "frame",
  "launcher",
  "speed-sensor",
  "pendulum",
  "protractor",
  "indicator",
  "ball-rack",
  "ruler",
];
const EQUIPMENT: Array<{
  kind: SetupKind;
  name: string;
  shortName: string;
}> = [
  { kind: "frame", name: "Alüminyum taşıyıcı gövde ve taban", shortName: "Taşıyıcı gövde" },
  { kind: "launcher", name: "Üç kademeli yatay bilye fırlatıcı", shortName: "Fırlatıcı" },
  { kind: "speed-sensor", name: "Dijital ilk hız sensörü", shortName: "Hız sensörü" },
  { kind: "pendulum", name: "Bilye yakalayıcılı sarkaç mekanizması", shortName: "Sarkaç" },
  { kind: "protractor", name: "Yarım daire açıölçer", shortName: "Açıölçer" },
  { kind: "indicator", name: "Maksimum açıyı tutan gösterge çubuğu", shortName: "Gösterge" },
  { kind: "ball-rack", name: "Üç bilyeli saklama tüpü", shortName: "Bilye takımı" },
  { kind: "ruler", name: "Sarkaç boyu için metal cetvel", shortName: "Cetvel" },
];
const BALLS: Array<{
  kind: BallKind;
  name: string;
  shortName: string;
  mass: number;
  speeds: [number, number, number];
}> = [
  {
    kind: "small-steel",
    name: "Küçük çelik bilye",
    shortName: "Çelik · küçük",
    mass: 0.028,
    speeds: [4.18, 5.62, 6.95],
  },
  {
    kind: "large-steel",
    name: "Büyük çelik bilye",
    shortName: "Çelik · büyük",
    mass: 0.045,
    speeds: [3.86, 5.22, 6.5],
  },
  {
    kind: "wood",
    name: "Ahşap bilye",
    shortName: "Ahşap",
    mass: 0.012,
    speeds: [5.04, 6.68, 8.2],
  },
];

function format(value: number, digits = 2) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function EquipmentIcon({ kind }: { kind: SetupKind }) {
  return (
    <span className={`ballistic-equipment-icon ballistic-icon-${kind}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function BallisticMotionOverlay({
  phase,
  progress,
  displayAngle,
  maxAngle,
  launchAxis,
  compactLaunchAxis,
}: {
  phase: Phase;
  progress: number;
  displayAngle: number;
  maxAngle: number;
  launchAxis: number;
  compactLaunchAxis: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.lineCap = "round";
      context.lineJoin = "round";

      const compact = width < 700;
      const axisY = Math.min(height - 95, compact ? compactLaunchAxis : launchAxis);
      const muzzle = { x: width * (compact ? 0.31 : 0.405), y: axisY };
      const target = { x: width * (compact ? 0.59 : 0.69), y: axisY };
      const pivot = { x: target.x, y: compact ? 75 : 132 };

      const label = (text: string, x: number, y: number, color = "#173f59") => {
        context.save();
        context.font = `800 ${compact ? 9 : 11}px Arial`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.lineWidth = 4;
        context.strokeStyle = "rgba(249,252,251,.94)";
        context.strokeText(text, x, y);
        context.fillStyle = color;
        context.fillText(text, x, y);
        context.restore();
      };

      const arrow = (
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        color: string,
      ) => {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        context.save();
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 1.35;
        context.beginPath();
        context.moveTo(fromX, fromY);
        context.lineTo(toX, toY);
        context.stroke();
        context.beginPath();
        context.moveTo(toX, toY);
        context.lineTo(toX - 9 * Math.cos(angle - Math.PI / 6), toY - 9 * Math.sin(angle - Math.PI / 6));
        context.lineTo(toX - 9 * Math.cos(angle + Math.PI / 6), toY - 9 * Math.sin(angle + Math.PI / 6));
        context.closePath();
        context.fill();
        context.restore();
      };

      if (phase === "Kurulum") {
        return;
      }

      context.save();
      context.strokeStyle = "rgba(8,127,114,.42)";
      context.setLineDash([5, 6]);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(muzzle.x, muzzle.y);
      context.lineTo(target.x, target.y);
      context.stroke();
      context.restore();

      if (progress < 0.34) {
        const travel = Math.min(progress / 0.24, 1);
        const movingX = muzzle.x + (target.x - muzzle.x) * travel;
        arrow(Math.max(muzzle.x, movingX - width * 0.105), target.y - 18, movingX, target.y - 18, "#d78416");
        label("bilyenin momentumu", (muzzle.x + movingX) / 2, target.y - 34, "#a45d09");
      }

      if (progress >= 0.24) {
        context.save();
        context.strokeStyle = "#d78416";
        context.lineWidth = 1.4;
        context.beginPath();
        context.arc(target.x, target.y, 16, 0, Math.PI * 2);
        context.stroke();
        context.restore();
        label("bilye yakalayıcıda kaldı", target.x, target.y + 31, "#9a5a14");
      }

      if (progress >= 0.34) {
        const shownAngle = phase === "Ölçüm tamam" ? maxAngle : displayAngle;
        const angleRadians = (shownAngle * Math.PI) / 180;
        const radius = target.y - pivot.y;
        const catcher = {
          x: pivot.x + radius * Math.sin(angleRadians),
          y: pivot.y + radius * Math.cos(angleRadians),
        };

        context.save();
        context.strokeStyle = "rgba(8,127,114,.7)";
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(pivot.x, pivot.y, radius, Math.PI / 2 - angleRadians, Math.PI / 2);
        context.stroke();
        context.strokeStyle = "rgba(23,63,89,.55)";
        context.setLineDash([4, 5]);
        context.beginPath();
        context.moveTo(pivot.x, pivot.y);
        context.lineTo(pivot.x, target.y);
        context.stroke();
        context.setLineDash([]);
        context.beginPath();
        context.moveTo(catcher.x + 23, catcher.y);
        context.lineTo(catcher.x + 23, target.y);
        context.moveTo(catcher.x + 18, catcher.y);
        context.lineTo(catcher.x + 28, catcher.y);
        context.moveTo(catcher.x + 18, target.y);
        context.lineTo(catcher.x + 28, target.y);
        context.stroke();
        context.restore();

        const vectorLength = compact ? 52 : 72;
        arrow(
          catcher.x,
          catcher.y - 16,
          catcher.x + vectorLength * Math.cos(angleRadians),
          catcher.y - 16 - vectorLength * Math.sin(angleRadians),
          "#087f72",
        );
        label("birleşik hareket", catcher.x + vectorLength * 0.45, catcher.y - 42, "#087f72");
        label(`φ = ${format(maxAngle, 1)}°`, pivot.x + 42, pivot.y + 35, "#173f59");
        label("Δh", catcher.x + 38, (catcher.y + target.y) / 2, "#173f59");
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [phase, progress, displayAngle, maxAngle, launchAxis, compactLaunchAxis]);

  return (
    <canvas
      ref={canvasRef}
      className="ballistic-motion-overlay"
      role="img"
      aria-label="Bilyenin yatay hareketi, çarpışma noktası ve sarkacın yükselme hareketi"
    />
  );
}

function MiniGraph({
  title,
  records,
  kind,
}: {
  title: string;
  records: Trial[];
  kind: "angle" | "speed";
}) {
  const width = 540;
  const height = 230;
  const plot = { left: 50, top: 24, right: 18, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const xMax = Math.max(9, ...records.map((record) => record.sensorSpeed));
  const yMax =
    kind === "angle"
      ? Math.max(35, ...records.map((record) => record.angle))
      : Math.max(9, ...records.map((record) => record.calculatedSpeed));
  const x = (value: number) => plot.left + (value / xMax) * plotWidth;
  const y = (value: number) => plot.top + plotHeight - (value / yMax) * plotHeight;

  return (
    <article className="ballistic-graph-card">
      <div>
        <b>{title}</b>
        <small>
          {kind === "angle" ? "Sensör hızı – maksimum açı" : "Sensör – sarkaç hesabı"}
        </small>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1={plot.left}
              y1={plot.top + plotHeight * ratio}
              x2={width - plot.right}
              y2={plot.top + plotHeight * ratio}
              className="ballistic-graph-grid"
            />
            <text x={plot.left - 8} y={plot.top + plotHeight * ratio + 4}>
              {format(yMax * (1 - ratio), 0)}
            </text>
          </g>
        ))}
        <line
          x1={plot.left}
          y1={plot.top}
          x2={plot.left}
          y2={plot.top + plotHeight}
          className="ballistic-graph-axis"
        />
        <line
          x1={plot.left}
          y1={plot.top + plotHeight}
          x2={width - plot.right}
          y2={plot.top + plotHeight}
          className="ballistic-graph-axis"
        />
        {kind === "speed" && (
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(Math.min(xMax, yMax))}
            y2={y(Math.min(xMax, yMax))}
            className="ballistic-graph-reference"
          />
        )}
        {records.map((record) => {
          const ballIndex = BALLS.findIndex((ball) => ball.kind === record.ball);
          return (
            <circle
              key={record.id}
              cx={x(record.sensorSpeed)}
              cy={y(kind === "angle" ? record.angle : record.calculatedSpeed)}
              r="6"
              className={`ballistic-graph-point ball-${ballIndex + 1}`}
            >
              <title>
                {record.ballName}, {record.level}. kademe: {format(record.sensorSpeed)} m/s
              </title>
            </circle>
          );
        })}
        <text x={width / 2} y={height - 8} className="ballistic-axis-label">
          sensör hızı (m/s)
        </text>
        <text
          x="13"
          y={height / 2}
          transform={`rotate(-90 13 ${height / 2})`}
          className="ballistic-axis-label"
        >
          {kind === "angle" ? "açı (°)" : "hesaplanan hız (m/s)"}
        </text>
      </svg>
    </article>
  );
}

export default function BallisticPendulumLab() {
  const animationRef = useRef<number | null>(null);
  const apparatusRef = useRef<HTMLDivElement>(null);
  const heightPointerRef = useRef<number | null>(null);
  const heightDragStartRef = useRef<{ pointerY: number; length: number } | null>(null);
  const runStartedAtRef = useRef(0);
  const nextIdRef = useRef(1);
  const pendingTrialRef = useRef<Trial | null>(null);
  const [installed, setInstalled] = useState<SetupKind[]>([]);
  const [selectedBall, setSelectedBall] = useState<BallKind>("small-steel");
  const [loadedBall, setLoadedBall] = useState<BallKind | null>(null);
  const [centered, setCentered] = useState(false);
  const [level, setLevel] = useState(1);
  const [length, setLength] = useState(0.32);
  const [addedMass, setAddedMass] = useState(0);
  const [cocked, setCocked] = useState(false);
  const [indicatorZeroed, setIndicatorZeroed] = useState(false);
  const [runState, setRunState] = useState<RunState>("ready");
  const [phase, setPhase] = useState<Phase>("Kurulum");
  const [progress, setProgress] = useState(0);
  const [displayAngle, setDisplayAngle] = useState(0);
  const [maxAngle, setMaxAngle] = useState(0);
  const [sensorDisplay, setSensorDisplay] = useState("—");
  const [message, setMessage] = useState(
    "İlk parçayı seçip sahneye yerleştir.",
  );
  const [records, setRecords] = useState<Trial[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [draggingHeight, setDraggingHeight] = useState(false);
  const [report, setReport] = useState({
    evidence: "",
    conservation: "",
    relation: "",
    method: "",
    conclusion: "",
  });

  const setupComplete = installed.length === SETUP_ORDER.length;
  const latest = records.at(-1) ?? null;
  const nextSetup = SETUP_ORDER[installed.length] ?? null;
  const pendulumMass = BASE_PENDULUM_MASS + addedMass;
  const canAdjustHeight =
    installed.includes("launcher") &&
    installed.includes("pendulum") &&
    runState === "ready";
  const uniqueCoreTrials = useMemo(
    () =>
      new Set(
        records
          .filter((record) => record.pendulumMass === BASE_PENDULUM_MASS)
          .map((record) => `${record.ball}-${record.level}`),
      ).size,
    [records],
  );

  const addEquipment = (kind: SetupKind) => {
    if (runState === "running" || installed.includes(kind)) return;
    const expected = SETUP_ORDER[installed.length];
    if (kind !== expected) {
      const expectedName = EQUIPMENT.find((item) => item.kind === expected)?.shortName;
      setMessage(`Önce ${expectedName} parçasını yerleştir.`);
      return;
    }
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    if (nextInstalled.length === SETUP_ORDER.length) {
      setPhase("Kurulum");
      setMessage("Düzenek hazır. Bir bilye seçip manyetik yuvaya yerleştir.");
    } else {
      const upcoming = EQUIPMENT.find(
        (item) => item.kind === SETUP_ORDER[nextInstalled.length],
      )?.shortName;
      setMessage(`${upcoming} parçasını sahneye yerleştir.`);
    }
  };

  const setAlignedLength = (nextLength: number) => {
    const clamped = Math.min(
      MAX_PENDULUM_LENGTH,
      Math.max(MIN_PENDULUM_LENGTH, nextLength),
    );
    setLength(Math.round(clamped * 100) / 100);
    setCocked(false);
    setIndicatorZeroed(false);
    setDisplayAngle(0);
    setMaxAngle(0);
    setPhase("Kurulum");
  };

  const alignLengthToPointer = (clientY: number) => {
    const apparatus = apparatusRef.current;
    const dragStart = heightDragStartRef.current;
    if (!apparatus || !dragStart) return;
    const bounds = apparatus.getBoundingClientRect();
    const compact = bounds.width < 700;
    const minVisualLength = 135;
    const maxVisualLength = 135 + (MAX_PENDULUM_LENGTH - MIN_PENDULUM_LENGTH) * 250;
    const minAxis = compact
      ? 93 + minVisualLength * 0.637
      : 157 + minVisualLength * 0.885;
    const maxAxis = compact
      ? 93 + maxVisualLength * 0.637
      : 157 + maxVisualLength * 0.885;
    const startVisualLength =
      135 + (dragStart.length - MIN_PENDULUM_LENGTH) * 250;
    const startAxis = compact
      ? 93 + startVisualLength * 0.637
      : 157 + startVisualLength * 0.885;
    const pointerAxis = Math.min(
      maxAxis,
      Math.max(minAxis, startAxis + clientY - dragStart.pointerY),
    );
    const ratio = (pointerAxis - minAxis) / (maxAxis - minAxis);
    setAlignedLength(
      MIN_PENDULUM_LENGTH + ratio * (MAX_PENDULUM_LENGTH - MIN_PENDULUM_LENGTH),
    );
  };

  const onLauncherPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canAdjustHeight || event.button !== 0) return;
    event.preventDefault();
    heightPointerRef.current = event.pointerId;
    heightDragStartRef.current = { pointerY: event.clientY, length };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingHeight(true);
    setMessage("Namluyu yukarı–aşağı taşı; sarkaç boyu ve sensör aynı anda hizalanıyor.");
  };

  const onLauncherPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (heightPointerRef.current !== event.pointerId) return;
    alignLengthToPointer(event.clientY);
  };

  const finishLauncherHeight = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (heightPointerRef.current !== event.pointerId) return;
    heightPointerRef.current = null;
    heightDragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingHeight(false);
    setMessage("Namlu, sensör ve sarkaç yakalayıcısı aynı yatay eksende hizalandı.");
  };

  const onLauncherKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!canAdjustHeight || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? -0.01 : 0.01;
    const nextLength = Math.min(
      MAX_PENDULUM_LENGTH,
      Math.max(MIN_PENDULUM_LENGTH, length + direction),
    );
    setAlignedLength(nextLength);
    setMessage(
      `Namlu ve yakalayıcı birlikte ayarlandı. Sarkaç boyu ${Math.round(nextLength * 100)} cm.`,
    );
  };

  const onEquipmentDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    kind: SetupKind,
  ) => {
    event.dataTransfer.setData(MIME, kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData(MIME) as SetupKind;
    if (SETUP_ORDER.includes(kind)) addEquipment(kind);
  };

  const loadSelectedBall = () => {
    if (!setupComplete || runState === "running") return;
    setLoadedBall(selectedBall);
    setCentered(false);
    setCocked(false);
    setSensorDisplay("0,00");
    setDisplayAngle(0);
    setMaxAngle(0);
    setPhase("Kurulum");
    setProgress(0);
    setShowAnalysis(false);
    setRunState("ready");
    setMessage("Bilyeyi namlu ağzındaki yuvaya oturtmak için “Bilyeyi merkezle”ye bas.");
  };

  const centerBall = () => {
    if (!loadedBall || runState === "running") {
      setMessage("Önce bilyeyi manyetik yuvaya yerleştir.");
      return;
    }
    setCentered(true);
    setMessage("Bilye merkezde. Fırlatıcı kolunu kur ve göstergeyi sıfırla.");
  };

  const cockLauncher = () => {
    if (!centered || runState === "running") {
      setMessage("Fırlatıcıyı kurmadan önce bilyeyi merkezle.");
      return;
    }
    setCocked(true);
    setMessage(`${level}. kademe kuruldu. Açı göstergesini sıfırla.`);
  };

  const zeroIndicator = () => {
    if (!setupComplete || runState === "running") return;
    setIndicatorZeroed(true);
    setDisplayAngle(0);
    setMaxAngle(0);
    setMessage("Gösterge 0° konumunda. Ölçüm için tetik hazır.");
  };

  const prepareTrial = () => {
    if (!loadedBall) return null;
    const ball = BALLS.find((item) => item.kind === loadedBall)!;
    const sensorSpeed = ball.speeds[level - 1];
    const collisionSpeed = (ball.mass * sensorSpeed) / (ball.mass + pendulumMass);
    const cosine = Math.max(
      -1,
      Math.min(1, 1 - collisionSpeed ** 2 / (2 * G * length)),
    );
    const exactAngle = (Math.acos(cosine) * 180) / Math.PI;
    const measuredAngle = exactAngle;
    const rise = length * (1 - Math.cos((measuredAngle * Math.PI) / 180));
    const pendulumSpeed = Math.sqrt(2 * G * rise);
    const calculatedSpeed = sensorSpeed;

    return {
      id: nextIdRef.current,
      ball: ball.kind,
      ballName: ball.name,
      mass: ball.mass,
      level,
      pendulumMass,
      length,
      angle: measuredAngle,
      rise,
      sensorSpeed,
      pendulumSpeed,
      calculatedSpeed,
    } satisfies Trial;
  };

  const launch = () => {
    if (!setupComplete) {
      setMessage("Önce deney düzeneğini tamamla.");
      return;
    }
    if (!loadedBall) {
      setMessage("Fırlatıcıya bir bilye yerleştir.");
      return;
    }
    if (!centered) {
      setMessage("Bilye namlu ağzındaki yuvada merkezde değil. Önce bilyeyi merkezle.");
      return;
    }
    if (!cocked) {
      setMessage("Fırlatma kolunu seçtiğin kademeye kadar kur.");
      return;
    }
    if (!indicatorZeroed) {
      setMessage("Maksimum açıyı ölçmek için göstergeyi önce 0° konumuna getir.");
      return;
    }
    const trial = prepareTrial();
    if (!trial) return;
    pendingTrialRef.current = trial;
    nextIdRef.current += 1;
    setRunState("running");
    setPhase("Fırlatma");
    setProgress(0);
    setSensorDisplay("ölçüyor");
    setShowAnalysis(false);
    setMessage("Bilye hız sensöründen geçiyor.");
    runStartedAtRef.current = performance.now();
  };

  useEffect(() => {
    if (runState !== "running") return;
    const duration = 3100;
    const animate = (now: number) => {
      const elapsed = now - runStartedAtRef.current;
      const nextProgress = Math.min(elapsed / duration, 1);
      const trial = pendingTrialRef.current;
      setProgress(nextProgress);

      if (trial) {
        if (nextProgress < 0.24) {
          setPhase("Fırlatma");
        } else if (nextProgress < 0.34) {
          setPhase("Tam esnek olmayan çarpışma");
          setSensorDisplay(format(trial.sensorSpeed));
          setMessage("Bilye yakalayıcı blokta kalıyor; çarpışma evresi tamamlandı.");
        } else if (nextProgress < 0.82) {
          setPhase("Sarkaç yükseliyor");
          const swingProgress = (nextProgress - 0.34) / 0.48;
          const angle = trial.angle * Math.sin((Math.PI / 2) * swingProgress);
          setDisplayAngle(angle);
          setMaxAngle((current) => Math.max(current, angle));
          setMessage("Sarkaç yükselirken gösterge çubuğu en büyük açıyı tutuyor.");
        } else {
          const returnProgress = (nextProgress - 0.82) / 0.18;
          setDisplayAngle(trial.angle * (1 - returnProgress * 0.25));
          setMaxAngle(trial.angle);
        }
      }

      if (nextProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else if (trial) {
        setRunState("complete");
        setPhase("Ölçüm tamam");
        setDisplayAngle(trial.angle * 0.75);
        setMaxAngle(trial.angle);
        setRecords((current) => [...current, trial]);
        setCocked(false);
        setIndicatorZeroed(false);
        setMessage(
          `${trial.angle.toFixed(1)}° okundu. Sensör ile sarkaç sonucunu karşılaştır.`,
        );
      }
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [runState]);

  const resetApparatus = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    pendingTrialRef.current = null;
    setInstalled([]);
    setLoadedBall(null);
    setCentered(false);
    setCocked(false);
    setIndicatorZeroed(false);
    setRunState("ready");
    setPhase("Kurulum");
    setProgress(0);
    setDisplayAngle(0);
    setMaxAngle(0);
    setSensorDisplay("—");
    setShowAnalysis(false);
    setMessage("İlk parçayı seçip sahneye yerleştir.");
  };

  const resetForNextShot = () => {
    pendingTrialRef.current = null;
    setLoadedBall(null);
    setCentered(false);
    setCocked(false);
    setIndicatorZeroed(false);
    setRunState("ready");
    setPhase("Kurulum");
    setProgress(0);
    setDisplayAngle(0);
    setMaxAngle(0);
    setSensorDisplay("0,00");
    setShowAnalysis(false);
    setMessage("Yeni ölçüm için bilye ve fırlatma kademesini seç.");
  };

  const projectileVisible = runState === "running" && progress < 0.34;
  const projectileTravel = progress < 0.24 ? progress / 0.24 : 1;
  const pendulumVisualLength = Math.round(135 + (length - 0.25) * 250);
  const launchAxis = Math.round(157 + pendulumVisualLength * 0.885);
  const compactLaunchAxis = Math.round(93 + pendulumVisualLength * 0.637);
  const apparatusStyle = {
    "--pendulum-length": `${pendulumVisualLength}px`,
    "--launch-axis": `${launchAxis}px`,
    "--launch-axis-compact": `${compactLaunchAxis}px`,
  } as CSSProperties;
  const pendulumStyle = {
    "--pendulum-angle": `${-displayAngle}deg`,
  } as CSSProperties;
  const indicatorStyle = {
    "--indicator-angle": `${-maxAngle}deg`,
  } as CSSProperties;
  const apparatusReadyForShot =
    setupComplete && loadedBall && centered && cocked && indicatorZeroed;

  return (
    <section className="ballistic-lab-section" id="balistik-sarkac">
      <div className="ballistic-heading">
        <div>
          <span>MODÜL 05 · DENEY 5</span>
          <h2>Balistik sarkaç</h2>
          <p>
            Düzeneği kur, hız sensöründen veri topla ve bilyenin ilk hızını
            sarkacın ulaştığı en büyük açıyla karşılaştır.
          </p>
        </div>
        <aside>
          <b>TYMM 12. SINIF</b>
          <span>FİZ.12.1.4 · FİZ.12.2.5</span>
          <small>veri toplama · tahmin · bilimsel çıkarım</small>
        </aside>
      </div>

      <div className="ballistic-learning-strip">
        <span>
          <b>1</b> Düzeneği kur
        </span>
        <span>
          <b>2</b> Bilyeyi merkezle
        </span>
        <span>
          <b>3</b> Fırlat ve ölç
        </span>
        <span>
          <b>4</b> Kanıtla yorumla
        </span>
      </div>

      <section className="ballistic-equipment-panel">
        <div className="ballistic-panel-heading">
          <div>
            <small>DENEY MALZEMELERİ</small>
            <h3>Parçaları sırayla sahneye taşı</h3>
          </div>
          <span>
            {installed.length}/{SETUP_ORDER.length} parça
          </span>
        </div>
        <div className="ballistic-equipment-list">
          {EQUIPMENT.map((item) => {
            const isInstalled = installed.includes(item.kind);
            const isNext = nextSetup === item.kind;
            return (
              <button
                key={item.kind}
                type="button"
                draggable={!isInstalled && runState !== "running"}
                className={`${isInstalled ? "installed" : ""} ${isNext ? "next" : ""}`}
                onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                onClick={() => addEquipment(item.kind)}
                disabled={isInstalled || runState === "running"}
              >
                <EquipmentIcon kind={item.kind} />
                <span>
                  <b>{item.shortName}</b>
                  <small>{isInstalled ? "Yerleştirildi" : isNext ? "Sıradaki parça" : item.name}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div
        className={`ballistic-stage ${setupComplete ? "setup-complete" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onStageDrop}
      >
        <div className="ballistic-stage-toolbar">
          <div>
            <small>DENEY SAHNESİ</small>
            <b>{phase}</b>
          </div>
          <div className="ballistic-live-readouts">
            <span>
              <small>Hız sensörü</small>
              <b>{sensorDisplay} {sensorDisplay !== "—" && sensorDisplay !== "ölçüyor" ? "m/s" : ""}</b>
            </span>
            <span>
              <small>Maksimum açı</small>
              <b>{format(maxAngle, 1)}°</b>
            </span>
            <button type="button" onClick={resetApparatus} disabled={runState === "running"}>
              Düzeneği sök
            </button>
          </div>
        </div>

        <div
          ref={apparatusRef}
          className={`ballistic-apparatus ${draggingHeight ? "height-adjusting" : ""}`}
          style={apparatusStyle}
        >
          <div className="ballistic-lab-wall">
            <span>Spektrum · Mekanik Laboratuvarı</span>
          </div>
          <div className="ballistic-workbench">
            <i className="ballistic-bench-top" />
            <i className="ballistic-bench-leg leg-left" />
            <i className="ballistic-bench-leg leg-right" />
            <i className="ballistic-bench-brace" />
          </div>

          {installed.includes("frame") && (
            <div className="ballistic-frame">
              <img
                className="ballistic-frame-photo"
                src="./ballistic-frame-protractor-v2.webp"
                alt=""
                aria-hidden="true"
              />
              {!installed.includes("protractor") && (
                <span className="ballistic-frame-protractor-cover" aria-hidden="true" />
              )}
              <i className="frame-backboard" />
              <i className="frame-top" />
              <i className="frame-left" />
              <i className="frame-right" />
              <i className="frame-base" />
              <span className="frame-brand">PHY · BALLISTIC PENDULUM</span>
            </div>
          )}

          {installed.includes("launcher") && (
            <div
              className={`ballistic-launcher ${cocked ? "cocked" : ""} ${
                canAdjustHeight ? "height-draggable" : ""
              } ${draggingHeight ? "dragging" : ""}`}
              role={canAdjustHeight ? "slider" : undefined}
              aria-label={canAdjustHeight ? "Namlu yüksekliği ve sarkaç boyu" : undefined}
              aria-valuemin={canAdjustHeight ? 25 : undefined}
              aria-valuemax={canAdjustHeight ? 42 : undefined}
              aria-valuenow={canAdjustHeight ? Math.round(length * 100) : undefined}
              aria-valuetext={canAdjustHeight ? `${Math.round(length * 100)} santimetre` : undefined}
              aria-orientation={canAdjustHeight ? "vertical" : undefined}
              tabIndex={canAdjustHeight ? 0 : -1}
              onPointerDown={onLauncherPointerDown}
              onPointerMove={onLauncherPointerMove}
              onPointerUp={finishLauncherHeight}
              onPointerCancel={finishLauncherHeight}
              onKeyDown={onLauncherKeyDown}
            >
              <img
                className="ballistic-launcher-photo"
                src="./twod-launcher-barrel-v2.webp"
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <i className="launcher-body" />
              <i className="launcher-barrel" />
              <i className="launcher-muzzle" />
              <i className="launcher-cocking-rod" />
              <i className="launcher-handle" />
              <i className="launcher-trigger" />
              <span>{level}</span>
              {canAdjustHeight && (
                <div className="ballistic-height-grip" aria-hidden="true">
                  <b>↕</b>
                  <small>{Math.round(length * 100)} cm</small>
                </div>
              )}
              {loadedBall && (runState === "ready" || progress < 0.05) && (
                <i
                  className={`launcher-ball ball-${loadedBall} ${centered ? "centered" : ""}`}
                />
              )}
            </div>
          )}

          {installed.includes("frame") && installed.includes("launcher") && (
            <span className="ballistic-launcher-mount" aria-hidden="true">
              <i />
              <i />
            </span>
          )}

          {installed.includes("speed-sensor") && (
            <>
              <div className={`ballistic-speed-sensor ${runState === "running" ? "active" : ""}`}>
                <img
                  className="ballistic-sensor-console-photo"
                  src="./twod-speed-sensor-v2.webp"
                  alt=""
                  aria-hidden="true"
                />
                <i className="sensor-post" />
                <i className="sensor-gate" />
                <span>{sensorDisplay}</span>
                <small>m/s</small>
              </div>
              <span className="ballistic-sensor-cable" aria-hidden="true">
                <i />
                <i />
              </span>
            </>
          )}

          {projectileVisible && loadedBall && (
            <span className="ballistic-projectile-path" aria-hidden="true">
              <i
                className={`ballistic-projectile ball-${loadedBall}`}
                style={{ left: `${projectileTravel * 100}%` }}
              />
            </span>
          )}

          {installed.includes("protractor") && (
            <div className="ballistic-protractor">
              <i className="protractor-face" />
              {[0, 15, 30, 45, 60, 75, 90].map((mark) => (
                <span
                  key={mark}
                  style={{ "--mark-angle": `${mark}deg` } as CSSProperties}
                >
                  {mark}
                </span>
              ))}
              <b>°</b>
            </div>
          )}

          {installed.includes("pendulum") && (
            <>
              <div className="ballistic-pivot">
                <i />
                <b />
              </div>
              <div className="ballistic-pendulum" style={pendulumStyle}>
                <img
                  className="ballistic-pendulum-photo"
                  src="./ballistic-pendulum-assembly-v2.webp"
                  alt=""
                  aria-hidden="true"
                />
                <i className="pendulum-rod" />
                <i className="pendulum-added-mass">
                  {addedMass > 0 ? `+${Math.round(addedMass * 1000)} g` : ""}
                </i>
                <i className="pendulum-catcher">
                  <span
                    className={
                      loadedBall &&
                      ((runState === "running" && progress >= 0.24) ||
                        runState === "complete")
                        ? `captured ball-${loadedBall}`
                        : ""
                    }
                  />
                </i>
              </div>
              <div className="ballistic-return-spring" />
            </>
          )}

          {installed.includes("indicator") && (
            <div className="ballistic-indicator" style={indicatorStyle}>
              <i />
              <span>{indicatorZeroed ? "0" : format(maxAngle, 1)}°</span>
            </div>
          )}

          {installed.includes("ball-rack") && (
            <div className="ballistic-ball-rack">
              <b>BİLYELER</b>
              <i className="rack-ball ball-small-steel" />
              <i className="rack-ball ball-large-steel" />
              <i className="rack-ball ball-wood" />
            </div>
          )}

          {installed.includes("ruler") && (
            <div className="ballistic-ruler" style={pendulumStyle}>
              <img
                className="ballistic-ruler-photo"
                src="./freefall-equipment-ruler.webp"
                alt=""
                aria-hidden="true"
              />
              <i />
              <span>l = {Math.round(length * 100)} cm</span>
            </div>
          )}

          {installed.includes("launcher") && installed.includes("pendulum") && (
            <BallisticMotionOverlay
              phase={phase}
              progress={progress}
              displayAngle={displayAngle}
              maxAngle={maxAngle}
              launchAxis={launchAxis}
              compactLaunchAxis={compactLaunchAxis}
            />
          )}

          {!setupComplete && (
            <div className="ballistic-drop-guide">
              <EquipmentIcon kind={nextSetup ?? "frame"} />
              <b>
                {EQUIPMENT.find((item) => item.kind === nextSetup)?.shortName ??
                  "Kurulum tamam"}
              </b>
              <span>buraya sürükle veya malzemeye dokun</span>
            </div>
          )}
        </div>

        <div className={`ballistic-status ${apparatusReadyForShot ? "ready" : ""}`} aria-live="polite">
          <b>{apparatusReadyForShot ? "TETİK HAZIR" : "YÖNERGE"}</b>
          <span>{message}</span>
        </div>
      </div>

      <section className="ballistic-controls">
        <div className="ballistic-control-card">
          <small>1 · BİLYE VE FIRLATICI</small>
          <div className="ballistic-ball-options">
            {BALLS.map((ball) => (
              <button
                key={ball.kind}
                type="button"
                className={selectedBall === ball.kind ? "active" : ""}
                onClick={() => setSelectedBall(ball.kind)}
                disabled={!setupComplete || runState === "running"}
              >
                <i className={`ball-${ball.kind}`} />
                <span>
                  <b>{ball.shortName}</b>
                  <small>{Math.round(ball.mass * 1000)} g</small>
                </span>
              </button>
            ))}
          </div>
          <div className="ballistic-levels">
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                type="button"
                className={level === value ? "active" : ""}
                onClick={() => {
                  setLevel(value);
                  setCocked(false);
                }}
                disabled={!setupComplete || runState === "running"}
              >
                {value}. kademe
              </button>
            ))}
          </div>
          <button
            className="ballistic-primary-action"
            type="button"
            onClick={loadSelectedBall}
            disabled={!setupComplete || runState === "running"}
          >
            Bilyeyi manyetik yuvaya koy
          </button>
          <button type="button" onClick={centerBall} disabled={!loadedBall || runState === "running"}>
            Bilyeyi merkezle
          </button>
        </div>

        <div className="ballistic-control-card">
          <small>2 · SARKAÇ AYARI</small>
          <label>
            <span>
              Sarkaç boyu <b>{Math.round(length * 100)} cm</b>
            </span>
            <input
              type="range"
              min={MIN_PENDULUM_LENGTH}
              max={MAX_PENDULUM_LENGTH}
              step="0.01"
              value={length}
              onChange={(event) => setAlignedLength(Number(event.target.value))}
              disabled={runState === "running"}
            />
          </label>
          <small className="ballistic-auto-alignment">
            Namluyu sahnede yukarı–aşağı sürükle. Sarkaç boyu, sensör ve yakalayıcı
            merkezi aynı anda hizalanır.
          </small>
          <label>
            <span>
              Yakalayıcı blok <b>{Math.round(pendulumMass * 1000)} g</b>
            </span>
            <select
              value={addedMass}
              onChange={(event) => setAddedMass(Number(event.target.value))}
              disabled={runState === "running"}
            >
              <option value="0">Ek kütle yok</option>
              <option value="0.05">+50 g yarıklı kütle</option>
              <option value="0.1">+100 g yarıklı kütle</option>
            </select>
          </label>
          <button type="button" onClick={cockLauncher} disabled={!centered || runState === "running"}>
            Fırlatıcıyı {level}. kademeye kur
          </button>
          <button type="button" onClick={zeroIndicator} disabled={!setupComplete || runState === "running"}>
            Göstergeyi 0° konumuna getir
          </button>
        </div>

        <div className="ballistic-control-card ballistic-launch-card">
          <small>3 · ÖLÇÜM</small>
          <div className="ballistic-phase-model">
            <span className={phase === "Tam esnek olmayan çarpışma" ? "active" : ""}>
              <b>Çarpışma</b>
              <small>Momentum incelenir</small>
            </span>
            <i>→</i>
            <span className={phase === "Sarkaç yükseliyor" ? "active" : ""}>
              <b>Yükselme</b>
              <small>Mekanik enerji incelenir</small>
            </span>
          </div>
          <button
            className="ballistic-trigger"
            type="button"
            onClick={launch}
            disabled={runState === "running"}
          >
            {runState === "running" ? "ÖLÇÜM SÜRÜYOR" : "TETİĞİ ÇEK VE FIRLAT"}
          </button>
          {runState === "complete" && (
            <button type="button" onClick={resetForNextShot}>
              Yeni ölçüm hazırla
            </button>
          )}
          <div className="ballistic-shot-progress">
            <i style={{ width: `${progress * 100}%` }} />
          </div>
          <small className="ballistic-resolution-note">
            İdeal sistemde sensör ve sarkaç modeli aynı ilk hız değerini verir.
          </small>
        </div>
      </section>

      <section className="ballistic-data-section">
        <div className="ballistic-data-heading">
          <div>
            <small>DENEY GÜNLÜĞÜ</small>
            <h3>Üç bilye × üç kademe</h3>
            <p>
              Temel seri için ek kütle kullanmadan dokuz farklı ölçümü tamamla.
            </p>
          </div>
          <span className={uniqueCoreTrials === 9 ? "complete" : ""}>
            <b>{uniqueCoreTrials}/9</b>
            temel ölçüm
          </span>
        </div>
        <div className="ballistic-table-wrap">
          <table className="ballistic-data-table">
            <thead>
              <tr>
                <th>Deneme</th>
                <th>Bilye / kütle</th>
                <th>Kademe</th>
                <th>Sarkaç M</th>
                <th>l</th>
                <th>φ</th>
                <th>Δh</th>
                <th>Sensör hızı</th>
                <th>Sarkaçtan hız</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={9}>İlk ölçümden sonra veriler burada görünecek.</td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>
                      {record.ballName}
                      <small>{Math.round(record.mass * 1000)} g</small>
                    </td>
                    <td>{record.level}</td>
                    <td>{Math.round(record.pendulumMass * 1000)} g</td>
                    <td>{Math.round(record.length * 100)} cm</td>
                    <td>{format(record.angle, 2)}°</td>
                    <td>{format(record.rise * 100, 2)} cm</td>
                    <td>{format(record.sensorSpeed)} m/s</td>
                    <td>{format(record.calculatedSpeed)} m/s</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {latest && (
        <section className="ballistic-analysis-prompt">
          <div>
            <small>ÖLÇÜM TAMAMLANDI</small>
            <h3>Sonucu üç sade aşamada incele</h3>
            <p>
              Ölçülen açının bilyenin ilk hızına nasıl ulaştırdığını, düzenekteki
              hareket sırasıyla gör.
            </p>
          </div>
          <button type="button" onClick={() => setShowAnalysis((current) => !current)}>
            {showAnalysis ? "Sade analizi kapat" : "Sade analizi göster"} →
          </button>
        </section>
      )}

      {latest && showAnalysis && (
        <section className="ballistic-analysis">
          <div className="ballistic-analysis-heading">
            <div>
              <small>SON DENEME · HAREKETİN İZİ</small>
              <h3>Açıdan ilk hıza</h3>
            </div>
            <span>
              {latest.ballName} · {latest.level}. kademe
            </span>
          </div>
          <div className="ballistic-analysis-grid">
            <article>
              <b>1 · Açı → yükselme</b>
              <span className="ballistic-analysis-value">{format(latest.angle, 1)}°</span>
              <p>Sarkaç {format(latest.rise * 100, 2)} cm yükseldi.</p>
              <small>Açıölçerde kalan gösterge, yakalayıcının ulaştığı en yüksek konumu verir.</small>
            </article>
            <article>
              <b>2 · Yükselme → birlikte hız</b>
              <span className="ballistic-analysis-value">{format(latest.pendulumSpeed, 3)} m/s</span>
              <p>Bilye ve yakalayıcı çarpışmadan sonra birlikte hareket etti.</p>
              <small>Bu aşamada yükselme boyunca mekanik enerji korunur.</small>
            </article>
            <article>
              <b>3 · Momentum → ilk hız</b>
              <span className="ballistic-analysis-value">{format(latest.calculatedSpeed, 2)} m/s</span>
              <p>Bilyenin çarpışmadan hemen önceki hızı bulundu.</p>
              <small>Çarpışma anında bilye–sarkaç sisteminin doğrusal momentumu korunur.</small>
            </article>
          </div>
          <div className="ballistic-analysis-conclusion">
            <span>
              <small>Sensör ölçümü</small>
              <b>{format(latest.sensorSpeed)} m/s</b>
            </span>
            <span>
              <small>Sarkaçtan bulunan</small>
              <b>{format(latest.calculatedSpeed)} m/s</b>
            </span>
            <p>
              Bilye yakalayıcıda kaldığı için çarpışma tam esnek olmayandır.
              Çarpışma evresinde momentum, yükselme evresinde ise mekanik enerji
              ayrı ayrı incelenir.
            </p>
          </div>
        </section>
      )}

      <section className="ballistic-graphs">
        <MiniGraph title="Hız arttıkça açı nasıl değişiyor?" records={records} kind="angle" />
        <MiniGraph title="Sensör ve sarkaçtan bulunan hız" records={records} kind="speed" />
        <div className="ballistic-graph-legend">
          {BALLS.map((ball, index) => (
            <span key={ball.kind}>
              <i className={`ball-${index + 1}`} />
              {ball.shortName}
            </span>
          ))}
        </div>
      </section>

      <section className="ballistic-report">
        <div className="ballistic-report-heading">
          <div>
            <small>KISA DENEY RAPORU</small>
            <h3>Sonucunu veriye dayalı savun</h3>
          </div>
          <span>Formül tekrarı değil; ölçüm, karşılaştırma ve gerekçe beklenir.</span>
        </div>
        <div className="ballistic-report-grid">
          <label>
            <span>En az üç ölçümü karşılaştır. Sensör ve sarkaç neden aynı ilk hız değerini verir?</span>
            <textarea
              rows={4}
              value={report.evidence}
              onChange={(event) => setReport({ ...report, evidence: event.target.value })}
            />
          </label>
          <label>
            <span>Çarpışma ve yükselme evrelerinde hangi büyüklüklerin korunmasını bekledin?</span>
            <textarea
              rows={4}
              value={report.conservation}
              onChange={(event) => setReport({ ...report, conservation: event.target.value })}
            />
          </label>
          <label>
            <span>Bilye kütlesi, fırlatma kademesi ve maksimum açı arasında nasıl bir ilişki gözledin?</span>
            <textarea
              rows={4}
              value={report.relation}
              onChange={(event) => setReport({ ...report, relation: event.target.value })}
            />
          </label>
          <label>
            <span>Bilyeyi merkezlemek ve göstergeyi sıfırlamak deneyin başlangıç koşullarını nasıl belirler?</span>
            <textarea
              rows={4}
              value={report.method}
              onChange={(event) => setReport({ ...report, method: event.target.value })}
            />
          </label>
          <label className="wide">
            <span>Sonuç: Balistik sarkaç, bilyenin ilk hızını belirlemek için nasıl kanıt sağlar?</span>
            <textarea
              rows={5}
              value={report.conclusion}
              onChange={(event) => setReport({ ...report, conclusion: event.target.value })}
            />
          </label>
        </div>
      </section>
    </section>
  );
}
