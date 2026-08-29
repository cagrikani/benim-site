"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ExperimentMode = "reflection" | "image";
export type MirrorKind = "concave" | "convex";
type Point = { x: number; y: number };
type Vector = { x: number; y: number };
type DrawStroke = {
  id: number;
  color: string;
  width: number;
  points: Point[];
};
type ReflectionReading = {
  id: number;
  mirrorAngle: number;
  hitOffset: number;
  laserX: number;
  laserY: number;
  incidenceAngle: number;
};
type ImageReading = {
  id: number;
  mirrorAngle: number;
  objectDistance: number;
  focalLength: number;
  imageDistance: number | null;
  magnification: number | null;
  description: string;
};

const REFLECTION_WIDTH = 900;
const REFLECTION_HEIGHT = 440;
const IMAGE_WIDTH = 900;
const IMAGE_HEIGHT = 520;
const RADIUS_OF_CURVATURE = 200;
const PIXELS_PER_CM = 10;
const LAB_BENCH_IMAGE = "./ohm-lab-bench-real-v2.webp";
const REAL_LASER_IMAGE = "./optics-laser-real-v1.webp";
const OPTICAL_RAIL_IMAGE = "./optics-rail-real-v1.webp";
const ROTARY_MIRROR_IMAGE = "./optics-plane-rotary-mirror-real-v1.webp";
const CONCAVE_MIRROR_IMAGE = "./optics-concave-mirror-real-v1.webp";
const CONVEX_MIRROR_IMAGE = "./optics-convex-mirror-real-v1.webp";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

function useCanvasImage(source: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let active = true;
    const asset = new Image();
    asset.onload = () => {
      if (active) setImage(asset);
    };
    asset.src = source;
    return () => {
      active = false;
    };
  }, [source]);

  return image;
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

function add(point: Point, vector: Vector, scale = 1): Point {
  return { x: point.x + vector.x * scale, y: point.y + vector.y * scale };
}

function subtract(first: Point, second: Point): Vector {
  return { x: first.x - second.x, y: first.y - second.y };
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function dot(first: Vector, second: Vector) {
  return first.x * second.x + first.y * second.y;
}

function mirrorAxes(mirrorAngle: number) {
  const angle = toRadians(mirrorAngle);
  const axis = { x: -Math.cos(angle), y: -Math.sin(angle) };
  const up = { x: Math.sin(angle), y: -Math.cos(angle) };
  return { axis, up };
}

function localToWorld(origin: Point, axis: Vector, up: Vector, point: Point): Point {
  return {
    x: origin.x + axis.x * point.x + up.x * point.y,
    y: origin.y + axis.y * point.x + up.y * point.y,
  };
}

function worldToLocal(origin: Point, axis: Vector, up: Vector, point: Point): Point {
  const relative = subtract(point, origin);
  return { x: dot(relative, axis), y: dot(relative, up) };
}

function reflectVector(incomingVector: Vector, normal: Vector): Vector {
  const incomingDotNormal = dot(incomingVector, normal);
  return normalize({
    x: incomingVector.x - 2 * incomingDotNormal * normal.x,
    y: incomingVector.y - 2 * incomingDotNormal * normal.y,
  });
}

function drawGlowLine(
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  dashed = false,
) {
  context.save();
  context.lineCap = "round";
  context.setLineDash(dashed ? [10, 8] : []);
  context.strokeStyle = color;
  context.lineWidth = dashed ? 2 : 10;
  context.globalAlpha = dashed ? 0.54 : 0.14;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.lineWidth = dashed ? 1.7 : 2.6;
  context.globalAlpha = dashed ? 0.86 : 1;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
}

function drawArrowHead(
  context: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  context.save();
  context.translate(to.x, to.y);
  context.rotate(angle);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-13, -6);
  context.lineTo(-10, 0);
  context.lineTo(-13, 6);
  context.closePath();
  context.fill();
  context.restore();
}

function prepareCanvas(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(rect.width, 320);
  const cssHeight = cssWidth * (logicalHeight / logicalWidth);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
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
  return context;
}

function pointerToLogical(
  event: ReactPointerEvent<HTMLCanvasElement>,
  logicalWidth: number,
  logicalHeight: number,
): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * logicalWidth,
    y: ((event.clientY - rect.top) / rect.height) * logicalHeight,
  };
}

function drawBench(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  benchImage?: HTMLImageElement | null,
) {
  if (benchImage) {
    drawCoverImage(context, benchImage, width, height);
    context.fillStyle = "rgba(245, 249, 247, 0.23)";
    context.fillRect(0, 0, width, height * 0.66);
    return;
  }
  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#edf5f3");
  background.addColorStop(0.64, "#dfe9e6");
  background.addColorStop(0.65, "#b47e52");
  background.addColorStop(1, "#7b4d31");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(34, 74, 76, 0.07)";
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 45) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height * 0.64);
    context.stroke();
  }
  for (let y = 0; y <= height * 0.64; y += 44) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.fillStyle = "rgba(255,255,255,0.38)";
  context.fillRect(0, height * 0.64, width, 5);
}

function drawOpticalRail(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  y: number,
) {
  if (!image) return;
  context.save();
  context.shadowColor = "rgba(15, 31, 34, 0.34)";
  context.shadowBlur = 13;
  context.drawImage(image, 42, y, 816, 88);
  context.restore();
}

function drawMountedMirror(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  vertex: Point,
  mirrorAngle: number,
) {
  if (!image) return false;
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const headSourceHeight = sourceHeight * 0.43;
  const standSourceY = sourceHeight * 0.34;
  const standSourceHeight = sourceHeight - standSourceY;
  const turnScale = Math.max(
    0.72,
    Math.cos(toRadians(Math.abs(mirrorAngle) * 2)),
  );
  const headWidth = 142 * turnScale;
  const horizontalShift = mirrorAngle * 0.65;

  context.save();
  context.shadowColor = "rgba(15, 31, 34, 0.34)";
  context.shadowBlur = 14;
  context.drawImage(
    image,
    0,
    standSourceY,
    sourceWidth,
    standSourceHeight,
    vertex.x - 76,
    vertex.y + 8,
    152,
    198,
  );
  context.drawImage(
    image,
    0,
    0,
    sourceWidth,
    headSourceHeight,
    vertex.x - headWidth / 2 + horizontalShift,
    vertex.y - 59,
    headWidth,
    124,
  );
  context.restore();
  return true;
}

