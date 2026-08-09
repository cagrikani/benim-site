"use client";

import {
  type DragEvent as ReactDragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type PartKind =
  | "source"
  | "linac4"
  | "psb"
  | "ps"
  | "sps"
  | "lhc"
  | "magnets"
  | "atlas";
type RunState = "idle" | "accelerating" | "stored" | "colliding" | "detected";
type EventKind = "higgs" | "z-pair" | "top-pair" | "jets";
type ParticleGroup = "quark" | "lepton" | "boson" | "higgs";

type AcceleratorPart = {
  kind: PartKind;
  label: string;
  short: string;
  description: string;
  energy: string;
};

type Particle = {
  id: string;
  symbol: string;
  name: string;
  group: ParticleGroup;
  generation?: 1 | 2 | 3;
  charge: string;
  observation: string;
};

type CollisionEvent = {
  key: EventKind;
  title: string;
  reaction: string;
  description: string;
  particles: string[];
  signatures: string[];
  evidence: string;
};

type CollisionReading = {
  id: number;
  energy: number;
  event: string;
  reaction: string;
  particles: string;
  evidence: string;
};

const MIME = "application/x-fizik-atolyesi-cern-part";
const CANVAS_WIDTH = 1120;
const CANVAS_HEIGHT = 620;
const EVENT_WIDTH = 760;
const EVENT_HEIGHT = 520;

const ACCELERATOR_PARTS: AcceleratorPart[] = [
  {
    kind: "source",
    label: "H⁻ iyon kaynağı",
    short: "KAYNAK",
    description: "Hidrojen gazından negatif hidrojen iyonları üretir.",
    energy: "başlangıç",
  },
  {
    kind: "linac4",
    label: "Linac4",
    short: "LINAC4",
    description: "RF elektrik alanları H⁻ iyonlarını doğrusal hatta hızlandırır.",
    energy: "160 MeV",
  },
  {
    kind: "psb",
    label: "PS Booster + soyma folyosu",
    short: "PSB",
    description: "İki elektron ayrılır; dört halkada proton demeti hazırlanır.",
    energy: "2 GeV",
  },
  {
    kind: "ps",
    label: "Proton Synchrotron",
    short: "PS",
    description: "Proton paketlerini daha yüksek enerjiye çıkarır ve zamanlar.",
    energy: "26 GeV",
  },
  {
    kind: "sps",
    label: "Super Proton Synchrotron",
    short: "SPS",
    description: "Demeti LHC'ye enjekte edilecek enerjiye ulaştırır.",
    energy: "450 GeV",
  },
  {
    kind: "lhc",
    label: "LHC çift vakum tüpü",
    short: "LHC",
    description: "İki proton demeti 27 km'lik halkada zıt yönlerde dolaşır.",
    energy: "6,8 TeV / demet",
  },
  {
    kind: "magnets",
    label: "Süperiletken mıknatıslar + RF",
    short: "MANYETİK SİSTEM",
    description: "Dipoller yolu büker, kuadrupoller demeti sıkıştırır, RF enerji verir.",
    energy: "1,9 K · 8,3 T",
  },
  {
    kind: "atlas",
    label: "ATLAS dedektörü",
    short: "ATLAS",
    description: "Çarpışma ürünlerini katman katman ölçerek olay görüntüsü oluşturur.",
    energy: "çarpışma noktası",
  },
];

const SETUP_ORDER = ACCELERATOR_PARTS.map((part) => part.kind);

const PARTICLES: Particle[] = [
  { id: "u", symbol: "u", name: "Yukarı", group: "quark", generation: 1, charge: "+⅔", observation: "Dedektörde tek başına görülmez; hadronlaşarak jet oluşturur." },
  { id: "d", symbol: "d", name: "Aşağı", group: "quark", generation: 1, charge: "−⅓", observation: "Protonun temel bileşenlerindendir; çarpışmada jet izi bırakır." },
  { id: "c", symbol: "c", name: "Tılsım", group: "quark", generation: 2, charge: "+⅔", observation: "Kısa ömürlü hadronların bozunma izleri ve jetlerle belirlenir." },
  { id: "s", symbol: "s", name: "Acayip", group: "quark", generation: 2, charge: "−⅓", observation: "Acayip hadronların bozunma ürünlerinden tanınır." },
  { id: "t", symbol: "t", name: "Üst", group: "quark", generation: 3, charge: "+⅔", observation: "Hadronlaşmadan W bozonu ve alt kuarka bozunur; ürünleri birlikte analiz edilir." },
  { id: "b", symbol: "b", name: "Alt", group: "quark", generation: 3, charge: "−⅓", observation: "Çarpışma noktasından biraz ötede başlayan ikincil izlerle b-jeti olarak tanınır." },
  { id: "e", symbol: "e", name: "Elektron", group: "lepton", generation: 1, charge: "−1", observation: "İç izleyicide kıvrılan iz ve elektromanyetik kalorimetrede enerji kümesi bırakır." },
  { id: "ve", symbol: "νₑ", name: "Elektron nötrinosu", group: "lepton", generation: 1, charge: "0", observation: "Dedektörden geçer; görünmeyen enine momentumdan çıkarılır." },
  { id: "mu", symbol: "μ", name: "Müon", group: "lepton", generation: 2, charge: "−1", observation: "İç izleyici ve en dıştaki müon spektrometresinde uzun bir iz bırakır." },
  { id: "vmu", symbol: "νμ", name: "Müon nötrinosu", group: "lepton", generation: 2, charge: "0", observation: "Doğrudan iz bırakmaz; momentum dengesizliğinden çıkarılır." },
  { id: "tau", symbol: "τ", name: "Tau", group: "lepton", generation: 3, charge: "−1", observation: "Çok kısa sürede bozunur; dar bozunma ürünleri demetinden tanınır." },
  { id: "vtau", symbol: "ντ", name: "Tau nötrinosu", group: "lepton", generation: 3, charge: "0", observation: "Dedektörde iz bırakmaz; tau bozunmalarındaki momentum eksiğiyle çıkarılır." },
  { id: "g", symbol: "g", name: "Gluon", group: "boson", charge: "0", observation: "Güçlü etkileşimi taşır; kuarklar gibi parçacık jeti olarak gözlenir." },
  { id: "photon", symbol: "γ", name: "Foton", group: "boson", charge: "0", observation: "İç iz bırakmadan elektromanyetik kalorimetrede enerji kümesi oluşturur." },
  { id: "w", symbol: "W±", name: "W bozonu", group: "boson", charge: "±1", observation: "Çok kısa ömürlüdür; lepton-nötrino veya iki jet bozunmasından yeniden kurulur." },
  { id: "z", symbol: "Z⁰", name: "Z bozonu", group: "boson", charge: "0", observation: "Örneğin elektron-pozitron ya da müon-antimüon çiftinin toplamından yeniden kurulur." },
  { id: "h", symbol: "H", name: "Higgs bozonu", group: "higgs", charge: "0", observation: "Doğrudan kalıcı iz bırakmaz; iki foton gibi bozunma ürünlerinin ortak enerjisinden çıkarılır." },
];

const EVENTS: Record<EventKind, CollisionEvent> = {
  higgs: {
    key: "higgs",
    title: "Higgs → iki foton",
    reaction: "g + g → H → γ + γ",
    description: "İki gluonun enerjisi kısa ömürlü bir Higgs bozonuna dönüşür; iki foton elektromanyetik kalorimetrede belirir.",
    particles: ["g", "h", "photon"],
    signatures: ["İç iz yok", "Karşılıklı iki EM enerji kümesi", "Toplam enerjiden Higgs çıkarımı"],
    evidence: "İki foton kümesi",
  },
  "z-pair": {
    key: "z-pair",
    title: "Z → elektron çifti",
    reaction: "q + q̄ → Z⁰ → e⁻ + e⁺",
    description: "Kuark-antikuark etkileşimi Z bozonu üretir; zıt yüklü elektron ve pozitron izleri birlikte ölçülür.",
    particles: ["u", "d", "z", "e"],
    signatures: ["Zıt yönlü kıvrılan iki iz", "İki EM enerji kümesi", "Çiftten Z kütlesi çıkarımı"],
    evidence: "e⁻ ve e⁺ izleri",
  },
  "top-pair": {
    key: "top-pair",
    title: "Üst kuark çifti",
    reaction: "g + g → t + t̄ → b + b̄ + W⁺ + W⁻",
    description: "Üst kuarklar oluşur oluşmaz W bozonu ve alt kuarka bozunur; jetler, müon ve görünmeyen nötrino birlikte analiz edilir.",
    particles: ["g", "t", "b", "w", "mu", "vmu"],
    signatures: ["İki b-jeti", "Müon spektrometresine ulaşan iz", "Eksik enine momentum"],
    evidence: "b-jetleri + μ + momentum eksiği",
  },
  jets: {
    key: "jets",
    title: "Kuark–gluon saçılması",
    reaction: "q + g → q + g",
    description: "Protonların içindeki kuark ve gluon saçılır; hadronlaşma sonucunda karşılıklı parçacık jetleri oluşur.",
    particles: ["u", "d", "g"],
    signatures: ["İç izleyicide çok sayıda iz", "Hadronik kalorimetrede geniş kümeler", "Karşılıklı iki jet"],
    evidence: "İki hadronik jet",
  },
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const format = (value: number, digits = 1) =>
  Number(value.toFixed(digits)).toLocaleString("tr-TR");

function prepareCanvas(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(320, rect.width);
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

function drawArrow(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: string,
) {
  const angle = Math.atan2(endY - startY, endX - startX);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.beginPath();
  context.moveTo(endX, endY);
  context.lineTo(endX - Math.cos(angle - 0.5) * 13, endY - Math.sin(angle - 0.5) * 13);
  context.lineTo(endX - Math.cos(angle + 0.5) * 13, endY - Math.sin(angle + 0.5) * 13);
  context.closePath();
  context.fill();
}

function drawMachineLabel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  energy: string,
  active = false,
) {
  context.save();
  context.fillStyle = active ? "rgba(48,232,185,0.18)" : "rgba(7,22,38,0.84)";
  context.strokeStyle = active ? "#58efc4" : "rgba(130,177,202,0.38)";
  context.lineWidth = active ? 2.5 : 1.5;
  context.beginPath();
  context.roundRect(x - 56, y - 20, 112, 40, 9);
  context.fill();
  context.stroke();
  context.fillStyle = active ? "#a8ffe6" : "#d9f2ff";
  context.font = "900 10px Arial";
  context.textAlign = "center";
  context.fillText(title, x, y - 3);
  context.fillStyle = active ? "#66f2c8" : "#7eaac0";
  context.font = "800 9px Arial";
  context.fillText(energy, x, y + 12);
  context.restore();
}

function acceleratorPathPoint(progress: number) {
  const points = [
    { x: 78, y: 139 },
    { x: 280, y: 139 },
    { x: 374, y: 139 },
    { x: 475, y: 139 },
    { x: 603, y: 139 },
    { x: 675, y: 240 },
    { x: 290, y: 400 },
  ];
  const scaled = clamp(progress, 0, 0.9999) * (points.length - 1);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const start = points[index];
  const end = points[index + 1];
  return {
    x: start.x + (end.x - start.x) * local,
    y: start.y + (end.y - start.y) * local,
  };
}

function CernAcceleratorCanvas({
  installedCount,
  runState,
  beamEnergy,
}: {
  installedCount: number;
  runState: RunState;
  beamEnergy: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let animationFrame = 0;
    const startedAt = performance.now();

    const draw = (now: number) => {
      const context = prepareCanvas(canvas, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (!context) return;
      const time = (now - startedAt) / 1000;
      const activeStage = runState === "accelerating"
        ? Math.min(5, Math.floor(((time % 4.2) / 4.2) * 6))
        : runState === "stored" || runState === "colliding" || runState === "detected"
          ? 5
          : -1;

      const background = context.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      background.addColorStop(0, "#071827");
      background.addColorStop(0.55, "#0c2940");
      background.addColorStop(1, "#06131f");
      context.fillStyle = background;
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      context.strokeStyle = "rgba(92,164,191,0.08)";
      context.lineWidth = 1;
      for (let x = 24; x < CANVAS_WIDTH; x += 44) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, CANVAS_HEIGHT);
        context.stroke();
      }
      for (let y = 22; y < CANVAS_HEIGHT; y += 44) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(CANVAS_WIDTH, y);
        context.stroke();
      }

      context.fillStyle = "rgba(5,15,26,0.82)";
      context.beginPath();
      context.roundRect(25, 24, 1070, 248, 22);
      context.fill();
      context.strokeStyle = "rgba(104,173,200,0.22)";
      context.stroke();
      context.fillStyle = "#78a9be";
      context.font = "900 11px Arial";
      context.textAlign = "left";
      context.fillText("CERN PROTON ENJEKTÖR ZİNCİRİ · ŞEMATİK ÜSTTEN GÖRÜNÜM", 48, 52);

      const slots = [
        { x: 78, y: 139, rx: 34, ry: 34, title: "H⁻", energy: "iyon kaynağı" },
        { x: 218, y: 139, rx: 92, ry: 26, title: "LINAC4", energy: "160 MeV" },
        { x: 374, y: 139, rx: 43, ry: 43, title: "PSB", energy: "2 GeV" },
        { x: 475, y: 139, rx: 48, ry: 48, title: "PS", energy: "26 GeV" },
        { x: 603, y: 139, rx: 72, ry: 52, title: "SPS", energy: "450 GeV" },
      ];

      slots.forEach((slot, index) => {
        const installed = installedCount > index;
        context.save();
        context.strokeStyle = installed
          ? index === activeStage ? "#58efc4" : "#4995b8"
          : "rgba(123,169,190,0.25)";
        context.lineWidth = installed ? index === activeStage ? 7 : 5 : 2;
        context.setLineDash(installed ? [] : [8, 7]);
        context.shadowColor = index === activeStage ? "#42e8b7" : "transparent";
        context.shadowBlur = index === activeStage ? 18 : 0;
        if (index === 1) {
          context.beginPath();
          context.roundRect(slot.x - slot.rx, slot.y - slot.ry, slot.rx * 2, slot.ry * 2, 10);
          context.stroke();
          if (installed) {
            context.strokeStyle = "rgba(94,229,214,0.42)";
            context.lineWidth = 2;
            for (let cell = -65; cell <= 65; cell += 26) {
              context.beginPath();
              context.moveTo(slot.x + cell, slot.y - 18);
              context.lineTo(slot.x + cell, slot.y + 18);
              context.stroke();
            }
          }
        } else {
          const rings = index === 2 ? 4 : 1;
          for (let ring = 0; ring < rings; ring += 1) {
            context.beginPath();
            context.ellipse(slot.x, slot.y, slot.rx - ring * 6, slot.ry - ring * 6, 0, 0, Math.PI * 2);
            context.stroke();
          }
        }
        context.restore();
        drawMachineLabel(context, slot.x, 225, slot.title, slot.energy, index === activeStage);
      });

      for (let index = 0; index < slots.length - 1; index += 1) {
        const start = slots[index];
        const end = slots[index + 1];
        context.strokeStyle = installedCount > index + 1 ? "#2f718f" : "rgba(102,151,173,0.2)";
        context.lineWidth = 4;
        context.setLineDash(installedCount > index + 1 ? [] : [8, 7]);
        context.beginPath();
        context.moveTo(start.x + start.rx, start.y);
        context.lineTo(end.x - end.rx, end.y);
        context.stroke();
        context.setLineDash([]);
      }

      context.fillStyle = "rgba(5,15,26,0.72)";
      context.beginPath();
      context.roundRect(25, 292, 1070, 300, 22);
      context.fill();
      context.strokeStyle = "rgba(104,173,200,0.22)";
      context.stroke();
      context.fillStyle = "#78a9be";
      context.font = "900 11px Arial";
      context.fillText("LHC · 27 km HALKANIN EĞİTSEL ÖLÇEK MODELİ", 48, 320);

      const lhcInstalled = installedCount > 5;
      const systemsInstalled = installedCount > 6;
      const atlasInstalled = installedCount > 7;
      context.save();
      context.strokeStyle = lhcInstalled ? "#3d789d" : "rgba(112,163,186,0.24)";
      context.lineWidth = lhcInstalled ? 28 : 4;
      context.setLineDash(lhcInstalled ? [] : [12, 10]);
      context.beginPath();
      context.ellipse(555, 447, 390, 116, 0, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      if (lhcInstalled) {
        context.strokeStyle = "#0b2438";
        context.lineWidth = 16;
        context.beginPath();
        context.ellipse(555, 447, 390, 116, 0, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "#6ab0d1";
        context.lineWidth = 2;
        context.beginPath();
        context.ellipse(555, 443, 390, 112, 0, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "#cf6f9f";
        context.beginPath();
        context.ellipse(555, 451, 390, 120, 0, 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();

      context.strokeStyle = installedCount > 4 ? "#357695" : "rgba(102,151,173,0.2)";
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(603, 191);
      context.bezierCurveTo(620, 255, 650, 302, 675, 347);
      context.stroke();
      drawArrow(context, 646, 291, 675, 347, installedCount > 4 ? "#50c8d7" : "#315166");

      if (systemsInstalled) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
          const x = 555 + Math.cos(angle) * 390;
          const y = 447 + Math.sin(angle) * 116;
          context.save();
          context.translate(x, y);
          context.rotate(angle + Math.PI / 2);
          context.fillStyle = angle % (Math.PI / 6) < 0.05 ? "#ae5a8d" : "#2e8fa2";
          context.fillRect(-8, -17, 16, 34);
          context.restore();
        }
        context.fillStyle = "#89cddd";
        context.font = "800 9px Arial";
        context.textAlign = "center";
        context.fillText("SÜPERİLETKEN DİPOL + KUADRUPOL MIKNATISLAR", 555, 408);
        context.fillText("RF BOŞLUKLARI DEMETE HER TURDA ENERJİ VERİR", 555, 425);
      }

      const collisionPoint = { x: 945, y: 447 };
      if (atlasInstalled) {
        const detectorColors = ["#65e2c2", "#f5d66d", "#e88956", "#6ca5df"];
        detectorColors.forEach((color, index) => {
          context.strokeStyle = color;
          context.lineWidth = 7;
          context.beginPath();
          context.arc(collisionPoint.x, collisionPoint.y, 22 + index * 12, 0, Math.PI * 2);
          context.stroke();
        });
        context.fillStyle = "rgba(8,24,39,0.9)";
        context.beginPath();
        context.roundRect(973, 382, 97, 42, 8);
        context.fill();
        context.fillStyle = "#d8eff8";
        context.font = "900 10px Arial";
        context.textAlign = "center";
        context.fillText("ATLAS", 1021, 399);
        context.fillStyle = "#78a9be";
        context.font = "800 8px Arial";
        context.fillText("ÇARPIŞMA NOKTASI", 1021, 414);
      } else {
        context.strokeStyle = "rgba(123,169,190,0.3)";
        context.lineWidth = 2;
        context.setLineDash([7, 6]);
        context.beginPath();
        context.arc(collisionPoint.x, collisionPoint.y, 57, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
      }

      if (runState === "accelerating") {
        const progress = (time % 4.2) / 4.2;
        const point = acceleratorPathPoint(progress);
        context.shadowColor = "#73ffcf";
        context.shadowBlur = 18;
        context.fillStyle = "#c4ffed";
        context.beginPath();
        context.arc(point.x, point.y, 7, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }

      if (lhcInstalled && (runState === "stored" || runState === "colliding" || runState === "detected")) {
        const speed = runState === "colliding" ? 2.5 : 1.45;
        const collisionEase = runState === "colliding" ? Math.min(1, time / 1.6) : 0;
        const clockwiseAngle = runState === "colliding"
          ? Math.PI + Math.PI * collisionEase
          : time * speed;
        const counterAngle = runState === "colliding"
          ? Math.PI - Math.PI * collisionEase
          : -time * speed + Math.PI;
        const beamPoints = [
          { angle: clockwiseAngle, color: "#62e7ff" },
          { angle: counterAngle, color: "#ff6fa8" },
        ];
        beamPoints.forEach((beam) => {
          const x = 555 + Math.cos(beam.angle) * 390;
          const y = 447 + Math.sin(beam.angle) * 116;
          context.shadowColor = beam.color;
          context.shadowBlur = 20;
          context.fillStyle = beam.color;
          context.beginPath();
          context.arc(x, y, 7, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
        });
      }

      if (runState === "colliding" && time > 1.45) {
        const flash = clamp(1 - (time - 1.45) / 0.8, 0, 1);
        const radial = context.createRadialGradient(
          collisionPoint.x,
          collisionPoint.y,
          2,
          collisionPoint.x,
          collisionPoint.y,
          90,
        );
        radial.addColorStop(0, `rgba(255,255,255,${flash})`);
        radial.addColorStop(0.25, `rgba(255,224,109,${flash * 0.85})`);
        radial.addColorStop(1, "rgba(255,108,159,0)");
        context.fillStyle = radial;
        context.beginPath();
        context.arc(collisionPoint.x, collisionPoint.y, 90, 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = "rgba(6,19,31,0.88)";
      context.beginPath();
      context.roundRect(43, 350, 175, 82, 12);
      context.fill();
      context.fillStyle = "#77a8bd";
      context.font = "900 9px Arial";
      context.textAlign = "left";
      context.fillText("LHC ÇALIŞMA DEĞERLERİ", 59, 372);
      context.fillStyle = "#d8f4ff";
      context.font = "900 12px Arial";
      context.fillText(`${format(beamEnergy)} TeV / demet`, 59, 395);
      context.fillText(`${format(beamEnergy * 2)} TeV çarpışma`, 59, 414);
      context.fillStyle = "#74c8d7";
      context.font = "800 9px Arial";
      context.fillText("vakum · 1,9 K mıknatıs", 59, 430);

      const animated = runState === "accelerating"
        || runState === "stored"
        || runState === "colliding";
      if (animated) animationFrame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(draw);
    });
    observer.observe(canvas);
    animationFrame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [beamEnergy, installedCount, runState]);

  return (
    <canvas
      ref={canvasRef}
      className="cern-accelerator-canvas"
      aria-label="CERN proton enjektör zinciri, LHC halkası ve ATLAS çarpışma noktası"
    />
  );
}

function drawCurvedTrack(
  context: CanvasRenderingContext2D,
  angle: number,
  curvature: number,
  length: number,
  color: string,
  width = 3,
) {
  const center = { x: EVENT_WIDTH / 2, y: EVENT_HEIGHT / 2 };
  context.save();
  context.translate(center.x, center.y);
  context.rotate(angle);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(length * 0.5, curvature, length, curvature * 1.35);
  context.stroke();
  context.restore();
}

function drawJet(
  context: CanvasRenderingContext2D,
  angle: number,
  color: string,
  spread = 0.22,
) {
  for (let index = -3; index <= 3; index += 1) {
    drawCurvedTrack(
      context,
      angle + index * spread / 3,
      index * 4,
      188 - Math.abs(index) * 8,
      color,
      index === 0 ? 4 : 2,
    );
  }
}

function CernEventDisplay({ event }: { event: CollisionEvent | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const context = prepareCanvas(canvas, EVENT_WIDTH, EVENT_HEIGHT);
      if (!context) return;
      const center = { x: EVENT_WIDTH / 2, y: EVENT_HEIGHT / 2 };
      const background = context.createRadialGradient(center.x, center.y, 20, center.x, center.y, 360);
      background.addColorStop(0, "#102f46");
      background.addColorStop(1, "#050f1b");
      context.fillStyle = background;
      context.fillRect(0, 0, EVENT_WIDTH, EVENT_HEIGHT);

      const layers = [
        { radius: 68, color: "#4edcc0", width: 18, label: "İÇ İZLEYİCİ" },
        { radius: 126, color: "#f1d260", width: 32, label: "EM KALORİMETRE" },
        { radius: 184, color: "#e48250", width: 44, label: "HADRONİK KALORİMETRE" },
        { radius: 238, color: "#659ade", width: 12, label: "MÜON SİSTEMİ" },
      ];
      layers.forEach((layer) => {
        context.strokeStyle = layer.color;
        context.globalAlpha = 0.24;
        context.lineWidth = layer.width;
        context.beginPath();
        context.arc(center.x, center.y, layer.radius, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 0.7;
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(center.x, center.y, layer.radius, 0, Math.PI * 2);
        context.stroke();
      });
      context.globalAlpha = 1;

      context.strokeStyle = "rgba(143,189,207,0.22)";
      context.lineWidth = 1;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        context.beginPath();
        context.moveTo(center.x + Math.cos(angle) * 32, center.y + Math.sin(angle) * 32);
        context.lineTo(center.x + Math.cos(angle) * 246, center.y + Math.sin(angle) * 246);
        context.stroke();
      }

      context.fillStyle = "#ffffff";
      context.shadowColor = "#ffffff";
      context.shadowBlur = 16;
      context.beginPath();
      context.arc(center.x, center.y, 7, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;

      if (!event) {
        context.fillStyle = "rgba(6,18,29,0.88)";
        context.beginPath();
        context.roundRect(220, 215, 320, 90, 14);
        context.fill();
        context.fillStyle = "#d9f2fb";
        context.font = "900 15px Arial";
        context.textAlign = "center";
        context.fillText("ÇARPIŞMA VERİSİ BEKLENİYOR", center.x, 247);
        context.fillStyle = "#7ea9ba";
        context.font = "800 11px Arial";
        context.fillText("Demetleri hazırla ve seçtiğin olayı çalıştır.", center.x, 272);
        return;
      }

      if (event.key === "higgs") {
        [0.45, 3.59].forEach((angle) => {
          const clusterX = center.x + Math.cos(angle) * 128;
          const clusterY = center.y + Math.sin(angle) * 128;
          context.strokeStyle = "rgba(255,234,104,0.46)";
          context.setLineDash([4, 7]);
          context.beginPath();
          context.moveTo(center.x, center.y);
          context.lineTo(clusterX, clusterY);
          context.stroke();
          context.setLineDash([]);
          const shower = context.createRadialGradient(clusterX, clusterY, 2, clusterX, clusterY, 28);
          shower.addColorStop(0, "#fff7bd");
          shower.addColorStop(0.4, "#ffd84e");
          shower.addColorStop(1, "rgba(255,191,48,0)");
          context.fillStyle = shower;
          context.beginPath();
          context.arc(clusterX, clusterY, 28, 0, Math.PI * 2);
          context.fill();
        });
      }

      if (event.key === "z-pair") {
        drawCurvedTrack(context, 0.38, 34, 137, "#ffe36d", 4);
        drawCurvedTrack(context, Math.PI + 0.38, -34, 137, "#ff9ed0", 4);
        [0.65, 3.79].forEach((angle) => {
          const x = center.x + Math.cos(angle) * 127;
          const y = center.y + Math.sin(angle) * 127;
          context.fillStyle = "#ffe36d";
          context.beginPath();
          context.arc(x, y, 16, 0, Math.PI * 2);
          context.fill();
        });
      }

      if (event.key === "top-pair") {
        drawJet(context, -0.25, "#ff8b59", 0.3);
        drawJet(context, 2.55, "#f3b85f", 0.3);
        drawCurvedTrack(context, 1.25, 18, 238, "#6fb4ff", 5);
        context.strokeStyle = "#d58aff";
        context.lineWidth = 5;
        context.setLineDash([9, 8]);
        context.beginPath();
        context.moveTo(center.x, center.y);
        context.lineTo(center.x - 75, center.y + 206);
        context.stroke();
        context.setLineDash([]);
      }

      if (event.key === "jets") {
        drawJet(context, 0.16, "#ff975e", 0.38);
        drawJet(context, Math.PI + 0.1, "#f0c263", 0.38);
      }

      context.fillStyle = "rgba(5,16,27,0.88)";
      context.beginPath();
      context.roundRect(18, 18, 282, 58, 11);
      context.fill();
      context.fillStyle = "#78a9be";
      context.font = "900 9px Arial";
      context.textAlign = "left";
      context.fillText("ATLAS · İDEAL OLAY GÖRÜNÜMÜ", 34, 39);
      context.fillStyle = "#eefaff";
      context.font = "900 13px Arial";
      context.fillText(event.reaction, 34, 61);

      const legend = [
        { color: "#4edcc0", text: "iz" },
        { color: "#f1d260", text: "EM enerji" },
        { color: "#e48250", text: "hadronik enerji" },
        { color: "#659ade", text: "müon" },
      ];
      legend.forEach((item, index) => {
        const x = 30 + index * 175;
        context.fillStyle = item.color;
        context.fillRect(x, 486, 18, 5);
        context.fillStyle = "#b9d7e3";
        context.font = "800 9px Arial";
        context.fillText(item.text, x + 25, 492);
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [event]);

  return (
    <canvas
      ref={canvasRef}
      className="cern-event-canvas"
      aria-label={event ? `${event.title} için ideal ATLAS olay görüntüsü` : "Boş ATLAS olay ekranı"}
    />
  );
}

function PartIcon({ kind }: { kind: PartKind }) {
  return (
    <span className={`cern-part-icon cern-part-icon-${kind}`} aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

export default function CernAcceleratorLab() {
  const [installed, setInstalled] = useState<PartKind[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [beamEnergy, setBeamEnergy] = useState(6.8);
  const [selectedEvent, setSelectedEvent] = useState<EventKind>("higgs");
  const [detectedEvent, setDetectedEvent] = useState<CollisionEvent | null>(null);
  const [selectedParticle, setSelectedParticle] = useState("u");
  const [observedParticles, setObservedParticles] = useState<string[]>([]);
  const [readings, setReadings] = useState<CollisionReading[]>([]);
  const [message, setMessage] = useState(
    "H⁻ iyon kaynağıyla başla; parçaları CERN'deki gerçek hızlandırma sırasına göre yerleştir.",
  );
  const [answers, setAnswers] = useState(["", "", "", ""]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const setupComplete = installed.length === SETUP_ORDER.length;
  const nextPart = ACCELERATOR_PARTS[installed.length] ?? null;
  const event = EVENTS[selectedEvent];
  const particle = PARTICLES.find((item) => item.id === selectedParticle) ?? PARTICLES[0];
  const observedSet = useMemo(() => new Set(observedParticles), [observedParticles]);
  const statusLabel = runState === "accelerating"
    ? "Enjektör zincirinde hızlanıyor"
    : runState === "stored"
      ? "İki demet LHC halkasında hazır"
      : runState === "colliding"
        ? "ATLAS noktasında çarpışıyor"
        : runState === "detected"
          ? "Olay yeniden oluşturuldu"
          : setupComplete
            ? "Düzenek hazır"
            : "Kurulum bekleniyor";

  const addPart = (kind: PartKind) => {
    if (installed.includes(kind) || runState !== "idle") return;
    const expected = SETUP_ORDER[installed.length];
    if (kind !== expected) {
      const expectedPart = ACCELERATOR_PARTS.find((item) => item.kind === expected);
      setMessage(`Bu parça henüz bağlanamaz. Sıradaki parça: ${expectedPart?.label ?? "—"}.`);
      return;
    }
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    if (nextInstalled.length === SETUP_ORDER.length) {
      setMessage("Hızlandırıcı zinciri tamamlandı. Proton demetlerini enjektörlerden geçirerek LHC'ye doldur.");
    } else {
      const following = ACCELERATOR_PARTS[nextInstalled.length];
      setMessage(`${ACCELERATOR_PARTS[nextInstalled.length - 1].label} yerine oturdu. Şimdi ${following.label} parçasını ekle.`);
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
    if (!setupComplete || runState === "accelerating" || runState === "colliding") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setDetectedEvent(null);
    setRunState("accelerating");
    setMessage("H⁻ iyonları Linac4'te hızlanıyor; elektronları ayrılan protonlar PSB, PS ve SPS üzerinden LHC'ye aktarılıyor.");
    timerRef.current = setTimeout(() => {
      setRunState("stored");
      setMessage(`İki proton demeti zıt yönlerde dolaşıyor. Her demetin enerjisi ${format(beamEnergy)} TeV; ATLAS'ta çarpışmaya hazır.`);
    }, 4200);
  };

  const collideBeams = () => {
    if (runState !== "stored") {
      setMessage("Çarpışmadan önce proton demetlerini hızlandırıp LHC halkasına doldur.");
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunState("colliding");
    setDetectedEvent(null);
    setMessage("Kuadrupol mıknatıslar iki demeti ATLAS etkileşim noktasında sıkıştırıyor.");
    timerRef.current = setTimeout(() => {
      const selected = EVENTS[selectedEvent];
      setRunState("detected");
      setDetectedEvent(selected);
      setObservedParticles((current) => Array.from(new Set([...current, ...selected.particles])));
      setReadings((current) => [...current, {
        id: Date.now(),
        energy: beamEnergy * 2,
        event: selected.title,
        reaction: selected.reaction,
        particles: selected.particles
          .map((id) => PARTICLES.find((candidate) => candidate.id === id)?.symbol ?? id)
          .join(", "),
        evidence: selected.evidence,
      }]);
      setMessage(`${selected.title} olayı ideal dedektör verisiyle yeniden oluşturuldu. İzleri ve enerji kümelerini incele.`);
    }, 2300);
  };

  const resetBeams = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunState("idle");
    setDetectedEvent(null);
    setMessage(setupComplete
      ? "Düzenek korunuyor. Yeni proton demetlerini hazırlayabilirsin."
      : "Kuruluma gerçek hızlandırıcı zincirinin ilk parçasından devam et.");
  };

  const clearSetup = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setInstalled([]);
    setRunState("idle");
    setDetectedEvent(null);
    setMessage("Düzenek söküldü. H⁻ iyon kaynağıyla yeniden başla.");
  };

  return (
    <section className="cern-lab" id="cern-hizlandirici-deneyi">
      <div className="cern-heading">
        <div>
          <span>MODERN FİZİK · DENEY 2 · CERN</span>
          <h1>Hızlandırıcıyı kur, protonları çarpıştır, temel parçacıkları tanı.</h1>
          <p>
            CERN’in gerçek proton enjektör zincirini sırayla birleştir. LHC’de zıt
            yönlü iki demet oluştur, ATLAS olay görüntüsünü incele ve Standart
            Model parçacıklarını dedektör kanıtlarıyla eşleştir.
          </p>
        </div>
        <aside>
          <small>TYMM · 12. SINIF MODERN FİZİK</small>
          <b>Model kurma · kanıt yorumlama · bilimsel çıkarım</b>
          <span>Eğitsel ölçek modeli · ideal dedektör yanıtı</span>
        </aside>
      </div>

      <div className="cern-flow" aria-label="CERN deney akışı">
        <span><i>1</i>Enjektör zincirini kur</span>
        <span><i>2</i>Demetleri hızlandır</span>
        <span><i>3</i>ATLAS’ta çarpıştır</span>
        <span><i>4</i>Parçacıkları tanımla</span>
      </div>

      <div className="cern-builder">
        <aside className="cern-parts-panel">
          <div className="cern-panel-title">
            <span>HIZLANDIRICI PARÇALARI <b>{installed.length}/{SETUP_ORDER.length}</b></span>
            <h2>Gerçek sırayla kur</h2>
            <p>Parçayı sürükle veya dokun. Sistem yalnızca fiziksel olarak doğru sıradaki bağlantıyı kabul eder.</p>
          </div>
          <div className="cern-part-list">
            {ACCELERATOR_PARTS.map((item, index) => {
              const isInstalled = installed.includes(item.kind);
              const isNext = index === installed.length;
              return (
                <button
                  key={item.kind}
                  type="button"
                  draggable={!isInstalled && runState === "idle"}
                  disabled={isInstalled || runState !== "idle"}
                  className={`${isInstalled ? "installed" : ""} ${isNext ? "next" : ""}`}
                  onDragStart={(eventObject) => onDragStart(eventObject, item.kind)}
                  onClick={() => addPart(item.kind)}
                >
                  <PartIcon kind={item.kind} />
                  <span>
                    <b>{index + 1}. {item.label}</b>
                    <small>{isInstalled ? "Bağlandı" : item.description}</small>
                    <em>{item.energy}</em>
                  </span>
                </button>
              );
            })}
          </div>
          <button className="cern-clear" type="button" onClick={clearSetup}>Düzeneği sök</button>
        </aside>

        <div
          className={`cern-stage ${dragOver ? "drag-over" : ""}`}
          onDragOver={(eventObject) => {
            eventObject.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="cern-stage-toolbar">
            <span><small>CERN KONTROL MERKEZİ · EĞİTSEL MODEL</small><b>{statusLabel}</b></span>
            <div>
              <span><small>SIRADAKİ PARÇA</small><b>{nextPart?.short ?? "TAMAMLANDI"}</b></span>
              <span><small>DEMET ENERJİSİ</small><b>{format(beamEnergy)} TeV</b></span>
              <span><small>ÇARPIŞMA ENERJİSİ</small><b>{format(beamEnergy * 2)} TeV</b></span>
            </div>
          </div>
          <CernAcceleratorCanvas
            installedCount={installed.length}
            runState={runState}
            beamEnergy={beamEnergy}
          />
          <div className="cern-message" role="status"><i />{message}</div>
        </div>
      </div>

      {setupComplete && (
        <div className="cern-control-room">
          <section className="cern-beam-controls">
            <span>DEMET KONTROLÜ</span>
            <h2>İki proton demetini hazırla</h2>
            <label>
              <span>Her demetin enerjisi <b>{format(beamEnergy)} TeV</b></span>
              <input
                type="range"
                min="0.45"
                max="6.8"
                step="0.05"
                value={beamEnergy}
                disabled={runState !== "idle" && runState !== "detected"}
                onChange={(eventObject) => {
                  setBeamEnergy(Number(eventObject.target.value));
                  setRunState("idle");
                  setDetectedEvent(null);
                }}
              />
            </label>
            <div className="cern-beam-readout">
              <span><small>SPS ENJEKSİYON</small><b>450 GeV</b></span>
              <span><small>LHC DEMETİ</small><b>{format(beamEnergy)} TeV</b></span>
              <span><small>İKİ DEMET</small><b>{format(beamEnergy * 2)} TeV</b></span>
            </div>
            <div className="cern-action-row">
              <button type="button" onClick={accelerateBeams} disabled={runState === "accelerating" || runState === "colliding"}>1 · Demetleri hızlandır</button>
              <button type="button" className="collision" onClick={collideBeams} disabled={runState !== "stored"}>2 · ATLAS’ta çarpıştır</button>
              <button type="button" onClick={resetBeams}>Yeni demet</button>
            </div>
            <div className="cern-system-note">
              <b>Elektrik alan</b> parçacığa enerji verir. <b>Manyetik alan</b>
              demeti büker, odaklar ve iki demeti çarpışma noktasında sıkıştırır.
            </div>
          </section>

          <section className="cern-event-picker">
            <span>OLAY MENÜSÜ</span>
            <h2>Hangi Standart Model olayını arayalım?</h2>
            <div>
              {(Object.keys(EVENTS) as EventKind[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={selectedEvent === key ? "active" : ""}
                  onClick={() => {
                    setSelectedEvent(key);
                    setDetectedEvent(null);
                    if (runState === "detected") setRunState("stored");
                  }}
                >
                  <b>{EVENTS[key].title}</b>
                  <small>{EVENTS[key].reaction}</small>
                </button>
              ))}
            </div>
            <article>
              <small>SEÇİLEN OLAY</small>
              <strong>{event.reaction}</strong>
              <p>{event.description}</p>
            </article>
          </section>
        </div>
      )}

      {setupComplete && (
        <div className="cern-analysis">
          <div className="cern-event-display-wrap">
            <div className="cern-section-heading">
              <span>ATLAS DEDEKTÖRÜ</span>
              <h2>Katmanlardan parçacık izine</h2>
              <p>İç izleyici yüklü parçacıkların yolunu, kalorimetreler enerjiyi, en dış sistem ise müonları ölçer.</p>
            </div>
            <CernEventDisplay event={detectedEvent} />
          </div>

          <aside className="cern-evidence-panel">
            <span>DEDEKTÖR KANITI</span>
            <h2>{detectedEvent?.title ?? "Çarpışma bekleniyor"}</h2>
            {detectedEvent ? (
              <>
                <strong>{detectedEvent.reaction}</strong>
                <ul>
                  {detectedEvent.signatures.map((signature) => <li key={signature}>{signature}</li>)}
                </ul>
                <p>
                  Dedektör, kısa ömürlü W, Z, üst kuark ve Higgs’i doğrudan kalıcı
                  bir iz olarak görmez; ölçülen bozunma ürünlerinden yeniden kurar.
                </p>
              </>
            ) : (
              <p>Demetleri çarpıştırdığında bu alanda izler, enerji kümeleri, jetler ve momentum eksiği açıklanacak.</p>
            )}
          </aside>
        </div>
      )}

      {setupComplete && (
        <div className="cern-standard-model">
          <div className="cern-section-heading">
            <span>STANDART MODEL</span>
            <h2>Temel parçacıkları aileleriyle incele</h2>
            <p>Bir parçacığı seç. Son çarpışmayla ilişkili olan hücreler parlak çerçeveyle işaretlenir.</p>
          </div>
          <div className="cern-particle-layout">
            <div className="cern-particle-grid" aria-label="Standart Model temel parçacıkları">
              <section className="quarks">
                <header><b>KUARKLAR</b><small>madde parçacıkları</small></header>
                {PARTICLES.filter((item) => item.group === "quark").map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${selectedParticle === item.id ? "selected" : ""} ${observedSet.has(item.id) ? "observed" : ""}`}
                    onClick={() => setSelectedParticle(item.id)}
                    aria-pressed={selectedParticle === item.id}
                  >
                    <strong>{item.symbol}</strong><span>{item.name}</span><small>{item.generation}. nesil</small>
                  </button>
                ))}
              </section>
              <section className="leptons">
                <header><b>LEPTONLAR</b><small>madde parçacıkları</small></header>
                {PARTICLES.filter((item) => item.group === "lepton").map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${selectedParticle === item.id ? "selected" : ""} ${observedSet.has(item.id) ? "observed" : ""}`}
                    onClick={() => setSelectedParticle(item.id)}
                    aria-pressed={selectedParticle === item.id}
                  >
                    <strong>{item.symbol}</strong><span>{item.name}</span><small>{item.generation}. nesil</small>
                  </button>
                ))}
              </section>
              <section className="bosons">
                <header><b>BOZONLAR</b><small>etkileşim taşıyıcıları</small></header>
                {PARTICLES.filter((item) => item.group === "boson").map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${selectedParticle === item.id ? "selected" : ""} ${observedSet.has(item.id) ? "observed" : ""}`}
                    onClick={() => setSelectedParticle(item.id)}
                    aria-pressed={selectedParticle === item.id}
                  >
                    <strong>{item.symbol}</strong><span>{item.name}</span><small>bozon</small>
                  </button>
                ))}
              </section>
              <section className="higgs">
                <header><b>HIGGS ALANI</b><small>Higgs bozonu</small></header>
                {PARTICLES.filter((item) => item.group === "higgs").map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${selectedParticle === item.id ? "selected" : ""} ${observedSet.has(item.id) ? "observed" : ""}`}
                    onClick={() => setSelectedParticle(item.id)}
                    aria-pressed={selectedParticle === item.id}
                  >
                    <strong>{item.symbol}</strong><span>{item.name}</span><small>skaler bozon</small>
                  </button>
                ))}
              </section>
            </div>

            <aside className={`cern-particle-detail ${particle.group}`}>
              <span>SEÇİLEN PARÇACIK</span>
              <div><strong>{particle.symbol}</strong><h3>{particle.name}</h3></div>
              <dl>
                <div><dt>Aile</dt><dd>{particle.group === "quark" ? "Kuark" : particle.group === "lepton" ? "Lepton" : particle.group === "boson" ? "Taşıyıcı bozon" : "Higgs bozonu"}</dd></div>
                <div><dt>Elektrik yükü</dt><dd>{particle.charge}</dd></div>
                <div><dt>Nesil</dt><dd>{particle.generation ? `${particle.generation}. nesil` : "—"}</dd></div>
              </dl>
              <p>{particle.observation}</p>
              <small>{observedSet.has(particle.id) ? "Bu parçacık çalıştırılan olaylardan biriyle ilişkilendirildi." : "Farklı olayları çalıştırarak bu parçacığın dedektör kanıtını ara."}</small>
            </aside>
          </div>
        </div>
      )}

      {setupComplete && (
        <div className="cern-data-card">
          <div className="cern-section-heading">
            <span>İDEAL OLAY KAYITLARI</span>
            <h2>Çarpışma günlüğü</h2>
            <p>Her olayda çarpışma enerjisini, kısa ömürlü ara parçacıkları ve dedektörde kalan kanıtı karşılaştır.</p>
          </div>
          <div className="cern-table-wrap">
            <table>
              <thead><tr><th>#</th><th>√s</th><th>Olay</th><th>Tepkime</th><th>İlişkili parçacıklar</th><th>Dedektör kanıtı</th></tr></thead>
              <tbody>
                {readings.length ? readings.map((reading, index) => (
                  <tr key={reading.id}>
                    <td>{index + 1}</td>
                    <td>{format(reading.energy)} TeV</td>
                    <td><b>{reading.event}</b></td>
                    <td>{reading.reaction}</td>
                    <td>{reading.particles}</td>
                    <td>{reading.evidence}</td>
                  </tr>
                )) : <tr><td colSpan={6}>İlk proton–proton çarpışmasını çalıştır.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {setupComplete && (
        <div className="cern-report">
          <div className="cern-section-heading">
            <span>TYMM · DENEY RAPORU</span>
            <h2>Düzenekten kanıta, kanıttan modele</h2>
            <p>Yanıtlarını kendi kurduğun hızlandırıcı zinciri ve olay görüntülerine dayandır.</p>
          </div>
          <div>
            {[
              "Linac4, PSB, PS ve SPS neden tek bir hızlandırıcı yerine art arda kullanılıyor?",
              "RF elektrik alanları ile mıknatısların proton demeti üzerindeki görevlerini karşılaştır.",
              "Elektron, foton, jet ve müon ATLAS'ın hangi katmanlarında farklı kanıtlar bırakıyor?",
              "Nötrino, W, Z, üst kuark ve Higgs gibi parçacıkların varlığı hangi dolaylı kanıtlardan çıkarılıyor?",
            ].map((question, index) => (
              <label key={question}>
                <span><b>{index + 1}</b>{question}</span>
                <textarea
                  value={answers[index]}
                  onChange={(eventObject) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? eventObject.target.value : answer))}
                  placeholder="Düzenek ve olay görüntüsünden kanıt göstererek yaz..."
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="cern-sources">
        <span>MODELİN BİLİMSEL DAYANAKLARI</span>
        <a href="https://home.cern/science/accelerators/large-hadron-collider" target="_blank" rel="noreferrer">CERN · Large Hadron Collider</a>
        <a href="https://home.cern/science/accelerators/proton-synchrotron-booster" target="_blank" rel="noreferrer">CERN · Proton Synchrotron Booster</a>
        <a href="https://home.cern/science/physics/standard-model" target="_blank" rel="noreferrer">CERN · Standard Model</a>
        <a href="https://opendata.atlas.cern/docs/documentation/introduction/introduction_ATLAS/" target="_blank" rel="noreferrer">ATLAS Open Data · Detector layers</a>
      </div>
    </section>
  );
}
