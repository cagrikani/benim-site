"use client";

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  useEffect,
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
type LightColorKind = "red" | "green" | "blue";
type RunState = "ready" | "running" | "complete";

type OpticsRecord = {
  id: number;
  mode: ExperimentMode;
  color: LightColorKind;
  colorLabel: string;
  colorHex: string;
  wavelength: number;
  incidence: number;
  refraction: number;
  deviation: number;
  displacement: number;
  refractiveIndex: number;
  internalAngle: number;
  totalReflection: boolean;
};

const SLAB_THICKNESS_CM = 1.5;
const PRISM_APEX_ANGLE = 60;
const MIME = "application/x-optics-equipment";
const LIGHT_COLORS: Record<
  LightColorKind,
  {
    label: string;
    wavelength: number;
    refractiveIndex: number;
    hex: string;
    glow: string;
  }
> = {
  red: {
    label: "Kırmızı",
    wavelength: 656.3,
    refractiveIndex: 1.51432,
    hex: "#ff3d32",
    glow: "rgba(255, 61, 50, 0.68)",
  },
  green: {
    label: "Yeşil",
    wavelength: 546.1,
    refractiveIndex: 1.51872,
    hex: "#36d878",
    glow: "rgba(54, 216, 120, 0.68)",
  },
  blue: {
    label: "Mavi",
    wavelength: 486.1,
    refractiveIndex: 1.52238,
    hex: "#3f7cff",
    glow: "rgba(63, 124, 255, 0.7)",
  },
};
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
    shortName: "Cam blok",
    name: "1,50 cm kalınlıklı paralel yüzlü cam blok",
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

type RayPoint = { x: number; y: number };
type SurfaceContact = {
  point: RayPoint;
  normal: RayPoint;
  label: string;
  labelOffset: number;
};

function addPoint(first: RayPoint, second: RayPoint) {
  return { x: first.x + second.x, y: first.y + second.y };
}

function subtractPoint(first: RayPoint, second: RayPoint) {
  return { x: first.x - second.x, y: first.y - second.y };
}

function scalePoint(point: RayPoint, amount: number) {
  return { x: point.x * amount, y: point.y * amount };
}

function dotPoint(first: RayPoint, second: RayPoint) {
  return first.x * second.x + first.y * second.y;
}

function crossPoint(first: RayPoint, second: RayPoint) {
  return first.x * second.y - first.y * second.x;
}

function normalizePoint(point: RayPoint) {
  const length = Math.hypot(point.x, point.y);
  return length === 0
    ? { x: 0, y: 0 }
    : { x: point.x / length, y: point.y / length };
}

function rotatePoint(point: RayPoint, angle: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}

function rayPolygonIntersection(
  origin: RayPoint,
  direction: RayPoint,
  vertices: RayPoint[],
) {
  let nearest:
    | {
        point: RayPoint;
        edgeIndex: number;
        distance: number;
      }
    | null = null;

  vertices.forEach((start, edgeIndex) => {
    const end = vertices[(edgeIndex + 1) % vertices.length];
    const edge = subtractPoint(end, start);
    const denominator = crossPoint(direction, edge);
    if (Math.abs(denominator) < 0.00001) return;
    const fromOrigin = subtractPoint(start, origin);
    const distance = crossPoint(fromOrigin, edge) / denominator;
    const edgePosition = crossPoint(fromOrigin, direction) / denominator;
    if (
      distance > 0.2 &&
      edgePosition >= -0.001 &&
      edgePosition <= 1.001 &&
      (!nearest || distance < nearest.distance)
    ) {
      nearest = {
        point: addPoint(origin, scalePoint(direction, distance)),
        edgeIndex,
        distance,
      };
    }
  });

  return nearest;
}

function polygonCenter(vertices: RayPoint[]) {
  return vertices.reduce(
    (center, point) => addPoint(center, scalePoint(point, 1 / vertices.length)),
    { x: 0, y: 0 },
  );
}

function edgeOutwardNormal(vertices: RayPoint[], edgeIndex: number) {
  const start = vertices[edgeIndex];
  const end = vertices[(edgeIndex + 1) % vertices.length];
  const edge = subtractPoint(end, start);
  const midpoint = scalePoint(addPoint(start, end), 0.5);
  const center = polygonCenter(vertices);
  let normal = normalizePoint({ x: edge.y, y: -edge.x });
  if (dotPoint(normal, subtractPoint(midpoint, center)) < 0) {
    normal = scalePoint(normal, -1);
  }
  return normal;
}

