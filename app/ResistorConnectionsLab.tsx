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

type CircuitMode = "series" | "parallel";
type EquipmentKind =
  | "power-supply"
  | "ammeter"
  | "voltmeter"
  | "resistor-a"
  | "resistor-b"
  | "switch"
  | "cables";
type TerminalId =
  | "source-positive"
  | "source-negative"
  | "ammeter-positive"
  | "ammeter-negative"
  | "voltmeter-positive"
  | "voltmeter-negative"
  | "resistor-a-left"
  | "resistor-a-right"
  | "resistor-b-left"
  | "resistor-b-right"
  | "switch-left"
  | "switch-right";

type Connection = { id: string; from: TerminalId; to: TerminalId };
type WiringStep = { from: TerminalId; to: TerminalId; title: string; detail: string };
type Reading = {
  id: string;
  mode: CircuitMode;
  resistorA: number;
  resistorB: number;
  voltage: number;
  equivalentResistance: number;
  totalCurrentMilliamp: number;
  currentA: number;
  currentB: number;
  voltageA: number;
  voltageB: number;
};

const MIME = "application/x-resistor-connections-equipment";
const RESISTANCE_OPTIONS = [100, 220, 330, 470] as const;
const WIRE_COLORS = ["#dc3f38", "#202c31", "#d99824", "#26363c", "#c93834", "#26363c", "#bc4038", "#26363c"];
const WIRE_ROUTE_LEVELS = [0.94, 0.72, 0.66, 0.61, 0.76, 0.81, 0.9, 0.86];

const EQUIPMENT: Array<{
  kind: EquipmentKind;
  name: string;
  detail: string;
}> = [
  { kind: "power-supply", name: "Güç kaynağı", detail: "3-12 V doğru akım" },
  { kind: "ammeter", name: "Ampermetre", detail: "Toplam akımı ölçer" },
  { kind: "voltmeter", name: "Voltmetre", detail: "Direnç uçlarını ölçer" },
  { kind: "resistor-a", name: "A direnci", detail: "Değeri değiştirilebilir" },
  { kind: "resistor-b", name: "B direnci", detail: "Değeri değiştirilebilir" },
  { kind: "switch", name: "Devre anahtarı", detail: "Akımı açıp kapatır" },
  { kind: "cables", name: "Kablo takımı", detail: "Uçlara dokunarak bağlanır" },
];

const EQUIPMENT_IMAGES: Record<EquipmentKind, string> = {
  "power-supply": "./ohm-power-supply-real-v2.webp",
  ammeter: "./ohm-analog-meter-real-v2.webp",
  voltmeter: "./ohm-analog-meter-real-v2.webp",
  "resistor-a": "./resistor-module-real-v1.webp",
  "resistor-b": "./resistor-module-real-v1.webp",
  switch: "./ohm-knife-switch-real-v2.webp",
  cables: "./ohm-cable-kit-real-v2.webp",
};

const TERMINALS: Record<
  TerminalId,
  { x: number; y: number; label: string; equipment: EquipmentKind; polarity: "red" | "black" }
> = {
  "source-positive": { x: 11.6, y: 55.7, label: "Kaynak kırmızı giriş", equipment: "power-supply", polarity: "red" },
  "source-negative": { x: 9.1, y: 55.7, label: "Kaynak siyah giriş", equipment: "power-supply", polarity: "black" },
  "ammeter-positive": { x: 42, y: 88, label: "Ampermetre kırmızı giriş", equipment: "ammeter", polarity: "red" },
  "ammeter-negative": { x: 29, y: 88, label: "Ampermetre siyah giriş", equipment: "ammeter", polarity: "black" },
  "voltmeter-positive": { x: 70, y: 88, label: "Voltmetre kırmızı giriş", equipment: "voltmeter", polarity: "red" },
  "voltmeter-negative": { x: 56, y: 88, label: "Voltmetre siyah giriş", equipment: "voltmeter", polarity: "black" },
  "resistor-a-left": { x: 30.2, y: 50.5, label: "A direnci kırmızı giriş", equipment: "resistor-a", polarity: "red" },
  "resistor-a-right": { x: 47.8, y: 50.5, label: "A direnci siyah giriş", equipment: "resistor-a", polarity: "black" },
  "resistor-b-left": { x: 52.2, y: 50.5, label: "B direnci kırmızı giriş", equipment: "resistor-b", polarity: "red" },
  "resistor-b-right": { x: 69.8, y: 50.5, label: "B direnci siyah giriş", equipment: "resistor-b", polarity: "black" },
  "switch-left": { x: 78, y: 49.5, label: "Anahtar kırmızı giriş", equipment: "switch", polarity: "red" },
  "switch-right": { x: 94.5, y: 49.5, label: "Anahtar siyah giriş", equipment: "switch", polarity: "black" },
};

