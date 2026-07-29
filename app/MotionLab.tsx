"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type MotionMode = "uniform" | "accelerated" | "force";
type EquipmentKind =
  | "rail"
  | "pump"
  | "glider"
  | "gate"
  | "timer"
  | "launcher"
  | "pulley"
  | "hanger"
  | "string"
  | "mass";

type SceneItem = {
  id: string;
  kind: EquipmentKind;
  slotId: string;
  x: number;
  y: number;
};

type RecordRow = {
  key: number;
  trials: number[];
};

type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
  originalSlotId: string;
  currentX: number;
  currentY: number;
};

type SetupSlot = {
  id: string;
  kind: EquipmentKind;
  label: string;
  instruction: string;
  x: number;
  y: number;
  dropRadius: number;
  modes: MotionMode[];
};

const EQUIPMENT: Array<{
  kind: EquipmentKind;
  label: string;
  description: string;
  symbol: string;
  multiple?: boolean;
}> = [
  { kind: "rail", label: "Hava rayı", description: "Sürtünmeyi azaltan yatay ray", symbol: "━" },
  { kind: "pump", label: "Hava pompası", description: "Ray deliklerine basınçlı hava verir", symbol: "≈" },
  { kind: "glider", label: "Kızak", description: "Ray üzerinde hareket eden cisim", symbol: "▰" },
  { kind: "gate", label: "Optik kapı", description: "Kızağın geçişini algılar", symbol: "∩", multiple: true },
  { kind: "timer", label: "Kronometre", description: "İki kapı arasındaki zamanı ölçer", symbol: "00" },
  { kind: "launcher", label: "Fırlatıcı", description: "Kızağa ilk hız kazandırır", symbol: "↦" },
  { kind: "pulley", label: "Makara", description: "İvmeli hareket aşamasında kullanılır", symbol: "○" },
  { kind: "string", label: "İp", description: "Kızak ile kefeyi bağlar", symbol: "―" },
  { kind: "hanger", label: "Kefe", description: "Asılı kütleleri taşır", symbol: "▽" },
  { kind: "mass", label: "Kütle", description: "Kefeye eklenen çekici kütle", symbol: "g", multiple: true },
];

const MODE_INFO: Record<
  MotionMode,
  { label: string; short: string; aim: string; required: EquipmentKind[] }
> = {
  uniform: {
    label: "Düzgün Doğrusal Hareket",
    short: "DDH",
    aim: "Eşit zaman aralıklarında eşit yolları ve x-t ilişkisini incele.",
    required: ["rail", "pump", "glider", "gate", "timer", "launcher"],
  },
  accelerated: {
    label: "Sabit İvmeli Hareket",
    short: "SİH",
    aim: "Asılı kütlenin oluşturduğu sabit ivmede mesafe ile geçiş süresini incele.",
    required: ["rail", "pump", "glider", "gate", "timer", "pulley", "string", "hanger", "mass"],
  },
  force: {
    label: "Kuvvet-İvme İlişkisi",
    short: "F-a",
    aim: "Asılı kütleyi değiştirerek kuvvet arttığında ivmenin değişimini gözle.",
    required: ["rail", "pump", "glider", "gate", "timer", "pulley", "string", "hanger", "mass"],
  },
};

const SETUP_SLOTS: SetupSlot[] = [
  {
    id: "rail",
    kind: "rail",
    label: "Hava rayı",
    instruction: "Hava rayını tezgâhın altındaki uzun yuvaya yerleştir.",
    x: 50,
    y: 62,
    dropRadius: 30,
    modes: ["uniform", "accelerated", "force"],
  },
  {
    id: "pump",
    kind: "pump",
    label: "Hava pompası",
    instruction: "Pompayı rayın hava girişinin yanındaki yuvaya yerleştir.",
    x: 9,
    y: 85,
    dropRadius: 16,
    modes: ["uniform", "accelerated", "force"],
  },
  {
    id: "launcher",
    kind: "launcher",
    label: "Fırlatıcı",
    instruction: "Fırlatıcıyı rayın sol başlangıç ucuna tak.",
    x: 8,
    y: 53,
    dropRadius: 14,
    modes: ["uniform"],
  },
  {
    id: "glider",
    kind: "glider",
    label: "Kızak",
    instruction: "Kızağı hava rayının sol bölümüne oturt.",
    x: 17,
    y: 55,
    dropRadius: 15,
    modes: ["uniform", "accelerated", "force"],
  },
  {
    id: "gate-1",
    kind: "gate",
    label: "1. optik kapı",
    instruction: "İlk optik kapıyı raydaki 0 cm başlangıç işaretine tak.",
    x: 28,
    y: 49,
    dropRadius: 14,
    modes: ["uniform", "accelerated", "force"],
  },
  {
    id: "gate-2",
    kind: "gate",
    label: "2. optik kapı",
    instruction: "İkinci optik kapıyı raya yerleştir; sonra ray boyunca sürükleyerek mesafeyi ayarla.",
    x: 68,
    y: 49,
    dropRadius: 24,
    modes: ["uniform", "accelerated", "force"],
  },
  {
    id: "timer",
    kind: "timer",
    label: "Kronometre",
    instruction: "Kronometreyi iki optik kapının kablo çıkışlarının yanına koy.",
    x: 72,
    y: 85,
    dropRadius: 18,
    modes: ["uniform", "accelerated", "force"],
  },
  {
    id: "pulley",
    kind: "pulley",
    label: "Makara",
    instruction: "Makarayı hava rayının sağ ucuna sabitle.",
    x: 93,
    y: 53,
    dropRadius: 12,
    modes: ["accelerated", "force"],
  },
  {
    id: "string",
    kind: "string",
    label: "İp",
    instruction: "İpi kızaktan makaraya uzanan bağlantı hattına yerleştir.",
    x: 54,
    y: 62,
    dropRadius: 32,
    modes: ["accelerated", "force"],
  },
  {
    id: "hanger",
    kind: "hanger",
    label: "Kefe",
    instruction: "Kefeyi makaranın altındaki ipin ucuna as.",
    x: 93,
    y: 76,
    dropRadius: 13,
    modes: ["accelerated", "force"],
  },
  {
    id: "mass",
    kind: "mass",
    label: "Kütle",
    instruction: "Kütleyi asılı kefenin içine bırak.",
    x: 93,
    y: 86,
    dropRadius: 12,
    modes: ["accelerated", "force"],
  },
];

