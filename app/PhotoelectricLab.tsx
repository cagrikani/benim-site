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
  | "mercury-lamp"
  | "diffraction-grating"
  | "he-apparatus"
  | "multimeter"
  | "color-filter"
  | "transmission-filter";

type LightKind = "yellow" | "green" | "blue" | "violet" | "ultraviolet";
type LampState = "off" | "warming" | "ready";
type RunState = "idle" | "measuring" | "complete";

type Reading = {
  id: string;
  light: LightKind;
  label: string;
  color: string;
  wavelength: number;
  frequency: number;
  transmission: number;
  stoppingVoltage: number;
  photocurrent: number;
};

const PLANCK = 6.62607015e-34;
const LIGHT_SPEED = 299792458;
const ELEMENTARY_CHARGE = 1.602176634e-19;
const WORK_FUNCTION_EV = 1.412;
const MIME = "application/x-photoelectric-equipment";

const LIGHTS: Record<
  LightKind,
  {
    label: string;
    wavelength: number;
    color: string;
    glow: string;
    stageAngle: number;
    shift: number;
  }
> = {
  yellow: {
    label: "Sarı",
    wavelength: 578,
    color: "#ffd43b",
    glow: "rgba(255, 212, 59, 0.72)",
    stageAngle: -8,
    shift: -29,
  },
  green: {
    label: "Yeşil",
    wavelength: 546.074,
    color: "#53e58d",
    glow: "rgba(83, 229, 141, 0.68)",
    stageAngle: -4,
    shift: -15,
  },
  blue: {
    label: "Mavi",
    wavelength: 435.835,
    color: "#4f8dff",
    glow: "rgba(79, 141, 255, 0.68)",
    stageAngle: 1,
    shift: 4,
  },
  violet: {
    label: "Mor",
    wavelength: 404.656,
    color: "#a875ff",
    glow: "rgba(168, 117, 255, 0.68)",
    stageAngle: 6,
    shift: 22,
  },
  ultraviolet: {
    label: "Morötesi",
    wavelength: 365.483,
    color: "#d68cff",
    glow: "rgba(214, 140, 255, 0.72)",
    stageAngle: 10,
    shift: 37,
  },
};

const TRANSMISSIONS = [20, 40, 60, 80, 100];

const APPARATUS: Array<{
  kind: ApparatusKind;
  label: string;
  description: string;
}> = [
  {
    kind: "mercury-lamp",
    label: "Cıva ışık kaynağı",
    description: "Çizgi spektrumu oluşturan korumalı lamba",
  },
  {
    kind: "diffraction-grating",
    label: "Kırınım ağı",
    description: "Işığı renklerine ayıran optik eleman",
  },
  {
    kind: "he-apparatus",
    label: "h/e aparatı",
    description: "Yarık, fotodiyot ve boşaltma devresi",
  },
  {
    kind: "multimeter",
    label: "Dijital multimetre",
    description: "DC durdurma gerilimini okur",
  },
  {
    kind: "color-filter",
    label: "Renk filtresi",
    description: "Seçilen spektrum çizgisini geçirir",
  },
  {
    kind: "transmission-filter",
    label: "Geçirgenlik filtresi",
    description: "Işık şiddetini %20-%100 ayarlar",
  },
];

const SETUP_ORDER = APPARATUS.map((item) => item.kind);

function frequencyFor(wavelength: number) {
  return LIGHT_SPEED / (wavelength * 1e-9);
}

function photonEnergyEv(wavelength: number) {
  return (PLANCK * frequencyFor(wavelength)) / ELEMENTARY_CHARGE;
}

function stoppingVoltageFor(wavelength: number) {
  return Math.max(0, photonEnergyEv(wavelength) - WORK_FUNCTION_EV);
}

function photocurrentFor(wavelength: number, transmission: number) {
  const excessEnergy = stoppingVoltageFor(wavelength);
  return (0.86 + excessEnergy * 0.18) * (transmission / 100);
}

function format(value: number, digits = 2) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function uniqueColorReadings(readings: Reading[]) {
  const latest = new Map<LightKind, Reading>();
  readings.forEach((reading) => latest.set(reading.light, reading));
  return [...latest.values()].sort((first, second) => first.frequency - second.frequency);
}

