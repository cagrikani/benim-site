"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import CollisionLab from "./CollisionLab";
import BallisticPendulumLab from "./BallisticPendulumLab";
import FreeFallLab from "./FreeFallLab";
import HarmonicMotionLab from "./HarmonicMotionLab";
import MotionLab from "./MotionLab";
import TorqueLab from "./TorqueLab";
import TwoDimensionalMotionLab from "./TwoDimensionalMotionLab";

type ActiveModule =
  | "vectors"
  | "motion"
  | "free-fall"
  | "two-dimensional"
  | "collisions"
  | "ballistic-pendulum"
  | "torque"
  | "harmonic-motion"
  | null;
type GridPoint = { x: number; y: number };
type WorkspaceVector = {
  id: number;
  label: string;
  color: string;
  start: GridPoint;
  end: GridPoint;
};
type DraftVector = {
  start: GridPoint;
  end: GridPoint;
};
type VectorTool =
  | "draw"
  | "move"
  | "head-to-tail"
  | "parallelogram"
  | "components";
type VectorConstruction = {
  id: number;
  type: "head-to-tail" | "parallelogram" | "components";
  vectorIds: number[];
};
type PointerAction =
  | { kind: "draw"; start: GridPoint; end: GridPoint }
  | {
      kind: "move";
      vectorId: number;
      pointerStart: GridPoint;
      vectorStart: GridPoint;
      vectorEnd: GridPoint;
    };

const VECTOR_GRID_STEP = 34;
const VECTOR_CANVAS_HEIGHT = 620;
const VECTOR_COLORS = ["#167f75", "#ef9f28", "#173f59", "#9b6b92"];

function samePoint(a: GridPoint, b: GridPoint) {
  return a.x === b.x && a.y === b.y;
}

function nextVectorLabel(current: string) {
  const normalized = current.trim().toUpperCase();
  if (/^[A-Y]$/.test(normalized)) {
    return String.fromCharCode(normalized.charCodeAt(0) + 1);
  }
  return normalized || "A";
}

function distanceToVector(point: GridPoint, vector: WorkspaceVector) {
  const dx = vector.end.x - vector.start.x;
  const dy = vector.end.y - vector.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) {
    return Math.sqrt(
      (point.x - vector.start.x) ** 2 + (point.y - vector.start.y) ** 2,
    );
  }
  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point.x - vector.start.x) * dx +
        (point.y - vector.start.y) * dy) /
        lengthSquared,
    ),
  );
  const closestX = vector.start.x + progress * dx;
  const closestY = vector.start.y + progress * dy;
  return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
}

function VectorWorkspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerActionRef = useRef<PointerAction | null>(null);
  const nextIdRef = useRef(0);
  const nextConstructionIdRef = useRef(0);
  const [vectors, setVectors] = useState<WorkspaceVector[]>([]);
  const [draft, setDraft] = useState<DraftVector | null>(null);
  const [label, setLabel] = useState("A");
  const [color, setColor] = useState(VECTOR_COLORS[0]);
  const [tool, setTool] = useState<VectorTool>("draw");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [constructions, setConstructions] = useState<VectorConstruction[]>([]);
  const [status, setStatus] = useState("Boş alanda sürükle.");

  const geometry = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const width = Math.max(canvas.getBoundingClientRect().width, 320);
    return {
      width,
      height: VECTOR_CANVAS_HEIGHT,
      origin: { x: width / 2, y: VECTOR_CANVAS_HEIGHT / 2 },
    };
  }, []);

  const pointFromPointer = useCallback(
    (
      clientX: number,
      clientY: number,
      snapToGrid = true,
    ): GridPoint | null => {
      const canvas = canvasRef.current;
      const layout = geometry();
      if (!canvas || !layout) return null;
      const rect = canvas.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const gridX = (localX - layout.origin.x) / VECTOR_GRID_STEP;
      const gridY = (layout.origin.y - localY) / VECTOR_GRID_STEP;
      return {
        x: snapToGrid ? Math.round(gridX) : gridX,
        y: snapToGrid ? Math.round(gridY) : gridY,
      };
    },
    [geometry],
  );

  const vectorAtPoint = useCallback(
    (point: GridPoint) =>
      [...vectors]
        .reverse()
        .find((vector) => distanceToVector(point, vector) <= 0.45),
    [vectors],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const layout = geometry();
    if (!canvas || !layout) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = layout.width * ratio;
    canvas.height = layout.height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, layout.width, layout.height);
    context.fillStyle = "#fbfdfc";
    context.fillRect(0, 0, layout.width, layout.height);

    for (
      let x = layout.origin.x % VECTOR_GRID_STEP;
      x < layout.width;
      x += VECTOR_GRID_STEP
    ) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, layout.height);
      context.strokeStyle = "#dbe8e4";
      context.lineWidth = 1;
      context.stroke();
    }
    for (
      let y = layout.origin.y % VECTOR_GRID_STEP;
      y < layout.height;
      y += VECTOR_GRID_STEP
    ) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(layout.width, y);
      context.strokeStyle = "#dbe8e4";
      context.lineWidth = 1;
      context.stroke();
    }

    context.beginPath();
    context.moveTo(0, layout.origin.y);
    context.lineTo(layout.width, layout.origin.y);
    context.moveTo(layout.origin.x, 0);
    context.lineTo(layout.origin.x, layout.height);
    context.strokeStyle = "#9eb5b2";
    context.lineWidth = 1.5;
    context.stroke();

    const canvasPoint = (point: GridPoint) => ({
      x: layout.origin.x + point.x * VECTOR_GRID_STEP,
      y: layout.origin.y - point.y * VECTOR_GRID_STEP,
    });

    const drawArrow = (
      vector: Pick<WorkspaceVector, "label" | "color" | "start" | "end">,
      options: {
        isDraft?: boolean;
        isSelected?: boolean;
        dashed?: boolean;
        lineWidth?: number;
      } = {},
    ) => {
      const start = canvasPoint(vector.start);
      const end = canvasPoint(vector.end);
      if (start.x === end.x && start.y === end.y) return;

      context.save();
      context.globalAlpha = options.isDraft ? 0.55 : 1;
      if (options.isSelected) {
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.strokeStyle = "rgba(239, 159, 40, 0.24)";
        context.lineWidth = 13;
        context.lineCap = "round";
        context.stroke();
      }
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.strokeStyle = vector.color;
      context.lineWidth = options.lineWidth ?? 4;
      context.lineCap = "round";
      context.setLineDash(options.dashed ? [9, 7] : []);
      context.stroke();
      context.setLineDash([]);

      const direction = Math.atan2(end.y - start.y, end.x - start.x);
      context.beginPath();
      context.moveTo(end.x, end.y);
      context.lineTo(
        end.x - Math.cos(direction - 0.5) * 15,
        end.y - Math.sin(direction - 0.5) * 15,
      );
      context.lineTo(
        end.x - Math.cos(direction + 0.5) * 15,
        end.y - Math.sin(direction + 0.5) * 15,
      );
      context.closePath();
      context.fillStyle = vector.color;
      context.fill();

      context.beginPath();
      context.arc(start.x, start.y, 4, 0, Math.PI * 2);
      context.fill();

      if (vector.label) {
        context.fillStyle = vector.color;
        context.font = "800 14px Arial";
        context.fillText(
          vector.label,
          (start.x + end.x) / 2 + 9,
          (start.y + end.y) / 2 - 9,
        );
      }
      context.restore();
    };

    vectors.forEach((vector) =>
      drawArrow(vector, { isSelected: selectedIds.includes(vector.id) }),
    );

    constructions.forEach((construction) => {
      const first = vectors.find(
        (vector) => vector.id === construction.vectorIds[0],
      );
      if (!first) return;

      if (construction.type === "components") {
        const corner = { x: first.end.x, y: first.start.y };
        drawArrow({
          label: `${first.label}ₓ`,
          color: "#ef9f28",
          start: first.start,
          end: corner,
        }, { dashed: true, lineWidth: 3 });
        drawArrow({
          label: `${first.label}ᵧ`,
          color: "#167f75",
          start: corner,
          end: first.end,
        }, { dashed: true, lineWidth: 3 });
        return;
      }

      const second = vectors.find(
        (vector) => vector.id === construction.vectorIds[1],
      );
      if (!second) return;

      if (construction.type === "head-to-tail") {
        drawArrow({
          label: "R",
          color: "#b74765",
          start: first.start,
          end: second.end,
        }, { lineWidth: 3 });
        return;
      }

      const farCorner = {
        x: first.end.x + (second.end.x - second.start.x),
        y: first.end.y + (second.end.y - second.start.y),
      };
      drawArrow({
        label: "",
        color: second.color,
        start: first.end,
        end: farCorner,
      }, { dashed: true, lineWidth: 2 });
      drawArrow({
        label: "",
        color: first.color,
        start: second.end,
        end: farCorner,
      }, { dashed: true, lineWidth: 2 });
      drawArrow({
        label: "R",
        color: "#b74765",
        start: first.start,
        end: farCorner,
      }, { lineWidth: 3 });
    });

    if (draft) {
      drawArrow({
        label: label.trim(),
        color,
        start: draft.start,
        end: draft.end,
      }, { isDraft: true });
    }
  }, [
    color,
    constructions,
    draft,
    geometry,
    label,
    selectedIds,
    vectors,
  ]);

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const selectTool = (nextTool: VectorTool) => {
    setTool(nextTool);
    setSelectedIds([]);
    if (nextTool === "draw") setStatus("Boş alanda sürükle.");
    if (nextTool === "move") setStatus("Bir vektörü sürükle.");
    if (nextTool === "head-to-tail") setStatus("İlk vektörü seç.");
    if (nextTool === "parallelogram") setStatus("İlk vektörü seç.");
    if (nextTool === "components") setStatus("Bir vektör seç.");
  };

  const addConstruction = (
    type: VectorConstruction["type"],
    vectorIds: number[],
  ) => {
    nextConstructionIdRef.current += 1;
    const nextConstruction = {
      id: nextConstructionIdRef.current,
      type,
      vectorIds,
    };
    setConstructions((current) => [
      ...current.filter(
        (construction) =>
          construction.type !== type ||
          construction.vectorIds.join("-") !== vectorIds.join("-"),
      ),
      nextConstruction,
    ]);
  };

  const chooseForOperation = (vectorId: number) => {
    if (tool === "components") {
      setSelectedIds([vectorId]);
      addConstruction("components", [vectorId]);
      setStatus("Bileşenler çalışma alanında.");
      setTool("move");
      return;
    }
    if (tool !== "head-to-tail" && tool !== "parallelogram") return;

    const nextSelection = selectedIds.includes(vectorId)
      ? selectedIds.filter((id) => id !== vectorId)
      : [...selectedIds, vectorId].slice(-2);
    setSelectedIds(nextSelection);
    if (nextSelection.length < 2) {
      setStatus("İkinci vektörü seç.");
      return;
    }

    const [firstId, secondId] = nextSelection;
    setVectors((current) => {
      const first = current.find((vector) => vector.id === firstId);
      const second = current.find((vector) => vector.id === secondId);
      if (!first || !second) return current;
      const secondDx = second.end.x - second.start.x;
      const secondDy = second.end.y - second.start.y;
      const sharedStart =
        tool === "head-to-tail" ? first.end : first.start;
      return current.map((vector) =>
        vector.id === secondId
          ? {
              ...vector,
              start: sharedStart,
              end: {
                x: sharedStart.x + secondDx,
                y: sharedStart.y + secondDy,
              },
            }
          : vector,
      );
    });
    addConstruction(tool, nextSelection);
    setStatus(
      tool === "head-to-tail"
        ? "Vektörler uç uca eklendi."
        : "Paralelkenar oluşturuldu.",
    );
    setTool("move");
  };

  const startInteraction = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const snappedPoint = pointFromPointer(event.clientX, event.clientY);
    const exactPoint = pointFromPointer(event.clientX, event.clientY, false);
    if (!snappedPoint || !exactPoint) return;

    if (tool === "draw") {
      const nextDraft = { start: snappedPoint, end: snappedPoint };
      pointerActionRef.current = { kind: "draw", ...nextDraft };
      setDraft(nextDraft);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const hitVector = vectorAtPoint(exactPoint);
    if (!hitVector) {
      setSelectedIds([]);
      return;
    }

    if (
      tool === "head-to-tail" ||
      tool === "parallelogram" ||
      tool === "components"
    ) {
      chooseForOperation(hitVector.id);
      return;
    }

    setSelectedIds([hitVector.id]);
    pointerActionRef.current = {
      kind: "move",
      vectorId: hitVector.id,
      pointerStart: exactPoint,
      vectorStart: hitVector.start,
      vectorEnd: hitVector.end,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveInteraction = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const action = pointerActionRef.current;
    if (!action) return;
    if (action.kind === "draw") {
      const point = pointFromPointer(event.clientX, event.clientY);
      if (!point) return;
      const nextDraft = { start: action.start, end: point };
      pointerActionRef.current = { kind: "draw", ...nextDraft };
      setDraft(nextDraft);
      return;
    }

    const point = pointFromPointer(event.clientX, event.clientY, false);
    if (!point) return;
    const dx = Math.round(point.x - action.pointerStart.x);
    const dy = Math.round(point.y - action.pointerStart.y);
    setVectors((current) =>
      current.map((vector) =>
        vector.id === action.vectorId
          ? {
              ...vector,
              start: {
                x: action.vectorStart.x + dx,
                y: action.vectorStart.y + dy,
              },
              end: {
                x: action.vectorEnd.x + dx,
                y: action.vectorEnd.y + dy,
              },
            }
          : vector,
      ),
    );
    setStatus("Vektör taşındı.");
  };

  const finishInteraction = () => {
    const completed = pointerActionRef.current;
    pointerActionRef.current = null;
    setDraft(null);
    if (
      !completed ||
      completed.kind !== "draw" ||
      samePoint(completed.start, completed.end)
    ) {
      return;
    }
    nextIdRef.current += 1;
    const nextId = nextIdRef.current;
    setVectors((current) => [
      ...current,
      {
        id: nextId,
        label: label.trim() || `V${nextId}`,
        color,
        start: completed.start,
        end: completed.end,
      },
    ]);
    setSelectedIds([nextId]);
    setLabel((current) => nextVectorLabel(current));
    setStatus("Vektör çizildi.");
  };

  const cancelInteraction = () => {
    pointerActionRef.current = null;
    setDraft(null);
  };

  const undoLastVector = () => {
    const removedId = vectors.at(-1)?.id;
    if (!removedId) return;
    setVectors((current) => current.slice(0, -1));
    setSelectedIds((current) => current.filter((id) => id !== removedId));
    setConstructions((current) =>
      current.filter(
        (construction) => !construction.vectorIds.includes(removedId),
      ),
    );
    setStatus("Son vektör kaldırıldı.");
  };

  const clearWorkspace = () => {
    setVectors([]);
    setSelectedIds([]);
    setConstructions([]);
    setStatus("Çalışma alanı temizlendi.");
  };

  const selectedVector = vectors.find(
    (vector) => vector.id === selectedIds.at(-1),
  );
  const selectedDx = selectedVector
    ? selectedVector.end.x - selectedVector.start.x
    : 0;
  const selectedDy = selectedVector
    ? selectedVector.end.y - selectedVector.start.y
    : 0;
  const selectedMagnitude = Math.sqrt(
    selectedDx * selectedDx + selectedDy * selectedDy,
  );

  return (
    <section className="blank-vector-workspace" id="vektor-calisma-alani">
      <div className="vector-tool-strip" aria-label="Vektör araçları">
        <button
          type="button"
          className={tool === "draw" ? "active" : ""}
          aria-pressed={tool === "draw"}
          onClick={() => selectTool("draw")}
        >
          <span>✎</span> Çiz
        </button>
        <button
          type="button"
          className={tool === "move" ? "active" : ""}
          aria-pressed={tool === "move"}
          disabled={!vectors.length}
          onClick={() => selectTool("move")}
        >
          <span>✥</span> Taşı
        </button>
        <button
          type="button"
          className={tool === "head-to-tail" ? "active" : ""}
          aria-pressed={tool === "head-to-tail"}
          disabled={vectors.length < 2}
          onClick={() => selectTool("head-to-tail")}
        >
          <span>↪</span> Uç uca
        </button>
        <button
          type="button"
          className={tool === "parallelogram" ? "active" : ""}
          aria-pressed={tool === "parallelogram"}
          disabled={vectors.length < 2}
          onClick={() => selectTool("parallelogram")}
        >
          <span>◇</span> Paralelkenar
        </button>
        <button
          type="button"
          className={tool === "components" ? "active" : ""}
          aria-pressed={tool === "components"}
          disabled={!vectors.length}
          onClick={() => selectTool("components")}
        >
          <span>⌜</span> Bileşenler
        </button>
      </div>

      <div className="blank-vector-toolbar">
        <label className="vector-label-field">
          <span>Etiket</span>
          <input
            value={label}
            maxLength={4}
            aria-label="Çizilecek vektörün etiketi"
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <fieldset className="vector-color-field">
          <legend>Renk</legend>
          <div>
            {VECTOR_COLORS.map((option) => (
              <button
                className={color === option ? "selected" : ""}
                style={{ backgroundColor: option }}
                type="button"
                aria-label={`Vektör rengini ${option} yap`}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                key={option}
              />
            ))}
          </div>
        </fieldset>
        <div className="blank-vector-actions">
          <button
            type="button"
            disabled={!constructions.length}
            onClick={() => {
              setConstructions([]);
              setStatus("Yöntem çizimleri kaldırıldı.");
            }}
          >
            Yöntemleri sil
          </button>
          <button
            type="button"
            disabled={!vectors.length}
            onClick={undoLastVector}
          >
            Geri al
          </button>
          <button
            type="button"
            disabled={!vectors.length}
            onClick={clearWorkspace}
          >
            Temizle
          </button>
        </div>
      </div>

      <div className="vector-workspace-status" role="status">
        <b>{status}</b>
        <span>{vectors.length} vektör</span>
      </div>

      <canvas
        ref={canvasRef}
        className="blank-vector-canvas"
        data-tool={tool}
        aria-label="Vektör çizme, seçme, taşıma ve toplama çalışma alanı"
        onPointerDown={startInteraction}
        onPointerMove={moveInteraction}
        onPointerUp={finishInteraction}
        onPointerCancel={cancelInteraction}
      />

      {selectedVector && (
        <div className="vector-properties" aria-label="Seçili vektörün özellikleri">
          <strong style={{ color: selectedVector.color }}>
            {selectedVector.label}
          </strong>
          <span>
            <small>Başlangıç</small>
            <b>({selectedVector.start.x}, {selectedVector.start.y})</b>
          </span>
          <span>
            <small>Bitiş</small>
            <b>({selectedVector.end.x}, {selectedVector.end.y})</b>
          </span>
          <span>
            <small>x bileşeni</small>
            <b>{selectedDx}</b>
          </span>
          <span>
            <small>y bileşeni</small>
            <b>{selectedDy}</b>
          </span>
          <span>
            <small>Büyüklük</small>
            <b>{selectedMagnitude.toFixed(2)}</b>
          </span>
        </div>
      )}

      <label className="vector-solution-sheet">
        <span>Çözüm alanı</span>
        <textarea rows={8} aria-label="Öğrencinin vektör çözümünü yazacağı boş alan" />
      </label>
    </section>
  );
}