function drawSphericalMirror(
  context: CanvasRenderingContext2D,
  vertex: Point,
  axis: Vector,
  up: Vector,
  radius: number,
  aperture: number,
  mirrorKind: MirrorKind,
) {
  const curve: Point[] = [];
  for (let offset = -aperture; offset <= aperture; offset += 4) {
    const sag = radius - Math.sqrt(radius * radius - offset * offset);
    curve.push(
      localToWorld(vertex, axis, up, {
        x: mirrorKind === "concave" ? sag : -sag,
        y: offset,
      }),
    );
  }

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = "rgba(21, 54, 61, 0.35)";
  context.shadowBlur = 9;
  context.strokeStyle = "#294b51";
  context.lineWidth = 14;
  context.beginPath();
  curve.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = "#dcebee";
  context.lineWidth = 9;
  context.stroke();
  context.strokeStyle = "rgba(255,255,255,0.9)";
  context.lineWidth = 2;
  context.stroke();
  context.restore();

  const lowerEdge = curve[0];
  const mountTop = add(lowerEdge, up, -6);
  const mountBottom = add(mountTop, { x: 0, y: 1 }, 55);
  context.strokeStyle = "#405d60";
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(mountTop.x, mountTop.y);
  context.lineTo(mountBottom.x, mountBottom.y);
  context.stroke();
  context.fillStyle = "#39575a";
  context.beginPath();
  context.roundRect(mountBottom.x - 37, mountBottom.y - 4, 74, 12, 6);
  context.fill();
}

function drawAxisAndMarkers(
  context: CanvasRenderingContext2D,
  vertex: Point,
  axis: Vector,
  up: Vector,
  focalLengthPixels: number,
  extent: number,
  mirrorKind: MirrorKind,
) {
  const start = add(vertex, axis, extent);
  const behindExtent = Math.max(150, focalLengthPixels * 2 + 35);
  const end = add(vertex, axis, -behindExtent);
  context.save();
  context.strokeStyle = "rgba(44, 83, 86, 0.48)";
  context.setLineDash([8, 8]);
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.setLineDash([]);

  [
    { label: "F", distance: focalLengthPixels, color: "#ef9f28" },
    { label: "C", distance: focalLengthPixels * 2, color: "#397d80" },
  ].forEach((marker) => {
    const markerDirection = mirrorKind === "concave" ? 1 : -1;
    const point = add(vertex, axis, marker.distance * markerDirection);
    if (mirrorKind === "convex") context.setLineDash([4, 4]);
    context.fillStyle = marker.color;
    context.strokeStyle = marker.color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(point.x, point.y, 5, 0, Math.PI * 2);
    if (mirrorKind === "concave") context.fill();
    else context.stroke();
    context.setLineDash([]);
    context.font = "900 15px Arial";
    context.textAlign = "center";
    context.fillText(marker.label, point.x + up.x * 22, point.y + up.y * 22);
  });
  context.restore();
}

