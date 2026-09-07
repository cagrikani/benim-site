"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type ElementKind = "plane" | "concave" | "convex" | "converging" | "diverging";
type ExperimentMode = "ray" | "image";
type EquipmentKind = "rail" | "source" | "holder" | "element" | "screen";
type DragKind = "source" | "element" | "screen";

type ImageResult = {
  distance: number;
  position: number;
  magnification: number;
  real: boolean;
  description: string;
};

type Reading = {
  id: number;
  element: string;
  mode: string;
  sourceDistance: string;
  result: string;
};

const MIME = "application/x-unified-optics-equipment";
const BENCH_ASSET = "./ohm-lab-bench-real-v2.webp";
const RAIL_ASSET = "./optics-rail-real-v1.webp";
const LASER_ASSET = "./optics-unified-laser-real-v2.webp";
const HOLDER_ASSET = "./optics-universal-holder-real-v2.webp";
const PLANE_MIRROR_ASSET = "./optics-plane-mirror-insert-real-v2.webp";
const CONCAVE_MIRROR_ASSET = "./optics-concave-mirror-insert-real-v2.webp";
const CONVEX_MIRROR_ASSET = "./optics-convex-mirror-insert-real-v2.webp";
const CONVEX_LENS_ASSET = "./optics-convex-lens-cell-real-v1.webp";
const CONCAVE_LENS_ASSET = "./optics-concave-lens-cell-real-v1.webp";
const OBJECT_ASSET = "./optics-arrow-object-real-v1.webp";
const SCREEN_ASSET = "./optics-screen-real-v2.webp";

const ELEMENTS: Array<{
  kind: ElementKind;
  label: string;
  family: string;
  summary: string;
  asset: string;
}> = [
  { kind: "plane", label: "Düzlem ayna", family: "AYNA", summary: "Gelme açısı = yansıma açısı", asset: PLANE_MIRROR_ASSET },
  { kind: "concave", label: "Çukur ayna", family: "AYNA", summary: "Işınları odakta toplar", asset: CONCAVE_MIRROR_ASSET },
  { kind: "convex", label: "Tümsek ayna", family: "AYNA", summary: "Işınları dağıtır", asset: CONVEX_MIRROR_ASSET },
  { kind: "converging", label: "İnce kenarlı mercek", family: "MERCEK", summary: "Işınları odakta toplar", asset: CONVEX_LENS_ASSET },
  { kind: "diverging", label: "Kalın kenarlı mercek", family: "MERCEK", summary: "Işınları dağıtır", asset: CONCAVE_LENS_ASSET },
];

const EQUIPMENT: Array<{ kind: EquipmentKind; name: string; detail: string; asset: string }> = [
  { kind: "rail", name: "Cetvelli optik ray", detail: "Tüm parçaları aynı eksende tutar", asset: RAIL_ASSET },
  { kind: "source", name: "Işık kaynağı", detail: "Lazer veya ışıklı ok taşıyıcısı", asset: LASER_ASSET },
  { kind: "holder", name: "Üniversal taşıyıcı", detail: "Ayna ve merceklerin ortak ayağı", asset: HOLDER_ASSET },
  { kind: "element", name: "Seçtiğin optik eleman", detail: "Taşıyıcının boş yuvasına takılır", asset: PLANE_MIRROR_ASSET },
  { kind: "screen", name: "Beyaz görüntü ekranı", detail: "Gerçek görüntüyü yakalar", asset: SCREEN_ASSET },
];

const isMirror = (kind: ElementKind) => kind === "plane" || kind === "concave" || kind === "convex";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const toPercent = (position: number) => 8 + position * .84;

function calculateImage(
  kind: ElementKind,
  sourceX: number,
  elementX: number,
  focalLength: number,
): ImageResult {
  const objectDistance = Math.max(1, elementX - sourceX);

  if (kind === "plane") {
    return {
      distance: objectDistance,
      position: elementX + objectDistance,
      magnification: 1,
      real: false,
      description: "Sanal · düz · cisimle aynı boy",
    };
  }

  const signedFocal = kind === "concave" || kind === "converging" ? focalLength : -focalLength;
  const denominator = 1 / signedFocal - 1 / objectDistance;
  if (Math.abs(denominator) < .0001) {
    return {
      distance: Number.POSITIVE_INFINITY,
      position: Number.POSITIVE_INFINITY,
      magnification: 0,
      real: false,
      description: "Işınlar paralel · görüntü sonsuzda",
    };
  }

  const distance = 1 / denominator;
  const magnification = -distance / objectDistance;
  const lens = kind === "converging" || kind === "diverging";
  const position = lens ? elementX + distance : elementX - distance;
  const real = distance > 0;
  const size = Math.abs(magnification) > 1.05 ? "büyük" : Math.abs(magnification) < .95 ? "küçük" : "aynı boy";
  return {
    distance,
    position,
    magnification,
    real,
    description: `${real ? "Gerçek" : "Sanal"} · ${magnification < 0 ? "ters" : "düz"} · ${size}`,
  };
}

