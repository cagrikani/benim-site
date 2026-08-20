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
  | "launcher"
  | "protractor"
  | "sensor"
  | "table"
  | "paper"
  | "ruler"
  | "ball";
type ProjectileState = "ready" | "flying" | "landed";
type GraphKind = "range" | "height";
type ShotRecord = {
  angle: number;
  level: number;
  speed: number;
  measuredRange: number;
  maxHeight: number;
  flightTime: number;
};
type Trajectory = {
  angle: number;
  speed: number;
  vx: number;
  vy0: number;
  range: number;
  maxHeight: number;
  flightTime: number;
};

const ANGLES = [15, 30, 45, 60, 75] as const;
const SPEEDS: Record<number, number> = { 1: 2.35, 2: 2.85, 3: 3.35 };
const LAUNCH_PIVOT = { x: 20.5, y: 53 };
const MUZZLE_RADIUS = 11;
const TRAJECTORY_X_SCALE = 43;
const SETUP_ORDER: SetupKind[] = [
  "launcher",
  "protractor",
  "sensor",
  "table",
  "paper",
  "ruler",
  "ball",
];
const EQUIPMENT: Array<{
  kind: SetupKind;
  name: string;
  shortName: string;
}> = [
  { kind: "launcher", name: "Fırlatıcı ünitesi ve taban", shortName: "Fırlatıcı" },
  { kind: "protractor", name: "Açı göstergesi", shortName: "Açı göstergesi" },
  { kind: "sensor", name: "İlk hız sensörü", shortName: "Hız sensörü" },
  { kind: "table", name: "Aynı seviyedeki iniş masası", shortName: "İniş masası" },
  { kind: "paper", name: "Karbonlu iz kâğıdı", shortName: "İz kâğıdı" },
  { kind: "ruler", name: "Bir metre cetvel", shortName: "Cetvel" },
  { kind: "ball", name: "19 mm çelik bilye", shortName: "Çelik bilye" },
];
const EQUIPMENT_PHOTOS: Partial<Record<SetupKind, string>> = {
  launcher: "./twod-launcher-frame-v2.webp",
  protractor: "./twod-launcher-frame-v2.webp",
  sensor: "./twod-speed-sensor-v2.webp",
  table: "./twod-landing-table-v2.webp",
  ruler: "./freefall-equipment-ruler.webp",
};

function launcherMuzzleForAngle(angle: number, stageAspect: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    left: LAUNCH_PIVOT.x + Math.cos(radians) * MUZZLE_RADIUS,
    top: LAUNCH_PIVOT.y - Math.sin(radians) * MUZZLE_RADIUS * stageAspect,
  };
}

function recordKey(angle: number, level: number) {
  return `${angle}-${level}`;
}

