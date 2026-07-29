"use client";

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ApparatusKind =
  | "rail"
  | "laser"
  | "rotary-table"
  | "screen"
  | "slab"
  | "equilateral-prism"
  | "right-prism";
type ExperimentMode = "refraction" | "deviation" | "total-reflection";
type RunState = "ready" | "running" | "complete";

type OpticsRecord = {
  id: number;
  mode: ExperimentMode;
  incidence: number;
  refraction: number;
  secondInternalAngle: number;
  exitAngle: number;
  deviation: number;
  displacement: number;
  refractiveIndex: number;
  internalAngle: number;
  totalReflection: boolean;
};

const REFRACTIVE_INDEX = 1.49;
const SLAB_THICKNESS_CM = 1.5;
const PRISM_APEX_ANGLE = 60;
const MIME = "application/x-optics-equipment";
const APPARATUS: Array<{
  kind: ApparatusKind;
  shortName: string;
  name: string;
}> = [
  {
    kind: "rail",
    shortName: "Optik ray",
    name: "Cetvelli metal optik ray ve ayakları",
  },
  {
    kind: "laser",
    shortName: "Lazer",
    name: "Yüksekliği ayarlanabilir tek renkli lazer",
  },
  {
    kind: "rotary-table",
    shortName: "Optik daire",
    name: "Açı ölçekli döner optik tabla",
  },
  {
    kind: "screen",
    shortName: "Ölçüm ekranı",
    name: "Milimetre ölçekli beyaz ışın ekranı",
  },
  {
    kind: "slab",
    shortName: "Pleksiglas",
    name: "1,50 cm kalınlıklı paralel yüzlü pleksiglas",
  },
  {
    kind: "equilateral-prism",
    shortName: "60° prizma",
    name: "60 derece tepe açılı cam prizma",
  },
  {
    kind: "right-prism",
    shortName: "Dik üçgen prizma",
    name: "İkizkenar dik üçgen cam prizma",
  },
];
const SETUP_ORDER = APPARATUS.map((item) => item.kind);
const REFRACTION_ANGLES = [0, 15, 30, 45, 60];
const DEVIATION_ANGLES = [30, 40, 50, 60];
const INTERNAL_ANGLES = [35, 40, 42, 45, 50];

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function format(value: number, digits = 1) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function ApparatusIcon({ kind }: { kind: ApparatusKind }) {
  return (
    <span className={`optics-equipment-icon optics-icon-${kind}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function drawProgressivePath(
  context: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  progress: number,
) {
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index];
    return {
      start: previous,
      end: point,
      length: Math.hypot(point.x - previous.x, point.y - previous.y),
    };
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = totalLength * clamp(progress, 0, 1);

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const segment of segments) {
    if (remaining <= 0) break;
    const visible = Math.min(remaining, segment.length);
    const ratio = segment.length === 0 ? 0 : visible / segment.length;
    context.lineTo(
      segment.start.x + (segment.end.x - segment.start.x) * ratio,
      segment.start.y + (segment.end.y - segment.start.y) * ratio,
    );
    remaining -= visible;
  }
  context.stroke();
}

function OpticsRayCanvas({
  mode,
  progress,
  running,
  laserOn,
  incidence,
  refraction,
  deviation,
  displacement,
  internalAngle,
  totalReflection,
}: {
  mode: ExperimentMode;
  progress: number;
  running: boolean;
  laserOn: boolean;
  incidence: number;
  refraction: number;
  deviation: number;
  displacement: number;
  internalAngle: number;
  totalReflection: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 420);
    const height = Math.max(rect.height, 420);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const center = { x: width * 0.56, y: height * 0.44 };
    const laser = { x: width * 0.155, y: center.y };
    const screenX = width * 0.91;
    const visibleProgress = laserOn ? (running ? progress : 1) : 0;

    if (laserOn) {
      context.save();
      context.setLineDash([7, 6]);
      context.lineWidth = 1;
      context.strokeStyle = "rgba(49, 89, 94, 0.48)";
      context.beginPath();
      context.moveTo(center.x - 115, center.y);
      context.lineTo(center.x + 115, center.y);
      context.stroke();
      context.restore();
    }

    let points: Array<{ x: number; y: number }> = [laser];
    if (mode === "refraction") {
      const lateralShift = clamp(displacement * 28, 0, 30);
      points = [
        laser,
        { x: center.x - 30, y: center.y },
        {
          x: center.x + 30,
          y: center.y + lateralShift,
        },
        { x: screenX, y: center.y + lateralShift },
      ];
    } else if (mode === "deviation") {
      const prismEntry = { x: center.x - 40, y: center.y };
      const prismExit = {
        x: center.x + 30,
        y: center.y + 18 + (incidence - refraction) * 0.38,
      };
      const targetX = width * 0.88;
      const targetY = clamp(
        prismExit.y + Math.tan(toRadians(deviation)) * (targetX - prismExit.x),
        height * 0.52,
        height * 0.91,
      );
      points = [laser, prismEntry, prismExit, { x: targetX, y: targetY }];
    } else if (totalReflection) {
      points = [
        laser,
        { x: center.x - 43, y: center.y },
        { x: center.x + 7, y: center.y },
        { x: center.x + 38, y: center.y - 45 },
        { x: center.x + 3, y: center.y - 82 },
        { x: width * 0.18, y: center.y - 82 },
      ];
    } else {
      const leakAngle = clamp(internalAngle - 18, 14, 34);
      points = [
        laser,
        { x: center.x - 43, y: center.y },
        { x: center.x + 5, y: center.y },
        {
          x: width * 0.78,
          y: center.y - Math.tan(toRadians(leakAngle)) * width * 0.2,
        },
      ];
    }

    if (visibleProgress > 0) {
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.shadowColor = "rgba(255, 40, 32, 0.78)";
      context.shadowBlur = 13;
      context.lineWidth = 8;
      context.strokeStyle = "rgba(255, 68, 52, 0.18)";
      drawProgressivePath(context, points, visibleProgress);
      context.shadowBlur = 3;
      context.lineWidth = 2.6;
      context.strokeStyle = "#ff3d2f";
      drawProgressivePath(context, points, visibleProgress);
      context.restore();
    }

    if (laserOn && mode !== "total-reflection") {
      context.save();
      context.font = "700 9px Arial";
      context.fillStyle = "#526b70";
      context.textAlign = "center";
      if (mode === "refraction") {
        context.fillText(`θ₁ = ${format(incidence, 0)}°`, center.x - 73, center.y - 20);
        context.fillText(`θ₂ = ${format(refraction, 1)}°`, center.x + 5, center.y + 43);
      } else {
        context.fillText(`δ = ${format(deviation, 1)}°`, width * 0.75, height * 0.69);
      }
      context.restore();
    }
  }, [
    deviation,
    displacement,
    incidence,
    internalAngle,
    laserOn,
    mode,
    progress,
    refraction,
    running,
    totalReflection,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="optics-ray-canvas"
      aria-label="Lazer ışınının optik düzenekte izlediği yol"
    />
  );
}

export default function PrismLab() {
  const animationRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const nextIdRef = useRef(1);
  const [installed, setInstalled] = useState<ApparatusKind[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mode, setMode] = useState<ExperimentMode>("refraction");
  const [incidence, setIncidence] = useState(30);
  const [internalAngle, setInternalAngle] = useState(35);
  const [laserOn, setLaserOn] = useState(false);
  const [calibrated, setCalibrated] = useState(false);
  const [runState, setRunState] = useState<RunState>("ready");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(
    "Malzeme rafından bir parçayı tutup optik tezgâha sürükle.",
  );
  const [hypothesis, setHypothesis] = useState("");
  const [records, setRecords] = useState<OpticsRecord[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [report, setReport] = useState({
    refraction: "",
    deviation: "",
    reflection: "",
    evidence: "",
    conclusion: "",
  });

  const setupComplete = installed.length === SETUP_ORDER.length;
  const nextSetup =
    SETUP_ORDER.find((kind) => !installed.includes(kind)) ?? null;
  const refractionAngle =
    mode === "total-reflection"
      ? 0
      : toDegrees(
          Math.asin(
            clamp(Math.sin(toRadians(incidence)) / REFRACTIVE_INDEX, -1, 1),
          ),
        );
  const displacement =
    mode === "refraction"
      ? SLAB_THICKNESS_CM *
        (Math.sin(toRadians(incidence - refractionAngle)) /
          Math.cos(toRadians(refractionAngle)))
      : 0;
  const secondInternalAngle =
    mode === "deviation" ? PRISM_APEX_ANGLE - refractionAngle : 0;
  const exitArgument =
    mode === "deviation"
      ? REFRACTIVE_INDEX * Math.sin(toRadians(secondInternalAngle))
      : 0;
  const exitAngle =
    mode === "deviation" && Math.abs(exitArgument) <= 1
      ? toDegrees(Math.asin(exitArgument))
      : 0;
  const deviation =
    mode === "deviation" ? incidence + exitAngle - PRISM_APEX_ANGLE : 0;
  const criticalAngle = toDegrees(Math.asin(1 / REFRACTIVE_INDEX));
  const totalReflection =
    mode === "total-reflection" && internalAngle >= criticalAngle;
  const refractiveIndexMeasured =
    incidence === 0 || refractionAngle === 0
      ? REFRACTIVE_INDEX
      : Math.sin(toRadians(incidence)) / Math.sin(toRadians(refractionAngle));
  const latest =
    [...records].reverse().find((record) => record.mode === mode) ?? null;

  const completion = useMemo(() => {
    const refraction = new Set(
      records
        .filter((record) => record.mode === "refraction")
        .map((record) => record.incidence),
    ).size;
    const deviationCount = new Set(
      records
        .filter((record) => record.mode === "deviation")
        .map((record) => record.incidence),
    ).size;
    const reflection = new Set(
      records
        .filter((record) => record.mode === "total-reflection")
        .map((record) => record.internalAngle),
    ).size;
    return {
      refraction: Math.min(refraction, REFRACTION_ANGLES.length),
      deviation: Math.min(deviationCount, DEVIATION_ANGLES.length),
      reflection: Math.min(reflection, INTERNAL_ANGLES.length),
      total:
        Math.min(refraction, REFRACTION_ANGLES.length) +
        Math.min(deviationCount, DEVIATION_ANGLES.length) +
        Math.min(reflection, INTERNAL_ANGLES.length),
    };
  }, [records]);

  const addEquipment = (kind: ApparatusKind) => {
    if (runState === "running" || installed.includes(kind)) return;
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    const item = APPARATUS.find((candidate) => candidate.kind === kind);
    if (nextInstalled.length === SETUP_ORDER.length) {
      setMessage("Düzenek hazır. Lazer güvenliğini kontrol et ve optik daireyi sıfırla.");
    } else {
      setMessage(
        `${item?.shortName ?? "Malzeme"} yerine oturdu. Kalan parçaları istediğin sırayla ekleyebilirsin.`,
      );
    }
  };

  const onEquipmentDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    kind: ApparatusKind,
  ) => {
    event.dataTransfer.setData(MIME, kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const kind = event.dataTransfer.getData(MIME) as ApparatusKind;
    if (SETUP_ORDER.includes(kind)) addEquipment(kind);
  };

  const selectMode = (nextMode: ExperimentMode) => {
    if (runState === "running") return;
    setMode(nextMode);
    setShowAnalysis(false);
    setProgress(0);
    setRunState("ready");
    setHypothesis("");
    if (nextMode === "refraction") {
      setIncidence(30);
      setMessage("Pleksiglas levha seçildi. Gelme açısı için bir hipotez yaz.");
    } else if (nextMode === "deviation") {
      setIncidence(40);
      setMessage("60° prizma seçildi. Işının izleyeceği yolu tahmin et.");
    } else {
      setInternalAngle(35);
      setMessage("Dik üçgen prizma seçildi. Tam yansımanın başlayacağı açıyı tahmin et.");
    }
  };

  const resetApparatus = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setInstalled([]);
    setIsDragOver(false);
    setLaserOn(false);
    setCalibrated(false);
    setProgress(0);
    setRunState("ready");
    setShowAnalysis(false);
    setMessage("Malzeme rafından bir parçayı tutup optik tezgâha sürükle.");
  };

  const calibrate = () => {
    if (!setupComplete) {
      setMessage("Kalibrasyondan önce düzeneğin bütün parçalarını yerleştir.");
      return;
    }
    setCalibrated(true);
    setMessage("Optik dairenin 0° çizgisi ray ekseniyle hizalandı.");
  };

  const toggleLaser = () => {
    if (!installed.includes("laser") || !installed.includes("rail")) {
      setMessage("Önce optik rayı ve lazeri tezgâha yerleştir.");
      return;
    }
    setLaserOn((current) => !current);
    setMessage(
      laserOn
        ? "Lazer kapatıldı."
        : "Lazer açık. Işın göze yöneltilmemeli; düzenek hizasını kontrol et.",
    );
  };

  const measure = () => {
    if (!setupComplete) {
      setMessage("Ölçüm için bütün malzemeleri tezgâha yerleştir.");
      return;
    }
    if (!laserOn) {
      setMessage("Ölçümden önce lazeri aç.");
      return;
    }
    if (!calibrated) {
      setMessage("Ölçümden önce optik daireyi 0° konumuna getir.");
      return;
    }
    if (hypothesis.trim().length < 5) {
      setMessage("Işını göndermeden önce kısa bir hipotez yaz.");
      return;
    }
    setRunState("running");
    setProgress(0);
    setShowAnalysis(false);
    setMessage("Işın ilerliyor; ışının saydam ortam içindeki yolunu izle.");
    startedAtRef.current = performance.now();
  };

  useEffect(() => {
    if (runState !== "running") return;
    const duration = 1800;
    const animate = (now: number) => {
      const nextProgress = Math.min((now - startedAtRef.current) / duration, 1);
      setProgress(nextProgress);
      if (nextProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const record: OpticsRecord = {
        id: nextIdRef.current,
        mode,
        incidence,
        refraction: Number(refractionAngle.toFixed(2)),
        secondInternalAngle: Number(secondInternalAngle.toFixed(2)),
        exitAngle: Number(exitAngle.toFixed(2)),
        deviation: Number(deviation.toFixed(2)),
        displacement: Number(displacement.toFixed(3)),
        refractiveIndex: Number(refractiveIndexMeasured.toFixed(3)),
        internalAngle,
        totalReflection,
      };
      nextIdRef.current += 1;
      setRecords((current) => {
        const withoutSameSetting = current.filter((item) =>
          mode === "total-reflection"
            ? !(item.mode === mode && item.internalAngle === internalAngle)
            : !(item.mode === mode && item.incidence === incidence),
        );
        return [...withoutSameSetting, record];
      });
      setRunState("complete");
      setMessage(
        mode === "refraction"
          ? `Ölçüm tamam: kırılma açısı ${format(refractionAngle, 1)}°, ekrandaki kayma ${format(displacement, 2)} cm.`
          : mode === "deviation"
            ? `Ölçüm tamam: prizmadan çıkan ışının sapma açısı ${format(deviation, 1)}°.`
            : totalReflection
              ? "Tam yansıma gözlendi; çıkan ışın gelen ışına paralel ve ters yönlü."
              : "Işın ikinci yüzeyden dışarı çıktı; bu açıda tam yansıma oluşmadı.",
      );
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [
    deviation,
    displacement,
    exitAngle,
    incidence,
    internalAngle,
    mode,
    refractiveIndexMeasured,
    refractionAngle,
    runState,
    secondInternalAngle,
    totalReflection,
  ]);

  const activeSample =
    mode === "refraction"
      ? "slab"
      : mode === "deviation"
        ? "equilateral-prism"
        : "right-prism";
  const screenHit =
    mode === "refraction"
      ? 48 + clamp(displacement * 4, 0, 9)
      : mode === "deviation"
        ? 50 + clamp(deviation * 0.66, 0, 34)
        : totalReflection
          ? 31
          : 20;
  const stageStyle = {
    "--optics-table-angle": `${mode === "total-reflection" ? internalAngle - 45 : incidence}deg`,
    "--optics-screen-hit": `${screenHit}%`,
  } as CSSProperties;

  const modeRecords = records.filter((record) => record.mode === mode);

  return (
    <section className="prism-lab-section" id="kirilma-prizma-deneyi">
      <div className="prism-heading">
        <div>
          <span>DALGALAR - OPTİK · DENEY 1</span>
          <h1>Kırılma ve prizmada ışığın yolu</h1>
          <p>
            Optik rayı kendin kur; pleksiglas levhada kırılmayı, 60° prizmada
            sapmayı ve dik üçgen prizmada tam yansımayı ölçerek karşılaştır.
          </p>
        </div>
        <aside>
          <b>TYMM 11. SINIF</b>
          <span>FİZ.11.4.5 · FİZ.11.4.8</span>
          <small>deney yapma · hipotez test etme · veri analizi</small>
        </aside>
      </div>

      <div className="prism-learning-strip">
        <span><b>1</b> Düzeneği sürükleyerek kur</span>
        <span><b>2</b> Işın yolunu tahmin et</span>
        <span><b>3</b> Ölç ve hipotezini değerlendir</span>
      </div>

      <div className="optics-workspace">
        <aside className="optics-equipment-panel">
          <div className="optics-equipment-heading">
            <div>
              <small>MALZEME RAFI</small>
              <h2>Tezgâha sürükle</h2>
            </div>
            <span>{installed.length}/{SETUP_ORDER.length}</span>
          </div>
          <p>Her parça bırakıldığında ray üzerindeki doğru konumuna oturur.</p>
          <div className="optics-equipment-list">
            {APPARATUS.map((item) => {
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
                  <ApparatusIcon kind={item.kind} />
                  <span>
                    <b>{item.shortName}</b>
                    <small>{isInstalled ? "Yerine oturdu" : "Sahneye sürükle"}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="optics-safety-note">
            <b>LAZER GÜVENLİĞİ</b>
            <span>Işını göze veya yansıtıcı yüzeylere yöneltme.</span>
          </div>
        </aside>

        <div
          className={`optics-stage ${setupComplete ? "setup-complete" : ""} ${isDragOver ? "drag-over" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={() => setIsDragOver(true)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDrop={onStageDrop}
          aria-label="Optik deney malzemelerinin bırakılacağı tezgâh"
        >
          <div className="optics-stage-toolbar">
            <div>
              <small>CANLI OPTİK TEZGÂHI</small>
              <b>{setupComplete ? "Düzenek kuruldu" : "Malzemeleri bu alana bırak"}</b>
            </div>
            <div className="optics-live-values">
              <span>
                <small>{mode === "total-reflection" ? "İç gelme" : "Gelme"}</small>
                <b>{mode === "total-reflection" ? internalAngle : incidence}°</b>
              </span>
              <span>
                <small>{mode === "deviation" ? "Çıkış" : mode === "refraction" ? "Kırılma" : "Sınır"}</small>
                <b>
                  {mode === "deviation"
                    ? `${format(exitAngle, 1)}°`
                    : mode === "refraction"
                      ? `${format(refractionAngle, 1)}°`
                      : `${format(criticalAngle, 1)}°`}
                </b>
              </span>
              <span>
                <small>{mode === "refraction" ? "Kayma x" : mode === "deviation" ? "Sapma δ" : "Sonuç"}</small>
                <b>
                  {mode === "refraction"
                    ? `${format(displacement, 2)} cm`
                    : mode === "deviation"
                      ? `${format(deviation, 1)}°`
                      : totalReflection
                        ? "Tam yansıma"
                        : "Işın çıkar"}
                </b>
              </span>
              <button type="button" onClick={resetApparatus} disabled={runState === "running"}>
                Düzeneği sök
              </button>
            </div>
          </div>

          <div className="optics-apparatus" style={stageStyle}>
            <div className="optics-wall-label">OPTİK LABORATUVARI · TEK RENKLİ IŞIK</div>
            <div className="optics-bench">
              <i className="optics-bench-top" />
              <i className="optics-bench-leg leg-left" />
              <i className="optics-bench-leg leg-right" />
            </div>

            {installed.includes("rail") && (
              <div className="optics-rail">
                <i className="optics-rail-channel channel-one" />
                <i className="optics-rail-channel channel-two" />
                <i className="optics-rail-scale" />
                <i className="optics-rail-foot foot-left" />
                <i className="optics-rail-foot foot-right" />
              </div>
            )}

            {installed.includes("laser") && (
              <div className={`optics-laser ${laserOn ? "on" : ""}`}>
                <i className="laser-housing" />
                <i className="laser-aperture" />
                <i className="laser-switch" />
                <i className="laser-mount" />
                <b>LASER</b>
              </div>
            )}

            {installed.includes("rotary-table") && (
              <div className={`optics-rotary-table ${calibrated ? "calibrated" : ""}`}>
                <i className="optics-degree-ring" />
                <i className="optics-table-face" />
                <i className="optics-zero-line" />
                <span className="degree-zero">0°</span>
                <span className="degree-ninety">90°</span>
                <b>0</b>
              </div>
            )}

            {installed.includes("screen") && (
              <div className="optics-screen">
                <i className="screen-face" />
                <i className="screen-grid" />
                <i className={`screen-hit ${laserOn ? "visible" : ""}`} />
                <i className="screen-post" />
                <i className="screen-base" />
                <b>EKRAN</b>
              </div>
            )}

            {installed.includes(activeSample as ApparatusKind) && (
              <>
                {mode === "refraction" && (
                  <div className="optics-slab">
                    <i />
                    <b>PLEKSİGLAS</b>
                  </div>
                )}
                {mode === "deviation" && (
                  <div className="optics-equilateral-prism">
                    <i />
                    <b>60°</b>
                  </div>
                )}
                {mode === "total-reflection" && (
                  <div className="optics-right-prism">
                    <i />
                    <b>45°</b>
                  </div>
                )}
              </>
            )}

            {installed.includes("slab") &&
              installed.includes("equilateral-prism") &&
              installed.includes("right-prism") && (
                <div className="optics-sample-tray">
                  <span className={mode === "refraction" ? "active" : ""}>Levha</span>
                  <span className={mode === "deviation" ? "active" : ""}>60° prizma</span>
                  <span className={mode === "total-reflection" ? "active" : ""}>Dik prizma</span>
                </div>
              )}

            <OpticsRayCanvas
              mode={mode}
              progress={progress}
              running={runState === "running"}
              laserOn={laserOn}
              incidence={incidence}
              refraction={refractionAngle}
              deviation={deviation}
              displacement={displacement}
              internalAngle={internalAngle}
              totalReflection={totalReflection}
            />

            {!setupComplete && (
              <div className="optics-drop-hint">
                <b>Malzemeyi optik tezgâha bırak</b>
                <span>Parça ray üzerindeki doğru yerine oturacak.</span>
              </div>
            )}
          </div>

          <div className={`optics-status ${laserOn && calibrated ? "ready" : ""}`} aria-live="polite">
            <b>{laserOn && calibrated ? "ÖLÇÜME HAZIR" : "YÖNERGE"}</b>
            <span>{message}</span>
          </div>
        </div>
      </div>

      <section className="optics-experiment-selector">
        <button
          type="button"
          className={mode === "refraction" ? "active" : ""}
          onClick={() => selectMode("refraction")}
        >
          <span>A</span>
          <b>Pleksiglasta kırılma</b>
          <small>θ₁, θ₂, kayma ve kırılma indisi</small>
          <em>{completion.refraction}/{REFRACTION_ANGLES.length} ölçüm</em>
        </button>
        <button
          type="button"
          className={mode === "deviation" ? "active" : ""}
          onClick={() => selectMode("deviation")}
        >
          <span>B</span>
          <b>Prizmada sapma</b>
          <small>60° prizmada ışın yolu ve δ</small>
          <em>{completion.deviation}/{DEVIATION_ANGLES.length} ölçüm</em>
        </button>
        <button
          type="button"
          className={mode === "total-reflection" ? "active" : ""}
          onClick={() => selectMode("total-reflection")}
        >
          <span>C</span>
          <b>Prizmada tam yansıma</b>
          <small>Sınır açısının iki yanında gözlem</small>
          <em>{completion.reflection}/{INTERNAL_ANGLES.length} ölçüm</em>
        </button>
      </section>

      <section className="optics-control-deck">
        <div className="optics-hypothesis">
          <small>ÖLÇMEDEN ÖNCE</small>
          <label htmlFor="optics-hypothesis">
            {mode === "refraction"
              ? "Gelme açısı arttığında kırılma açısının nasıl değişeceğini tahmin et."
              : mode === "deviation"
                ? "Işının 60° prizma içinde ve çıkışta izleyeceği yolu tahmin et."
                : "Hangi iç gelme açısından sonra ışının prizmadan çıkmayacağını tahmin et."}
          </label>
          <textarea
            id="optics-hypothesis"
            rows={3}
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
            placeholder="Hipotezim..."
          />
        </div>

        <div className="optics-setting-card">
          <small>DEĞİŞKEN</small>
          <b>{mode === "total-reflection" ? "İç gelme açısı" : "Gelme açısı"}</b>
          <div className="optics-angle-options">
            {(mode === "refraction"
              ? REFRACTION_ANGLES
              : mode === "deviation"
                ? DEVIATION_ANGLES
                : INTERNAL_ANGLES
            ).map((value) => {
              const selected =
                mode === "total-reflection"
                  ? internalAngle === value
                  : incidence === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={selected ? "selected" : ""}
                  onClick={() =>
                    mode === "total-reflection"
                      ? setInternalAngle(value)
                      : setIncidence(value)
                  }
                  disabled={runState === "running"}
                >
                  {value}°
                </button>
              );
            })}
          </div>
          <span>
            {mode === "refraction"
              ? `Levha kalınlığı ${format(SLAB_THICKNESS_CM, 2)} cm`
              : mode === "deviation"
                ? `Prizma tepe açısı ${PRISM_APEX_ANGLE}°`
                : "Camdan havaya geçiş"}
          </span>
        </div>

        <div className="optics-action-card">
          <small>DENEY İŞLEMLERİ</small>
          <button type="button" onClick={toggleLaser}>
            {laserOn ? "1 · Lazeri kapat" : "1 · Lazeri aç"}
          </button>
          <button type="button" onClick={calibrate} disabled={!setupComplete}>
            {calibrated ? "2 · Tabla 0°" : "2 · Optik daireyi sıfırla"}
          </button>
          <button
            className="optics-measure-button"
            type="button"
            onClick={measure}
            disabled={runState === "running"}
          >
            {runState === "running" ? "IŞIN İLERLİYOR" : "3 · IŞINI GÖNDER VE ÖLÇ"}
          </button>
        </div>
      </section>

      <section className="optics-data-section">
        <div className="optics-data-heading">
          <div>
            <small>DENEY GÜNLÜĞÜ</small>
            <h2>
              {mode === "refraction"
                ? "Pleksiglas levha ölçümleri"
                : mode === "deviation"
                  ? "60° prizma ölçümleri"
                  : "Tam yansıma gözlemleri"}
            </h2>
            <p>Her ölçüm aynı ideal optik düzeneğin çözünürlüğüyle kaydedilir.</p>
          </div>
          <span className={completion.total === 14 ? "complete" : ""}>
            <b>{completion.total}/14</b>
            temel ölçüm
          </span>
        </div>

        <div className="optics-table-wrap">
          {mode === "refraction" && (
            <table className="optics-data-table">
              <thead>
                <tr>
                  <th>Deneme</th>
                  <th>d</th>
                  <th>Gelme θ₁</th>
                  <th>Kırılma θ₂</th>
                  <th>Ekran kayması x</th>
                  <th>n pleksiglas</th>
                </tr>
              </thead>
              <tbody>
                {modeRecords.length === 0 ? (
                  <tr><td colSpan={6}>İlk ölçüm tamamlandığında veriler burada görünecek.</td></tr>
                ) : (
                  modeRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td>
                      <td>{format(SLAB_THICKNESS_CM, 2)} cm</td>
                      <td>{format(record.incidence, 0)}°</td>
                      <td>{format(record.refraction, 1)}°</td>
                      <td>{format(record.displacement, 2)} cm</td>
                      <td>{format(record.refractiveIndex, 2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          {mode === "deviation" && (
            <table className="optics-data-table">
              <thead>
                <tr>
                  <th>Deneme</th>
                  <th>Tepe açısı A</th>
                  <th>Gelme θ₁</th>
                  <th>İç açılar r₁ / r₂</th>
                  <th>Çıkış θ₄</th>
                  <th>Sapma δ</th>
                </tr>
              </thead>
              <tbody>
                {modeRecords.length === 0 ? (
                  <tr><td colSpan={6}>İlk ölçüm tamamlandığında veriler burada görünecek.</td></tr>
                ) : (
                  modeRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td>
                      <td>{PRISM_APEX_ANGLE}°</td>
                      <td>{format(record.incidence, 0)}°</td>
                      <td>{format(record.refraction, 1)}° / {format(record.secondInternalAngle, 1)}°</td>
                      <td>{format(record.exitAngle, 1)}°</td>
                      <td>{format(record.deviation, 1)}°</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          {mode === "total-reflection" && (
            <table className="optics-data-table">
              <thead>
                <tr>
                  <th>Deneme</th>
                  <th>İç gelme açısı</th>
                  <th>Sınır açısı</th>
                  <th>Gözlem</th>
                  <th>Çıkan ışının yönü</th>
                </tr>
              </thead>
              <tbody>
                {modeRecords.length === 0 ? (
                  <tr><td colSpan={5}>İlk gözlem tamamlandığında veriler burada görünecek.</td></tr>
                ) : (
                  modeRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td>
                      <td>{format(record.internalAngle, 0)}°</td>
                      <td>{format(criticalAngle, 1)}°</td>
                      <td>{record.totalReflection ? "Tam yansıma" : "Kırılarak dışarı çıktı"}</td>
                      <td>{record.totalReflection ? "Gelen ışına paralel, ters yönlü" : "Prizma dışına yöneldi"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {latest && (
        <section className="optics-analysis-prompt">
          <div>
            <small>ÖLÇÜM TAMAMLANDI</small>
            <h2>Hipotezini ışın yolu ve verilerle karşılaştır</h2>
            <p>İşlemsel model yalnızca ölçümden sonra açılır.</p>
          </div>
          <button type="button" onClick={() => setShowAnalysis((current) => !current)}>
            {showAnalysis ? "Analizi kapat" : "İşlemsel analizi göster"} →
          </button>
        </section>
      )}

      {latest && showAnalysis && (
        <section className="optics-analysis">
          <div className="optics-analysis-heading">
            <div>
              <small>SON ÖLÇÜM · KANIT</small>
              <h2>
                {latest.mode === "refraction"
                  ? "Pleksiglasın kırılma indisi"
                  : latest.mode === "deviation"
                    ? "Prizmanın oluşturduğu sapma"
                    : "Tam yansıma koşulu"}
              </h2>
            </div>
            <span>Yapay rastgele sapma yoktur.</span>
          </div>
          <div className="optics-analysis-grid">
            {latest.mode === "refraction" && (
              <>
                <article>
                  <b>1 · Ölçülen açılar</b>
                  <p>θ₁ = {format(latest.incidence, 0)}°</p>
                  <code>θ₂ = {format(latest.refraction, 1)}°</code>
                  <small>Işın, havadan pleksiglasa geçerken normale yaklaşır.</small>
                </article>
                <article>
                  <b>2 · Kırılma indisi</b>
                  <p>n = sinθ₁ / sinθ₂</p>
                  <code>n = {format(latest.refractiveIndex, 3)}</code>
                  <small>0° ölçümünde doğrultu değişmez; ortam değeri korunur.</small>
                </article>
                <article>
                  <b>3 · Paralel yüzlü levha</b>
                  <p>x = {format(latest.displacement, 2)} cm</p>
                  <code>d = {format(SLAB_THICKNESS_CM, 2)} cm</code>
                  <small>Çıkan ışın gelen ışına paralel, fakat yanal olarak kaymıştır.</small>
                </article>
              </>
            )}
            {latest.mode === "deviation" && (
              <>
                <article>
                  <b>1 · Prizma içindeki açılar</b>
                  <p>r₁ + r₂ = A</p>
                  <code>{format(latest.refraction, 1)}° + {format(latest.secondInternalAngle, 1)}° = 60°</code>
                  <small>Işın iki farklı yüzeyde kırılır.</small>
                </article>
                <article>
                  <b>2 · Çıkış açısı</b>
                  <p>θ₄ = {format(latest.exitAngle, 1)}°</p>
                  <code>A = 60°</code>
                  <small>İkinci yüzeyde camdan havaya geçiş gerçekleşir.</small>
                </article>
                <article>
                  <b>3 · Sapma açısı</b>
                  <p>δ = θ₁ + θ₄ − A</p>
                  <code>δ = {format(latest.deviation, 1)}°</code>
                  <small>Gelen ve çıkan ışın doğrultuları arasındaki farktır.</small>
                </article>
              </>
            )}
            {latest.mode === "total-reflection" && (
              <>
                <article>
                  <b>1 · Camın sınır açısı</b>
                  <p>θₛ = sin⁻¹(1/n)</p>
                  <code>θₛ = {format(criticalAngle, 1)}°</code>
                  <small>Işık camdan havaya geçmeye çalışmaktadır.</small>
                </article>
                <article>
                  <b>2 · Seçilen iç açı</b>
                  <p>θ = {format(latest.internalAngle, 0)}°</p>
                  <code>{latest.internalAngle >= criticalAngle ? "θ ≥ θₛ" : "θ < θₛ"}</code>
                  <small>Sınır açısıyla doğrudan karşılaştırılır.</small>
                </article>
                <article>
                  <b>3 · Gözlenen yol</b>
                  <p>{latest.totalReflection ? "Tam yansıma" : "Kırılma"}</p>
                  <code>{latest.totalReflection ? "Işın prizma içinde kaldı." : "Işın prizmadan çıktı."}</code>
                  <small>{latest.totalReflection ? "İki yansımadan sonra ışın ters yönde ilerledi." : "İç açı sınır açısından küçüktür."}</small>
                </article>
              </>
            )}
          </div>
        </section>
      )}

      <section className="optics-report">
        <div className="optics-report-heading">
          <div>
            <small>KISA DENEY RAPORU</small>
            <h2>Hipotezini kanıtla veya değiştir</h2>
          </div>
          <span>Her yorumunda deney günlüğünden en az iki ölçüm kullan.</span>
        </div>
        <div className="optics-report-grid">
          <label>
            <span>Gelme açısı arttığında kırılma açısı ve ekrandaki kayma nasıl değişti?</span>
            <textarea
              rows={4}
              value={report.refraction}
              onChange={(event) => setReport({ ...report, refraction: event.target.value })}
            />
          </label>
          <label>
            <span>60° prizmada gelen ışın ile çıkan ışının doğrultuları arasında nasıl bir ilişki gözledin?</span>
            <textarea
              rows={4}
              value={report.deviation}
              onChange={(event) => setReport({ ...report, deviation: event.target.value })}
            />
          </label>
          <label>
            <span>Tam yansıma hangi koşulda başladı? Sınır açısının iki yanındaki ölçümleri karşılaştır.</span>
            <textarea
              rows={4}
              value={report.reflection}
              onChange={(event) => setReport({ ...report, reflection: event.target.value })}
            />
          </label>
          <label>
            <span>Başlangıç hipotezlerinden hangileri verilerle desteklendi, hangilerini değiştirdin?</span>
            <textarea
              rows={4}
              value={report.evidence}
              onChange={(event) => setReport({ ...report, evidence: event.target.value })}
            />
          </label>
          <label className="wide">
            <span>Sonuç: Kırılma yasalarının prizmadaki ışın yolunu açıklayıp açıklamadığını kendi cümlelerinle değerlendir.</span>
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
