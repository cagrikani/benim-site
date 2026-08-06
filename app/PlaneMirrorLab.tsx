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
type ImageReading = {
  id: number;
  objectDistance: number;
  imageDistance: number;
  objectWidth: number;
  imageWidth: number;
  height: number;
};

const DRAWING_WIDTH = 900;
const DRAWING_HEIGHT = 480;
const DRAWING_MIRROR_X = DRAWING_WIDTH / 2;
const DRAWING_PIXELS_PER_CM = 10;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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
  angle,
  laserOn,
  onAngleChange,
}: {
  angle: number;
  laserOn: boolean;
  onAngleChange: (angle: number) => void;
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
      const angleRad = (angle * Math.PI) / 180;
      const sourceX = centerX - Math.sin(angleRad) * radius;
      const sourceY = centerY - Math.cos(angleRad) * radius;
      const reflectedX = centerX + Math.sin(angleRad) * (radius + 22);
      const reflectedY = centerY - Math.cos(angleRad) * (radius + 22);

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
      context.moveTo(centerX, centerY + 16);
      context.lineTo(centerX, centerY - radius - 30);
      context.stroke();
      context.setLineDash([]);

      context.strokeStyle = "rgba(255, 255, 255, 0.8)";
      context.lineWidth = 1.6;
      context.beginPath();
      context.arc(
        centerX,
        centerY,
        52,
        -Math.PI / 2 - angleRad,
        -Math.PI / 2,
      );
      context.stroke();
      context.beginPath();
      context.arc(
        centerX,
        centerY,
        52,
        -Math.PI / 2,
        -Math.PI / 2 + angleRad,
      );
      context.stroke();

      if (laserOn) {
        drawGlowLine(
          context,
          sourceX + 28 * Math.cos(angleRad),
          sourceY + 28 * Math.sin(angleRad),
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
          centerX - 28 * Math.sin(angleRad),
          centerY - 28 * Math.cos(angleRad),
          "#fff0d5",
        );
        drawArrowHead(
          context,
          centerX,
          centerY,
          centerX + 85 * Math.sin(angleRad),
          centerY - 85 * Math.cos(angleRad),
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
      context.rotate(angleRad);
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

      const mirrorGradient = context.createLinearGradient(
        centerX - 112,
        0,
        centerX + 112,
        0,
      );
      mirrorGradient.addColorStop(0, "#70888d");
      mirrorGradient.addColorStop(0.18, "#eff7f4");
      mirrorGradient.addColorStop(0.5, "#9db1b4");
      mirrorGradient.addColorStop(0.82, "#f4faf8");
      mirrorGradient.addColorStop(1, "#5f777c");
      context.fillStyle = "#112931";
      context.fillRect(centerX - 122, centerY + 6, 244, 21);
      context.fillStyle = mirrorGradient;
      context.fillRect(centerX - 112, centerY - 1, 224, 10);
      context.fillStyle = "#203b43";
      context.beginPath();
      context.roundRect(centerX - 58, centerY + 25, 116, 18, 5);
      context.fill();

      context.fillStyle = "rgba(238, 247, 244, 0.82)";
      context.font = "800 10px Arial";
      context.textAlign = "center";
      context.fillText("NORMAL", centerX, centerY - radius - 36);
      context.fillStyle = "#ff9187";
      context.fillText(`i = ${angle}°`, centerX - 55, centerY - 45);
      context.fillStyle = "#ffd17b";
      context.fillText(`r = ${angle}°`, centerX + 55, centerY - 45);
      context.fillStyle = "rgba(238, 247, 244, 0.7)";
      context.fillText("GELEN IŞIN", centerX - 118, centerY - 92);
      context.fillText("YANSIYAN IŞIN", centerX + 120, centerY - 92);
      context.restore();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [angle, laserOn]);

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
    onAngleChange(clamp(nextAngle, 5, 80));
  };

  return (
    <canvas
      ref={canvasRef}
      className="pm-reflection-canvas"
      height={440}
      aria-label={`Lazer aynaya normalden ${angle} derece açıyla geliyor ve ${angle} dereceyle yansıyor`}
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

function getDrawingMeasurements(strokes: DrawStroke[]) {
  const points = strokes.flatMap((stroke) => stroke.points);
  if (!points.length) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const centerX = (minX + maxX) / 2;
  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX,
    objectDistance: Math.max(
      0,
      Math.round(((DRAWING_MIRROR_X - centerX) / DRAWING_PIXELS_PER_CM) * 10) /
        10,
    ),
    width:
      Math.round(((maxX - minX) / DRAWING_PIXELS_PER_CM) * 10) / 10,
    height:
      Math.round(((maxY - minY) / DRAWING_PIXELS_PER_CM) * 10) / 10,
  };
}

function drawDimension(
  context: CanvasRenderingContext2D,
  fromX: number,
  toX: number,
  y: number,
  label: string,
  color: string,
) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1.5;
  context.setLineDash([5, 4]);
  context.beginPath();
  context.moveTo(fromX, y);
  context.lineTo(toX, y);
  context.stroke();
  context.setLineDash([]);
  for (const [x, direction] of [
    [fromX, 1],
    [toX, -1],
  ] as const) {
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + direction * 9, y - 4);
    context.lineTo(x + direction * 9, y + 4);
    context.closePath();
    context.fill();
  }
  context.font = "800 10px Arial";
  context.textAlign = "center";
  context.fillText(label, (fromX + toX) / 2, y - 7);
  context.restore();
}