function UnifiedRayCanvas({
  mode,
  elementKind,
  sourceX,
  elementX,
  screenX,
  hitOffset,
  elementAngle,
  focalLength,
  lightOn,
  ready,
  screenPlaced,
  imageResult,
}: {
  mode: ExperimentMode;
  elementKind: ElementKind;
  sourceX: number;
  elementX: number;
  screenX: number;
  hitOffset: number;
  elementAngle: number;
  focalLength: number;
  lightOn: boolean;
  ready: boolean;
  screenPlaced: boolean;
  imageResult: ImageResult;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(980, rect.width);
    const height = Math.max(560, rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const axisY = 220;
    const toX = (position: number) => width * (.08 + position * .0084);
    const source = { x: toX(sourceX), y: axisY };
    const element = { x: toX(elementX), y: axisY };
    const screen = { x: toX(screenX), y: axisY };
    const left = width * .035;
    const right = width * .965;
    const top = 42;
    const bottom = 355;

    const line = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      color: string,
      dashed = false,
      widthValue = 3.4,
    ) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = widthValue;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = dashed ? 0 : 8;
      if (dashed) ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    };

    const arrow = (from: { x: number; y: number }, to: { x: number; y: number }, color: string) => {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const x = from.x + (to.x - from.x) * .62;
      const y = from.y + (to.y - from.y) * .62;
      ctx.save();
      ctx.fillStyle = color;
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-5, -5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const label = (text: string, x: number, y: number, color: string) => {
      ctx.save();
      ctx.font = "900 9px system-ui";
      const measure = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(247,251,249,.94)";
      ctx.strokeStyle = "rgba(30,60,67,.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x - measure / 2 - 7, y - 11, measure + 14, 19, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y - 1);
      ctx.restore();
    };

    const normalize = (vector: { x: number; y: number }) => {
      const length = Math.hypot(vector.x, vector.y) || 1;
      return { x: vector.x / length, y: vector.y / length };
    };

    const boundaryPoint = (start: { x: number; y: number }, direction: { x: number; y: number }) => {
      const candidates: number[] = [];
      if (direction.x > .0001) candidates.push((right - start.x) / direction.x);
      if (direction.x < -.0001) candidates.push((left - start.x) / direction.x);
      if (direction.y > .0001) candidates.push((bottom - start.y) / direction.y);
      if (direction.y < -.0001) candidates.push((top - start.y) / direction.y);
      const distance = Math.min(...candidates.filter((value) => value > 0));
      return { x: start.x + direction.x * distance, y: start.y + direction.y * distance };
    };

    ctx.save();
    ctx.strokeStyle = "rgba(39,75,82,.5)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(left, axisY);
    ctx.lineTo(right, axisY);
    ctx.stroke();
    ctx.fillStyle = "rgba(37,73,81,.72)";
    ctx.font = "900 8px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("ASAL EKSEN", width * .5, axisY + 17);
    ctx.restore();

    if (!ready) return;

    if (elementKind !== "plane") {
      const leftFocus = toX(elementX - focalLength);
      const rightFocus = toX(elementX + focalLength);
      [leftFocus, rightFocus].forEach((x, index) => {
        ctx.save();
        ctx.fillStyle = "#d9783d";
        ctx.beginPath();
        ctx.arc(x, axisY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "950 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("F", x, axisY + 31 + index * 0);
        ctx.restore();
      });
    }

    if (!lightOn) return;

    if (mode === "ray") {
      const hit = { x: element.x, y: axisY + hitOffset };
      const incoming = normalize({ x: hit.x - source.x, y: hit.y - source.y });
      line(source, hit, "#ff3e35", false, 4.2);
      arrow(source, hit, "#ff3e35");
      label("GELEN IŞIN", (source.x + hit.x) / 2, (source.y + hit.y) / 2 - 17, "#b82d27");

      if (isMirror(elementKind)) {
        const curve = elementKind === "concave" ? hitOffset * .12 : elementKind === "convex" ? -hitOffset * .12 : 0;
        const normalAngle = Math.PI + (elementAngle + curve) * Math.PI / 180;
        const normal = { x: Math.cos(normalAngle), y: Math.sin(normalAngle) };
        const dot = incoming.x * normal.x + incoming.y * normal.y;
        const reflected = normalize({ x: incoming.x - 2 * dot * normal.x, y: incoming.y - 2 * dot * normal.y });
        const end = boundaryPoint(hit, reflected);
        const normalStart = { x: hit.x - normal.x * 82, y: hit.y - normal.y * 82 };
        const normalEnd = { x: hit.x + normal.x * 82, y: hit.y + normal.y * 82 };
        line(normalStart, normalEnd, "rgba(32,69,77,.74)", true, 1.6);
        line(hit, end, "#18abc1", false, 4.2);
        arrow(hit, end, "#18abc1");
        const angle = Math.round(Math.acos(clamp(Math.abs(dot), 0, 1)) * 180 / Math.PI);
        label("YANSIYAN IŞIN", (hit.x + end.x) / 2, (hit.y + end.y) / 2 - 17, "#087b8d");
        label(`i = ${angle}°`, hit.x - incoming.x * 94, hit.y - incoming.y * 94 - 19, "#b82d27");
        label(`r = ${angle}°`, hit.x + reflected.x * 94, hit.y + reflected.y * 94 + (reflected.y < 0 ? -13 : 13), "#087b8d");
        label("NORMAL", normalStart.x, normalStart.y - 13, "#34565e");
      } else {
        const focalPixels = Math.abs(toX(elementX + focalLength) - element.x);
        const incomingSlope = (hit.y - source.y) / Math.max(1, hit.x - source.x);
        const heightFromAxis = hit.y - axisY;
        const outgoingSlope = elementKind === "converging"
          ? incomingSlope - heightFromAxis / focalPixels
          : incomingSlope + heightFromAxis / focalPixels;
        const refracted = normalize({ x: 1, y: outgoingSlope });
        const end = boundaryPoint(hit, refracted);
        line(hit, end, "#20b884", false, 4.2);
        arrow(hit, end, "#20b884");
        label("KIRILAN IŞIN", (hit.x + end.x) / 2, (hit.y + end.y) / 2 - 17, "#117c5c");
        if (elementKind === "diverging") {
          const virtual = boundaryPoint(hit, normalize({ x: -refracted.x, y: -refracted.y }));
          line(hit, virtual, "rgba(32,184,132,.58)", true, 1.7);
        }
      }
      return;
    }

    const objectTip = { x: source.x, y: axisY - 58 };
    const imageTip = {
      x: toX(imageResult.position),
      y: axisY - imageResult.magnification * 58,
    };

    if (elementKind === "plane") {
      const hits = [axisY - 38, axisY + 12];
      hits.forEach((hitY, index) => {
        const hit = { x: element.x, y: hitY };
        const incoming = normalize({ x: hit.x - objectTip.x, y: hit.y - objectTip.y });
        const reflected = normalize({ x: -incoming.x, y: incoming.y });
        const end = boundaryPoint(hit, reflected);
        line(objectTip, hit, index ? "#ff7656" : "#ff3e35", false, 3.2);
        line(hit, end, "#18abc1", false, 3.2);
        line(hit, imageTip, "rgba(24,171,193,.55)", true, 1.7);
      });
    } else if (elementKind === "converging" || elementKind === "diverging") {
      const parallelHit = { x: element.x, y: objectTip.y };
      const focusX = toX(elementKind === "converging" ? elementX + focalLength : elementX - focalLength);
      const direction = normalize({ x: elementKind === "converging" ? focusX - parallelHit.x : parallelHit.x - focusX, y: axisY - parallelHit.y });
      const end = boundaryPoint(parallelHit, direction);
      line(objectTip, parallelHit, "#ff3e35", false, 3.2);
      line(parallelHit, end, "#20b884", false, 3.2);
      const centerDirection = normalize({ x: element.x - objectTip.x, y: axisY - objectTip.y });
      const centerEnd = boundaryPoint({ x: element.x, y: axisY }, centerDirection);
      line(objectTip, { x: element.x, y: axisY }, "#ef8c36", false, 3.2);
      line({ x: element.x, y: axisY }, centerEnd, "#ef8c36", false, 3.2);
      if (!imageResult.real) {
        line(parallelHit, imageTip, "rgba(32,184,132,.55)", true, 1.7);
        line({ x: element.x, y: axisY }, imageTip, "rgba(239,140,54,.55)", true, 1.7);
      }
    } else {
      const parallelHit = { x: element.x, y: objectTip.y };
      const focusX = toX(elementKind === "concave" ? elementX - focalLength : elementX + focalLength);
      const direction = normalize({ x: focusX - parallelHit.x, y: axisY - parallelHit.y });
      const outgoing = elementKind === "concave" ? direction : normalize({ x: -direction.x, y: -direction.y });
      const end = boundaryPoint(parallelHit, outgoing);
      line(objectTip, parallelHit, "#ff3e35", false, 3.2);
      line(parallelHit, end, "#18abc1", false, 3.2);
      const vertex = { x: element.x, y: axisY };
      const incoming = normalize({ x: vertex.x - objectTip.x, y: vertex.y - objectTip.y });
      const reflected = normalize({ x: -incoming.x, y: incoming.y });
      line(objectTip, vertex, "#ef8c36", false, 3.2);
      line(vertex, boundaryPoint(vertex, reflected), "#ef8c36", false, 3.2);
      if (!imageResult.real) {
        line(parallelHit, imageTip, "rgba(24,171,193,.55)", true, 1.7);
        line(vertex, imageTip, "rgba(239,140,54,.55)", true, 1.7);
      }
    }

    if (Number.isFinite(imageResult.position) && imageResult.position >= 0 && imageResult.position <= 100) {
      const cappedY = clamp(imageTip.y, 62, 340);
      ctx.save();
      ctx.strokeStyle = imageResult.real ? "#315fa7" : "rgba(49,95,167,.72)";
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 5;
      if (!imageResult.real) ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(imageTip.x, axisY);
      ctx.lineTo(imageTip.x, cappedY);
      ctx.stroke();
      const sign = cappedY < axisY ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(imageTip.x, cappedY);
      ctx.lineTo(imageTip.x - 8, cappedY + 13 * sign);
      ctx.lineTo(imageTip.x + 8, cappedY + 13 * sign);
      ctx.closePath();
      ctx.fill();
      label(imageResult.real ? "GERÇEK GÖRÜNTÜ" : "SANAL GÖRÜNTÜ", imageTip.x, cappedY < axisY ? cappedY - 18 : cappedY + 24, "#315fa7");
      ctx.restore();
    }

    if (screenPlaced && imageResult.real && Number.isFinite(imageResult.position)) {
      line({ x: screen.x, y: axisY - 74 }, { x: screen.x, y: axisY + 74 }, "rgba(41,169,137,.72)", true, 1.5);
    }
  }, [elementAngle, elementKind, elementX, focalLength, hitOffset, imageResult, lightOn, mode, ready, screenPlaced, screenX, sourceX]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return <canvas ref={canvasRef} className="uol-ray-canvas" aria-label="Gelen, yansıyan veya kırılan ışının belirgin yolu" />;
}

export default function UnifiedOpticsLab() {
  const [selectedElement, setSelectedElement] = useState<ElementKind>("plane");
  const [placed, setPlaced] = useState<EquipmentKind[]>([]);
  const [mode, setMode] = useState<ExperimentMode>("ray");
  const [sourceX, setSourceX] = useState(16);
  const [elementX, setElementX] = useState(60);
  const [screenX, setScreenX] = useState(84);
  const [elementAngle, setElementAngle] = useState(0);
  const [hitOffset, setHitOffset] = useState(-28);
  const [focalLength, setFocalLength] = useState(14);
  const [lightOn, setLightOn] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [report, setReport] = useState({ path: "", image: "", compare: "" });
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragKind | null>(null);

  const selected = ELEMENTS.find(({ kind }) => kind === selectedElement) ?? ELEMENTS[0];
  const nextEquipment = EQUIPMENT[placed.length]?.kind;
  const ready = ["rail", "source", "holder", "element"].every((kind) => placed.includes(kind as EquipmentKind));
  const screenPlaced = placed.includes("screen");
  const imageResult = calculateImage(selectedElement, sourceX, elementX, focalLength);
  const imageOnRail = Number.isFinite(imageResult.position) && imageResult.position >= 0 && imageResult.position <= 100;
  const projectable = mode === "image" && lightOn && imageResult.real && imageOnRail && screenPlaced;
  const screenDistance = projectable ? Math.abs(screenX - imageResult.position) : Number.POSITIVE_INFINITY;
  const focusQuality = projectable ? clamp(Math.round(100 - screenDistance * 24), 0, 100) : 0;
  const screenSharp = focusQuality >= 90;
  const angleScale = Math.max(.42, 1 - Math.abs(elementAngle) / 48);
  const objectDistance = elementX - sourceX;

  const stageMessage = !ready
    ? `Sıradaki parça: ${EQUIPMENT[placed.length]?.name ?? "Düzenek hazır"}`
    : !lightOn
      ? "Işık kaynağını aç; ışının çıkış ve yüzeye çarpma noktalarını izle."
      : mode === "ray"
        ? isMirror(selectedElement)
          ? "Kırmızı gelen ışın, turkuaz yansıyan ışın; kesikli çizgi yüzey normalidir."
          : "Kırmızı gelen ışın, yeşil kırılan ışın; ışın mercek yüzeyinde yön değiştirir."
        : screenSharp
          ? "Gerçek görüntü beyaz ekranda net olarak yakalandı."
          : imageResult.real
            ? `Ekranı ${imageResult.position.toFixed(1)} cm konumuna taşı.`
            : "Bu görüntü sanaldır; beyaz ekrana düşürülemez.";

  const placeEquipment = (kind: EquipmentKind) => {
    const placedIndex = placed.indexOf(kind);
    if (placedIndex >= 0) {
      setPlaced((items) => items.slice(0, placedIndex));
      setLightOn(false);
      return;
    }
    if (kind !== nextEquipment) return;
    setPlaced((items) => [...items, kind]);
  };

  const onDragStart = (event: ReactDragEvent<HTMLButtonElement>, kind: EquipmentKind) => {
    event.dataTransfer.setData(MIME, kind);
    event.dataTransfer.effectAllowed = "move";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    placeEquipment(event.dataTransfer.getData(MIME) as EquipmentKind);
  };

  const moveFromPointer = useCallback((clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    const kind = dragRef.current;
    if (!rect || !kind) return;
    const raw = clamp(((clientX - rect.left - rect.width * .08) / (rect.width * .84)) * 100, 0, 100);
    if (kind === "source") setSourceX(clamp(Math.round(raw), 5, elementX - 14));
    if (kind === "element") setElementX(clamp(Math.round(raw), sourceX + 14, 90));
    if (kind === "screen") setScreenX(clamp(Math.round(raw * 2) / 2, 5, 95));
  }, [elementX, sourceX]);

  useEffect(() => {
    const move = (event: PointerEvent) => moveFromPointer(event.clientX);
    const end = () => { dragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }, [moveFromPointer]);

  const beginMove = (event: ReactPointerEvent, kind: DragKind) => {
    event.preventDefault();
    dragRef.current = kind;
    moveFromPointer(event.clientX);
  };

  const chooseElement = (kind: ElementKind) => {
    setSelectedElement(kind);
    setElementAngle(0);
    setLightOn(false);
    const nextImage = calculateImage(kind, sourceX, elementX, focalLength);
    if (nextImage.real && Number.isFinite(nextImage.position)) setScreenX(clamp(Math.round(nextImage.position * 2) / 2, 5, 95));
  };

  const changeMode = (nextMode: ExperimentMode) => {
    setMode(nextMode);
    setLightOn(false);
    setElementAngle(0);
    if (nextMode === "image" && imageResult.real && Number.isFinite(imageResult.position)) {
      setScreenX(clamp(Math.round(imageResult.position * 2) / 2, 5, 95));
    }
  };

  const record = () => {
    if (!ready || !lightOn) return;
    setReadings((items) => [...items, {
      id: Date.now(),
      element: selected.label,
      mode: mode === "ray" ? "Işın yolu" : "Görüntü",
      sourceDistance: `${objectDistance.toFixed(1)} cm`,
      result: mode === "ray" ? stageMessage : imageResult.description,
    }].slice(-8));
  };

  const reset = () => {
    setPlaced([]);
    setSelectedElement("plane");
    setMode("ray");
    setSourceX(16);
    setElementX(60);
    setScreenX(84);
    setElementAngle(0);
    setHitOffset(-28);
    setFocalLength(14);
    setLightOn(false);
    setReadings([]);
  };

  return (
    <section className="uol-lab" aria-labelledby="uol-title">
      <header className="uol-hero">
        <div>
          <span>OPTİK DENEY SETİ · AYNALAR VE MERCEKLER</span>
          <h1 id="uol-title">Tek masa, beş optik eleman.</h1>
          <p>Boş raydan başla. Işık kaynağını ve taşıyıcıyı kur; istediğin aynayı veya merceği aynı sisteme tak. Işığın nereden çıktığını, yüzeye nerede çarptığını ve hangi yöne gittiğini doğrudan izle.</p>
        </div>
        <aside><small>TYMM · LİSE OPTİK</small><b>Kur · değiştir · gözle · kanıtla</b><span>İdeal ışınlar ve kesin ölçümler</span></aside>
      </header>

      <section className="uol-element-picker" aria-label="Optik eleman seçimi">
        <div><span>1 · OPTİK ELEMANINI SEÇ</span><h2>Aynı taşıyıcıya istediğini tak.</h2></div>
        <div className="uol-element-grid">
          {ELEMENTS.map((item) => (
            <button type="button" key={item.kind} className={selectedElement === item.kind ? "active" : ""} onClick={() => chooseElement(item.kind)}>
              <img src={item.asset} alt="" draggable="false" />
              <span><small>{item.family}</small><b>{item.label}</b><em>{item.summary}</em></span>
              <strong>{selectedElement === item.kind ? "TAKILACAK" : "SEÇ"}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="uol-workspace">
        <aside className="uol-tray">
          <div className="uol-panel-heading"><span>2 · DÜZENEĞİ KUR</span><h2>Malzeme tepsisi</h2><p>Sıradaki parçayı sürükleyip masaya bırak veya dokunarak ekle. Kurulu parçaya yeniden basarsan onu çıkarırsın.</p></div>
          <div className="uol-equipment-list">
            {EQUIPMENT.map((item, index) => {
              const isPlaced = placed.includes(item.kind);
              const isNext = item.kind === nextEquipment;
              const shownAsset = item.kind === "element" ? selected.asset : mode === "image" && item.kind === "source" ? OBJECT_ASSET : item.asset;
              return (
                <button
                  type="button"
                  key={item.kind}
                  className={`${isPlaced ? "placed" : ""} ${isNext ? "next" : ""}`}
                  draggable={!isPlaced && isNext}
                  disabled={!isPlaced && !isNext}
                  onDragStart={(event) => onDragStart(event, item.kind)}
                  onClick={() => placeEquipment(item.kind)}
                >
                  <span className="uol-equipment-photo"><img src={shownAsset} alt="" draggable="false" /></span>
                  <span><small>{String(index + 1).padStart(2, "0")}</small><b>{item.kind === "element" ? selected.label : item.name}</b><em>{isPlaced ? "Masada · çıkarmak için dokun" : item.detail}</em></span>
                  <strong>{isPlaced ? "Çıkar" : isNext ? "Ekle" : "Kilitli"}</strong>
                </button>
              );
            })}
          </div>
          <button className="uol-reset" type="button" onClick={reset}>Düzeneği baştan kur</button>
          <div className="uol-safety"><b>LAZER GÜVENLİĞİ</b><span>Işını göze yöneltme; yalnız optik eleman üzerinde çalış.</span></div>
        </aside>

        <div className="uol-stage-column">
          <div className="uol-stage-toolbar">
            <div><small>3 · ORTAK OPTİK MASA</small><b>{selected.label} · {mode === "ray" ? "tek ışın deneyi" : "görüntü oluşumu"}</b></div>
            <span className={lightOn ? "live" : ""}><i />{lightOn ? "Işık açık" : "Işık kapalı"}</span>
          </div>

          <div ref={stageRef} className={`uol-stage ${ready ? "ready" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={onStageDrop}>
            <img className="uol-bench-photo" src={BENCH_ASSET} alt="" draggable="false" />
            <UnifiedRayCanvas
              mode={mode}
              elementKind={selectedElement}
              sourceX={sourceX}
              elementX={elementX}
              screenX={screenX}
              hitOffset={hitOffset}
              elementAngle={elementAngle}
              focalLength={focalLength}
              lightOn={lightOn}
              ready={ready}
              screenPlaced={screenPlaced}
              imageResult={imageResult}
            />

            {placed.includes("rail") && <div className="uol-rail"><img src={RAIL_ASSET} alt="Cetvelli gerçek optik ray" draggable="false" /><div>{[0,10,20,30,40,50,60,70,80,90,100].map((value) => <span key={value}>{value}</span>)}</div></div>}

            {placed.includes("source") && mode === "ray" && (
              <button type="button" className={`uol-source uol-laser ${lightOn ? "on" : ""}`} style={{ "--source-left": `${toPercent(sourceX)}%` } as CSSProperties} onPointerDown={(event) => beginMove(event, "source")} aria-label={`Lazer ${sourceX} santimetrede; rayda sürükle`}>
                <img src={LASER_ASSET} alt="Yatay ışın veren gerçekçi lazer kaynağı" draggable="false" />
                <i className="uol-aperture" /><b>LAZER · {sourceX} cm</b>
              </button>
            )}

            {placed.includes("source") && mode === "image" && (
              <button type="button" className={`uol-source uol-object ${lightOn ? "on" : ""}`} style={{ "--source-left": `${toPercent(sourceX)}%` } as CSSProperties} onPointerDown={(event) => beginMove(event, "source")} aria-label={`Işıklı ok cismi ${sourceX} santimetrede; rayda sürükle`}>
                <img src={OBJECT_ASSET} alt="Işıklı ok cismi" draggable="false" />
                <i className="uol-aperture" /><b>CİSİM · {sourceX} cm</b>
              </button>
            )}

            {placed.includes("holder") && (
              <button type="button" className="uol-holder" style={{ "--element-left": `${toPercent(elementX)}%`, "--element-angle": `${elementAngle}deg`, "--element-scale": angleScale } as CSSProperties} onPointerDown={(event) => beginMove(event, "element")} aria-label={`Üniversal taşıyıcı ${elementX} santimetrede; rayda sürükle`}>
                {placed.includes("element") && <img className={`uol-insert ${selectedElement}`} src={selected.asset} alt={selected.label} draggable="false" />}
                <img className="uol-holder-photo" src={HOLDER_ASSET} alt="Üniversal optik eleman taşıyıcısı" draggable="false" />
                {placed.includes("element") && mode === "ray" && <span className="uol-hit-target" style={{ "--hit-offset": `${hitOffset}px` } as CSSProperties}><i />ÇARPMA NOKTASI</span>}
                <b>{placed.includes("element") ? selected.label.toLocaleUpperCase("tr-TR") : "BOŞ TAŞIYICI"} · {elementX} cm</b>
              </button>
            )}

            {screenPlaced && (
              <button type="button" className={`uol-screen ${screenSharp ? "sharp" : ""} ${screenX > 76 ? "info-left" : ""}`} style={{ "--screen-left": `${toPercent(screenX)}%`, "--focus": `${focusQuality}%` } as CSSProperties} onPointerDown={(event) => beginMove(event, "screen")} aria-label={`Beyaz ekran ${screenX} santimetrede; rayda sürükle`}>
                <img src={SCREEN_ASSET} alt="Beyaz görüntü ekranı" draggable="false" />
                <span className="uol-screen-face">
                  {projectable && <i className="uol-screen-image" style={{ "--image-size": `${clamp(Math.abs(imageResult.magnification) * 46, 16, 82)}px`, "--image-blur": `${clamp(screenDistance * .9, 0, 7)}px` } as CSSProperties} />}
                  {mode === "image" && lightOn && !projectable && <em>×</em>}
                </span>
                {mode === "image" && <span className="uol-screen-readout"><small>EKRAN</small><b>{screenSharp ? "NET GÖRÜNTÜ" : projectable ? `Netlik %${focusQuality}` : lightOn ? "Görüntü düşmez" : "Hazır"}</b><i><span /></i></span>}
                <strong>EKRAN · {screenX.toFixed(1)} cm</strong>
              </button>
            )}

            {!ready && <div className="uol-drop-guide"><img src={EQUIPMENT[placed.length]?.asset ?? RAIL_ASSET} alt="" /><span><small>SIRADAKİ PARÇA</small><b>{EQUIPMENT[placed.length]?.name ?? "Düzenek hazır"}</b><em>Buraya sürükle veya tepsiden dokun</em></span></div>}

            <div className="uol-stage-status"><b>{lightOn ? mode === "ray" ? "IŞIN YOLU" : "GÖRÜNTÜ" : ready ? "DÜZENEK HAZIR" : "KURULUM"}</b><span>{stageMessage}</span></div>
          </div>

          <section className={`uol-controls ${ready ? "enabled" : ""}`}>
            <div className="uol-control-heading"><div><span>4 · DENEYİ YÖNET</span><h2>Aynı düzeneğin iki çalışma biçimi</h2></div><p>Parçaları sahnede sürükleyebilir veya aşağıdaki cetvellerle tam konum verebilirsin.</p></div>
            <div className="uol-mode-switch">
              <button type="button" className={mode === "ray" ? "active" : ""} onClick={() => changeMode("ray")} disabled={!ready}><span>01</span><b>Tek ışının yolu</b><small>Çıkış · çarpma · yansıma veya kırılma</small></button>
              <button type="button" className={mode === "image" ? "active" : ""} onClick={() => changeMode("image")} disabled={!ready}><span>02</span><b>Görüntü oluşumu</b><small>Cisim · özel ışınlar · gerçek veya sanal görüntü</small></button>
            </div>
            <div className="uol-control-grid">
              <label><span>Işık kaynağı <b>{sourceX} cm</b></span><input type="range" min="5" max={elementX - 14} step="1" value={sourceX} onInput={(event) => setSourceX(Number(event.currentTarget.value))} disabled={!ready} /><small>Lazeri veya ışıklı cismi rayda taşır.</small></label>
              <label><span>Optik eleman <b>{elementX} cm</b></span><input type="range" min={sourceX + 14} max="90" step="1" value={elementX} onInput={(event) => setElementX(Number(event.currentTarget.value))} disabled={!ready} /><small>Taşıyıcı ayağı ray üzerinde hareket eder.</small></label>
              {mode === "ray" ? <label><span>Yüzeydeki hedef <b>{hitOffset} px</b></span><input type="range" min="-52" max="52" step="4" value={hitOffset} onInput={(event) => setHitOffset(Number(event.currentTarget.value))} disabled={!ready} /><small>Işının aynaya veya merceğe çarpma yerini değiştirir.</small></label> : <label><span>Ekran konumu <b>{screenX.toFixed(1)} cm</b></span><input type="range" min="5" max="95" step=".5" value={screenX} onInput={(event) => setScreenX(Number(event.currentTarget.value))} disabled={!ready || !screenPlaced} /><small>Gerçek görüntüyü bulmak için ekranı rayda taşı.</small></label>}
              {isMirror(selectedElement) ? <label><span>Ayna yönü <b>{elementAngle}°</b></span><input type="range" min="-30" max="30" step="5" value={elementAngle} onInput={(event) => setElementAngle(Number(event.currentTarget.value))} disabled={!ready || mode === "image"} /><small>{mode === "image" ? "Görüntü deneyinde ayna asal eksene dik tutulur." : "Yalnız ayna hücresi döner; taşıyıcı ayağı sabit kalır."}</small></label> : <label><span>Odak uzaklığı <b>{focalLength} cm</b></span><input type="range" min="10" max="20" step="2" value={focalLength} onInput={(event) => setFocalLength(Number(event.currentTarget.value))} disabled={!ready} /><small>F işaretleri ve ışınların yönü birlikte değişir.</small></label>}
            </div>
            <div className="uol-live-panel">
              <div><small>CANLI GÖZLEM</small><b>{mode === "ray" ? selected.summary : imageResult.description}</b><span>{mode === "ray" ? isMirror(selectedElement) ? "Gelen ışın · normal · yansıyan ışın" : "Gelen ışın · mercek · kırılan ışın" : `Cisim uzaklığı ${objectDistance.toFixed(1)} cm${Number.isFinite(imageResult.distance) ? ` · görüntü uzaklığı ${Math.abs(imageResult.distance).toFixed(1)} cm` : ""}`}</span></div>
              <button type="button" className={lightOn ? "stop" : "start"} onClick={() => setLightOn((value) => !value)} disabled={!ready}>{lightOn ? "Işığı kapat" : "Işığı aç"}</button>
              <button type="button" onClick={record} disabled={!lightOn}>Gözlemi kaydet</button>
            </div>
          </section>
        </div>
      </div>

      <section className="uol-evidence">
        <div className="uol-evidence-heading"><span>5 · KARŞILAŞTIR VE KAYDET</span><h2>Eleman değişti, ışığın davranışı nasıl değişti?</h2><p>Tek bir düzenekte farklı optik elemanlarla yaptığın ideal gözlemleri karşılaştır.</p></div>
        <div className="uol-concept-grid">
          <article><img src={PLANE_MIRROR_ASSET} alt="" /><div><span>YANSIMA</span><b>Ayna yüzeyinde</b><p>Gelen ışın, normal ve yansıyan ışın aynı düzlemdedir; gelme ve yansıma açıları eşittir.</p></div></article>
          <article><img src={CONVEX_LENS_ASSET} alt="" /><div><span>KIRILMA</span><b>Mercek içinde</b><p>Işın iki yüzeyde yön değiştirir; ince kenarlı mercek toplar, kalın kenarlı mercek dağıtır.</p></div></article>
          <article><img src={SCREEN_ASSET} alt="" /><div><span>GÖRÜNTÜ</span><b>Ekran kanıtı</b><p>Gerçek görüntü ekranda yakalanır. Sanal görüntü ışınların uzantılarının kesiştiği yerde görülür.</p></div></article>
        </div>
        <div className="uol-data-card">
          <div><div><span>İDEAL GÖZLEM KAYITLARI</span><b>Son sekiz deney durumu</b></div><button type="button" onClick={() => setReadings([])} disabled={readings.length === 0}>Kayıtları temizle</button></div>
          <div className="uol-table-wrap"><table><thead><tr><th>Optik eleman</th><th>Deney</th><th>Kaynak uzaklığı</th><th>Gözlem</th></tr></thead><tbody>{readings.length === 0 ? <tr><td colSpan={4}>Düzeneği kur, ışığı aç ve ilk gözlemini kaydet.</td></tr> : readings.map((reading) => <tr key={reading.id}><td>{reading.element}</td><td>{reading.mode}</td><td>{reading.sourceDistance}</td><td>{reading.result}</td></tr>)}</tbody></table></div>
        </div>
      </section>

      <section className="uol-report">
        <div><span>6 · TYMM KISA DENEY RAPORU</span><h2>Gördüğünü düzenek üzerinden açıkla.</h2></div>
        <div className="uol-report-grid">
          <label><b>Işının çıkış, çarpma ve yansıma/kırılma yolunu nasıl kanıtlarsın?</b><textarea value={report.path} onChange={(event) => setReport({ ...report, path: event.target.value })} placeholder="Renkli ışınları ve yüzey normalini kullan…" /></label>
          <label><b>Hangi optik elemanlarda gerçek görüntüyü ekranda yakalayabildin?</b><textarea value={report.image} onChange={(event) => setReport({ ...report, image: event.target.value })} placeholder="Cisim, eleman ve ekran konumlarını karşılaştır…" /></label>
          <label><b>Toplayıcı ve dağıtıcı optik elemanların ışınlara etkisini karşılaştır.</b><textarea value={report.compare} onChange={(event) => setReport({ ...report, compare: event.target.value })} placeholder="Çukur ayna/ince mercek ile tümsek ayna/kalın merceği karşılaştır…" /></label>
        </div>
        <div className="uol-ideal-note"><b>İDEAL SİSTEM</b><span>Yüzeyler kusursuz, ışınlar tek renkli ve bütün ölçümler tam değerlerle gösterilir.</span></div>
      </section>
    </section>
  );
}