function ConcaveReflectionCanvas({
  mirrorKind,
  laserPosition,
  mirrorX,
  mirrorAngle,
  hitOffset,
  laserOn,
  onLaserPositionChange,
  onMirrorXChange,
  onHitOffsetChange,
}: {
  mirrorKind: MirrorKind;
  laserPosition: Point;
  mirrorX: number;
  mirrorAngle: number;
  hitOffset: number;
  laserOn: boolean;
  onLaserPositionChange: (position: Point) => void;
  onMirrorXChange: (value: number) => void;
  onHitOffsetChange: (value: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef<"laser" | "hit" | "mirror" | null>(null);
  const benchImage = useCanvasImage(LAB_BENCH_IMAGE);
  const railImage = useCanvasImage(OPTICAL_RAIL_IMAGE);
  const laserImage = useCanvasImage(REAL_LASER_IMAGE);
  const mirrorImage = useCanvasImage(
    mirrorKind === "concave" ? CONCAVE_MIRROR_IMAGE : CONVEX_MIRROR_IMAGE,
  );

  const geometry = useMemo(() => {
    const vertex = { x: mirrorX, y: 205 };
    const { axis, up } = mirrorAxes(mirrorAngle);
    const center = add(
      vertex,
      axis,
      mirrorKind === "concave" ? RADIUS_OF_CURVATURE : -RADIUS_OF_CURVATURE,
    );
    const sag =
      RADIUS_OF_CURVATURE -
      Math.sqrt(RADIUS_OF_CURVATURE ** 2 - hitOffset ** 2);
    const hit = localToWorld(vertex, axis, up, {
      x: mirrorKind === "concave" ? sag : -sag,
      y: hitOffset,
    });
    const normal = normalize(
      mirrorKind === "concave"
        ? subtract(center, hit)
        : subtract(hit, center),
    );
    const source = laserPosition;
    const sourceDirection = normalize(subtract(source, hit));
    const incomingVector = normalize(subtract(hit, source));
    const reflectedVector = reflectVector(incomingVector, normal);
    const incidenceAngle = toDegrees(
      Math.acos(clamp(dot(sourceDirection, normal), -1, 1)),
    );
    return {
      vertex,
      axis,
      up,
      center,
      hit,
      normal,
      source,
      incomingVector,
      reflectedVector,
      incidenceAngle,
    };
  }, [hitOffset, laserPosition, mirrorAngle, mirrorKind, mirrorX]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const context = prepareCanvas(canvas, REFLECTION_WIDTH, REFLECTION_HEIGHT);
      if (!context) return;
      const {
        vertex,
        axis,
        up,
        center,
        hit,
        normal,
        source,
        reflectedVector,
      } = geometry;

      drawBench(context, REFLECTION_WIDTH, REFLECTION_HEIGHT, benchImage);
      drawOpticalRail(context, railImage, 346);
      drawAxisAndMarkers(
        context,
        vertex,
        axis,
        up,
        RADIUS_OF_CURVATURE / 2,
        610,
        mirrorKind,
      );

      context.save();
      context.strokeStyle = "rgba(54, 91, 95, 0.65)";
      context.setLineDash([7, 6]);
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(add(hit, normal, -215).x, add(hit, normal, -215).y);
      context.lineTo(add(hit, normal, 125).x, add(hit, normal, 125).y);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "#2c666a";
      context.font = "800 12px Arial";
      context.textAlign = "center";
      context.fillText("yüzey normali", center.x, center.y - 15);
      context.restore();

      if (laserOn) {
        const reflectedEnd = add(hit, reflectedVector, 430);
        drawGlowLine(context, source, hit, "#ef3340");
        drawGlowLine(context, hit, reflectedEnd, "#ef3340");
        drawArrowHead(context, add(source, geometry.incomingVector, 155), add(source, geometry.incomingVector, 173), "#ef3340");
        drawArrowHead(context, add(hit, reflectedVector, 175), add(hit, reflectedVector, 193), "#ef3340");
        context.fillStyle = "#ffdf57";
        context.beginPath();
        context.arc(hit.x, hit.y, 5, 0, Math.PI * 2);
        context.fill();
      }

      context.save();
      context.translate(source.x, source.y);
      if (laserImage) {
        context.shadowColor = "rgba(16, 31, 34, 0.34)";
        context.shadowBlur = 12;
        context.drawImage(laserImage, -95, -23, 122, 91);
        context.shadowBlur = 0;
        context.fillStyle = laserOn ? "#ef3340" : "#728486";
        context.shadowColor = laserOn ? "#ef3340" : "transparent";
        context.shadowBlur = laserOn ? 12 : 0;
        context.beginPath();
        context.arc(0, 0, 4, 0, Math.PI * 2);
        context.fill();
      } else {
        context.rotate(Math.atan2(hit.y - source.y, hit.x - source.x));
        context.fillStyle = "#314a4f";
        context.beginPath();
        context.roundRect(-55, -18, 76, 36, 9);
        context.fill();
      }
      context.restore();

      context.save();
      context.strokeStyle = "rgba(225, 143, 29, 0.9)";
      context.lineWidth = 2;
      context.setLineDash([5, 5]);
      context.beginPath();
      context.arc(source.x, source.y, 34, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "#a96616";
      context.font = "900 10px Arial";
      context.textAlign = "center";
      context.fillText("LAZERİ TAŞI", source.x, source.y + 49);
      context.restore();

      const photoMirrorDrawn = drawMountedMirror(
        context,
        mirrorImage,
        vertex,
        mirrorAngle,
      );
      if (!photoMirrorDrawn) {
        drawSphericalMirror(
          context,
          vertex,
          axis,
          up,
          RADIUS_OF_CURVATURE,
          102,
          mirrorKind,
        );
      }
      context.save();
      context.strokeStyle = "rgba(221, 132, 30, 0.9)";
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(
        vertex.x,
        vertex.y,
        74,
        -Math.PI / 2,
        -Math.PI / 2 + toRadians(mirrorAngle),
        mirrorAngle < 0,
      );
      context.stroke();
      context.fillStyle = "#8b540f";
      context.font = "950 10px Arial";
      context.textAlign = "center";
      context.fillText(`AYNA ${mirrorAngle > 0 ? "+" : ""}${mirrorAngle}°`, vertex.x, vertex.y - 82);
      context.restore();
      context.fillStyle = "rgba(255,255,255,0.96)";
      context.shadowColor = "#ef6b32";
      context.shadowBlur = 16;
      context.beginPath();
      context.arc(hit.x, hit.y, 10, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = "#ef7f22";
      context.lineWidth = 4;
      context.beginPath();
      context.arc(hit.x, hit.y, 15, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "#ed3f35";
      context.beginPath();
      context.arc(hit.x, hit.y, 4, 0, Math.PI * 2);
      context.fill();

      const hitLabel = add(hit, up, hitOffset > 42 ? -22 : 24);
      context.fillStyle = "#7f4b0f";
      context.font = "950 10px Arial";
      context.textAlign = "center";
      context.fillText("IŞININ ÇARPTIĞI NOKTA", hitLabel.x, hitLabel.y);

      context.fillStyle = "rgba(24, 51, 55, 0.88)";
      context.beginPath();
      context.roundRect(vertex.x - 76, vertex.y + 152, 152, 24, 8);
      context.fill();
      context.fillStyle = "#fff";
      context.font = "900 8px Arial";
      context.fillText("AYNA AYAĞINI RAYDA SÜRÜKLE", vertex.x, vertex.y + 168);

      context.fillStyle = "rgba(255,255,255,0.92)";
      context.beginPath();
      context.roundRect(24, 22, 350, 82, 12);
      context.fill();
      context.fillStyle = "#264e52";
      context.font = "900 13px Arial";
      context.textAlign = "left";
      context.fillText(
        `KÜRESEL ${mirrorKind === "concave" ? "ÇUKUR" : "TÜMSEK"} AYNA DÜZENEĞİ`,
        40,
        44,
      );
      context.fillStyle = "#668084";
      context.font = "700 11px Arial";
      context.fillText("Lazeri istediğin başlangıç noktasına sürükle.", 40, 63);
      context.fillText("Turuncu noktayı ayna üzerinde ayrıca taşı.", 40, 79);
      context.fillText("Ayna ayağını rayda sürükle; açıyla yalnız yüzey döner.", 40, 95);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [benchImage, geometry, hitOffset, laserImage, laserOn, mirrorAngle, mirrorImage, mirrorKind, railImage]);

  const updateInteraction = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointerToLogical(event, REFLECTION_WIDTH, REFLECTION_HEIGHT);
    if (draggingRef.current === "mirror") {
      onMirrorXChange(clamp(point.x, 610, 760));
      return;
    }
    if (draggingRef.current === "hit") {
      const local = worldToLocal(
        geometry.vertex,
        geometry.axis,
        geometry.up,
        point,
      );
      onHitOffsetChange(clamp(local.y, -50, 50));
      return;
    }
    onLaserPositionChange({
      x: clamp(point.x, 75, 555),
      y: clamp(point.y, 82, 355),
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className="cm-canvas cm-reflection-canvas"
      aria-label={`Lazerin serbestçe taşındığı, çarpma noktası ve küresel ${mirrorKind === "concave" ? "çukur" : "tümsek"} aynası ayarlanabilen düzenek`}
      onPointerDown={(event) => {
        const point = pointerToLogical(event, REFLECTION_WIDTH, REFLECTION_HEIGHT);
        const nearHit = Math.hypot(point.x - geometry.hit.x, point.y - geometry.hit.y) < 28;
        const nearMount =
          Math.abs(point.x - geometry.vertex.x) < 76 &&
          point.y > geometry.vertex.y + 64 &&
          point.y < geometry.vertex.y + 205;
        draggingRef.current = nearHit ? "hit" : nearMount ? "mirror" : "laser";
        event.currentTarget.setPointerCapture(event.pointerId);
        updateInteraction(event);
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) updateInteraction(event);
      }}
      onPointerUp={(event) => {
        draggingRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        draggingRef.current = null;
      }}
    />
  );
}

function solveImage(
  objectDistance: number,
  focalLength: number,
  mirrorKind: MirrorKind,
) {
  if (mirrorKind === "convex") {
    const signedFocalLength = -focalLength;
    const imageDistance =
      (signedFocalLength * objectDistance) /
      (objectDistance - signedFocalLength);
    const magnification = -imageDistance / objectDistance;
    return {
      imageDistance,
      magnification,
      title: "Sanal görüntü · düz · küçük",
      description: "Görüntü aynanın arkasında, ayna ile F arasında oluşur.",
      tone: "virtual",
    };
  }

  if (Math.abs(objectDistance - focalLength) < 0.001) {
    return {
      imageDistance: null,
      magnification: null,
      title: "Görüntü sonsuzda",
      description: "Yansıyan ışınlar birbirine paralel ilerler; sonlu bir görüntü oluşmaz.",
      tone: "infinite",
    };
  }

  const imageDistance = (focalLength * objectDistance) / (objectDistance - focalLength);
  const magnification = -imageDistance / objectDistance;
  if (objectDistance > 2 * focalLength) {
    return {
      imageDistance,
      magnification,
      title: "Gerçek · ters · küçük",
      description: "Görüntü F ile C arasında oluşur.",
      tone: "real",
    };
  }
  if (Math.abs(objectDistance - 2 * focalLength) < 0.001) {
    return {
      imageDistance,
      magnification,
      title: "Gerçek · ters · aynı boy",
      description: "Cisim ve görüntü C noktasındadır.",
      tone: "real",
    };
  }
  if (objectDistance > focalLength) {
    return {
      imageDistance,
      magnification,
      title: "Gerçek · ters · büyük",
      description: "Görüntü C noktasının ilerisinde oluşur.",
      tone: "real",
    };
  }
  return {
    imageDistance,
    magnification,
    title: "Sanal görüntü · düz · büyük",
    description: "Görüntü aynanın arkasında oluşur.",
    tone: "virtual",
  };
}

function drawRuler(
  context: CanvasRenderingContext2D,
  vertex: Point,
  axis: Vector,
  up: Vector,
) {
  const rulerStart = add(vertex, axis, 450);
  const rulerEnd = add(vertex, axis, -115);
  const offset = -122;
  const start = add(rulerStart, up, offset);
  const end = add(rulerEnd, up, offset);

  context.save();
  context.strokeStyle = "#d69527";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.fillStyle = "#385d61";
  context.font = "700 9px Arial";
  context.textAlign = "center";
  for (let cm = -10; cm <= 45; cm += 1) {
    const location = add(add(vertex, axis, cm * PIXELS_PER_CM), up, offset);
    const tick = cm % 5 === 0 ? 12 : 6;
    const tickEnd = add(location, up, tick);
    context.lineWidth = cm % 5 === 0 ? 2 : 1;
    context.beginPath();
    context.moveTo(location.x, location.y);
    context.lineTo(tickEnd.x, tickEnd.y);
    context.stroke();
    if (cm >= 0 && cm % 5 === 0) {
      const label = add(location, up, 25);
      context.fillText(String(cm), label.x, label.y);
    }
  }
  const unit = add(add(vertex, axis, 450), up, offset + 25);
  context.fillText("cm", unit.x, unit.y);
  context.restore();
}

function drawStrokeCollection(
  context: CanvasRenderingContext2D,
  strokes: DrawStroke[],
  transform: (point: Point) => Point,
  opacity = 1,
  dashed = false,
) {
  context.save();
  context.globalAlpha = opacity;
  context.setLineDash(dashed ? [5, 4] : []);
  context.lineCap = "round";
  context.lineJoin = "round";
  strokes.forEach((stroke) => {
    if (stroke.points.length < 2) return;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.beginPath();
    stroke.points.forEach((point, index) => {
      const mapped = transform(point);
      if (index === 0) context.moveTo(mapped.x, mapped.y);
      else context.lineTo(mapped.x, mapped.y);
    });
    context.stroke();
  });
  context.restore();
}

function ConcaveImageCanvas({
  mirrorKind,
  mirrorAngle,
  objectDistance,
  focalLength,
  strokes,
  penColor,
  penWidth,
  showRays,
  onStrokesChange,
}: {
  mirrorKind: MirrorKind;
  mirrorAngle: number;
  objectDistance: number;
  focalLength: number;
  strokes: DrawStroke[];
  penColor: string;
  penWidth: number;
  showRays: boolean;
  onStrokesChange: (strokes: DrawStroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeRef = useRef<number | null>(null);
  const strokesRef = useRef(strokes);
  const benchImage = useCanvasImage(LAB_BENCH_IMAGE);
  const railImage = useCanvasImage(OPTICAL_RAIL_IMAGE);
  const mirrorImage = useCanvasImage(
    mirrorKind === "concave" ? CONCAVE_MIRROR_IMAGE : CONVEX_MIRROR_IMAGE,
  );
  const solution = useMemo(
    () => solveImage(objectDistance, focalLength, mirrorKind),
    [focalLength, mirrorKind, objectDistance],
  );

  const geometry = useMemo(() => {
    const vertex = { x: mirrorKind === "convex" ? 590 : 700, y: 270 };
    const { axis, up } = mirrorAxes(mirrorAngle);
    const objectCenter = add(vertex, axis, objectDistance * PIXELS_PER_CM);
    return { vertex, axis, up, objectCenter };
  }, [mirrorAngle, mirrorKind, objectDistance]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const context = prepareCanvas(canvas, IMAGE_WIDTH, IMAGE_HEIGHT);
      if (!context) return;
      const { vertex, axis, up, objectCenter } = geometry;

      drawBench(context, IMAGE_WIDTH, IMAGE_HEIGHT, benchImage);
      drawOpticalRail(context, railImage, 420);
      drawAxisAndMarkers(
        context,
        vertex,
        axis,
        up,
        focalLength * PIXELS_PER_CM,
        590,
        mirrorKind,
      );
      drawRuler(context, vertex, axis, up);

      const frameCorners = [
        localToWorld(objectCenter, axis, up, { x: -45, y: -92 }),
        localToWorld(objectCenter, axis, up, { x: 45, y: -92 }),
        localToWorld(objectCenter, axis, up, { x: 45, y: 92 }),
        localToWorld(objectCenter, axis, up, { x: -45, y: 92 }),
      ];
      context.save();
      context.fillStyle = "rgba(255,255,255,0.54)";
      context.strokeStyle = "#e09a2a";
      context.lineWidth = 2;
      context.setLineDash([8, 6]);
      context.beginPath();
      frameCorners.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.fill();
      context.stroke();
      const labelPoint = add(objectCenter, up, 111);
      context.setLineDash([]);
      context.fillStyle = "#a56512";
      context.font = "900 11px Arial";
      context.textAlign = "center";
      context.fillText("CİSMİ BU ALANA ÇİZ", labelPoint.x, labelPoint.y);
      context.restore();

      drawStrokeCollection(
        context,
        strokes,
        (point) => localToWorld(objectCenter, axis, up, point),
      );

      let imageCenter: Point | null = null;
      let imageMagnification: number | null = null;
      if (solution.imageDistance !== null && solution.magnification !== null) {
        imageCenter = add(vertex, axis, solution.imageDistance * PIXELS_PER_CM);
        imageMagnification = solution.magnification;
        drawStrokeCollection(
          context,
          strokes,
          (point) =>
            localToWorld(imageCenter as Point, axis, up, {
              x: point.x * Math.abs(imageMagnification as number),
              y: point.y * (imageMagnification as number),
            }),
          solution.tone === "virtual" ? 0.48 : 0.9,
          solution.tone === "virtual",
        );
      }

      const maxObjectHeight = clamp(
        strokes.flatMap((stroke) => stroke.points).reduce((highest, point) => Math.max(highest, point.y), 62),
        30,
        86,
      );
      const objectTop = add(objectCenter, up, maxObjectHeight);

      if (showRays && strokes.length > 0) {
        const firstHit = add(vertex, up, maxObjectHeight);
        const focus = add(
          vertex,
          axis,
          focalLength * PIXELS_PER_CM * (mirrorKind === "concave" ? 1 : -1),
        );
        const imageTop =
          imageCenter && imageMagnification !== null
            ? add(imageCenter, up, maxObjectHeight * imageMagnification)
            : null;

        drawGlowLine(context, objectTop, firstHit, "#ee3b45");
        if (imageTop && solution.tone === "real") {
          drawGlowLine(context, firstHit, imageTop, "#ee3b45");
        } else {
          const throughFocus = normalize(
            mirrorKind === "concave"
              ? subtract(focus, firstHit)
              : subtract(firstHit, focus),
          );
          const outgoing = add(firstHit, throughFocus, 430);
          drawGlowLine(context, firstHit, outgoing, "#ee3b45");
          if (imageTop) drawGlowLine(context, firstHit, imageTop, "#ee3b45", true);
        }

        const denominator =
          mirrorKind === "concave"
            ? objectDistance - focalLength
            : objectDistance + focalLength;
        const secondHeight =
          Math.abs(denominator) < 0.001
            ? 0
            : clamp(
                ((mirrorKind === "concave" ? -1 : 1) *
                  maxObjectHeight *
                  focalLength) /
                  denominator,
                -108,
                108,
              );
        const secondHit = add(vertex, up, secondHeight);
        drawGlowLine(context, objectTop, secondHit, "#35a3e6");
        if (imageTop && solution.tone === "real") {
          drawGlowLine(context, secondHit, imageTop, "#35a3e6");
        } else {
          const parallelEnd = add(secondHit, axis, 470);
          drawGlowLine(context, secondHit, parallelEnd, "#35a3e6");
          if (imageTop) drawGlowLine(context, secondHit, imageTop, "#35a3e6", true);
        }

        const center = add(
          vertex,
          axis,
          focalLength * PIXELS_PER_CM * 2 *
            (mirrorKind === "concave" ? 1 : -1),
        );
        context.save();
        context.strokeStyle = "#8b63cc";
        context.lineWidth = 1.8;
        context.setLineDash([7, 6]);
        context.beginPath();
        if (mirrorKind === "concave") {
          context.moveTo(objectTop.x, objectTop.y);
          context.lineTo(center.x, center.y);
        } else {
          const thirdHeight =
            (maxObjectHeight * focalLength * 2) /
            (objectDistance + focalLength * 2);
          const thirdHit = add(vertex, up, thirdHeight);
          context.setLineDash([]);
          context.moveTo(objectTop.x, objectTop.y);
          context.lineTo(thirdHit.x, thirdHit.y);
          context.stroke();
          context.setLineDash([7, 6]);
          context.beginPath();
          context.moveTo(thirdHit.x, thirdHit.y);
          context.lineTo(center.x, center.y);
        }
        context.stroke();
        context.restore();
      }

      const photoMirrorDrawn = drawMountedMirror(
        context,
        mirrorImage,
        vertex,
        mirrorAngle,
      );
      if (!photoMirrorDrawn) {
        drawSphericalMirror(
          context,
          vertex,
          axis,
          up,
          focalLength * PIXELS_PER_CM * 2,
          115,
          mirrorKind,
        );
      }

      context.fillStyle = "rgba(255,255,255,0.93)";
      context.beginPath();
      context.roundRect(22, 20, 276, 55, 12);
      context.fill();
      context.fillStyle = "#244e52";
      context.font = "900 13px Arial";
      context.textAlign = "left";
      context.fillText("ÇİZİM VE GÖRÜNTÜ DÜZENEĞİ", 38, 42);
      context.fillStyle = "#668084";
      context.font = "700 11px Arial";
      context.fillText("Turuncu alana cismini serbestçe çiz.", 38, 61);

      if (solution.imageDistance === null) {
        context.fillStyle = "rgba(255,255,255,0.92)";
        context.beginPath();
        context.roundRect(570, 20, 298, 55, 12);
        context.fill();
        context.fillStyle = "#b36b17";
        context.font = "900 13px Arial";
        context.textAlign = "center";
        context.fillText("GÖRÜNTÜ SONSUZDA · IŞINLAR PARALEL", 719, 52);
      } else if (
        imageCenter &&
        (imageCenter.x < 15 || imageCenter.x > IMAGE_WIDTH - 15 || imageCenter.y < 15 || imageCenter.y > IMAGE_HEIGHT - 15)
      ) {
        const edgePoint = {
          x: clamp(imageCenter.x, 38, IMAGE_WIDTH - 38),
          y: clamp(imageCenter.y, 92, IMAGE_HEIGHT - 38),
        };
        context.fillStyle = solution.tone === "real" ? "#2f8583" : "#8b63cc";
        context.beginPath();
        context.arc(edgePoint.x, edgePoint.y, 23, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#fff";
        context.font = "900 11px Arial";
        context.textAlign = "center";
        context.fillText("GÖRÜNTÜ", edgePoint.x, edgePoint.y + 4);
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [benchImage, focalLength, geometry, mirrorAngle, mirrorImage, mirrorKind, objectDistance, railImage, showRays, solution, strokes]);

  const appendPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerToLogical(event, IMAGE_WIDTH, IMAGE_HEIGHT);
    const local = worldToLocal(
      geometry.objectCenter,
      geometry.axis,
      geometry.up,
      pointer,
    );
    if (Math.abs(local.x) > 45 || Math.abs(local.y) > 92) return;
    const activeId = activeStrokeRef.current;
    if (activeId === null) return;
    const next = strokesRef.current.map((stroke) =>
      stroke.id === activeId
        ? { ...stroke, points: [...stroke.points, local] }
        : stroke,
    );
    strokesRef.current = next;
    onStrokesChange(next);
  };

  return (
    <canvas
      ref={canvasRef}
      className="cm-canvas cm-image-canvas"
      aria-label={`Öğrencinin cismini çizdiği, döndürülebilir ${mirrorKind === "concave" ? "çukur" : "tümsek"} aynada görüntü oluşumu düzeneği`}
      onPointerDown={(event) => {
        const pointer = pointerToLogical(event, IMAGE_WIDTH, IMAGE_HEIGHT);
        const local = worldToLocal(
          geometry.objectCenter,
          geometry.axis,
          geometry.up,
          pointer,
        );
        if (Math.abs(local.x) > 45 || Math.abs(local.y) > 92) return;
        const id = Date.now();
        const next = [
          ...strokesRef.current,
          { id, color: penColor, width: penWidth, points: [local] },
        ];
        activeStrokeRef.current = id;
        strokesRef.current = next;
        onStrokesChange(next);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (activeStrokeRef.current !== null) appendPoint(event);
      }}
      onPointerUp={(event) => {
        activeStrokeRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        activeStrokeRef.current = null;
      }}
    />
  );
}

const formatNumber = (value: number, digits = 1) =>
  Number(value.toFixed(digits)).toLocaleString("tr-TR");

export default function SphericalMirrorLab({
  mirrorKind = "concave",
}: {
  mirrorKind?: MirrorKind;
}) {
  const isConvex = mirrorKind === "convex";
  const mirrorLabel = isConvex ? "Tümsek ayna" : "Çukur ayna";
  const mirrorImageSource = isConvex ? CONVEX_MIRROR_IMAGE : CONCAVE_MIRROR_IMAGE;
  const [mode, setMode] = useState<ExperimentMode>("reflection");
  const [laserPosition, setLaserPosition] = useState<Point>({ x: 260, y: 205 });
  const [reflectionMirrorX, setReflectionMirrorX] = useState(680);
  const [reflectionMirrorAngle, setReflectionMirrorAngle] = useState(0);
  const [hitOffset, setHitOffset] = useState(0);
  const [laserOn, setLaserOn] = useState(true);
  const [reflectionReadings, setReflectionReadings] = useState<ReflectionReading[]>([]);

  const [imageMirrorAngle, setImageMirrorAngle] = useState(0);
  const [objectDistance, setObjectDistance] = useState(30);
  const [focalLength, setFocalLength] = useState(12);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [penColor, setPenColor] = useState("#135f65");
  const [penWidth, setPenWidth] = useState(5);
  const [showRays, setShowRays] = useState(true);
  const [imageReadings, setImageReadings] = useState<ImageReading[]>([]);
  const [answers, setAnswers] = useState(["", "", "", ""]);

  const reflectionGeometry = useMemo(() => {
    const { axis, up } = mirrorAxes(reflectionMirrorAngle);
    const vertex = { x: reflectionMirrorX, y: 205 };
    const center = add(
      vertex,
      axis,
      mirrorKind === "concave" ? RADIUS_OF_CURVATURE : -RADIUS_OF_CURVATURE,
    );
    const sag =
      RADIUS_OF_CURVATURE -
      Math.sqrt(RADIUS_OF_CURVATURE ** 2 - hitOffset ** 2);
    const hit = localToWorld(vertex, axis, up, {
      x: mirrorKind === "concave" ? sag : -sag,
      y: hitOffset,
    });
    const normal = normalize(
      mirrorKind === "concave"
        ? subtract(center, hit)
        : subtract(hit, center),
    );
    const sourceDirection = normalize(subtract(laserPosition, hit));
    return {
      incidenceAngle: toDegrees(
        Math.acos(clamp(dot(sourceDirection, normal), -1, 1)),
      ),
    };
  }, [hitOffset, laserPosition, mirrorKind, reflectionMirrorAngle, reflectionMirrorX]);

  const imageResult = useMemo(
    () => solveImage(objectDistance, focalLength, mirrorKind),
    [focalLength, mirrorKind, objectDistance],
  );

  const recordReflection = () => {
    setReflectionReadings((current) => [
      ...current,
      {
        id: Date.now(),
        mirrorAngle: reflectionMirrorAngle,
        hitOffset,
        laserX: laserPosition.x,
        laserY: laserPosition.y,
        incidenceAngle: reflectionGeometry.incidenceAngle,
      },
    ]);
  };

  const recordImage = () => {
    setImageReadings((current) => [
      ...current,
      {
        id: Date.now(),
        mirrorAngle: imageMirrorAngle,
        objectDistance,
        focalLength,
        imageDistance: imageResult.imageDistance,
        magnification: imageResult.magnification,
        description: imageResult.title,
      },
    ]);
  };

  return (
    <section
      className={`cm-lab ${isConvex ? "cm-convex-lab" : ""}`}
      id={isConvex ? "tumsek-ayna-deneyi" : "cukur-ayna-deneyi"}
    >
      <div className="cm-hero">
        <div>
          <span>AYNALAR · DENEY {isConvex ? "03" : "02"} · TYMM</span>
          <h2>{mirrorLabel}yı döndür, cismini çiz, görüntüyü keşfet.</h2>
          <p>
            Lazer ışınının eğri yüzeyde nasıl yansıdığını incele. Ardından boş
            çalışma alanına kendi cismini çiz ve {isConvex
              ? "aynanın arkasındaki sanal görüntüsünü ölç."
              : "F–C konumuna göre görüntüsünü ölç."}
          </p>
        </div>
        <div className="cm-hero-badge" aria-label="İdeal küresel ayna modeli">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mirrorImageSource} alt="" draggable="false" />
          <b>İDEAL</b><small>KÜRESEL AYNA</small>
        </div>
      </div>

      <div className="cm-equipment-strip" aria-label="Deney araçları">
        <span><i className="cm-tool-laser" style={{ backgroundImage: `url(${REAL_LASER_IMAGE})` }} /><b>Lazer</b><small>Döndürülebilir</small></span>
        <span><i className="cm-tool-mirror" style={{ backgroundImage: `url(${mirrorImageSource})` }} /><b>{mirrorLabel}</b><small>Küresel yüzey</small></span>
        <span><i className="cm-tool-table" style={{ backgroundImage: `url(${ROTARY_MIRROR_IMAGE})` }} /><b>Döner tabla</b><small>Açı ayarlı</small></span>
        <span><i className="cm-tool-ruler" /><b>Cetvel</b><small>cm ölçekli</small></span>
        <span><i className="cm-tool-pen" /><b>Çizim kalemi</b><small>Serbest çizim</small></span>
      </div>

      <div className="cm-mode-switch" role="tablist" aria-label={`${mirrorLabel} çalışmaları`}>
        <button
          type="button"
          className={mode === "reflection" ? "active" : ""}
          onClick={() => setMode("reflection")}
        >
          <small>ÇALIŞMA 01</small><b>Lazerle yansıma</b><span>Yüzey normalini ve i = r eşitliğini incele.</span>
        </button>
        <button
          type="button"
          className={mode === "image" ? "active" : ""}
          onClick={() => setMode("image")}
        >
          <small>ÇALIŞMA 02</small><b>Cismini çiz, görüntüyü oluştur</b><span>{isConvex ? "F ve C aynanın arkasındayken görüntüyü incele." : "F ve C’ye göre görüntü özelliklerini karşılaştır."}</span>
        </button>
      </div>

      {mode === "reflection" && (
        <div className="cm-panel">
          <div className="cm-panel-heading">
            <span>YANSIMA DENEYİ</span>
            <h3>Eğri yüzeyin her noktasında normal farklıdır.</h3>
            <p>Lazeri istediğin noktaya sürükle; ardından ayna açısını ve turuncu çarpma noktasını değiştir.</p>
          </div>
          <div className="cm-workspace">
            <div className="cm-stage">
              <ConcaveReflectionCanvas
                mirrorKind={mirrorKind}
                laserPosition={laserPosition}
                mirrorX={reflectionMirrorX}
                mirrorAngle={reflectionMirrorAngle}
                hitOffset={hitOffset}
                laserOn={laserOn}
                onLaserPositionChange={setLaserPosition}
                onMirrorXChange={setReflectionMirrorX}
                onHitOffsetChange={setHitOffset}
              />
              <div className="cm-stage-legend">
                <span><i className="red" /> Gelen ve yansıyan ışın</span>
                <span><i className="dashed" /> Çarpma noktasındaki normal</span>
              </div>
            </div>
            <aside className="cm-control-console">
              <div className="cm-digital-display">
                <small>İDEAL AÇI ÖLÇÜMÜ</small>
                <span><b>i</b>{formatNumber(reflectionGeometry.incidenceAngle)}°</span>
                <span><b>r</b>{formatNumber(reflectionGeometry.incidenceAngle)}°</span>
                <strong>i = r</strong>
              </div>
              <label>
                <span>Lazer yatay konumu <b>{formatNumber(laserPosition.x / 10)} cm</b></span>
                <input type="range" min="75" max="555" value={laserPosition.x} onChange={(event) => setLaserPosition((position) => ({ ...position, x: Number(event.target.value) }))} />
              </label>
              <label>
                <span>Lazer dikey konumu <b>üstten {formatNumber(laserPosition.y / 10)} cm</b></span>
                <input type="range" min="82" max="355" value={laserPosition.y} onChange={(event) => setLaserPosition((position) => ({ ...position, y: Number(event.target.value) }))} />
              </label>
              <label>
                <span>Ayna dönüş açısı <b>{reflectionMirrorAngle}°</b></span>
                <input type="range" min="-20" max="20" value={reflectionMirrorAngle} onChange={(event) => setReflectionMirrorAngle(Number(event.target.value))} />
              </label>
              <label>
                <span>Aynanın ray üzerindeki yeri <b>{formatNumber(reflectionMirrorX / 10)} cm</b></span>
                <input type="range" min="610" max="760" value={reflectionMirrorX} onChange={(event) => setReflectionMirrorX(Number(event.target.value))} />
              </label>
              <label>
                <span>Çarpma noktası <b>{hitOffset === 0 ? "merkez" : `${Math.abs(hitOffset)} px ${hitOffset > 0 ? "üst" : "alt"}`}</b></span>
                <input type="range" min="-50" max="50" value={hitOffset} onChange={(event) => setHitOffset(Number(event.target.value))} />
              </label>
              <div className="cm-console-actions">
                <button type="button" className={laserOn ? "active" : ""} onClick={() => setLaserOn((value) => !value)}>{laserOn ? "Lazeri kapat" : "Lazeri aç"}</button>
                <button type="button" onClick={() => { setLaserPosition({ x: 260, y: 205 }); setReflectionMirrorX(680); setReflectionMirrorAngle(0); setHitOffset(0); }}>Başlangıca dön</button>
              </div>
              <button className="cm-record-button" type="button" onClick={recordReflection}>Açı ölçümünü kaydet +</button>
            </aside>
          </div>

          <div className="cm-data-card">
            <div><span>ÖLÇÜM TABLOSU</span><h4>Yansıma kayıtların</h4><p>Lazerin başlangıç yerini, aynayı ve çarpma noktasını değiştirerek en az üç ölçüm al.</p></div>
            <div className="cm-table-wrap">
              <table>
                <thead><tr><th>#</th><th>Lazer konumu</th><th>Ayna</th><th>Çarpma noktası</th><th>i</th><th>r</th><th>Sonuç</th></tr></thead>
                <tbody>
                  {reflectionReadings.length === 0 ? (
                    <tr><td colSpan={7}>Henüz ölçüm kaydetmedin.</td></tr>
                  ) : reflectionReadings.map((reading, index) => (
                    <tr key={reading.id}><td>{index + 1}</td><td>{formatNumber(reading.laserX / 10)} · {formatNumber(reading.laserY / 10)} cm</td><td>{reading.mirrorAngle}°</td><td>{reading.hitOffset === 0 ? "Merkez" : `${Math.abs(reading.hitOffset)} px ${reading.hitOffset > 0 ? "üst" : "alt"}`}</td><td>{formatNumber(reading.incidenceAngle)}°</td><td>{formatNumber(reading.incidenceAngle)}°</td><td><b className="cm-equal-chip">i = r</b></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cm-law-grid">
            <article><span>01</span><b>Yerel normal</b><p>Küresel yüzeyde çarpma noktası ile C’yi birleştiren doğru normaldir.</p></article>
            <article><span>02</span><b>Eşit açılar</b><p>Gelme ve yansıma açıları her zaman bu normale göre ölçülür.</p></article>
            <article><span>03</span><b>Aynayı döndür</b><p>Ayna dönünce eksen, F, C ve yüzey normalleri birlikte döner.</p></article>
          </div>
        </div>
      )}

      {mode === "image" && (
        <div className="cm-panel">
          <div className="cm-panel-heading">
            <span>GÖRÜNTÜ OLUŞUMU</span>
            <h3>Boş alana cismini çiz; aynadaki karşılığını ölç.</h3>
            <p>Aynayı döndürmek için açı denetimini, konumu ölçmek için cetveli kullan.</p>
          </div>
          <div className="cm-workspace cm-image-workspace">
            <div className="cm-stage cm-image-stage">
              <ConcaveImageCanvas
                mirrorKind={mirrorKind}
                mirrorAngle={imageMirrorAngle}
                objectDistance={objectDistance}
                focalLength={focalLength}
                strokes={strokes}
                penColor={penColor}
                penWidth={penWidth}
                showRays={showRays}
                onStrokesChange={setStrokes}
              />
              <div className="cm-stage-legend">
                <span><i className="red" /> F doğrultulu ışın</span>
                <span><i className="blue" /> Eksene paralel ışın</span>
                <span><i className="purple" /> C doğrultusu</span>
              </div>
            </div>
            <aside className="cm-control-console cm-drawing-controls">
              <div className={`cm-image-summary ${imageResult.tone}`}>
                <small>ANLIK GÖRÜNTÜ</small>
                <strong>{imageResult.title}</strong>
                <span>{imageResult.description}</span>
                <div><b>dᵢ</b>{imageResult.imageDistance === null ? "∞" : `${formatNumber(Math.abs(imageResult.imageDistance))} cm`}</div>
                <div><b>Boy oranı</b>{imageResult.magnification === null ? "—" : `${formatNumber(Math.abs(imageResult.magnification), 2)}×`}</div>
              </div>
              <label>
                <span>Cisim uzaklığı <b>{objectDistance} cm</b></span>
                <input type="range" min="8" max="42" value={objectDistance} onChange={(event) => setObjectDistance(Number(event.target.value))} />
              </label>
              <label>
                <span>Odak uzaklığı · f <b>{focalLength} cm</b></span>
                <input type="range" min="9" max="15" value={focalLength} onChange={(event) => setFocalLength(Number(event.target.value))} />
              </label>
              <label>
                <span>Ayna dönüş açısı <b>{imageMirrorAngle}°</b></span>
                <input type="range" min="-20" max="20" value={imageMirrorAngle} onChange={(event) => setImageMirrorAngle(Number(event.target.value))} />
              </label>
              <div className="cm-drawing-tools">
                <span>Kalem rengi</span>
                <div className="cm-color-tools">
                  {["#135f65", "#ee3b45", "#2e77c7", "#e59124", "#7047a5"].map((color) => (
                    <button key={color} type="button" className={penColor === color ? "active" : ""} style={{ background: color }} aria-label={`${color} çizim rengi`} onClick={() => setPenColor(color)} />
                  ))}
                </div>
                <span>Kalem kalınlığı</span>
                <div className="cm-width-tools">
                  {[3, 5, 8].map((width) => <button key={width} type="button" className={penWidth === width ? "active" : ""} onClick={() => setPenWidth(width)}>{width}</button>)}
                </div>
              </div>
              <label className="cm-check-control"><input type="checkbox" checked={showRays} onChange={(event) => setShowRays(event.target.checked)} /><span>Temel ışınları göster</span></label>
              <div className="cm-console-actions cm-sketch-actions">
                <button type="button" onClick={() => setStrokes((current) => current.slice(0, -1))}>Son çizgiyi sil</button>
                <button type="button" onClick={() => setStrokes([])}>Çizimi temizle</button>
                <button type="button" onClick={() => setImageMirrorAngle(0)}>Aynayı dik konuma getir</button>
              </div>
              <button className="cm-record-button" type="button" onClick={recordImage} disabled={strokes.length === 0}>Cetvel ölçümünü kaydet +</button>
            </aside>
          </div>

          <div className="cm-data-card">
            <div><span>ÖLÇÜM TABLOSU</span><h4>{isConvex ? "Cisim uzaklıklarını karşılaştır" : "F–C konumlarını karşılaştır"}</h4><p>Cismini çizdikten sonra farklı uzaklıklarda ölçüm kaydet.</p></div>
            <div className="cm-table-wrap">
              <table>
                <thead><tr><th>#</th><th>Ayna</th><th>dₒ</th><th>f</th><th>dᵢ</th><th>Boy oranı</th><th>Görüntü</th></tr></thead>
                <tbody>
                  {imageReadings.length === 0 ? (
                    <tr><td colSpan={7}>Çizimini yap ve ilk ölçümünü kaydet.</td></tr>
                  ) : imageReadings.map((reading, index) => (
                    <tr key={reading.id}><td>{index + 1}</td><td>{reading.mirrorAngle}°</td><td>{reading.objectDistance} cm</td><td>{reading.focalLength} cm</td><td>{reading.imageDistance === null ? "∞" : `${formatNumber(Math.abs(reading.imageDistance))} cm`}</td><td>{reading.magnification === null ? "—" : `${formatNumber(Math.abs(reading.magnification), 2)}×`}</td><td><b>{reading.description}</b></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cm-evidence-section">
            <div><span>{isConvex ? "UZAKLIK HARİTASI" : "F–C HARİTASI"}</span><h4>{isConvex ? "Beş cisim uzaklığını kendi çiziminle dene." : "Beş kritik konumu kendi çiziminle dene."}</h4></div>
            {isConvex ? (
              <div className="cm-evidence-grid">
                <button type="button" onClick={() => setObjectDistance(42)}><b>Çok uzakta</b><small>Sanal · düz · en küçük</small></button>
                <button type="button" onClick={() => setObjectDistance(34)}><b>Uzakta</b><small>Sanal · düz · küçük</small></button>
                <button type="button" onClick={() => setObjectDistance(26)}><b>Orta uzaklıkta</b><small>Sanal · düz · küçük</small></button>
                <button type="button" onClick={() => setObjectDistance(16)}><b>Yakında</b><small>Sanal · düz · küçük</small></button>
                <button type="button" onClick={() => setObjectDistance(8)}><b>Çok yakında</b><small>Sanal · düz · cisme yaklaşır</small></button>
              </div>
            ) : (
              <div className="cm-evidence-grid">
                <button type="button" onClick={() => setObjectDistance(Math.min(42, focalLength * 3))}><b>C’nin dışında</b><small>Gerçek · ters · küçük</small></button>
                <button type="button" onClick={() => setObjectDistance(focalLength * 2)}><b>C noktasında</b><small>Gerçek · ters · aynı boy</small></button>
                <button type="button" onClick={() => setObjectDistance(focalLength + Math.max(2, Math.round(focalLength / 2)))}><b>F ile C arasında</b><small>Gerçek · ters · büyük</small></button>
                <button type="button" onClick={() => setObjectDistance(focalLength)}><b>F noktasında</b><small>Görüntü sonsuzda</small></button>
                <button type="button" onClick={() => setObjectDistance(Math.max(8, focalLength - 3))}><b>F ile ayna arasında</b><small>Sanal görüntü · düz · büyük</small></button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="cm-report">
        <div className="cm-report-heading">
          <span>TYMM · DENEY RAPORU</span>
          <h3>Kanıtını yaz, çıkarımını savun.</h3>
          <p>Kendi ölçümlerin ve çizdiğin ışınlar üzerinden kısa bir deney raporu oluştur.</p>
        </div>
        <div className="cm-report-grid">
          {[
            "Ayna döndüğünde yansıyan ışının yönü neden değişti? Yüzey normalini kullanarak açıkla.",
            `Lazer ${mirrorLabel.toLocaleLowerCase("tr-TR")}nın farklı noktalarına çarptığında normal doğrultusu nasıl değişti?`,
            isConvex
              ? "Cismi aynaya yaklaştırırken sanal görüntünün yeri ve boyu nasıl değişti?"
              : "Cismi C’nin dışından F’ye doğru taşırken görüntünün yeri, yönü ve boyu nasıl değişti?",
            isConvex
              ? "Yansıyan temel ışınların uzantıları neden aynanın arkasında kesişir?"
              : "Cisim F noktasındayken sonlu görüntü oluşmamasını çizdiğin temel ışınlarla açıkla.",
          ].map((question, index) => (
            <label key={question}><span><b>{index + 1}</b>{question}</span><textarea value={answers[index]} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} placeholder="Ölçüm ve gözlemine dayalı yanıtını yaz..." /></label>
          ))}
        </div>
      </div>
    </section>
  );
}
