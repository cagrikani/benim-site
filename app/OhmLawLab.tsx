"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type EquipmentKind =
  | "power-supply"
  | "resistor-board"
  | "ammeter"
  | "voltmeter"
  | "switch"
  | "cables";
type TerminalId =
  | "source-positive"
  | "source-negative"
  | "ammeter-positive"
  | "ammeter-negative"
  | "resistor-left"
  | "resistor-right"
  | "switch-left"
  | "switch-right"
  | "voltmeter-positive"
  | "voltmeter-negative";
type Connection = { id: string; from: TerminalId; to: TerminalId };
type Reading = {
  id: string;
  voltage: number;
  currentMilliamp: number;
  resistance: 100 | 1000;
};

const MIME = "application/x-ohm-equipment";
const EQUIPMENT: Array<{
  kind: EquipmentKind;
  name: string;
  shortName: string;
  detail: string;
}> = [
  {
    kind: "power-supply",
    name: "0-20 V doğru akım güç kaynağı",
    shortName: "Güç kaynağı",
    detail: "Gerilimi iki voltluk adımlarla ayarlar",
  },
  {
    kind: "resistor-board",
    name: "100 Ω ve 1000 Ω direnç panosu",
    shortName: "Direnç panosu",
    detail: "İki omik direnç arasında geçiş yapar",
  },
  {
    kind: "ammeter",
    name: "Doğru akım ampermetresi",
    shortName: "Ampermetre",
    detail: "Devreye seri bağlanır",
  },
  {
    kind: "voltmeter",
    name: "Doğru akım voltmetresi",
    shortName: "Voltmetre",
    detail: "Direncin uçlarına paralel bağlanır",
  },
  {
    kind: "switch",
    name: "Laboratuvar devre anahtarı",
    shortName: "Anahtar",
    detail: "Akımı güvenli biçimde açıp kapatır",
  },
  {
    kind: "cables",
    name: "Yalıtımlı bağlantı kabloları",
    shortName: "Kablo takımı",
    detail: "Uçlara dokunarak bağlantı kurulur",
  },
];

const TERMINALS: Record<
  TerminalId,
  { x: number; y: number; label: string; equipment: EquipmentKind; polarity: "red" | "black" }
> = {
  "source-positive": { x: 17, y: 56, label: "Kaynak +", equipment: "power-supply", polarity: "red" },
  "source-negative": { x: 9, y: 56, label: "Kaynak -", equipment: "power-supply", polarity: "black" },
  "ammeter-positive": { x: 42, y: 88, label: "Ampermetre +", equipment: "ammeter", polarity: "red" },
  "ammeter-negative": { x: 29, y: 88, label: "Ampermetre -", equipment: "ammeter", polarity: "black" },
  "resistor-left": { x: 36, y: 43, label: "Direnç kırmızı giriş", equipment: "resistor-board", polarity: "red" },
  "resistor-right": { x: 64, y: 43, label: "Direnç siyah giriş", equipment: "resistor-board", polarity: "black" },
  "switch-left": { x: 78, y: 49.5, label: "Anahtar kırmızı giriş", equipment: "switch", polarity: "red" },
  "switch-right": { x: 94.5, y: 49.5, label: "Anahtar siyah giriş", equipment: "switch", polarity: "black" },
  "voltmeter-positive": { x: 70, y: 88, label: "Voltmetre +", equipment: "voltmeter", polarity: "red" },
  "voltmeter-negative": { x: 56, y: 88, label: "Voltmetre -", equipment: "voltmeter", polarity: "black" },
};

const WIRING_STEPS: Array<{
  from: TerminalId;
  to: TerminalId;
  title: string;
  detail: string;
}> = [
  {
    from: "source-positive",
    to: "ammeter-positive",
    title: "Kaynağı ampermetreye bağla",
    detail: "Güç kaynağının kırmızı (+) ucundan ampermetrenin kırmızı (+) ucuna git.",
  },
  {
    from: "ammeter-negative",
    to: "resistor-left",
    title: "Ampermetreden dirence geç",
    detail: "Ampermetrenin siyah (-) ucunu direncin sol ucuna bağla.",
  },
  {
    from: "resistor-right",
    to: "switch-left",
    title: "Direnci anahtara bağla",
    detail: "Direncin sağ ucundan devre anahtarının girişine git.",
  },
  {
    from: "switch-right",
    to: "source-negative",
    title: "Seri akım yolunu tamamla",
    detail: "Anahtarın çıkışını güç kaynağının siyah (-) ucuna bağla.",
  },
  {
    from: "voltmeter-positive",
    to: "resistor-left",
    title: "Voltmetrenin artı ucunu bağla",
    detail: "Voltmetrenin kırmızı (+) ucunu direncin sol ucuna bağla.",
  },
  {
    from: "voltmeter-negative",
    to: "resistor-right",
    title: "Paralel ölçüm kolunu tamamla",
    detail: "Voltmetrenin siyah (-) ucunu direncin sağ ucuna bağla.",
  },
];

