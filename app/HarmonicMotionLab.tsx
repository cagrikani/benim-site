"use client";

import {
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import SimplePendulumLab from "./SimplePendulumLab";

type EquipmentKind =
  | "stand"
  | "spring"
  | "mass"
  | "ruler"
  | "sensor"
  | "timer";
type RunState = "ready" | "running" | "paused" | "complete";
type Trial = {
  id: number;
  mass: number;
  springConstant: number;
  amplitude: number;
  period: number;
  frequency: number;
};

const MIME = "application/x-harmonic-motion-equipment";
const G = 9.81;
const EQUIPMENT_ORDER: EquipmentKind[] = [
  "stand",
  "spring",
  "mass",
  "ruler",
  "sensor",
  "timer",
];
const EQUIPMENT: Array<{
  kind: EquipmentKind;
  name: string;
  detail: string;
}> = [
  {
    kind: "stand",
    name: "Statif ve bağlantı kıskacı",
    detail: "Ağır tabanlı metal taşıyıcı",
  },
  {
    kind: "spring",
    name: "Sarmal yay",
    detail: "Statif kıskacına asılır",
  },
  {
    kind: "mass",
    name: "Kütle askısı",
    detail: "Yarıklı kütlelerle ayarlanır",
  },
  {
    kind: "ruler",
    name: "Düşey cetvel",
    detail: "Denge ve genlik işaretleri için",
  },
  {
    kind: "sensor",
    name: "Hareket algılayıcısı",
    detail: "Kütlenin tam altına yerleşir",
  },
  {
    kind: "timer",
    name: "Dijital zamanlayıcı",
    detail: "Algılayıcıya kabloyla bağlanır",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function format(value: number, digits = 2) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function EquipmentIcon({ kind }: { kind: EquipmentKind }) {
  return (
    <span className={`shm-equipment-icon shm-equipment-${kind}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function SpringCoil({ offset }: { offset: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = clamp(188 + offset, 122, 258);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = 54;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const center = width / 2;
    const coilTop = 12;
    const coilBottom = height - 13;
    const turns = 17;
    const drawCoil = (stroke: string, lineWidth: number, offset = 0) => {
      context.beginPath();
      context.moveTo(center + offset, 0);
      context.lineTo(center + offset, coilTop);
      const samples = turns * 22;
      for (let sample = 0; sample <= samples; sample += 1) {
        const progress = sample / samples;
        const x = center + Math.sin(progress * Math.PI * 2 * turns) * 18 + offset;
        const y = coilTop + progress * (coilBottom - coilTop);
        context.lineTo(x, y);
      }
      context.lineTo(center + offset, height);
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();
    };

    context.shadowColor = "rgba(20, 42, 47, 0.28)";
    context.shadowBlur = 4;
    context.shadowOffsetX = 2;
    drawCoil("#263b40", 5.2);
    context.shadowColor = "transparent";
    const gradient = context.createLinearGradient(7, 0, 47, 0);
    gradient.addColorStop(0, "#52676b");
    gradient.addColorStop(0.28, "#eef3f1");
    gradient.addColorStop(0.5, "#829296");
    gradient.addColorStop(0.74, "#f7faf8");
    gradient.addColorStop(1, "#40565b");
    drawCoil(gradient, 2.8);
    drawCoil("rgba(255,255,255,0.58)", 0.8, -0.8);
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      className="shm-spring"
      style={{ height: `${height}px` }}
      aria-label="Gerçekçi metal sarmal yay"
    />
  );
}

function ExperimentTabs({
  active,
  onChange,
}: {
  active: "spring" | "pendulum";
  onChange: (mode: "spring" | "pendulum") => void;
}) {
  return (
    <div className="shm-experiment-tabs" aria-label="Basit harmonik hareket deneyleri">
      <button
        type="button"
        className={active === "spring" ? "active" : ""}
        onClick={() => onChange("spring")}
      >
        <span className="shm-tab-spring" aria-hidden="true"><i /><i /><i /></span>
        <span><small>DENEY 1</small><b>Yay–kütle sistemi</b><em>Periyot ve enerji dönüşümü</em></span>
      </button>
      <button
        type="button"
        className={active === "pendulum" ? "active" : ""}
        onClick={() => onChange("pendulum")}
      >
        <span className="shm-tab-pendulum" aria-hidden="true"><i /><i /><i /></span>
        <span><small>DENEY 2</small><b>Basit sarkaç</b><em>Periyottan yer çekimi ivmesi</em></span>
      </button>
    </div>
  );
}

function MotionGraph({
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
    const width = Math.max(canvas.getBoundingClientRect().width, 340);
    const height = 300;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fbfdfc";
    context.fillRect(0, 0, width, height);

    const plot = { left: 64, right: 18, top: 18, bottom: 32 };
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const rowHeight = plotHeight / 3;
    const duration = period * 2;
    const omega = (2 * Math.PI) / period;
    const traces = [
      { label: "x (cm)", color: "#167f75", value: (t: number) => Math.cos(omega * t) },
      { label: "v (cm/s)", color: "#ef9f28", value: (t: number) => -Math.sin(omega * t) },
      { label: "a (cm/s²)", color: "#b55a5a", value: (t: number) => -Math.cos(omega * t) },
    ];

    context.font = "700 9px Arial";
    context.textAlign = "right";
    context.textBaseline = "middle";
    traces.forEach((trace, row) => {
      const centerY = plot.top + rowHeight * (row + 0.5);
      context.fillStyle = trace.color;
      context.fillText(trace.label, plot.left - 9, centerY);
      context.beginPath();
      context.moveTo(plot.left, centerY);
      context.lineTo(width - plot.right, centerY);
      context.strokeStyle = "#cddbd8";
      context.lineWidth = 1;
      context.stroke();
      if (row > 0) {
        const dividerY = plot.top + rowHeight * row;
        context.beginPath();
        context.moveTo(plot.left, dividerY);
        context.lineTo(width - plot.right, dividerY);
        context.strokeStyle = "#e5eeeb";
        context.stroke();
      }
      context.beginPath();
      for (let step = 0; step <= 180; step += 1) {
        const sampleTime = (duration * step) / 180;
        const x = plot.left + (plotWidth * step) / 180;
        const y = centerY - trace.value(sampleTime) * rowHeight * 0.34;
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = trace.color;
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.stroke();
    });

    for (let index = 0; index <= 4; index += 1) {
      const x = plot.left + (plotWidth * index) / 4;
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.top + plotHeight);
      context.strokeStyle = "rgba(84, 112, 111, 0.1)";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = "#6d807f";
      context.font = "8px Arial";
      context.textAlign = "center";
      context.fillText(format((duration * index) / 4, 2), x, height - 15);
    }
    context.fillStyle = "#607574";
    context.textAlign = "right";
    context.fillText("zaman (s)", width - plot.right, height - 15);

    const cursorProgress = duration > 0 ? (time % duration) / duration : 0;
    const cursorX = plot.left + cursorProgress * plotWidth;
    context.beginPath();
    context.moveTo(cursorX, plot.top);
    context.lineTo(cursorX, plot.top + plotHeight);
    context.strokeStyle = "#173f59";
    context.lineWidth = 1.5;
    context.setLineDash([4, 4]);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = "#173f59";
    context.beginPath();
    context.arc(cursorX, plot.top + rowHeight * 0.5 - Math.cos(omega * time) * rowHeight * 0.34, 4, 0, Math.PI * 2);
    context.fill();
  }, [amplitude, period, time]);

  return (
    <canvas
      ref={canvasRef}
      className="shm-motion-graph"
      aria-label="Konum, hız ve ivmenin zamana göre eş zamanlı değişim grafiği"
    />
  );
}

export default function HarmonicMotionLab() {
  const [experimentMode, setExperimentMode] = useState<"spring" | "pendulum">("spring");
  const [installed, setInstalled] = useState<EquipmentKind[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mass, setMass] = useState(200);
  const [springConstant, setSpringConstant] = useState(10);
  const [amplitude, setAmplitude] = useState(6);
  const [previewDisplacement, setPreviewDisplacement] = useState(6);
  const [runState, setRunState] = useState<RunState>("ready");
  const [time, setTime] = useState(0);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [message, setMessage] = useState("Statifi tezgâha sürükleyerek düzeneği kurmaya başla.");
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const elapsedBeforeStartRef = useRef(0);
  const dragStartRef = useRef<{ y: number; displacement: number } | null>(null);
  const nextTrialIdRef = useRef(1);

  const setupComplete = installed.length === EQUIPMENT_ORDER.length;
  const nextEquipment = EQUIPMENT_ORDER[installed.length];
  const massKg = mass / 1000;
  const omega = Math.sqrt(springConstant / massKg);
  const period = 2 * Math.PI * Math.sqrt(massKg / springConstant);
  const frequency = 1 / period;
  const equilibriumExtension = (massKg * G) / springConstant;
  const displacement =
    runState === "running" || runState === "paused" || runState === "complete"
      ? amplitude * Math.cos(omega * time)
      : previewDisplacement;
  const velocity = -amplitude * omega * Math.sin(omega * time);
  const acceleration = -omega * omega * displacement;
  const displacementMeters = displacement / 100;
  const velocityMeters = velocity / 100;
  const elasticEnergy = 0.5 * springConstant * displacementMeters ** 2;
  const kineticEnergy = 0.5 * massKg * velocityMeters ** 2;
  const totalEnergy = 0.5 * springConstant * (amplitude / 100) ** 2;
  const cycleCount = period > 0 ? time / period : 0;

  const installEquipment = useCallback(
    (kind: EquipmentKind) => {
      if (installed.includes(kind)) return;
      if (kind !== nextEquipment) {
        const expected = EQUIPMENT.find((item) => item.kind === nextEquipment);
        setMessage(`Sıradaki adım: ${expected?.name ?? "düzeneği tamamla"}.`);
        return;
      }
      const updated = [...installed, kind];
      setInstalled(updated);
      if (updated.length === EQUIPMENT_ORDER.length) {
        setMessage("Düzenek hazır. Kütleyi aşağı çekip bırak veya ölçümü başlat.");
      } else {
        const expected = EQUIPMENT.find(
          (item) => item.kind === EQUIPMENT_ORDER[updated.length],
        );
        setMessage(`${expected?.name} parçasını tezgâha yerleştir.`);
      }
    },
    [installed, nextEquipment],
  );

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
      const nextTime = elapsedBeforeStartRef.current +
        (timestamp - startTimeRef.current) / 1000;
      const finishTime = period * 4;
      if (nextTime >= finishTime) {
        setTime(finishTime);
        elapsedBeforeStartRef.current = finishTime;
        setRunState("complete");
        setMessage("Dört salınım tamamlandı. İdeal periyot ölçümü tabloya kaydedilebilir.");
        animationRef.current = null;
        return;
      }
      setTime(nextTime);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return stopAnimation;
  }, [period, runState, stopAnimation]);

  const resetMotion = useCallback((nextAmplitude = amplitude) => {
    stopAnimation();
    setRunState("ready");
    setTime(0);
    startTimeRef.current = null;
    elapsedBeforeStartRef.current = 0;
    setPreviewDisplacement(nextAmplitude);
  }, [amplitude, stopAnimation]);

  const releaseMass = useCallback(() => {
    if (!setupComplete) {
      setMessage("Ölçüm için önce altı parçanın tamamını doğru sırayla yerleştir.");
      return;
    }
    stopAnimation();
    setTime(0);
    elapsedBeforeStartRef.current = 0;
    startTimeRef.current = null;
    setRunState("running");
    setMessage("Hareket algılayıcısı kütlenin konumunu kaydediyor.");
  }, [setupComplete, stopAnimation]);

  const pauseOrResume = () => {
    if (runState === "running") {
      elapsedBeforeStartRef.current = time;
      startTimeRef.current = null;
      setRunState("paused");
      setMessage("Ölçüm duraklatıldı. Grafikteki eş zamanlı değerleri incele.");
    } else if (runState === "paused") {
      startTimeRef.current = null;
      setRunState("running");
      setMessage("Ölçüm devam ediyor.");
    }
  };

  const changeParameter = (action: () => void, nextAmplitude?: number) => {
    action();
    resetMotion(nextAmplitude ?? amplitude);
    setMessage("Değişken ayarlandı. Kütleyi çekip bırakarak yeni ölçümü başlat.");
  };

  const onMassPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setupComplete || runState === "running") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { y: event.clientY, displacement: previewDisplacement };
    setRunState("ready");
    setTime(0);
    setMessage("Kütleyi aşağı çek; bıraktığında ölçüm başlayacak.");
  };

  const onMassPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const deltaCm = (event.clientY - dragStartRef.current.y) / 7;
    const nextDisplacement = clamp(dragStartRef.current.displacement + deltaCm, 2, 10);
    setPreviewDisplacement(nextDisplacement);
    setAmplitude(Math.round(nextDisplacement * 10) / 10);
  };

  const onMassPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    releaseMass();
  };

  const recordTrial = () => {
    if (!setupComplete || (runState !== "complete" && time < period)) {
      setMessage("Kaydetmeden önce en az bir tam salınımı gözle.");
      return;
    }
    setTrials((current) => [
      ...current,
      {
        id: nextTrialIdRef.current++,
        mass,
        springConstant,
        amplitude,
        period,
        frequency,
      },
    ]);
    setMessage("İdeal ölçüm deney günlüğüne kaydedildi.");
  };

  const oscillatorOffsetPixels = displacement * 6.4;
  const energySafeTotal = Math.max(totalEnergy, 0.000001);

  const changeExperiment = (mode: "spring" | "pendulum") => {
    stopAnimation();
    setRunState("ready");
    setTime(0);
    startTimeRef.current = null;
    elapsedBeforeStartRef.current = 0;
    setExperimentMode(mode);
  };

  if (experimentMode === "pendulum") {
    return (
      <section className="harmonic-lab" id="basit-harmonik-hareket">
        <div className="shm-heading">
          <div>
            <span>MODÜL 07 · BASİT HARMONİK HAREKET</span>
            <h2>Basit Harmonik Hareket</h2>
            <p>
              İki gerçek laboratuvar düzeneğinden birini seç; sistemi kendin kur,
              hareketi başlat ve ideal ölçümleri canlı olarak incele.
            </p>
          </div>
          <aside>
            <b>TYMM · 12. SINIF</b>
            <span>Deney tasarlama · veri okuryazarlığı</span>
            <small>İdeal, sürtünmesiz ve sönümsüz hareket modeli</small>
          </aside>
        </div>
        <ExperimentTabs active={experimentMode} onChange={changeExperiment} />
        <SimplePendulumLab />
      </section>
    );
  }

  return (
    <section className="harmonic-lab" id="basit-harmonik-hareket">
      <div className="shm-heading">
        <div>
          <span>MODÜL 07 · BASİT HARMONİK HAREKET</span>
          <h2>Basit Harmonik Hareket</h2>
          <p>
            İki gerçek laboratuvar düzeneğinden birini seç; sistemi kendin kur,
            hareketi başlat ve ideal ölçümleri canlı olarak incele.
          </p>
        </div>
        <aside>
          <b>TYMM · 12. SINIF</b>
          <span>Deney tasarlama · veri okuryazarlığı</span>
          <small>İdeal, sürtünmesiz ve sönümsüz hareket modeli</small>
        </aside>
      </div>

      <ExperimentTabs active={experimentMode} onChange={changeExperiment} />

      <div className="shm-learning-strip">
        <span><b>1</b> Düzeneği kur</span>
        <span><b>2</b> Kütleyi çekip bırak</span>
        <span><b>3</b> Grafikleri karşılaştır</span>
        <span><b>4</b> Sonucu kaydet</span>
      </div>

      <div className="shm-workspace">
        <aside className="shm-equipment-panel">
          <div className="shm-panel-heading">
            <div>
              <small>MALZEME RAFI</small>
              <h3>Sırayla tezgâha yerleştir</h3>
            </div>
            <strong>{installed.length}/{EQUIPMENT_ORDER.length}</strong>
          </div>
          <div className="shm-equipment-list">
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
                  <span className="shm-step-number">{isInstalled ? "✓" : index + 1}</span>
                  <EquipmentIcon kind={item.kind} />
                  <span>
                    <b>{item.name}</b>
                    <small>{isInstalled ? "Yerleştirildi" : item.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <p>Dokunmatik ekranda parçaya dokunarak da ekleyebilirsin.</p>
        </aside>

        <div
          className={`shm-stage ${setupComplete ? "setup-complete" : ""} ${isDragOver ? "drag-over" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={() => setIsDragOver(true)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragOver(false);
          }}
          onDrop={onStageDrop}
          aria-label="Basit harmonik hareket yay-kütle deney tezgâhı"
        >
          <div className="shm-stage-toolbar">
            <div>
              <small>DENEY TEZGÂHI</small>
              <b>{setupComplete ? "Yay–kütle düzeneği hazır" : "Parçaları bu alana bırak"}</b>
            </div>
            <div className="shm-live-timer">
              <span>
                <small>ZAMAN</small>
                <b>{format(time, 2)} s</b>
              </span>
              <span>
                <small>SALINIM</small>
                <b>{format(cycleCount, 2)}</b>
              </span>
              <i className={runState === "running" ? "active" : ""} />
            </div>
          </div>

          <div className="shm-apparatus">
            <div className="shm-lab-wall">
              <span>YAY–KÜTLE DENEYİ</span>
            </div>
            <div className="shm-bench">
              <i className="shm-bench-top" />
              <i className="shm-bench-leg left" />
              <i className="shm-bench-leg right" />
            </div>

            {installed.includes("stand") && (
              <div className="shm-stand">
                <i className="shm-stand-base" />
                <i className="shm-stand-rod" />
                <i className="shm-stand-clamp" />
                <i className="shm-stand-arm" />
                <i className="shm-stand-hook" />
              </div>
            )}

            {installed.includes("spring") && (
              <SpringCoil offset={oscillatorOffsetPixels} />
            )}

            {installed.includes("mass") && (
              <button
                className={`shm-mass ${setupComplete ? "grabbable" : ""}`}
                type="button"
                style={{
                  transform: `translate3d(0, ${oscillatorOffsetPixels}px, 0)`,
                }}
                aria-label="Kütleyi aşağı çekip bırak"
                onPointerDown={onMassPointerDown}
                onPointerMove={onMassPointerMove}
                onPointerUp={onMassPointerUp}
                onPointerCancel={() => { dragStartRef.current = null; }}
              >
                <i className="shm-mass-hook" />
                <span>{mass} g</span>
                <i className="shm-mass-slot one" />
                <i className="shm-mass-slot two" />
                <i className="shm-mass-slot three" />
              </button>
            )}

            {installed.includes("ruler") && (
              <div className="shm-ruler">
                {Array.from({ length: 21 }, (_, index) => (
                  <i key={index} className={index % 5 === 0 ? "major" : ""} />
                ))}
                <span>cm</span>
              </div>
            )}

            {installed.includes("ruler") && setupComplete && (
              <div className="shm-reference-marks">
                <span className="upper">−A</span>
                <span className="equilibrium">0 · denge</span>
                <span className="lower">+A</span>
              </div>
            )}

            {installed.includes("sensor") && (
              <div className={`shm-motion-sensor ${runState === "running" ? "active" : ""}`}>
                <i className="shm-sensor-eye" />
                <i className="shm-sensor-body" />
                <span>HAREKET<br />ALGILAYICI</span>
                {runState === "running" && <b />}
              </div>
            )}

            {installed.includes("timer") && (
              <>
                <div className="shm-sensor-cable" />
                <div className="shm-data-logger">
                  <small>MOTION TIMER</small>
                  <strong>{format(time, 2)}</strong>
                  <em>s</em>
                  <i className={runState === "running" ? "active" : ""} />
                  <button type="button" aria-label="Zamanlayıcı düğmesi" />
                </div>
              </>
            )}

            {!setupComplete && (
              <div className="shm-drop-hint">
                <b>Malzemeyi buraya bırak</b>
                <span>Her parça gerçek bağlantı noktasına oturur.</span>
              </div>
            )}
            {setupComplete && runState !== "running" && (
              <div className="shm-grab-hint">KÜTLEYİ TUT · AŞAĞI ÇEK · BIRAK</div>
            )}
          </div>

          <div className={`shm-status ${setupComplete ? "ready" : ""}`} aria-live="polite">
            <b>{setupComplete ? "YÖNERGE" : `KURULUM ${installed.length + 1}/6`}</b>
            <span>{message}</span>
          </div>
        </div>
      </div>

      <section className="shm-controls">
        <article>
          <small>DEĞİŞKEN 1</small>
          <h3>Asılı kütle</h3>
          <label>
            <input
              type="range"
              min="100"
              max="500"
              step="50"
              value={mass}
              onChange={(event) => changeParameter(() => setMass(Number(event.target.value)))}
              disabled={runState === "running"}
            />
            <b>{mass} g</b>
          </label>
        </article>
        <article>
          <small>DEĞİŞKEN 2</small>
          <h3>Yayın sertliği</h3>
          <label>
            <input
              type="range"
              min="5"
              max="20"
              step="1"
              value={springConstant}
              onChange={(event) => changeParameter(() => setSpringConstant(Number(event.target.value)))}
              disabled={runState === "running"}
            />
            <b>{springConstant} N/m</b>
          </label>
        </article>
        <article>
          <small>BAŞLANGIÇ</small>
          <h3>Çekilme miktarı</h3>
          <label>
            <input
              type="range"
              min="2"
              max="10"
              step="1"
              value={amplitude}
              onChange={(event) => {
                const value = Number(event.target.value);
                changeParameter(() => setAmplitude(value), value);
              }}
              disabled={runState === "running"}
            />
            <b>{format(amplitude, 1)} cm</b>
          </label>
        </article>
        <div className="shm-action-buttons">
          <button type="button" onClick={releaseMass} disabled={!setupComplete || runState === "running"}>
            {runState === "complete" ? "YENİDEN BIRAK" : "KÜTLEYİ BIRAK"}
          </button>
          <button type="button" onClick={pauseOrResume} disabled={runState === "ready" || runState === "complete"}>
            {runState === "paused" ? "DEVAM ET" : "DURAKLAT"}
          </button>
          <button type="button" onClick={() => resetMotion()} disabled={!setupComplete}>
            BAŞA AL
          </button>
        </div>
      </section>

      <section className="shm-observation-grid">
        <article className="shm-graph-card">
          <div>
            <small>CANLI HAREKET GRAFİKLERİ</small>
            <h3>Aynı anda konum, hız ve ivme</h3>
            <p>Dikey imleç, üç grafikte aynı anı gösterir.</p>
          </div>
          <MotionGraph time={time} period={period} amplitude={amplitude} />
        </article>
        <article className="shm-live-values">
          <small>ALGILAYICI OKUMALARI</small>
          <h3>Kütlenin hangi özelliği ölçülüyor?</h3>
          <div>
            <span><small>Konum x</small><b>{format(displacement, 2)} cm</b></span>
            <span><small>Hız v</small><b>{format(velocity, 2)} cm/s</b></span>
            <span><small>İvme a</small><b>{format(acceleration, 2)} cm/s²</b></span>
            <span><small>Periyot T</small><b>{format(period, 3)} s</b></span>
            <span><small>Frekans f</small><b>{format(frequency, 3)} Hz</b></span>
            <span><small>Denge uzaması</small><b>{format(equilibriumExtension * 100, 1)} cm</b></span>
          </div>
        </article>
        <article className="shm-energy-card">
          <small>ENERJİ DÖNÜŞÜMÜ</small>
          <h3>Toplam enerji sabit kalır</h3>
          <div className="shm-energy-bar elastic">
            <span style={{ width: `${(elasticEnergy / energySafeTotal) * 100}%` }} />
            <b>Yay potansiyel enerjisi</b>
            <em>{format(elasticEnergy, 4)} J</em>
          </div>
          <div className="shm-energy-bar kinetic">
            <span style={{ width: `${(kineticEnergy / energySafeTotal) * 100}%` }} />
            <b>Kinetik enerji</b>
            <em>{format(kineticEnergy, 4)} J</em>
          </div>
          <div className="shm-total-energy">
            <span>Toplam</span>
            <b>{format(totalEnergy, 4)} J</b>
            <small>İdeal sistemde korunur</small>
          </div>
        </article>
      </section>

      <section className="shm-data-section">
        <div className="shm-data-heading">
          <div>
            <small>DENEY GÜNLÜĞÜ</small>
            <h3>Tek değişkeni değiştir, sonucu karşılaştır</h3>
            <p>Kütle, yay sertliği veya genliği değiştirerek yeni bir ölçüm kaydet.</p>
          </div>
          <button type="button" onClick={recordTrial}>ÖLÇÜMÜ KAYDET</button>
        </div>
        <div className="shm-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Deneme</th>
                <th>Kütle</th>
                <th>Yay sertliği</th>
                <th>Genlik</th>
                <th>Periyot</th>
                <th>Frekans</th>
              </tr>
            </thead>
            <tbody>
              {trials.length === 0 ? (
                <tr><td colSpan={6}>Bir tam salınımı gözle ve ilk ideal ölçümü kaydet.</td></tr>
              ) : trials.map((trial) => (
                <tr key={trial.id}>
                  <td>{trial.id}</td>
                  <td>{trial.mass} g</td>
                  <td>{trial.springConstant} N/m</td>
                  <td>{format(trial.amplitude, 1)} cm</td>
                  <td>{format(trial.period, 3)} s</td>
                  <td>{format(trial.frequency, 3)} Hz</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="shm-report">
        <div>
          <small>KISA DENEY RAPORU</small>
          <h3>Kanıtını ölçüm tablosundan göster</h3>
          <p>Yanıtlarında kaydettiğin denemeleri karşılaştır.</p>
        </div>
        <label>
          <span>1 · Kütleyi artırdığında salınım süresi nasıl değişti?</span>
          <textarea rows={4} aria-label="Kütlenin salınım süresine etkisi" />
        </label>
        <label>
          <span>2 · Daha sert bir yay kullandığında ne gözledin?</span>
          <textarea rows={4} aria-label="Yay sertliğinin salınıma etkisi" />
        </label>
        <label>
          <span>3 · Genliği değiştirmek periyodu değiştirdi mi?</span>
          <textarea rows={4} aria-label="Genlik ile periyot ilişkisi" />
        </label>
        <label>
          <span>4 · Denge ve uç konumlarda enerji nasıl dönüştü?</span>
          <textarea rows={4} aria-label="Basit harmonik harekette enerji dönüşümü" />
        </label>
      </section>
    </section>
  );
}
