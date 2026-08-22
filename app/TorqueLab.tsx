"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SetupKind =
  | "base"
  | "main-disk"
  | "stepped-pulley"
  | "optical-reader"
  | "table-pulley"
  | "string-pan"
  | "data-logger"
  | "attachments";
type ExperimentKind = "radius" | "mass" | "inertia";
type AttachmentKind = "main" | "second-disk" | "ring" | "block";
type RunState = "ready" | "running" | "complete";

type Trial = {
  id: number;
  experiment: ExperimentKind;
  radius: number;
  addedMass: number;
  totalHangingMass: number;
  attachment: AttachmentKind;
  attachmentName: string;
  inertia: number;
  force: number;
  torque: number;
  measuredAlpha: number;
  theoreticalAlpha: number;
};

const G = 9.81;
const PAN_MASS = 0.005;
const MIME = "application/x-torque-equipment";
const SETUP_ORDER: SetupKind[] = [
  "base",
  "main-disk",
  "stepped-pulley",
  "optical-reader",
  "table-pulley",
  "string-pan",
  "data-logger",
  "attachments",
];
const EQUIPMENT: Array<{
  kind: SetupKind;
  name: string;
  shortName: string;
}> = [
  {
    kind: "base",
    name: "Ayarlanabilir ayaklı metal taban ve dönme ekseni",
    shortName: "Taban ve eksen",
  },
  {
    kind: "main-disk",
    name: "991 g kütleli yatay ana disk",
    shortName: "Ana disk",
  },
  {
    kind: "stepped-pulley",
    name: "1,50 - 2,00 - 2,50 cm kademeli yarıçap makarası",
    shortName: "Kademeli makara",
  },
  {
    kind: "optical-reader",
    name: "Disk kenarına temas eden optik okuyucu",
    shortName: "Optik okuyucu",
  },
  {
    kind: "table-pulley",
    name: "Masa kenarı ip yönlendirme makarası",
    shortName: "Kenar makarası",
  },
  {
    kind: "string-pan",
    name: "İp, 5 g kefe ve asılı kütleler",
    shortName: "İp, kefe, kütle",
  },
  {
    kind: "data-logger",
    name: "Hareket zamanlayıcı ve canlı grafik ekranı",
    shortName: "Veri ekranı",
  },
  {
    kind: "attachments",
    name: "Yedek disk, metal halka ve metal blok",
    shortName: "Ek cisimler",
  },
];
const RADII = [0.015, 0.02, 0.025];
const MASSES = [0.03, 0.05, 0.07, 0.09];
const ATTACHMENTS: Array<{
  kind: AttachmentKind;
  name: string;
  inertia: number;
  addedInertia: number;
}> = [
  {
    kind: "main",
    name: "Ana disk",
    inertia: 7.5e-3,
    addedInertia: 0,
  },
  {
    kind: "second-disk",
    name: "Ana disk + yedek disk",
    inertia: 14.72e-3,
    addedInertia: 7.22e-3,
  },
  {
    kind: "ring",
    name: "Ana disk + metal halka",
    inertia: 9.96e-3,
    addedInertia: 2.46e-3,
  },
  {
    kind: "block",
    name: "Ana disk + metal blok",
    inertia: 10.48e-3,
    addedInertia: 2.98e-3,
  },
];

const EQUIPMENT_IMAGES: Record<SetupKind, string> = {
  base: "./torque-base-spindle-v2.webp",
  "main-disk": "./torque-main-disc-v2.webp",
  "stepped-pulley": "./torque-stepped-pulley-v2.webp",
  "optical-reader": "./torque-optical-reader-v2.webp",
  "table-pulley": "./torque-edge-pulley-v2.webp",
  "string-pan": "./torque-mass-pan-v2.webp",
  "data-logger": "./motion-equipment-timer.webp",
  attachments: "./torque-inertia-kit-v2.webp",
};

function format(value: number, digits = 2) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function EquipmentIcon({ kind }: { kind: SetupKind }) {
  return (
    <span className={`torque-equipment-icon torque-icon-${kind}`} aria-hidden="true">
      <img src={EQUIPMENT_IMAGES[kind]} alt="" draggable={false} />
    </span>
  );
}

