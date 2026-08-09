"use client";

import {
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type PartKind = "source" | "linac4" | "injectors" | "lhc" | "atlas";
type RunState = "idle" | "accelerating" | "ready" | "colliding" | "result";
type EnergyKind = "low" | "medium" | "high";
type DetectorLayer = "track" | "energy" | "outer";

type AcceleratorPart = {
  kind: PartKind;
  label: string;
  short: string;
  description: string;
  energy: string;
};

type DetectorParticle = {
  id: string;
  symbol: string;
  name: string;
  group: string;
  fundamental: boolean;
  direct: boolean;
  minimumEnergy: EnergyKind;
  color: string;
  standardInfo: string;
  detectorInfo: string;
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

const ENERGY_LEVELS: Record<EnergyKind, {
  label: string;
  beam: number;
  summary: string;
  detectorEffect: string;
  trackBend: number;
  signalRadius: number;
  flashRadius: number;
}> = {
  low: {
    label: "Düşük",
    beam: 0.45,
    summary: "Protonlar daha az çarpışma enerjisi taşır.",
    detectorEffect: "Yüklü parçacık izleri daha fazla kıvrılır; enerji parıltıları daha küçük görünür.",
    trackBend: 58,
    signalRadius: 12,
    flashRadius: 18,
  },
  medium: {
    label: "Orta",
    beam: 3.5,
    summary: "Yeni parçacık oluşturmak için daha çok enerji vardır.",
    detectorEffect: "İzler daha az kıvrılır; enerji sensöründeki parıltılar büyür.",
    trackBend: 34,
    signalRadius: 20,
    flashRadius: 28,
  },
  high: {
    label: "Yüksek",
    beam: 6.8,
    summary: "Daha ağır parçacıkların oluşabilme olasılığı artar.",
    detectorEffect: "İzler en az kıvrılır; enerji sensöründe en büyük ve parlak sinyal görülür.",
    trackBend: 14,
    signalRadius: 29,
    flashRadius: 40,
  },
};

const DETECTOR_PARTICLES: DetectorParticle[] = [
  {
    id: "electron",
    symbol: "e⁻ / e⁺",
    name: "Elektron ve pozitron",
    group: "Lepton · 1. nesil",
    fundamental: true,
    direct: true,
    minimumEnergy: "low",
    color: "#70f0cf",
    standardInfo: "Elektron temel bir madde parçacığıdır. Pozitron, elektronun artı yüklü karşıt parçacığıdır.",
    detectorInfo: "Zıt yönlere kıvrılan iki iz bırakır ve enerji sensöründe iki parlak nokta oluşturur.",
  },
  {
    id: "photon",
    symbol: "γ",
    name: "Foton",
    group: "Taşıyıcı bozon",
    fundamental: true,
    direct: true,
    minimumEnergy: "low",
    color: "#ffe367",
    standardInfo: "Foton ışığın temel parçacığıdır ve elektromanyetik etkileşimi taşır. Elektrik yükü yoktur.",
    detectorInfo: "İç iz sensöründe yol bırakmaz; enerji sensöründe sarı bir parıltı oluşturur.",
  },
  {
    id: "muon",
    symbol: "μ⁻ / μ⁺",
    name: "Müon ve antimüon",
    group: "Lepton · 2. nesil",
    fundamental: true,
    direct: true,
    minimumEnergy: "medium",
    color: "#7cd9ff",
    standardInfo: "Müon elektrona benzeyen, fakat ondan daha ağır olan temel bir leptondur.",
    detectorInfo: "Dedektörün içinden geçer ve en dıştaki müon sensörüne ulaşan uzun iz bırakır.",
  },
  {
    id: "pion",
    symbol: "π⁺ / π⁻",
    name: "Yüklü pion",
    group: "Hadron · kuark bileşiği",
    fundamental: false,
    direct: true,
    minimumEnergy: "medium",
    color: "#ff9b61",
    standardInfo: "Pion temel değildir; bir kuark ile bir karşı kuarktan oluşan kısa ömürlü bir hadrondur.",
    detectorInfo: "İz sensöründe kıvrılan yol ve enerji sensöründe parçacık yağmuru biçiminde sinyal bırakır.",
  },
  {
    id: "proton",
    symbol: "p⁺",
    name: "Proton",
    group: "Baryon · kuark bileşiği",
    fundamental: false,
    direct: true,
    minimumEnergy: "high",
    color: "#f08b62",
    standardInfo: "Proton temel değildir; iki yukarı ve bir aşağı kuarktan oluşur: u + u + d.",
    detectorInfo: "Yüklü olduğu için iz bırakır; enerji sensöründe güçlü bir hadron sinyali oluşturur.",
  },
  {
    id: "neutron",
    symbol: "n",
    name: "Nötron",
    group: "Baryon · kuark bileşiği",
    fundamental: false,
    direct: true,
    minimumEnergy: "high",
    color: "#b8c8cf",
    standardInfo: "Nötron temel değildir; bir yukarı ve iki aşağı kuarktan oluşur: u + d + d.",
    detectorInfo: "Yüksüz olduğu için içte iz bırakmaz; enerji sensöründe oluşturduğu parçacık yağmuruyla tanınır.",
  },
  {
    id: "tau",
    symbol: "τ⁻ / τ⁺",
    name: "Tau ve antitau",
    group: "Lepton · 3. nesil",
    fundamental: true,
    direct: false,
    minimumEnergy: "high",
    color: "#65e0a8",
    standardInfo: "Tau, elektron ve müonun daha ağır akrabası olan temel bir leptondur.",
    detectorInfo: "Dedektöre ulaşmadan bozunur; bıraktığı kısa ve dar parçacık izlerinden çıkarılır.",
  },
  {
    id: "neutrino",
    symbol: "ν",
    name: "Nötrino",
    group: "Lepton",
    fundamental: true,
    direct: false,
    minimumEnergy: "high",
    color: "#d7a2ff",
    standardInfo: "Nötrino yüksüz ve çok hafif temel bir leptondur; maddeyle çok zayıf etkileşir.",
    detectorInfo: "Dedektörde doğrudan iz bırakmaz. Kaybolan enerji ve momentumdan varlığı çıkarılır.",
  },
  {
    id: "w",
    symbol: "W±",
    name: "W bozonu",
    group: "Zayıf etkileşim bozonu",
    fundamental: true,
    direct: false,
    minimumEnergy: "high",
    color: "#ec78aa",
    standardInfo: "W bozonu zayıf etkileşimi taşıyan elektrik yüklü temel bir parçacıktır.",
    detectorInfo: "Dedektöre ulaşmadan bozunur; elektron, müon ve nötrino gibi ürünlerinden çıkarılır.",
  },
  {
    id: "z",
    symbol: "Z⁰",
    name: "Z bozonu",
    group: "Zayıf etkileşim bozonu",
    fundamental: true,
    direct: false,
    minimumEnergy: "high",
    color: "#8fa7ff",
    standardInfo: "Z bozonu zayıf etkileşimi taşıyan yüksüz temel bir parçacıktır.",
    detectorInfo: "Çok kısa sürede bozunur; elektron ya da müon çiftinin birlikte ölçülmesiyle bulunur.",
  },
  {
    id: "higgs",
    symbol: "H",
    name: "Higgs bozonu",
    group: "Higgs alanı parçacığı",
    fundamental: true,
    direct: false,
    minimumEnergy: "high",
    color: "#bd8cff",
    standardInfo: "Higgs bozonu, temel parçacıkların kütle kazanmasıyla ilişkili Higgs alanının parçacığıdır.",
    detectorInfo: "Doğrudan kalıcı iz bırakmaz; foton, elektron veya müon gibi bozunma ürünleri birlikte yorumlanır.",
  },
];

const PARTICLE_PRIMER = [
  {
    symbol: "p⁺",
    name: "Proton",
    kind: "Temel değil",
    description: "İki yukarı ve bir aşağı kuarktan oluşur: u + u + d.",
    fundamental: false,
  },
  {
    symbol: "e⁻",
    name: "Elektron",
    kind: "Temel parçacık",
    description: "Maddeyi oluşturan leptonlardan biridir.",
    fundamental: true,
  },
  {
    symbol: "μ",
    name: "Müon",
    kind: "Temel parçacık",
    description: "Elektronun daha ağır akrabası olan bir leptondur.",
    fundamental: true,
  },
  {
    symbol: "γ",
    name: "Foton",
    kind: "Temel parçacık",
    description: "Işığı ve elektromanyetik etkileşimi taşır.",
    fundamental: true,
  },
];

const ENERGY_RANK: Record<EnergyKind, number> = { low: 0, medium: 1, high: 2 };

const particlesAtEnergy = (energyKind: EnergyKind) =>
  DETECTOR_PARTICLES.filter(
    (particle) => ENERGY_RANK[particle.minimumEnergy] <= ENERGY_RANK[energyKind],
  );

function atlasParticleHitAreas(energyKind: EnergyKind) {
  const center = { x: 380, y: 300 };
  const photonAngle = Math.PI + 0.78;
  const areas = [
    { id: "electron", x: 552, y: 170 },
    { id: "electron", x: 208, y: 430 },
    {
      id: "photon",
      x: center.x + Math.cos(photonAngle) * 184,
      y: center.y + Math.sin(photonAngle) * 184,
    },
  ];
  if (ENERGY_RANK[energyKind] >= 1) {
    [0.13, Math.PI + 0.13].forEach((angle) => {
      areas.push({
        id: "muon",
        x: center.x + Math.cos(angle) * 255,
        y: center.y + Math.sin(angle) * 255,
      });
    });
    areas.push({ id: "pion", x: 418, y: 480 });
  }
  if (ENERGY_RANK[energyKind] >= 2) {
    areas.push(
      { id: "proton", x: 244, y: 424 },
      { id: "neutron", x: 438, y: 126 },
      { id: "tau", x: 314, y: 356 },
      { id: "neutrino", x: 548, y: 505 },
      { id: "w", x: 332, y: 270 },
      { id: "z", x: 428, y: 270 },
      { id: "higgs", x: 380, y: 354 },
    );
  }
  return areas;
}

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
  energyKind,
}: {
  installedCount: number;
  runState: RunState;
  energyKind: EnergyKind;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const energy = ENERGY_LEVELS[energyKind];
  const energyIndex = energyKind === "low" ? 0 : energyKind === "medium" ? 1 : 2;

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

      roundedPanel(context, 750, 24, 255, 62, "rgba(5,22,35,0.88)", "rgba(111,191,207,0.3)", 13);
      context.fillStyle = "#7db7c8";
      context.font = "900 9px Arial";
      context.textAlign = "left";
      context.fillText("SEÇİLEN ÇARPIŞMA GÜCÜ", 766, 44);
      [0, 1, 2].forEach((level) => {
        context.fillStyle = level <= energyIndex ? ["#5ecfbd", "#f1c05b", "#ef7b91"][level] : "#284656";
        context.fillRect(766 + level * 39, 56, 30, 9);
      });
      context.fillStyle = "#f0fbff";
      context.font = "900 13px Arial";
      context.fillText(`${energy.label.toUpperCase()} · ${format(energy.beam * 2)} TeV`, 895, 66);

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
          context.shadowColor = "#67e6ff";
          context.shadowBlur = 4 + energyIndex * 5;
          context.beginPath();
          context.arc(500 + Math.cos(blueAngle) * 350, 372 + Math.sin(blueAngle) * 96, 5 + energyIndex, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#ff91bc";
          context.shadowColor = "#ff91bc";
          context.beginPath();
          context.arc(500 + Math.cos(pinkAngle) * 350, 384 + Math.sin(pinkAngle) * 108, 5 + energyIndex, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
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
  }, [energy, energyIndex, installedCount, runState]);

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

function drawParticleMarker(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  symbol: string,
  color: string,
  selected: boolean,
) {
  const radius = selected ? 23 : 18;
  context.fillStyle = "rgba(4,18,30,0.94)";
  context.strokeStyle = color;
  context.lineWidth = selected ? 4 : 2;
  context.shadowColor = selected ? color : "transparent";
  context.shadowBlur = selected ? 18 : 0;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.font = `900 ${selected ? 16 : 13}px Georgia`;
  context.textAlign = "center";
  context.fillText(symbol, x, y + 5);
}

function CernAtlasCanvas({
  phase,
  energyKind,
  selectedParticleId,
  onSelectParticle,
}: {
  phase: "colliding" | "result";
  energyKind: EnergyKind;
  selectedParticleId: string;
  onSelectParticle: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const energy = ENERGY_LEVELS[energyKind];
  const energyIndex = energyKind === "low" ? 0 : energyKind === "medium" ? 1 : 2;
  const visibleParticles = useMemo(() => particlesAtEnergy(energyKind), [energyKind]);

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
        context.shadowBlur = 12 + energyIndex * 8;
        context.shadowColor = "#67e6ff";
        context.fillStyle = "#67e6ff";
        context.beginPath();
        context.arc(leftX, center.y, 9 + energyIndex * 2, 0, Math.PI * 2);
        context.fill();
        context.shadowColor = "#ff91bc";
        context.fillStyle = "#ff91bc";
        context.beginPath();
        context.arc(rightX, center.y, 9 + energyIndex * 2, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
        context.fillStyle = "#9aefff";
        context.font = "900 18px Arial";
        context.textAlign = "center";
        context.fillText("p⁺ →", leftX, center.y - 27);
        context.fillStyle = "#ffaad0";
        context.fillText("← p⁺", rightX, center.y + 43);
        if (progress > 0.88) {
          const flash = energy.flashRadius + Math.sin(elapsed * 12) * 5;
          context.fillStyle = "rgba(255,255,255,0.9)";
          context.shadowColor = "#fff4ab";
          context.shadowBlur = 24 + energyIndex * 14;
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

        const drawFocused = (id: string, drawParticle: (selected: boolean) => void) => {
          context.save();
          const selected = selectedParticleId === id;
          context.globalAlpha = selected ? 1 : 0.58;
          drawParticle(selected);
          context.restore();
        };

        drawFocused("electron", (selected) => {
          const firstEnd = { x: 552, y: 170 };
          const secondEnd = { x: 208, y: 430 };
          context.strokeStyle = "#70f0cf";
          context.lineWidth = (selected ? 7 : 4) + energyIndex;
          context.beginPath();
          context.moveTo(center.x, center.y);
          context.quadraticCurveTo(466 + energy.trackBend * 0.6, 235 + energy.trackBend * 0.8, firstEnd.x, firstEnd.y);
          context.stroke();
          context.strokeStyle = "#ff8cb8";
          context.beginPath();
          context.moveTo(center.x, center.y);
          context.quadraticCurveTo(294 - energy.trackBend * 0.6, 365 - energy.trackBend * 0.8, secondEnd.x, secondEnd.y);
          context.stroke();
          drawParticleMarker(context, firstEnd.x, firstEnd.y, "e⁻", "#70f0cf", selected);
          drawParticleMarker(context, secondEnd.x, secondEnd.y, "e⁺", "#ff8cb8", selected);
        });

        drawFocused("photon", (selected) => {
          const angle = Math.PI + 0.78;
          const endX = center.x + Math.cos(angle) * 184;
          const endY = center.y + Math.sin(angle) * 184;
          context.strokeStyle = "#ffe367";
          context.lineWidth = selected ? 7 : 4;
          context.setLineDash([11, 8]);
          context.beginPath();
          context.moveTo(center.x, center.y);
          context.lineTo(endX, endY);
          context.stroke();
          context.setLineDash([]);
          context.fillStyle = "#fff08a";
          context.shadowColor = "#ffe367";
          context.shadowBlur = energy.signalRadius * 1.55;
          context.beginPath();
          context.arc(endX, endY, energy.signalRadius, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
          drawParticleMarker(context, endX, endY, "γ", "#ffe367", selected);
        });

        if (energyIndex >= 1) {
          drawFocused("muon", (selected) => {
            [0.13, Math.PI + 0.13].forEach((angle, index) => {
              const endX = center.x + Math.cos(angle) * 255;
              const endY = center.y + Math.sin(angle) * 255;
              const midpointX = (center.x + endX) / 2;
              const midpointY = (center.y + endY) / 2;
              const curveDirection = index === 0 ? 1 : -1;
              const controlX = midpointX - Math.sin(angle) * energy.trackBend * curveDirection;
              const controlY = midpointY + Math.cos(angle) * energy.trackBend * curveDirection;
              const color = index === 0 ? "#7cd9ff" : "#b7a1ff";
              context.strokeStyle = color;
              context.lineWidth = selected ? 8 : 5;
              context.beginPath();
              context.moveTo(center.x, center.y);
              context.quadraticCurveTo(controlX, controlY, endX, endY);
              context.stroke();
              drawParticleMarker(context, endX, endY, index === 0 ? "μ⁻" : "μ⁺", color, selected);
            });
          });

          drawFocused("pion", (selected) => {
            const end = { x: 418, y: 480 };
            context.strokeStyle = "#ff9b61";
            context.lineWidth = selected ? 8 : 5;
            context.beginPath();
            context.moveTo(center.x, center.y);
            context.quadraticCurveTo(330 - energy.trackBend * 0.5, 390, end.x, end.y);
            context.stroke();
            drawParticleMarker(context, end.x, end.y, "π", "#ff9b61", selected);
          });
        }

        if (energyIndex >= 2) {
          drawFocused("proton", (selected) => {
            const end = { x: 244, y: 424 };
            context.strokeStyle = "#f08b62";
            context.lineWidth = selected ? 9 : 6;
            context.beginPath();
            context.moveTo(center.x, center.y);
            context.quadraticCurveTo(252, 332 + energy.trackBend, end.x, end.y);
            context.stroke();
            drawParticleMarker(context, end.x, end.y, "p⁺", "#f08b62", selected);
          });

          drawFocused("neutron", (selected) => {
            const end = { x: 438, y: 126 };
            context.strokeStyle = "#b8c8cf";
            context.lineWidth = selected ? 7 : 4;
            context.setLineDash([7, 8]);
            context.beginPath();
            context.moveTo(center.x, center.y);
            context.lineTo(end.x, end.y);
            context.stroke();
            context.setLineDash([]);
            drawParticleMarker(context, end.x, end.y, "n", "#b8c8cf", selected);
          });

          drawFocused("neutrino", (selected) => {
            const end = { x: 548, y: 505 };
            context.strokeStyle = "#d7a2ff";
            context.lineWidth = selected ? 6 : 3;
            context.setLineDash([5, 11]);
            context.beginPath();
            context.moveTo(center.x, center.y);
            context.lineTo(end.x, end.y);
            context.stroke();
            context.setLineDash([]);
            drawParticleMarker(context, end.x, end.y, "ν", "#d7a2ff", selected);
          });

          [
            { id: "tau", x: 314, y: 356, symbol: "τ", color: "#65e0a8" },
            { id: "w", x: 332, y: 270, symbol: "W", color: "#ec78aa" },
            { id: "z", x: 428, y: 270, symbol: "Z", color: "#8fa7ff" },
            { id: "higgs", x: 380, y: 354, symbol: "H", color: "#bd8cff" },
          ].forEach((particle) => {
            drawFocused(particle.id, (selected) => {
              context.strokeStyle = particle.color;
              context.lineWidth = selected ? 5 : 2;
              context.beginPath();
              context.moveTo(center.x, center.y);
              context.lineTo(particle.x, particle.y);
              context.stroke();
              drawParticleMarker(context, particle.x, particle.y, particle.symbol, particle.color, selected);
            });
          });
        }

        const selectedParticle = visibleParticles.find((particle) => particle.id === selectedParticleId) ?? visibleParticles[0];
        if (selectedParticle) {
          drawTag(context, 380, 54, selectedParticle.symbol, selectedParticle.name, selectedParticle.color);
        }

        context.fillStyle = "rgba(6,21,34,0.92)";
        context.beginPath();
        context.roundRect(190, 522, 380, 50, 13);
        context.fill();
        context.fillStyle = "#eefbff";
        context.font = "900 16px Arial";
        context.textAlign = "center";
        context.fillText(`${energy.label} enerjide ${visibleParticles.length} parçacık türü inceleniyor`, center.x, 554);
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
  }, [energy, energyIndex, phase, selectedParticleId, visibleParticles]);

  const handleCanvasClick = (eventObject: ReactMouseEvent<HTMLCanvasElement>) => {
    if (phase !== "result") return;
    const rect = eventObject.currentTarget.getBoundingClientRect();
    const logicalX = ((eventObject.clientX - rect.left) / rect.width) * ATLAS_WIDTH;
    const logicalY = ((eventObject.clientY - rect.top) / rect.height) * ATLAS_HEIGHT;
    const hit = atlasParticleHitAreas(energyKind)
      .map((area) => ({ ...area, distance: Math.hypot(area.x - logicalX, area.y - logicalY) }))
      .sort((first, second) => first.distance - second.distance)[0];
    if (hit && hit.distance <= 34) onSelectParticle(hit.id);
  };

  return (
    <canvas
      ref={canvasRef}
      className="cern-atlas-canvas"
      onClick={handleCanvasClick}
      aria-label={phase === "colliding" ? "ATLAS içinde birbirine yaklaşan iki proton" : `${energy.label} enerjide görülebilen parçacıkların ATLAS dedektör görüntüsü`}
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
  energyKind,
  particles,
  selectedParticleId,
  onSelectParticle,
  onBack,
}: {
  phase: "colliding" | "result";
  energyKind: EnergyKind;
  particles: DetectorParticle[];
  selectedParticleId: string;
  onSelectParticle: (id: string) => void;
  onBack: () => void;
}) {
  const energy = ENERGY_LEVELS[energyKind];
  const totalEnergy = energy.beam * 2;
  const energyIndex = energyKind === "low" ? 0 : energyKind === "medium" ? 1 : 2;
  const selectedParticle = particles.find((particle) => particle.id === selectedParticleId) ?? particles[0];
  const activeLayers: DetectorLayer[] = energyIndex === 0 ? ["track", "energy"] : ["track", "energy", "outer"];
  const layerInfo: Array<{ key: DetectorLayer; number: number; title: string; text: string }> = [
    { key: "track", number: 1, title: "İz sensörü", text: "Yüklü parçacıkların geçtiği yolu gösterir." },
    { key: "energy", number: 2, title: "Enerji sensörü", text: "Elektron ve fotonun bıraktığı enerjiyi gösterir." },
    { key: "outer", number: 3, title: "Dış sensör", text: "Dedektörü geçen müonları yakalar." },
  ];

  return (
    <div className="cern-atlas-zoom">
      <div className="cern-atlas-titlebar">
        <span><small>ATLAS’IN İÇİNDE</small><b>Büyütülmüş çarpışma görüntüsü</b></span>
        <div className={`cern-atlas-energy ${energyKind}`}>
          <span><small>ÇARPIŞMA GÜCÜ</small><b>{energy.label} · {format(totalEnergy)} TeV</b></span>
          <i aria-hidden="true">
            {[0, 1, 2].map((level) => <u key={level} className={level <= energyIndex ? "on" : ""} />)}
          </i>
        </div>
        {phase === "result" && <button type="button" onClick={onBack}>LHC halkasına dön</button>}
      </div>
      <div className="cern-atlas-layout">
        <aside className="cern-detector-guide">
          <span>ATLAS NE YAPIYOR?</span>
          <h2>Üç basit bölge</h2>
          {layerInfo.map((layer) => (
            <article
              key={layer.key}
              className={`${layer.key} ${phase === "result" && activeLayers.includes(layer.key) ? "active" : ""}`}
            >
              <i>{layer.number}</i>
              <div><b>{layer.title}</b><small>{layer.text}</small></div>
            </article>
          ))}
          <p><i /> Ortadaki beyaz nokta, iki protonun çarpıştığı yerdir.</p>
        </aside>
        <CernAtlasCanvas
          phase={phase}
          energyKind={energyKind}
          selectedParticleId={selectedParticleId}
          onSelectParticle={onSelectParticle}
        />
      </div>
      {phase === "result" && (
        <>
          <div className="cern-particle-explorer">
            <section className="cern-detected-particles">
              <span>BU ENERJİDE İNCELENEN TÜM PARÇACIKLAR</span>
              <h2>Bir parçacığa dokun</h2>
              <p>Düz çizgili etiket doğrudan dedektör sinyalini, kesikli etiket sinyallerden yapılan çıkarımı gösterir.</p>
              <div>
                {particles.map((particle) => (
                  <button
                    key={particle.id}
                    type="button"
                    className={`${particle.direct ? "direct" : "inferred"} ${selectedParticle?.id === particle.id ? "selected" : ""}`}
                    style={{ borderColor: particle.color }}
                    onClick={() => onSelectParticle(particle.id)}
                    aria-pressed={selectedParticle?.id === particle.id}
                  >
                    <i style={{ background: particle.color }}>{particle.symbol}</i>
                    <span><b>{particle.name}</b><small>{particle.direct ? "Doğrudan sinyal" : "Sinyallerden çıkarım"}</small></span>
                  </button>
                ))}
              </div>
            </section>

            {selectedParticle && (
              <aside className="cern-standard-card">
                <span>STANDART MODEL · BASİT BİLGİ KARTI</span>
                <header>
                  <strong style={{ background: selectedParticle.color }}>{selectedParticle.symbol}</strong>
                  <div><h2>{selectedParticle.name}</h2><small>{selectedParticle.group}</small></div>
                </header>
                <dl>
                  <div><dt>Temel parçacık mı?</dt><dd>{selectedParticle.fundamental ? "Evet" : "Hayır, kuark bileşiği"}</dd></div>
                  <div><dt>ATLAS’ta nasıl bulunur?</dt><dd>{selectedParticle.direct ? "Doğrudan sinyal" : "Başka sinyallerden çıkarım"}</dd></div>
                </dl>
                <p>{selectedParticle.standardInfo}</p>
                <div className="cern-detector-answer"><b>Dedektörde:</b> {selectedParticle.detectorInfo}</div>
              </aside>
            )}
          </div>

          <div className="cern-collision-result">
            <article><small>GİREN</small><b>Proton p⁺ + Proton p⁺</b></article>
            <article className={`energy-effect ${energyKind}`}>
              <small>ENERJİYLE NE DEĞİŞTİ?</small>
              <b>{energy.label} · {format(totalEnergy)} TeV</b>
              <span>{energy.detectorEffect}</span>
            </article>
            <article><small>İNCELENEN PARÇACIK TÜRLERİ</small><b>{particles.length} tür</b><span>{particles.filter((particle) => particle.direct).length} doğrudan · {particles.filter((particle) => !particle.direct).length} çıkarımla</span></article>
          </div>
        </>
      )}
    </div>
  );
}

export default function CernAcceleratorLab() {
  const [installed, setInstalled] = useState<PartKind[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [energyKind, setEnergyKind] = useState<EnergyKind>("high");
  const [selectedParticleId, setSelectedParticleId] = useState("electron");
  const [message, setMessage] = useState("İlk parçaya dokun veya onu deney alanına sürükle.");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const setupComplete = installed.length === SETUP_ORDER.length;
  const nextPart = ACCELERATOR_PARTS[installed.length] ?? null;
  const energy = ENERGY_LEVELS[energyKind];
  const visibleParticles = useMemo(() => particlesAtEnergy(energyKind), [energyKind]);
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
      setMessage("Düzenek tamamlandı. Çarpışma gücünü seç; bu enerjiye uygun parçacıklar otomatik olarak hazırlanacak.");
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
      setMessage(`${energy.label} enerjide ${visibleParticles.length} parçacık türü inceleniyor. Bir parçacığa dokunarak bilgi kartını aç.`);
    }, 1800);
  };

  const returnToRing = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunState("idle");
    setMessage("LHC halkasına dönüldü. Yeni bir enerji seçerek parçacık listesinin nasıl değiştiğini inceleyebilirsin.");
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
              energyKind={energyKind}
              particles={visibleParticles}
              selectedParticleId={selectedParticleId}
              onSelectParticle={setSelectedParticleId}
              onBack={returnToRing}
            />
          ) : (
            <CernAcceleratorCanvas
              installedCount={installed.length}
              runState={runState}
              energyKind={energyKind}
            />
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
                        setSelectedParticleId(particlesAtEnergy(key)[0].id);
                        setRunState("idle");
                      }}
                    >
                      <i className="cern-energy-bars" aria-hidden="true">
                        {[0, 1, 2].map((level) => (
                          <u key={level} className={level <= (key === "low" ? 0 : key === "medium" ? 1 : 2) ? "on" : ""} />
                        ))}
                      </i>
                      <small>{ENERGY_LEVELS[key].label}</small>
                      <b>{format(ENERGY_LEVELS[key].beam * 2)} TeV</b>
                    </button>
                  ))}
                </div>
                <em><b>Dedektörde fark:</b> {energy.detectorEffect}</em>
              </section>

              <section className="cern-energy-particle-preview">
                <span>2 · ENERJİYE GÖRE PARÇACIKLAR</span>
                <h2>{energy.label} enerjide {visibleParticles.length} tür incelenecek</h2>
                <p>Enerji yükseldikçe daha ağır ve çok kısa ömürlü parçacık örnekleri dedektör analizine eklenir.</p>
                <div>
                  {visibleParticles.map((particle) => (
                    <button
                      key={particle.id}
                      type="button"
                      className={`${particle.direct ? "direct" : "inferred"} ${selectedParticleId === particle.id ? "active" : ""}`}
                      onClick={() => setSelectedParticleId(particle.id)}
                    >
                      <strong style={{ color: particle.color }}>{particle.symbol}</strong>
                      <span><b>{particle.name}</b><small>{particle.direct ? "Dedektör sinyali" : "Sinyallerden çıkarım"}</small></span>
                    </button>
                  ))}
                </div>
                <em><b>{visibleParticles.filter((particle) => particle.direct).length}</b> doğrudan sinyal · <b>{visibleParticles.filter((particle) => !particle.direct).length}</b> sinyallerden çıkarım</em>
              </section>

              <section className="cern-particle-primer">
                <header>
                  <span>TEMEL PARÇACIK NEDİR?</span>
                  <h2>Daha küçük bir bileşeni bilinmeyen parçacık</h2>
                  <p>
                    Bugünkü ölçümlere göre kuarklar ve leptonlar temel parçacıktır.
                    Foton da bir temel kuvvet taşıyıcısıdır. Proton ise kuarklardan
                    oluştuğu için temel parçacık değildir.
                  </p>
                </header>
                <div>
                  {PARTICLE_PRIMER.map((item) => (
                    <article key={item.symbol} className={item.fundamental ? "fundamental" : "composite"}>
                      <strong>{item.symbol}</strong>
                      <span><b>{item.name}</b><small>{item.kind}</small></span>
                      <p>{item.description}</p>
                    </article>
                  ))}
                </div>
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
