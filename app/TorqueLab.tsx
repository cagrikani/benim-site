"use client";

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
  error: number;
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

function format(value: number, digits = 2) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function EquipmentIcon({ kind }: { kind: SetupKind }) {
  return (
    <span className={`torque-equipment-icon torque-icon-${kind}`} aria-hidden="true">
      <i />
      <i />
      <i />
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
    "Sol raftaki bir malzemeyi tutup deney tezgâhına sürükle.",
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
  const measuredAlpha = Number(theoreticalAlpha.toFixed(3));
  const currentError =
    theoreticalAlpha === 0
      ? 0
      : (Math.abs(measuredAlpha - theoreticalAlpha) / theoreticalAlpha) * 100;
  const latest = records.at(-1) ?? null;
  const currentAngularSpeed = measuredAlpha * timer;

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
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    if (nextInstalled.length === SETUP_ORDER.length) {
      setMessage("Düzenek hazır. Deney serisini seç, ipi sar ve okuyucuyu sıfırla.");
    } else {
      const placedName = EQUIPMENT.find((item) => item.kind === kind)?.shortName;
      setMessage(
        `${placedName} yerine oturdu. Kalan malzemeleri istediğin sırayla sürükleyebilirsin.`,
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
          error: currentError,
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
    currentError,
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
    setMessage("Sol raftaki bir malzemeyi tutup deney tezgâhına sürükle.");
  };

  const discStyle = {
    "--torque-disc-turn": `${progress * 1080}deg`,
    "--torque-pan-drop": `${progress * 178}px`,
    "--torque-radius-scale": `${radius / 0.02}`,
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
          <span>MODÜL 07 · DENEY 7</span>
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
          <b>1</b> Malzemeleri sürükle
        </span>
        <span>
          <b>2</b> İpi sar ve ölç
        </span>
        <span>
          <b>3</b> Tek değişkeni karşılaştır
        </span>
      </div>

      <div className="torque-workspace">
        <section className="torque-equipment-panel">
          <div className="torque-panel-heading">
            <div>
              <small>MALZEME RAFI</small>
              <h3>Tut, sürükle ve tezgâha bırak</h3>
            </div>
            <span>{installed.length}/{SETUP_ORDER.length}</span>
          </div>
          <p>Malzeme tezgâha bırakılınca doğru bağlantı noktasına oturur.</p>
          <div className="torque-equipment-list">
            {EQUIPMENT.map((item) => {
              const isInstalled = installed.includes(item.kind);
              const isNext = item.kind === nextSetup;
              return (
                <button
                  key={item.kind}
                  type="button"
                  draggable={!isInstalled && runState !== "running"}
                  className={`${isInstalled ? "installed" : ""} ${isNext ? "next" : ""}`}
                  onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                  onClick={() => addEquipment(item.kind)}
                  disabled={isInstalled || runState === "running"}
                  title={item.name}
                >
                  <EquipmentIcon kind={item.kind} />
                  <span>
                    <b>{item.shortName}</b>
                    <small>{isInstalled ? "Tezgâha yerleşti" : "Sahneye sürükle"}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <small className="torque-touch-note">
            Dokunmatik ekranda malzemeye dokunarak da ekleyebilirsin.
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
                    : "Malzemeleri bu alana bırak"}
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
            <div className="torque-lab-wall">
              <span>DÖNME DİNAMİĞİ DENEYİ</span>
            </div>
            <div className="torque-workbench">
              <i className="torque-bench-top" />
              <i className="torque-bench-leg leg-left" />
              <i className="torque-bench-leg leg-right" />
            </div>

          {installed.includes("base") && (
            <div className="torque-base">
              <i className="torque-base-rail" />
              <i className="torque-base-foot foot-one" />
              <i className="torque-base-foot foot-two" />
              <i className="torque-axis" />
            </div>
          )}

          {installed.includes("main-disk") && (
            <div className={`torque-disc ${runState === "running" ? "spinning" : ""}`} style={discStyle}>
              <i className="torque-disc-body" />
              <i className="torque-disc-rim" />
              <i className="torque-disc-marker" />
              <i className="torque-disc-center" />
              {attachment === "second-disk" && <i className="torque-extra-disc" />}
              {attachment === "ring" && <i className="torque-metal-ring" />}
              {attachment === "block" && <i className="torque-metal-block" />}
            </div>
          )}

          {installed.includes("stepped-pulley") && (
            <div className="torque-stepped-pulley" style={discStyle}>
              <i />
              <i />
              <i />
              <span>{format(radius * 100, 2)} cm</span>
            </div>
          )}

          {installed.includes("optical-reader") && (
            <div className={`torque-optical-reader ${runState === "running" ? "active" : ""}`}>
              <i className="reader-wheel" />
              <i className="reader-body" />
              <i className="reader-arm" />
              <span>OPTİK</span>
            </div>
          )}

          {installed.includes("table-pulley") && (
            <div className="torque-edge-pulley">
              <i />
              <b />
            </div>
          )}

          {installed.includes("string-pan") && (
            <>
              <div className={`torque-string ${stringWound || runState === "running" ? "wound" : ""}`} />
              <div className="torque-hanging-pan" style={discStyle}>
                <i className="pan-wire wire-left" />
                <i className="pan-wire wire-right" />
                <i className="pan-tray" />
                <b>{Math.round(addedMass * 1000)} g</b>
              </div>
            </>
          )}

          {installed.includes("data-logger") && (
            <div className={`torque-data-logger ${sensorZeroed ? "zeroed" : ""}`}>
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
              <b>EK CİSİMLER</b>
              <i className="rack-second-disc" />
              <i className="rack-ring" />
              <i className="rack-block" />
            </div>
          )}

            {setupComplete && (
              <div className="torque-force-overlay">
                <span className="torque-radius-line">
                  r = {format(radius * 100, 2)} cm
                </span>
                <span className="torque-force-arrow">
                  F = {format(force, 2)} N
                </span>
                <small>İp diske teğet bağlanmıştır.</small>
              </div>
            )}

            {!setupComplete && (
              <div className="torque-bench-hint">
                <b>Malzemeyi buraya bırak</b>
                <span>Parça doğru konumuna kendiliğinden oturur.</span>
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

      <section className="torque-controls">
        <article className={experiment === "radius" ? "active" : ""}>
          <small>A · DÖNME YARIÇAPI</small>
          <h3>İpi hangi kademeye saracaksın?</h3>
          <p>40 g kütle ve ana disk sabit kalır.</p>
          <div className="torque-option-row">
            {RADII.map((value) => (
              <button
                key={value}
                type="button"
                className={experiment === "radius" && radius === value ? "selected" : ""}
                onClick={() => selectRadius(value)}
                disabled={!setupComplete || runState === "running"}
              >
                {format(value * 100, 2)} cm
              </button>
            ))}
          </div>
          <span>{completion.radius}/3 ölçüm</span>
        </article>

        <article className={experiment === "mass" ? "active" : ""}>
          <small>B · ASILI KÜTLE</small>
          <h3>Kefeye kaç gram ekleyeceksin?</h3>
          <p>2,00 cm yarıçap ve ana disk sabit kalır.</p>
          <div className="torque-option-row four">
            {MASSES.map((value) => (
              <button
                key={value}
                type="button"
                className={experiment === "mass" && addedMass === value ? "selected" : ""}
                onClick={() => selectMass(value)}
                disabled={!setupComplete || runState === "running"}
              >
                {Math.round(value * 1000)} g
              </button>
            ))}
          </div>
          <span>{completion.mass}/4 ölçüm</span>
        </article>

        <article className={experiment === "inertia" ? "active" : ""}>
          <small>C · EYLEMSİZLİK MOMENTİ</small>
          <h3>Ana diske hangi cismi ekleyeceksin?</h3>
          <p>40 g kütle ve 2,00 cm yarıçap sabit kalır.</p>
          <div className="torque-attachment-options">
            {ATTACHMENTS.map((item) => (
              <button
                key={item.kind}
                type="button"
                className={experiment === "inertia" && attachment === item.kind ? "selected" : ""}
                onClick={() => selectAttachment(item.kind)}
                disabled={!setupComplete || runState === "running"}
              >
                <i className={`attachment-shape shape-${item.kind}`} />
                <span>
                  <b>{item.name}</b>
                  <small>I = {format(item.inertia * 1000, 2)} × 10⁻³ kg·m²</small>
                </span>
              </button>
            ))}
          </div>
          <span>{completion.inertia}/4 ölçüm</span>
        </article>
      </section>

      <section className="torque-action-deck">
        <div>
          <small>SEÇİLİ DENEY</small>
          <b>
            {experiment === "radius"
              ? "Yarıçap - açısal ivme"
              : experiment === "mass"
                ? "Kütle - açısal ivme"
                : "Eylemsizlik momenti - açısal ivme"}
          </b>
          <span>
            r {format(radius * 100, 2)} cm · ek kütle {Math.round(addedMass * 1000)} g ·{" "}
            {selectedAttachment.name}
          </span>
        </div>
        <button type="button" onClick={windString} disabled={!setupComplete || runState === "running"}>
          1 · İpi kademeye sar
        </button>
        <button type="button" onClick={zeroSensor} disabled={!setupComplete || runState === "running"}>
          2 · Okuyucuyu sıfırla
        </button>
        <button
          className="torque-release-button"
          type="button"
          onClick={release}
          disabled={runState === "running"}
        >
          {runState === "running" ? "ÖLÇÜM SÜRÜYOR" : "3 · KEFEYİ BIRAK"}
        </button>
      </section>

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
                <th>α deneysel</th>
                <th>α model</th>
                <th>Fark</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={10}>İlk ölçüm tamamlandığında veriler burada görünecek.</td>
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
                    <td>%{format(record.error, 2)}</td>
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
            <span>
              <small>Yüzdesel fark</small>
              <b>%{format(latest.error, 2)}</b>
            </span>
            <p>
              Bu ideal simülasyonda sürtünme ve ip kütlesi ihmal edilir; yapay
              rastgele sapma eklenmez. Böylece karşılaştırma yalnızca seçtiğin
              değişkenin etkisini gösterir.
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