const REQUIRED_CONNECTIONS: Array<[TerminalId, TerminalId]> = WIRING_STEPS.map(
  ({ from, to }) => [from, to],
);

const WIRE_COLORS = ["#dc3f38", "#202c31", "#e3a025", "#26363c", "#c93834", "#26363c"];
const WIRE_ROUTE_LEVELS = [0.945, 0.97, 0.65, 0.69, 0.925, 0.89];
const EQUIPMENT_IMAGES: Record<EquipmentKind, string> = {
  "power-supply": "./ohm-power-supply-real-v2.webp",
  "resistor-board": "./ohm-resistor-board-real-v2.webp",
  ammeter: "./ohm-analog-meter-real-v2.webp",
  voltmeter: "./ohm-analog-meter-real-v2.webp",
  switch: "./ohm-knife-switch-real-v2.webp",
  cables: "./ohm-cable-kit-real-v2.webp",
};

function connectionKey(first: TerminalId, second: TerminalId) {
  return [first, second].sort().join("--");
}

const REQUIRED_KEYS = new Set(
  REQUIRED_CONNECTIONS.map(([first, second]) => connectionKey(first, second)),
);

function EquipmentIcon({ kind }: { kind: EquipmentKind }) {
  return (
    <span className={`ohm-equipment-icon ohm-icon-${kind} has-photo`} aria-hidden="true">
      <img src={EQUIPMENT_IMAGES[kind]} alt="" draggable={false} />
    </span>
  );
}