function EquipmentIcon({ kind }: { kind: SetupKind }) {
  const photo = EQUIPMENT_PHOTOS[kind];
  return (
    <span
      className={`twod-equipment-icon twod-icon-${kind}${photo ? " has-photo" : ""}`}
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

function TwoDimensionalGraph({
  kind,
  records,
}: {
  kind: GraphKind;
  records: Record<string, ShotRecord>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.getBoundingClientRect().width, 280);
    const height = 270;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fbfdfc";
    context.fillRect(0, 0, width, height);

    const margin = { top: 18, right: 18, bottom: 39, left: 48 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const values = Object.values(records);
    const yValue = (record: ShotRecord) =>
      kind === "range" ? record.measuredRange : record.maxHeight;
    const yMax = Math.max(
      kind === "range" ? 1.3 : 0.6,
      ...values.map((record) => yValue(record) * 1.12),
    );
    const pointX = (angle: number) =>
      margin.left + ((angle - 15) / 60) * plotWidth;
    const pointY = (value: number) =>
      margin.top + plotHeight - (value / yMax) * plotHeight;

    context.font = "700 10px Arial";
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let index = 0; index <= 4; index += 1) {
      const value = (yMax / 4) * index;
      const y = pointY(value);
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(width - margin.right, y);
      context.strokeStyle = "#dce8e5";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = "#6d8387";
      context.fillText(value.toFixed(2), margin.left - 8, y);
    }

    context.textAlign = "center";
    context.textBaseline = "top";
    ANGLES.forEach((angle) => {
      const x = pointX(angle);
      context.beginPath();
      context.moveTo(x, margin.top);
      context.lineTo(x, margin.top + plotHeight);
      context.strokeStyle = "#edf3f1";
      context.stroke();
      context.fillStyle = "#6d8387";
      context.fillText(`${angle}°`, x, margin.top + plotHeight + 8);
    });

    context.beginPath();
    context.moveTo(margin.left, margin.top);
    context.lineTo(margin.left, margin.top + plotHeight);
    context.lineTo(width - margin.right, margin.top + plotHeight);
    context.strokeStyle = "#718b8f";
    context.lineWidth = 1.5;
    context.stroke();

    const colors: Record<number, string> = {
      1: "#ef9f28",
      2: "#167f75",
      3: "#9b6b92",
    };
    [1, 2, 3].forEach((level) => {
      const series = ANGLES.flatMap((angle) => {
        const record = records[recordKey(angle, level)];
        return record ? [{ angle, value: yValue(record) }] : [];
      });
      if (series.length > 1) {
        context.beginPath();
        series.forEach((point, index) => {
          const x = pointX(point.angle);
          const y = pointY(point.value);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.strokeStyle = colors[level];
        context.lineWidth = 2.5;
        context.stroke();
      }
      series.forEach((point) => {
        context.beginPath();
        context.arc(pointX(point.angle), pointY(point.value), 4.5, 0, Math.PI * 2);
        context.fillStyle = colors[level];
        context.fill();
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.stroke();
      });
    });

    context.save();
    context.translate(13, margin.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillStyle = "#38575d";
    context.font = "800 10px Arial";
    context.textAlign = "center";
    context.fillText(
      kind === "range" ? "Menzil R (m)" : "Maksimum yükseklik h (m)",
      0,
      0,
    );
    context.restore();

    context.fillStyle = "#38575d";
    context.font = "800 10px Arial";
    context.textAlign = "center";
    context.fillText(
      "Fırlatma doğrultusu (°)",
      margin.left + plotWidth / 2,
      height - 14,
    );
  }, [kind, records]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return (
    <article className="twod-graph">
      <div className="twod-graph-heading">
        <b>{kind === "range" ? "Doğrultu – menzil" : "Doğrultu – maksimum yükseklik"}</b>
        <span>
          <i className="twod-legend-one" /> Kademe 1
          <i className="twod-legend-two" /> Kademe 2
          <i className="twod-legend-three" /> Kademe 3
        </span>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={
          kind === "range"
            ? "Üç hız kademesi için doğrultu menzil grafiği"
            : "Üç hız kademesi için doğrultu maksimum yükseklik grafiği"
        }
      />
    </article>
  );
}

function MeasurementTable({
  records,
}: {
  records: Record<string, ShotRecord>;
}) {
  const rows: Array<{
    label: string;
    value: (record: ShotRecord) => number;
  }> = [
    { label: "v₁ (m/s)", value: (record) => record.speed },
    { label: "v₂ (m/s)", value: (record) => record.speed },
    { label: "v₃ (m/s)", value: (record) => record.speed },
    { label: "R₁ (m)", value: (record) => record.measuredRange },
    { label: "R₂ (m)", value: (record) => record.measuredRange },
    { label: "R₃ (m)", value: (record) => record.measuredRange },
    { label: "h₁ (m)", value: (record) => record.maxHeight },
    { label: "h₂ (m)", value: (record) => record.maxHeight },
    { label: "h₃ (m)", value: (record) => record.maxHeight },
  ];

  return (
    <div className="twod-table-wrap">
      <table className="twod-measurement-table">
        <thead>
          <tr>
            <th>Ölçüm</th>
            {ANGLES.map((angle) => (
              <th key={angle}>{angle}°</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const level = (index % 3) + 1;
            return (
              <tr key={row.label}>
                <th>{row.label}</th>
                {ANGLES.map((angle) => {
                  const record = records[recordKey(angle, level)];
                  return (
                    <td key={angle}>
                      {record ? row.value(record).toFixed(2) : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TwoDimensionalMotionLab() {
  const apparatusRef = useRef<HTMLDivElement>(null);
  const draggingAngleRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const [installed, setInstalled] = useState<SetupKind[]>([]);
  const [angle, setAngle] = useState<number>(45);
  const [speedLevel, setSpeedLevel] = useState<number>(1);
  const [sensorReady, setSensorReady] = useState(false);
  const [projectileState, setProjectileState] =
    useState<ProjectileState>("ready");
  const [records, setRecords] = useState<Record<string, ShotRecord>>({});
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [flightElapsed, setFlightElapsed] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [stageAspect, setStageAspect] = useState(1.5);
  const [notice, setNotice] = useState(
    "İlk olarak fırlatıcı ünitesini deney alanına yerleştir.",
  );

  const setupReady = SETUP_ORDER.every((kind) => installed.includes(kind));
  const nextSetupKind = SETUP_ORDER.find((kind) => !installed.includes(kind));
  const currentRecord = records[recordKey(angle, speedLevel)];
  const recordCount = Object.keys(records).length;

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const apparatus = apparatusRef.current;
    if (!apparatus) return;
    const updateAspect = () => {
      const rect = apparatus.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageAspect(rect.width / rect.height);
      }
    };
    updateAspect();
    const observer = new ResizeObserver(updateAspect);
    observer.observe(apparatus);
    return () => observer.disconnect();
  }, []);

  const resetProjectile = (message?: string) => {
    if (projectileState === "flying") return;
    setProjectileState("ready");
    setSensorReady(false);
    setFlightElapsed(0);
    setTrajectory(null);
    setPosition({ x: 0, y: 0 });
    setVelocity({ x: 0, y: 0 });
    if (message) setNotice(message);
  };

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
    const next = SETUP_ORDER.find((item) => !nextInstalled.includes(item));
    if (next) {
      const nextName = EQUIPMENT.find((item) => item.kind === next)?.shortName;
      setNotice(`${nextName} deney alanına yerleştirilebilir.`);
    } else {
      setNotice("Düzenek hazır. Doğrultuyu ve hız kademesini ayarla.");
    }
  };

  const onDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    kind: SetupKind,
  ) => {
    event.dataTransfer.setData("application/x-twod-equipment", kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData(
      "application/x-twod-equipment",
    ) as SetupKind;
    if (SETUP_ORDER.includes(kind)) installEquipment(kind);
  };

  const updateAngleFromPointer = (clientX: number, clientY: number) => {
    const apparatus = apparatusRef.current;
    if (!apparatus || projectileState === "flying") return;
    const rect = apparatus.getBoundingClientRect();
    const pivotX = rect.left + rect.width * 0.205;
    const pivotY = rect.top + rect.height * (LAUNCH_PIVOT.y / 100);
    const dx = clientX - pivotX;
    const dy = pivotY - clientY;
    const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const snapped = ANGLES.reduce((closest, option) =>
      Math.abs(option - rawAngle) < Math.abs(closest - rawAngle)
        ? option
        : closest,
    );
    setAngle(snapped);
    resetProjectile(`Fırlatma doğrultusu ${snapped}° olarak ayarlandı.`);
  };

  const startAngleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setupReady || projectileState === "flying") return;
    draggingAngleRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveAngleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingAngleRef.current) return;
    updateAngleFromPointer(event.clientX, event.clientY);
  };

  const stopAngleDrag = () => {
    draggingAngleRef.current = false;
  };

  const chooseSpeedLevel = (level: number) => {
    if (projectileState === "flying") return;
    setSpeedLevel(level);
    resetProjectile(`Hız kademesi ${level} olarak ayarlandı.`);
  };

  const resetSensor = () => {
    if (!setupReady || projectileState === "flying") return;
    setSensorReady(true);
    setProjectileState("ready");
    setFlightElapsed(0);
    setTrajectory(null);
    setPosition({ x: 0, y: 0 });
    setVelocity({ x: 0, y: 0 });
    setNotice("Hız sensörü sıfırlandı. Pim çekilerek bilye fırlatılabilir.");
  };

  const launch = () => {
    if (!setupReady || !sensorReady || projectileState === "flying") return;
    const measuredSpeed = SPEEDS[speedLevel];
    const radians = (angle * Math.PI) / 180;
    const vx = measuredSpeed * Math.cos(radians);
    const vy0 = measuredSpeed * Math.sin(radians);
    const flightTime = (2 * vy0) / 9.81;
    const measuredRange = vx * flightTime;
    const maxHeight = (vy0 * vy0) / (2 * 9.81);
    const nextTrajectory = {
      angle,
      speed: measuredSpeed,
      vx,
      vy0,
      range: measuredRange,
      maxHeight,
      flightTime,
    };
    const animationDuration = Math.max(900, flightTime * 1800);
    const animationStart = performance.now();
    setTrajectory(nextTrajectory);
    setSensorReady(false);
    setProjectileState("flying");
    setFlightElapsed(0);
    setPosition({ x: 0, y: 0 });
    setVelocity({ x: vx, y: vy0 });
    setNotice("Bilye iki boyutta hareket ediyor; bileşenler canlı izleniyor.");

    const tick = (now: number) => {
      const progress = Math.min((now - animationStart) / animationDuration, 1);
      const physicalTime = progress * flightTime;
      const x = vx * physicalTime;
      const y = Math.max(0, vy0 * physicalTime - 0.5 * 9.81 * physicalTime ** 2);
      setFlightElapsed(physicalTime);
      setPosition({ x, y });
      setVelocity({ x: vx, y: vy0 - 9.81 * physicalTime });
      if (progress >= 1) {
        const nextRecord: ShotRecord = {
          angle,
          level: speedLevel,
          speed: measuredSpeed,
          measuredRange,
          maxHeight,
          flightTime,
        };
        setRecords((current) => ({
          ...current,
          [recordKey(angle, speedLevel)]: nextRecord,
        }));
        setProjectileState("landed");
        setPosition({ x: measuredRange, y: 0 });
        setVelocity({ x: vx, y: -vy0 });
        setNotice(
          `${angle}° ve ${speedLevel}. kademe için ${measuredRange.toFixed(2)} m menzil kaydedildi.`,
        );
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const clearExperiment = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setInstalled([]);
    setAngle(45);
    setSpeedLevel(1);
    setSensorReady(false);
    setProjectileState("ready");
    setRecords({});
    setTrajectory(null);
    setFlightElapsed(0);
    setPosition({ x: 0, y: 0 });
    setVelocity({ x: 0, y: 0 });
    setNotice("İlk olarak fırlatıcı ünitesini deney alanına yerleştir.");
  };

  const ballPosition = useMemo(() => {
    const muzzle = launcherMuzzleForAngle(angle, stageAspect);
    if (projectileState === "ready" || !trajectory) {
      return muzzle;
    }
    return {
      left: muzzle.left + position.x * TRAJECTORY_X_SCALE,
      top: muzzle.top - position.y * TRAJECTORY_X_SCALE * stageAspect,
    };
  }, [angle, position, projectileState, stageAspect, trajectory]);

  const trajectoryDots = useMemo(() => {
    if (!trajectory) return [];
    const muzzle = launcherMuzzleForAngle(trajectory.angle, stageAspect);
    const visibleProgress =
      projectileState === "landed"
        ? 1
        : Math.min(1, flightElapsed / trajectory.flightTime);
    return Array.from({ length: 9 }, (_, index) => (index + 1) / 10)
      .filter((progress) => progress <= visibleProgress)
      .map((progress) => {
        const time = progress * trajectory.flightTime;
        const x = trajectory.vx * time;
        const y = Math.max(
          0,
          trajectory.vy0 * time - 0.5 * 9.81 * time ** 2,
        );
        return {
          left: muzzle.left + x * TRAJECTORY_X_SCALE,
          top: muzzle.top - y * TRAJECTORY_X_SCALE * stageAspect,
        };
      });
  }, [flightElapsed, projectileState, stageAspect, trajectory]);

  const muzzlePosition = launcherMuzzleForAngle(angle, stageAspect);
  const apparatusStyle = {
    "--landing-top": `${muzzlePosition.top}%`,
  } as CSSProperties;

  const velocityStyle = {
    "--vx-length": `${Math.min(70, Math.max(20, Math.abs(velocity.x) * 20))}px`,
    "--vy-length": `${Math.min(65, Math.max(12, Math.abs(velocity.y) * 16))}px`,
  } as CSSProperties;

  return (
    <section className="twod-lab-section" id="iki-boyutta-hareket-deneyi">
      <div className="twod-heading">
        <div>
          <span>DENEY 3 · FİZ.10.1.6</span>
          <h2>İki boyutta hareket düzeneğini kur ve incele.</h2>
        </div>
        <p>
          Fırlatma doğrultusunu ve hız kademesini değiştir; yatay ve düşey
          bileşenlerin hareket boyunca nasıl davrandığını ölçümlerle karşılaştır.
        </p>
      </div>

      <div className="twod-builder">
        <aside className="twod-equipment-panel">
          <div className="twod-panel-heading">
            <span>TÜM MALZEMELER AÇIK</span>
            <b>Düzeneği kur</b>
          </div>
          <div className="twod-equipment-list">
            {EQUIPMENT.map((item) => (
              <button
                type="button"
                draggable
                disabled={installed.includes(item.kind)}
                className={installed.includes(item.kind) ? "installed" : ""}
                onClick={() => installEquipment(item.kind)}
                onDragStart={(event) => onDragStart(event, item.kind)}
                key={item.kind}
              >
                <EquipmentIcon kind={item.kind} />
                <span>
                  <b>{item.shortName}</b>
                  <small>
                    {installed.includes(item.kind)
                      ? "Yerleştirildi"
                      : "Sürükle veya dokun"}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button
            className="twod-clear-button"
            type="button"
            onClick={clearExperiment}
          >
            Deneyi baştan kur
          </button>
        </aside>

        <div
          className="twod-stage"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onStageDrop}
        >
          <div className="twod-stage-toolbar">
            <span>
              <small>SİSTEMİN TANIDIĞI DÜZENEK</small>
              <b>{setupReady ? "İki boyutta hareket düzeneği" : "Kurulum bekleniyor"}</b>
            </span>
            <span className={setupReady ? "ready" : ""}>
              {installed.length} / {SETUP_ORDER.length} parça
            </span>
          </div>

          <div className="twod-notice" role="status">
            <i aria-hidden="true">{setupReady ? "✓" : installed.length + 1}</i>
            <span>{notice}</span>
          </div>

          <div
            className="twod-apparatus"
            ref={apparatusRef}
            style={apparatusStyle}
            aria-label="İki boyutta hareket deney düzeneği"
          >
            <div className="twod-lab-wall" />
            <div className="twod-floor">
              <img src="./motion-lab-bench-v3.webp" alt="" draggable={false} />
            </div>

            {installed.includes("launcher") && (
              <div className="twod-launcher">
                <img
                  src="./twod-launcher-frame-v2.webp"
                  alt="Gerçekçi metal eğik atış fırlatıcı statifi"
                  draggable={false}
                />
              </div>
            )}

            {installed.includes("protractor") && (
              <div className="twod-protractor">
                {ANGLES.map((option) => (
                  <i
                    className={angle === option ? "active" : ""}
                    style={{
                      left: `${50 + Math.cos((option * Math.PI) / 180) * 34}%`,
                      top: `${32 + Math.sin((option * Math.PI) / 180) * 45}%`,
                    }}
                    key={option}
                  >
                    {option}
                  </i>
                ))}
              </div>
            )}

            {installed.includes("launcher") && (
              <button
                type="button"
                className="twod-launcher-arm"
                style={
                  {
                    "--launcher-angle": `${angle}deg`,
                    transform: `rotate(${-angle}deg)`,
                  } as CSSProperties
                }
                aria-label={`Fırlatma doğrultusu ${angle} derece. Sürükleyerek ayarla.`}
                onPointerDown={startAngleDrag}
                onPointerMove={moveAngleDrag}
                onPointerUp={stopAngleDrag}
                onPointerCancel={stopAngleDrag}
              >
                <img
                  src="./twod-launcher-barrel-v2.webp"
                  alt=""
                  draggable={false}
                />
                <b>{angle}°</b>
              </button>
            )}

            {installed.includes("sensor") && (
              <div className={`twod-speed-sensor ${sensorReady ? "reset" : ""}`}>
                <img
                  src="./twod-speed-sensor-v2.webp"
                  alt="Gerçekçi dijital ilk hız sensörü"
                  draggable={false}
                />
                <small>İlk hız sensörü</small>
                <b>
                  {trajectory
                    ? trajectory.speed.toFixed(2)
                    : currentRecord
                      ? currentRecord.speed.toFixed(2)
                      : "0.00"}
                </b>
                <span>m/s</span>
                <i />
              </div>
            )}

            {installed.includes("table") && (
              <div className="twod-landing-table">
                <img
                  src="./twod-landing-table-v2.webp"
                  alt="Fırlatıcı ağzıyla aynı yüksekliğe ayarlanmış iniş masası"
                  draggable={false}
                />
              </div>
            )}

            {installed.includes("paper") && (
              <div className="twod-trace-paper">
                <span>İz kâğıdı</span>
                {Object.values(records).map((record) => {
                  const recordMuzzle = launcherMuzzleForAngle(
                    record.angle,
                    stageAspect,
                  );
                  const landingX =
                    recordMuzzle.left + record.measuredRange * TRAJECTORY_X_SCALE;
                  return (
                    <i
                      style={{
                        left: `${Math.max(
                          2,
                          Math.min(96, ((landingX - 26) / 69) * 100),
                        )}%`,
                      }}
                      title={`${record.angle}° · ${record.level}. kademe`}
                      key={recordKey(record.angle, record.level)}
                    />
                  );
                })}
              </div>
            )}

            {installed.includes("ruler") && (
              <div className="twod-meter-ruler">
                {Array.from({ length: 11 }, (_, index) => (
                  <i key={index}>{index * 10}</i>
                ))}
              </div>
            )}

            {trajectoryDots.map((dot, index) => (
              <i
                className="twod-trajectory-dot"
                style={{ left: `${dot.left}%`, top: `${dot.top}%` }}
                key={`${trajectory?.angle}-${trajectory?.speed}-${index}`}
              />
            ))}

            {installed.includes("ball") && setupReady && (
              <span
                className={`twod-projectile ${projectileState}`}
                style={{ left: `${ballPosition.left}%`, top: `${ballPosition.top}%` }}
                aria-label="Hareket eden çelik bilye"
              >
                {projectileState === "flying" && (
                  <span className="twod-velocity-arrows" style={velocityStyle}>
                    <i className="velocity-x">vₓ</i>
                    <i className={`velocity-y ${velocity.y < 0 ? "down" : "up"}`}>
                      vᵧ
                    </i>
                  </span>
                )}
              </span>
            )}

            {!installed.includes("launcher") && (
              <div className="twod-empty-target">
                <i>＋</i>
                <b>Malzemeleri bu alana sürükle</b>
              </div>
            )}
          </div>

          <div className="twod-control-deck">
            <div className="twod-speed-levels">
              <span>Hız kademesi</span>
              <div>
                {[1, 2, 3].map((level) => (
                  <button
                    type="button"
                    className={speedLevel === level ? "active" : ""}
                    aria-pressed={speedLevel === level}
                    disabled={!setupReady || projectileState === "flying"}
                    onClick={() => chooseSpeedLevel(level)}
                    key={level}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={!setupReady || projectileState === "flying"}
              onClick={resetSensor}
            >
              Hız sensörünü sıfırla
            </button>
            <button
              className="primary"
              type="button"
              disabled={!setupReady || !sensorReady || projectileState === "flying"}
              onClick={launch}
            >
              Pimi çek ve fırlat
            </button>
          </div>

          <div className="twod-live-values">
            <span>
              <small>Yatay hız vₓ</small>
              <b>{velocity.x ? `${velocity.x.toFixed(2)} m/s` : "—"}</b>
            </span>
            <span>
              <small>Düşey hız vᵧ</small>
              <b>{trajectory ? `${velocity.y.toFixed(2)} m/s` : "—"}</b>
            </span>
            <span>
              <small>Uçuş süresi</small>
              <b>{trajectory ? `${flightElapsed.toFixed(2)} s` : "—"}</b>
            </span>
            <span>
              <small>Menzil</small>
              <b>{currentRecord ? `${currentRecord.measuredRange.toFixed(2)} m` : "—"}</b>
            </span>
          </div>
        </div>
      </div>

      <div className="twod-progress">
        <span className={setupReady ? "done" : ""}>1 · Düzeneği kur</span>
        <span className={setupReady ? "done" : ""}>2 · Doğrultuyu ayarla</span>
        <span className={sensorReady ? "done" : ""}>3 · Sensörü sıfırla</span>
        <span className={recordCount ? "done" : ""}>4 · Fırlat ve ölç</span>
      </div>

      <div className="twod-data-heading">
        <div>
          <span>CANLI DENEY VERİLERİ</span>
          <h3>Doğrultu ve hız kademelerini karşılaştır</h3>
        </div>
        <div className="twod-shot-result">
          <small>Seçili ölçüm · {angle}° · Kademe {speedLevel}</small>
          <b>{currentRecord ? `${currentRecord.measuredRange.toFixed(2)} m` : "—"}</b>
          <span>
            {currentRecord
              ? `İdeal model · uçuş süresi ${currentRecord.flightTime.toFixed(2)} s`
              : "Fırlatmadan sonra ideal menzil kaydedilir"}
          </span>
        </div>
      </div>

      <section className="twod-table-card">
        <div className="twod-table-heading">
          <b>Hız, menzil ve maksimum yükseklik ölçümleri</b>
          <span>{recordCount} / 15 deney tamamlandı</span>
        </div>
        <MeasurementTable records={records} />
      </section>

      <div className="twod-graphs">
        <TwoDimensionalGraph kind="range" records={records} />
        <TwoDimensionalGraph kind="height" records={records} />
      </div>

      <section className="twod-report">
        <div className="twod-report-heading">
          <span>KISA DENEY RAPORU</span>
          <h3>İki bileşeni aynı hareket üzerinden açıkla.</h3>
          <p>Yanıtlarını deney sahnesindeki gözlemlere, tabloya ve grafiklere dayandır.</p>
        </div>
        <div className="twod-report-grid">
          <label>
            <span>1</span>
            Aynı hız kademesinde fırlatma doğrultusu değiştikçe menzil nasıl değişti?
            <textarea rows={4} aria-label="Doğrultu menzil ilişkisi" />
          </label>
          <label>
            <span>2</span>
            En büyük menzili hangi doğrultuda ölçtün? Verinle destekle.
            <textarea rows={4} aria-label="En büyük menzil değerlendirmesi" />
          </label>
          <label>
            <span>3</span>
            Hareket boyunca yatay ve düşey hız bileşenlerinin değişimini karşılaştır.
            <textarea rows={4} aria-label="Hız bileşenlerini karşılaştırma" />
          </label>
          <label>
            <span>4</span>
            45°’ye eşit uzaklıktaki iki fırlatma doğrultusunun menzillerini
            karşılaştır. Hangi ortak özelliği görüyorsun?
            <textarea rows={4} aria-label="Tamamlayıcı doğrultuların menzillerini karşılaştırma" />
          </label>
        </div>
        <label className="twod-report-conclusion">
          <span>SONUÇ</span>
          İki boyutta sabit ivmeli hareketi yatay ve düşey bileşenleri ilişkilendirerek açıkla.
          <textarea rows={5} aria-label="İki boyutta hareket deney sonucu" />
        </label>
      </section>
    </section>
  );
}