function DrawingMirrorCanvas({
  strokes,
  color,
  penWidth,
  showMeasurements,
  onStrokesChange,
}: {
  strokes: DrawStroke[];
  color: string;
  penWidth: number;
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

    context.fillStyle = "rgba(22, 126, 145, 0.08)";
    context.fillRect(DRAWING_MIRROR_X + 10, 0, DRAWING_WIDTH / 2 - 10, DRAWING_HEIGHT - 56);
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
        const x = mirrored ? DRAWING_WIDTH - point.x : point.x;
        if (index === 0) context.moveTo(x, point.y);
        else context.lineTo(x, point.y);
      });
      if (stroke.points.length === 1) {
        const point = stroke.points[0];
        const x = mirrored ? DRAWING_WIDTH - point.x : point.x;
        context.lineTo(x + 0.1, point.y + 0.1);
      }
      context.stroke();
      context.restore();
    };

    strokes.forEach((stroke) => drawStroke(stroke, false));
    strokes.forEach((stroke) => drawStroke(stroke, true));

    const measurements = getDrawingMeasurements(strokes);
    if (showMeasurements && measurements) {
      const imageCenterX = DRAWING_WIDTH - measurements.centerX;
      const dimensionY = Math.min(DRAWING_HEIGHT - 82, measurements.maxY + 32);
      drawDimension(
        context,
        measurements.centerX,
        DRAWING_MIRROR_X,
        dimensionY,
        `${measurements.objectDistance.toFixed(1)} cm`,
        "#167e91",
      );
      drawDimension(
        context,
        DRAWING_MIRROR_X,
        imageCenterX,
        dimensionY,
        `${measurements.objectDistance.toFixed(1)} cm`,
        "#d47c21",
      );
      context.strokeStyle = "rgba(22, 126, 145, 0.62)";
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(measurements.centerX, measurements.minY);
      context.lineTo(imageCenterX, measurements.minY);
      context.stroke();
      context.setLineDash([]);
    }

    const mirrorGradient = context.createLinearGradient(
      DRAWING_MIRROR_X - 7,
      0,
      DRAWING_MIRROR_X + 7,
      0,
    );
    mirrorGradient.addColorStop(0, "#425d63");
    mirrorGradient.addColorStop(0.35, "#eef9f7");
    mirrorGradient.addColorStop(0.58, "#93aaae");
    mirrorGradient.addColorStop(1, "#253f46");
    context.fillStyle = mirrorGradient;
    context.fillRect(DRAWING_MIRROR_X - 8, 0, 16, DRAWING_HEIGHT - 56);
    context.fillStyle = "#1a353d";
    context.fillRect(DRAWING_MIRROR_X - 23, DRAWING_HEIGHT - 64, 46, 9);

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
  }, [showMeasurements, strokes]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(
        ((event.clientX - rect.left) / rect.width) * DRAWING_WIDTH,
        12,
        DRAWING_MIRROR_X - 18,
      ),
      y: clamp(
        ((event.clientY - rect.top) / rect.height) * DRAWING_HEIGHT,
        34,
        DRAWING_HEIGHT - 70,
      ),
    };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const logicalX = ((event.clientX - rect.left) / rect.width) * DRAWING_WIDTH;
    if (logicalX >= DRAWING_MIRROR_X - 12) return;
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
      aria-label="Sol tarafa çizilen cismin sağ tarafta aynadaki görüntüsünü oluşturan çizim alanı"
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
  onEyeXChange,
}: {
  eyeX: number;
  mirrorWidth: number;
  showField: boolean;
  onEyeXChange: (position: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = 900;
    const height = 500;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const mirrorY = 190;
    const eyeY = 410;
    const topY = 35;
    const mirrorHalf = mirrorWidth * 4;
    const mirrorLeft = width / 2 - mirrorHalf;
    const mirrorRight = width / 2 + mirrorHalf;
    const extensionFactor = (eyeY - topY) / (eyeY - mirrorY);
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

    context.strokeStyle = "#ffb94b";
    context.lineWidth = 2.5;
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
    context.fillText("AYNANIN ARKASINDAKİ GÖRÜŞ ALANI", width / 2, 23);
    context.fillText(`AYNA GENİŞLİĞİ · ${mirrorWidth} cm`, width / 2, mirrorY + 35);
    context.fillStyle = "#ffcf78";
    context.fillText("ÜSTTEN GÖZ · TUT VE YATAYDA SÜRÜKLE", eyeX, eyeY + 53);
  }, [eyeX, mirrorWidth, showField]);

  const updateEye = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const logicalX = ((event.clientX - rect.left) / rect.width) * 900;
    onEyeXChange(Math.round(clamp(logicalX, 140, 760)));
  };

  return (
    <canvas
      ref={canvasRef}
      className="pm-vision-canvas"
      width={900}
      height={500}
      aria-label="Üstten görülen gözün düzlem aynadaki görüş alanı"
      onPointerDown={(event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateEye(event);
      }}
      onPointerMove={updateEye}
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

export default function PlaneMirrorLab() {
  const nextImageReadingId = useRef(0);
  const [mode, setMode] = useState<ExperimentMode>("reflection");
  const [laserOn, setLaserOn] = useState(true);
  const [angle, setAngle] = useState(25);
  const [angleReadings, setAngleReadings] = useState<number[]>([]);
  const [showReflectionResult, setShowReflectionResult] = useState(false);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [drawColor, setDrawColor] = useState("#ef634f");
  const [penWidth, setPenWidth] = useState(6);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [imageReadings, setImageReadings] = useState<ImageReading[]>([]);
  const [showImageResult, setShowImageResult] = useState(false);
  const [eyeX, setEyeX] = useState(450);
  const [mirrorWidth, setMirrorWidth] = useState(50);
  const [showField, setShowField] = useState(true);

  const drawingMeasurements = useMemo(
    () => getDrawingMeasurements(strokes),
    [strokes],
  );
  const reflectionReady = angleReadings.length >= 3;
  const imageReady = imageReadings.length >= 1;
  const allEvidenceReady = reflectionReady && imageReady;
  const eyePositionCm = Math.round(((eyeX - 450) / 8) * 10) / 10;
  const fieldWidthAt20Cm = Math.round(mirrorWidth * (1 + 20 / 27.5));

  const recordAngle = () => {
    setAngleReadings((current) =>
      current.includes(angle) ? current : [...current, angle],
    );
  };

  const recordImage = () => {
    if (!drawingMeasurements) return;
    setImageReadings((current) => [
      ...current,
      {
        id: nextImageReadingId.current++,
        objectDistance: drawingMeasurements.objectDistance,
        imageDistance: drawingMeasurements.objectDistance,
        objectWidth: drawingMeasurements.width,
        imageWidth: drawingMeasurements.width,
        height: drawingMeasurements.height,
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
            Yansımayı açı tablasında ölç; sonra boş alana istediğin cismi çiz ve
            aynadaki karşılığını anında incele. Cetvelle uzaklık ve boy
            ölçümlerini yap, üstten göz düzeneğinde görüş sınırlarını değiştir.
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
          <span>Lazeri sürükle; gelen ve yansıyan ışını ölç.</span>
        </button>
        <button
          type="button"
          className={mode === "image" ? "active" : ""}
          onClick={() => setMode("image")}
        >
          <small>DENEY 2</small>
          <b>Çiz ve görüntüyü gör</b>
          <span>Serbest çiz; görüntüyü ve ölçüleri anında gör.</span>
        </button>
        <button
          type="button"
          className={mode === "vision" ? "active" : ""}
          onClick={() => setMode("vision")}
        >
          <small>DENEY 3</small>
          <b>Görüş alanı</b>
          <span>Üstten gözü taşı; sınır ışınlarını incele.</span>
        </button>
      </div>

      {mode === "reflection" && (
        <div className="pm-experiment-panel">
          <div className="pm-panel-heading">
            <div>
              <span>1 · LAZER VE AÇI TABLASI</span>
              <h2>Lazeri tablanın üzerinde sürükleyerek geliş açısını değiştir.</h2>
            </div>
            <strong className={laserOn ? "on" : ""}>
              <i /> {laserOn ? "Lazer açık" : "Lazer kapalı"}
            </strong>
          </div>

          <div className="pm-reflection-layout">
            <div className="pm-reflection-stage">
              <ReflectionCanvas
                angle={angle}
                laserOn={laserOn}
                onAngleChange={setAngle}
              />
              <span className="pm-drag-hint">Lazeri tut ve yarım daire boyunca sürükle</span>
            </div>

            <aside className="pm-control-console">
              <div className="pm-angle-display">
                <small>NORMALE GÖRE AÇI</small>
                <b>{angle}°</b>
                <span>i ve r aynı anda gösterilir</span>
              </div>
              <label>
                <span>Lazerin geliş açısı</span>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="1"
                  value={angle}
                  onChange={(event) => setAngle(Number(event.target.value))}
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
                <span><small>Gelme açısı · i</small><b>{laserOn ? `${angle}°` : "—"}</b></span>
                <span><small>Yansıma açısı · r</small><b>{laserOn ? `${angle}°` : "—"}</b></span>
              </div>
              <p className="pm-console-note">
                Açı, aynanın yüzeyinden değil çarpma noktasındaki normalden ölçülür.
              </p>
              <button
                className="pm-record-button"
                type="button"
                disabled={!laserOn || angleReadings.includes(angle)}
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
              <thead><tr><th>Deneme</th><th>Gelme açısı · i</th><th>Yansıma açısı · r</th><th>Sonuç</th></tr></thead>
              <tbody>
                {angleReadings.length ? angleReadings.map((reading, index) => (
                  <tr key={reading}>
                    <td>{index + 1}</td><td>{reading}°</td><td>{reading}°</td><td>i = r</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4}>Lazeri farklı bir açıya getirip ilk ölçümünü kaydet.</td></tr>
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
              <h2>Sol alana istediğin cismi çiz; görüntüsü aynanın arkasında oluşsun.</h2>
            </div>
            <strong className={strokes.length ? "on" : ""}><i /> {strokes.length ? "Görüntü oluştu" : "Çizim bekleniyor"}</strong>
          </div>

          <div className="pm-drawing-workspace">
            <div className="pm-sketch-stage">
              <DrawingMirrorCanvas
                strokes={strokes}
                color={drawColor}
                penWidth={penWidth}
                showMeasurements={showMeasurements}
                onStrokesChange={(update) => setStrokes(update)}
              />
            </div>

            <aside className="pm-drawing-controls">
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
                <span><em>Cisim merkezi</em><b>{drawingMeasurements ? `${drawingMeasurements.objectDistance.toFixed(1)} cm` : "—"}</b></span>
                <span><em>Görüntü merkezi</em><b>{drawingMeasurements ? `${drawingMeasurements.objectDistance.toFixed(1)} cm` : "—"}</b></span>
                <span><em>Çizimin genişliği</em><b>{drawingMeasurements ? `${drawingMeasurements.width.toFixed(1)} cm` : "—"}</b></span>
                <span><em>Çizimin yüksekliği</em><b>{drawingMeasurements ? `${drawingMeasurements.height.toFixed(1)} cm` : "—"}</b></span>
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
              <thead><tr><th>Cisim merkez uzaklığı</th><th>Görüntü merkez uzaklığı</th><th>Cisim genişliği</th><th>Görüntü genişliği</th><th>Yükseklik</th></tr></thead>
              <tbody>
                {imageReadings.length ? imageReadings.map((reading) => (
                  <tr key={reading.id}>
                    <td>{reading.objectDistance.toFixed(1)} cm</td><td>{reading.imageDistance.toFixed(1)} cm</td><td>{reading.objectWidth.toFixed(1)} cm</td><td>{reading.imageWidth.toFixed(1)} cm</td><td>{reading.height.toFixed(1)} cm</td>
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
                <span><b>Düz görüntü</b><small>Görüntü baş aşağı dönmez; çizimle aynı doğrultudadır.</small></span>
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
              <h2>Gözü yatayda sürükle; ayna uçlarından geçen sınır ışınlarını izle.</h2>
            </div>
            <strong className={showField ? "on" : ""}><i /> {showField ? "Görüş alanı çizili" : "Sınır ışınları açık"}</strong>
          </div>
          <div className="pm-vision-workspace">
            <div className="pm-vision-stage">
              <FieldOfViewCanvas
                eyeX={eyeX}
                mirrorWidth={mirrorWidth}
                showField={showField}
                onEyeXChange={setEyeX}
              />
            </div>
            <aside className="pm-vision-controls">
              <div className="pm-vision-readout">
                <small>ÜSTTEN GÖZ KONUMU</small>
                <b>{eyePositionCm === 0 ? "Merkezde" : `${Math.abs(eyePositionCm).toFixed(1)} cm ${eyePositionCm < 0 ? "solda" : "sağda"}`}</b>
                <span>Gözü doğrudan çizim üzerinde de sürükleyebilirsin.</span>
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
              <p>Ayna genişledikçe görüş alanı büyür. Göz yatayda hareket ettiğinde alanın yönü değişir; genişliği değişmez.</p>
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
          <span className={showField ? "done" : ""}><i>{showField ? "✓" : "—"}</i>Üstten görüş alanı</span>
        </div>
        {allEvidenceReady && (
          <article>
            <strong>DENEY SONUCU</strong>
            <p>
              Düzlem aynada gelme ve yansıma açıları eşittir. Çizilen cismin
              görüntüsü aynanın arkasında eşit uzaklıkta, eşit boyda, düz,
              yanal ters ve sanal oluşur. Gözün görebildiği bölge ayna
              uçlarından geçen sınır ışınlarıyla belirlenir.
            </p>
          </article>
        )}
      </section>

      <section className="pm-report">
        <div><span>TYMM · DENEY RAPORU</span><h2>Çizimlerini ve ölçümlerini kanıt olarak kullan.</h2></div>
        <div className="pm-report-grid">
          <label><span>Lazerin farklı geliş açılarında gelme ve yansıma açılarını karşılaştır.</span><textarea rows={4} /></label>
          <label><span>Normal çizgisinin açı ölçümündeki görevini açıkla.</span><textarea rows={4} /></label>
          <label><span>Çizdiğin cismin hangi bölümleri aynadaki görüntüde yer değiştirdi?</span><textarea rows={4} /></label>
          <label><span>Cetvel ölçümleri cisim ve görüntü uzaklıkları hakkında ne gösterdi?</span><textarea rows={4} /></label>
          <label><span>Göz ve ayna genişliği görüş alanını nasıl etkiledi?</span><textarea rows={4} /></label>
          <label className="wide"><span>Düzlem aynadaki yansıma, görüntü ve görüş alanı özelliklerini deney kanıtlarına dayanarak özetle.</span><textarea rows={5} /></label>
        </div>
      </section>
    </section>
  );
}
