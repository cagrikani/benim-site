"use client";

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type EquipmentKind =
  | "rail"
  | "power-supply"
  | "main-coil"
  | "probe-coil"
  | "multimeter"
  | "cables"
  | "second-coil";

type Direction = "same" | "opposite";

type Measurement = {
  id: string;
  position: number;
  voltage: number;
  current: number;
  field: number;
  setup: string;
};

const MIME = "application/x-magnetic-field-equipment";
const DOMAIN_MIN = -15;
const DOMAIN_MAX = 15;
const MAIN_CENTER = -4.5;

const EQUIPMENT: Array<{
  kind: EquipmentKind;
  name: string;
  detail: string;
}> = [
  { kind: "rail", name: "Cetvelli deney rayı", detail: "Bobinleri aynı eksende tutar" },
  { kind: "power-supply", name: "Alternatif akım kaynağı", detail: "2–10 V arasında ayarlanır" },
  { kind: "main-coil", name: "600 sarımlı ana bobin", detail: "Akım geçtiğinde manyetik alan oluşturur" },
  { kind: "probe-coil", name: "Yoklama kangalı", detail: "Eksen boyunca alanı tarar" },
  { kind: "multimeter", name: "AC multimetre", detail: "İndüklenen gerilimi gösterir" },
  { kind: "cables", name: "Bağlantı kabloları", detail: "Kaynak, bobin ve ölçeri bağlar" },
  { kind: "second-coil", name: "İkinci 600 sarımlı bobin", detail: "Alanların birleşmesini karşılaştırır" },
];

const CORE_SETUP = EQUIPMENT.slice(0, 6).map(({ kind }) => kind);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tidy(value: number, digits = 3) {
  const rounded = Number(value.toFixed(digits));
  return Math.abs(rounded) < 10 ** -digits ? 0 : rounded;
}

function coilProfile(position: number, center: number) {
  const radius = 2.1;
  const halfLength = 4.5;
  const z = position - center;
  const right = (z + halfLength) / Math.sqrt(radius ** 2 + (z + halfLength) ** 2);
  const left = (z - halfLength) / Math.sqrt(radius ** 2 + (z - halfLength) ** 2);
  return (right - left) / 2;
}

function fieldAt(
  position: number,
  current: number,
  secondCoil: boolean,
  gap: number,
  direction: Direction,
) {
  const scale = 1.25;
  const first = coilProfile(position, MAIN_CENTER);
  if (!secondCoil) return tidy(scale * current * first, 4);
  const secondCenter = MAIN_CENTER + 9 + gap;
  const sign = direction === "same" ? 1 : -1;
  return tidy(scale * current * (first + sign * coilProfile(position, secondCenter)), 4);
}