function refractRay(
  incident: RayPoint,
  surfaceNormal: RayPoint,
  firstIndex: number,
  secondIndex: number,
) {
  const ray = normalizePoint(incident);
  let normal = normalizePoint(surfaceNormal);
  if (dotPoint(ray, normal) > 0) normal = scalePoint(normal, -1);
  const indexRatio = firstIndex / secondIndex;
  const cosine = -dotPoint(normal, ray);
  const discriminant =
    1 - indexRatio * indexRatio * (1 - cosine * cosine);
  if (discriminant < 0) return null;
  return normalizePoint(
    addPoint(
      scalePoint(ray, indexRatio),
      scalePoint(normal, indexRatio * cosine - Math.sqrt(discriminant)),
    ),
  );
}

function reflectRay(incident: RayPoint, surfaceNormal: RayPoint) {
  const ray = normalizePoint(incident);
  const normal = normalizePoint(surfaceNormal);
  return normalizePoint(
    subtractPoint(ray, scalePoint(normal, 2 * dotPoint(ray, normal))),
  );
}

function elementCenter(element: Element | null, canvasRect: DOMRect) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    center: {
      x: rect.left - canvasRect.left + rect.width / 2,
      y: rect.top - canvasRect.top + rect.height / 2,
    },
    width: rect.width,
    height: rect.height,
  };
}

function samplePolygon(
  parent: HTMLElement | null,
  canvasRect: DOMRect,
  mode: ExperimentMode,
  rotationDegrees: number,
) {
  const selector =
    mode === "refraction"
      ? ".optics-slab"
      : mode === "deviation"
        ? ".optics-equilateral-prism"
        : ".optics-right-prism";
  const sample = elementCenter(parent?.querySelector(selector) ?? null, canvasRect);
  if (!sample) return [];
  const halfWidth = sample.width / 2;
  const halfHeight = sample.height / 2;
  const localVertices =
    mode === "refraction"
      ? [
          { x: -halfWidth, y: -halfHeight },
          { x: halfWidth, y: -halfHeight },
          { x: halfWidth, y: halfHeight },
          { x: -halfWidth, y: halfHeight },
        ]
      : mode === "deviation"
        ? [
            { x: 0, y: -halfHeight * 0.96 },
            { x: halfWidth * 0.92, y: halfHeight * 0.88 },
            { x: -halfWidth * 0.92, y: halfHeight * 0.88 },
          ]
        : [
            { x: -halfHeight * 0.45, y: -halfHeight * 0.9 },
            { x: halfHeight * 0.45, y: 0 },
            { x: -halfHeight * 0.45, y: halfHeight * 0.9 },
          ];
  const rotation = toRadians(rotationDegrees);
  return localVertices.map((point) =>
    addPoint(sample.center, rotatePoint(point, rotation)),
  );
}