const SERIES_STEPS: WiringStep[] = [
  { from: "source-positive", to: "ammeter-positive", title: "Kaynağı ampermetreye bağla", detail: "Kaynak (+) ucundan ampermetre (+) ucuna git." },
  { from: "ammeter-negative", to: "switch-left", title: "Ampermetreden anahtara geç", detail: "Ampermetre (−) ucunu anahtar girişine bağla." },
  { from: "switch-right", to: "resistor-a-left", title: "Anahtarı A direncine bağla", detail: "Anahtar çıkışından A direncinin sol ucuna git." },
  { from: "resistor-a-right", to: "resistor-b-left", title: "A ile B'yi art arda bağla", detail: "A direncinin sağ ucunu B direncinin sol ucuna bağla." },
  { from: "resistor-b-right", to: "source-negative", title: "Seri yolu tamamla", detail: "B direncinin sağ ucunu kaynak (−) ucuna bağla." },
  { from: "voltmeter-positive", to: "resistor-a-left", title: "Voltmetrenin artı ucunu bağla", detail: "Voltmetre (+) ucunu seri direnç grubunun girişine bağla." },
  { from: "voltmeter-negative", to: "resistor-b-right", title: "Voltmetrenin eksi ucunu bağla", detail: "Voltmetre (−) ucunu seri direnç grubunun çıkışına bağla." },
];

const PARALLEL_STEPS: WiringStep[] = [
  { from: "source-positive", to: "ammeter-positive", title: "Kaynağı ampermetreye bağla", detail: "Kaynak (+) ucundan ampermetre (+) ucuna git." },
  { from: "ammeter-negative", to: "switch-left", title: "Ampermetreden anahtara geç", detail: "Ampermetre (−) ucunu anahtar girişine bağla." },
  { from: "switch-right", to: "resistor-a-left", title: "A kolunun girişini bağla", detail: "Anahtar çıkışını A direncinin sol ucuna bağla." },
  { from: "switch-right", to: "resistor-b-left", title: "B kolunun girişini bağla", detail: "Aynı anahtar çıkışını B direncinin sol ucuna da bağla." },
  { from: "resistor-a-right", to: "source-negative", title: "A kolunun dönüşünü bağla", detail: "A direncinin sağ ucunu kaynak (−) ucuna bağla." },
  { from: "resistor-b-right", to: "source-negative", title: "B kolunun dönüşünü bağla", detail: "B direncinin sağ ucunu kaynak (−) ucuna bağla." },
  { from: "voltmeter-positive", to: "resistor-a-left", title: "Voltmetrenin artı ucunu bağla", detail: "Voltmetre (+) ucunu paralel kolların girişine bağla." },
  { from: "voltmeter-negative", to: "resistor-a-right", title: "Voltmetrenin eksi ucunu bağla", detail: "Voltmetre (−) ucunu paralel kolların çıkışına bağla." },
];

function connectionKey(first: TerminalId, second: TerminalId) {
  return [first, second].sort().join("--");
}

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
    const width = Math.max(rect.width, 760);
    const height = Math.max(rect.height, 540);
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
        Math.max(y1, y2) + 18,
        WIRE_ROUTE_LEVELS[index % WIRE_ROUTE_LEVELS.length] * height,
      );
      const wireColor = WIRE_COLORS[index % WIRE_COLORS.length];
      const traceCable = () => {
        context.beginPath();
        context.moveTo(x1, y1);
        context.bezierCurveTo(x1, bend, x2, bend, x2, y2);
      };

      traceCable();
      context.strokeStyle = "rgba(18, 25, 27, 0.27)";
      context.lineWidth = 7.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();

      traceCable();
      context.strokeStyle = wireColor;
      context.lineWidth = 4.6;
      context.stroke();

      traceCable();
      context.strokeStyle = "rgba(255, 255, 255, 0.34)";
      context.lineWidth = 0.85;
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

  return <canvas className="ohm-wire-canvas rcl-wire-canvas" ref={canvasRef} aria-hidden="true" />;
}