const DISTANCES = [20, 30, 40, 50, 60];
const MASSES = [20, 30, 40, 50, 60];
const GLIDER_MASS = 0.2;
const HANGER_MASS = 0.005;
const GRAVITY = 9.81;
const FIRST_GATE_X = 28;
const SECOND_GATE_MIN_X = 40;
const SECOND_GATE_MAX_X = 84;
const GATE_CM_PER_STAGE_PERCENT = 1.25;
const RUN_ANIMATION_MS = 1800;

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function equipmentLabel(kind: EquipmentKind): string {
  return EQUIPMENT.find((item) => item.kind === kind)?.label ?? kind;
}

function calculateAcceleration(massGram: number): number {
  const hangingMass = (massGram / 1000) + HANGER_MASS;
  return (hangingMass * GRAVITY) / (GLIDER_MASS + hangingMass);
}

export default function MotionLab() {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const stopwatchFrameRef = useRef<number | null>(null);
  const nextItemIdRef = useRef(0);
  const [items, setItems] = useState<SceneItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolDragKind, setToolDragKind] = useState<EquipmentKind | null>(null);
  const [hangingMass, setHangingMass] = useState(40);
  const [stopwatchMs, setStopwatchMs] = useState(0);
  const [records, setRecords] = useState<Record<MotionMode, RecordRow[]>>({
    uniform: [],
    accelerated: [],
    force: [],
  });
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState(
    "1. adım: Hava rayını tezgâhtaki uzun hedefe sürükle.",
  );

  const activeSlots = SETUP_SLOTS;
  const logicalSlots = activeSlots;
  const completedSlotIds = new Set(items.map((item) => item.slotId));
  const isSlotComplete = (slot: SetupSlot) => completedSlotIds.has(slot.id);
  const nextSlot = logicalSlots.find((slot) => !isSlotComplete(slot));
  const currentStepNumber = nextSlot
    ? logicalSlots.findIndex((slot) => slot.id === nextSlot.id) + 1
    : logicalSlots.length;
  const gateCount = items.filter((item) => item.kind === "gate").length;
  const endGateItem = items.find((item) => item.slotId === "gate-2");
  const distance = endGateItem
    ? Math.round((endGateItem.x - FIRST_GATE_X) * GATE_CM_PER_STAGE_PERCENT)
    : 0;
  const gliderItem = items.find((item) => item.kind === "glider");
  const pulleyItem = items.find((item) => item.kind === "pulley");
  const runEndX = (endGateItem?.x ?? 68) + 6;
  const stringStartX = (gliderItem?.x ?? 17) + 3;
  const stringPulleyX = (pulleyItem?.x ?? 93) - 1;
  const stringRunStartX = Math.min(runEndX + 2, stringPulleyX - 8);
  const connectedStringStyle = {
    left: `${stringStartX}%`,
    width: `${Math.max(8, stringPulleyX - stringStartX)}%`,
    "--string-run-left": `${stringRunStartX}%`,
    "--string-run-width": `${Math.max(8, stringPulleyX - stringRunStartX)}%`,
  } as CSSProperties;
  const hasItem = (kind: EquipmentKind) => items.some((item) => item.kind === kind);
  const baseReady =
    hasItem("rail") &&
    hasItem("pump") &&
    hasItem("glider") &&
    gateCount === 2 &&
    hasItem("timer");
  const acceleratedReady =
    baseReady &&
    hasItem("pulley") &&
    hasItem("string") &&
    hasItem("hanger") &&
    hasItem("mass");
  const uniformReady = baseReady && hasItem("launcher") && !acceleratedReady;
  const mode: MotionMode = acceleratedReady
    ? distance === 50
      ? "force"
      : "accelerated"
    : "uniform";
  const ready = uniformReady || acceleratedReady;
  const detectedSetup = acceleratedReady
    ? mode === "force"
      ? "Kuvvet-ivme düzeneği"
      : "Sabit ivmeli hareket düzeneği"
    : uniformReady
      ? "Düzgün doğrusal hareket düzeneği"
      : "Düzenek henüz tamamlanmadı";
  const setupPlacedCount = logicalSlots.filter(isSlotComplete).length;
  const modeRows = records[mode];

  useEffect(() => {
    return () => {
      if (stopwatchFrameRef.current !== null) {
        cancelAnimationFrame(stopwatchFrameRef.current);
      }
    };
  }, []);

  const placeInSlot = (kind: EquipmentKind, slot: SetupSlot) => {
    const catalogItem = EQUIPMENT.find((item) => item.kind === kind);
    if (kind === "gate" && gateCount >= 2) {
      setNotice("İki optik kapı yerleştirildi. Mesafeyi değiştirmek için ikinci kapıyı ray üzerinde sürükle.");
      return;
    }
    if (slot.kind !== kind) {
      setNotice(`${catalogItem?.label} bu yuvaya uygun değil. ${nextSlot?.instruction ?? ""}`);
      return;
    }
    if (completedSlotIds.has(slot.id)) {
      setNotice(`${slot.label} yuvası zaten dolu.`);
      return;
    }
    nextItemIdRef.current += 1;
    const next: SceneItem = {
      id: `${kind}-${nextItemIdRef.current}`,
      kind,
      slotId: slot.id,
      x: slot.x,
      y: slot.y,
    };
    setItems((current) => [...current, next]);
    setSelectedId(next.id);
    const followingSlot = logicalSlots.find(
      (candidate) =>
        candidate.id !== slot.id &&
        !isSlotComplete(candidate),
    );
    if (
      kind === "pulley" &&
      records.uniform.reduce((total, row) => total + row.trials.length, 0) === 0
    ) {
      setNotice(
        "Makara ikinci aşamanın parçasıdır. Önce fırlatıcıyla sabit hızlı hareket ölçümlerini yapabilir, ardından makara-ip-kefe sistemine geçebilirsin.",
      );
      return;
    }
    setNotice(
      followingSlot
        ? `${slot.label} doğru yerleşti. Sıradaki: ${followingSlot.instruction}`
        : "Tüm parçalar doğru yuvalarda. Bağlantıları kontrol ederek ölçüme geç.",
    );
  };

  const addByClick = (kind: EquipmentKind) => {
    if (kind === "gate" && gateCount >= 2) {
      setNotice("İki optik kapı tamam. İkinci kapıyı tutup ray üzerinde sağa veya sola kaydırabilirsin.");
      return;
    }
    const target = activeSlots.find(
      (slot) => slot.kind === kind && !completedSlotIds.has(slot.id),
    );
    if (!target) {
      const catalogItem = EQUIPMENT.find((item) => item.kind === kind);
      setNotice(
        activeSlots.some((slot) => slot.kind === kind)
          ? `${catalogItem?.label} için gerekli tüm yuvalar dolu.`
          : `${catalogItem?.label}, seçili deney düzeneğinde kullanılmıyor.`,
      );
      return;
    }
    placeInSlot(kind, target);
  };

  const handleDrop = (clientX: number, clientY: number, kind: EquipmentKind) => {
    const stage = stageRef.current;
    if (!stage) return;
    if (kind === "gate" && gateCount >= 2) {
      setNotice("İki optik kapı tamam. Mesafeyi ikinci kapıyı ray üzerinde sürükleyerek ayarla.");
      return;
    }
    const rect = stage.getBoundingClientRect();
    const dropX = ((clientX - rect.left) / rect.width) * 100;
    const dropY = ((clientY - rect.top) / rect.height) * 100;
    const compatibleSlots = activeSlots
      .filter((slot) => slot.kind === kind && !completedSlotIds.has(slot.id))
      .map((slot) => ({
        slot,
        distance: Math.hypot(dropX - slot.x, dropY - slot.y),
      }))
      .sort((a, b) => a.distance - b.distance);
    const target = compatibleSlots[0];
    if (!target || target.distance > target.slot.dropRadius) {
      setNotice(
        target
          ? `Yanlış konum. ${target.slot.instruction} Vurgulanan bağlantı noktasını hedefle.`
          : `${equipmentLabel(kind)} için boş ve uygun bir yuva bulunmuyor.`,
      );
      return;
    }
    placeInSlot(kind, target.slot);
  };

  const startSceneDrag = (event: ReactPointerEvent<HTMLButtonElement>, item: SceneItem) => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    dragRef.current = {
      id: item.id,
      offsetX: event.clientX - stageRect.left - (item.x / 100) * stageRect.width,
      offsetY: event.clientY - stageRect.top - (item.y / 100) * stageRect.height,
      originalSlotId: item.slotId,
      currentX: item.x,
      currentY: item.y,
    };
    setSelectedId(item.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveSceneItem = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    const drag = dragRef.current;
    if (!stage || !drag) return;
    const rect = stage.getBoundingClientRect();
    const nextX = ((event.clientX - rect.left - drag.offsetX) / rect.width) * 100;
    const nextY = ((event.clientY - rect.top - drag.offsetY) / rect.height) * 100;
    drag.currentX =
      drag.originalSlotId === "gate-2"
        ? Math.max(SECOND_GATE_MIN_X, Math.min(SECOND_GATE_MAX_X, nextX))
        : Math.max(3, Math.min(94, nextX));
    drag.currentY =
      drag.originalSlotId === "gate-2" ? 49 : Math.max(4, Math.min(91, nextY));
    setItems((current) =>
      current.map((item) =>
        item.id === drag.id
          ? item.slotId === "gate-2"
            ? {
                ...item,
                x: drag.currentX,
                y: drag.currentY,
              }
            : {
                ...item,
                x: drag.currentX,
                y: drag.currentY,
              }
          : item,
      ),
    );
  };

  const finishSceneDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    const draggedItem = items.find((item) => item.id === drag.id);
    const assignedSlot = activeSlots.find((slot) => slot.id === drag.originalSlotId);
    if (assignedSlot?.id === "gate-2" && draggedItem) {
      const nextDistance = Math.round(
        (Math.max(SECOND_GATE_MIN_X, Math.min(SECOND_GATE_MAX_X, drag.currentX)) - FIRST_GATE_X) *
          GATE_CM_PER_STAGE_PERCENT,
      );
      const snappedX = FIRST_GATE_X + nextDistance / GATE_CM_PER_STAGE_PERCENT;
      setItems((current) =>
        current.map((item) =>
          item.id === drag.id
            ? { ...item, slotId: "gate-2", x: snappedX, y: assignedSlot.y }
            : item,
        ),
      );
      setNotice(`Optik kapılar arası mesafe ${nextDistance} cm olarak ayarlandı.`);
    } else if (assignedSlot) {
      setItems((current) =>
        current.map((item) =>
          item.id === drag.id
            ? { ...item, x: assignedSlot.x, y: assignedSlot.y }
            : item,
        ),
      );
      setNotice(`${assignedSlot.label} doğru yuvasına kilitlendi.`);
    }
    dragRef.current = null;
  };

  const checkSetup = () => {
    if (ready) {
      setNotice(
        `${MODE_INFO[mode].label} düzeneği tamamlandı. Kapı aralığı ${distance} cm; ölçümü başlatabilirsin.`,
      );
      return;
    }
    setNotice(
      nextSlot
        ? `Kurulum tamamlanmadı. Sıradaki adım: ${nextSlot.instruction}`
        : "Parçaların raydaki bağlantı noktalarına tam oturduğunu kontrol et.",
    );
  };

  const clearScene = () => {
    if (stopwatchFrameRef.current !== null) {
      cancelAnimationFrame(stopwatchFrameRef.current);
      stopwatchFrameRef.current = null;
    }
    setItems([]);
    setSelectedId(null);
    setIsRunning(false);
    setStopwatchMs(0);
    setNotice("Sahne temizlendi. 1. adım: Hava rayını tezgâhtaki uzun hedefe sürükle.");
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
    setNotice("Seçili araç sahneden kaldırıldı.");
  };

  const runExperiment = () => {
    if (!ready) {
      checkSetup();
      return;
    }
    const key = mode === "force" ? hangingMass : distance;
    const currentRow = modeRows.find((row) => row.key === key);
    if (currentRow && currentRow.trials.length >= 3) {
      setNotice("Bu değer için üç ölçüm tamamlandı. Başka bir değer seç veya tabloyu temizle.");
      return;
    }

    const distanceMeter = distance / 100;
    let seconds = 0;
    if (mode === "uniform") {
      seconds = distanceMeter / 0.78;
    } else {
      const acceleration = calculateAcceleration(hangingMass);
      seconds = Math.sqrt((2 * distanceMeter) / acceleration);
    }
    const milliseconds = seconds * 1000;
    const glider = items.find((item) => item.kind === "glider");
    const gliderStartX = glider?.x ?? 18;
    const gliderEndX = (endGateItem?.x ?? 68) + 6;
    const firstGateProgress = Math.max(
      0,
      Math.min(0.75, (FIRST_GATE_X - gliderStartX) / (gliderEndX - gliderStartX)),
    );

    setIsRunning(true);
    setStopwatchMs(0);
    setNotice("Kızak hareket ediyor; optik kapılar kronometreyi otomatik kontrol ediyor.");
    if (stopwatchFrameRef.current !== null) {
      cancelAnimationFrame(stopwatchFrameRef.current);
    }
    const animationStartedAt = performance.now();
    const updateStopwatch = (now: number) => {
      const progress = Math.min(1, (now - animationStartedAt) / RUN_ANIMATION_MS);
      const measuredProgress =
        progress <= firstGateProgress
          ? 0
          : Math.min(1, (progress - firstGateProgress) / (1 - firstGateProgress));
      setStopwatchMs(milliseconds * measuredProgress);

      if (progress < 1) {
        stopwatchFrameRef.current = requestAnimationFrame(updateStopwatch);
        return;
      }

      stopwatchFrameRef.current = null;
      setRecords((current) => {
        const rows = current[mode];
        const existing = rows.find((row) => row.key === key);
        const nextRows = existing
          ? rows.map((row) =>
              row.key === key ? { ...row, trials: [...row.trials, milliseconds] } : row,
            )
          : [...rows, { key, trials: [milliseconds] }].sort((a, b) => a.key - b.key);
        return { ...current, [mode]: nextRows };
      });
      setIsRunning(false);
      setNotice(
        `${mode === "force" ? `${hangingMass} g` : `${distance} cm`} için kızağın bayrağı iki kapı arasını ${(milliseconds / 1000).toFixed(3)} saniyede geçti.`,
      );
    };
    stopwatchFrameRef.current = requestAnimationFrame(updateStopwatch);
  };

  return (
    <section className="motion-lab-section" id="hareket-laboratuvari">
      <div className="motion-lab-inner">
        <div className="section-heading light-heading motion-heading">
          <span>05 · DENEY 2 · HAVA RAYI</span>
          <h2>Tek ray, öğrencinin kurduğu deney.</h2>
          <p>
            Tüm malzemeler aynı ekranda açık. Fırlatıcıyı eklersen düzgün doğrusal hareket,
            makara-ip-kefe-kütle sistemini tamamlarsan ivmeli hareket otomatik tanınır.
          </p>
        </div>

        <div className={`detected-setup-banner ${ready ? "ready" : ""}`}>
          <span>{ready ? "✓" : "i"}</span>
          <div>
            <small>SİSTEMİN TANIDIĞI DÜZENEK</small>
            <b>{detectedSetup}</b>
            <p>
              {acceleratedReady
                ? distance === 50
                  ? "Kapı aralığı 50 cm olduğu için değişen kütleye bağlı kuvvet-ivme tablosu hazırlanır."
                  : `${distance} cm kapı aralığında sabit ivmeli hareketin geçiş süresi kaydedilir.`
                : uniformReady
                  ? "Kızak fırlatıcıyla sabit hızlı hareket eder; x-t tablosu doldurulur."
                  : "Önce hava rayı, pompa, kızak, iki optik kapı ve kronometreyi yerleştir; ardından hareket sistemini tamamla."}
            </p>
          </div>
        </div>

        <div className="setup-guide" aria-label="Deney düzeneği kurulum yönergesi">
          <div>
            <span>1</span>
            <p><b>Temeli kur</b> Uzun hava rayını yerleştir; pompa, kızak ve kronometreyi ekle.</p>
          </div>
          <div>
            <span>2</span>
            <p><b>Kapıları koy</b> İlk kapı başlangıçta kalır; ikinci kapıyı ray üzerinde kaydırarak mesafeyi belirle.</p>
          </div>
          <div>
            <span>3</span>
            <p><b>İkinci aşamaya geç</b> Sabit hızlı ölçümlerden sonra makara-ip-kefe-kütle sistemini tamamla.</p>
          </div>
          <div>
            <span>4</span>
            <p><b>Ölç</b> Sistem düzeneği tanır; kızak hareket eder ve ilgili tablo doldurulur.</p>
          </div>
        </div>

        <div className={`pulley-sequence-warning ${hasItem("pulley") ? "pulley-added" : ""}`}>
          <span>{hasItem("pulley") ? "✓" : "!"}</span>
          <div>
            <b>Makara ilk deney için gerekli değildir.</b>
            <p>
              Önce fırlatıcıyla makarasız sabit hızlı hareket ölçümlerini tamamla.
              İvmeli harekete geçerken makara, ip, kefe ve kütleyi ekle.
            </p>
          </div>
        </div>

        <div className="motion-builder">
          <aside className="equipment-panel">
            <div className="equipment-head">
              <span>TÜM MALZEMELER AÇIK</span>
              <h3>Tek düzenek araç kutusu</h3>
              <p>Parçaları istediğin sırayla sürükle; her parça yalnızca şablondaki gerçek bağlantı noktasına oturur.</p>
            </div>
            <div className="equipment-list">
              {EQUIPMENT.map((item) => {
                const neededSlots = activeSlots.filter((slot) => slot.kind === item.kind);
                const placedCount = items.filter((placed) => placed.kind === item.kind).length;
                const isNeeded = neededSlots.length > 0;
                const neededCount = item.kind === "gate" ? 2 : 1;
                const isComplete = isNeeded && placedCount >= neededCount;
                const isNext = nextSlot?.kind === item.kind;
                return (
                  <button
                    className={`${isNext ? "next-equipment" : ""} ${isComplete ? "equipment-complete" : ""}`}
                    type="button"
                    draggable={isNeeded && !isComplete}
                    disabled={!isNeeded || isComplete}
                    key={item.kind}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/x-spektrum-equipment", item.kind);
                      event.dataTransfer.effectAllowed = "copy";
                      setToolDragKind(item.kind);
                    }}
                    onDragEnd={() => setToolDragKind(null)}
                    onClick={() => addByClick(item.kind)}
                  >
                    <EquipmentVisual kind={item.kind} mini />
                    <div>
                      <b>{item.label}</b>
                      <small>
                        {!isNeeded
                          ? "Bu düzende kullanılmaz"
                          : isComplete
                            ? "Doğru yerleştirildi"
                            : `${placedCount}/${neededCount} · ${item.description}`}
                      </small>
                    </div>
                    <i>{isComplete ? "✓" : isNext ? currentStepNumber : "+"}</i>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="motion-stage-column">
            <div className="motion-stage-toolbar">
              <div>
                <span className={`setup-light ${ready ? "ready" : ""}`} />
                <b>{ready ? detectedSetup : "Ana düzenek kuruluyor"}</b>
                <small>
                  {ready
                    ? `${distance} cm · ${items.length} parça yerleşti`
                    : `${setupPlacedCount} bağlantı tamamlandı · önerilen: ${nextSlot?.label}`}
                </small>
              </div>
              <div>
                <button type="button" onClick={checkSetup}>Bağlantıları kontrol et</button>
                <button type="button" disabled={!selectedId} onClick={removeSelected}>Seçileni sil</button>
                <button type="button" onClick={clearScene}>Sahneyi temizle</button>
              </div>
            </div>

            <div
              className={`motion-stage ${isRunning ? "running" : ""}`}
              ref={stageRef}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(event) => {
                event.preventDefault();
                setToolDragKind(null);
                const kind = event.dataTransfer.getData(
                  "application/x-spektrum-equipment",
                ) as EquipmentKind;
                if (EQUIPMENT.some((item) => item.kind === kind)) {
                  handleDrop(event.clientX, event.clientY, kind);
                }
              }}
              onPointerMove={moveSceneItem}
              onPointerUp={finishSceneDrag}
              onPointerCancel={finishSceneDrag}
              onClick={(event) => {
                if (event.target === event.currentTarget) setSelectedId(null);
              }}
            >
              <div className="stage-grid" />
              {hasItem("rail") && (
                <div className="air-track-bench" aria-hidden="true">
                  <span />
                </div>
              )}
              <div className="stage-top-label">
                <span>{MODE_INFO[mode].short}</span>
                <div>
                  <b>Kurulum tezgâhı</b>
                  <small>Parçalar raydaki gerçek bağlantı noktalarına oturur.</small>
                </div>
              </div>
              {baseReady && !hasItem("pulley") && (
                <div className="stage-pulley-alert" role="alert">
                  <span>!</span>
                  <div>
                    <b>İvmeli hareket deneyi yapmak istiyorsan makarayı bağla.</b>
                    <small>Makarayı rayın sağ ucundaki bağlantıya yerleştir.</small>
                  </div>
                </div>
              )}
              {activeSlots
                .filter((slot) => {
                  if (completedSlotIds.has(slot.id)) return false;
                  return toolDragKind ? slot.kind === toolDragKind : nextSlot?.id === slot.id;
                })
                .map((slot) => {
                const occupied = completedSlotIds.has(slot.id);
                const highlighted =
                  nextSlot?.id === slot.id || toolDragKind === slot.kind;
                return (
                  <div
                    className={`setup-slot slot-${slot.kind} ${occupied ? "occupied" : ""} ${highlighted ? "highlighted" : ""}`}
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    key={slot.id}
                  >
                    <span>+</span>
                    <b>{slot.label}</b>
                  </div>
                );
              })}
              {items.some((item) => item.kind === "pump") && items.some((item) => item.kind === "rail") && (
                <div className="stage-hose" aria-hidden="true" />
              )}
              {gateCount === 2 && items.some((item) => item.kind === "timer") && (
                <div className="stage-cables" aria-hidden="true" />
              )}
              {hasItem("string") && gliderItem && pulleyItem && (
                <div
                  className={`stage-string-path ${isRunning ? "pulling" : ""}`}
                  style={connectedStringStyle}
                  aria-label="İp kızaktan makaraya uzanır ve makaradan aşağıdaki kefeye iner"
                >
                  <i className="string-glider-knot" />
                  <i className="string-pulley-knot" />
                  <span>Kızak → makara → kefe</span>
                </div>
              )}
              {items.filter((item) => item.kind !== "string").map((item) => (
                <SceneEquipment
                  item={item}
                  selected={item.id === selectedId}
                  running={isRunning && item.kind === "glider"}
                  reading={isRunning && item.kind === "gate"}
                  readingDelay={
                    item.kind === "gate"
                      ? Math.max(
                          0,
                          ((item.x - (gliderItem?.x ?? 18)) /
                            (runEndX - (gliderItem?.x ?? 18))) *
                            (RUN_ANIMATION_MS / 1000)
                        )
                      : 0
                  }
                  runEndX={runEndX}
                  stopwatchSeconds={stopwatchMs / 1000}
                  onPointerDown={(event) => startSceneDrag(event, item)}
                  key={item.id}
                />
              ))}
              {endGateItem && (
                <div
                  className="gate-distance-line"
                  style={{
                    left: `${FIRST_GATE_X}%`,
                    width: `${endGateItem.x - FIRST_GATE_X}%`,
                  }}
                >
                  <span />
                  <b>{distance} cm</b>
                </div>
              )}
            </div>

            <div className="motion-notice" role="status" aria-live="polite">
              <span>{ready ? "✓" : "i"}</span>
              <p>
                <b>{ready ? "Kurulum tamamlandı. " : `Adım ${currentStepNumber}/${logicalSlots.length}: `}</b>
                {notice}
              </p>
            </div>
          </div>
        </div>

        <div className="measurement-workspace">
          <div className="measurement-controls">
            <span>ÖLÇÜM KONTROLLERİ</span>
            <h3>{MODE_INFO[mode].label}</h3>
            <p className="measurement-target-note">
              <b>Kronometrenin ölçtüğü:</b> Kızağın turuncu bayrağının birinci optik
              kapıdan ikinci optik kapıya ulaşma süresi. Mesafeyi ikinci kapıyı ray
              üzerinde sürükleyerek değiştir.
            </p>
            <label>
              Kefeye eklenen kütle
              <select
                value={hangingMass}
                disabled={!hasItem("mass")}
                onChange={(event) => setHangingMass(Number(event.target.value))}
              >
                {MASSES.map((value) => (
                  <option value={value} key={value}>{value} g</option>
                ))}
              </select>
            </label>
            <div className="experiment-constants">
              <span><small>Kızak kütlesi</small><b>200 g</b></span>
              <span><small>Kefe kütlesi</small><b>5 g</b></span>
              {acceleratedReady && <span><small>Ek kütle</small><b>{hangingMass} g</b></span>}
            </div>
            <button
              className="run-motion-button"
              type="button"
              disabled={isRunning || !ready}
              onClick={runExperiment}
            >
              {isRunning ? "Ölçüm yapılıyor..." : ready ? "Kızağı bırak ve ölç" : "Önce düzeneği tamamla"}
            </button>
            <button
              className="clear-records-button"
              type="button"
              onClick={() => {
                setRecords((current) => ({ ...current, [mode]: [] }));
                setNotice("Aktif deneyin ölçüm tablosu temizlendi.");
              }}
            >
              Tabloyu temizle
            </button>
            <p>Her mesafe veya kütle için üç ölçüm yap. Kronometre optik kapılarla otomatik çalışır.</p>
          </div>

          <div className="measurement-results">
            <div className="result-head">
              <div>
                <span>DENEY VERİLERİ</span>
                <h3>Konum-zaman ve kütle-ivme</h3>
              </div>
              <b>
                {Object.values(records).reduce(
                  (total, rows) =>
                    total + rows.reduce((rowTotal, row) => rowTotal + row.trials.length, 0),
                  0,
                )} ölçüm
              </b>
            </div>
            <MotionTable mode={mode} rows={modeRows} />
            <div className="dual-motion-graphs">
              <MotionGraph kind="position" records={records} pulleyConnected={hasItem("pulley")} />
              <MotionGraph kind="mass" records={records} pulleyConnected={hasItem("pulley")} />
            </div>
          </div>
        </div>

        <section className="student-report">
          <div className="report-heading">
            <span>ÖĞRENCİ DENEY RAPORU</span>
            <h3>Gözlemini kanıtlarıyla açıkla</h3>
            <p>Yanıtlarını kendi cümlelerinle yaz; tablodaki ölçümlerinden örnek ver.</p>
          </div>
          <div className="report-grid">
            <label>
              <span>1 · DÜZENEK VE HAREKET</span>
              Kurduğun düzeneği ve sistemin tanıdığı hareket türünü açıkla.
              <textarea rows={4} placeholder="Ray, optik kapılar ve kızağın hareketini açıklayarak başla…" />
            </label>
            <label>
              <span>2 · MESAFE VE SÜRE</span>
              Optik kapılar arasındaki mesafe değiştiğinde ölçülen süre nasıl değişti?
              <textarea rows={4} placeholder="En az iki ölçüm değerini karşılaştır…" />
            </label>
            <label>
              <span>3 · DÜZENEĞİN ETKİSİ</span>
              {acceleratedReady
                ? "Kefedeki kütleyi değiştirmek kızağın hareketini nasıl etkiledi?"
                : "Kızağı harekete geçiren parçanın sistemdeki görevi nedir?"}
              <textarea rows={4} placeholder="Gözlediğin değişimi ve olası nedenini yaz…" />
            </label>
            <label>
              <span>4 · ÖLÇÜMÜ AÇIKLA</span>
              Kronometre kızağın hangi bölümünü izledi? Optik kapıların süreyi
              hangi iki anda başlatıp durdurduğunu açıkla.
              <textarea rows={4} placeholder="Turuncu ölçüm bayrağını ve optik kapıları düşün…" />
            </label>
          </div>
          <label className="report-conclusion">
            <span>SONUÇ</span>
            Deneyden çıkardığın temel sonucu kısa bir paragrafla yaz.
            <textarea rows={5} placeholder="Verilerin sonucunu destekleyen genel çıkarımını yaz…" />
          </label>
        </section>
      </div>
    </section>
  );
}

