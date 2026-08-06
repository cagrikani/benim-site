"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ExperimentMode = "reflection" | "image" | "vision";
type Point = { x: number; y: number };
type DrawStroke = {
  id: number;
  color: string;
  width: number;
  points: Point[];
};
type ReflectionReading = {
  id: string;
  laserAngle: number;
  mirrorAngle: number;
  incidenceAngle: number;
};
type ImageReading = {
  id: number;
  mirrorAngle: number;
  objectDistance: number;
  imageDistance: number;
  objectSize: number;
  imageSize: number;
};
type VisionObjectKind = "transparent" | "opaque";
type VisionObject = {
  id: number;
  kind: VisionObjectKind;
  x: number;
  y: number;
  radius: number;
};
type VisionAnalysis = {
  id: number;
  visible: boolean;
  status: "visible" | "outside" | "blocked";
  mirrorX: number;
  virtualY: number;
  blockerId?: number;
};

const DRAWING_WIDTH = 900;
const DRAWING_HEIGHT = 480;
const DRAWING_MIRROR_X = DRAWING_WIDTH / 2;
const DRAWING_MIRROR_Y = (DRAWING_HEIGHT - 56) / 2;
const DRAWING_PIXELS_PER_CM = 10;
const VISION_WIDTH = 900;
const VISION_HEIGHT = 500;
const VISION_MIRROR_Y = 190;
const VISION_EYE_Y = 420;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function mirrorLine(angle: number) {
  const radian = toRadians(angle);
  const direction = { x: -Math.sin(radian), y: Math.cos(radian) };
  const normal = { x: Math.cos(radian), y: Math.sin(radian) };
  return { direction, normal };
}

function reflectPointAcrossMirror(point: Point, angle: number): Point {
  const { direction } = mirrorLine(angle);
  const relativeX = point.x - DRAWING_MIRROR_X;
  const relativeY = point.y - DRAWING_MIRROR_Y;
  const projection = relativeX * direction.x + relativeY * direction.y;
  const projectedX = DRAWING_MIRROR_X + projection * direction.x;
  const projectedY = DRAWING_MIRROR_Y + projection * direction.y;
  return {
    x: projectedX * 2 - point.x,
    y: projectedY * 2 - point.y,
  };
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) /
      lengthSquared,
    0,
    1,
  );
  return Math.hypot(
    point.x - (start.x + progress * dx),
    point.y - (start.y + progress * dy),
  );
}

function analyzeVisionObjects(
  objects: VisionObject[],
  eyeX: number,
  mirrorWidth: number,
): VisionAnalysis[] {
  const mirrorHalf = mirrorWidth * 4;
  const mirrorLeft = VISION_WIDTH / 2 - mirrorHalf;
  const mirrorRight = VISION_WIDTH / 2 + mirrorHalf;
  const eye = { x: eyeX, y: VISION_EYE_Y - 25 };

  return objects.map((object) => {
    const virtualY = 2 * VISION_MIRROR_Y - object.y;
    const denominator = virtualY - eye.y;
    const progress = (VISION_MIRROR_Y - eye.y) / denominator;
    const mirrorX = eye.x + (object.x - eye.x) * progress;
    const inField = mirrorX >= mirrorLeft && mirrorX <= mirrorRight;
    if (!inField) {
      return { id: object.id, visible: false, status: "outside", mirrorX, virtualY };
    }

    const mirrorPoint = { x: mirrorX, y: VISION_MIRROR_Y };
    const blocker = objects.find((candidate) => {
      if (candidate.id === object.id || candidate.kind !== "opaque") return false;
      const candidatePoint = { x: candidate.x, y: candidate.y };
      const onEyePath =
        distanceToSegment(candidatePoint, eye, mirrorPoint) < candidate.radius + 5;
      const onObjectPath =
        distanceToSegment(candidatePoint, mirrorPoint, object) < candidate.radius + 5;
      return onEyePath || onObjectPath;
    });

    return {
      id: object.id,
      visible: !blocker,
      status: blocker ? "blocked" : "visible",
      mirrorX,
      virtualY,
      blockerId: blocker?.id,
    };
  });
}

function drawGlowLine(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: string,
  dashed = false,
) {
  context.save();
  context.setLineDash(dashed ? [8, 7] : []);
  context.lineCap = "round";
  context.strokeStyle = color;
  context.lineWidth = dashed ? 2 : 8;
  context.globalAlpha = dashed ? 0.6 : 0.15;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.lineWidth = dashed ? 1.5 : 2.5;
  context.globalAlpha = dashed ? 0.82 : 1;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.restore();
}

