"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type EquipmentKind =
  | "stand"
  | "pendulum"
  | "ruler"
  | "photogate"
  | "timer";
type RunState = "ready" | "running" | "complete";
type EnvironmentId = "earth" | "moon" | "mars" | "jupiter";
type Trial = {
  id: number;
  environment: EnvironmentId;
  environmentName: string;
  length: number;
  releaseDistance: number;
  tenPeriodTime: number;
  period: number;
  gravity: number;
};

const MIME = "application/x-simple-pendulum-equipment";
const OSCILLATION_COUNT = 10;
const ENVIRONMENTS: Array<{
  id: EnvironmentId;
  name: string;
  gravity: number;
  level: string;
  observation: string;
}> = [
  {
    id: "moon",
    name: "Ay",
    gravity: 1.62,
    level: "Çok düşük çekim",
    observation: "Sarkaç belirgin biçimde yavaşlar.",
  },
  {
    id: "mars",
    name: "Mars",
    gravity: 3.71,
    level: "Düşük çekim",
    observation: "Periyot Dünya’dakinden daha uzundur.",
  },
  {
    id: "earth",
    name: "Dünya",
    gravity: 9.81,
    level: "Referans ortam",
    observation: "Laboratuvar ölçümünün temel karşılaştırmasıdır.",
  },
  {
    id: "jupiter",
    name: "Jüpiter",
    gravity: 24.79,
    level: "Çok güçlü çekim",
    observation: "Sarkaç daha kısa sürede salınır.",
  },
];
const EQUIPMENT_ORDER: EquipmentKind[] = [
  "stand",
  "pendulum",
  "ruler",
  "photogate",
  "timer",
];
const EQUIPMENT: Array<{
  kind: EquipmentKind;
  name: string;
  detail: string;
}> = [
  { kind: "stand", name: "Statif ve sarkaç kıskacı", detail: "Ağır tabanıyla masa üzerinde sabit durur" },
  { kind: "pendulum", name: "İp ve metal bilye", detail: "İnce, esnemez ip kullanılır" },
  { kind: "ruler", name: "Metre cetveli", detail: "Askı noktası–bilye merkezi ölçülür" },
  { kind: "photogate", name: "Optik geçiş kapısı", detail: "Bilyenin denge geçişini algılar" },
  { kind: "timer", name: "Dijital zamanlayıcı", detail: "On tam salınımı kaydeder" },
];
const EQUIPMENT_IMAGES: Partial<Record<EquipmentKind, string>> = {
  stand: "./shm-retort-stand-real-v2.png",
  pendulum: "./pendulum-bob-real-v2.png",
  ruler: "./freefall-equipment-ruler.webp",
  photogate: "./motion-equipment-gate.webp",
  timer: "./motion-equipment-timer.webp",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function format(value: number, digits = 2) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function PendulumEquipmentIcon({ kind }: { kind: EquipmentKind }) {
  const image = EQUIPMENT_IMAGES[kind];
  return (
    <span
      className={`pend-equipment-icon pend-icon-${kind} ${image ? "has-photo" : ""}`}
      aria-hidden="true"
    >
      {image ? (
        <img src={image} alt="" draggable={false} />
      ) : (
        <><i /><i /><i /></>
      )}
    </span>
  );
}

function PendulumGraph({
  time,
  period,
  amplitude,
}: {
  time: number;
  period: number;
  amplitude: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.getBoundingClientRect().width, 320);
    const height = 220;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fbfdfc";
    context.fillRect(0, 0, width, height);

    const plot = { left: 47, top: 18, right: 18, bottom: 32 };
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const centerY = plot.top + plotHeight / 2;
    const duration = period * 3;
    const omega = (2 * Math.PI) / period;

    for (let index = 0; index <= 6; index += 1) {
      const x = plot.left + (plotWidth * index) / 6;
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.top + plotHeight);
      context.strokeStyle = "#e0ebe8";
      context.stroke();
    }
    context.beginPath();
    context.moveTo(plot.left, centerY);
    context.lineTo(width - plot.right, centerY);
    context.strokeStyle = "#9eb5b1";
    context.lineWidth = 1.5;
    context.stroke();

    context.beginPath();
    for (let step = 0; step <= 240; step += 1) {
      const sample = (duration * step) / 240;
      const x = plot.left + (plotWidth * step) / 240;
      const y = centerY - Math.cos(omega * sample) * plotHeight * 0.39;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = "#167f75";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.stroke();

    const cursorX = plot.left + ((time % duration) / duration) * plotWidth;
    const cursorY = centerY - Math.cos(omega * time) * plotHeight * 0.39;
    context.beginPath();
    context.moveTo(cursorX, plot.top);
    context.lineTo(cursorX, plot.top + plotHeight);
    context.setLineDash([4, 4]);
    context.strokeStyle = "#173f59";
    context.lineWidth = 1.5;
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
    context.fillStyle = "#ef9f28";
    context.fill();

    context.fillStyle = "#607674";
    context.font = "8px Arial";
    context.textAlign = "right";
    context.fillText("zaman (s)", width - plot.right, height - 13);
    context.textAlign = "left";
    context.fillText(`yatay konum · başlangıç ${format(amplitude, 1)} cm`, plot.left, height - 13);
  }, [amplitude, period, time]);

  return (
    <canvas
      ref={canvasRef}
      className="pend-motion-graph"
      aria-label="Basit sarkacın yatay konum zaman grafiği"
    />
  );
}