function SceneEquipment({
  item,
  selected,
  running,
  reading,
  readingDelay,
  runEndX,
  stopwatchSeconds,
  onPointerDown,
}: {
  item: SceneItem;
  selected: boolean;
  running: boolean;
  reading: boolean;
  readingDelay: number;
  runEndX: number;
  stopwatchSeconds: number;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const catalog = EQUIPMENT.find((entry) => entry.kind === item.kind);
  const style = {
    left: `${item.x}%`,
    top: `${item.y}%`,
    "--run-end-left": `${runEndX}%`,
    "--gate-delay": `${readingDelay}s`,
  } as CSSProperties;

  return (
    <button
      className={`scene-equipment equipment-${item.kind} ${item.slotId === "gate-2" ? "sliding-gate" : ""} ${selected ? "selected" : ""} ${running ? "run-glider" : ""} ${reading ? "reading-gate" : ""}`}
      style={style}
      type="button"
      aria-label={
        item.slotId === "gate-2"
          ? "İkinci optik kapı; mesafeyi ayarlamak için ray üzerinde sürükle"
          : `${catalog?.label}; sürüklemek için tut`
      }
      onPointerDown={onPointerDown}
    >
      <EquipmentVisual kind={item.kind} timerValue={stopwatchSeconds} />
      {item.kind === "glider" && (
        <em className="measured-part-label">Ölçülen: turuncu bayrak</em>
      )}
      <small>{catalog?.label}</small>
    </button>
  );
}

function EquipmentVisual({
  kind,
  mini = false,
  timerValue = 0,
}: {
  kind: EquipmentKind;
  mini?: boolean;
  timerValue?: number;
}) {
  return (
    <span className={`equipment-visual visual-${kind} ${mini ? "mini" : ""}`} aria-hidden="true">
      {kind === "rail" && (
        <>
          <i className="rail-beam" />
          <i className="rail-holes" />
          <i className="rail-ruler" />
          <i className="rail-leg rail-leg-left" />
          <i className="rail-leg rail-leg-right" />
          <i className="rail-inlet" />
          <i className="rail-endcap rail-endcap-left" />
          <i className="rail-endcap rail-endcap-right" />
        </>
      )}
      {kind === "pump" && (
        <>
          <i className="pump-body" />
          <i className="pump-grille" />
          <i className="pump-switch" />
          <i className="pump-nozzle" />
        </>
      )}
      {kind === "glider" && (
        <>
          <i className="glider-saddle" />
          <i className="glider-body" />
          <i className="glider-flag" />
        </>
      )}
      {kind === "gate" && (
        <>
          <i className="gate-base" />
          <i className="gate-post gate-post-left" />
          <i className="gate-post gate-post-right" />
          <i className="gate-beam" />
          <i className="gate-light" />
        </>
      )}
      {kind === "timer" && (
        <>
          <i className="timer-case" />
          <i className="timer-screen">{timerValue.toFixed(3)}</i>
          <i className="timer-port timer-port-one" />
          <i className="timer-port timer-port-two" />
        </>
      )}
      {kind === "launcher" && (
        <>
          <i className="launcher-base" />
          <i className="launcher-spring" />
          <i className="launcher-stop" />
        </>
      )}
      {kind === "pulley" && (
        <>
          <i className="pulley-bracket" />
          <i className="pulley-wheel" />
          <i className="pulley-hub" />
        </>
      )}
      {kind === "string" && <i className="string-line" />}
      {kind === "hanger" && (
        <>
          <i className="hanger-cord" />
          <i className="hanger-hook" />
          <i className="hanger-cup" />
        </>
      )}
      {kind === "mass" && (
        <>
          <i className="mass-handle" />
          <i className="mass-body" />
          <i className="mass-mark">g</i>
        </>
      )}
    </span>
  );
}

function MotionTable({ mode, rows }: { mode: MotionMode; rows: RecordRow[] }) {
  const keys =
    mode === "force"
      ? MASSES
      : Array.from(new Set([...DISTANCES, ...rows.map((row) => row.key)])).sort((a, b) => a - b);

  return (
    <div className="motion-table-wrap">
      <table className="motion-table">
        <thead>
          <tr>
            <th>{mode === "force" ? "Ek kütle (g)" : "Kapılar arası mesafe (cm)"}</th>
            <th>Kızağın bayrağının geçiş süreleri (s)</th>
            <th>Ölçüm sayısı</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const row = rows.find((entry) => entry.key === key);
            return (
              <tr key={key}>
                <th>{key}</th>
                <td>
                  {row?.trials.length
                    ? row.trials.map((trial) => (trial / 1000).toFixed(3)).join(" · ")
                    : "—"}
                </td>
                <td>{row?.trials.length ?? 0} / 3</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type MotionGraphKind = "position" | "mass";

function MotionGraph({
  kind,
  records,
  pulleyConnected,
}: {
  kind: MotionGraphKind;
  records: Record<MotionMode, RecordRow[]>;
  pulleyConnected: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const series = useMemo(
    () => {
      if (kind === "position") {
        return [
          {
            color: "#167f75",
            points: records.uniform
              .filter((row) => row.trials.length)
              .map((row) => ({
                x: average(row.trials) / 1000,
                y: row.key / 100,
              })),
          },
          {
            color: "#ef9f28",
            points: records.accelerated
              .filter((row) => row.trials.length)
              .map((row) => ({
                x: average(row.trials) / 1000,
                y: row.key / 100,
              })),
          },
        ];
      }

      return [
        {
          color: "#9b6b92",
          points: records.force
            .filter((row) => row.trials.length)
            .map((row) => {
              const avgSeconds = average(row.trials) / 1000;
              return {
                x: row.key,
                y: avgSeconds ? 1 / (avgSeconds * avgSeconds) : 0,
              };
            }),
        },
      ];
    },
    [kind, records],
  );
  const points = series.flatMap((entry) => entry.points);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.getBoundingClientRect().width, 300);
    const height = 220;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f7fbf8";
    context.fillRect(0, 0, width, height);

    const margin = { left: 48, right: 20, top: 20, bottom: 38 };
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;
    context.strokeStyle = "#d4e2de";
    context.lineWidth = 1;
    for (let i = 0; i <= 5; i += 1) {
      const y = margin.top + (graphHeight / 5) * i;
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(width - margin.right, y);
      context.stroke();
    }
    context.strokeStyle = "#78918f";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(margin.left, margin.top);
    context.lineTo(margin.left, height - margin.bottom);
    context.lineTo(width - margin.right, height - margin.bottom);
    context.stroke();

    context.fillStyle = "#607b7e";
    context.font = "700 11px Arial";
    const xLabel = kind === "mass" ? "kütle (g)" : "zaman (s)";
    const yLabel = kind === "mass" ? "ivme (m/s²)" : "konum (m)";
    context.fillText(xLabel, width - (kind === "mass" ? 76 : 72), height - 12);
    context.save();
    context.translate(14, 62);
    context.rotate(-Math.PI / 2);
    context.fillText(yLabel, 0, 0);
    context.restore();

    if (!points.length) {
      context.fillStyle = "#809596";
      context.font = "600 12px Arial";
      context.fillText("Ölçüm yaptıkça grafik burada oluşacak.", margin.left + 24, 112);
      return;
    }

    const maxX = Math.max(...points.map((point) => point.x), 0.1) * 1.15;
    const maxY = Math.max(...points.map((point) => point.y), 0.1) * 1.15;
    const projected = points.map((point) => ({
      x: margin.left + (point.x / maxX) * graphWidth,
      y: height - margin.bottom - (point.y / maxY) * graphHeight,
    }));

    let projectedIndex = 0;
    series.forEach((entry) => {
      const projectedSeries = projected.slice(
        projectedIndex,
        projectedIndex + entry.points.length,
      );
      projectedIndex += entry.points.length;
      if (!projectedSeries.length) return;

      context.beginPath();
      projectedSeries.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.strokeStyle = entry.color;
      context.lineWidth = 3;
      context.stroke();
      projectedSeries.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, Math.PI * 2);
        context.fillStyle = entry.color;
        context.fill();
        context.strokeStyle = "white";
        context.lineWidth = 2;
        context.stroke();
      });
    });
  }, [kind, points, series]);

  return (
    <div className={`motion-graph graph-${kind}`}>
      <div>
        <span>CANLI GRAFİK</span>
        <b>{kind === "mass" ? "Kütle – ivme" : "Konum – zaman"}</b>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={
          kind === "mass"
            ? "Kütle ile ivme arasındaki ölçüm grafiği"
            : "Konum ile zaman arasındaki ölçüm grafiği"
        }
      />
      {kind === "mass" && !pulleyConnected && (
        <div className="graph-pulley-lock" role="status">
          <span>!</span>
          <b>İvmeli hareket deneyi yapmak istiyorsan makarayı bağla.</b>
        </div>
      )}
    </div>
  );
}