function drawArrowHead(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  context.save();
  context.translate(toX, toY);
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

function ReflectionCanvas({
  laserAngle,
  mirrorAngle,
  incidenceAngle,
  laserOn,
  onLaserAngleChange,
}: {
  laserAngle: number;
  mirrorAngle: number;
  incidenceAngle: number;
  laserOn: boolean;
  onLaserAngleChange: (angle: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 360);
      const height = 440;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.73;
      const radius = Math.min(width * 0.39, height * 0.58);
      const laserRadian = toRadians(laserAngle);
      const mirrorRadian = toRadians(mirrorAngle);
      const sourceVector = {
        x: -Math.sin(laserRadian),
        y: -Math.cos(laserRadian),
      };
      const incomingVector = { x: -sourceVector.x, y: -sourceVector.y };
      const normal = { x: Math.sin(mirrorRadian), y: -Math.cos(mirrorRadian) };
      const incomingDotNormal =
        incomingVector.x * normal.x + incomingVector.y * normal.y;
      const reflectedVector = {
        x: incomingVector.x - 2 * incomingDotNormal * normal.x,
        y: incomingVector.y - 2 * incomingDotNormal * normal.y,
      };
      const sourceX = centerX + sourceVector.x * radius;
      const sourceY = centerY + sourceVector.y * radius;
      const reflectedX = centerX + reflectedVector.x * (radius + 22);
      const reflectedY = centerY + reflectedVector.y * (radius + 22);

      context.save();
      context.strokeStyle = "rgba(216, 234, 230, 0.22)";
      context.lineWidth = 1;
      for (const ring of [0.32, 0.57, 0.82, 1]) {
        context.beginPath();
        context.arc(centerX, centerY, radius * ring, Math.PI, Math.PI * 2);
        context.stroke();
      }

      for (let tick = -80; tick <= 80; tick += 5) {
        const radian = (tick * Math.PI) / 180;
        const outerX = centerX + Math.sin(radian) * radius;
        const outerY = centerY - Math.cos(radian) * radius;
        const length = tick % 10 === 0 ? 12 : 6;
        context.strokeStyle =
          tick % 10 === 0
            ? "rgba(232, 242, 239, 0.7)"
            : "rgba(232, 242, 239, 0.34)";
        context.beginPath();
        context.moveTo(
          centerX + Math.sin(radian) * (radius - length),
          centerY - Math.cos(radian) * (radius - length),
        );
        context.lineTo(outerX, outerY);
        context.stroke();
        if (tick % 10 === 0) {
          context.fillStyle = "rgba(232, 242, 239, 0.75)";
          context.font = "700 9px Arial";
          context.textAlign = "center";
          context.fillText(
            String(Math.abs(tick)),
            centerX + Math.sin(radian) * (radius - 27),
            centerY - Math.cos(radian) * (radius - 27) + 4,
          );
        }
      }

      context.setLineDash([7, 7]);
      context.strokeStyle = "rgba(255,255,255,0.75)";
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(centerX - normal.x * 22, centerY - normal.y * 22);
      context.lineTo(
        centerX + normal.x * (radius + 30),
        centerY + normal.y * (radius + 30),
      );
      context.stroke();
      context.setLineDash([]);

      context.strokeStyle = "rgba(255, 255, 255, 0.8)";
      context.lineWidth = 1.6;
      const normalCanvasAngle = Math.atan2(normal.y, normal.x);
      const sourceCanvasAngle = Math.atan2(sourceVector.y, sourceVector.x);
      const reflectedCanvasAngle = Math.atan2(
        reflectedVector.y,
        reflectedVector.x,
      );
      context.beginPath();
      context.arc(
        centerX,
        centerY,
        52,
        sourceCanvasAngle,
        normalCanvasAngle,
        mirrorAngle < -laserAngle,
      );
      context.stroke();
      context.beginPath();
      context.arc(
        centerX,
        centerY,
        52,
        normalCanvasAngle,
        reflectedCanvasAngle,
        mirrorAngle < -laserAngle,
      );
      context.stroke();

      if (laserOn) {
        drawGlowLine(
          context,
          sourceX - incomingVector.x * 31,
          sourceY - incomingVector.y * 31,
          centerX,
          centerY,
          "#ff4e42",
        );
        drawGlowLine(
          context,
          centerX,
          centerY,
          reflectedX,
          reflectedY,
          "#ff5d4d",
        );
        drawArrowHead(
          context,
          sourceX,
          sourceY,
          centerX - incomingVector.x * 38,
          centerY - incomingVector.y * 38,
          "#fff0d5",
        );
        drawArrowHead(
          context,
          centerX,
          centerY,
          centerX + reflectedVector.x * 85,
          centerY + reflectedVector.y * 85,
          "#fff0d5",
        );
        context.fillStyle = "#fff8db";
        context.shadowColor = "#ff5145";
        context.shadowBlur = 20;
        context.beginPath();
        context.arc(centerX, centerY, 5, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }

      context.save();
      context.translate(sourceX, sourceY);
      context.rotate(Math.atan2(incomingVector.y, incomingVector.x));
      const laserGradient = context.createLinearGradient(-52, 0, 39, 0);
      laserGradient.addColorStop(0, "#071116");
      laserGradient.addColorStop(0.5, "#31474e");
      laserGradient.addColorStop(1, "#0a151a");
      context.fillStyle = laserGradient;
      context.strokeStyle = "#61787e";
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-53, -18, 83, 36, 9);
      context.fill();
      context.stroke();
      context.fillStyle = laserOn ? "#ff5547" : "#657276";
      context.beginPath();
      context.arc(31, 0, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#a9bdc0";
      context.font = "800 7px Arial";
      context.textAlign = "center";
      context.fillText("LAZER", -13, 3);
      context.restore();

      context.save();
      context.translate(centerX, centerY);
      context.rotate(mirrorRadian);
      const mirrorGradient = context.createLinearGradient(-112, 0, 112, 0);
      mirrorGradient.addColorStop(0, "#70888d");
      mirrorGradient.addColorStop(0.18, "#eff7f4");
      mirrorGradient.addColorStop(0.5, "#9db1b4");
      mirrorGradient.addColorStop(0.82, "#f4faf8");
      mirrorGradient.addColorStop(1, "#5f777c");
      context.fillStyle = "#112931";
      context.fillRect(-122, 6, 244, 21);
      context.fillStyle = mirrorGradient;
      context.fillRect(-112, -1, 224, 10);
      context.fillStyle = "#203b43";
      context.beginPath();
      context.roundRect(-58, 25, 116, 18, 5);
      context.fill();
      context.restore();

      context.fillStyle = "rgba(238, 247, 244, 0.82)";
      context.font = "800 10px Arial";
      context.textAlign = "center";
      context.fillText(
        "NORMAL",
        centerX + normal.x * (radius + 38),
        centerY + normal.y * (radius + 38),
      );
      context.fillStyle = "#ff9187";
      context.fillText(`i = ${incidenceAngle}°`, centerX - 58, centerY - 48);
      context.fillStyle = "#ffd17b";
      context.fillText(`r = ${incidenceAngle}°`, centerX + 58, centerY - 48);
      context.fillStyle = "rgba(238, 247, 244, 0.7)";
      context.fillText(`AYNA ${mirrorAngle > 0 ? "+" : ""}${mirrorAngle}°`, centerX, centerY + 61);
      context.restore();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [incidenceAngle, laserAngle, laserOn, mirrorAngle]);

  const updateAngle = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !draggingRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width * 0.5;
    const centerY = rect.height * 0.73;
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const nextAngle = Math.round(
      (Math.atan2(
        Math.max(0, centerX - localX),
        Math.max(10, centerY - localY),
      ) *
        180) /
        Math.PI,
    );
    onLaserAngleChange(clamp(nextAngle, 5, 60));
  };

  return (
    <canvas
      ref={canvasRef}
      className="pm-reflection-canvas"
      height={440}
      aria-label={`Ayna ${mirrorAngle} derece döndürülmüş; lazer ${incidenceAngle} derece gelme açısıyla geliyor ve aynı açıyla yansıyor`}
      onPointerDown={(event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateAngle(event);
      }}
      onPointerMove={updateAngle}
      onPointerUp={(event) => {
        draggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    />
  );
}

function getDrawingMeasurements(strokes: DrawStroke[], mirrorAngle: number) {
  const points = strokes.flatMap((stroke) => stroke.points);
  if (!points.length) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const { normal } = mirrorLine(mirrorAngle);
  const signedDistance =
    (centerX - DRAWING_MIRROR_X) * normal.x +
    (centerY - DRAWING_MIRROR_Y) * normal.y;
  const mirrorFoot = {
    x: centerX - signedDistance * normal.x,
    y: centerY - signedDistance * normal.y,
  };
  const imageCenter = reflectPointAcrossMirror(
    { x: centerX, y: centerY },
    mirrorAngle,
  );
  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX,
    centerY,
    mirrorFoot,
    imageCenter,
    objectDistance:
      Math.round((Math.abs(signedDistance) / DRAWING_PIXELS_PER_CM) * 10) / 10,
    width:
      Math.round(((maxX - minX) / DRAWING_PIXELS_PER_CM) * 10) / 10,
    height:
      Math.round(((maxY - minY) / DRAWING_PIXELS_PER_CM) * 10) / 10,
    size:
      Math.round(
        (Math.hypot(maxX - minX, maxY - minY) / DRAWING_PIXELS_PER_CM) *
          10,
      ) / 10,
  };
}

function drawDimension(
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  label: string,
  color: string,
) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1.5;
  context.setLineDash([5, 4]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.setLineDash([]);
  drawArrowHead(context, end.x, end.y, start.x, start.y, color);
  drawArrowHead(context, start.x, start.y, end.x, end.y, color);
  context.font = "800 10px Arial";
  context.textAlign = "center";
  context.translate((start.x + end.x) / 2, (start.y + end.y) / 2);
  context.rotate(angle);
  context.fillText(label, 0, -8);
  context.restore();
}

function DrawingMirrorCanvas({
  strokes,
  color,
  penWidth,
  mirrorAngle,
  showMeasurements,
  onStrokesChange,
}: {
  strokes: DrawStroke[];
  color: string;
  penWidth: number;
  mirrorAngle: number;
  showMeasurements: boolean;
  onStrokesChange: (update: (current: DrawStroke[]) => DrawStroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = DRAWING_WIDTH * ratio;
    canvas.height = DRAWING_HEIGHT * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, DRAWING_WIDTH, DRAWING_HEIGHT);

    const background = context.createLinearGradient(0, 0, 0, DRAWING_HEIGHT);
    background.addColorStop(0, "#f7fbfa");
    background.addColorStop(1, "#e9f2ef");
    context.fillStyle = background;
    context.fillRect(0, 0, DRAWING_WIDTH, DRAWING_HEIGHT);

    context.strokeStyle = "rgba(60, 103, 110, 0.1)";
    context.lineWidth = 1;
    for (let x = 30; x < DRAWING_WIDTH; x += DRAWING_PIXELS_PER_CM) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, DRAWING_HEIGHT - 56);
      context.stroke();
    }
    for (let y = 30; y < DRAWING_HEIGHT - 56; y += DRAWING_PIXELS_PER_CM) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(DRAWING_WIDTH, y);
      context.stroke();
    }

    context.fillStyle = "#49676d";
    context.font = "900 10px Arial";
    context.textAlign = "center";
    context.fillText("CİSMİ BU ALANA ÇİZ", 225, 24);
    context.fillStyle = "#167e91";
    context.fillText("AYNADAKİ SANAL GÖRÜNTÜ", 675, 24);

    const drawStroke = (stroke: DrawStroke, mirrored: boolean) => {
      if (!stroke.points.length) return;
      context.save();
      context.globalAlpha = mirrored ? 0.58 : 1;
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      stroke.points.forEach((point, index) => {
        const drawnPoint = mirrored
          ? reflectPointAcrossMirror(point, mirrorAngle)
          : point;
        if (index === 0) context.moveTo(drawnPoint.x, drawnPoint.y);
        else context.lineTo(drawnPoint.x, drawnPoint.y);
      });
      if (stroke.points.length === 1) {
        const point = stroke.points[0];
        const drawnPoint = mirrored
          ? reflectPointAcrossMirror(point, mirrorAngle)
          : point;
        context.lineTo(drawnPoint.x + 0.1, drawnPoint.y + 0.1);
      }
      context.stroke();
      context.restore();
    };

    strokes.forEach((stroke) => drawStroke(stroke, false));
    strokes.forEach((stroke) => drawStroke(stroke, true));

    const measurements = getDrawingMeasurements(strokes, mirrorAngle);
    if (showMeasurements && measurements) {
      drawDimension(
        context,
        { x: measurements.centerX, y: measurements.centerY },
        measurements.mirrorFoot,
        `${measurements.objectDistance.toFixed(1)} cm`,
        "#167e91",
      );
      drawDimension(
        context,
        measurements.mirrorFoot,
        measurements.imageCenter,
        `${measurements.objectDistance.toFixed(1)} cm`,
        "#d47c21",
      );
      context.strokeStyle = "rgba(22, 126, 145, 0.62)";
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(measurements.centerX, measurements.centerY);
      context.lineTo(measurements.imageCenter.x, measurements.imageCenter.y);
      context.stroke();
      context.setLineDash([]);
    }

    context.save();
    context.translate(DRAWING_MIRROR_X, DRAWING_MIRROR_Y);
    context.rotate(toRadians(mirrorAngle));
    const mirrorGradient = context.createLinearGradient(-7, 0, 7, 0);
    mirrorGradient.addColorStop(0, "#425d63");
    mirrorGradient.addColorStop(0.35, "#eef9f7");
    mirrorGradient.addColorStop(0.58, "#93aaae");
    mirrorGradient.addColorStop(1, "#253f46");
    context.fillStyle = mirrorGradient;
    context.fillRect(-8, -190, 16, 380);
    context.fillStyle = "#1a353d";
    context.fillRect(-23, 183, 46, 9);
    context.restore();

    context.strokeStyle = "rgba(23, 63, 89, 0.45)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(
      DRAWING_MIRROR_X,
      DRAWING_MIRROR_Y,
      38,
      Math.PI / 2,
      Math.PI / 2 + toRadians(mirrorAngle),
      mirrorAngle < 0,
    );
    context.stroke();
    context.fillStyle = "#173f59";
    context.font = "900 9px Arial";
    context.textAlign = "center";
    context.fillText(
      `${mirrorAngle > 0 ? "+" : ""}${mirrorAngle}°`,
      DRAWING_MIRROR_X + 48,
      DRAWING_MIRROR_Y + 7,
    );

    const rulerY = DRAWING_HEIGHT - 48;
    context.fillStyle = "#e8c883";
    context.fillRect(0, rulerY, DRAWING_WIDTH, 48);
    context.strokeStyle = "#8d693f";
    context.lineWidth = 1;
    for (let cm = -45; cm <= 45; cm += 1) {
      const x = DRAWING_MIRROR_X + cm * DRAWING_PIXELS_PER_CM;
      const tickHeight = cm % 5 === 0 ? 19 : cm % 2 === 0 ? 12 : 7;
      context.beginPath();
      context.moveTo(x, rulerY);
      context.lineTo(x, rulerY + tickHeight);
      context.stroke();
      if (cm % 5 === 0) {
        context.fillStyle = "#624a31";
        context.font = "700 8px Arial";
        context.textAlign = "center";
        context.fillText(String(Math.abs(cm)), x, rulerY + 31);
      }
    }
    context.fillStyle = "#624a31";
    context.font = "900 8px Arial";
    context.textAlign = "left";
    context.fillText("cm", 8, DRAWING_HEIGHT - 7);
    context.fillStyle = "#173f59";
    context.textAlign = "center";
    context.fillText("AYNA · 0", DRAWING_MIRROR_X, DRAWING_HEIGHT - 7);
  }, [mirrorAngle, showMeasurements, strokes]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rawPoint = {
      x: clamp(
        ((event.clientX - rect.left) / rect.width) * DRAWING_WIDTH,
        12,
        DRAWING_WIDTH - 12,
      ),
      y: clamp(
        ((event.clientY - rect.top) / rect.height) * DRAWING_HEIGHT,
        34,
        DRAWING_HEIGHT - 70,
      ),
    };
    const { normal } = mirrorLine(mirrorAngle);
    const signedDistance =
      (rawPoint.x - DRAWING_MIRROR_X) * normal.x +
      (rawPoint.y - DRAWING_MIRROR_Y) * normal.y;
    if (signedDistance > -18) {
      return {
        x: rawPoint.x - normal.x * (signedDistance + 18),
        y: rawPoint.y - normal.y * (signedDistance + 18),
      };
    }
    return rawPoint;
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const logicalPoint = {
      x: ((event.clientX - rect.left) / rect.width) * DRAWING_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * DRAWING_HEIGHT,
    };
    const { normal } = mirrorLine(mirrorAngle);
    const signedDistance =
      (logicalPoint.x - DRAWING_MIRROR_X) * normal.x +
      (logicalPoint.y - DRAWING_MIRROR_Y) * normal.y;
    if (signedDistance >= -12) return;
    const id = Date.now();
    activeStrokeId.current = id;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    onStrokesChange((current) => [
      ...current,
      { id, color, width: penWidth, points: [point] },
    ]);
  };

  const continueDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const id = activeStrokeId.current;
    if (id === null) return;
    const point = pointFromEvent(event);
    onStrokesChange((current) =>
      current.map((stroke) =>
        stroke.id === id
          ? { ...stroke, points: [...stroke.points, point] }
          : stroke,
      ),
    );
  };

  const finishDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    activeStrokeId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="pm-drawing-canvas"
      width={DRAWING_WIDTH}
      height={DRAWING_HEIGHT}
      aria-label={`${mirrorAngle} derece döndürülen aynada çizilen cismin görüntüsünü oluşturan çizim alanı`}
      onPointerDown={startDrawing}
      onPointerMove={continueDrawing}
      onPointerUp={finishDrawing}
      onPointerCancel={() => {
        activeStrokeId.current = null;
      }}
    />
  );
}