function ApparatusIcon({ kind }: { kind: EquipmentKind }) {
  return (
    <span className={`mfl-equipment-icon icon-${kind}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function FieldGraph({
  current,
  secondCoil,
  gap,
  direction,
  probePosition,
}: {
  current: number;
  secondCoil: boolean;
  gap: number;
  direction: Direction;
  probePosition: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 360);
    const height = Math.max(rect.height, 230);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);

    const pad = { left: 48, right: 18, top: 20, bottom: 34 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const points = Array.from({ length: 121 }, (_, index) => {
      const x = DOMAIN_MIN + index * 0.25;
      return { x, y: fieldAt(x, current, secondCoil, gap, direction) };
    });
    const maxMagnitude = Math.max(1, ...points.map(({ y }) => Math.abs(y))) * 1.18;
    const toX = (x: number) => pad.left + ((x - DOMAIN_MIN) / (DOMAIN_MAX - DOMAIN_MIN)) * plotWidth;
    const toY = (y: number) => pad.top + plotHeight / 2 - (y / maxMagnitude) * (plotHeight / 2);

    context.strokeStyle = "rgba(42, 82, 91, 0.13)";
    context.lineWidth = 1;
    for (let x = -15; x <= 15; x += 5) {
      context.beginPath();
      context.moveTo(toX(x), pad.top);
      context.lineTo(toX(x), pad.top + plotHeight);
      context.stroke();
    }
    for (let row = -2; row <= 2; row += 1) {
      const y = pad.top + (row + 2) * (plotHeight / 4);
      context.beginPath();
      context.moveTo(pad.left, y);
      context.lineTo(width - pad.right, y);
      context.stroke();
    }

    context.strokeStyle = "#365f67";
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(pad.left, toY(0));
    context.lineTo(width - pad.right, toY(0));
    context.stroke();

    context.beginPath();
    context.moveTo(toX(points[0].x), toY(0));
    points.forEach(({ x, y }) => context.lineTo(toX(x), toY(y)));
    context.lineTo(toX(points.at(-1)?.x ?? DOMAIN_MAX), toY(0));
    context.closePath();
    context.fillStyle = "rgba(19, 135, 125, 0.14)";
    context.fill();

    context.beginPath();
    points.forEach(({ x, y }, index) => {
      const px = toX(x);
      const py = toY(y);
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.strokeStyle = "#13877d";
    context.lineWidth = 3;
    context.lineJoin = "round";
    context.stroke();

    const probeField = fieldAt(probePosition, current, secondCoil, gap, direction);
    context.setLineDash([4, 4]);
    context.strokeStyle = "#dd6f37";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(toX(probePosition), pad.top);
    context.lineTo(toX(probePosition), pad.top + plotHeight);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#dd6f37";
    context.beginPath();
    context.arc(toX(probePosition), toY(probeField), 5, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#58747b";
    context.font = "700 11px system-ui";
    context.textAlign = "center";
    [-15, -10, -5, 0, 5, 10, 15].forEach((x) => context.fillText(String(x), toX(x), height - 12));
    context.textAlign = "left";
    context.fillText("Konum (cm)", width - 84, height - 12);
    context.save();
    context.translate(15, height / 2 + 28);
    context.rotate(-Math.PI / 2);
    context.fillText("Manyetik alan (mT)", 0, 0);
    context.restore();
  }, [current, direction, gap, probePosition, secondCoil]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return <canvas ref={canvasRef} className="mfl-graph-canvas" aria-label="Konuma göre manyetik alan grafiği" />;
}

function CurrentGraph({ indicatorAtOneAmp }: { indicatorAtOneAmp: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = Math.max(rect.height, 230);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const pad = { left: 44, right: 20, top: 22, bottom: 38 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const maxY = Math.max(0.2, indicatorAtOneAmp * 2.2);
    const toX = (x: number) => pad.left + (x / 2) * plotWidth;
    const toY = (y: number) => pad.top + plotHeight - (y / maxY) * plotHeight;

    context.strokeStyle = "rgba(42, 82, 91, 0.14)";
    context.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const x = pad.left + (plotWidth / 4) * i;
      const y = pad.top + (plotHeight / 4) * i;
      context.beginPath();
      context.moveTo(x, pad.top);
      context.lineTo(x, pad.top + plotHeight);
      context.stroke();
      context.beginPath();
      context.moveTo(pad.left, y);
      context.lineTo(width - pad.right, y);
      context.stroke();
    }
    context.strokeStyle = "#365f67";
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(pad.left, pad.top);
    context.lineTo(pad.left, pad.top + plotHeight);
    context.lineTo(width - pad.right, pad.top + plotHeight);
    context.stroke();

    context.beginPath();
    context.moveTo(toX(0), toY(0));
    context.lineTo(toX(2), toY(indicatorAtOneAmp * 2));
    context.strokeStyle = "#dd6f37";
    context.lineWidth = 3;
    context.stroke();
    [0.4, 0.8, 1.2, 1.6, 2].forEach((value) => {
      context.fillStyle = "#13877d";
      context.beginPath();
      context.arc(toX(value), toY(indicatorAtOneAmp * value), 4, 0, Math.PI * 2);
      context.fill();
    });

    context.fillStyle = "#58747b";
    context.font = "700 11px system-ui";
    context.textAlign = "center";
    [0, 0.5, 1, 1.5, 2].forEach((value) => context.fillText(String(value), toX(value), height - 16));
    context.fillText("Akım (A)", width - 54, height - 16);
    context.save();
    context.translate(14, height / 2 + 34);
    context.rotate(-Math.PI / 2);
    context.fillText("Gösterge gerilimi (V)", 0, 0);
    context.restore();
  }, [indicatorAtOneAmp]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return <canvas ref={canvasRef} className="mfl-graph-canvas" aria-label="Akıma göre yoklama kangalı gerilimi grafiği" />;
}

export default function MagneticFieldLab() {
  const [placed, setPlaced] = useState<EquipmentKind[]>([]);
  const [supplyVoltage, setSupplyVoltage] = useState(6);
  const [probePosition, setProbePosition] = useState(-4.5);
  const [secondGap, setSecondGap] = useState(0);
  const [direction, setDirection] = useState<Direction>("same");
  const [powerOn, setPowerOn] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [report, setReport] = useState({ position: "", current: "", coils: "", conclusion: "" });
  const stageRef = useRef<HTMLDivElement>(null);
  const dragMode = useRef<"probe" | "coil" | null>(null);

  const nextEquipment = EQUIPMENT[placed.length]?.kind;
  const coreReady = CORE_SETUP.every((item) => placed.includes(item));
  const secondCoil = placed.includes("second-coil");
  const current = powerOn && coreReady ? supplyVoltage / 5 : 0;
  const field = fieldAt(probePosition, current, secondCoil, secondGap, direction);
  const inducedVoltage = tidy(Math.abs(field) * 0.36, 3);
  const probePercent = 22 + ((probePosition - DOMAIN_MIN) / (DOMAIN_MAX - DOMAIN_MIN)) * 58;
  const secondPercent = 50.5 + secondGap * 1.55;
  const setupLabel = secondCoil
    ? `${secondGap} cm · ${direction === "same" ? "aynı yön" : "zıt yön"}`
    : "Tek bobin";

  const unitField = fieldAt(probePosition, 1, secondCoil, secondGap, direction);
  const indicatorAtOneAmp = tidy(Math.abs(unitField) * 0.36, 4);

  const placeEquipment = (kind: EquipmentKind) => {
    if (placed.includes(kind) || kind !== nextEquipment) return;
    setPlaced((currentItems) => [...currentItems, kind]);
  };

  const onEquipmentDragStart = (event: ReactDragEvent<HTMLButtonElement>, kind: EquipmentKind) => {
    event.dataTransfer.setData(MIME, kind);
    event.dataTransfer.effectAllowed = "move";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData(MIME) as EquipmentKind;
    placeEquipment(kind);
  };

  const positionFromPointer = useCallback((clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (dragMode.current === "coil") {
      const stagePercent = clamp(((clientX - rect.left) / rect.width) * 100, 50.5, 59.8);
      setSecondGap(clamp(Math.round((stagePercent - 50.5) / 1.55), 0, 6));
      return;
    }
    const trackRatio = clamp((clientX - rect.left - rect.width * 0.22) / (rect.width * 0.58), 0, 1);
    const position = DOMAIN_MIN + trackRatio * (DOMAIN_MAX - DOMAIN_MIN);
    if (dragMode.current === "probe") {
      setProbePosition(Math.round(position * 2) / 2);
    }
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => positionFromPointer(event.clientX);
    const end = () => { dragMode.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }, [positionFromPointer]);

  const beginDrag = (event: ReactPointerEvent, mode: "probe" | "coil") => {
    event.preventDefault();
    dragMode.current = mode;
    positionFromPointer(event.clientX);
  };

  const recordMeasurement = () => {
    if (!coreReady || !powerOn) return;
    const key = `${probePosition}-${supplyVoltage}-${setupLabel}`;
    const next: Measurement = {
      id: key,
      position: probePosition,
      voltage: inducedVoltage,
      current,
      field: Math.abs(field),
      setup: setupLabel,
    };
    setMeasurements((rows) => [...rows.filter(({ id }) => id !== key), next].slice(-12));
  };

  const resetLab = () => {
    setPlaced([]);
    setSupplyVoltage(6);
    setProbePosition(-4.5);
    setSecondGap(0);
    setDirection("same");
    setPowerOn(false);
    setMeasurements([]);
  };

  return (
    <section className="magnetic-field-lab" aria-labelledby="magnetic-field-title">
      <div className="mfl-heading">
        <div>
          <span>ELEKTRİK DENEY SETİ · DENEY 03</span>
          <h1 id="magnetic-field-title">Bobinin manyetik alanını görünür kıl.</h1>
          <p>
            Düzeneği sırayla kur; yoklama kangalını bobinin ekseninde elle hareket ettir.
            Konumun, akımın ve iki bobinin yönünün alan göstergesine etkisini ideal ölçümlerle incele.
          </p>
        </div>
        <aside>
          <small>TYMM · ARAŞTIRMA-SORGULAMA</small>
          <b>Değişkeni belirle</b>
          <span>Ölç · karşılaştır · kanıta dayalı yorumla</span>
        </aside>
      </div>

      <div className="mfl-inquiry-strip">
        <div><small>ARAŞTIRMA SORUSU</small><b>Alan bobinin ekseni boyunca nasıl değişir?</b></div>
        <div><small>DEĞİŞTİREBİLİRSİN</small><b>Konum · akım · bobin aralığı · yön</b></div>
        <div><small>ÖLÇECEKSİN</small><b>İndüklenen AC gerilim ve alan göstergesi</b></div>
      </div>

      <div className="mfl-builder">
        <aside className="mfl-equipment-panel">
          <div className="mfl-section-heading">
            <span>1 · DÜZENEĞİ KUR</span>
            <h2>Malzeme tepsisi</h2>
            <p>Sıradaki parçayı sürükleyip laboratuvar masasına bırak. Dokunarak da ekleyebilirsin.</p>
          </div>
          <div className="mfl-equipment-list">
            {EQUIPMENT.map((item, index) => {
              const isPlaced = placed.includes(item.kind);
              const isNext = item.kind === nextEquipment;
              return (
                <button
                  type="button"
                  key={item.kind}
                  className={`${isPlaced ? "placed" : ""} ${isNext ? "next" : ""}`}
                  draggable={!isPlaced && isNext}
                  disabled={!isPlaced && !isNext}
                  onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                  onClick={() => placeEquipment(item.kind)}
                >
                  <ApparatusIcon kind={item.kind} />
                  <span><small>{String(index + 1).padStart(2, "0")}</small><b>{item.name}</b><em>{isPlaced ? "Tezgâhta" : item.detail}</em></span>
                  <strong>{isPlaced ? "✓" : isNext ? "Tut" : "Kilitli"}</strong>
                </button>
              );
            })}
          </div>
          <button type="button" className="mfl-reset" onClick={resetLab}>Düzeneği sıfırla</button>
        </aside>

        <div className="mfl-stage-column">
          <div className="mfl-stage-toolbar">
            <div><small>2 · AYNI DÜZENEKTE ÖLÇ</small><b>{coreReady ? "Düzenek hazır" : `Sıradaki: ${EQUIPMENT[placed.length]?.name ?? "Tamamlandı"}`}</b></div>
            <span className={powerOn ? "live" : ""}><i /> {powerOn ? "AC alan etkin" : "Güç kapalı"}</span>
          </div>
          <div
            ref={stageRef}
            className={`mfl-stage ${coreReady ? "ready" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onStageDrop}
          >
            <div className="mfl-lab-wall"><span>FİZİK ATÖLYESİ · MANYETİK ALAN MASASI</span></div>
            <div className="mfl-bench-back" />
            {placed.includes("power-supply") && (
              <div className="mfl-power-supply">
                <span>AC GÜÇ KAYNAĞI</span>
                <b>{powerOn ? supplyVoltage.toFixed(1) : "0.0"}<small> V~</small></b>
                <i className="mfl-source-switch" />
                <i className="mfl-source-knob" />
                <i className="mfl-source-port red" />
                <i className="mfl-source-port black" />
                <em className="mfl-device-tag">AC ÇIKIŞ</em>
              </div>
            )}
            {placed.includes("rail") && (
              <div className="mfl-rail">
                <div className="mfl-rail-scale">{[-15, -10, -5, 0, 5, 10, 15].map((value) => <span key={value}>{value}</span>)}</div>
                <i className="mfl-rail-channel first" />
                <i className="mfl-rail-channel second" />
                <i className="mfl-rail-foot left" />
                <i className="mfl-rail-foot right" />
              </div>
            )}
            {placed.includes("main-coil") && (
              <div className="mfl-solenoid main">
                <span className="mfl-coil-end left" />
                <span className="mfl-coil-winding" />
                <span className="mfl-coil-bore" />
                <span className="mfl-coil-end right" />
                <span className="mfl-coil-pole left">S</span>
                <span className="mfl-coil-pole right">N</span>
                <span className="mfl-coil-terminal red" />
                <span className="mfl-coil-terminal black" />
                <small>ANA BOBİN · 600 SARIM</small>
              </div>
            )}
            {secondCoil && (
              <button
                type="button"
                className={`mfl-solenoid second ${direction}`}
                style={{ "--coil-left": `${secondPercent}%` } as CSSProperties}
                onPointerDown={(event) => beginDrag(event, "coil")}
                aria-label="İkinci bobini ray üzerinde sürükle"
              >
                <span className="mfl-coil-end left" />
                <span className="mfl-coil-winding" />
                <span className="mfl-coil-bore" />
                <span className="mfl-coil-end right" />
                <span className="mfl-coil-pole left">{direction === "same" ? "S" : "N"}</span>
                <span className="mfl-coil-pole right">{direction === "same" ? "N" : "S"}</span>
                <small>2. BOBİN · SÜRÜKLE</small>
              </button>
            )}
            {coreReady && powerOn && (
              <div className={`mfl-field-visual ${direction}`} style={{ "--field-strength": `${clamp(Math.abs(field) / 2.6, 0.52, 1)}` } as CSSProperties} aria-hidden="true">
                <i /><i /><i /><i /><i />
                <b>{direction === "same" ? "B ALAN YÖNÜ  →" : "ALANLAR ZIT  →  ←"}</b>
                <span className="mfl-axis-arrows"><em>→</em><em>→</em><em>→</em><em>→</em></span>
              </div>
            )}
            {placed.includes("probe-coil") && (
              <button
                type="button"
                className="mfl-probe"
                style={{ "--probe-left": `${probePercent}%` } as CSSProperties}
                onPointerDown={(event) => beginDrag(event, "probe")}
                aria-label={`Yoklama kangalı, ${probePosition} santimetre; ray üzerinde sürükle`}
              >
                <span className="mfl-probe-ring"><i /></span>
                <span className="mfl-probe-stem" />
                <span className="mfl-probe-carriage" />
                <span className="mfl-probe-ports"><i /><i /></span>
                <small>YOKLAMA KANGALI</small>
              </button>
            )}
            {placed.includes("multimeter") && (
              <div className="mfl-multimeter">
                <span>AC VOLTMETRE</span>
                <b>{inducedVoltage.toFixed(3)}<small> V~</small></b>
                <em>YOKLAMA KANGALI ÖLÇÜMÜ</em>
                <i className="mfl-meter-dial" />
                <i className="mfl-meter-port red" />
                <i className="mfl-meter-port black" />
              </div>
            )}
            {placed.includes("cables") && (
              <>
                <div className="mfl-cables" style={{ "--probe-left": `${probePercent}%` } as CSSProperties} aria-hidden="true">
                  <span className="mfl-cable drive red"><i /><b>1</b></span>
                  <span className="mfl-cable drive black"><i /><b>1</b></span>
                  <span className="mfl-cable measure red"><i /><b>2</b></span>
                  <span className="mfl-cable measure black"><i /><b>2</b></span>
                </div>
                <div className="mfl-connection-guide">
                  <span><i>1</i><b>Güç devresi</b> Kaynak → ana bobin</span>
                  <span><i>2</i><b>Ölçüm devresi</b> Yoklama kangalı → AC voltmetre</span>
                </div>
              </>
            )}
            {!coreReady && (
              <div className="mfl-drop-prompt">
                <ApparatusIcon kind={nextEquipment ?? "rail"} />
                <b>{nextEquipment ? EQUIPMENT.find(({ kind }) => kind === nextEquipment)?.name : "Düzenek hazır"}</b>
                <span>Bu parçayı masaya bırak</span>
              </div>
            )}
            <div className="mfl-bench-front"><span>İdeal laboratuvar modeli · 50 Hz AC</span></div>
          </div>

          <div className={`mfl-controls ${coreReady ? "enabled" : ""}`}>
            <div className="mfl-control-heading">
              <div><span>3 · DEĞİŞKENLER</span><h2>Yoklama kangalı neyi ölçüyor?</h2></div>
              <p>Kangalın AC gerilimi, bulunduğu yerdeki manyetik alanın büyüklüğünü gösterir.</p>
            </div>
            <div className="mfl-control-grid">
              <div className="mfl-control-card">
                <label>Kaynak gerilimi <b>{supplyVoltage} V~</b></label>
                <div className="mfl-voltage-buttons">
                  {[2, 4, 6, 8, 10].map((value) => (
                    <button type="button" key={value} className={supplyVoltage === value ? "active" : ""} onClick={() => setSupplyVoltage(value)} disabled={!coreReady}>{value} V</button>
                  ))}
                </div>
                <small>İdeal devrede akım: {(supplyVoltage / 5).toFixed(2)} A</small>
              </div>
              <div className="mfl-control-card">
                <label htmlFor="probe-position">Kangal konumu <b>{probePosition.toFixed(1)} cm</b></label>
                <input id="probe-position" type="range" min={DOMAIN_MIN} max={DOMAIN_MAX} step="0.5" value={probePosition} onChange={(event) => setProbePosition(Number(event.target.value))} disabled={!coreReady} />
                <small>Kangalı rayda sürükleyebilir veya bu cetveli kullanabilirsin.</small>
              </div>
              <div className="mfl-control-card mfl-second-control">
                <label>İkinci bobin <b>{secondCoil ? `${secondGap} cm aralık` : "Henüz eklenmedi"}</b></label>
                {secondCoil ? (
                  <>
                    <input type="range" min="0" max="6" step="1" value={secondGap} onChange={(event) => setSecondGap(Number(event.target.value))} />
                    <div className="mfl-direction-buttons">
                      <button type="button" className={direction === "same" ? "active" : ""} onClick={() => setDirection("same")}>Aynı yön</button>
                      <button type="button" className={direction === "opposite" ? "active" : ""} onClick={() => setDirection("opposite")}>Bobini ters çevir</button>
                    </div>
                  </>
                ) : <small>İlk taramadan sonra tepsideki son parçayı ekle.</small>}
              </div>
              <div className="mfl-live-readout">
                <span>CANLI ÖLÇÜM</span>
                <div><p><small>Konum</small><b>{probePosition.toFixed(1)} cm</b></p><p><small>Bobin akımı</small><b>{current.toFixed(2)} A</b></p><p><small>Manyetik alan</small><b>{Math.abs(field).toFixed(3)} mT</b></p><p><small>Yoklama gerilimi · alan göstergesi</small><b>{inducedVoltage.toFixed(3)} V~</b><em>Alan büyüdükçe bu değer artar.</em></p></div>
                <div className="mfl-live-actions">
                  <button type="button" className={powerOn ? "stop" : "start"} onClick={() => setPowerOn((value) => !value)} disabled={!coreReady}>{powerOn ? "Gücü kapat" : "Deneyi çalıştır"}</button>
                  <button type="button" onClick={recordMeasurement} disabled={!powerOn}>Ölçümü kaydet</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mfl-evidence">
        <div className="mfl-evidence-heading">
          <div><span>4 · KANITI İNCELE</span><h2>İki grafik, aynı düzenek</h2></div>
          <p>Turuncu işaret kangalın bulunduğu yeri gösterir. Bobin ya da kangal hareket ettiğinde eğriler ideal olarak anında yenilenir.</p>
        </div>
        <div className="mfl-graph-grid">
          <article><div><span>KONUM TARAMASI</span><b>Manyetik alan – konum</b></div><FieldGraph current={current} secondCoil={secondCoil} gap={secondGap} direction={direction} probePosition={probePosition} /></article>
          <article><div><span>AKIM TARAMASI</span><b>Gösterge gerilimi – akım</b></div><CurrentGraph indicatorAtOneAmp={indicatorAtOneAmp} /></article>
        </div>
        <div className="mfl-data-card">
          <div className="mfl-data-heading"><div><span>ÖLÇÜM KAYITLARI</span><b>Kangal hangi noktada ne gösterdi?</b></div><button type="button" onClick={() => setMeasurements([])} disabled={measurements.length === 0}>Kayıtları temizle</button></div>
          <div className="mfl-table-wrap">
            <table>
              <thead><tr><th>Düzenek</th><th>Konum (cm)</th><th>Akım (A)</th><th>Alan (mT)</th><th>Kangal gerilimi (V~)</th></tr></thead>
              <tbody>
                {measurements.length === 0 ? <tr><td colSpan={5}>Gücü aç, kangalı taşı ve “Ölçümü kaydet” düğmesine bas.</td></tr> : measurements.map((row) => <tr key={row.id}><td>{row.setup}</td><td>{row.position.toFixed(1)}</td><td>{row.current.toFixed(2)}</td><td>{row.field.toFixed(3)}</td><td>{row.voltage.toFixed(3)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mfl-report">
        <div className="mfl-report-heading"><span>5 · TYMM KISA DENEY RAPORU</span><h2>Ölçümden açıklamaya geç.</h2><p>Yanıtlarını grafiğine ve kayıtlarına dayandır; bir bağıntıyı ezberden yazman gerekmiyor.</p></div>
        <div className="mfl-report-grid">
          <label><span>1</span><b>Bobinin merkezi ile uçlarında gösterge nasıl değişti?</b><textarea value={report.position} onChange={(event) => setReport({ ...report, position: event.target.value })} placeholder="Konum taramasından iki ölçüm kullan…" /></label>
          <label><span>2</span><b>Akımı artırdığında grafikte hangi örüntüyü gördün?</b><textarea value={report.current} onChange={(event) => setReport({ ...report, current: event.target.value })} placeholder="Akım ve kangal gerilimini karşılaştır…" /></label>
          <label><span>3</span><b>İki bobinin aralığı ve yönü alanı nasıl değiştirdi?</b><textarea value={report.coils} onChange={(event) => setReport({ ...report, coils: event.target.value })} placeholder="Aynı yön ve zıt yön sonuçlarını karşılaştır…" /></label>
          <label><span>4</span><b>Bu düzenekten ulaştığın temel sonucu yaz.</b><textarea value={report.conclusion} onChange={(event) => setReport({ ...report, conclusion: event.target.value })} placeholder="Kanıtına dayalı kısa bir sonuç…" /></label>
        </div>
        <div className="mfl-ideal-note"><b>İDEAL ÖLÇÜM</b><span>Bu modelde bağlantılar ve ölçümler ideal kabul edilir; aynı koşullar aynı sonucu üretir.</span></div>
      </div>
    </section>
  );
}