function VelocityGraph({
  alpha,
  progress,
  running,
}: {
  alpha: number;
  progress: number;
  running: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = 210;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fbfdfc";
    context.fillRect(0, 0, width, height);

    const plot = { left: 46, top: 20, right: 16, bottom: 34 };
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    context.font = "8px Arial";
    context.textAlign = "right";
    context.textBaseline = "middle";

    for (let index = 0; index <= 4; index += 1) {
      const y = plot.top + (plotHeight * index) / 4;
      context.beginPath();
      context.moveTo(plot.left, y);
      context.lineTo(width - plot.right, y);
      context.strokeStyle = "#dce8e4";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = "#718589";
      context.fillText(
        format(alpha * 5 * (1 - index / 4), 1),
        plot.left - 7,
        y,
      );
    }

    context.beginPath();
    context.moveTo(plot.left, plot.top);
    context.lineTo(plot.left, plot.top + plotHeight);
    context.lineTo(width - plot.right, plot.top + plotHeight);
    context.strokeStyle = "#587076";
    context.lineWidth = 1.5;
    context.stroke();

    const activeProgress = running ? progress : progress > 0 ? 1 : 0;
    if (activeProgress > 0) {
      context.beginPath();
      context.moveTo(plot.left, plot.top + plotHeight);
      context.lineTo(
        plot.left + plotWidth * activeProgress,
        plot.top + plotHeight * (1 - activeProgress),
      );
      context.strokeStyle = "#ef9f28";
      context.lineWidth = 4;
      context.lineCap = "round";
      context.stroke();
      context.beginPath();
      context.arc(
        plot.left + plotWidth * activeProgress,
        plot.top + plotHeight * (1 - activeProgress),
        5,
        0,
        Math.PI * 2,
      );
      context.fillStyle = "#167f75";
      context.fill();
    }

    context.fillStyle = "#60777c";
    context.font = "bold 9px Arial";
    context.textAlign = "center";
    context.fillText("zaman (s)", plot.left + plotWidth / 2, height - 8);
    context.save();
    context.translate(12, plot.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText("açısal hız (rad/s)", 0, 0);
    context.restore();
  }, [alpha, progress, running]);

  return (
    <canvas
      ref={canvasRef}
      className="torque-velocity-canvas"
      aria-label="Açısal hız zaman grafiği"
    />
  );
}

function RelationBars({
  title,
  subtitle,
  values,
}: {
  title: string;
  subtitle: string;
  values: Array<{ label: string; value: number; active?: boolean }>;
}) {
  const max = Math.max(...values.map((value) => value.value), 0.001);
  return (
    <article className="torque-relation-card">
      <div>
        <b>{title}</b>
        <small>{subtitle}</small>
      </div>
      <div className="torque-relation-bars">
        {values.map((item) => (
          <span key={item.label} className={item.active ? "active" : ""}>
            <i style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }} />
            <b>{format(item.value, 2)}</b>
            <small>{item.label}</small>
          </span>
        ))}
      </div>
    </article>
  );
}