function linearRegression(readings: Reading[]) {
  const unique = uniqueColorReadings(readings);
  if (unique.length < 2) return null;
  const scaled = unique.map((reading) => ({
    x: reading.frequency / 1e14,
    y: reading.stoppingVoltage,
  }));
  const xMean = scaled.reduce((sum, point) => sum + point.x, 0) / scaled.length;
  const yMean = scaled.reduce((sum, point) => sum + point.y, 0) / scaled.length;
  const numerator = scaled.reduce(
    (sum, point) => sum + (point.x - xMean) * (point.y - yMean),
    0,
  );
  const denominator = scaled.reduce(
    (sum, point) => sum + (point.x - xMean) ** 2,
    0,
  );
  if (denominator === 0) return null;
  const slopeScaled = numerator / denominator;
  const intercept = yMean - slopeScaled * xMean;
  const slopePerHertz = slopeScaled / 1e14;
  return {
    slopeScaled,
    intercept,
    planck: slopePerHertz * ELEMENTARY_CHARGE,
    workFunction: -intercept,
    thresholdFrequency: -intercept / slopePerHertz,
  };
}

function EquipmentIcon({ kind }: { kind: ApparatusKind }) {
  return (
    <span className={`pe-equipment-icon pe-icon-${kind}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function PhotoelectricGraph({
  kind,
  readings,
  selectedLight,
}: {
  kind: "intensity" | "frequency";
  readings: Reading[];
  selectedLight: LightKind;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, rect.width * ratio);
      canvas.height = Math.max(1, rect.height * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      const padding = { left: 43, right: 15, top: 17, bottom: 34 };
      const plotWidth = rect.width - padding.left - padding.right;
      const plotHeight = rect.height - padding.top - padding.bottom;
      const xMin = kind === "intensity" ? 20 : 5;
      const xMax = kind === "intensity" ? 100 : 8.3;
      const yMin = 0;
      const yMax = 2.2;
      const toX = (value: number) =>
        padding.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
      const toY = (value: number) =>
        padding.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

      context.strokeStyle = "rgba(49, 77, 83, 0.12)";
      context.lineWidth = 1;
      context.font = "700 9px Arial";
      context.fillStyle = "#71868a";
      context.textAlign = "right";
      [0, 0.5, 1, 1.5, 2].forEach((tick) => {
        const y = toY(tick);
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(rect.width - padding.right, y);
        context.stroke();
        context.fillText(format(tick, 1), padding.left - 7, y + 3);
      });

      context.strokeStyle = "#29464f";
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(padding.left, padding.top);
      context.lineTo(padding.left, padding.top + plotHeight);
      context.lineTo(rect.width - padding.right, padding.top + plotHeight);
      context.stroke();

      const points =
        kind === "intensity"
          ? readings
              .filter((reading) => reading.light === selectedLight)
              .map((reading) => ({
                x: reading.transmission,
                y: reading.stoppingVoltage,
                color: reading.color,
              }))
          : uniqueColorReadings(readings).map((reading) => ({
              x: reading.frequency / 1e14,
              y: reading.stoppingVoltage,
              color: reading.color,
            }));

      if (kind === "intensity" && points.length >= 2) {
        const sorted = [...points].sort((first, second) => first.x - second.x);
        context.beginPath();
        sorted.forEach((point, index) => {
          const x = toX(point.x);
          const y = toY(point.y);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.strokeStyle = LIGHTS[selectedLight].color;
        context.lineWidth = 2.5;
        context.stroke();
      }

      if (kind === "frequency") {
        const regression = linearRegression(readings);
        if (regression) {
          const startX = 5;
          const endX = 8.3;
          const startY = regression.slopeScaled * startX + regression.intercept;
          const endY = regression.slopeScaled * endX + regression.intercept;
          context.beginPath();
          context.moveTo(toX(startX), toY(startY));
          context.lineTo(toX(endX), toY(endY));
          context.strokeStyle = "#ef715b";
          context.lineWidth = 2.5;
          context.stroke();
        }
      }

      points.forEach((point) => {
        context.beginPath();
        context.arc(toX(point.x), toY(point.y), 5, 0, Math.PI * 2);
        context.fillStyle = point.color;
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = "#ffffff";
        context.stroke();
      });

      context.fillStyle = "#5f767a";
      context.font = "800 9px Arial";
      context.textAlign = "center";
      context.fillText(
        kind === "intensity" ? "Geçirgenlik (%)" : "Frekans (×10¹⁴ Hz)",
        padding.left + plotWidth / 2,
        rect.height - 8,
      );
      context.save();
      context.translate(12, padding.top + plotHeight / 2);
      context.rotate(-Math.PI / 2);
      context.fillText("Durdurma gerilimi (V)", 0, 0);
      context.restore();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kind, readings, selectedLight]);

  return <canvas ref={canvasRef} className="pe-graph-canvas" />;
}

export default function PhotoelectricLab() {
  const [installed, setInstalled] = useState<ApparatusKind[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lampState, setLampState] = useState<LampState>("off");
  const [warmProgress, setWarmProgress] = useState(0);
  const [selectedLight, setSelectedLight] = useState<LightKind>("green");
  const [alignedLight, setAlignedLight] = useState<LightKind | null>(null);
  const [transmission, setTransmission] = useState(100);
  const [discharged, setDischarged] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [displayVoltage, setDisplayVoltage] = useState(0);
  const [displayCurrent, setDisplayCurrent] = useState(0);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [hypothesis, setHypothesis] = useState("");
  const [report, setReport] = useState({
    intensity: "",
    frequency: "",
    application: "",
  });
  const [message, setMessage] = useState(
    "Malzemeleri tezgâha sürükle. Her parça doğru bağlantı noktasına yerleşir.",
  );
  const animationRef = useRef<number | null>(null);
  const lampAnimationRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (lampAnimationRef.current) cancelAnimationFrame(lampAnimationRef.current);
    },
    [],
  );

  const light = LIGHTS[selectedLight];
  const setupComplete = installed.length === SETUP_ORDER.length;
  const targetVoltage = stoppingVoltageFor(light.wavelength);
  const targetCurrent = photocurrentFor(light.wavelength, transmission);
  const regression = useMemo(() => linearRegression(readings), [readings]);
  const intensityReadings = readings.filter(
    (reading) => reading.light === selectedLight,
  );
  const frequencyReadings = uniqueColorReadings(readings);
  const nextEquipment =
    SETUP_ORDER.find((kind) => !installed.includes(kind)) ?? null;
  const stageStyle = {
    "--pe-line-color": light.color,
    "--pe-line-glow": light.glow,
    "--pe-beam-angle": `${light.stageAngle}deg`,
    "--pe-apparatus-shift": `${light.shift}px`,
    "--pe-transmission": transmission / 100,
  } as CSSProperties;

  const addEquipment = (kind: ApparatusKind) => {
    if (installed.includes(kind) || runState === "measuring") return;
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    const item = APPARATUS.find((candidate) => candidate.kind === kind);
    if (nextInstalled.length === SETUP_ORDER.length) {
      setMessage("Düzenek hazır. Cıva lambasını aç ve çizgi spektrumunun oluşmasını bekle.");
    } else {
      setMessage(`${item?.label ?? "Parça"} bağlantı noktasına yerleşti.`);
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

  const toggleLamp = () => {
    if (!setupComplete || lampState === "warming" || runState === "measuring") return;
    if (lampState === "ready") {
      setLampState("off");
      setWarmProgress(0);
      setAlignedLight(null);
      setDischarged(false);
      setDisplayVoltage(0);
      setDisplayCurrent(0);
      setMessage("Cıva ışık kaynağı kapatıldı.");
      return;
    }
    setLampState("warming");
    setWarmProgress(0);
    setMessage("Cıva lambası ısınıyor; tayf çizgilerinin netleşmesini bekle.");
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / 2200);
      setWarmProgress(progress);
      if (progress < 1) {
        lampAnimationRef.current = requestAnimationFrame(animate);
      } else {
        setLampState("ready");
        setMessage("Çizgi spektrumu hazır. Ölçmek istediğin rengi seçip yarığa hizala.");
      }
    };
    lampAnimationRef.current = requestAnimationFrame(animate);
  };

  const selectLight = (kind: LightKind) => {
    if (runState === "measuring") return;
    setSelectedLight(kind);
    setAlignedLight(null);
    setDischarged(false);
    setDisplayVoltage(0);
    setDisplayCurrent(0);
    setRunState("idle");
    setMessage(`${LIGHTS[kind].label} tayf çizgisi seçildi. h/e aparatını bu çizgiye hizala.`);
  };

  const alignSelectedLight = () => {
    if (!setupComplete || lampState !== "ready" || runState === "measuring") return;
    setAlignedLight(selectedLight);
    setDischarged(false);
    setDisplayVoltage(0);
    setDisplayCurrent(0);
    setMessage(
      `${light.label} çizgi fotodiyot yarığına hizalandı. Filtreyi ayarla ve fototüpü boşalt.`,
    );
  };

  const dischargeTube = () => {
    if (lampState !== "ready" || alignedLight !== selectedLight || runState === "measuring") {
      return;
    }
    setDischarged(true);
    setRunState("idle");
    setDisplayVoltage(0);
    setDisplayCurrent(0);
    setMessage("Fototüp boşaltıldı. Şimdi yeni ölçümü başlatabilirsin.");
  };

  const measure = () => {
    if (!setupComplete) {
      setMessage("Önce bütün gerçek düzenek parçalarını tezgâha yerleştir.");
      return;
    }
    if (lampState !== "ready") {
      setMessage("Ölçüm için cıva lambasını açıp tayfın kararlı hâle gelmesini bekle.");
      return;
    }
    if (alignedLight !== selectedLight) {
      setMessage("Seçtiğin tayf çizgisini fotodiyot yarığına hizala.");
      return;
    }
    if (!discharged) {
      setMessage("Yeni ölçümden önce h/e aparatındaki BOŞALT düğmesine bas.");
      return;
    }
    if (runState === "measuring") return;

    setRunState("measuring");
    setMessage("Fotoelektronlar toplanıyor; ideal multimetre değeri hesaplanıyor.");
    const start = performance.now();
    const duration = 1700;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.exp(-5.6 * progress);
      setDisplayVoltage(targetVoltage * eased);
      setDisplayCurrent(targetCurrent * (1 - Math.exp(-6 * progress)));
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const reading: Reading = {
        id: `${Date.now()}-${selectedLight}-${transmission}`,
        light: selectedLight,
        label: light.label,
        color: light.color,
        wavelength: light.wavelength,
        frequency: frequencyFor(light.wavelength),
        transmission,
        stoppingVoltage: targetVoltage,
        photocurrent: targetCurrent,
      };
      setDisplayVoltage(targetVoltage);
      setDisplayCurrent(targetCurrent);
      setReadings((previous) => [
        ...previous.filter(
          (item) =>
            !(item.light === selectedLight && item.transmission === transmission),
        ),
        reading,
      ]);
      setDischarged(false);
      setRunState("complete");
      setMessage(
        `${light.label} ışıkta durdurma gerilimi ${format(targetVoltage, 3)} V olarak kaydedildi. Yeni ölçüm için fototüpü boşalt.`,
      );
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const clearSetup = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (lampAnimationRef.current) cancelAnimationFrame(lampAnimationRef.current);
    setInstalled([]);
    setLampState("off");
    setWarmProgress(0);
    setAlignedLight(null);
    setDischarged(false);
    setRunState("idle");
    setDisplayVoltage(0);
    setDisplayCurrent(0);
    setMessage("Düzenek söküldü. Malzemeleri yeniden tezgâha sürükleyebilirsin.");
  };

  return (
    <section className="photoelectric-lab-section" id="fotoelektrik-deneyi">
      <div className="pe-heading">
        <div>
          <span>MODERN FİZİK · DENEY 1</span>
          <h1>Fotoelektrik etkiyi gerçek düzenekle keşfet</h1>
          <p>
            Cıva tayfından bir renk seç, fotodiyoda hizala ve multimetreden
            durdurma gerilimini oku. Şiddet ile frekansın etkisini kendi verinle ayır.
          </p>
        </div>
        <aside>
          <small>TYMM 12. SINIF</small>
          <b>FİZ.12.4.1 · FİZ.12.4.2 · FİZ.12.4.3</b>
          <span>deney yapma · veri okuryazarlığı · çıkarım</span>
        </aside>
      </div>

      <div className="pe-flow-strip" aria-label="Deney akışı">
        <span><i>1</i>Düzeneği kur</span>
        <span><i>2</i>Tayf çizgisini hizala</span>
        <span><i>3</i>Boşalt ve ölç</span>
        <span><i>4</i>Grafikten çıkarım yap</span>
      </div>

      <div className="pe-builder">
        <aside className="pe-equipment-panel">
          <div className="pe-panel-heading">
            <span>MALZEME RAFI <b>{installed.length}/6</b></span>
            <h2>Gerçek düzeneği kur</h2>
            <p>Parçayı sürükle veya dokun; kablolar ve optik eksen doğru konuma oturur.</p>
          </div>
          <div className="pe-equipment-list">
            {APPARATUS.map((item) => {
              const isInstalled = installed.includes(item.kind);
              return (
                <button
                  key={item.kind}
                  type="button"
                  draggable={!isInstalled}
                  disabled={isInstalled || runState === "measuring"}
                  className={isInstalled ? "installed" : ""}
                  onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                  onClick={() => addEquipment(item.kind)}
                >
                  <EquipmentIcon kind={item.kind} />
                  <span>
                    <b>{item.label}</b>
                    <small>{isInstalled ? "Yerine oturdu" : item.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="pe-safety-note">
            <i>!</i>
            <span>
              <b>CIVA LAMBASI GÜVENLİĞİ</b>
              Gerçek laboratuvarda koruyucu gövdeyi açma ve ışığa doğrudan bakma.
            </span>
          </div>
          <button
            className="pe-clear-button"
            type="button"
            onClick={clearSetup}
            disabled={runState === "measuring"}
          >
            Düzeneği sök
          </button>
        </aside>

        <div
          className={`pe-stage ${isDragOver ? "drag-over" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onStageDrop}
          style={stageStyle}
          aria-label="Fotoelektrik deney düzeneğinin kurulacağı tezgâh"
        >
          <div className="pe-stage-toolbar">
            <span>
              <small>CANLI MODERN FİZİK TEZGÂHI</small>
              <b>{setupComplete ? "Düzenek kuruldu" : "Kurulum bekleniyor"}</b>
            </span>
            <div>
              <span>
                <small>IŞIK</small>
                <b><i style={{ background: light.color }} />{light.label}</b>
              </span>
              <span>
                <small>GEÇİRGENLİK</small>
                <b>%{transmission}</b>
              </span>
              <span>
                <small>MULTİMETRE</small>
                <b>{format(displayVoltage, 3)} V</b>
              </span>
            </div>
          </div>

          <div className={`pe-apparatus ${lampState}`} aria-hidden="true">
            <div className="pe-lab-wall" />
            <div className="pe-workbench"><i /><i /></div>
            <div className="pe-optical-rail" />

            {installed.includes("mercury-lamp") && (
              <div className="pe-mercury-lamp">
                <i className="pe-lamp-vent" />
                <i className="pe-lamp-window" />
                <i className="pe-lamp-knob" />
                <i className="pe-lamp-foot" />
                <b>CIVA IŞIK KAYNAĞI</b>
                <span className="pe-lamp-indicator" />
              </div>
            )}

            {installed.includes("diffraction-grating") && (
              <div className="pe-grating">
                <i className="pe-grating-glass" />
                <i className="pe-grating-post" />
                <i className="pe-grating-foot" />
                <b>KIRINIM AĞI</b>
              </div>
            )}

            {lampState === "ready" && installed.includes("diffraction-grating") && (
              <div className="pe-spectrum">
                {(Object.keys(LIGHTS) as LightKind[]).map((kind) => (
                  <i
                    key={kind}
                    className={alignedLight === kind ? "selected" : ""}
                    style={{
                      "--spectrum-color": LIGHTS[kind].color,
                      "--spectrum-angle": `${LIGHTS[kind].stageAngle}deg`,
                    } as CSSProperties}
                  />
                ))}
              </div>
            )}

            {alignedLight === selectedLight && lampState === "ready" && (
              <i className="pe-selected-ray" />
            )}

            {installed.includes("he-apparatus") && (
              <>
                <div
                  className={`pe-detector-head ${
                    alignedLight === selectedLight ? "aligned" : ""
                  }`}
                >
                  <i className="pe-detector-body" />
                  <i className="pe-photodiode-window" />
                  <i className="pe-mask-slit" />
                  <i className="pe-detector-post" />
                  <i className="pe-detector-foot" />
                  <b>FOTODİYOT</b>
                  <small>GİRİŞ YARIĞI</small>
                  {runState === "measuring" && (
                    <span className="pe-electron-stream">
                      <i /><i /><i /><i /><i />
                    </span>
                  )}
                </div>

                <div className="pe-he-apparatus">
                  <i className="pe-he-body" />
                  <i className="pe-he-top" />
                  <i className="pe-discharge-button" />
                  <i className="pe-battery-test" />
                  <i className="pe-he-switch" />
                  <i className="pe-he-terminals" />
                  <b>h/e KONTROL ÜNİTESİ</b>
                  <span className="pe-he-caption">FOTODİYOT · DURDURMA GERİLİMİ</span>
                  <small className="pe-discharge-label">BOŞALT</small>
                </div>
              </>
            )}

            {installed.includes("color-filter") && (
              <div className="pe-color-filter">
                <i />
                <b>{light.label.toUpperCase()} FİLTRE</b>
              </div>
            )}

            {installed.includes("transmission-filter") && (
              <div className="pe-transmission-filter">
                {TRANSMISSIONS.map((value) => (
                  <i key={value} className={transmission === value ? "active" : ""} />
                ))}
                <b>YOĞUNLUK FİLTRESİ</b>
              </div>
            )}

            {installed.includes("multimeter") && (
              <div className="pe-multimeter">
                <i className="pe-meter-case" />
                <i className="pe-meter-screen" />
                <strong>{format(displayVoltage, 3)}</strong>
                <small>V DC</small>
                <i className="pe-meter-knob" />
                <i className="pe-meter-red-port" />
                <i className="pe-meter-black-port" />
                <b>DİJİTAL MULTİMETRE</b>
              </div>
            )}

            {installed.includes("multimeter") && installed.includes("he-apparatus") && (
              <>
                <i className="pe-cable pe-cable-red" />
                <i className="pe-cable pe-cable-black" />
                <i className="pe-cable pe-cable-signal" />
              </>
            )}

            {!setupComplete && (
              <div className="pe-drop-hint">
                <b>{nextEquipment ? "Malzemeyi tezgâha bırak" : "Düzenek hazır"}</b>
                <span>Her parça optik eksendeki doğru bağlantı noktasına oturur.</span>
              </div>
            )}
          </div>

          <div className="pe-status" aria-live="polite">
            <b>{runState === "measuring" ? "ÖLÇÜM SÜRÜYOR" : "YÖNERGE"}</b>
            <span>{message}</span>
          </div>
        </div>
      </div>

      <div className="pe-control-deck">
        <section className="pe-hypothesis-card">
          <span>ÖLÇMEDEN ÖNCE</span>
          <h2>Önce tahminini yaz</h2>
          <p>Işık şiddeti artınca durdurma gerilimi mi, fotoakım mı değişecek?</p>
          <textarea
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
            placeholder="Tahminim..."
          />
        </section>

        <section className="pe-variable-card">
          <span>DEĞİŞKENLER</span>
          <h2>Renk ve ışık şiddeti</h2>
          <div className="pe-light-options" aria-label="Cıva tayfı renkleri">
            {(Object.keys(LIGHTS) as LightKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className={selectedLight === kind ? "active" : ""}
                onClick={() => selectLight(kind)}
                disabled={runState === "measuring"}
              >
                <i style={{ background: LIGHTS[kind].color }} />
                <b>{LIGHTS[kind].label}</b>
                <small>{format(LIGHTS[kind].wavelength, kind === "yellow" ? 0 : 1)} nm</small>
              </button>
            ))}
          </div>
          <div className="pe-transmission-options">
            <span>
              <b>Geçirgenlik filtresi</b>
              <small>Işık şiddetini değiştirir</small>
            </span>
            <div>
              {TRANSMISSIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={transmission === value ? "active" : ""}
                  onClick={() => {
                    setTransmission(value);
                    setDischarged(false);
                    setRunState("idle");
                    setDisplayVoltage(0);
                    setDisplayCurrent(0);
                    setMessage(`Geçirgenlik %${value} seçildi. Yeni ölçüm için fototüpü boşalt.`);
                  }}
                  disabled={runState === "measuring"}
                >
                  %{value}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="pe-procedure-card">
          <span>DENEY İŞLEMLERİ</span>
          <button
            type="button"
            onClick={toggleLamp}
            disabled={!setupComplete || lampState === "warming" || runState === "measuring"}
            className={lampState === "ready" ? "ready" : ""}
          >
            <i>1</i>
            {lampState === "off"
              ? "Cıva lambasını aç"
              : lampState === "warming"
                ? `Lamba ısınıyor · %${Math.round(warmProgress * 100)}`
                : "Lambayı kapat"}
          </button>
          <button
            type="button"
            onClick={alignSelectedLight}
            disabled={lampState !== "ready" || runState === "measuring"}
            className={alignedLight === selectedLight ? "ready" : ""}
          >
            <i>2</i>
            {alignedLight === selectedLight
              ? `${light.label} çizgi hizalı`
              : "Seçili çizgiyi yarığa hizala"}
          </button>
          <button
            type="button"
            onClick={dischargeTube}
            disabled={alignedLight !== selectedLight || runState === "measuring"}
            className={discharged ? "ready" : ""}
          >
            <i>3</i>
            {discharged ? "Fototüp boşaltıldı" : "BOŞALT düğmesine bas"}
          </button>
          <button
            type="button"
            onClick={measure}
            disabled={runState === "measuring"}
            className="pe-measure-button"
          >
            <i>4</i>
            {runState === "measuring" ? "İDEAL DEĞER HESAPLANIYOR" : "ÖLÇ VE KAYDET"}
          </button>
        </section>
      </div>

      <div className="pe-live-reading">
        <div>
          <span>MULTİMETRE · DC VOLT</span>
          <strong>{format(displayVoltage, 3)} <small>V</small></strong>
          <p>Fotoelektronları durduran gerilim</p>
        </div>
        <div>
          <span>FOTOAKIM</span>
          <strong>{format(displayCurrent, 3)} <small>µA</small></strong>
          <p>Fotodiyoda ulaşan elektron miktarının göstergesi</p>
        </div>
        <div>
          <span>SEÇİLİ FOTON</span>
          <strong>{format(photonEnergyEv(light.wavelength), 3)} <small>eV</small></strong>
          <p>{format(light.wavelength, 1)} nm · {format(frequencyFor(light.wavelength) / 1e14, 3)} ×10¹⁴ Hz</p>
        </div>
      </div>

      <section className="pe-evidence">
        <div className="pe-evidence-heading">
          <div>
            <span>DENEY GÜNLÜĞÜ</span>
            <h2>Ölçümlerini karşılaştır</h2>
            <p>Önce aynı renkte farklı geçirgenlikleri, sonra bütün renkleri ölç.</p>
          </div>
          <strong>{readings.length}<small>kayıt</small></strong>
        </div>

        <div className="pe-data-table-wrap">
          <table className="pe-data-table">
            <thead>
              <tr>
                <th>Işık</th>
                <th>Dalga boyu</th>
                <th>Frekans</th>
                <th>Geçirgenlik</th>
                <th>Durdurma gerilimi</th>
                <th>Fotoakım</th>
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr>
                  <td colSpan={6}>İlk ölçümden sonra veriler burada görünecek.</td>
                </tr>
              ) : (
                [...readings]
                  .sort(
                    (first, second) =>
                      first.frequency - second.frequency ||
                      first.transmission - second.transmission,
                  )
                  .map((reading) => (
                    <tr key={reading.id}>
                      <td><i style={{ background: reading.color }} />{reading.label}</td>
                      <td>{format(reading.wavelength, 1)} nm</td>
                      <td>{format(reading.frequency / 1e14, 3)} ×10¹⁴ Hz</td>
                      <td>%{reading.transmission}</td>
                      <td>{format(reading.stoppingVoltage, 3)} V</td>
                      <td>{format(reading.photocurrent, 3)} µA</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        <button
          className="pe-analysis-button"
          type="button"
          onClick={() => setShowAnalysis((current) => !current)}
          disabled={readings.length < 2}
        >
          {showAnalysis ? "Grafiksel analizi gizle" : "GRAFİKSEL ANALİZİ GÖSTER"}
          <span>→</span>
        </button>

        {showAnalysis && (
          <div className="pe-analysis-grid">
            <article>
              <span>DENEY A · AYNI RENK</span>
              <h3>Şiddet - durdurma gerilimi</h3>
              <PhotoelectricGraph
                kind="intensity"
                readings={readings}
                selectedLight={selectedLight}
              />
              <p>
                {intensityReadings.length >= 2
                  ? `${light.label} ışıkta noktalar yataya yakın kalır: şiddet değişse de elektron başına maksimum enerji değişmez.`
                  : `${light.label} ışık için en az iki geçirgenlik ölçümü yap.`}
              </p>
            </article>
            <article>
              <span>DENEY B · FARKLI RENKLER</span>
              <h3>Frekans - durdurma gerilimi</h3>
              <PhotoelectricGraph
                kind="frequency"
                readings={readings}
                selectedLight={selectedLight}
              />
              <p>
                {frequencyReadings.length >= 2
                  ? "Frekans yükseldikçe durdurma gerilimi doğrusal biçimde artar."
                  : "En az iki farklı tayf çizgisini ölç."}
              </p>
            </article>
            <article className="pe-result-card">
              <span>VERİDEN HESAPLANAN</span>
              <h3>Planck sabiti ve yüzey</h3>
              {regression ? (
                <>
                  <div>
                    <small>Planck sabiti</small>
                    <strong>{format(regression.planck / 1e-34, 3)} ×10⁻³⁴ J·s</strong>
                  </div>
                  <div>
                    <small>Fotodiyot iş fonksiyonu</small>
                    <strong>{format(regression.workFunction, 3)} eV</strong>
                  </div>
                  <div>
                    <small>Eşik frekansı</small>
                    <strong>{format(regression.thresholdFrequency / 1e14, 3)} ×10¹⁴ Hz</strong>
                  </div>
                </>
              ) : (
                <p>Doğrunun eğimini belirlemek için en az iki farklı renk ölç.</p>
              )}
              <small className="pe-result-note">
                Hesap, ölçtüğün frekans-durdurma gerilimi doğrusunun eğiminden yapılır.
              </small>
            </article>
          </div>
        )}
      </section>

      <section className="pe-life-link">
        <div>
          <span>LABORATUVARDAN GÜNLÜK YAŞAMA</span>
          <h2>Aynı fikir nerede çalışıyor?</h2>
          <p>Işığın elektronlarla enerji alışverişi, çevremizdeki ışığa duyarlı teknolojilerin temelindedir.</p>
        </div>
        <div className="pe-life-cards">
          <article><i className="pe-life-solar" /><b>Güneş paneli</b><small>Işık enerjisinden elektrik üretimi</small></article>
          <article><i className="pe-life-door" /><b>Fotoselli kapı</b><small>Işık değişimini algılayan kontrol sistemi</small></article>
          <article><i className="pe-life-smoke" /><b>Duman dedektörü</b><small>Işık şiddetindeki değişimi algılama</small></article>
        </div>
      </section>

      <section className="pe-report">
        <div className="pe-report-heading">
          <div>
            <span>TYMM · AÇIK UÇLU ÇIKIŞ KARTI</span>
            <h2>Kanıtını kendi cümlelerinle açıkla</h2>
          </div>
          <small>Kısa, gözleme dayalı yanıtlar yeterlidir.</small>
        </div>
        <label>
          <span>Işık şiddeti değiştiğinde hangi ölçüm değişti, hangisi değişmedi? Tablondan kanıt göster.</span>
          <textarea
            value={report.intensity}
            onChange={(event) =>
              setReport((current) => ({ ...current, intensity: event.target.value }))
            }
            placeholder="Gözlemim ve kanıtım..."
          />
        </label>
        <label>
          <span>Frekans arttıkça durdurma geriliminin değişimini nasıl açıklarsın?</span>
          <textarea
            value={report.frequency}
            onChange={(event) =>
              setReport((current) => ({ ...current, frequency: event.target.value }))
            }
            placeholder="Grafiğe göre..."
          />
        </label>
        <label>
          <span>Bu deneyin günlük yaşamdaki bir uygulamasını seç ve çalışma fikriyle ilişkilendir.</span>
          <textarea
            value={report.application}
            onChange={(event) =>
              setReport((current) => ({ ...current, application: event.target.value }))
            }
            placeholder="Seçtiğim uygulama..."
          />
        </label>
      </section>
    </section>
  );
}