function drawSurfaceContact(
  context: CanvasRenderingContext2D,
  contact: SurfaceContact,
  color: string,
) {
  const normalStart = addPoint(contact.point, scalePoint(contact.normal, -23));
  const normalEnd = addPoint(contact.point, scalePoint(contact.normal, 23));
  context.save();
  context.setLineDash([4, 4]);
  context.lineWidth = 1;
  context.strokeStyle = "rgba(42, 76, 83, 0.62)";
  context.beginPath();
  context.moveTo(normalStart.x, normalStart.y);
  context.lineTo(normalEnd.x, normalEnd.y);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(contact.point.x, contact.point.y, 5, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();
  context.lineWidth = 2.4;
  context.strokeStyle = color;
  context.stroke();
  context.font = "800 9px Arial";
  context.fillStyle = "#324f56";
  context.textAlign = "center";
  context.fillText(
    contact.label,
    contact.point.x,
    contact.point.y + contact.labelOffset,
  );
  context.restore();
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
  lightColor,
  refractiveIndex,
  sampleRotation,
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
  lightColor: (typeof LIGHT_COLORS)[LightColorKind];
  refractiveIndex: number;
  sampleRotation: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 320);
      const height = Math.max(rect.height, 420);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const parent = canvas.parentElement;
      const laserElement = parent?.querySelector(".laser-aperture") ?? null;
      const laserRect = laserElement?.getBoundingClientRect();
      const laser = laserRect
        ? {
            x: laserRect.right - rect.left,
            y: laserRect.top - rect.top + laserRect.height / 2,
          }
        : { x: width * 0.16, y: height * 0.44 };
      const screenElement = parent?.querySelector(".screen-face") ?? null;
      const screenRect = screenElement?.getBoundingClientRect();
      const visibleProgress = laserOn ? (running ? progress : 1) : 0;
      const vertices = samplePolygon(parent, rect, mode, sampleRotation);
      const points: RayPoint[] = [laser];
      const contacts: SurfaceContact[] = [];
      let rayDirection: RayPoint = { x: 1, y: 0 };
      let rayOrigin = laser;
      let exitedPrism = false;
      let reflectedCount = 0;
      const entryHit = rayPolygonIntersection(rayOrigin, rayDirection, vertices);

      if (entryHit) {
        points.push(entryHit.point);
        const entryNormal = edgeOutwardNormal(vertices, entryHit.edgeIndex);
        contacts.push({
          point: entryHit.point,
          normal: entryNormal,
          label: mode === "total-reflection" ? "giriş" : "girişte kırılma",
          labelOffset: -16,
        });
        const insideDirection = refractRay(
          rayDirection,
          entryNormal,
          1,
          refractiveIndex,
        );
        if (insideDirection) {
          rayDirection = insideDirection;
          rayOrigin = addPoint(entryHit.point, scalePoint(rayDirection, 0.35));
          for (let interaction = 0; interaction < 5; interaction += 1) {
            const nextHit = rayPolygonIntersection(
              rayOrigin,
              rayDirection,
              vertices,
            );
            if (!nextHit) break;
            points.push(nextHit.point);
            const outwardNormal = edgeOutwardNormal(
              vertices,
              nextHit.edgeIndex,
            );
            const outsideDirection = refractRay(
              rayDirection,
              scalePoint(outwardNormal, -1),
              refractiveIndex,
              1,
            );
            if (outsideDirection) {
              contacts.push({
                point: nextHit.point,
                normal: outwardNormal,
                label: mode === "total-reflection" ? "çıkış" : "çıkışta kırılma",
                labelOffset: 19,
              });
              rayDirection = outsideDirection;
              rayOrigin = nextHit.point;
              exitedPrism = true;
              break;
            }
            reflectedCount += 1;
            contacts.push({
              point: nextHit.point,
              normal: outwardNormal,
              label:
                mode === "total-reflection"
                  ? `TY ${reflectedCount}`
                  : `tam yansıma ${reflectedCount}`,
              labelOffset: reflectedCount % 2 === 0 ? -16 : 20,
            });
            rayDirection = reflectRay(rayDirection, outwardNormal);
            rayOrigin = addPoint(nextHit.point, scalePoint(rayDirection, 0.35));
          }
        }
      }

      let reachedScreen = false;
      let screenPoint: RayPoint | null = null;
      if (exitedPrism && screenRect && Math.abs(rayDirection.x) > 0.0001) {
        const screenLeft = screenRect.left - rect.left;
        const screenRight = screenRect.right - rect.left;
        const screenX = rayDirection.x >= 0 ? screenLeft : screenRight;
        const screenDistance = (screenX - rayOrigin.x) / rayDirection.x;
        const candidate = addPoint(
          rayOrigin,
          scalePoint(rayDirection, screenDistance),
        );
        const screenTop = screenRect.top - rect.top + 3;
        const screenBottom = screenRect.bottom - rect.top - 3;
        if (
          screenDistance > 0 &&
          candidate.y >= screenTop &&
          candidate.y <= screenBottom
        ) {
          screenPoint = candidate;
          reachedScreen = true;
          points.push(candidate);
        }
      }

      if (exitedPrism && !reachedScreen) {
        const distanceToEdge =
          rayDirection.x >= 0
            ? (width - rayOrigin.x - 10) / Math.max(rayDirection.x, 0.001)
            : (10 - rayOrigin.x) / Math.min(rayDirection.x, -0.001);
        points.push(
          addPoint(rayOrigin, scalePoint(rayDirection, distanceToEdge)),
        );
      }

      if (laserOn) {
        context.save();
        context.setLineDash([7, 6]);
        context.lineWidth = 1;
        context.strokeStyle = "rgba(49, 89, 94, 0.42)";
        context.beginPath();
        context.moveTo(laser.x, laser.y);
        context.lineTo(width * 0.95, laser.y);
        context.stroke();
        context.restore();
      }

      if (visibleProgress > 0) {
        context.save();
        context.lineCap = "round";
        context.lineJoin = "round";
        context.shadowColor = lightColor.glow;
        context.shadowBlur = 14;
        context.lineWidth = 9;
        context.strokeStyle = lightColor.glow.replace("0.68", "0.2").replace("0.7", "0.2");
        drawProgressivePath(context, points, visibleProgress);
        context.shadowBlur = 4;
        context.lineWidth = 3;
        context.strokeStyle = lightColor.hex;
        drawProgressivePath(context, points, visibleProgress);
        context.restore();
      }

      if (laserOn && visibleProgress > 0.7) {
        contacts.forEach((contact) =>
          drawSurfaceContact(context, contact, lightColor.hex),
        );
        if (screenPoint) {
          context.save();
          context.beginPath();
          context.arc(screenPoint.x, screenPoint.y, 7, 0, Math.PI * 2);
          context.fillStyle = lightColor.hex;
          context.shadowColor = lightColor.glow;
          context.shadowBlur = 17;
          context.fill();
          context.font = "800 9px Arial";
          context.fillStyle = "#324f56";
          context.textAlign = "center";
          context.fillText("ekrana ulaştı", screenPoint.x, screenPoint.y - 14);
          context.restore();
        }
        context.save();
        context.font = "800 9px Arial";
        context.fillStyle = "#405f65";
        context.textAlign = "center";
        if (mode === "refraction") {
          context.fillText(`kırılma ${format(refraction, 1)}°`, width * 0.66, height * 0.38);
        } else if (mode === "deviation") {
          context.fillText(
            `sapma ${format(deviation, 1)}°`,
            width * 0.75,
            height * 0.22,
          );
        } else {
          context.fillText(
            reflectedCount >= 2 && totalReflection
              ? `iki tam yansıma · ${format(internalAngle, 0)}°`
              : `${format(internalAngle, 0)}° · ışın prizmadan çıkar`,
            width * 0.56,
            height * 0.19,
          );
        }
        context.restore();
      }
    };

    frame = window.requestAnimationFrame(draw);
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [
    deviation,
    displacement,
    incidence,
    internalAngle,
    laserOn,
    lightColor,
    mode,
    progress,
    refractiveIndex,
    refraction,
    running,
    sampleRotation,
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
  const [lightColorKind, setLightColorKind] =
    useState<LightColorKind>("red");
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
    color: "",
    path: "",
    conclusion: "",
  });

  const lightColor = LIGHT_COLORS[lightColorKind];
  const refractiveIndex = lightColor.refractiveIndex;
  const setupComplete = installed.length === SETUP_ORDER.length;
  const nextSetup =
    SETUP_ORDER.find((kind) => !installed.includes(kind)) ?? null;
  const refractionAngle =
    mode === "total-reflection"
      ? 0
      : toDegrees(
          Math.asin(
            clamp(Math.sin(toRadians(incidence)) / refractiveIndex, -1, 1),
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
      ? refractiveIndex * Math.sin(toRadians(secondInternalAngle))
      : 0;
  const exitAngle =
    mode === "deviation" && Math.abs(exitArgument) <= 1
      ? toDegrees(Math.asin(exitArgument))
      : 0;
  const deviation =
    mode === "deviation" ? incidence + exitAngle - PRISM_APEX_ANGLE : 0;
  const criticalAngle = toDegrees(Math.asin(1 / refractiveIndex));
  const totalReflection =
    mode === "total-reflection" && internalAngle >= criticalAngle;
  const refractiveIndexMeasured =
    incidence === 0 || refractionAngle === 0
      ? refractiveIndex
      : Math.sin(toRadians(incidence)) / Math.sin(toRadians(refractionAngle));
  const latest =
    [...records]
      .reverse()
      .find((record) => record.mode === mode && record.color === lightColorKind) ??
    null;

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
      setMessage("Cam blok seçildi. Gelme açısı için bir hipotez yaz.");
    } else if (nextMode === "deviation") {
      setIncidence(40);
      setMessage("60° prizma seçildi. Işının izleyeceği yolu tahmin et.");
    } else {
      setInternalAngle(35);
      setMessage("Dik üçgen prizma seçildi. Tam yansımanın başlayacağı açıyı tahmin et.");
    }
  };

  const selectLightColor = (nextColor: LightColorKind) => {
    if (runState === "running") return;
    setLightColorKind(nextColor);
    setProgress(0);
    setRunState("ready");
    setShowAnalysis(false);
    setMessage(
      `${LIGHT_COLORS[nextColor].label} ışık seçildi. Aynı açıyı farklı renklerle ölçüp ekrandaki izi karşılaştır.`,
    );
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
        color: lightColorKind,
        colorLabel: lightColor.label,
        colorHex: lightColor.hex,
        wavelength: lightColor.wavelength,
        incidence,
        refraction: refractionAngle,
        deviation,
        displacement,
        refractiveIndex: refractiveIndexMeasured,
        internalAngle,
        totalReflection,
      };
      nextIdRef.current += 1;
      setRecords((current) => {
        const withoutSameSetting = current.filter((item) =>
          mode === "total-reflection"
            ? !(
                item.mode === mode &&
                item.internalAngle === internalAngle &&
                item.color === lightColorKind
              )
            : !(
                item.mode === mode &&
                item.incidence === incidence &&
                item.color === lightColorKind
              ),
        );
        return [...withoutSameSetting, record];
      });
      setRunState("complete");
      setMessage(
        mode === "refraction"
          ? `${lightColor.label} ışık: kırılma ${format(refractionAngle, 1)}°, ekrandaki kayma ${format(displacement, 2)} cm.`
          : mode === "deviation"
            ? `${lightColor.label} ışık prizmadan çıktı ve ekrana düştü. Sapma ${format(deviation, 1)}°.`
            : totalReflection
              ? `${lightColor.label} ışık iki kez tam yansıdı ve geri dönüş ekranına ulaştı.`
              : `${lightColor.label} ışık prizmadan çıktı ve sağdaki ekrana ulaştı.`,
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
    lightColor,
    lightColorKind,
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
  const requestedRightPrismRotation = toDegrees(
    Math.asin(
      clamp(
        refractiveIndex * Math.sin(toRadians(internalAngle - 45)),
        -1,
        1,
      ),
    ),
  );
  const rightPrismRotation = totalReflection
    ? Math.abs(requestedRightPrismRotation) < 1
      ? 1
      : clamp(requestedRightPrismRotation, -5.5, 5.5)
    : requestedRightPrismRotation;
  const sampleRotation =
    mode === "refraction"
      ? incidence
      : mode === "deviation"
        ? incidence - 30
        : rightPrismRotation;
  const stageStyle = {
    "--optics-table-angle": `${sampleRotation}deg`,
    "--optics-sample-angle": `${sampleRotation}deg`,
    "--optics-beam-color": lightColor.hex,
    "--optics-beam-glow": lightColor.glow,
  } as CSSProperties;

  const modeRecords = records.filter((record) => record.mode === mode);

  return (
    <section className="prism-lab-section" id="kirilma-prizma-deneyi">
      <div className="prism-heading">
        <div>
          <span>DALGALAR - OPTİK · DENEY 1</span>
          <h1>Kırılma ve prizmada ışığın yolu</h1>
          <p>
            Optik rayı kendin kur; cam blokta kırılmayı, 60° prizmada sapmayı
            ve dik üçgen prizmada tam yansımayı farklı ışık renkleriyle karşılaştır.
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
                <small>Işık rengi</small>
                <b className="optics-live-color">
                  <i style={{ background: lightColor.hex }} />
                  {lightColor.label}
                </b>
              </span>
              <span>
                <small>{mode === "refraction" ? "Kırılma" : mode === "deviation" ? "Sapma" : "Sonuç"}</small>
                <b>
                  {mode === "refraction"
                    ? `${format(refractionAngle, 1)}°`
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

          <div className={`optics-apparatus mode-${mode}`} style={stageStyle}>
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
              <div
                className={`optics-screen ${mode === "total-reflection" && totalReflection ? "return-screen" : ""}`}
              >
                <i className="screen-face" />
                <i className="screen-grid" />
                <i className="screen-post" />
                <i className="screen-base" />
                <b>
                  {mode === "total-reflection" && totalReflection
                    ? "GERİ DÖNÜŞ EKRANI"
                    : "EKRAN"}
                </b>
              </div>
            )}

            {installed.includes(activeSample as ApparatusKind) && (
              <>
                {mode === "refraction" && (
                  <div className="optics-slab">
                    <i />
                    <b>CAM BLOK</b>
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
              lightColor={lightColor}
              refractiveIndex={refractiveIndex}
              sampleRotation={sampleRotation}
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
          <b>Cam blokta kırılma</b>
          <small>Işığın ortam değiştirirken yön değiştirmesi</small>
          <em>{records.filter((record) => record.mode === "refraction").length} kayıt</em>
        </button>
        <button
          type="button"
          className={mode === "deviation" ? "active" : ""}
          onClick={() => selectMode("deviation")}
        >
          <span>B</span>
          <b>Prizmada sapma</b>
          <small>Işının iki yüzeyde kırılıp ekrana ulaşması</small>
          <em>{records.filter((record) => record.mode === "deviation").length} kayıt</em>
        </button>
        <button
          type="button"
          className={mode === "total-reflection" ? "active" : ""}
          onClick={() => selectMode("total-reflection")}
        >
          <span>C</span>
          <b>Prizmada tam yansıma</b>
          <small>Prizma içindeki iki yansımayı gözleme</small>
          <em>{records.filter((record) => record.mode === "total-reflection").length} kayıt</em>
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
          <small>DEĞİŞKENLER</small>
          <b>Işık rengi</b>
          <div className="optics-color-options" aria-label="Işık rengi seçimi">
            {(Object.entries(LIGHT_COLORS) as Array<
              [LightColorKind, (typeof LIGHT_COLORS)[LightColorKind]]
            >).map(([kind, color]) => (
              <button
                key={kind}
                type="button"
                className={lightColorKind === kind ? "selected" : ""}
                onClick={() => selectLightColor(kind)}
                disabled={runState === "running"}
              >
                <i style={{ background: color.hex }} />
                {color.label}
              </button>
            ))}
          </div>
          <b className="optics-angle-title">
            {mode === "total-reflection" ? "İç gelme açısı" : "Gelme açısı"}
          </b>
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
                ? "Cam blok gözlemleri"
                : mode === "deviation"
                  ? "60° prizma gözlemleri"
                  : "Tam yansıma gözlemleri"}
            </h2>
            <p>Aynı açıyı farklı renklerle deneyerek sonuçları karşılaştır.</p>
          </div>
          <span>
            <b>{modeRecords.length}</b>
            kayıt
          </span>
        </div>

        <div className="optics-table-wrap">
          {mode === "refraction" && (
            <table className="optics-data-table">
              <thead>
                <tr>
                  <th>Işık rengi</th>
                  <th>Gelme açısı</th>
                  <th>Kırılma açısı</th>
                  <th>Ekrandaki gözlem</th>
                </tr>
              </thead>
              <tbody>
                {modeRecords.length === 0 ? (
                  <tr><td colSpan={4}>İlk ışını gönderdiğinde gözlemin burada görünecek.</td></tr>
                ) : (
                  modeRecords.map((record) => (
                    <tr key={record.id}>
                      <td><i className="optics-table-color" style={{ background: record.colorHex }} />{record.colorLabel}</td>
                      <td>{format(record.incidence, 0)}°</td>
                      <td>{format(record.refraction, 1)}°</td>
                      <td>{format(record.displacement, 2)} cm kayarak ekrana ulaştı</td>
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
                  <th>Işık rengi</th>
                  <th>Gelme açısı</th>
                  <th>Sapma açısı</th>
                  <th>Ekrandaki gözlem</th>
                </tr>
              </thead>
              <tbody>
                {modeRecords.length === 0 ? (
                  <tr><td colSpan={4}>İlk ışını gönderdiğinde gözlemin burada görünecek.</td></tr>
                ) : (
                  modeRecords.map((record) => (
                    <tr key={record.id}>
                      <td><i className="optics-table-color" style={{ background: record.colorHex }} />{record.colorLabel}</td>
                      <td>{format(record.incidence, 0)}°</td>
                      <td>{format(record.deviation, 1)}°</td>
                      <td>Prizmadan çıktı ve ekrana düştü</td>
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
                  <th>Işık rengi</th>
                  <th>İç gelme açısı</th>
                  <th>Gözlem</th>
                  <th>Ekrandaki sonuç</th>
                </tr>
              </thead>
              <tbody>
                {modeRecords.length === 0 ? (
                  <tr><td colSpan={4}>İlk ışını gönderdiğinde gözlemin burada görünecek.</td></tr>
                ) : (
                  modeRecords.map((record) => (
                    <tr key={record.id}>
                      <td><i className="optics-table-color" style={{ background: record.colorHex }} />{record.colorLabel}</td>
                      <td>{format(record.internalAngle, 0)}°</td>
                      <td>{record.totalReflection ? "Prizma içinde iki tam yansıma" : "Işın prizmadan çıktı"}</td>
                      <td>{record.totalReflection ? "Geri dönüş ekranına ulaştı" : "Sağdaki ekrana ulaştı"}</td>
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
            <h2>Işının izlediği yolu gözleminle karşılaştır</h2>
            <p>Kısa özet yalnızca ölçümden sonra açılır.</p>
          </div>
          <button type="button" onClick={() => setShowAnalysis((current) => !current)}>
            {showAnalysis ? "Özeti kapat" : "Gözlem özetini göster"} →
          </button>
        </section>
      )}

      {latest && showAnalysis && (
        <section className="optics-analysis">
          <div className="optics-analysis-heading">
            <div>
              <small>SON GÖZLEM</small>
              <h2>{latest.colorLabel} ışığın izlediği yol</h2>
            </div>
            <span>Işın her yüzey temasında yön değiştirir.</span>
          </div>
          <div className="optics-analysis-grid">
            {latest.mode === "refraction" && (
              <>
                <article>
                  <b>1 · Giriş yüzeyi</b>
                  <p>{format(latest.incidence, 0)}° → {format(latest.refraction, 1)}°</p>
                  <small>Işın cam bloğa girerken normale yaklaştı.</small>
                </article>
                <article>
                  <b>2 · Çıkış yüzeyi</b>
                  <p>İkinci kez kırıldı</p>
                  <small>Işın camdan havaya çıkarken yeniden yön değiştirdi.</small>
                </article>
                <article>
                  <b>3 · Ekran</b>
                  <p>{format(latest.displacement, 2)} cm kayma</p>
                  <small>Çıkan ışın ekrandaki renkli noktaya ulaştı.</small>
                </article>
              </>
            )}
            {latest.mode === "deviation" && (
              <>
                <article>
                  <b>1 · Prizmaya giriş</b>
                  <p>İlk kırılma</p>
                  <small>Işın ilk prizma yüzeyinde yön değiştirdi.</small>
                </article>
                <article>
                  <b>2 · Prizmadan çıkış</b>
                  <p>İkinci kırılma</p>
                  <small>Işın ikinci yüzeyden geçerek ekrana yöneldi.</small>
                </article>
                <article>
                  <b>3 · Ekran</b>
                  <p>{format(latest.deviation, 1)}° sapma</p>
                  <small>{latest.colorLabel} ışığın renkli izi ekranda görüldü.</small>
                </article>
              </>
            )}
            {latest.mode === "total-reflection" && (
              <>
                <article>
                  <b>1 · Seçilen açı</b>
                  <p>{format(latest.internalAngle, 0)}°</p>
                  <small>Işının prizma içindeki yüzeye geliş açısıdır.</small>
                </article>
                <article>
                  <b>2 · Prizma içindeki yol</b>
                  <p>{latest.totalReflection ? "İki tam yansıma" : "Dışarı çıkış"}</p>
                  <small>{latest.totalReflection ? "İki temas noktası ışın üzerinde gösterildi." : "Işın ilk yüzeyden dışarı çıktı."}</small>
                </article>
                <article>
                  <b>3 · Ekran</b>
                  <p>{latest.totalReflection ? "Geri dönüş ekranı" : "Sağ ekran"}</p>
                  <small>Işın yolu ekran üzerindeki renkli noktada sonlandı.</small>
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
            <h2>Gözlediğini kendi cümlelerinle açıkla</h2>
          </div>
          <span>Kısa ve gözleme dayalı yanıtlar yeterlidir.</span>
        </div>
        <div className="optics-report-grid">
          <label>
            <span>Aynı açıda kırmızı, yeşil ve mavi ışığın ekrandaki yerleri aynı mıydı?</span>
            <textarea
              rows={4}
              value={report.color}
              onChange={(event) => setReport({ ...report, color: event.target.value })}
            />
          </label>
          <label>
            <span>Işın prizmaya girdiğinde, çıktığında ve tam yansıma yaptığında nasıl bir yol izledi?</span>
            <textarea
              rows={4}
              value={report.path}
              onChange={(event) => setReport({ ...report, path: event.target.value })}
            />
          </label>
          <label className="wide">
            <span>Sonuç: Işığın rengi ve geliş açısı ışının yolunu nasıl etkiledi?</span>
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