function WireCanvas({ connections }: { connections: Connection[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = Math.max(rect.height, 360);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    connections.forEach((connection, index) => {
      const from = TERMINALS[connection.from];
      const to = TERMINALS[connection.to];
      const x1 = (from.x / 100) * width;
      const y1 = (from.y / 100) * height;
      const x2 = (to.x / 100) * width;
      const y2 = (to.y / 100) * height;
      const bend = Math.max(
        Math.max(y1, y2) + 20,
        WIRE_ROUTE_LEVELS[index % WIRE_ROUTE_LEVELS.length] * height,
      );
      const wireColor = WIRE_COLORS[index % WIRE_COLORS.length];

      const traceCable = () => {
        context.beginPath();
        context.moveTo(x1, y1);
        context.bezierCurveTo(x1, bend, x2, bend, x2, y2);
      };

      traceCable();
      context.strokeStyle = "rgba(18, 25, 27, 0.32)";
      context.lineWidth = 11;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();

      traceCable();
      context.strokeStyle = wireColor;
      context.lineWidth = 7;
      context.stroke();

      traceCable();
      context.strokeStyle = "rgba(255, 255, 255, 0.28)";
      context.lineWidth = 1.35;
      context.stroke();
    });
  }, [connections]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  return <canvas className="ohm-wire-canvas" ref={canvasRef} aria-hidden="true" />;
}

function Meter({
  kind,
  value,
  active,
}: {
  kind: "ammeter" | "voltmeter";
  value: number;
  active: boolean;
}) {
  const max = kind === "ammeter" ? 200 : 20;
  const needle = -58 + Math.min(1, value / max) * 116;
  return (
    <div className={`ohm-meter ohm-${kind} ${active ? "active" : ""}`}>
      <img
        className="ohm-real-meter-photo"
        src="./ohm-analog-meter-real-v2.webp"
        alt={kind === "ammeter" ? "Gerçekçi analog doğru akım ampermetresi" : "Gerçekçi analog doğru akım voltmetresi"}
        draggable={false}
      />
      <div className="ohm-meter-face">
        <span>{kind === "ammeter" ? "DC mA" : "DC V"}</span>
        <i
          className="ohm-meter-needle"
          style={{ "--meter-needle": `${needle}deg` } as CSSProperties}
        />
        <b>{value.toFixed(kind === "ammeter" ? 1 : 2)}</b>
      </div>
      <small>{kind === "ammeter" ? "AMPERMETRE" : "VOLTMETRE"}</small>
    </div>
  );
}

function OhmGraph({ readings }: { readings: Reading[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.getBoundingClientRect().width, 320);
    const height = 330;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const margin = { left: 56, right: 22, top: 24, bottom: 48 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = (current: number) => margin.left + (current / 200) * plotWidth;
    const y = (voltage: number) => margin.top + plotHeight - (voltage / 20) * plotHeight;

    context.fillStyle = "#fbfdfc";
    context.fillRect(0, 0, width, height);
    context.font = "700 11px Arial";
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let current = 0; current <= 200; current += 20) {
      const px = x(current);
      context.beginPath();
      context.moveTo(px, margin.top);
      context.lineTo(px, margin.top + plotHeight);
      context.strokeStyle = current % 40 === 0 ? "#d4e2df" : "#edf3f1";
      context.lineWidth = 1;
      context.stroke();
      if (current % 40 === 0) {
        context.fillStyle = "#63787d";
        context.fillText(String(current), px, margin.top + plotHeight + 8);
      }
    }
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let voltage = 0; voltage <= 20; voltage += 2) {
      const py = y(voltage);
      context.beginPath();
      context.moveTo(margin.left, py);
      context.lineTo(margin.left + plotWidth, py);
      context.strokeStyle = voltage % 4 === 0 ? "#d4e2df" : "#edf3f1";
      context.stroke();
      if (voltage % 4 === 0) {
        context.fillStyle = "#63787d";
        context.fillText(String(voltage), margin.left - 9, py);
      }
    }

    context.strokeStyle = "#173f59";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(margin.left, margin.top);
    context.lineTo(margin.left, margin.top + plotHeight);
    context.lineTo(margin.left + plotWidth, margin.top + plotHeight);
    context.stroke();

    ([100, 1000] as const).forEach((resistance) => {
      const series = readings
        .filter((reading) => reading.resistance === resistance)
        .sort((a, b) => a.currentMilliamp - b.currentMilliamp);
      const color = resistance === 100 ? "#e14f43" : "#157f75";
      if (series.length > 1) {
        context.beginPath();
        series.forEach((reading, index) => {
          const px = x(reading.currentMilliamp);
          const py = y(reading.voltage);
          if (index === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.stroke();
      }
      series.forEach((reading) => {
        context.beginPath();
        context.arc(x(reading.currentMilliamp), y(reading.voltage), 5.5, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
        context.strokeStyle = "white";
        context.lineWidth = 2;
        context.stroke();
      });
    });

    context.fillStyle = "#284f5d";
    context.font = "800 12px Arial";
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillText("Akım (mA)", margin.left + plotWidth / 2, height - 8);
    context.save();
    context.translate(15, margin.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText("Gerilim (V)", 0, 0);
    context.restore();
  }, [readings]);

  return <canvas ref={canvasRef} className="ohm-graph-canvas" aria-label="Akım-gerilim grafiği" />;
}

export default function OhmLawLab() {
  const measurementTimeoutRef = useRef<number | null>(null);
  const [installed, setInstalled] = useState<EquipmentKind[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalId | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [resistance, setResistance] = useState<100 | 1000>(100);
  const [voltage, setVoltage] = useState(2);
  const [powerOn, setPowerOn] = useState(false);
  const [switchClosed, setSwitchClosed] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [prediction, setPrediction] = useState("");
  const [notice, setNotice] = useState(
    "Önce güç kaynağını deney tezgâhına sürükle.",
  );

  const allInstalled = installed.length === EQUIPMENT.length;
  const circuitComplete = connections.length === REQUIRED_CONNECTIONS.length;
  const circuitActive = allInstalled && circuitComplete && powerOn && switchClosed;
  const currentMilliamp = circuitActive ? (voltage / resistance) * 1000 : 0;
  const nonzeroReadings = readings.filter((reading) => reading.voltage > 0);
  const analysisReady = nonzeroReadings.length >= 3;
  const nextWiringStep = WIRING_STEPS.find(
    ({ from, to }) =>
      !connections.some(
        (connection) => connection.id === connectionKey(from, to),
      ),
  ) ?? null;
  const nextWiringStepNumber = nextWiringStep
    ? WIRING_STEPS.indexOf(nextWiringStep) + 1
    : WIRING_STEPS.length;

  const seriesProgress = useMemo(
    () => ({
      100: new Set(readings.filter((reading) => reading.resistance === 100).map((reading) => reading.voltage)).size,
      1000: new Set(readings.filter((reading) => reading.resistance === 1000).map((reading) => reading.voltage)).size,
    }),
    [readings],
  );

  const install = (kind: EquipmentKind) => {
    if (installed.includes(kind)) return;
    setInstalled((current) => [...current, kind]);
    const next = EQUIPMENT.find((item) => item.kind !== kind && !installed.includes(item.kind));
    setNotice(
      next
        ? `${EQUIPMENT.find((item) => item.kind === kind)?.shortName} yerleştirildi. Sıradaki: ${next.shortName}.`
        : "Tüm araçlar tezgâhta. Kırmızı kaynak ucundan başlayarak bağlantıları kur.",
    );
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
    setDragOver(false);
    const kind = event.dataTransfer.getData(MIME) as EquipmentKind;
    if (EQUIPMENT.some((item) => item.kind === kind)) install(kind);
  };

  const connectTerminal = (terminal: TerminalId) => {
    if (!installed.includes("cables")) {
      setNotice("Bağlantı yapabilmek için kablo takımını tezgâha yerleştir.");
      return;
    }
    if (!installed.includes(TERMINALS[terminal].equipment)) return;
    if (!selectedTerminal) {
      setSelectedTerminal(terminal);
      setNotice(`${TERMINALS[terminal].label} seçildi. Bağlanacağı ikinci uca dokun.`);
      return;
    }
    if (selectedTerminal === terminal) {
      setSelectedTerminal(null);
      setNotice("Uç seçimi iptal edildi.");
      return;
    }

    const key = connectionKey(selectedTerminal, terminal);
    setSelectedTerminal(null);
    if (!REQUIRED_KEYS.has(key)) {
      setNotice("Bu iki uç doğru ölçüm bağlantısını oluşturmuyor. Seri akım yolunu ve paralel gerilim uçlarını düşün.");
      return;
    }
    if (connections.some((connection) => connection.id === key)) {
      setNotice("Bu bağlantı zaten kurulu.");
      return;
    }
    const nextConnections = [
      ...connections,
      { id: key, from: selectedTerminal, to: terminal },
    ];
    setConnections(nextConnections);
    setNotice(
      nextConnections.length === REQUIRED_CONNECTIONS.length
        ? "Devre tamamlandı. Güç kaynağını aç, ardından anahtarı kapat."
        : `Bağlantı tamamlandı. ${REQUIRED_CONNECTIONS.length - nextConnections.length} kablo kaldı.`,
    );
  };

  const connectGuidedCable = () => {
    if (!allInstalled || !installed.includes("cables")) {
      setNotice("Önce bütün araçları ve kablo takımını tezgâha yerleştir.");
      return;
    }
    if (!nextWiringStep) return;
    const key = connectionKey(nextWiringStep.from, nextWiringStep.to);
    const nextConnections = [
      ...connections,
      { id: key, from: nextWiringStep.from, to: nextWiringStep.to },
    ];
    const followingStep = WIRING_STEPS.find(
      ({ from, to }) =>
        !nextConnections.some(
          (connection) => connection.id === connectionKey(from, to),
        ),
    );
    setSelectedTerminal(null);
    setConnections(nextConnections);
    setNotice(
      followingStep
        ? `Kablo yerleşti. Sıradaki: ${followingStep.detail}`
        : "Altı bağlantı da tamamlandı. Güç kaynağını aç, ardından anahtarı kapat.",
    );
  };

  const removeConnection = (id: string) => {
    if (powerOn) {
      setNotice("Kabloyu sökmeden önce güç kaynağını kapat.");
      return;
    }
    setConnections((current) => current.filter((connection) => connection.id !== id));
    setSwitchClosed(false);
    setNotice("Seçilen kablo çıkarıldı.");
  };

  const togglePower = () => {
    if (!circuitComplete) {
      setNotice("Güç vermeden önce altı doğru bağlantıyı tamamla.");
      return;
    }
    setPowerOn((current) => !current);
    if (powerOn) {
      setSwitchClosed(false);
      setNotice("Güç kaynağı kapatıldı; devre güvenli durumda.");
    } else {
      setNotice("Güç kaynağı açık. Akım için devre anahtarını kapat.");
    }
  };

  const toggleSwitch = () => {
    if (!powerOn) {
      setNotice("Önce güç kaynağını aç.");
      return;
    }
    setSwitchClosed((current) => !current);
    setNotice(switchClosed ? "Anahtar açıldı; akım sıfırlandı." : "Anahtar kapandı; ölçüm cihazları ideal değeri gösteriyor.");
  };

  const recordMeasurement = () => {
    if (!circuitActive || isMeasuring) {
      setNotice("Ölçüm için güç kaynağı açık ve devre anahtarı kapalı olmalı.");
      return;
    }
    setIsMeasuring(true);
    setNotice("Ampermetre ve voltmetre ideal değerleri birlikte kaydediyor.");
    measurementTimeoutRef.current = window.setTimeout(() => {
      const reading: Reading = {
        id: `${resistance}-${voltage}`,
        resistance,
        voltage,
        currentMilliamp: (voltage / resistance) * 1000,
      };
      setReadings((current) => [
        ...current.filter((item) => item.id !== reading.id),
        reading,
      ].sort((a, b) => a.resistance - b.resistance || a.voltage - b.voltage));
      setIsMeasuring(false);
      measurementTimeoutRef.current = null;
      setNotice(`${resistance} Ω dirençte ${voltage.toFixed(0)} V ve ${reading.currentMilliamp.toFixed(1)} mA kaydedildi.`);
    }, 700);
  };

  const resetExperiment = () => {
    if (measurementTimeoutRef.current !== null) {
      window.clearTimeout(measurementTimeoutRef.current);
      measurementTimeoutRef.current = null;
    }
    setInstalled([]);
    setSelectedTerminal(null);
    setConnections([]);
    setResistance(100);
    setVoltage(2);
    setPowerOn(false);
    setSwitchClosed(false);
    setIsMeasuring(false);
    setReadings([]);
    setShowAnalysis(false);
    setPrediction("");
    setNotice("Önce güç kaynağını deney tezgâhına sürükle.");
  };

  useEffect(
    () => () => {
      if (measurementTimeoutRef.current !== null) {
        window.clearTimeout(measurementTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <section className="ohm-lab-section" id="ohm-yasasi-deneyi">
      <div className="ohm-heading">
        <div>
          <span>ELEKTRİK · DENEY 1 · FİZ.10.3.3</span>
          <h1>Devreyi kur, örüntüden Ohm yasasına ulaş.</h1>
          <p>
            Akımı ve gerilimi aynı devrede ölç; iki farklı direnç için oluşan
            doğrusal ilişkiyi kendi verilerinle açıkla.
          </p>
        </div>
        <aside>
          <b>İDEAL ÖLÇÜM</b>
          <span>0-20 V doğru akım</span>
          <small>Tek dirençli basit devre</small>
        </aside>
      </div>

      <div className="ohm-inquiry-strip">
        <div>
          <span>ÖNCE TAHMİN ET</span>
          <b>Gerilim iki katına çıkarsa akımın nasıl değişmesini beklersin?</b>
        </div>
        <label>
          <span className="sr-only">Deney öncesi tahmin</span>
          <input
            value={prediction}
            onChange={(event) => setPrediction(event.target.value)}
            placeholder="Kısa tahminini yaz…"
          />
        </label>
      </div>

      <div className="ohm-builder">
        <aside className="ohm-equipment-panel">
          <div className="ohm-panel-heading">
            <span>MALZEME RAFI</span>
            <b>Tut, sürükle ve tezgâha bırak</b>
          </div>
          <div className="ohm-equipment-list">
            {EQUIPMENT.map((item) => (
              <button
                type="button"
                draggable={!installed.includes(item.kind)}
                disabled={installed.includes(item.kind)}
                className={installed.includes(item.kind) ? "installed" : ""}
                onClick={() => install(item.kind)}
                onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                key={item.kind}
              >
                <EquipmentIcon kind={item.kind} />
                <span>
                  <b>{item.shortName}</b>
                  <small>{installed.includes(item.kind) ? "Tezgâhta" : item.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <button className="ohm-reset-button" type="button" onClick={resetExperiment}>
            Deneyi baştan kur
          </button>
        </aside>

        <div
          className={`ohm-stage ${dragOver ? "drag-over" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onStageDrop}
        >
          <div className="ohm-stage-toolbar">
            <span>
              <small>DÜZENEK DURUMU</small>
              <b>{circuitComplete ? "Ölçüme hazır Ohm devresi" : "Kurulum sürüyor"}</b>
            </span>
            <span className={circuitComplete ? "ready" : ""}>
              {installed.length}/{EQUIPMENT.length} araç · {connections.length}/{REQUIRED_CONNECTIONS.length} kablo
            </span>
          </div>

          <div className="ohm-notice" role="status">
            <i>{circuitComplete ? "✓" : installed.length + 1}</i>
            <span>{notice}</span>
          </div>

          <section className={`ohm-wiring-guide ${circuitComplete ? "complete" : ""}`}>
            <div className="ohm-wiring-guide-heading">
              <span>
                <small>KABLO BAĞLANTI REHBERİ</small>
                <b>
                  {!allInstalled
                    ? "Önce malzemeleri tamamla"
                    : circuitComplete
                      ? "Bütün bağlantılar tamamlandı"
                      : `${nextWiringStepNumber}. kablo / ${WIRING_STEPS.length}`}
                </b>
              </span>
              <strong>{circuitComplete ? "✓" : `${connections.length}/${WIRING_STEPS.length}`}</strong>
            </div>
            {nextWiringStep ? (
              <>
                <div className="ohm-guide-copy">
                  <span>
                    <i>1</i>
                    <small>ÖNCE BU UÇ</small>
                    <b>{TERMINALS[nextWiringStep.from].label}</b>
                  </span>
                  <em>→</em>
                  <span>
                    <i>2</i>
                    <small>SONRA BU UÇ</small>
                    <b>{TERMINALS[nextWiringStep.to].label}</b>
                  </span>
                </div>
                <div className="ohm-guide-action">
                  <span>
                    <b>{nextWiringStep.title}</b>
                    <small>{nextWiringStep.detail}</small>
                  </span>
                  <button type="button" onClick={connectGuidedCable} disabled={!allInstalled}>
                    Gösterilen kabloyu bağla
                  </button>
                </div>
              </>
            ) : (
              <div className="ohm-guide-complete">
                <i>✓</i>
                <span>
                  <b>Ampermetre seri, voltmetre dirence paralel bağlandı.</b>
                  <small>
                    {!powerOn
                      ? "Ölçüme geçmek için güç kaynağını aç."
                      : !switchClosed
                        ? "Şimdi devre anahtarını kapat."
                        : "Devre enerjili; ideal ölçümü kaydedebilirsin."}
                  </small>
                </span>
              </div>
            )}
          </section>

          <div className="ohm-apparatus">
            <img
              className="ohm-real-bench-photo"
              src="./ohm-lab-bench-real-v2.webp"
              alt="Elektrik devresinin kurulduğu gerçekçi okul laboratuvarı tezgâhı"
              draggable={false}
            />
            {circuitComplete && (
              <div className={`ohm-operation-guide ${circuitActive ? "complete" : ""}`} role="status">
                <span className={powerOn ? "done" : "active"}>
                  <i>{powerOn ? "✓" : "1"}</i>
                  <b>Güç kaynağını aç</b>
                  <small>{powerOn ? "Güç açık" : "Önce güç düğmesine bas"}</small>
                </span>
                <em>→</em>
                <span className={switchClosed ? "done" : powerOn ? "active" : "pending"}>
                  <i>{switchClosed ? "✓" : "2"}</i>
                  <b>Devre anahtarını kapat</b>
                  <small>{switchClosed ? "Anahtar kapalı" : "Sonra metal kolu kapat"}</small>
                </span>
                {circuitActive && <strong>ÖLÇÜME HAZIR</strong>}
              </div>
            )}
            <WireCanvas connections={connections} />

            {installed.includes("power-supply") && (
              <div className={`ohm-power-supply ${powerOn ? "on" : ""}`}>
                <img
                  className="ohm-real-power-photo"
                  src="./ohm-power-supply-real-v2.webp"
                  alt="Gerçekçi alçak gerilim doğru akım güç kaynağı"
                  draggable={false}
                />
                <strong>DC GÜÇ KAYNAĞI</strong>
                <div className="ohm-source-display">
                  <b>{powerOn ? voltage.toFixed(1) : "0.0"}</b>
                  <em>V</em>
                </div>
                <button
                  type="button"
                  onClick={togglePower}
                  aria-label={powerOn ? "Güç kaynağını kapat" : "Güç kaynağını aç"}
                >
                  <i />
                  <span>{powerOn ? "GÜÇ AÇIK" : "GÜÇ"}</span>
                </button>
              </div>
            )}

            {installed.includes("resistor-board") && (
              <div className="ohm-resistor-board">
                <img
                  className="ohm-real-resistor-photo"
                  src="./ohm-resistor-board-real-v2.webp"
                  alt="Gerçekçi omik direnç deney panosu"
                  draggable={false}
                />
                <small>OMİK DİRENÇ</small>
                <b>R = {resistance} Ω</b>
              </div>
            )}

            {installed.includes("ammeter") && (
              <Meter kind="ammeter" value={currentMilliamp} active={circuitActive} />
            )}
            {installed.includes("voltmeter") && (
              <Meter kind="voltmeter" value={circuitActive ? voltage : 0} active={circuitActive} />
            )}

            {installed.includes("switch") && (
              <button
                type="button"
                className={`ohm-circuit-switch ${switchClosed ? "closed" : ""}`}
                onClick={toggleSwitch}
                aria-label={switchClosed ? "Devre anahtarını aç" : "Devre anahtarını kapat"}
              >
                <img
                  className="ohm-real-switch-photo"
                  src="./ohm-knife-switch-real-v2.webp"
                  alt="Gerçekçi laboratuvar devre anahtarı"
                  draggable={false}
                />
                <span><i /></span>
                <b>{switchClosed ? "KAPALI DEVRE" : "AÇIK DEVRE"}</b>
              </button>
            )}

            {(Object.keys(TERMINALS) as TerminalId[]).map((terminal) => {
              const item = TERMINALS[terminal];
              if (!installed.includes(item.equipment)) return null;
              const isGuideStart = nextWiringStep?.from === terminal;
              const isGuideEnd = nextWiringStep?.to === terminal;
              const connected = connections.some(
                (connection) => connection.from === terminal || connection.to === terminal,
              );
              return (
                <button
                  type="button"
                  className={`ohm-terminal ${item.polarity} ${selectedTerminal === terminal ? "selected" : ""} ${connected ? "connected" : ""} ${isGuideStart ? "guide-start" : ""} ${isGuideEnd ? "guide-end" : ""}`}
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  onClick={() => connectTerminal(terminal)}
                  aria-label={`${isGuideStart ? "Önce " : isGuideEnd ? "Sonra " : ""}${item.label}${connected ? ", bağlı" : ", bağlantı bekliyor"}`}
                  key={terminal}
                >
                  <i />
                  <span>
                    {isGuideStart ? "1 · ÖNCE: " : isGuideEnd ? "2 · SONRA: " : ""}
                    {item.label}
                  </span>
                </button>
              );
            })}

            {!installed.length && (
              <div className="ohm-empty-stage">
                <i>＋</i>
                <b>Malzemeleri bu tezgâha yerleştir</b>
                <span>Düzeneğin gerçek bağlantı noktaları yerleştikçe açılır.</span>
              </div>
            )}
          </div>

          {connections.length > 0 && (
            <div className="ohm-connection-list">
              <span>Bağlantılar</span>
              {connections.map((connection, index) => (
                <button type="button" onClick={() => removeConnection(connection.id)} key={connection.id}>
                  <i style={{ background: WIRE_COLORS[index % WIRE_COLORS.length] }} />
                  {TERMINALS[connection.from].label} → {TERMINALS[connection.to].label}
                  <b>×</b>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="ohm-controls">
        <div className="ohm-control-heading">
          <div>
            <span>ÖLÇÜM KONSOLU</span>
            <h2>Bir değişkeni seç, değerleri birlikte kaydet.</h2>
          </div>
          <span className={circuitActive ? "active" : ""}>
            <i /> {circuitActive ? "Devreden akım geçiyor" : "Devre enerjisiz"}
          </span>
        </div>
        <div className="ohm-control-grid">
          <article>
            <small>1 · DİRENÇ SEÇ</small>
            <div className="ohm-resistance-buttons">
              {([100, 1000] as const).map((value) => (
                <button
                  type="button"
                  className={resistance === value ? "selected" : ""}
                  disabled={powerOn}
                  onClick={() => {
                    setResistance(value);
                    setNotice(`${value} Ω direnç panoya takıldı.`);
                  }}
                  key={value}
                >
                  <i className={`mini-resistor resistor-${value}`}><span /><span /><span /></i>
                  <b>{value} Ω</b>
                  <small>{seriesProgress[value]} kayıt</small>
                </button>
              ))}
            </div>
            {powerOn && <em>Direnci değiştirmek için önce kaynağı kapat.</em>}
          </article>
          <article>
            <small>2 · GERİLİMİ AYARLA</small>
            <label>
              <span><b>{voltage} V</b><small>0-20 V</small></span>
              <input
                type="range"
                min="0"
                max="20"
                step="2"
                value={voltage}
                onChange={(event) => setVoltage(Number(event.target.value))}
                disabled={!installed.includes("power-supply")}
              />
            </label>
            <div className="ohm-voltage-ticks">
              {[0, 4, 8, 12, 16, 20].map((value) => <span key={value}>{value}</span>)}
            </div>
          </article>
          <article className="ohm-live-reading">
            <small>3 · BİRLİKTE ÖLÇ</small>
            <div>
              <span><small>Voltmetre</small><b>{circuitActive ? voltage.toFixed(2) : "0.00"} V</b></span>
              <span><small>Ampermetre</small><b>{currentMilliamp.toFixed(1)} mA</b></span>
            </div>
            <button type="button" onClick={recordMeasurement} disabled={!circuitActive || isMeasuring}>
              {isMeasuring ? "İdeal değerler kaydediliyor…" : "Ölç ve tabloya kaydet"}
            </button>
          </article>
        </div>
      </section>

      <section className="ohm-evidence">
        <div className="ohm-evidence-heading">
          <div>
            <span>CANLI DENEY KANITLARI</span>
            <h2>Tablo ve grafik aynı ölçümlerden oluşur.</h2>
          </div>
          <b>{readings.length}<small>kayıt</small></b>
        </div>
        <div className="ohm-evidence-grid">
          <article className="ohm-data-card">
            <div className="ohm-card-heading">
              <b>Akım-gerilim tablosu</b>
              <span>İdeal sistem</span>
            </div>
            <div className="ohm-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Direnç</th>
                    <th>Gerilim V</th>
                    <th>Akım I</th>
                    <th>V / I</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.length ? readings.map((reading) => (
                    <tr key={reading.id}>
                      <th>{reading.resistance} Ω</th>
                      <td>{reading.voltage.toFixed(2)} V</td>
                      <td>{reading.currentMilliamp.toFixed(1)} mA</td>
                      <td>{reading.voltage === 0 ? "—" : `${reading.resistance} Ω`}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4}>Devreyi çalıştırıp ilk ölçümü kaydettiğinde tablo oluşur.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
          <article className="ohm-graph-card">
            <div className="ohm-card-heading">
              <b>Gerilim-akım grafiği</b>
              <span><i className="r100" />100 Ω <i className="r1000" />1000 Ω</span>
            </div>
            <OhmGraph readings={readings} />
            <p>Yatay eksen akımı, düşey eksen gerilimi gösterir.</p>
          </article>
        </div>
      </section>

      <section className="ohm-analysis-prompt">
        <div>
          <span>ÖRÜNTÜYÜ GENELLE</span>
          <h2>Ölçümlerden matematiksel modele geç.</h2>
          <p>{analysisReady ? "Yeterli verin var. Sabit oranı ve grafiğin anlamını incele." : "Analizi açmak için en az üç sıfırdan farklı gerilim ölçümü kaydet."}</p>
        </div>
        <button
          type="button"
          disabled={!analysisReady}
          onClick={() => setShowAnalysis((current) => !current)}
        >
          {showAnalysis ? "Analizi kapat" : "Örüntüyü göster"} →
        </button>
      </section>

      {showAnalysis && analysisReady && (
        <section className="ohm-analysis">
          <div className="ohm-analysis-grid">
            <article>
              <span>1</span>
              <b>Doğrusal değişim</b>
              <p>Direnç sabitken gerilim arttıkça akım aynı oranda arttı.</p>
            </article>
            <article>
              <span>2</span>
              <b>Sabit oran</b>
              <p>Her sıfırdan farklı ölçümde V / I oranı seçilen dirence eşit kaldı.</p>
            </article>
            <article>
              <span>3</span>
              <b>Matematiksel model</b>
              <p>Bu örüntü <strong>V = I · R</strong> modeliyle ifade edilir.</p>
            </article>
          </div>
          <div className="ohm-analysis-result">
            <span><small>100 Ω serisi</small><b>{seriesProgress[100]} nokta</b></span>
            <span><small>1000 Ω serisi</small><b>{seriesProgress[1000]} nokta</b></span>
            <p>Daha büyük dirençte aynı gerilim için daha küçük akım oluştu.</p>
          </div>
        </section>
      )}

      <section className="ohm-report">
        <div className="ohm-report-heading">
          <span>TYMM · KISA DENEY RAPORU</span>
          <h2>Sonucunu kendi ölçümlerinden çıkar.</h2>
          <p>Yanıtlarında tablodan en az iki değer kullan.</p>
        </div>
        <div className="ohm-report-grid">
          <label>
            <span>1 · GERİLİM VE AKIM</span>
            Aynı dirençte gerilim arttıkça akım nasıl değişti?
            <textarea rows={4} aria-label="Gerilim ve akım ilişkisini yorumlama" />
          </label>
          <label>
            <span>2 · DİRENCİN ETKİSİ</span>
            Aynı gerilimde 100 Ω ve 1000 Ω dirençlerin akımlarını karşılaştır.
            <textarea rows={4} aria-label="Direncin akıma etkisini yorumlama" />
          </label>
          <label>
            <span>3 · ÖLÇÜM BAĞLANTISI</span>
            Ampermetre neden seri, voltmetre neden direncin uçlarına paralel bağlandı?
            <textarea rows={4} aria-label="Ölçüm araçlarının bağlantısını açıklama" />
          </label>
          <label>
            <span>4 · GRAFİKSEL KANIT</span>
            Grafiğin doğrusal olması ve V/I oranının sabit kalması neyi gösterir?
            <textarea rows={4} aria-label="Ohm yasasını grafikle açıklama" />
          </label>
        </div>
        <label className="ohm-report-conclusion">
          <span>SONUÇ</span>
          Elektrik akımı, potansiyel fark ve direnç arasındaki ilişki için veriye dayalı bir genelleme yaz.
          <textarea rows={5} aria-label="Ohm yasası deney sonucu" />
        </label>
      </section>
    </section>
  );
}