export default function MechanicsLabHub({
  onBack,
}: {
  onBack: () => void;
}) {
  const [activeModule, setActiveModule] = useState<ActiveModule>(null);

  return (
    <main className="page-shell mechanics-inner-shell">
      <header className="site-header">
        <button
          className="mechanics-back-button"
          type="button"
          onClick={onBack}
          aria-label="Fizik deney setlerine dön"
        >
          ←
        </button>
        <a className="brand" href="#ust" aria-label="Fizik Atölyesi mekanik deneyleri">
          <span className="brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Mekanik deney setleri</small>
          </span>
        </a>
        <nav>
          <button
            className={activeModule === "vectors" ? "active" : ""}
            type="button"
            onClick={() => setActiveModule("vectors")}
          >
            Vektörler
          </button>
          <button
            className={activeModule === "motion" ? "active" : ""}
            type="button"
            onClick={() => setActiveModule("motion")}
          >
            Hareket deneyi
          </button>
          <button
            className={activeModule === "free-fall" ? "active" : ""}
            type="button"
            onClick={() => setActiveModule("free-fall")}
          >
            Serbest düşme
          </button>
          <button
            className={activeModule === "two-dimensional" ? "active" : ""}
            type="button"
            onClick={() => setActiveModule("two-dimensional")}
          >
            İki boyutta hareket
          </button>
          <button
            className={activeModule === "collisions" ? "active" : ""}
            type="button"
            onClick={() => setActiveModule("collisions")}
          >
            Çarpışmalar
          </button>
          <button
            className={activeModule === "ballistic-pendulum" ? "active" : ""}
            type="button"
            onClick={() => setActiveModule("ballistic-pendulum")}
          >
            Balistik sarkaç
          </button>
          <button
            className={activeModule === "torque" ? "active" : ""}
            type="button"
            onClick={() => setActiveModule("torque")}
          >
            Tork
          </button>
          <button
            className={activeModule === "harmonic-motion" ? "active" : ""}
            type="button"
            onClick={() => setActiveModule("harmonic-motion")}
          >
            Basit harmonik hareket
          </button>
        </nav>
        <span className="curriculum-chip">
          TYMM ·{" "}
          {activeModule === "collisions" ||
          activeModule === "ballistic-pendulum" ||
          activeModule === "torque" ||
          activeModule === "harmonic-motion"
            ? "12."
            : activeModule === "free-fall" ||
                activeModule === "two-dimensional"
            ? "10."
            : "9."}{" "}
          Sınıf
        </span>
      </header>

      <section className="module-launcher" id="ust">
        <div className="module-launcher-copy">
          <span>MEKANİK · ETKİLEŞİMLİ DENEYLER</span>
          <h1>Çalışmak istediğin modülü seç.</h1>
        </div>
        <div className="module-choice-grid">
          <button
            className={activeModule === "vectors" ? "active" : ""}
            type="button"
            aria-pressed={activeModule === "vectors"}
            onClick={() => setActiveModule("vectors")}
          >
            <span className="module-choice-visual vector-choice-visual" aria-hidden="true">
              <img src="./mechanics-vectors.webp" alt="" draggable="false" />
            </span>
            <span className="module-choice-copy">
              <small>MODÜL 01</small>
              <b>Vektörler</b>
              <em>Çiz, taşı ve yöntemleri uygula</em>
            </span>
            <strong>{activeModule === "vectors" ? "Açık" : "Modülü aç"} →</strong>
          </button>
          <button
            className={activeModule === "motion" ? "active" : ""}
            type="button"
            aria-pressed={activeModule === "motion"}
            onClick={() => setActiveModule("motion")}
          >
            <span className="module-choice-visual motion-choice-visual" aria-hidden="true">
              <img src="./mechanics-motion.webp" alt="" draggable="false" />
            </span>
            <span className="module-choice-copy">
              <small>MODÜL 02 · DENEY 2</small>
              <b>Hareket</b>
              <em>Hava rayı deney düzeneği</em>
            </span>
            <strong>{activeModule === "motion" ? "Açık" : "Deneyi aç"} →</strong>
          </button>
          <button
            className={`freefall-module-choice ${activeModule === "free-fall" ? "active" : ""}`}
            type="button"
            aria-pressed={activeModule === "free-fall"}
            onClick={() => setActiveModule("free-fall")}
          >
            <span className="module-choice-visual freefall-choice-visual" aria-hidden="true">
              <img src="./mechanics-freefall.webp" alt="" draggable="false" />
            </span>
            <span className="module-choice-copy">
              <small>MODÜL 03 · DENEY 3</small>
              <b>Serbest düşme</b>
              <em>Düzeneği kur, yüksekliği ayarla ve ölç</em>
            </span>
            <strong>{activeModule === "free-fall" ? "Açık" : "Deneyi aç"} →</strong>
          </button>
          <button
            className={activeModule === "two-dimensional" ? "active" : ""}
            type="button"
            aria-pressed={activeModule === "two-dimensional"}
            onClick={() => setActiveModule("two-dimensional")}
          >
            <span className="module-choice-visual twod-choice-visual" aria-hidden="true">
              <img src="./mechanics-two-dimensional.webp" alt="" draggable="false" />
            </span>
            <span className="module-choice-copy">
              <small>MODÜL 04 · DENEY 4</small>
              <b>İki boyutta hareket</b>
              <em>Doğrultuyu ve hız kademesini değiştir</em>
            </span>
            <strong>
              {activeModule === "two-dimensional" ? "Açık" : "Deneyi aç"} →
            </strong>
          </button>
          <button
            className={`collision-module-choice ${activeModule === "collisions" ? "active" : ""}`}
            type="button"
            aria-pressed={activeModule === "collisions"}
            onClick={() => setActiveModule("collisions")}
          >
            <span
              className="module-choice-visual collision-choice-visual"
              aria-hidden="true"
            >
              <img src="./mechanics-collisions.webp" alt="" draggable="false" />
            </span>
            <span className="module-choice-copy">
              <small>MODÜL 05 · DENEY 5</small>
              <b>Çarpışmalar</b>
              <em>İki boyutta momentumu ve enerjiyi karşılaştır</em>
            </span>
            <strong>
              {activeModule === "collisions" ? "Açık" : "Deneyi aç"} →
            </strong>
          </button>
          <button
            className={activeModule === "ballistic-pendulum" ? "active" : ""}
            type="button"
            aria-pressed={activeModule === "ballistic-pendulum"}
            onClick={() => setActiveModule("ballistic-pendulum")}
          >
            <span
              className="module-choice-visual ballistic-choice-visual"
              aria-hidden="true"
            >
              <img src="./mechanics-ballistic.webp" alt="" draggable="false" />
            </span>
            <span className="module-choice-copy">
              <small>MODÜL 06 · DENEY 6</small>
              <b>Balistik sarkaç</b>
              <em>Kur, fırlat ve ilk hızı iki yöntemle karşılaştır</em>
            </span>
            <strong>
              {activeModule === "ballistic-pendulum" ? "Açık" : "Deneyi aç"} →
            </strong>
          </button>
          <button
            className={`torque-module-choice ${activeModule === "torque" ? "active" : ""}`}
            type="button"
            aria-pressed={activeModule === "torque"}
            onClick={() => setActiveModule("torque")}
          >
            <span
              className="module-choice-visual torque-choice-visual"
              aria-hidden="true"
            >
              <img src="./mechanics-torque.webp" alt="" draggable="false" />
            </span>
            <span className="module-choice-copy">
              <small>MODÜL 07 · DENEY 7</small>
              <b>Dönme dinamiği ve tork</b>
              <em>Düzeneği kur; yarıçap, kütle ve eylemsizliği araştır</em>
            </span>
            <strong>{activeModule === "torque" ? "Açık" : "Deneyi aç"} →</strong>
          </button>
          <button
            className={`harmonic-module-choice ${activeModule === "harmonic-motion" ? "active" : ""}`}
            type="button"
            aria-pressed={activeModule === "harmonic-motion"}
            onClick={() => setActiveModule("harmonic-motion")}
          >
            <span
              className="module-choice-visual harmonic-choice-visual"
              aria-hidden="true"
            >
              <img src="./mechanics-harmonic-motion.webp" alt="" draggable="false" />
            </span>
            <span className="module-choice-copy">
              <small>MODÜL 08 · DENEY 8</small>
              <b>Basit harmonik hareket</b>
              <em>Yay–kütle ve basit sarkaç deneyleri</em>
            </span>
            <strong>
              {activeModule === "harmonic-motion" ? "Açık" : "Deneyi aç"} →
            </strong>
          </button>
        </div>
      </section>

      {activeModule === "vectors" && (
        <div className="module-view vector-module-view">
          <VectorWorkspace />
        </div>
      )}

      {activeModule === "motion" && <MotionLab />}

      {activeModule === "free-fall" && <FreeFallLab />}

      {activeModule === "two-dimensional" && <TwoDimensionalMotionLab />}

      {activeModule === "collisions" && <CollisionLab />}

      {activeModule === "ballistic-pendulum" && <BallisticPendulumLab />}

      {activeModule === "torque" && <TorqueLab />}

      {activeModule === "harmonic-motion" && <HarmonicMotionLab />}

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Mekanik deney setleri</small>
          </span>
        </div>
        <p>
          {activeModule === "free-fall" &&
            "TYMM FİZ.10.1.4 ve FİZ.10.1.5 öğrenme çıktılarıyla uyumludur."}
          {activeModule === "two-dimensional" &&
            "TYMM FİZ.10.1.6 öğrenme çıktısıyla uyumludur."}
          {activeModule === "collisions" &&
            "TYMM FİZ.12.1.4 öğrenme çıktısıyla uyumludur."}
          {activeModule === "ballistic-pendulum" &&
            "TYMM FİZ.12.1.4 ve FİZ.12.2.5 öğrenme çıktılarıyla uyumludur."}
          {activeModule === "torque" &&
            "TYMM FİZ.12.1.1 ve FİZ.12.1.5 öğrenme çıktılarıyla uyumludur."}
          {activeModule === "harmonic-motion" &&
            "TYMM 12. sınıf basit harmonik hareket öğrenme çıktılarıyla uyumludur."}
          {activeModule !== "free-fall" &&
            activeModule !== "two-dimensional" &&
            activeModule !== "collisions" &&
            activeModule !== "ballistic-pendulum" &&
            activeModule !== "torque" &&
            activeModule !== "harmonic-motion" &&
            "TYMM FİZ.9.2.3 ve FİZ.9.2.4 öğrenme çıktılarıyla uyumludur."}
        </p>
        <a href="#ust">Başa dön ↑</a>
      </footer>
    </main>
  );
}