function Meter({ kind, value, active }: { kind: "ammeter" | "voltmeter"; value: number; active: boolean }) {
  const max = kind === "ammeter" ? 250 : 12;
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
        <i className="ohm-meter-needle" style={{ "--meter-needle": `${needle}deg` } as CSSProperties} />
        <b>{value.toFixed(kind === "ammeter" ? 1 : 2)}</b>
      </div>
      <small>{kind === "ammeter" ? "AMPERMETRE" : "VOLTMETRE"}</small>
    </div>
  );
}

function ResistorUnit({ label, value }: { label: "A" | "B"; value: number }) {
  return (
    <div className={`rcl-resistor-unit resistor-${label.toLowerCase()}`}>
      <img className="rcl-real-resistor" src="./resistor-module-real-v1.webp" alt={`Gerçekçi ${label} direnç modülü`} draggable={false} />
      <small>{label} DİRENCİ</small>
      <strong>R<sub>{label}</sub> = {value} Ω</strong>
    </div>
  );
}

function formatResistance(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

export default function ResistorConnectionsLab() {
  const [mode, setMode] = useState<CircuitMode>("series");
  const [installed, setInstalled] = useState<EquipmentKind[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalId | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [resistorA, setResistorA] = useState(100);
  const [resistorB, setResistorB] = useState(220);
  const [voltage, setVoltage] = useState(6);
  const [powerOn, setPowerOn] = useState(false);
  const [switchClosed, setSwitchClosed] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [prediction, setPrediction] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [notice, setNotice] = useState("Malzeme rafından güç kaynağını tezgâha sürükleyerek başla.");

  const wiringSteps = mode === "series" ? SERIES_STEPS : PARALLEL_STEPS;
  const requiredKeys = useMemo(
    () => new Set(wiringSteps.map(({ from, to }) => connectionKey(from, to))),
    [wiringSteps],
  );
  const allInstalled = installed.length === EQUIPMENT.length;
  const circuitComplete = connections.length === wiringSteps.length;
  const circuitActive = allInstalled && circuitComplete && powerOn && switchClosed;
  const equivalentResistance = mode === "series"
    ? resistorA + resistorB
    : (resistorA * resistorB) / (resistorA + resistorB);
  const totalCurrentMilliamp = circuitActive ? (voltage / equivalentResistance) * 1000 : 0;
  const currentA = circuitActive
    ? mode === "series" ? totalCurrentMilliamp : (voltage / resistorA) * 1000
    : 0;
  const currentB = circuitActive
    ? mode === "series" ? totalCurrentMilliamp : (voltage / resistorB) * 1000
    : 0;
  const voltageA = circuitActive ? mode === "series" ? voltage * resistorA / equivalentResistance : voltage : 0;
  const voltageB = circuitActive ? mode === "series" ? voltage * resistorB / equivalentResistance : voltage : 0;
  const nextWiringStep = wiringSteps.find(
    ({ from, to }) => !connections.some((connection) => connection.id === connectionKey(from, to)),
  ) ?? null;
  const nextWiringStepNumber = nextWiringStep ? wiringSteps.indexOf(nextWiringStep) + 1 : wiringSteps.length;
  const analysisReady = readings.some((reading) => reading.mode === "series")
    && readings.some((reading) => reading.mode === "parallel");

  const install = (kind: EquipmentKind) => {
    if (installed.includes(kind)) return;
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    const nextItem = EQUIPMENT.find((item) => !nextInstalled.includes(item.kind));
    setNotice(nextItem
      ? `${EQUIPMENT.find((item) => item.kind === kind)?.name} yerleştirildi. Sıradaki malzeme: ${nextItem.name}.`
      : `${mode === "series" ? "Seri" : "Paralel"} devre için bütün parçalar hazır. Kablo rehberini izle.`);
  };

  const onEquipmentDragStart = (event: ReactDragEvent<HTMLButtonElement>, kind: EquipmentKind) => {
    event.dataTransfer.setData(MIME, kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const kind = event.dataTransfer.getData(MIME) as EquipmentKind;
    if (EQUIPMENT.some((item) => item.kind === kind)) install(kind);
  };

  const selectMode = (nextMode: CircuitMode) => {
    if (powerOn) {
      setNotice("Bağlantı türünü değiştirmek için önce güç kaynağını kapat.");
      return;
    }
    setMode(nextMode);
    setConnections([]);
    setSelectedTerminal(null);
    setSwitchClosed(false);
    setShowAnalysis(false);
    setNotice(`${nextMode === "series" ? "Seri" : "Paralel"} bağlantı seçildi. Parçalar yerinde kaldı; kabloları yeni rehbere göre bağla.`);
  };

  const connectTerminal = (terminal: TerminalId) => {
    if (!installed.includes("cables")) {
      setNotice("Bağlantı yapabilmek için kablo takımını tezgâha yerleştir.");
      return;
    }
    if (!installed.includes(TERMINALS[terminal].equipment)) return;
    if (!selectedTerminal) {
      setSelectedTerminal(terminal);
      setNotice(`${TERMINALS[terminal].label} seçildi. Şimdi bağlanacağı ikinci uca dokun.`);
      return;
    }
    if (selectedTerminal === terminal) {
      setSelectedTerminal(null);
      setNotice("Uç seçimi iptal edildi.");
      return;
    }
    const key = connectionKey(selectedTerminal, terminal);
    setSelectedTerminal(null);
    if (!requiredKeys.has(key)) {
      setNotice(`Bu iki uç ${mode === "series" ? "seri" : "paralel"} devrenin sıradaki bağlantısını oluşturmuyor. Rehberdeki uçları kullan.`);
      return;
    }
    if (connections.some((connection) => connection.id === key)) {
      setNotice("Bu kablo zaten bağlı.");
      return;
    }
    const nextConnections = [...connections, { id: key, from: selectedTerminal, to: terminal }];
    setConnections(nextConnections);
    setNotice(nextConnections.length === wiringSteps.length
      ? "Devre tamamlandı. Güç kaynağını aç, ardından devre anahtarını kapat."
      : `Kablo bağlandı. ${wiringSteps.length - nextConnections.length} bağlantı kaldı.`);
  };

  const connectGuidedCable = () => {
    if (!allInstalled) {
      setNotice("Önce bütün devre elemanlarını tezgâha yerleştir.");
      return;
    }
    if (!nextWiringStep) return;
    const key = connectionKey(nextWiringStep.from, nextWiringStep.to);
    const nextConnections = [...connections, { id: key, from: nextWiringStep.from, to: nextWiringStep.to }];
    setConnections(nextConnections);
    setSelectedTerminal(null);
    setNotice(nextConnections.length === wiringSteps.length
      ? "Bütün kablolar bağlı. Güç kaynağını ve devre anahtarını açabilirsin."
      : "Gösterilen kablo bağlandı. Rehberdeki sıradaki bağlantıya geç.");
  };

  const removeConnection = (id: string) => {
    if (powerOn) {
      setNotice("Kabloyu çıkarmak için önce güç kaynağını kapat.");
      return;
    }
    setConnections((current) => current.filter((connection) => connection.id !== id));
    setSwitchClosed(false);
    setNotice("Seçilen kablo çıkarıldı.");
  };

  const togglePower = () => {
    if (!circuitComplete) {
      setNotice(`Güç vermeden önce ${wiringSteps.length} doğru kablo bağlantısını tamamla.`);
      return;
    }
    setPowerOn((current) => !current);
    if (powerOn) {
      setSwitchClosed(false);
      setNotice("Güç kaynağı kapatıldı. Direnç değerleri değiştirilebilir.");
    } else {
      setNotice("Güç kaynağı açık. Ölçüm için devre anahtarını kapat.");
    }
  };

  const toggleSwitch = () => {
    if (!powerOn) {
      setNotice("Önce güç kaynağını aç.");
      return;
    }
    setSwitchClosed((current) => !current);
    setNotice(switchClosed ? "Devre anahtarı açıldı; akım sıfırlandı." : "Devre anahtarı kapandı; cihazlar ideal değerleri gösteriyor.");
  };

  const recordMeasurement = () => {
    if (!circuitActive) {
      setNotice("Ölçüm için güç kaynağı ve devre anahtarı açık olmalı.");
      return;
    }
    const reading: Reading = {
      id: `${mode}-${resistorA}-${resistorB}-${voltage}`,
      mode,
      resistorA,
      resistorB,
      voltage,
      equivalentResistance,
      totalCurrentMilliamp,
      currentA,
      currentB,
      voltageA,
      voltageB,
    };
    setReadings((current) => [...current.filter((item) => item.id !== reading.id), reading]);
    setNotice(`${mode === "series" ? "Seri" : "Paralel"} devre ölçümü tabloya kaydedildi.`);
  };

  const resetExperiment = () => {
    setMode("series");
    setInstalled([]);
    setDragOver(false);
    setSelectedTerminal(null);
    setConnections([]);
    setResistorA(100);
    setResistorB(220);
    setVoltage(6);
    setPowerOn(false);
    setSwitchClosed(false);
    setReadings([]);
    setPrediction("");
    setShowAnalysis(false);
    setNotice("Malzeme rafından güç kaynağını tezgâha sürükleyerek başla.");
  };

  return (
    <section className="ohm-lab-section rcl-lab" id="direnc-baglantilari-deneyi">
      <div className="ohm-heading rcl-heading">
        <div>
          <span>ELEKTRİK · DENEY 2 · FİZ.10.3.4</span>
          <h1>Elemanları yerleştir, seri ve paralel devreyi kendin kur.</h1>
          <p>Güç kaynağı, ölçüm cihazları, iki direnç, anahtar ve kablolarla gerçek laboratuvar akışını izle; ardından direnç değerlerini değiştirerek ideal ölçümlerini karşılaştır.</p>
        </div>
        <aside><b>İDEAL ÖLÇÜM</b><span>2 değişken direnç</span><small>Seri ve paralel devre kurulumu</small></aside>
      </div>

      <div className="ohm-inquiry-strip">
        <div><span>ÖNCE TAHMİN ET</span><b>Aynı iki direnç seri ve paralel bağlandığında hangi devreden daha büyük akım geçer?</b></div>
        <label><span className="sr-only">Deney öncesi tahmin</span><input value={prediction} onChange={(event) => setPrediction(event.target.value)} placeholder="Kısa tahminini yaz…" /></label>
      </div>

      <section className="rcl-mode-selector" aria-label="Bağlantı türü seçimi">
        <div><span>1 · BAĞLANTI TÜRÜ</span><h2>Önce kuracağın devreyi seç.</h2><p>Tür değiştiğinde parçalar tezgâhta kalır, yalnız kablolar yeniden bağlanır.</p></div>
        <div className="rcl-mode-buttons">
          <button type="button" className={mode === "series" ? "active" : ""} onClick={() => selectMode("series")} aria-pressed={mode === "series"}>
            <i className="series"><img src="./resistor-module-real-v1.webp" alt="" draggable={false} /><img src="./resistor-module-real-v1.webp" alt="" draggable={false} /></i><span><small>SERİ</small><strong>A — B</strong><em>Tek akım yolu</em></span>
          </button>
          <button type="button" className={mode === "parallel" ? "active" : ""} onClick={() => selectMode("parallel")} aria-pressed={mode === "parallel"}>
            <i className="parallel"><img src="./resistor-module-real-v1.webp" alt="" draggable={false} /><img src="./resistor-module-real-v1.webp" alt="" draggable={false} /></i><span><small>PARALEL</small><strong>A ∥ B</strong><em>İki akım kolu</em></span>
          </button>
        </div>
      </section>

      <div className="ohm-builder rcl-builder">
        <aside className="ohm-equipment-panel">
          <div className="ohm-panel-heading"><span>MALZEME RAFI</span><b>Tut, sürükle ve tezgâha bırak</b></div>
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
                <span><b>{item.name}</b><small>{installed.includes(item.kind) ? "Tezgâhta" : item.detail}</small></span>
              </button>
            ))}
          </div>
          <button className="ohm-reset-button" type="button" onClick={resetExperiment}>Deneyi baştan kur</button>
        </aside>

        <div
          className={`ohm-stage rcl-stage ${dragOver ? "drag-over" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onStageDrop}
        >
          <div className="ohm-stage-toolbar">
            <span><small>DÜZENEK DURUMU</small><b>{circuitComplete ? `${mode === "series" ? "Seri" : "Paralel"} devre ölçüme hazır` : "Kurulum sürüyor"}</b></span>
            <span className={circuitComplete ? "ready" : ""}>{installed.length}/{EQUIPMENT.length} araç · {connections.length}/{wiringSteps.length} kablo</span>
          </div>

          <div className="ohm-notice" role="status"><i>{circuitComplete ? "✓" : installed.length + 1}</i><span>{notice}</span></div>

          <section className={`ohm-wiring-guide ${circuitComplete ? "complete" : ""}`}>
            <div className="ohm-wiring-guide-heading">
              <span><small>KABLO BAĞLANTI REHBERİ · {mode === "series" ? "SERİ" : "PARALEL"}</small><b>{!allInstalled ? "Önce malzemeleri tamamla" : circuitComplete ? "Bütün bağlantılar tamamlandı" : `${nextWiringStepNumber}. kablo / ${wiringSteps.length}`}</b></span>
              <strong>{circuitComplete ? "✓" : `${connections.length}/${wiringSteps.length}`}</strong>
            </div>
            {nextWiringStep ? (
              <>
                <div className="ohm-guide-copy">
                  <span><i>1</i><small>ÖNCE BU UÇ</small><b>{TERMINALS[nextWiringStep.from].label}</b></span>
                  <em>→</em>
                  <span><i>2</i><small>SONRA BU UÇ</small><b>{TERMINALS[nextWiringStep.to].label}</b></span>
                </div>
                <div className="ohm-guide-action"><span><b>{nextWiringStep.title}</b><small>{nextWiringStep.detail}</small></span><button type="button" onClick={connectGuidedCable} disabled={!allInstalled}>Gösterilen kabloyu bağla</button></div>
              </>
            ) : (
              <div className="ohm-guide-complete"><i>✓</i><span><b>{mode === "series" ? "Dirençler art arda bağlandı." : "Dirençlerin giriş ve çıkışları ortak düğümlerde birleşti."}</b><small>Güç kaynağını açıp ölçüme geçebilirsin.</small></span></div>
            )}
          </section>

          <div className="ohm-apparatus rcl-apparatus">
            <img
              className="ohm-real-bench-photo"
              src="./ohm-lab-bench-real-v2.webp"
              alt="Seri ve paralel direnç devrelerinin kurulduğu gerçekçi okul laboratuvarı tezgâhı"
              draggable={false}
            />
            <div className={`rcl-stage-mode-badge ${mode}`}>
              <small>SEÇİLİ DEVRE</small>
              <b>{mode === "series" ? "SERİ BAĞLANTI" : "PARALEL BAĞLANTI"}</b>
              <span>{mode === "series" ? "Tek akım yolu" : "İki akım kolu"}</span>
            </div>
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
                <img className="ohm-real-power-photo" src="./ohm-power-supply-real-v2.webp" alt="Gerçekçi alçak gerilim doğru akım güç kaynağı" draggable={false} />
                <strong>DC GÜÇ KAYNAĞI</strong>
                <div className="ohm-source-display"><b>{powerOn ? voltage.toFixed(1) : "0.0"}</b><em>V</em></div>
                <button type="button" onClick={togglePower} aria-label={powerOn ? "Güç kaynağını kapat" : "Güç kaynağını aç"}><i /><span>{powerOn ? "GÜÇ AÇIK" : "GÜÇ"}</span></button>
              </div>
            )}
            {installed.includes("resistor-a") && <ResistorUnit label="A" value={resistorA} />}
            {installed.includes("resistor-b") && <ResistorUnit label="B" value={resistorB} />}
            {installed.includes("ammeter") && <Meter kind="ammeter" value={totalCurrentMilliamp} active={circuitActive} />}
            {installed.includes("voltmeter") && <Meter kind="voltmeter" value={circuitActive ? voltage : 0} active={circuitActive} />}
            {installed.includes("switch") && (
              <button type="button" className={`ohm-circuit-switch ${switchClosed ? "closed" : ""}`} onClick={toggleSwitch} aria-label={switchClosed ? "Devre anahtarını aç" : "Devre anahtarını kapat"}>
                <img className="ohm-real-switch-photo" src="./ohm-knife-switch-real-v2.webp" alt="Gerçekçi laboratuvar devre anahtarı" draggable={false} />
                <span><i /></span><b>{switchClosed ? "KAPALI DEVRE" : "AÇIK DEVRE"}</b>
              </button>
            )}

            {(Object.keys(TERMINALS) as TerminalId[]).map((terminal) => {
              const item = TERMINALS[terminal];
              if (!installed.includes(item.equipment)) return null;
              const isGuideStart = nextWiringStep?.from === terminal;
              const isGuideEnd = nextWiringStep?.to === terminal;
              const connected = connections.some((connection) => connection.from === terminal || connection.to === terminal);
              return (
                <button
                  type="button"
                  className={`ohm-terminal ${item.polarity} ${selectedTerminal === terminal ? "selected" : ""} ${connected ? "connected" : ""} ${isGuideStart ? "guide-start" : ""} ${isGuideEnd ? "guide-end" : ""}`}
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  onClick={() => connectTerminal(terminal)}
                  aria-label={`${isGuideStart ? "Önce " : isGuideEnd ? "Sonra " : ""}${item.label}${connected ? ", bağlı" : ", bağlantı bekliyor"}`}
                  key={terminal}
                ><i /><span>{isGuideStart ? "1 · ÖNCE: " : isGuideEnd ? "2 · SONRA: " : ""}{item.label}</span></button>
              );
            })}

            {!installed.length && <div className="ohm-empty-stage"><i>＋</i><b>Devre elemanlarını bu tezgâha yerleştir</b><span>Parçalar geldikçe gerçek bağlantı uçları açılır.</span></div>}
          </div>

          {connections.length > 0 && (
            <div className="ohm-connection-list"><span>Bağlantılar</span>{connections.map((connection, index) => <button type="button" onClick={() => removeConnection(connection.id)} key={connection.id}><i style={{ background: WIRE_COLORS[index % WIRE_COLORS.length] }} />{TERMINALS[connection.from].label} → {TERMINALS[connection.to].label}<b>×</b></button>)}</div>
          )}
        </div>
      </div>

      <section className="ohm-controls rcl-controls">
        <div className="ohm-control-heading">
          <div><span>2 · DİRENÇ DEĞERLERİNİ DEĞİŞTİR</span><h2>Devreyi kurduktan sonra farklı değerleri ölç.</h2></div>
          <span className={circuitActive ? "active" : ""}><i />{circuitActive ? "Devreden akım geçiyor" : "Devre enerjisiz"}</span>
        </div>
        <div className="rcl-control-grid">
          <article>
            <small>A DİRENCİ</small>
            <label><span>R<sub>A</sub></span><select value={resistorA} disabled={!circuitComplete || powerOn} onChange={(event) => { setResistorA(Number(event.target.value)); setNotice(`A direnci ${event.target.value} Ω olarak ayarlandı.`); }}>{RESISTANCE_OPTIONS.map((value) => <option value={value} key={value}>{value} Ω</option>)}</select></label>
            <i className="rcl-mini-resistor"><b /><b /><b /></i>
          </article>
          <article>
            <small>B DİRENCİ</small>
            <label><span>R<sub>B</sub></span><select value={resistorB} disabled={!circuitComplete || powerOn} onChange={(event) => { setResistorB(Number(event.target.value)); setNotice(`B direnci ${event.target.value} Ω olarak ayarlandı.`); }}>{RESISTANCE_OPTIONS.map((value) => <option value={value} key={value}>{value} Ω</option>)}</select></label>
            <i className="rcl-mini-resistor"><b /><b /><b /></i>
          </article>
          <article className="rcl-voltage-control">
            <small>KAYNAK GERİLİMİ</small>
            <label><span><b>{voltage} V</b><em>3-12 V</em></span><input type="range" min="3" max="12" step="3" value={voltage} disabled={!installed.includes("power-supply") || powerOn} onChange={(event) => setVoltage(Number(event.target.value))} /></label>
            <div><span>3</span><span>6</span><span>9</span><span>12</span></div>
          </article>
          <article className="rcl-live-readings">
            <small>CANLI İDEAL DEĞERLER</small>
            <div>
              <span><small>R eş</small><b>{formatResistance(equivalentResistance)} Ω</b></span>
              <span><small>I toplam</small><b>{totalCurrentMilliamp.toFixed(1)} mA</b></span>
              <span><small>I A / I B</small><b>{currentA.toFixed(1)} / {currentB.toFixed(1)} mA</b></span>
              <span><small>V A / V B</small><b>{voltageA.toFixed(2)} / {voltageB.toFixed(2)} V</b></span>
            </div>
            <button type="button" disabled={!circuitActive} onClick={recordMeasurement}>Ölç ve tabloya kaydet</button>
          </article>
        </div>
        {powerOn && <p className="rcl-control-note">Direnç veya gerilim değerini değiştirmek için önce güç kaynağını kapat.</p>}
      </section>

      <section className="ohm-evidence rcl-evidence">
        <div className="ohm-evidence-heading"><div><span>3 · ÖLÇÜM SONUÇLARI</span><h2>Seri ve paralel devreleri aynı tabloda karşılaştır.</h2></div><b>{readings.length}<small>kayıt</small></b></div>
        <article className="ohm-data-card rcl-data-card">
          <div className="ohm-card-heading"><b>İdeal ölçüm tablosu</b><span>Değerler doğrudan devreden hesaplanır</span></div>
          <div className="ohm-table-wrap"><table><thead><tr><th>Bağlantı</th><th>R A</th><th>R B</th><th>Gerilim</th><th>R eş</th><th>I toplam</th><th>I A</th><th>I B</th><th>V A</th><th>V B</th></tr></thead><tbody>
            {readings.length ? readings.map((reading) => <tr key={reading.id}><th>{reading.mode === "series" ? "Seri" : "Paralel"}</th><td>{reading.resistorA} Ω</td><td>{reading.resistorB} Ω</td><td>{reading.voltage} V</td><td>{formatResistance(reading.equivalentResistance)} Ω</td><td>{reading.totalCurrentMilliamp.toFixed(1)} mA</td><td>{reading.currentA.toFixed(1)} mA</td><td>{reading.currentB.toFixed(1)} mA</td><td>{reading.voltageA.toFixed(2)} V</td><td>{reading.voltageB.toFixed(2)} V</td></tr>) : <tr><td colSpan={10}>Devreyi kurup ilk ölçümü kaydettiğinde tablo oluşur.</td></tr>}
          </tbody></table></div>
        </article>
      </section>

      <section className="ohm-analysis-prompt">
        <div><span>4 · ÖRÜNTÜYÜ AÇIKLA</span><h2>Bağlantı türü ve direnç değerlerinin etkisini incele.</h2><p>{analysisReady ? "Seri ve paralel devreden birer ölçümün hazır." : "Analiz için bir seri ve bir paralel ölçüm kaydet."}</p></div>
        <button type="button" disabled={!analysisReady} onClick={() => setShowAnalysis((current) => !current)}>{showAnalysis ? "Analizi kapat" : "Karşılaştırmayı göster"} →</button>
      </section>

      {showAnalysis && analysisReady && <section className="ohm-analysis rcl-analysis"><div className="ohm-analysis-grid">
        <article><span>1</span><b>Seri bağlantı</b><p>Eşdeğer direnç iki direncin toplamıdır; iki dirençten aynı akım geçer.</p></article>
        <article><span>2</span><b>Paralel bağlantı</b><p>Eşdeğer direnç her iki dirençten de küçüktür; toplam akım kollara ayrılır.</p></article>
        <article><span>3</span><b>Direnç değişimi</b><p>Kaynak gerilimi sabitken eşdeğer direnç büyüdüğünde toplam akım azalır.</p></article>
      </div></section>}

      <section className="ohm-report">
        <div className="ohm-report-heading"><span>TYMM · KISA DENEY RAPORU</span><h2>Kurduğun devreleri ölçümlerinle açıkla.</h2><p>Yanıtlarında tablodan en az iki değer kullan.</p></div>
        <div className="ohm-report-grid">
          <label><span>1 · DEVRE KURULUMU</span>Seri ve paralel devrede direnç uçlarını nasıl bağladın?<textarea rows={4} /></label>
          <label><span>2 · DİRENÇ VE AKIM</span>Direnç değerlerini değiştirdiğinde toplam akım nasıl değişti?<textarea rows={4} /></label>
          <label><span>3 · KOL DEĞERLERİ</span>Seri ve paralel devrede I A, I B, V A ve V B değerlerini karşılaştır.<textarea rows={4} /></label>
          <label><span>4 · KANIT</span>Hangi ölçümlerin bağlantı türünü ayırt etmeni sağladı?<textarea rows={4} /></label>
        </div>
        <label className="ohm-report-conclusion"><span>SONUÇ</span>Bağlantı türü ile direnç değerlerinin eşdeğer direnç ve akıma etkisini açıkla.<textarea rows={5} /></label>
      </section>
    </section>
  );
}