function FieldOfViewCanvas({
  eyeX,
  mirrorWidth,
  showField,
  objects,
  onEyeXChange,
  onObjectsChange,
}: {
  eyeX: number;
  mirrorWidth: number;
  showField: boolean;
  objects: VisionObject[];
  onEyeXChange: (position: number) => void;
  onObjectsChange: (update: (current: VisionObject[]) => VisionObject[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef<
    { type: "eye" } | { type: "object"; id: number } | null
  >(null);
  const analysis = useMemo(
    () => analyzeVisionObjects(objects, eyeX, mirrorWidth),
    [eyeX, mirrorWidth, objects],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = VISION_WIDTH;
    const height = VISION_HEIGHT;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const mirrorY = VISION_MIRROR_Y;
    const eyeY = VISION_EYE_Y;
    const topY = 35;
    const mirrorHalf = mirrorWidth * 4;
    const mirrorLeft = width / 2 - mirrorHalf;
    const mirrorRight = width / 2 + mirrorHalf;
    const pupilY = eyeY - 25;
    const extensionFactor = (pupilY - topY) / (pupilY - mirrorY);
    const leftTopX = eyeX + (mirrorLeft - eyeX) * extensionFactor;
    const rightTopX = eyeX + (mirrorRight - eyeX) * extensionFactor;

    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#122f3a");
    background.addColorStop(1, "#071d27");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(218, 235, 232, 0.07)";
    for (let x = 25; x < width; x += 25) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 25; y < height; y += 25) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    if (showField) {
      const fieldGradient = context.createLinearGradient(0, mirrorY, 0, topY);
      fieldGradient.addColorStop(0, "rgba(63, 205, 185, 0.34)");
      fieldGradient.addColorStop(1, "rgba(63, 205, 185, 0.08)");
      context.fillStyle = fieldGradient;
      context.beginPath();
      context.moveTo(mirrorLeft, mirrorY);
      context.lineTo(leftTopX, topY);
      context.lineTo(rightTopX, topY);
      context.lineTo(mirrorRight, mirrorY);
      context.closePath();
      context.fill();

      context.strokeStyle = "#60d9c2";
      context.lineWidth = 2;
      context.setLineDash([7, 6]);
      context.beginPath();
      context.moveTo(mirrorLeft, mirrorY);
      context.lineTo(leftTopX, topY);
      context.moveTo(mirrorRight, mirrorY);
      context.lineTo(rightTopX, topY);
      context.stroke();
      context.setLineDash([]);
    }

    objects.forEach((object) => {
      const result = analysis.find((entry) => entry.id === object.id);
      if (!result) return;
      const lineColor =
        result.status === "visible"
          ? object.kind === "transparent"
            ? "#78e9e0"
            : "#a8ed72"
          : result.status === "blocked"
            ? "#ff745f"
            : "rgba(185, 202, 202, .42)";
      context.save();
      context.strokeStyle = lineColor;
      context.lineWidth = result.visible ? 2 : 1.5;
      context.setLineDash(result.visible ? [] : [6, 6]);
      context.beginPath();
      context.moveTo(eyeX, eyeY - 25);
      context.lineTo(result.mirrorX, mirrorY);
      context.lineTo(object.x, object.y);
      context.stroke();
      context.restore();

      context.save();
      context.globalAlpha = result.visible ? 0.5 : 0.16;
      context.fillStyle =
        object.kind === "transparent" ? "rgba(92, 222, 220, .38)" : "#f0aa3c";
      context.strokeStyle = lineColor;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(object.x, result.virtualY, object.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(result.mirrorX, mirrorY);
      context.lineTo(object.x, result.virtualY);
      context.stroke();
      context.restore();
    });

    context.strokeStyle = "#ffb94b";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(eyeX, eyeY - 24);
    context.lineTo(mirrorLeft, mirrorY);
    context.moveTo(eyeX, eyeY - 24);
    context.lineTo(mirrorRight, mirrorY);
    context.stroke();

    const mirrorGradient = context.createLinearGradient(0, mirrorY - 8, 0, mirrorY + 10);
    mirrorGradient.addColorStop(0, "#eef8f6");
    mirrorGradient.addColorStop(0.45, "#9db4b7");
    mirrorGradient.addColorStop(1, "#405c63");
    context.fillStyle = mirrorGradient;
    context.fillRect(mirrorLeft, mirrorY - 8, mirrorRight - mirrorLeft, 16);
    context.fillStyle = "#203d45";
    context.fillRect(mirrorLeft - 8, mirrorY + 9, mirrorRight - mirrorLeft + 16, 9);

    objects.forEach((object, index) => {
      const result = analysis.find((entry) => entry.id === object.id);
      if (!result) return;
      const fill =
        object.kind === "transparent"
          ? "rgba(87, 219, 220, .34)"
          : "#efa43b";
      const stroke =
        result.status === "visible"
          ? "#b9ef79"
          : result.status === "blocked"
            ? "#ff6f5c"
            : "#778b8e";
      context.save();
      context.shadowColor = "rgba(0, 0, 0, .35)";
      context.shadowBlur = 10;
      context.fillStyle = fill;
      context.strokeStyle = stroke;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(object.x, object.y, object.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      if (object.kind === "transparent") {
        context.strokeStyle = "rgba(220, 255, 252, .7)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(
          object.x - object.radius * 0.24,
          object.y - object.radius * 0.23,
          object.radius * 0.42,
          Math.PI,
          Math.PI * 1.62,
        );
        context.stroke();
      }
      context.fillStyle = object.kind === "transparent" ? "#eaffff" : "#38250f";
      context.font = "950 11px Arial";
      context.textAlign = "center";
      context.fillText(object.kind === "transparent" ? "S" : "O", object.x, object.y + 4);
      context.font = "850 8px Arial";
      context.fillStyle = stroke;
      const statusText =
        result.status === "visible"
          ? "GÖRÜLÜYOR"
          : result.status === "blocked"
            ? "ENGELLENDİ"
            : "ALAN DIŞI";
      context.fillText(`${index + 1} · ${statusText}`, object.x, object.y + object.radius + 17);
      context.restore();
    });

    context.save();
    context.translate(eyeX, eyeY);
    context.fillStyle = "#e9c69f";
    context.strokeStyle = "#9e6e4d";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(0, 0, 49, 31, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#f8fbf8";
    context.beginPath();
    context.ellipse(0, -8, 28, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#58a7a8";
    context.beginPath();
    context.arc(0, -8, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#101b20";
    context.beginPath();
    context.arc(0, -8, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#c98e69";
    context.beginPath();
    context.moveTo(-8, -31);
    context.lineTo(0, -48);
    context.lineTo(8, -31);
    context.closePath();
    context.fill();
    context.restore();

    context.fillStyle = "rgba(230, 241, 239, 0.78)";
    context.font = "900 9px Arial";
    context.textAlign = "center";
    context.fillText("SANAL GÖRÜNTÜLER VE GÖRÜŞ ALANI", width / 2, 23);
    context.fillText(`AYNA GENİŞLİĞİ · ${mirrorWidth} cm`, width / 2, mirrorY + 35);
    context.fillStyle = "#ffcf78";
    context.fillText("ÜSTTEN GÖZ · TUT VE YATAYDA SÜRÜKLE", eyeX, eyeY + 53);
  }, [analysis, eyeX, mirrorWidth, objects, showField]);

  const logicalPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VISION_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * VISION_HEIGHT,
    };
  };

  const startDragging = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = logicalPoint(event);
    const selectedObject = [...objects]
      .reverse()
      .find(
        (object) =>
          Math.hypot(point.x - object.x, point.y - object.y) <=
          object.radius + 15,
      );
    if (selectedObject) {
      draggingRef.current = { type: "object", id: selectedObject.id };
    } else if (Math.hypot(point.x - eyeX, point.y - VISION_EYE_Y) <= 74) {
      draggingRef.current = { type: "eye" };
    } else {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continueDragging = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const target = draggingRef.current;
    if (!target) return;
    const point = logicalPoint(event);
    if (target.type === "eye") {
      onEyeXChange(Math.round(clamp(point.x, 140, 760)));
      return;
    }
    onObjectsChange((current) =>
      current.map((object) =>
        object.id === target.id
          ? {
              ...object,
              x: Math.round(clamp(point.x, 55, VISION_WIDTH - 55)),
              y: Math.round(
                clamp(point.y, VISION_MIRROR_Y + 50, VISION_EYE_Y - 75),
              ),
            }
          : object,
      ),
    );
  };

  const finishDragging = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="pm-vision-canvas"
      width={900}
      height={500}
      aria-label="Üstten görülen gözün, saydam ve saydam olmayan cisimlerin düzlem aynadaki görüş alanı"
      onPointerDown={startDragging}
      onPointerMove={continueDragging}
      onPointerUp={finishDragging}
      onPointerCancel={() => {
        draggingRef.current = null;
      }}
    />
  );
}

export default function PlaneMirrorLab() {
  const nextImageReadingId = useRef(0);
  const nextVisionObjectId = useRef(1);
  const [mode, setMode] = useState<ExperimentMode>("reflection");
  const [laserOn, setLaserOn] = useState(true);
  const [laserAngle, setLaserAngle] = useState(25);
  const [reflectionMirrorAngle, setReflectionMirrorAngle] = useState(0);
  const [angleReadings, setAngleReadings] = useState<ReflectionReading[]>([]);
  const [showReflectionResult, setShowReflectionResult] = useState(false);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [drawColor, setDrawColor] = useState("#ef634f");
  const [penWidth, setPenWidth] = useState(6);
  const [imageMirrorAngle, setImageMirrorAngle] = useState(0);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [imageReadings, setImageReadings] = useState<ImageReading[]>([]);
  const [showImageResult, setShowImageResult] = useState(false);
  const [eyeX, setEyeX] = useState(450);
  const [mirrorWidth, setMirrorWidth] = useState(50);
  const [showField, setShowField] = useState(true);
  const [visionObjects, setVisionObjects] = useState<VisionObject[]>([]);

  const drawingMeasurements = useMemo(
    () => getDrawingMeasurements(strokes, imageMirrorAngle),
    [imageMirrorAngle, strokes],
  );
  const incidenceAngle = Math.round(
    Math.abs(laserAngle + reflectionMirrorAngle),
  );
  const visionAnalysis = useMemo(
    () => analyzeVisionObjects(visionObjects, eyeX, mirrorWidth),
    [eyeX, mirrorWidth, visionObjects],
  );
  const reflectionReady = angleReadings.length >= 3;
  const imageReady = imageReadings.length >= 1;
  const visionReady =
    visionObjects.some((object) => object.kind === "transparent") &&
    visionObjects.some((object) => object.kind === "opaque");
  const allEvidenceReady = reflectionReady && imageReady && visionReady;
  const eyePositionCm = Math.round(((eyeX - 450) / 8) * 10) / 10;
  const fieldWidthAt20Cm = Math.round(mirrorWidth * (1 + 20 / 25.625));

  const recordAngle = () => {
    const id = `${laserAngle}:${reflectionMirrorAngle}`;
    setAngleReadings((current) =>
      current.some((reading) => reading.id === id)
        ? current
        : [
            ...current,
            {
              id,
              laserAngle,
              mirrorAngle: reflectionMirrorAngle,
              incidenceAngle,
            },
          ],
    );
  };

  const recordImage = () => {
    if (!drawingMeasurements) return;
    setImageReadings((current) => [
      ...current,
      {
        id: nextImageReadingId.current++,
        mirrorAngle: imageMirrorAngle,
        objectDistance: drawingMeasurements.objectDistance,
        imageDistance: drawingMeasurements.objectDistance,
        objectSize: drawingMeasurements.size,
        imageSize: drawingMeasurements.size,
      },
    ]);
  };

  const addVisionObject = (kind: VisionObjectKind) => {
    const id = nextVisionObjectId.current++;
    const sameKindCount = visionObjects.filter(
      (object) => object.kind === kind,
    ).length;
    setVisionObjects((current) => [
      ...current,
      {
        id,
        kind,
        x: kind === "transparent" ? 310 + sameKindCount * 55 : 575 - sameKindCount * 55,
        y: 295 + ((id % 2) * 42),
        radius: kind === "transparent" ? 26 : 29,
      },
    ]);
  };

  return (
    <section className="pm-lab" id="duzlem-ayna-deneyi">
      <div className="pm-hero">
        <div>
          <span>AYNALAR · DÜZLEM AYNA · İDEAL DENEY</span>
          <h1>Lazeri yönlendir, cismini çiz, görüş alanını keşfet.</h1>
          <p>
            Lazeri ve aynayı ayrı ayrı döndür; sonra istediğin cismi çizerek
            dönen aynadaki karşılığını incele. Üstten göz düzeneğine saydam ve
            saydam olmayan cisimler yerleştirip hangilerinin görüldüğünü sınayarak keşfet.
          </p>
        </div>
        <aside>
          <small>ÜÇ ETKİLEŞİMLİ ÇALIŞMA</small>
          <strong>Lazer + çizim + görüş alanı</strong>
          <span>Tüm ışınlar ve ölçümler ideal modele göre hesaplanır.</span>
        </aside>
      </div>

      <div className="pm-equipment-strip" aria-label="Deney malzemeleri">
        <span><i className="pm-equipment-raybox" /><b>Kırmızı lazer</b></span>
        <span><i className="pm-equipment-mirror" /><b>Düzlem ayna</b></span>
        <span><i className="pm-equipment-disc" /><b>Açı tablası</b></span>
        <span><i className="pm-equipment-pencil" /><b>Çizim kalemi</b></span>
        <span><i className="pm-equipment-ruler" /><b>Santimetre cetveli</b></span>
        <span><i className="pm-equipment-eye" /><b>Üstten göz modeli</b></span>
      </div>

      <div className="pm-mode-switch" aria-label="Düzlem ayna deneyleri">
        <button
          type="button"
          className={mode === "reflection" ? "active" : ""}
          onClick={() => setMode("reflection")}
        >
          <small>DENEY 1</small>
          <b>Lazerle yansıma kanunları</b>
          <span>Lazeri ve aynayı döndür; ışının yönünü ölç.</span>
        </button>
        <button
          type="button"
          className={mode === "image" ? "active" : ""}
          onClick={() => setMode("image")}
        >
          <small>DENEY 2</small>
          <b>Çiz ve görüntüyü gör</b>
          <span>Serbest çiz; aynayı döndür ve görüntüyü izle.</span>
        </button>
        <button
          type="button"
          className={mode === "vision" ? "active" : ""}
          onClick={() => setMode("vision")}
        >
          <small>DENEY 3</small>
          <b>Görüş alanı</b>
          <span>Cisim ekle, taşı; görülme durumunu karşılaştır.</span>
        </button>
      </div>

      {mode === "reflection" && (
        <div className="pm-experiment-panel">
          <div className="pm-panel-heading">
            <div>
              <span>1 · LAZER VE AÇI TABLASI</span>
              <h2>Lazeri ve aynayı ayrı ayrı döndürerek yansıyan ışını yönlendir.</h2>
            </div>
            <strong className={laserOn ? "on" : ""}>
              <i /> {laserOn ? "Lazer açık" : "Lazer kapalı"}
            </strong>
          </div>

          <div className="pm-reflection-layout">
            <div className="pm-reflection-stage">
              <ReflectionCanvas
                laserAngle={laserAngle}
                mirrorAngle={reflectionMirrorAngle}
                incidenceAngle={incidenceAngle}
                laserOn={laserOn}
                onLaserAngleChange={setLaserAngle}
              />
              <span className="pm-drag-hint">Lazeri sürükle; aynayı sağdaki kumandadan döndür</span>
            </div>

            <aside className="pm-control-console">
              <div className="pm-angle-display">
                <small>NORMALE GÖRE AÇI</small>
                <b>{incidenceAngle}°</b>
                <span>Ayna dönünce normal ve ışın birlikte güncellenir</span>
              </div>
              <label>
                <span>Lazerin tabla konumu <b>{laserAngle}°</b></span>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={laserAngle}
                  onChange={(event) => setLaserAngle(Number(event.target.value))}
                />
              </label>
              <label>
                <span>Ayna dönüş açısı <b>{reflectionMirrorAngle > 0 ? "+" : ""}{reflectionMirrorAngle}°</b></span>
                <input
                  type="range"
                  min="-25"
                  max="25"
                  step="1"
                  value={reflectionMirrorAngle}
                  onChange={(event) => setReflectionMirrorAngle(Number(event.target.value))}
                />
              </label>
              <button
                className="pm-power-button"
                type="button"
                onClick={() => setLaserOn((current) => !current)}
              >
                <i /> Lazeri {laserOn ? "kapat" : "aç"}
              </button>
              <div className="pm-live-measurement">
                <span><small>Gelme açısı · i</small><b>{laserOn ? `${incidenceAngle}°` : "—"}</b></span>
                <span><small>Yansıma açısı · r</small><b>{laserOn ? `${incidenceAngle}°` : "—"}</b></span>
              </div>
              <p className="pm-console-note">
                Açı, aynanın yüzeyinden değil çarpma noktasındaki normalden ölçülür.
              </p>
              <button
                className="pm-record-button"
                type="button"
                disabled={
                  !laserOn ||
                  angleReadings.some(
                    (reading) =>
                      reading.laserAngle === laserAngle &&
                      reading.mirrorAngle === reflectionMirrorAngle,
                  )
                }
                onClick={recordAngle}
              >
                Ölçümü kaydet
              </button>
            </aside>
          </div>

          <div className="pm-data-card">
            <div>
              <span>YANSIMA ÖLÇÜMLERİ</span>
              <strong>{angleReadings.length}/3 gerekli ölçüm</strong>
            </div>
            <table>
              <thead><tr><th>Deneme</th><th>Ayna açısı</th><th>Gelme açısı · i</th><th>Yansıma açısı · r</th><th>Sonuç</th></tr></thead>
              <tbody>
                {angleReadings.length ? angleReadings.map((reading, index) => (
                  <tr key={reading.id}>
                    <td>{index + 1}</td><td>{reading.mirrorAngle > 0 ? "+" : ""}{reading.mirrorAngle}°</td><td>{reading.incidenceAngle}°</td><td>{reading.incidenceAngle}°</td><td>i = r</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5}>Lazeri veya aynayı döndürüp ilk ölçümünü kaydet.</td></tr>
                )}
              </tbody>
            </table>
            <button
              type="button"
              disabled={!reflectionReady}
              onClick={() => setShowReflectionResult((current) => !current)}
            >
              {showReflectionResult ? "Yansıma sonucunu gizle" : "Yansıma sonucunu göster"}
            </button>
            {showReflectionResult && (
              <div className="pm-law-result">
                <span><b>i = r</b><small>Gelme ve yansıma açıları her ölçümde eşittir.</small></span>
                <span><b>Aynı düzlem</b><small>Gelen ışın, normal ve yansıyan ışın aynı düzlemdedir.</small></span>
                <span><b>Normale göre</b><small>Her iki açı da çarpma noktasındaki normale göre ölçülür.</small></span>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "image" && (
        <div className="pm-experiment-panel">
          <div className="pm-panel-heading">
            <div>
              <span>2 · SERBEST CİSİM ÇİZİMİ VE CETVEL</span>
              <h2>İstediğin cismi çiz; aynayı döndürerek görüntünün yönünü değiştir.</h2>
            </div>
            <strong className={strokes.length ? "on" : ""}><i /> {strokes.length ? "Görüntü oluştu" : "Çizim bekleniyor"}</strong>
          </div>

          <div className="pm-drawing-workspace">
            <div className="pm-sketch-stage">
              <DrawingMirrorCanvas
                strokes={strokes}
                color={drawColor}
                penWidth={penWidth}
                mirrorAngle={imageMirrorAngle}
                showMeasurements={showMeasurements}
                onStrokesChange={(update) => setStrokes(update)}
              />
            </div>

            <aside className="pm-drawing-controls">
              <div className="pm-tool-group pm-mirror-rotation-control">
                <small>AYNAYI DÖNDÜR</small>
                <label>
                  <span>Ayna açısı <b>{imageMirrorAngle > 0 ? "+" : ""}{imageMirrorAngle}°</b></span>
                  <input type="range" min="-25" max="25" step="1" value={imageMirrorAngle} onChange={(event) => setImageMirrorAngle(Number(event.target.value))} />
                </label>
                <button type="button" onClick={() => setImageMirrorAngle(0)}>Aynayı dik konuma getir</button>
              </div>
              <div className="pm-tool-group">
                <small>KALEM RENGİ</small>
                <div className="pm-color-tools">
                  {["#ef634f", "#167e91", "#f0a12d", "#263f58", "#8b61a9"].map((color) => (
                    <button
                      key={color}
                      className={drawColor === color ? "active" : ""}
                      type="button"
                      style={{ background: color }}
                      aria-label={`${color} çizim rengini seç`}
                      onClick={() => setDrawColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="pm-tool-group">
                <small>KALEM KALINLIĞI</small>
                <div className="pm-width-tools">
                  {[3, 6, 10].map((width) => (
                    <button
                      key={width}
                      className={penWidth === width ? "active" : ""}
                      type="button"
                      onClick={() => setPenWidth(width)}
                    ><i style={{ height: width }} />{width === 3 ? "İnce" : width === 6 ? "Orta" : "Kalın"}</button>
                  ))}
                </div>
              </div>
              <div className="pm-sketch-actions">
                <button type="button" disabled={!strokes.length} onClick={() => setStrokes((current) => current.slice(0, -1))}>Son çizgiyi geri al</button>
                <button type="button" disabled={!strokes.length} onClick={() => { setStrokes([]); setImageReadings([]); setShowImageResult(false); }}>Çizimi temizle</button>
                <button type="button" className={showMeasurements ? "active" : ""} onClick={() => setShowMeasurements((current) => !current)}>{showMeasurements ? "Cetvel ölçülerini gizle" : "Cetvel ölçülerini göster"}</button>
              </div>
              <div className="pm-drawing-readout">
                <small>CANLI CETVEL ÖLÇÜMÜ</small>
                <span><em>Ayna açısı</em><b>{imageMirrorAngle > 0 ? "+" : ""}{imageMirrorAngle}°</b></span>
                <span><em>Cisim merkezi</em><b>{drawingMeasurements ? `${drawingMeasurements.objectDistance.toFixed(1)} cm` : "—"}</b></span>
                <span><em>Görüntü merkezi</em><b>{drawingMeasurements ? `${drawingMeasurements.objectDistance.toFixed(1)} cm` : "—"}</b></span>
                <span><em>Çizimin boyutu</em><b>{drawingMeasurements ? `${drawingMeasurements.size.toFixed(1)} cm` : "—"}</b></span>
              </div>
              <button className="pm-record-button" type="button" disabled={!drawingMeasurements} onClick={recordImage}>
                Cetvel ölçümünü kaydet
              </button>
            </aside>
          </div>

          <div className="pm-data-card">
            <div>
              <span>ÇİZİM VE GÖRÜNTÜ ÖLÇÜMLERİ</span>
              <strong>{imageReadings.length ? `${imageReadings.length} ölçüm kaydedildi` : "En az 1 ölçüm gerekli"}</strong>
            </div>
            <table>
              <thead><tr><th>Ayna açısı</th><th>Cisim merkez uzaklığı</th><th>Görüntü merkez uzaklığı</th><th>Cisim boyutu</th><th>Görüntü boyutu</th></tr></thead>
              <tbody>
                {imageReadings.length ? imageReadings.map((reading) => (
                  <tr key={reading.id}>
                    <td>{reading.mirrorAngle > 0 ? "+" : ""}{reading.mirrorAngle}°</td><td>{reading.objectDistance.toFixed(1)} cm</td><td>{reading.imageDistance.toFixed(1)} cm</td><td>{reading.objectSize.toFixed(1)} cm</td><td>{reading.imageSize.toFixed(1)} cm</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5}>Boş alana bir cisim çiz; cetvel sonucu burada kaydedilsin.</td></tr>
                )}
              </tbody>
            </table>
            <button type="button" disabled={!imageReady} onClick={() => setShowImageResult((current) => !current)}>
              {showImageResult ? "Görüntü özelliklerini gizle" : "Görüntü özelliklerini göster"}
            </button>
            {showImageResult && (
              <div className="pm-image-result-grid">
                <span><b>Eşit uzaklık</b><small>Her çizgi noktası aynanın arkasında, aynaya eşit uzaklıkta oluşur.</small></span>
                <span><b>Aynı boy</b><small>Çizimin ve aynadaki görüntüsünün bütün ölçüleri eşittir.</small></span>
                <span><b>Aynaya göre simetri</b><small>Ayna döndükçe görüntünün yönü değişir; şeklin bütün ölçüleri korunur.</small></span>
                <span><b>Sanal görüntü</b><small>Yansıyan ışınların geriye uzantıları görüntü konumunda kesişir.</small></span>
                <span><b>Yanal terslik</b><small>Çizimin sağ ve sol tarafları aynadaki karşılığında yer değiştirir.</small></span>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "vision" && (
        <div className="pm-experiment-panel">
          <div className="pm-panel-heading">
            <div>
              <span>3 · ÜSTTEN GÖZ VE GÖRÜŞ ALANI</span>
              <h2>Saydam ve saydam olmayan cisimleri yerleştir; hangisinin görüldüğünü sınay.</h2>
            </div>
            <strong className={showField ? "on" : ""}><i /> {showField ? "Görüş alanı çizili" : "Sınır ışınları açık"}</strong>
          </div>
          <div className="pm-vision-workspace">
            <div className="pm-vision-stage">
              <FieldOfViewCanvas
                eyeX={eyeX}
                mirrorWidth={mirrorWidth}
                showField={showField}
                objects={visionObjects}
                onEyeXChange={setEyeX}
                onObjectsChange={(update) => setVisionObjects(update)}
              />
            </div>
            <aside className="pm-vision-controls">
              <div className="pm-vision-readout">
                <small>ÜSTTEN GÖZ KONUMU</small>
                <b>{eyePositionCm === 0 ? "Merkezde" : `${Math.abs(eyePositionCm).toFixed(1)} cm ${eyePositionCm < 0 ? "solda" : "sağda"}`}</b>
                <span>Gözü doğrudan çizim üzerinde de sürükleyebilirsin.</span>
              </div>
              <div className="pm-vision-object-tools">
                <small>CİSİM EKLE VE SÜRÜKLE</small>
                <div>
                  <button type="button" disabled={visionObjects.length >= 6} onClick={() => addVisionObject("transparent")}><i className="transparent" />Saydam cisim ekle</button>
                  <button type="button" disabled={visionObjects.length >= 6} onClick={() => addVisionObject("opaque")}><i className="opaque" />Saydam olmayan cisim ekle</button>
                </div>
                <button type="button" disabled={!visionObjects.length} onClick={() => setVisionObjects([])}>Tüm cisimleri kaldır</button>
              </div>
              <div className="pm-vision-object-list">
                <small>GÖRÜLME DURUMU</small>
                {visionObjects.length ? visionObjects.map((object, index) => {
                  const result = visionAnalysis.find((entry) => entry.id === object.id);
                  const status = result?.status === "visible"
                    ? "Aynada görülüyor"
                    : result?.status === "blocked"
                      ? "Saydam olmayan cisim engelliyor"
                      : "Görüş alanının dışında";
                  return (
                    <span key={object.id} className={result?.status ?? "outside"}>
                      <i className={object.kind} />
                      <em>{index + 1}. {object.kind === "transparent" ? "Saydam" : "Saydam olmayan"}</em>
                      <b>{status}</b>
                      <button type="button" aria-label={`${index + 1}. cismi kaldır`} onClick={() => setVisionObjects((current) => current.filter((entry) => entry.id !== object.id))}>×</button>
                    </span>
                  );
                }) : <p>Önce iki farklı cisim ekle; sonra aynanın önünde istediğin yere sürükle.</p>}
              </div>
              <label>
                <span>Gözün yatay konumu <b>{eyePositionCm.toFixed(1)} cm</b></span>
                <input type="range" min="140" max="760" step="5" value={eyeX} onChange={(event) => setEyeX(Number(event.target.value))} />
              </label>
              <label>
                <span>Ayna genişliği <b>{mirrorWidth} cm</b></span>
                <input type="range" min="25" max="70" step="5" value={mirrorWidth} onChange={(event) => setMirrorWidth(Number(event.target.value))} />
              </label>
              <button type="button" className={showField ? "active" : ""} onClick={() => setShowField((current) => !current)}>
                {showField ? "Görüş alanı taramasını gizle" : "Görüş alanını çiz"}
              </button>
              <div className="pm-field-result">
                <small>AYNANIN 20 cm ARKASINDA</small>
                <b>{fieldWidthAt20Cm} cm</b>
                <span>İki sınır ışını arasındaki ideal görüş genişliği</span>
              </div>
              <p>Saydam cisim ışığın geçmesine izin verir. Saydam olmayan cisim görüş ışınının üzerine gelirse arkasındaki cismin aynada görülmesini engeller.</p>
            </aside>
          </div>
        </div>
      )}

      <section className="pm-evidence-section">
        <div>
          <span>TOPLU KANIT</span>
          <h2>Düzlem aynayı üç farklı gözlemle açıkla.</h2>
          <p>Lazer ölçümlerini tamamla ve çizdiğin cismin cetvel ölçümünü kaydet.</p>
        </div>
        <div className="pm-evidence-progress">
          <span className={reflectionReady ? "done" : ""}><i>{reflectionReady ? "✓" : angleReadings.length}</i>Lazerle yansıma ölçümleri</span>
          <span className={imageReady ? "done" : ""}><i>{imageReady ? "✓" : imageReadings.length}</i>Çizim ve görüntü ölçümü</span>
          <span className={visionReady ? "done" : ""}><i>{visionReady ? "✓" : visionObjects.length}</i>Saydamlık ve görüş alanı</span>
        </div>
        {allEvidenceReady && (
          <article>
            <strong>DENEY SONUCU</strong>
            <p>
              Düzlem aynada gelme ve yansıma açıları eşittir. Çizilen cismin
              görüntüsü aynanın arkasında eşit uzaklıkta, eşit boyda, aynaya
              göre simetrik, yanal ters ve sanal oluşur. Saydam cisim ışığı
              geçirirken saydam olmayan cisim görüş ışınını engelleyebilir.
            </p>
          </article>
        )}
      </section>

      <section className="pm-report">
        <div><span>TYMM · DENEY RAPORU</span><h2>Çizimlerini ve ölçümlerini kanıt olarak kullan.</h2></div>
        <div className="pm-report-grid">
          <label><span>Ayna döndüğünde normal, gelme açısı ve yansıyan ışının yönü nasıl değişti?</span><textarea rows={4} /></label>
          <label><span>Normal çizgisinin açı ölçümündeki görevini açıkla.</span><textarea rows={4} /></label>
          <label><span>Aynayı döndürdüğünde çizdiğin cismin görüntüsünün konumu ve yönü nasıl değişti?</span><textarea rows={4} /></label>
          <label><span>Cetvel ölçümleri cisim ve görüntü uzaklıkları hakkında ne gösterdi?</span><textarea rows={4} /></label>
          <label><span>Saydam ve saydam olmayan cisimlerin konumu görülme durumunu nasıl etkiledi?</span><textarea rows={4} /></label>
          <label className="wide"><span>Düzlem aynadaki yansıma, görüntü ve görüş alanı özelliklerini deney kanıtlarına dayanarak özetle.</span><textarea rows={5} /></label>
        </div>
      </section>
    </section>
  );
}