export default function SimplePendulumLab() {
  const [installed, setInstalled] = useState<EquipmentKind[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [length, setLength] = useState(60);
  const [environmentId, setEnvironmentId] = useState<EnvironmentId>("earth");
  const [releaseDistance, setReleaseDistance] = useState(8);
  const [previewAngle, setPreviewAngle] = useState(-7.7);
  const [runState, setRunState] = useState<RunState>("ready");
  const [time, setTime] = useState(0);
  const [gravityCalculated, setGravityCalculated] = useState(false);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [message, setMessage] = useState("Statifi deney masasına yerleştirerek kuruluma başla.");
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; angle: number } | null>(null);
  const nextTrialIdRef = useRef(1);

  const setupComplete = installed.length === EQUIPMENT_ORDER.length;
  const nextEquipment = EQUIPMENT_ORDER[installed.length];
  const selectedEnvironment =
    ENVIRONMENTS.find((environment) => environment.id === environmentId) ??
    ENVIRONMENTS[2];
  const lengthMeters = length / 100;
  const period =
    2 * Math.PI * Math.sqrt(lengthMeters / selectedEnvironment.gravity);
  const omega = (2 * Math.PI) / period;
  const initialAngle =
    Math.sign(previewAngle || -1) * Math.asin(clamp(releaseDistance / length, 0, 0.18));
  const currentAngleRadians = runState === "running"
    ? initialAngle * Math.cos(omega * time)
    : previewAngle * (Math.PI / 180);
  const currentAngleDegrees = currentAngleRadians * (180 / Math.PI);
  const horizontalPosition = length * Math.sin(currentAngleRadians);
  const tenPeriodTime = OSCILLATION_COUNT * period;
  const countedOscillations = Math.min(OSCILLATION_COUNT, time / period);
  const calculatedGravity =
    (4 * Math.PI ** 2 * lengthMeters) / period ** 2;
  const stringLengthPixels = 165 + length * 1.6;

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  useEffect(() => {
    if (runState !== "running") return;
    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      if (elapsed >= tenPeriodTime) {
        setTime(tenPeriodTime);
        setRunState("complete");
        setPreviewAngle(initialAngle * (180 / Math.PI));
        setMessage("On tam salınım tamamlandı. Ölçülen periyottan g’yi hesapla.");
        animationRef.current = null;
        return;
      }
      setTime(elapsed);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return stopAnimation;
  }, [initialAngle, runState, stopAnimation, tenPeriodTime]);

  const installEquipment = (kind: EquipmentKind) => {
    if (installed.includes(kind)) return;
    if (kind !== nextEquipment) {
      const expected = EQUIPMENT.find((item) => item.kind === nextEquipment);
      setMessage(`Sıradaki parça: ${expected?.name ?? "düzeneği tamamla"}.`);
      return;
    }
    const updated = [...installed, kind];
    setInstalled(updated);
    if (updated.length === EQUIPMENT_ORDER.length) {
      setMessage("Düzenek hazır. Metal bilyeyi yana çekip bırak.");
    } else {
      const expected = EQUIPMENT.find(
        (item) => item.kind === EQUIPMENT_ORDER[updated.length],
      );
      setMessage(`${expected?.name} parçasını masaya yerleştir.`);
    }
  };

  const onEquipmentDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    kind: EquipmentKind,
  ) => {
    event.dataTransfer.setData(MIME, kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const kind = event.dataTransfer.getData(MIME) as EquipmentKind;
    if (EQUIPMENT_ORDER.includes(kind)) installEquipment(kind);
  };

  const resetMeasurement = useCallback((nextDistance = releaseDistance) => {
    stopAnimation();
    setRunState("ready");
    setTime(0);
    setGravityCalculated(false);
    startTimeRef.current = null;
    const nextAngle = Math.asin(clamp(nextDistance / length, 0, 0.18));
    setPreviewAngle(-(nextAngle * 180) / Math.PI);
  }, [length, releaseDistance, stopAnimation]);

  const releaseBob = useCallback(() => {
    if (!setupComplete) {
      setMessage(`Ölçümden önce ${EQUIPMENT_ORDER.length} parçanın tamamını sırayla yerleştir.`);
      return;
    }
    stopAnimation();
    setTime(0);
    setGravityCalculated(false);
    startTimeRef.current = null;
    setRunState("running");
    setMessage("Optik kapı bilyenin denge noktasından geçişlerini sayıyor.");
  }, [setupComplete, stopAnimation]);

  const onBobPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setupComplete || runState === "running") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { x: event.clientX, angle: previewAngle };
    setRunState("ready");
    setTime(0);
    setGravityCalculated(false);
    setMessage("Bilyeyi yana çek; bıraktığında sayaç başlayacak.");
  };

  const onBobPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const nextAngle = clamp(
      dragStartRef.current.angle + (event.clientX - dragStartRef.current.x) / 7,
      -12,
      12,
    );
    setPreviewAngle(nextAngle);
    setReleaseDistance(
      Math.round(Math.abs(length * Math.sin((nextAngle * Math.PI) / 180)) * 10) / 10,
    );
  };

  const onBobPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (Math.abs(previewAngle) < 2) {
      const distance = 5;
      setReleaseDistance(distance);
      setPreviewAngle(-(Math.asin(distance / length) * 180) / Math.PI);
    }
    releaseBob();
  };

  const changeLength = (nextLength: number) => {
    setLength(nextLength);
    stopAnimation();
    setRunState("ready");
    setTime(0);
    setGravityCalculated(false);
    startTimeRef.current = null;
    const safeDistance = Math.min(releaseDistance, nextLength * 0.18);
    setReleaseDistance(safeDistance);
    setPreviewAngle(-(Math.asin(safeDistance / nextLength) * 180) / Math.PI);
    setMessage("Sarkaç uzunluğu ayarlandı. Bilyeyi çekip yeni ölçümü başlat.");
  };

  const changeReleaseDistance = (nextDistance: number) => {
    setReleaseDistance(nextDistance);
    setGravityCalculated(false);
    resetMeasurement(nextDistance);
    setMessage("Başlangıç uzaklığı ayarlandı. Bilyeyi serbest bırak.");
  };

  const changeEnvironment = (nextEnvironment: EnvironmentId) => {
    stopAnimation();
    setEnvironmentId(nextEnvironment);
    setRunState("ready");
    setTime(0);
    setGravityCalculated(false);
    startTimeRef.current = null;
    const environment = ENVIRONMENTS.find((item) => item.id === nextEnvironment);
    setMessage(
      `${environment?.name ?? "Yeni"} ortamı seçildi. Aynı sarkaçla yeni ölçümü başlat.`,
    );
  };

  const recordTrial = () => {
    if (runState !== "complete" || !gravityCalculated) {
      setMessage("Kaydetmek için on salınımı tamamla ve g değerini hesapla.");
      return;
    }
    setTrials((current) => [
      ...current,
      {
        id: nextTrialIdRef.current++,
        environment: selectedEnvironment.id,
        environmentName: selectedEnvironment.name,
        length,
        releaseDistance,
        tenPeriodTime,
        period,
        gravity: calculatedGravity,
      },
    ]);
    setMessage("İdeal ölçüm deney günlüğüne kaydedildi.");
  };

  const calculateGravity = () => {
    if (runState !== "complete") {
      setMessage("Önce on tam salınımın süresini ölç.");
      return;
    }
    setGravityCalculated(true);
    setMessage(
      `Ölçülen L ve T değerlerinden g = ${format(calculatedGravity, 2)} m/s² bulundu.`,
    );
  };

  const apparatusStyle = {
    "--pend-angle": `${currentAngleDegrees}deg`,
    "--pend-length": `${stringLengthPixels}px`,
  } as React.CSSProperties;
  const environmentResults = ENVIRONMENTS.map((environment) => ({
    ...environment,
    trial: [...trials]
      .reverse()
      .find((trial) => trial.environment === environment.id),
  }));

  return (
    <div className="pendulum-experiment">
      <div className="pend-learning-strip">
        <span><b>1</b> Gerçek düzeneği kur</span>
        <span><b>2</b> İp uzunluğunu ölç</span>
        <span><b>3</b> Bilyeyi çekip bırak</span>
        <span><b>4</b> 10 salınımdan g’yi bul</span>
      </div>

      <section className="pend-environment-selector">
        <div>
          <small>ÇEKİM ORTAMI</small>
          <h3>Aynı sarkacı farklı gök cisimlerinde dene</h3>
          <p>Uzunluğu sabit tutarak yalnızca ortamı değiştir ve salınım süresini karşılaştır.</p>
        </div>
        <div className="pend-environment-options">
          {ENVIRONMENTS.map((environment) => (
            <button
              key={environment.id}
              type="button"
              className={`${environment.id} ${environmentId === environment.id ? "active" : ""}`}
              onClick={() => changeEnvironment(environment.id)}
              disabled={runState === "running"}
            >
              <i aria-hidden="true" />
              <span>
                <b>{environment.name}</b>
                <small>{environment.level}</small>
              </span>
              <strong>{environmentId === environment.id ? "SEÇİLİ" : "DENE"}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="pend-workspace">
        <aside className="pend-equipment-panel">
          <div className="pend-panel-heading">
            <div>
              <small>MALZEME RAFI</small>
              <h3>Sarkaç düzeneğini kur</h3>
            </div>
            <strong>{installed.length}/{EQUIPMENT_ORDER.length}</strong>
          </div>
          <div className="pend-equipment-list">
            {EQUIPMENT.map((item, index) => {
              const isInstalled = installed.includes(item.kind);
              const isNext = item.kind === nextEquipment;
              return (
                <button
                  key={item.kind}
                  type="button"
                  draggable={!isInstalled && isNext}
                  className={`${isInstalled ? "installed" : ""} ${isNext ? "next" : ""}`}
                  onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                  onClick={() => installEquipment(item.kind)}
                  disabled={isInstalled}
                >
                  <span className="pend-step-number">{isInstalled ? "✓" : index + 1}</span>
                  <PendulumEquipmentIcon kind={item.kind} />
                  <span>
                    <b>{item.name}</b>
                    <small>{isInstalled ? "Yerleştirildi" : item.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <p>Dokunmatik ekranda parçaya dokunarak da kurabilirsin.</p>
        </aside>

        <div
          className={`pend-stage ${setupComplete ? "setup-complete" : ""} ${isDragOver ? "drag-over" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={() => setIsDragOver(true)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragOver(false);
          }}
          onDrop={onStageDrop}
          aria-label="Basit sarkaç deney tezgâhı"
        >
          <div className="pend-stage-toolbar">
            <div>
              <small>
                BASİT SARKAÇ · {selectedEnvironment.name.toLocaleUpperCase("tr-TR")} ORTAMI
              </small>
              <b>{setupComplete ? "Optik geçiş sayacı hazır" : "Parçaları bu alana bırak"}</b>
            </div>
            <div className="pend-live-counter">
              <span><small>ZAMAN</small><b>{format(time, 2)} s</b></span>
              <span><small>SALINIM</small><b>{format(countedOscillations, 2)} / 10</b></span>
              <i className={runState === "running" ? "active" : ""} />
            </div>
          </div>

          <div
            className={`pend-apparatus environment-${selectedEnvironment.id}`}
            style={apparatusStyle}
          >
            <img
              className="pend-real-bench-photo"
              src="./motion-lab-bench-v3.webp"
              alt=""
              draggable={false}
              aria-hidden="true"
            />
            <div className="pend-lab-wall">
              <span>BASİT SARKAÇ · g ÖLÇÜMÜ</span>
              <div className="pend-environment-window">
                <i />
                <b>{selectedEnvironment.name} ortamı</b>
              </div>
            </div>
            <div className="pend-bench">
              <i className="pend-bench-top" />
              <i className="pend-bench-leg left" />
              <i className="pend-bench-leg right" />
            </div>

            {installed.includes("stand") && (
              <div className="pend-stand">
                <img
                  className="pend-real-stand-photo"
                  src="./shm-retort-stand-real-v2.png"
                  alt="Ağır tabanlı gerçek laboratuvar statifi ve sarkaç kıskacı"
                  draggable={false}
                />
                <i className="pend-stand-base" />
                <i className="pend-stand-rod" />
              </div>
            )}
            {installed.includes("pendulum") && (
              <div className="pend-swing-arm">
                <i className="pend-string" />
                <button
                  type="button"
                  className={`pend-bob ${setupComplete ? "grabbable" : ""}`}
                  aria-label="Metal bilyeyi yana çekip bırak"
                  onPointerDown={onBobPointerDown}
                  onPointerMove={onBobPointerMove}
                  onPointerUp={onBobPointerUp}
                  onPointerCancel={() => { dragStartRef.current = null; }}
                >
                  <img
                    src="./pendulum-bob-real-v2.png"
                    alt=""
                    draggable={false}
                  />
                </button>
              </div>
            )}
            {installed.includes("ruler") && (
              <div className="pend-ruler">
                <img
                  src="./freefall-equipment-ruler.webp"
                  alt="Askı noktasından bilye merkezine uzanan metre cetveli"
                  draggable={false}
                />
                <span>L = {length} cm</span>
              </div>
            )}
            {installed.includes("photogate") && (
              <div className={`pend-photogate ${runState === "running" ? "active" : ""}`}>
                <i className="gate-left" />
                <i className="gate-right" />
                <i className="gate-base" />
                <b>OPTİK KAPI</b>
              </div>
            )}
            {installed.includes("timer") && (
              <>
                <div className="pend-timer-cable" />
                <div className="pend-timer">
                  <img
                    className="pend-real-timer-photo"
                    src="./motion-equipment-timer.webp"
                    alt="Optik kapıya bağlı dijital periyot zamanlayıcısı"
                    draggable={false}
                  />
                  <small>PERIOD TIMER</small>
                  <strong>{format(time, 2)}</strong>
                  <em>s</em>
                  <span>{Math.floor(countedOscillations)} geçiş çifti</span>
                  <i className={runState === "running" ? "active" : ""} />
                </div>
              </>
            )}

            {!setupComplete && (
              <div className="pend-drop-hint">
                <b>Malzemeyi buraya bırak</b>
                <span>Parçalar gerçek bağlantı konumlarına yerleşir.</span>
              </div>
            )}
            {setupComplete && runState !== "running" && (
              <div className="pend-grab-hint">BİLYEYİ TUT · YANA ÇEK · BIRAK</div>
            )}
          </div>
          <div className={`pend-status ${setupComplete ? "ready" : ""}`} aria-live="polite">
            <b>{setupComplete ? "YÖNERGE" : `KURULUM ${installed.length + 1}/${EQUIPMENT_ORDER.length}`}</b>
            <span>{message}</span>
          </div>
        </div>
      </div>

      <section className="pend-controls">
        <article>
          <small>ÖLÇÜLEN UZUNLUK</small>
          <h3>Askı noktası–bilye merkezi</h3>
          <label>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={length}
              onChange={(event) => changeLength(Number(event.target.value))}
              disabled={runState === "running"}
            />
            <b>{length} cm</b>
          </label>
        </article>
        <article>
          <small>BAŞLANGIÇ KONUMU · KÜÇÜK SALINIM</small>
          <h3>Denge noktasından yana çek</h3>
          <label>
            <input
              type="range"
              min="4"
              max={Math.min(12, Math.floor(length * 0.18))}
              step="1"
              value={releaseDistance}
              onChange={(event) => changeReleaseDistance(Number(event.target.value))}
              disabled={runState === "running"}
            />
            <b>{format(releaseDistance, 1)} cm</b>
          </label>
        </article>
        <div className="pend-action-buttons">
          <button type="button" onClick={releaseBob} disabled={!setupComplete || runState === "running"}>
            {runState === "complete" ? "YENİDEN BIRAK" : "BİLYEYİ BIRAK"}
          </button>
          <button type="button" onClick={() => resetMeasurement()} disabled={!setupComplete || runState === "running"}>
            BAŞA AL
          </button>
        </div>
      </section>

      <section className="pend-results-grid">
        <article className="pend-graph-card">
          <small>CANLI KONUM GRAFİĞİ</small>
          <h3>Sarkaç bir tam salınımı tekrarlar</h3>
          <PendulumGraph time={time} period={period} amplitude={releaseDistance} />
        </article>
        <article className="pend-calculation-card">
          <small>İŞLEMSEL SONUÇ</small>
          <h3>Yer çekimi ivmesini bul</h3>
          <div>
            <span><small>Seçilen ortam</small><b>{selectedEnvironment.name}</b></span>
            <span><small>10 salınım</small><b>{runState === "complete" ? `${format(tenPeriodTime, 3)} s` : "Ölçüm bekleniyor"}</b></span>
            <span><small>Bir salınımın periyodu</small><b>{runState === "complete" ? `${format(period, 3)} s` : "—"}</b></span>
            <span><small>Sarkaç uzunluğu</small><b>{format(lengthMeters, 2)} m</b></span>
          </div>
          <p>g = 4π²L / T²</p>
          <button
            className="pend-calculate-gravity"
            type="button"
            onClick={calculateGravity}
            disabled={runState !== "complete"}
          >
            g’Yİ HESAPLA
          </button>
          <strong>{gravityCalculated ? `${format(calculatedGravity, 2)} m/s²` : "—"}</strong>
          <em>{selectedEnvironment.name} ortamında ideal olarak ölçülen değer</em>
        </article>
        <article className="pend-observation-card">
          <small>CANLI GÖZLEM</small>
          <h3>Bilye ne yapıyor?</h3>
          <div>
            <span><small>Yatay konum</small><b>{format(horizontalPosition, 2)} cm</b></span>
            <span><small>Sapma</small><b>{format(Math.abs(currentAngleDegrees), 1)}°</b></span>
            <span><small>Geçen süre</small><b>{format(time, 2)} s</b></span>
            <span><small>Tamamlanan salınım</small><b>{format(countedOscillations, 2)}</b></span>
            <span><small>Çekim ortamı</small><b>{selectedEnvironment.name}</b></span>
            <span className="wide"><small>Beklenen davranış</small><b>{selectedEnvironment.observation}</b></span>
          </div>
        </article>
      </section>

      <section className="pend-data-section">
        <div className="pend-data-heading">
          <div>
            <small>DENEY GÜNLÜĞÜ</small>
            <h3>Ortamı veya uzunluğu değiştir, ölçümü tekrarla</h3>
            <p>Her ortamda on salınımı tamamlayarak periyot ve g değerini karşılaştır.</p>
          </div>
          <button type="button" onClick={recordTrial}>ÖLÇÜMÜ KAYDET</button>
        </div>
        <div className="pend-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Deneme</th>
                <th>Ortam</th>
                <th>İp uzunluğu L</th>
                <th>Başlangıç uzaklığı</th>
                <th>10 salınım süresi</th>
                <th>Periyot T</th>
                <th>Hesaplanan g</th>
              </tr>
            </thead>
            <tbody>
              {trials.length === 0 ? (
                <tr><td colSpan={7}>Bilyeyi bırak, on salınımı tamamla ve ilk ölçümü kaydet.</td></tr>
              ) : trials.map((trial) => (
                <tr key={trial.id}>
                  <td>{trial.id}</td>
                  <td>{trial.environmentName}</td>
                  <td>{trial.length} cm</td>
                  <td>{format(trial.releaseDistance, 1)} cm</td>
                  <td>{format(trial.tenPeriodTime, 3)} s</td>
                  <td>{format(trial.period, 3)} s</td>
                  <td>{format(trial.gravity, 2)} m/s²</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pend-gravity-comparison">
        <div>
          <small>ORTAMLAR ARASI KARŞILAŞTIRMA</small>
          <h3>Aynı sarkaç, farklı salınım süreleri</h3>
          <p>Bir ortamda ölçüm kaydettiğinde o ortama ait sonuç burada görünür.</p>
        </div>
        <div className="pend-gravity-bars">
          {environmentResults.map((environment) => (
            <article key={environment.id} className={environment.id}>
              <header><i /><b>{environment.name}</b></header>
              <div>
                <span
                  style={{
                    width: environment.trial
                      ? `${(environment.trial.gravity / 24.79) * 100}%`
                      : "0%",
                  }}
                />
              </div>
              <strong>
                {environment.trial
                  ? `${format(environment.trial.gravity, 2)} m/s²`
                  : "Ölçüm bekleniyor"}
              </strong>
              <small>
                {environment.trial
                  ? `T = ${format(environment.trial.period, 3)} s`
                  : environment.level}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="pend-report">
        <div>
          <small>KISA DENEY RAPORU</small>
          <h3>Ölçümünden bir sonuç çıkar</h3>
          <p>Yanıtlarını deney günlüğündeki değerlerle destekle.</p>
        </div>
        <label>
          <span>1 · İp uzadığında periyot nasıl değişti?</span>
          <textarea rows={4} aria-label="Sarkaç uzunluğu ile periyot ilişkisi" />
        </label>
        <label>
          <span>2 · Neden tek salınım yerine on salınımın süresini ölçtün?</span>
          <textarea rows={4} aria-label="On salınım ölçmenin gerekçesi" />
        </label>
        <label>
          <span>3 · Aynı uzunlukta farklı ortamlarda ölçülen periyotları karşılaştır.</span>
          <textarea rows={4} aria-label="Hesaplanan yer çekimi ivmelerinin karşılaştırılması" />
        </label>
        <label>
          <span>4 · Çekim ivmesi büyüdükçe sarkacın hareketi nasıl değişti?</span>
          <textarea rows={4} aria-label="Basit sarkaçta hız ve konum yorumu" />
        </label>
      </section>
    </div>
  );
}