export default function TorqueLab() {
  const animationRef = useRef<number | null>(null);
  const runStartedAtRef = useRef(0);
  const nextIdRef = useRef(1);
  const [installed, setInstalled] = useState<SetupKind[]>([]);
  const [experiment, setExperiment] = useState<ExperimentKind>("radius");
  const [radius, setRadius] = useState(0.015);
  const [addedMass, setAddedMass] = useState(0.04);
  const [attachment, setAttachment] = useState<AttachmentKind>("main");
  const [stringWound, setStringWound] = useState(false);
  const [sensorZeroed, setSensorZeroed] = useState(false);
  const [runState, setRunState] = useState<RunState>("ready");
  const [progress, setProgress] = useState(0);
  const [timer, setTimer] = useState(0);
  const [message, setMessage] = useState(
    "1. adım: Metal tabanı ve dönme eksenini tezgâha yerleştir.",
  );
  const [records, setRecords] = useState<Trial[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [report, setReport] = useState({
    radius: "",
    mass: "",
    inertia: "",
    graph: "",
    conclusion: "",
  });

  const setupComplete = installed.length === SETUP_ORDER.length;
  const nextSetup =
    SETUP_ORDER.find((kind) => !installed.includes(kind)) ?? null;
  const selectedAttachment =
    ATTACHMENTS.find((item) => item.kind === attachment) ?? ATTACHMENTS[0];
  const totalHangingMass = addedMass + PAN_MASS;
  const force = totalHangingMass * G;
  const torque = force * radius;
  const theoreticalAlpha = torque / selectedAttachment.inertia;
  const measuredAlpha = theoreticalAlpha;
  const latest = records.at(-1) ?? null;
  const currentAngularSpeed = measuredAlpha * timer;
  const visibleWeightCount = Math.max(1, Math.round((addedMass * 1000) / 10));

  const completion = useMemo(() => {
    const radiusTrials = new Set(
      records
        .filter((record) => record.experiment === "radius")
        .map((record) => record.radius),
    ).size;
    const massTrials = new Set(
      records
        .filter((record) => record.experiment === "mass")
        .map((record) => record.addedMass),
    ).size;
    const inertiaTrials = new Set(
      records
        .filter((record) => record.experiment === "inertia")
        .map((record) => record.attachment),
    ).size;
    return {
      radius: Math.min(radiusTrials, 3),
      mass: Math.min(massTrials, 4),
      inertia: Math.min(inertiaTrials, 4),
      total: Math.min(radiusTrials, 3) + Math.min(massTrials, 4) + Math.min(inertiaTrials, 4),
    };
  }, [records]);

  const addEquipment = (kind: SetupKind) => {
    if (runState === "running" || installed.includes(kind)) return;
    if (!SETUP_ORDER.includes(kind) || kind !== nextSetup) {
      const expectedName = EQUIPMENT.find((item) => item.kind === nextSetup)?.shortName;
      setMessage(`Sıradaki adım: ${expectedName ?? "düzeneği tamamlama parçası"}.`);
      return;
    }
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    if (nextInstalled.length === SETUP_ORDER.length) {
      setMessage("Düzenek hazır. Deney serisini seç, ipi sar ve okuyucuyu sıfırla.");
    } else {
      const placedName = EQUIPMENT.find((item) => item.kind === kind)?.shortName;
      const followingKind = SETUP_ORDER.find((item) => !nextInstalled.includes(item));
      const followingName = EQUIPMENT.find((item) => item.kind === followingKind)?.shortName;
      setMessage(
        `${placedName} yerine oturdu. Sıradaki adım: ${followingName}.`,
      );
    }
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
    setIsDragOver(false);
    const kind = event.dataTransfer.getData(MIME) as SetupKind;
    if (SETUP_ORDER.includes(kind)) addEquipment(kind);
  };

  const selectRadius = (value: number) => {
    if (runState === "running") return;
    setExperiment("radius");
    setRadius(value);
    setAddedMass(0.04);
    setAttachment("main");
    setStringWound(false);
    setMessage("Yarıçap serisi seçildi: kütle 40 g, sistem ana disk olarak sabitlendi.");
  };

  const selectMass = (value: number) => {
    if (runState === "running") return;
    setExperiment("mass");
    setAddedMass(value);
    setRadius(0.02);
    setAttachment("main");
    setStringWound(false);
    setMessage("Kütle serisi seçildi: yarıçap 2,00 cm ve sistem ana disk olarak sabitlendi.");
  };

  const selectAttachment = (value: AttachmentKind) => {
    if (runState === "running") return;
    setExperiment("inertia");
    setAttachment(value);
    setAddedMass(0.04);
    setRadius(0.02);
    setStringWound(false);
    setMessage("Eylemsizlik momenti serisi seçildi: kütle 40 g ve yarıçap 2,00 cm.");
  };

  const windString = () => {
    if (!setupComplete || runState === "running") {
      setMessage("İpi sarmadan önce düzenek kurulumunu tamamla.");
      return;
    }
    setStringWound(true);
    setProgress(0);
    setTimer(0);
    setRunState("ready");
    setShowAnalysis(false);
    setMessage(
      `İp ${format(radius * 100, 2)} cm kademeye sarıldı. Optik okuyucuyu sıfırla.`,
    );
  };

  const zeroSensor = () => {
    if (!setupComplete || runState === "running") return;
    setSensorZeroed(true);
    setMessage("Optik okuyucu 0,00 rad/s gösteriyor. Kefe bırakılmaya hazır.");
  };

  const release = () => {
    if (!setupComplete) {
      setMessage("Önce deney düzeneğini kur.");
      return;
    }
    if (!stringWound) {
      setMessage("İpi seçilen kademeli yarıçapa sar.");
      return;
    }
    if (!sensorZeroed) {
      setMessage("Ölçümden önce optik okuyucuyu sıfırla.");
      return;
    }
    setRunState("running");
    setProgress(0);
    setTimer(0);
    setShowAnalysis(false);
    setMessage("Kefe düşüyor; disk hızlanırken optik okuyucu veri topluyor.");
    runStartedAtRef.current = performance.now();
  };

  useEffect(() => {
    if (runState !== "running") return;
    const duration = 3200;
    const animate = (now: number) => {
      const nextProgress = Math.min((now - runStartedAtRef.current) / duration, 1);
      setProgress(nextProgress);
      setTimer(nextProgress * 5);

      if (nextProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        const trial: Trial = {
          id: nextIdRef.current,
          experiment,
          radius,
          addedMass,
          totalHangingMass,
          attachment,
          attachmentName: selectedAttachment.name,
          inertia: selectedAttachment.inertia,
          force,
          torque,
          measuredAlpha,
          theoreticalAlpha,
        };
        nextIdRef.current += 1;
        setRecords((current) => [...current, trial]);
        setRunState("complete");
        setStringWound(false);
        setSensorZeroed(false);
        setMessage(
          `Ölçüm tamam: grafiğin eğimi ${format(measuredAlpha, 3)} rad/s².`,
        );
      }
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [
    addedMass,
    attachment,
    experiment,
    force,
    measuredAlpha,
    radius,
    runState,
    selectedAttachment.inertia,
    selectedAttachment.name,
    theoreticalAlpha,
    torque,
    totalHangingMass,
  ]);

  const resetApparatus = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setInstalled([]);
    setStringWound(false);
    setSensorZeroed(false);
    setRunState("ready");
    setProgress(0);
    setTimer(0);
    setShowAnalysis(false);
    setIsDragOver(false);
    setMessage("1. adım: Metal tabanı ve dönme eksenini tezgâha yerleştir.");
  };

  const discStyle = {
    "--torque-disc-turn": `${progress * 1260}deg`,
    "--torque-edge-turn": `${progress * -1260}deg`,
    "--torque-pan-drop": `${progress * 132}px`,
    "--torque-radius-scale": `${radius / 0.02}`,
    "--torque-spool-half": `${radius * 1600}px`,
  } as CSSProperties;

  const radiusBarValues = RADII.map((value) => ({
    label: `${format(value * 100, 1)} cm`,
    value: ((0.04 + PAN_MASS) * G * value) / 7.5e-3,
    active: experiment === "radius" && radius === value,
  }));
  const massBarValues = MASSES.map((value) => ({
    label: `${Math.round(value * 1000)} g`,
    value: ((value + PAN_MASS) * G * 0.02) / 7.5e-3,
    active: experiment === "mass" && addedMass === value,
  }));
  const inertiaBarValues = ATTACHMENTS.map((value) => ({
    label: value.kind === "main" ? "Ana" : value.kind === "second-disk" ? "+ Disk" : value.kind === "ring" ? "+ Halka" : "+ Blok",
    value: ((0.04 + PAN_MASS) * G * 0.02) / value.inertia,
    active: experiment === "inertia" && attachment === value.kind,
  }));

  return (
    <section className="torque-lab-section" id="tork-deneyi">
      <div className="torque-heading">
        <div>
          <span>MODÜL 06 · DENEY 6</span>
          <h2>Dönme dinamiği ve tork</h2>
          <p>
            PDF’deki düzeneği kur; dönme yarıçapı, asılı kütle ve eylemsizlik
            momentinin açısal ivmeye etkisini gerçek ölçüm akışıyla araştır.
          </p>
        </div>
        <aside>
          <b>TYMM 12. SINIF</b>
          <span>FİZ.12.1.1 · FİZ.12.1.5</span>
          <small>tümevarımsal akıl yürütme · veri okuryazarlığı</small>
        </aside>
      </div>

      <div className="torque-learning-strip">
        <span>
          <b>1</b> Düzeneği sırayla kur
        </span>
        <span>
          <b>2</b> Yarıçapı, kütleyi veya cismi seç
        </span>
        <span>
          <b>3</b> İpi sar, sıfırla ve ölç
        </span>
      </div>

      <section className="torque-command-center" aria-label="Tork deneyi hızlı kontrol alanı">
        <div className="torque-command-copy">
          <small>DENEYİ SEÇ VE ÇALIŞTIR</small>
          <b>
            {!setupComplete
              ? `Önce ${SETUP_ORDER.length - installed.length} parçayı sırayla yerleştir`
              : experiment === "radius"
                ? "Yarıçap – açısal ivme"
                : experiment === "mass"
                  ? "Kütle – açısal ivme"
                  : "Eylemsizlik momenti – açısal ivme"}
          </b>
          <span>
            {setupComplete
              ? `r ${format(radius * 100, 2)} cm · ${Math.round(addedMass * 1000)} g · ${selectedAttachment.name}`
              : "Vurgulanan parçaya dokunabilir veya sahneye sürükleyebilirsin; düzenek adım adım oluşur."}
          </span>
        </div>

        <div className="torque-command-options">
          <div className="torque-series-tabs" role="group" aria-label="Araştırma serisi">
            <button
              type="button"
              className={experiment === "radius" ? "selected" : ""}
              onClick={() => selectRadius(radius)}
              disabled={!setupComplete || runState === "running"}
            >
              A · Yarıçap
            </button>
            <button
              type="button"
              className={experiment === "mass" ? "selected" : ""}
              onClick={() => selectMass(MASSES.includes(addedMass) ? addedMass : MASSES[0])}
              disabled={!setupComplete || runState === "running"}
            >
              B · Kütle
            </button>
            <button
              type="button"
              className={experiment === "inertia" ? "selected" : ""}
              onClick={() => selectAttachment(attachment)}
              disabled={!setupComplete || runState === "running"}
            >
              C · Dönen cisim
            </button>
          </div>

          <div className="torque-value-tabs" role="group" aria-label="Deney değeri">
            {experiment === "radius" && RADII.map((value) => (
              <button
                key={value}
                type="button"
                className={radius === value ? "selected" : ""}
                onClick={() => selectRadius(value)}
                disabled={!setupComplete || runState === "running"}
              >
                {format(value * 100, 2)} cm
              </button>
            ))}
            {experiment === "mass" && MASSES.map((value) => (
              <button
                key={value}
                type="button"
                className={addedMass === value ? "selected" : ""}
                onClick={() => selectMass(value)}
                disabled={!setupComplete || runState === "running"}
              >
                {Math.round(value * 1000)} g
              </button>
            ))}
            {experiment === "inertia" && ATTACHMENTS.map((item) => (
              <button
                key={item.kind}
                type="button"
                className={attachment === item.kind ? "selected" : ""}
                onClick={() => selectAttachment(item.kind)}
                disabled={!setupComplete || runState === "running"}
              >
                {item.kind === "main"
                  ? "Ana disk"
                  : item.kind === "second-disk"
                    ? "+ Yedek disk"
                    : item.kind === "ring"
                      ? "+ Halka"
                      : "+ Blok"}
              </button>
            ))}
          </div>
        </div>

        <div className="torque-command-actions">
          <button type="button" onClick={windString} disabled={!setupComplete || runState === "running"}>
            <span>1</span> İpi sar
          </button>
          <button type="button" onClick={zeroSensor} disabled={!setupComplete || runState === "running"}>
            <span>2</span> Sıfırla
          </button>
          <button
            className="primary"
            type="button"
            onClick={release}
            disabled={!setupComplete || runState === "running"}
          >
            <span>3</span> {runState === "running" ? "Ölçülüyor" : "Kefeyi bırak"}
          </button>
        </div>
      </section>

      <div className="torque-workspace">
        <section className="torque-equipment-panel">
          <div className="torque-panel-heading">
            <div>
              <small>KURULUM SIRASI</small>
              <h3>Düzeneği parça parça kur</h3>
            </div>
            <span>{installed.length}/{SETUP_ORDER.length}</span>
          </div>
          <p>Vurgulanan parçayı tezgâha sürükle veya parçaya dokun.</p>
          <div className="torque-equipment-list">
            {EQUIPMENT.map((item) => {
              const isInstalled = installed.includes(item.kind);
              const isNext = item.kind === nextSetup;
              return (
                <button
                  key={item.kind}
                  type="button"
                  draggable={!isInstalled && isNext && runState !== "running"}
                  className={`${isInstalled ? "installed" : ""} ${isNext ? "next" : ""}`}
                  onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                  onClick={() => addEquipment(item.kind)}
                  disabled={isInstalled || !isNext || runState === "running"}
                  title={item.name}
                >
                  <EquipmentIcon kind={item.kind} />
                  <span>
                    <b>{item.shortName}</b>
                    <small>
                      {isInstalled
                        ? "Tezgâha yerleşti"
                        : isNext
                          ? `${installed.length + 1}. adım · şimdi ekle`
                          : "Önce üstteki adımı tamamla"}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
          <small className="torque-touch-note">
            Her parça, önceki adım tamamlanınca etkinleşir ve aynı sahnede doğru konuma oturur.
          </small>
        </section>

        <div
          className={`torque-stage ${setupComplete ? "setup-complete" : ""} ${isDragOver ? "drag-over" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={() => setIsDragOver(true)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDrop={onStageDrop}
          aria-label="Tork deney malzemelerinin bırakılacağı deney tezgâhı"
        >
          <div className="torque-stage-toolbar">
            <div>
              <small>DENEY TEZGÂHI</small>
              <b>
                {runState === "running"
                  ? "Optik okuyucu ölçüm alıyor"
                  : runState === "complete"
                    ? "Ölçüm tamamlandı"
                    : setupComplete
                      ? "Düzenek ölçüme hazır"
                      : "Düzeneği sırayla tamamla"}
              </b>
            </div>
            <div className="torque-live-readouts">
              <span>
                <small>Zaman</small>
                <b>{format(timer, 2)} s</b>
              </span>
              <span>
                <small>Açısal hız</small>
                <b>{format(currentAngularSpeed, 2)} rad/s</b>
              </span>
              <span>
                <small>Grafik eğimi</small>
                <b>{runState === "complete" ? format(measuredAlpha, 3) : "—"} rad/s²</b>
              </span>
              <button type="button" onClick={resetApparatus} disabled={runState === "running"}>
                Düzeneği sök
              </button>
            </div>
          </div>

          <div className="torque-apparatus" style={discStyle}>
            <img
              className="torque-bench-photo"
              src="./motion-lab-bench-v3.webp"
              alt=""
              draggable={false}
              aria-hidden="true"
            />
            <div className="torque-lab-wall">
              <span>DÖNME DİNAMİĞİ DENEYİ</span>
            </div>

            <div className="torque-kinetic-rig" aria-label="Parça parça kurulan hareketli dönme dinamiği düzeneği">
              {installed.includes("base") && (
                <div className="torque-kinetic-base">
                  <i className="kinetic-base-rail" />
                  <i className="kinetic-base-foot foot-left" />
                  <i className="kinetic-base-foot foot-right" />
                  <i className="kinetic-axis-bearing" />
                  <i className="kinetic-axis-shaft" />
                  <span>Metal taban ve dönme ekseni</span>
                </div>
              )}

              {installed.includes("main-disk") && (
                <div className={`torque-kinetic-disc ${runState === "running" ? "running" : ""}`}>
                  <i className="kinetic-disc-edge" />
                  <div className="kinetic-disc-surface">
                    <i className="kinetic-disc-marker" />
                    <i className="kinetic-disc-stud stud-one" />
                    <i className="kinetic-disc-stud stud-two" />
                    <i className="kinetic-disc-stud stud-three" />
                    <i className="kinetic-disc-hub" />
                    {attachment === "second-disk" && <i className="kinetic-extra-disc" />}
                    {attachment === "ring" && <i className="kinetic-metal-ring" />}
                    {attachment === "block" && <i className="kinetic-metal-block" />}
                  </div>
                  <span>Ana disk · {attachment === "main" ? "991 g" : selectedAttachment.name}</span>
                </div>
              )}

              {installed.includes("stepped-pulley") && (
                <div className="torque-kinetic-spool">
                  <i className={`spool-tier tier-25 ${radius === 0.025 ? "active" : ""}`} />
                  <i className={`spool-tier tier-20 ${radius === 0.02 ? "active" : ""}`} />
                  <i className={`spool-tier tier-15 ${radius === 0.015 ? "active" : ""}`} />
                  <i className="kinetic-spool-winding" />
                  <b>{format(radius * 100, 2)} cm kademesi</b>
                </div>
              )}

              {installed.includes("optical-reader") && (
                <div className={`torque-kinetic-reader ${runState === "running" ? "active" : ""}`}>
                  <i className="kinetic-reader-post" />
                  <i className="kinetic-reader-body" />
                  <i className="kinetic-reader-arm" />
                  <i className="kinetic-reader-wheel" />
                  <i className="kinetic-reader-light" />
                  <span>Optik okuyucu</span>
                </div>
              )}

              {installed.includes("table-pulley") && (
                <div className={`torque-kinetic-edge-pulley ${runState === "running" ? "active" : ""}`}>
                  <i className="kinetic-edge-bracket" />
                  <i className="kinetic-edge-wheel" />
                  <i className="kinetic-edge-clamp" />
                  <span>Kenar makarası</span>
                </div>
              )}

              {installed.includes("string-pan") && (
                <>
                  <div className={`torque-kinetic-cord ${stringWound || runState === "running" ? "wound" : ""}`}>
                    <i className="kinetic-cord-horizontal" />
                    <i className="kinetic-cord-arc" />
                    <i className="kinetic-cord-vertical" />
                  </div>
                  <div className="torque-kinetic-hanger" style={discStyle}>
                    <i className="kinetic-hanger-hook" />
                    <i className="kinetic-hanger-stem" />
                    <div className="kinetic-weight-stack" aria-label={`${visibleWeightCount} adet 10 gramlık kütle`}>
                      {Array.from({ length: visibleWeightCount }, (_, index) => (
                        <i key={index} />
                      ))}
                    </div>
                    <i className="kinetic-hanger-tray" />
                    <b>5 g kefe + {Math.round(addedMass * 1000)} g</b>
                  </div>
                </>
              )}

              {installed.includes("data-logger") && (
                <div className={`torque-data-logger ${sensorZeroed ? "zeroed" : ""}`}>
                  <img
                    src="./motion-equipment-timer.webp"
                    alt="Optik okuyucuya bağlı hareket zamanlayıcı"
                    draggable={false}
                  />
                  <span>
                    <small>MOTION TIMER</small>
                    <b>{format(currentAngularSpeed, 2)}</b>
                    <em>rad/s</em>
                  </span>
                  <i className="logger-led" />
                  <i className="logger-button button-one" />
                  <i className="logger-button button-two" />
                  <i className="logger-cable" />
                </div>
              )}

              {installed.includes("attachments") && (
                <div className="torque-attachment-rack">
                  <img
                    src="./torque-inertia-kit-v2.webp"
                    alt="Yedek disk, metal halka ve metal blok"
                    draggable={false}
                  />
                  <b>EK CİSİMLER</b>
                </div>
              )}

              {setupComplete && (
                <div className="torque-kinetic-live-label">
                  <span>Seçili yarıçap <b>{format(radius * 100, 2)} cm</b></span>
                  <span>Asılı kütle <b>{Math.round(addedMass * 1000)} g</b></span>
                  <span>Tork <b>{format(torque, 3)} N·m</b></span>
                </div>
              )}
            </div>

            {!setupComplete && (
              <div className="torque-bench-hint">
                <b>
                  {installed.length + 1}. adım · {EQUIPMENT.find((item) => item.kind === nextSetup)?.shortName}
                </b>
                <span>Vurgulanan parçayı buraya bırak; doğru bağlantıya kendiliğinden oturur.</span>
              </div>
            )}
          </div>

          <div className="torque-sensor-panel">
            <div>
              <small>CANLI SENSÖR GRAFİĞİ</small>
              <b>Açısal hız - zaman</b>
              <p>Doğrunun eğimi, diskin açısal ivmesini verir.</p>
            </div>
            <VelocityGraph
              alpha={measuredAlpha}
              progress={progress}
              running={runState === "running"}
            />
          </div>

          <div className={`torque-status ${stringWound && sensorZeroed ? "ready" : ""}`} aria-live="polite">
            <b>{stringWound && sensorZeroed ? "ÖLÇÜM HAZIR" : "YÖNERGE"}</b>
            <span>{message}</span>
          </div>
        </div>
      </div>

      <section className="torque-data-section">
        <div className="torque-data-heading">
          <div>
            <small>DENEY GÜNLÜĞÜ</small>
            <h3>Tek düzenek, üç araştırma serisi</h3>
            <p>Her seride yalnızca bir değişkeni değiştirerek karşılaştırılabilir veri üret.</p>
          </div>
          <span className={completion.total === 11 ? "complete" : ""}>
            <b>{completion.total}/11</b>
            temel ölçüm
          </span>
        </div>
        <div className="torque-table-wrap">
          <table className="torque-data-table">
            <thead>
              <tr>
                <th>Deneme</th>
                <th>Seri</th>
                <th>r</th>
                <th>Ek kütle</th>
                <th>Dönen sistem</th>
                <th>I</th>
                <th>Tork</th>
                <th>Grafik eğimi α</th>
                <th>İdeal model α</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={9}>İlk ölçüm tamamlandığında veriler burada görünecek.</td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>
                      {record.experiment === "radius"
                        ? "Yarıçap"
                        : record.experiment === "mass"
                          ? "Kütle"
                          : "Eylemsizlik"}
                    </td>
                    <td>{format(record.radius * 100, 2)} cm</td>
                    <td>{Math.round(record.addedMass * 1000)} g</td>
                    <td>{record.attachmentName}</td>
                    <td>{format(record.inertia * 1000, 2)}×10⁻³</td>
                    <td>{format(record.torque, 4)} N·m</td>
                    <td>{format(record.measuredAlpha, 3)} rad/s²</td>
                    <td>{format(record.theoreticalAlpha, 3)} rad/s²</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {latest && (
        <section className="torque-analysis-prompt">
          <div>
            <small>ÖLÇÜM TAMAMLANDI</small>
            <h3>Grafiğin eğiminden tork ilişkisine git</h3>
            <p>Hesaplama, ölçümden sonra açılır; önce grafikteki değişimi gözlemle.</p>
          </div>
          <button type="button" onClick={() => setShowAnalysis((current) => !current)}>
            {showAnalysis ? "İşlemsel analizi kapat" : "İşlemsel analizi göster"} →
          </button>
        </section>
      )}

      {latest && showAnalysis && (
        <section className="torque-analysis">
          <div className="torque-analysis-heading">
            <div>
              <small>SON DENEME · TAM ANALİZ</small>
              <h3>Ölçülen büyüklükler arasındaki ilişki</h3>
            </div>
            <span>{latest.attachmentName}</span>
          </div>
          <div className="torque-analysis-grid">
            <article>
              <b>1 · İpin uyguladığı kuvvet</b>
              <p>F = m · g</p>
              <code>
                F = {format(latest.totalHangingMass, 3)} · 9,81 ={" "}
                {format(latest.force, 3)} N
              </code>
              <small>5 g kefe, seçilen ek kütleye dahil edildi.</small>
            </article>
            <article>
              <b>2 · Döndürme etkisi</b>
              <p>τ = r · F</p>
              <code>
                τ = {format(latest.radius, 3)} · {format(latest.force, 3)} ={" "}
                {format(latest.torque, 5)} N·m
              </code>
              <small>İp diske teğet olduğundan kuvvet açısı 90° kabul edilir.</small>
            </article>
            <article>
              <b>3 · Açısal ivme</b>
              <p>α = τ / I</p>
              <code>
                α = {format(latest.torque, 5)} / {format(latest.inertia, 5)} ={" "}
                {format(latest.theoreticalAlpha, 3)} rad/s²
              </code>
              <small>Grafik eğimi ile model aynı büyüklüğü temsil eder.</small>
            </article>
          </div>
          <div className="torque-analysis-conclusion">
            <span>
              <small>Grafik eğimi</small>
              <b>{format(latest.measuredAlpha, 3)} rad/s²</b>
            </span>
            <span>
              <small>Model sonucu</small>
              <b>{format(latest.theoreticalAlpha, 3)} rad/s²</b>
            </span>
            <p>
              İdeal sistemde sürtünme ve ip kütlesi ihmal edilir. Grafik eğimi,
              seçilen yarıçap, kütle ve eylemsizlik momentinden bulunan model
              sonucuna tam eşittir.
            </p>
          </div>
        </section>
      )}

      <section className="torque-graphs">
        <RelationBars
          title="Yarıçap arttığında"
          subtitle="40 g · ana disk"
          values={radiusBarValues}
        />
        <RelationBars
          title="Asılı kütle arttığında"
          subtitle="2,00 cm · ana disk"
          values={massBarValues}
        />
        <RelationBars
          title="Eylemsizlik momenti değiştiğinde"
          subtitle="40 g · 2,00 cm"
          values={inertiaBarValues}
        />
        <p>Çubuk yüksekliği açısal ivmeyi gösterir (rad/s²).</p>
      </section>

      <section className="torque-report">
        <div className="torque-report-heading">
          <div>
            <small>KISA DENEY RAPORU</small>
            <h3>İlişkiyi verinle genelle</h3>
          </div>
          <span>Her iddianı tablodaki en az iki ölçümle destekle.</span>
        </div>
        <div className="torque-report-grid">
          <label>
            <span>Dönme yarıçapı değiştiğinde açısal ivme nasıl değişti? Kanıtın nedir?</span>
            <textarea
              rows={4}
              value={report.radius}
              onChange={(event) => setReport({ ...report, radius: event.target.value })}
            />
          </label>
          <label>
            <span>Asılı kütle arttığında tork ve açısal ivme birlikte nasıl değişti?</span>
            <textarea
              rows={4}
              value={report.mass}
              onChange={(event) => setReport({ ...report, mass: event.target.value })}
            />
          </label>
          <label>
            <span>Aynı tork altında hangi ek cisim daha küçük açısal ivme oluşturdu? Neden?</span>
            <textarea
              rows={4}
              value={report.inertia}
              onChange={(event) => setReport({ ...report, inertia: event.target.value })}
            />
          </label>
          <label>
            <span>Açısal hız-zaman grafiğinin eğimi deneyde hangi fiziksel büyüklüğü verdi?</span>
            <textarea
              rows={4}
              value={report.graph}
              onChange={(event) => setReport({ ...report, graph: event.target.value })}
            />
          </label>
          <label className="wide">
            <span>Sonuç: Torkun bağlı olduğu değişkenleri ve eylemsizlik momentinin etkisini kendi cümlelerinle genelle.</span>
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
