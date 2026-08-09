"use client";

import {
  type DragEvent as ReactDragEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type PartKind = "source" | "linac4" | "injectors" | "lhc" | "atlas";
type RunState = "idle" | "accelerating" | "ready" | "colliding" | "result";
type EventKind = "electrons" | "photons" | "muons";
type EnergyKind = "low" | "medium" | "high";
type DetectorLayer = "track" | "energy" | "outer";

type AcceleratorPart = {
  kind: PartKind;
  label: string;
  short: string;
  description: string;
  energy: string;
};

type CollisionEvent = {
  key: EventKind;
  title: string;
  symbol: string;
  plainName: string;
  explanation: string;
  detectorFinding: string;
  layers: DetectorLayer[];
};

const MIME = "application/x-fizik-atolyesi-cern-part";
const ACCELERATOR_WIDTH = 1040;
const ACCELERATOR_HEIGHT = 560;
const ATLAS_WIDTH = 760;
const ATLAS_HEIGHT = 600;

const ACCELERATOR_PARTS: AcceleratorPart[] = [
  {
    kind: "source",
    label: "H⁻ iyon kaynağı",
    short: "PROTON KAYNAĞI",
    description: "Hidrojen atomlarından proton demeti hazırlanır.",
    energy: "başlangıç",
  },
  {
    kind: "linac4",
    label: "Linac4",
    short: "İLK HIZLANDIRICI",
    description: "Elektrik alan protonlara ilk hızını kazandırır.",
    energy: "160 MeV",
  },
  {
    kind: "injectors",
    label: "PS Booster · PS · SPS",
    short: "ÖN HIZLANDIRICILAR",
    description: "Proton Synchrotron ve Super Proton Synchrotron demeti LHC'ye hazırlar.",
    energy: "2 GeV → 26 GeV → 450 GeV",
  },
  {
    kind: "lhc",
    label: "LHC halkası ve mıknatıslar",
    short: "LHC HALKASI",
    description: "Süperiletken mıknatıslar iki proton demetini zıt yönlerde döndürür.",
    energy: "6,8 TeV / demet",
  },
  {
    kind: "atlas",
    label: "ATLAS dedektörü",
    short: "ATLAS",
    description: "Protonlar burada çarpışır; çıkan parçacıkların yolu ve enerjisi görülür.",
    energy: "çarpışma noktası",
  },
];

const SETUP_ORDER = ACCELERATOR_PARTS.map((part) => part.kind);

const ENERGY_LEVELS: Record<EnergyKind, { label: string; beam: number; summary: string }> = {
  low: {
    label: "Düşük",
    beam: 0.45,
    summary: "Protonlar daha az çarpışma enerjisi taşır.",
  },
  medium: {
    label: "Orta",
    beam: 3.5,
    summary: "Yeni parçacık oluşturmak için daha çok enerji vardır.",
  },
  high: {
    label: "Yüksek",
    beam: 6.8,
    summary: "Daha ağır parçacıkların oluşabilme olasılığı artar.",
  },
};

const EVENTS: Record<EventKind, CollisionEvent> = {
  electrons: {
    key: "electrons",
    title: "Elektron çifti",
    symbol: "e⁻  +  e⁺",
    plainName: "Elektron ve pozitron",
    explanation: "Pozitron, elektronun artı yüklü karşıt parçacığıdır.",
    detectorFinding: "Zıt yönlere kıvrılan iki renkli iz ve iki enerji noktası görülür.",
    layers: ["track", "energy"],
  },
  photons: {
    key: "photons",
    title: "İki foton",
    symbol: "γ  +  γ",
    plainName: "İki ışık parçacığı",
    explanation: "Foton, ışığı oluşturan yüksüz temel parçacıktır.",
    detectorFinding: "İçte iz bırakmaz; enerji sensöründe iki sarı parıltı oluşturur.",
    layers: ["energy"],
  },
  muons: {
    key: "muons",
    title: "Müon çifti",
    symbol: "μ⁻  +  μ⁺",
    plainName: "Müon ve antimüon",
    explanation: "Müon, elektrona benzeyen fakat daha ağır olan yüklü bir parçacıktır.",
    detectorFinding: "İki uzun iz dedektörün en dışındaki müon sensörüne kadar ulaşır.",
    layers: ["track", "outer"],
  },
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const format = (value: number) =>
  Number(value.toFixed(1)).toLocaleString("tr-TR");

function prepareCanvas(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(300, rect.width);
  const cssHeight = cssWidth * (logicalHeight / logicalWidth);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(cssWidth * ratio);
  const pixelHeight = Math.round(cssHeight * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(
    (cssWidth / logicalWidth) * ratio,
    0,
    0,
    (cssHeight / logicalHeight) * ratio,
    0,
    0,
  );
  context.clearRect(0, 0, logicalWidth, logicalHeight);
  return context;
}

function roundedPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
  radius = 16,
) {
  context.fillStyle = fill;
  context.strokeStyle = stroke;
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
  context.stroke();
}

function CernAcceleratorCanvas({
  installedCount,
  runState,
}: {
  installedCount: number;
  runState: RunState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const startedAt = performance.now();

    const draw = (now: number) => {
      const context = prepareCanvas(canvas, ACCELERATOR_WIDTH, ACCELERATOR_HEIGHT);
      if (!context) return;
      const time = (now - startedAt) / 1000;
      const background = context.createLinearGradient(0, 0, ACCELERATOR_WIDTH, ACCELERATOR_HEIGHT);
      background.addColorStop(0, "#071b2b");
      background.addColorStop(1, "#0b3047");
      context.fillStyle = background;
      context.fillRect(0, 0, ACCELERATOR_WIDTH, ACCELERATOR_HEIGHT);

      context.fillStyle = "rgba(255,255,255,0.04)";
      for (let x = 0; x < ACCELERATOR_WIDTH; x += 52) context.fillRect(x, 0, 1, ACCELERATOR_HEIGHT);
      for (let y = 0; y < ACCELERATOR_HEIGHT; y += 52) context.fillRect(0, y, ACCELERATOR_WIDTH, 1);

      context.fillStyle = "#84b8ca";
      context.font = "900 13px Arial";
      context.fillText("CERN HIZLANDIRMA YOLU", 42, 43);
      context.fillStyle = "#e7f8ff";
      context.font = "900 20px Arial";
      context.fillText("Proton kaynağından LHC halkasına", 42, 70);

      const nodes = [
        { x: 80, label: "KAYNAK" },
        { x: 270, label: "LINAC4" },
        { x: 470, label: "PS · SPS" },
        { x: 680, label: "LHC" },
        { x: 910, label: "ATLAS" },
      ];
      context.lineWidth = 8;
      context.lineCap = "round";
      nodes.slice(0, -1).forEach((node, index) => {
        context.strokeStyle = installedCount > index + 1 ? "#4db5c9" : "rgba(125,174,194,0.2)";
        context.setLineDash(installedCount > index + 1 ? [] : [10, 10]);
        context.beginPath();
        context.moveTo(node.x + 28, 130);
        context.lineTo(nodes[index + 1].x - 28, 130);
        context.stroke();
      });
      context.setLineDash([]);

      nodes.forEach((node, index) => {
        const installed = installedCount > index;
        const next = installedCount === index;
        context.shadowColor = next ? "#74efd0" : "transparent";
        context.shadowBlur = next ? 18 : 0;
        context.fillStyle = installed ? "#5bd1bd" : "#193b50";
        context.strokeStyle = installed ? "#baffed" : next ? "#74efd0" : "#45657a";
        context.lineWidth = next ? 4 : 2;
        context.beginPath();
        context.arc(node.x, 130, 26, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.shadowBlur = 0;
        context.fillStyle = installed ? "#092c34" : "#c8e0e9";
        context.font = "900 13px Arial";
        context.textAlign = "center";
        context.fillText(installed ? "✓" : String(index + 1), node.x, 135);
        context.fillStyle = installed ? "#dffef6" : "#759aad";
        context.font = "900 11px Arial";
        context.fillText(node.label, node.x, 177);
      });

      const ringReady = installedCount >= 4;
      roundedPanel(context, 35, 215, 970, 305, "rgba(3,17,28,0.68)", "rgba(104,177,202,0.25)", 24);
      context.fillStyle = "#84b8ca";
      context.font = "900 12px Arial";
      context.textAlign = "left";
      context.fillText("LHC HALKASI · ÜSTTEN GÖRÜNÜM", 62, 249);

      context.strokeStyle = ringReady ? "#3c7da0" : "rgba(104,156,180,0.24)";
      context.lineWidth = ringReady ? 34 : 4;
      context.setLineDash(ringReady ? [] : [14, 12]);
      context.beginPath();
      context.ellipse(500, 378, 350, 102, 0, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      if (ringReady) {
        context.strokeStyle = "#0b2437";
        context.lineWidth = 20;
        context.beginPath();
        context.ellipse(500, 378, 350, 102, 0, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "#47c6de";
        context.lineWidth = 3;
        context.beginPath();
        context.ellipse(500, 372, 350, 96, 0, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "#f07aa9";
        context.beginPath();
        context.ellipse(500, 384, 350, 108, 0, 0, Math.PI * 2);
        context.stroke();
      }

      const atlasReady = installedCount >= 5;
      context.save();
      context.translate(850, 378);
      [58, 43, 29].forEach((radius, index) => {
        context.strokeStyle = atlasReady
          ? ["#70a7e8", "#f0b45f", "#63d4bc"][index]
          : "rgba(119,161,180,0.28)";
        context.lineWidth = index === 0 ? 12 : 9;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.stroke();
      });
      context.restore();
      context.fillStyle = atlasReady ? "#f1faff" : "#6e92a3";
      context.font = "900 12px Arial";
      context.textAlign = "center";
      context.fillText("ATLAS", 850, 458);

      if (ringReady && (runState === "accelerating" || runState === "ready")) {
        const moving = runState === "accelerating" ? time * 1.8 : time * 1.1;
        for (let index = 0; index < 8; index += 1) {
          const blueAngle = moving + index * (Math.PI / 4);
          const pinkAngle = -moving + index * (Math.PI / 4);
          context.fillStyle = "#67e6ff";
          context.beginPath();
          context.arc(500 + Math.cos(blueAngle) * 350, 372 + Math.sin(blueAngle) * 96, 6, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#ff91bc";
          context.beginPath();
          context.arc(500 + Math.cos(pinkAngle) * 350, 384 + Math.sin(pinkAngle) * 108, 6, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.fillStyle = "#67e6ff";
      context.font = "900 13px Arial";
      context.textAlign = "left";
      context.fillText("p⁺ proton demeti →", 294, 349);
      context.fillStyle = "#ff91bc";
      context.fillText("← p⁺ proton demeti", 563, 420);
      context.fillStyle = "#b5d0dc";
      context.font = "800 11px Arial";
      context.fillText(atlasReady ? "İki demet ATLAS noktasında karşılaştırılır." : "Kurulum tamamlandığında proton demetleri halkada görünecek.", 62, 493);

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [installedCount, runState]);

  return (
    <canvas
      ref={canvasRef}
      className="cern-accelerator-canvas"
      aria-label="CERN hızlandırma yolu, LHC halkası ve zıt yönlerde dolaşan iki proton demeti"
    />
  );
}

function drawTag(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  symbol: string,
  name: string,
  color: string,
) {
  context.font = "900 14px Arial";
  const width = Math.max(144, context.measureText(name).width + 60);
  context.fillStyle = "rgba(6,22,35,0.94)";
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(x - width / 2, y - 21, width, 42, 11);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.font = "900 20px Georgia";
  context.textAlign = "left";
  context.fillText(symbol, x - width / 2 + 13, y + 7);
  context.fillStyle = "#ecf9fd";
  context.font = "900 12px Arial";
  context.fillText(name, x - width / 2 + 51, y + 5);
}

function CernAtlasCanvas({
  phase,
  event,
}: {
  phase: "colliding" | "result";
  event: CollisionEvent;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const startedAt = performance.now();

    const draw = (now: number) => {
      const context = prepareCanvas(canvas, ATLAS_WIDTH, ATLAS_HEIGHT);
      if (!context) return;
      const elapsed = (now - startedAt) / 1000;
      const center = { x: 380, y: 300 };
      const background = context.createRadialGradient(center.x, center.y, 30, center.x, center.y, 430);
      background.addColorStop(0, "#173e56");
      background.addColorStop(1, "#061421");
      context.fillStyle = background;
      context.fillRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT);

      const layers = [
        { radius: 102, color: "#62d7bf", width: 24 },
        { radius: 184, color: "#f3c45f", width: 42 },
        { radius: 256, color: "#72a6ea", width: 18 },
      ];
      layers.forEach((layer) => {
        context.globalAlpha = 0.28;
        context.strokeStyle = layer.color;
        context.lineWidth = layer.width;
        context.beginPath();
        context.arc(center.x, center.y, layer.radius, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 0.92;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(center.x, center.y, layer.radius, 0, Math.PI * 2);
        context.stroke();
      });
      context.globalAlpha = 1;

      context.strokeStyle = "rgba(141,192,211,0.25)";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(72, center.y);
      context.lineTo(688, center.y);
      context.stroke();

      if (phase === "colliding") {
        const progress = clamp(elapsed / 1.35, 0, 1);
        const leftX = 92 + (center.x - 92) * progress;
        const rightX = 668 - (668 - center.x) * progress;
        context.shadowBlur = 18;
        context.shadowColor = "#67e6ff";
        context.fillStyle = "#67e6ff";
        context.beginPath();
        context.arc(leftX, center.y, 12, 0, Math.PI * 2);
        context.fill();
        context.shadowColor = "#ff91bc";
        context.fillStyle = "#ff91bc";
        context.beginPath();
        context.arc(rightX, center.y, 12, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
        context.fillStyle = "#9aefff";
        context.font = "900 18px Arial";
        context.textAlign = "center";
        context.fillText("p⁺ →", leftX, center.y - 27);
        context.fillStyle = "#ffaad0";
        context.fillText("← p⁺", rightX, center.y + 43);
        if (progress > 0.88) {
          const flash = 18 + Math.sin(elapsed * 12) * 6;
          context.fillStyle = "rgba(255,255,255,0.9)";
          context.shadowColor = "#fff4ab";
          context.shadowBlur = 34;
          context.beginPath();
          context.arc(center.x, center.y, flash, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
        }
        context.fillStyle = "rgba(6,21,34,0.9)";
        context.beginPath();
        context.roundRect(185, 506, 390, 58, 14);
        context.fill();
        context.fillStyle = "#eaf9fd";
        context.font = "900 18px Arial";
        context.textAlign = "center";
        context.fillText("İki proton çarpışma noktasına yaklaşıyor", center.x, 541);
      } else {
        context.fillStyle = "#ffffff";
        context.shadowColor = "#fff6aa";
        context.shadowBlur = 24;
        context.beginPath();
        context.arc(center.x, center.y, 10, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;

        if (event.key === "electrons") {
          context.strokeStyle = "#70f0cf";
          context.lineWidth = 6;
          context.beginPath();
          context.moveTo(center.x, center.y);
          context.quadraticCurveTo(485, 244, 552, 170);
          context.stroke();
          context.strokeStyle = "#ff8cb8";
          context.beginPath();
          context.moveTo(center.x, center.y);
          context.quadraticCurveTo(274, 356, 208, 430);
          context.stroke();
          [
            { x: 525, y: 187, color: "#ffe77b" },
            { x: 235, y: 413, color: "#ffe77b" },
          ].forEach((point) => {
            context.fillStyle = point.color;
            context.shadowColor = point.color;
            context.shadowBlur = 22;
            context.beginPath();
            context.arc(point.x, point.y, 19, 0, Math.PI * 2);
            context.fill();
            context.shadowBlur = 0;
          });
          drawTag(context, 588, 142, "e⁻", "Elektron", "#70f0cf");
          drawTag(context, 172, 458, "e⁺", "Pozitron", "#ff8cb8");
        }

        if (event.key === "photons") {
          [0.55, Math.PI + 0.55].forEach((angle, index) => {
            const endX = center.x + Math.cos(angle) * 184;
            const endY = center.y + Math.sin(angle) * 184;
            context.strokeStyle = "#ffe367";
            context.lineWidth = 5;
            context.setLineDash([11, 8]);
            context.beginPath();
            context.moveTo(center.x, center.y);
            context.lineTo(endX, endY);
            context.stroke();
            context.setLineDash([]);
            context.fillStyle = "#fff08a";
            context.shadowColor = "#ffe367";
            context.shadowBlur = 28;
            context.beginPath();
            context.arc(endX, endY, 24, 0, Math.PI * 2);
            context.fill();
            context.shadowBlur = 0;
            drawTag(
              context,
              index === 0 ? 594 : 166,
              index === 0 ? 430 : 170,
              "γ",
              `${index + 1}. foton`,
              "#ffe367",
            );
          });
        }

        if (event.key === "muons") {
          [0.32, Math.PI + 0.32].forEach((angle, index) => {
            const endX = center.x + Math.cos(angle) * 255;
            const endY = center.y + Math.sin(angle) * 255;
            context.strokeStyle = index === 0 ? "#7cd9ff" : "#b7a1ff";
            context.lineWidth = 7;
            context.beginPath();
            context.moveTo(center.x, center.y);
            context.lineTo(endX, endY);
            context.stroke();
            drawTag(
              context,
              index === 0 ? 605 : 155,
              index === 0 ? 402 : 198,
              index === 0 ? "μ⁻" : "μ⁺",
              index === 0 ? "Müon" : "Antimüon",
              index === 0 ? "#7cd9ff" : "#b7a1ff",
            );
          });
        }

        context.fillStyle = "rgba(6,21,34,0.92)";
        context.beginPath();
        context.roundRect(190, 522, 380, 50, 13);
        context.fill();
        context.fillStyle = "#eefbff";
        context.font = "900 16px Arial";
        context.textAlign = "center";
        context.fillText(`${event.plainName} görüldü`, center.x, 554);
      }

      if (phase === "colliding") frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [event, phase]);

  return (
    <canvas
      ref={canvasRef}
      className="cern-atlas-canvas"
      aria-label={phase === "colliding" ? "ATLAS içinde birbirine yaklaşan iki proton" : `${event.plainName} için sade ATLAS dedektör görüntüsü`}
    />
  );
}

function PartIcon({ kind }: { kind: PartKind }) {
  return (
    <span className={`cern-part-icon cern-part-icon-${kind}`} aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

function CernAtlasZoom({
  phase,
  event,
  totalEnergy,
  onBack,
}: {
  phase: "colliding" | "result";
  event: CollisionEvent;
  totalEnergy: number;
  onBack: () => void;
}) {
  const layerInfo: Array<{ key: DetectorLayer; number: number; title: string; text: string }> = [
    { key: "track", number: 1, title: "İz sensörü", text: "Yüklü parçacıkların geçtiği yolu gösterir." },
    { key: "energy", number: 2, title: "Enerji sensörü", text: "Elektron ve fotonun bıraktığı enerjiyi gösterir." },
    { key: "outer", number: 3, title: "Dış sensör", text: "Dedektörü geçen müonları yakalar." },
  ];

  return (
    <div className="cern-atlas-zoom">
      <div className="cern-atlas-titlebar">
        <span><small>ATLAS’IN İÇİNDE</small><b>Büyütülmüş çarpışma görüntüsü</b></span>
        {phase === "result" && <button type="button" onClick={onBack}>LHC halkasına dön</button>}
      </div>
      <div className="cern-atlas-layout">
        <aside className="cern-detector-guide">
          <span>ATLAS NE YAPIYOR?</span>
          <h2>Üç basit bölge</h2>
          {layerInfo.map((layer) => (
            <article
              key={layer.key}
              className={`${layer.key} ${phase === "result" && event.layers.includes(layer.key) ? "active" : ""}`}
            >
              <i>{layer.number}</i>
              <div><b>{layer.title}</b><small>{layer.text}</small></div>
            </article>
          ))}
          <p><i /> Ortadaki beyaz nokta, iki protonun çarpıştığı yerdir.</p>
        </aside>
        <CernAtlasCanvas phase={phase} event={event} />
      </div>
      {phase === "result" && (
        <div className="cern-collision-result">
          <article><small>GİREN</small><b>Proton p⁺ + Proton p⁺</b></article>
          <article><small>ENERJİ NE YAPTI?</small><b>{format(totalEnergy)} TeV; yeni parçacıkların kütlesi ve hareketi için kullanıldı.</b></article>
          <article><small>DEDEKTÖRDE GÖRÜLEN</small><b>{event.symbol}</b><span>{event.plainName}</span></article>
        </div>
      )}
    </div>
  );
}

export default function CernAcceleratorLab() {
  const [installed, setInstalled] = useState<PartKind[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [energyKind, setEnergyKind] = useState<EnergyKind>("high");
  const [selectedEvent, setSelectedEvent] = useState<EventKind>("electrons");
  const [message, setMessage] = useState("İlk parçaya dokun veya onu deney alanına sürükle.");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const setupComplete = installed.length === SETUP_ORDER.length;
  const nextPart = ACCELERATOR_PARTS[installed.length] ?? null;
  const energy = ENERGY_LEVELS[energyKind];
  const event = EVENTS[selectedEvent];
  const totalEnergy = energy.beam * 2;
  const atlasOpen = runState === "colliding" || runState === "result";

  const statusLabel = runState === "accelerating"
    ? "Protonlar hızlanıyor"
    : runState === "ready"
      ? "Proton demetleri çarpışmaya hazır"
      : runState === "colliding"
        ? "ATLAS içinde çarpışıyor"
        : runState === "result"
          ? "Çarpışma sonucu gösteriliyor"
          : setupComplete
            ? "Düzenek hazır"
            : `Sıradaki: ${nextPart?.short ?? "—"}`;

  const addPart = (kind: PartKind) => {
    if (installed.includes(kind) || runState !== "idle") return;
    const expected = SETUP_ORDER[installed.length];
    if (kind !== expected) return;
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    if (nextInstalled.length === SETUP_ORDER.length) {
      setMessage("Düzenek tamamlandı. Çarpışma gücünü ve görmek istediğin basit parçacık örneğini seç.");
    } else {
      setMessage(`${ACCELERATOR_PARTS[nextInstalled.length - 1].label} bağlandı. Sıradaki parça hazır.`);
    }
  };

  const onDragStart = (
    eventObject: ReactDragEvent<HTMLButtonElement>,
    kind: PartKind,
  ) => {
    eventObject.dataTransfer.setData(MIME, kind);
    eventObject.dataTransfer.effectAllowed = "copy";
  };

  const onDrop = (eventObject: ReactDragEvent<HTMLDivElement>) => {
    eventObject.preventDefault();
    setDragOver(false);
    const kind = eventObject.dataTransfer.getData(MIME) as PartKind;
    if (SETUP_ORDER.includes(kind)) addPart(kind);
  };

  const accelerateBeams = () => {
    if (!setupComplete || runState !== "idle") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunState("accelerating");
    setMessage("Elektrik alan protonlara enerji veriyor; mıknatıslar onları LHC halkasında tutuyor.");
    timerRef.current = setTimeout(() => {
      setRunState("ready");
      setMessage("Mavi ve pembe proton demetleri zıt yönlerde dolaşıyor. Şimdi ATLAS'ta çarpıştır.");
    }, 2600);
  };

  const collideBeams = () => {
    if (runState !== "ready") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunState("colliding");
    setMessage("ATLAS büyütüldü. İki proton çarpışma noktasına yaklaşıyor.");
    timerRef.current = setTimeout(() => {
      setRunState("result");
      setMessage(`${event.plainName} oluştu. Renkli yolları ve kullanılan dedektör bölgesini incele.`);
    }, 1800);
  };

  const returnToRing = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunState("idle");
    setMessage("LHC halkasına dönüldü. Yeni bir enerji ve parçacık örneği seçebilirsin.");
  };

  const clearSetup = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setInstalled([]);
    setRunState("idle");
    setMessage("Düzenek söküldü. Proton kaynağıyla yeniden başla.");
  };

  const runPrimaryAction = () => {
    if (runState === "idle") accelerateBeams();
    if (runState === "ready") collideBeams();
    if (runState === "result") returnToRing();
  };

  const primaryLabel = runState === "idle"
    ? "Protonları hızlandır"
    : runState === "accelerating"
      ? "Protonlar hızlanıyor…"
      : runState === "ready"
        ? "ATLAS’ta çarpıştır"
        : runState === "colliding"
          ? "Çarpışma gerçekleşiyor…"
          : "Yeni çarpışma hazırla";

  return (
    <section className="cern-lab" id="cern-hizlandirici-deneyi">
      <div className="cern-heading">
        <div>
          <span>MODERN FİZİK · CERN DENEYİ</span>
          <h1>Protonları hızlandır, ATLAS’ın içine gir ve çarpışmayı gör.</h1>
          <p>
            Beş parçayı sırayla kur. Protonların LHC’de nasıl dolaştığını izle;
            ATLAS’ta çarpıştırınca dedektör aynı ekranda büyüsün.
          </p>
        </div>
        <aside>
          <small>BU DENEYDE ÜÇ ŞEY GÖRECEKSİN</small>
          <b>Halkada ne dolaşıyor?</b>
          <b>Çarpışma enerjisi ne işe yarıyor?</b>
          <b>ATLAS çıkan parçacığı nasıl görüyor?</b>
        </aside>
      </div>

      <div className="cern-flow" aria-label="Sade CERN deney akışı">
        <span className={!setupComplete ? "active" : "done"}><i>1</i>Düzeneği kur</span>
        <span className={setupComplete && !atlasOpen ? "active" : setupComplete ? "done" : ""}><i>2</i>Protonları hızlandır</span>
        <span className={atlasOpen ? "active" : ""}><i>3</i>ATLAS’ta büyüt ve gör</span>
      </div>

      <div className={`cern-builder ${atlasOpen ? "atlas-mode" : ""}`}>
        <aside className="cern-parts-panel">
          <div className="cern-panel-title">
            <span>DENEY PARÇALARI <b>{installed.length}/{SETUP_ORDER.length}</b></span>
            <h2>Sadece sıradaki parçayı ekle</h2>
            <p>Yeşil çerçeveli parçaya dokunabilir veya onu sağdaki alana sürükleyebilirsin.</p>
          </div>
          <div className="cern-part-list">
            {ACCELERATOR_PARTS.map((item, index) => {
              const isInstalled = installed.includes(item.kind);
              const isNext = index === installed.length;
              return (
                <button
                  key={item.kind}
                  type="button"
                  draggable={isNext && runState === "idle"}
                  disabled={isInstalled || !isNext || runState !== "idle"}
                  className={`${isInstalled ? "installed" : ""} ${isNext ? "next" : ""}`}
                  onDragStart={(eventObject) => onDragStart(eventObject, item.kind)}
                  onClick={() => addPart(item.kind)}
                >
                  <PartIcon kind={item.kind} />
                  <span>
                    <b>{index + 1}. {item.label}</b>
                    <small>{isInstalled ? "Yerine yerleşti" : item.description}</small>
                    <em>{item.energy}</em>
                  </span>
                </button>
              );
            })}
          </div>
          <button className="cern-clear" type="button" onClick={clearSetup}>Düzeneği sök</button>
        </aside>

        <div
          className={`cern-stage ${dragOver ? "drag-over" : ""} ${atlasOpen ? "atlas-open" : ""}`}
          onDragOver={(eventObject) => {
            eventObject.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="cern-stage-toolbar">
            <span><small>CERN DENEY EKRANI</small><b>{statusLabel}</b></span>
            {!atlasOpen && <span><small>HALKADA DOLAŞAN</small><b>Proton p⁺ = u + u + d</b></span>}
          </div>

          {atlasOpen ? (
            <CernAtlasZoom
              phase={runState === "colliding" ? "colliding" : "result"}
              event={event}
              totalEnergy={totalEnergy}
              onBack={returnToRing}
            />
          ) : (
            <CernAcceleratorCanvas installedCount={installed.length} runState={runState} />
          )}

          <div className="cern-message" role="status"><i />{message}</div>

          {setupComplete && !atlasOpen && (
            <div className="cern-simple-console">
              <section className="cern-energy-choice">
                <span>1 · ÇARPIŞMA GÜCÜ</span>
                <h2>Enerji ne işe yarar?</h2>
                <p>
                  Protonların taşıdığı enerji çarpışmada <b>yeni parçacıkların
                  kütlesine ve hareketine</b> dönüşebilir. Enerji arttıkça daha
                  ağır parçacıkların oluşabilme olasılığı artar.
                </p>
                <div>
                  {(Object.keys(ENERGY_LEVELS) as EnergyKind[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={energyKind === key ? "active" : ""}
                      disabled={runState === "accelerating"}
                      onClick={() => {
                        setEnergyKind(key);
                        setRunState("idle");
                      }}
                    >
                      <small>{ENERGY_LEVELS[key].label}</small>
                      <b>{format(ENERGY_LEVELS[key].beam * 2)} TeV</b>
                    </button>
                  ))}
                </div>
                <em>{energy.summary}</em>
              </section>

              <section className="cern-event-choice">
                <span>2 · BASİT ÖRNEK</span>
                <h2>Dedektörde ne görelim?</h2>
                <div>
                  {(Object.keys(EVENTS) as EventKind[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={selectedEvent === key ? "active" : ""}
                      disabled={runState === "accelerating"}
                      onClick={() => {
                        setSelectedEvent(key);
                        setRunState("idle");
                      }}
                    >
                      <strong>{EVENTS[key].symbol}</strong>
                      <span><b>{EVENTS[key].title}</b><small>{EVENTS[key].plainName}</small></span>
                    </button>
                  ))}
                </div>
                <p><b>{event.explanation}</b> {event.detectorFinding}</p>
              </section>

              <button
                className="cern-primary-action"
                type="button"
                onClick={runPrimaryAction}
                disabled={runState === "accelerating" || runState === "colliding"}
              >
                <i>{runState === "ready" ? "2" : "1"}</i>
                <span><small>{runState === "ready" ? "SONRAKİ ADIM" : "DENEYİ BAŞLAT"}</small><b>{primaryLabel}</b></span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="cern-sources">
        <span>Bilimsel dayanak</span>
        <a href="https://home.cern/science/accelerators/large-hadron-collider" target="_blank" rel="noreferrer">CERN · LHC</a>
        <a href="https://opendata.atlas.cern/docs/documentation/introduction/introduction_ATLAS/" target="_blank" rel="noreferrer">ATLAS · Dedektör</a>
      </div>
    </section>
  );
}
