"use client";

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type LensType = "converging" | "diverging";
type EquipmentKind =
  | "rail"
  | "ray-box"
  | "object"
  | "lens-holder"
  | "lens-set"
  | "screen"
  | "ruler";
type DragKind = "object" | "lens" | "screen";
type RayKind = "parallel" | "center" | "focus";
type Reading = {
  id: string;
  lens: string;
  objectDistance: number;
  focalLength: number;
  imageDistance: string;
  magnification: string;
  result: string;
};

const MIME = "application/x-lens-lab-equipment";
const LAB_BENCH_ASSET = "./ohm-lab-bench-real-v2.webp";
const OPTICAL_RAIL_ASSET = "./optics-rail-real-v1.webp";
const ILLUMINATED_OBJECT_ASSET = "./optics-arrow-object-real-v1.webp";
const LENS_HOLDER_ASSET = "./optics-lens-holder-real-v1.webp";
const CONVEX_LENS_ASSET = "./optics-convex-lens-cell-real-v1.webp";
const CONCAVE_LENS_ASSET = "./optics-concave-lens-cell-real-v1.webp";
const SCREEN_ASSET = "./optics-screen-real-v2.webp";

const EQUIPMENT_ASSETS: Partial<Record<EquipmentKind, string>> = {
  rail: OPTICAL_RAIL_ASSET,
  "ray-box": ILLUMINATED_OBJECT_ASSET,
  object: ILLUMINATED_OBJECT_ASSET,
  "lens-holder": LENS_HOLDER_ASSET,
  "lens-set": CONVEX_LENS_ASSET,
  screen: SCREEN_ASSET,
  ruler: OPTICAL_RAIL_ASSET,
};

const EQUIPMENT: Array<{ kind: EquipmentKind; name: string; detail: string }> = [
  { kind: "rail", name: "Cetvelli optik ray", detail: "Tüm parçaları aynı asal eksende tutar" },
  { kind: "ray-box", name: "Işıklı cisim kutusu", detail: "Ok biçimli cismi aydınlatır" },
  { kind: "object", name: "Saydam ok cismi", detail: "Görüntüsü incelenecek cisimdir" },
  { kind: "lens-holder", name: "Mercek taşıyıcısı", detail: "Merceği ray üzerinde dik tutar" },
  { kind: "lens-set", name: "İnce ve kalın kenarlı mercek", detail: "Yakınsak ve ıraksak mercek seti" },
  { kind: "screen", name: "Beyaz görüntü ekranı", detail: "Gerçek görüntüyü yakalar" },
  { kind: "ruler", name: "Optik ray cetveli", detail: "Konum ve uzaklıkları ölçer" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tidy(value: number, digits = 2) {
  const rounded = Number(value.toFixed(digits));
  return Math.abs(rounded) < 10 ** -digits ? 0 : rounded;
}

function EquipmentIcon({ kind }: { kind: EquipmentKind }) {
  const asset = EQUIPMENT_ASSETS[kind];
  return (
    <span className={`oll-equipment-icon icon-${kind} ${asset ? "has-photo" : ""}`} aria-hidden="true">
      {asset ? <img src={asset} alt="" draggable="false" /> : <><i /><i /><i /></>}
    </span>
  );
}

function RayDiagram({
  objectX,
  lensX,
  screenX,
  focalLength,
  objectHeight,
  imageX,
  magnification,
  lensType,
  lightOn,
  ready,
  rays,
  finiteImage,
}: {
  objectX: number;
  lensX: number;
  screenX: number;
  focalLength: number;
  objectHeight: number;
  imageX: number;
  magnification: number;
  lensType: LensType;
  lightOn: boolean;
  ready: boolean;
  rays: Record<RayKind, boolean>;
  finiteImage: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(940, rect.width);
    const height = Math.max(570, rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    if (!ready) return;

    const axisY = 225;
    const toX = (position: number) => width * (0.1 + position * 0.008);
    const objectPx = toX(objectX);
    const lensPx = toX(lensX);
    const objectTipY = axisY - objectHeight * 9;
    const rightEdge = Math.min(width * 0.92, toX(screenX));
    const leftEdge = width * 0.07;

    context.save();
    context.strokeStyle = "rgba(43, 77, 84, 0.48)";
    context.lineWidth = 1.5;
    context.setLineDash([7, 6]);
    context.beginPath();
    context.moveTo(leftEdge, axisY);
    context.lineTo(rightEdge, axisY);
    context.stroke();
    context.restore();

    if (!lightOn) return;

    const drawLine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      dashed = false,
      widthValue = 3,
    ) => {
      context.save();
      context.strokeStyle = color;
      context.lineWidth = widthValue;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.shadowColor = color;
      context.shadowBlur = dashed ? 0 : 7;
      if (dashed) context.setLineDash([8, 7]);
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
      context.restore();
    };

    const yAtX = (x1: number, y1: number, x2: number, y2: number, targetX: number) => {
      if (Math.abs(x2 - x1) < 0.001) return y2;
      return y1 + ((targetX - x1) / (x2 - x1)) * (y2 - y1);
    };

    const colors = { parallel: "#ff9f2f", center: "#13a6a1", focus: "#6c86e8" };
    const nearFocusX = toX(lensX - focalLength);
    const farFocusX = toX(lensX + focalLength);
    const imageTipY = axisY - magnification * objectHeight * 9;

    if (rays.parallel) {
      drawLine(objectPx, objectTipY, lensPx, objectTipY, colors.parallel);
      const guideFocusX = lensType === "converging" ? farFocusX : nearFocusX;
      const yEnd = yAtX(guideFocusX, axisY, lensPx, objectTipY, rightEdge);
      drawLine(lensPx, objectTipY, rightEdge, yEnd, colors.parallel);
      if (finiteImage && magnification > 0) {
        drawLine(lensPx, objectTipY, toX(imageX), imageTipY, colors.parallel, true, 2);
      }
    }

    if (rays.center) {
      drawLine(objectPx, objectTipY, lensPx, axisY, colors.center);
      const yEnd = yAtX(objectPx, objectTipY, lensPx, axisY, rightEdge);
      drawLine(lensPx, axisY, rightEdge, yEnd, colors.center);
      if (finiteImage && magnification > 0) {
        drawLine(lensPx, axisY, toX(imageX), imageTipY, colors.center, true, 2);
      }
    }

    if (rays.focus) {
      if (lensType === "converging" && objectX < lensX - focalLength) {
        const lensHitY = yAtX(objectPx, objectTipY, nearFocusX, axisY, lensPx);
        drawLine(objectPx, objectTipY, lensPx, lensHitY, colors.focus);
        drawLine(lensPx, lensHitY, rightEdge, lensHitY, colors.focus);
      }
      if (lensType === "diverging") {
        const lensHitY = yAtX(objectPx, objectTipY, farFocusX, axisY, lensPx);
        drawLine(objectPx, objectTipY, lensPx, lensHitY, colors.focus);
        drawLine(lensPx, lensHitY, rightEdge, lensHitY, colors.focus);
        if (finiteImage) drawLine(lensPx, lensHitY, toX(imageX), imageTipY, colors.focus, true, 2);
      }
    }

    if (finiteImage && imageX >= 0 && imageX <= 100) {
      const imagePx = toX(imageX);
      const cappedTipY = clamp(imageTipY, 75, 395);
      context.save();
      context.strokeStyle = magnification > 0 ? "rgba(64, 102, 177, .72)" : "#315ea8";
      context.fillStyle = magnification > 0 ? "rgba(64, 102, 177, .72)" : "#315ea8";
      context.lineWidth = 5;
      if (magnification > 0) context.setLineDash([6, 5]);
      context.beginPath();
      context.moveTo(imagePx, axisY);
      context.lineTo(imagePx, cappedTipY);
      context.stroke();
      context.beginPath();
      context.moveTo(imagePx, cappedTipY);
      context.lineTo(imagePx - 8, cappedTipY + (magnification > 0 ? 13 : -13));
      context.lineTo(imagePx + 8, cappedTipY + (magnification > 0 ? 13 : -13));
      context.closePath();
      context.fill();
      context.font = "900 10px system-ui";
      context.textAlign = "center";
      context.fillText(magnification > 0 ? "SANAL GÖRÜNTÜ" : "GERÇEK GÖRÜNTÜ", imagePx, magnification > 0 ? cappedTipY - 13 : cappedTipY + 25);
      context.restore();
    }

    context.save();
    context.fillStyle = "rgba(29, 67, 76, .78)";
    context.font = "900 9px system-ui";
    context.textAlign = "center";
    context.fillText("ASAL EKSEN", width * 0.5, axisY + 18);
    context.restore();
  }, [finiteImage, focalLength, imageX, lensType, lensX, lightOn, magnification, objectHeight, objectX, rays, ready, screenX]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return <canvas ref={canvasRef} className="oll-ray-canvas" aria-label="Mercekte özel ışınlar ve görüntü oluşumu" />;
}

export default function LensLab() {
  const [placed, setPlaced] = useState<EquipmentKind[]>([]);
  const [lensType, setLensType] = useState<LensType>("converging");
  const [objectX, setObjectX] = useState(20);
  const [lensX, setLensX] = useState(50);
  const [screenX, setScreenX] = useState(65);
  const [focalLength, setFocalLength] = useState(10);
  const [objectHeight, setObjectHeight] = useState(4);
  const [lensAngle, setLensAngle] = useState(0);
  const [lightOn, setLightOn] = useState(false);
  const [rays, setRays] = useState<Record<RayKind, boolean>>({ parallel: true, center: true, focus: true });
  const [readings, setReadings] = useState<Reading[]>([]);
  const [report, setReport] = useState({ convex: "", concave: "", screen: "", life: "" });
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragKind | null>(null);

  const nextEquipment = EQUIPMENT[placed.length]?.kind;
  const ready = EQUIPMENT.every(({ kind }) => placed.includes(kind));
  const objectDistance = lensX - objectX;
  const signedFocal = lensType === "converging" ? focalLength : -focalLength;
  const denominator = 1 / signedFocal - 1 / objectDistance;
  const atInfinity = lensType === "converging" && Math.abs(denominator) < 0.004;
  const imageDistance = atInfinity ? Number.POSITIVE_INFINITY : 1 / denominator;
  const magnification = atInfinity ? 0 : -imageDistance / objectDistance;
  const imageX = atInfinity ? Number.POSITIVE_INFINITY : lensX + imageDistance;
  const finiteImage = Number.isFinite(imageX);
  const realImage = finiteImage && imageDistance > 0;
  const imageOnRail = finiteImage && imageX >= 0 && imageX <= 100;
  const imageHeight = atInfinity ? Number.POSITIVE_INFINITY : Math.abs(magnification) * objectHeight;
  const screenDistance = realImage && imageOnRail ? Math.abs(screenX - imageX) : Number.POSITIVE_INFINITY;
  const lensAligned = lensAngle === 0;
  const focusQuality = ready && lightOn && lensAligned && realImage && imageOnRail
    ? clamp(Math.round(100 - screenDistance * 22), 0, 100)
    : 0;
  const screenAligned = focusQuality >= 88;
  const screenCanProject = ready && lightOn && lensAligned && realImage && imageOnRail;

  let imageDescription = "Görüntü oluşumu bekleniyor";
  let situation = "Düzeneği kur";
  if (ready) {
    if (lensType === "diverging") {
      imageDescription = "Sanal · düz · cisimden küçük";
      situation = "Kalın kenarlı merceğin temel durumu";
    } else if (atInfinity) {
      imageDescription = "Sonlu uzaklıkta görüntü yok";
      situation = "Cisim odak noktasında";
    } else if (objectDistance > 2 * focalLength + 0.25) {
      imageDescription = "Gerçek · ters · cisimden küçük";
      situation = "Cisim 2F'nin dışında";
    } else if (Math.abs(objectDistance - 2 * focalLength) <= 0.25) {
      imageDescription = "Gerçek · ters · cisimle aynı boy";
      situation = "Cisim 2F noktasında";
    } else if (objectDistance > focalLength + 0.25) {
      imageDescription = "Gerçek · ters · cisimden büyük";
      situation = "Cisim F ile 2F arasında";
    } else {
      imageDescription = "Sanal · düz · cisimden büyük";
      situation = "Cisim mercek ile F arasında";
    }
  }

  const imageKind = atInfinity ? "Sonlu görüntü yok" : realImage ? "Gerçek" : "Sanal";
  const imageOrientation = atInfinity ? "—" : magnification < 0 ? "Ters" : "Düz";
  const imageSize = atInfinity
    ? "—"
    : Math.abs(magnification) > 1.05
      ? "Büyük"
      : Math.abs(magnification) < 0.95
        ? "Küçük"
        : "Aynı boy";
  const screenMoveDirection = !realImage || !imageOnRail
    ? "Ekranla yakalanamaz"
    : screenAligned
      ? "Odak düzlemi bulundu"
      : screenX < imageX
        ? `Ekranı sağa ${(imageX - screenX).toFixed(1)} cm taşı`
        : `Ekranı sola ${(screenX - imageX).toFixed(1)} cm taşı`;

  let screenMessage = "Düzenek tamamlanınca ekranı rayda hareket ettir.";
  if (ready && !lightOn) screenMessage = "Işığı aç ve ekranı görüntü konumuna taşı.";
  if (ready && !lensAligned) screenMessage = "Mercek hücresini 0° işaretine getir; ışık yalnız hizalı düzende açılır.";
  if (ready && lightOn && atInfinity) screenMessage = "Işınlar paralel çıkıyor; görüntü bu ray üzerinde yakalanamaz.";
  if (ready && lightOn && !realImage) screenMessage = "Sanal görüntü ekrana düşmez; sağdan merceğe bakıldığında görülür.";
  if (ready && lightOn && realImage && !imageOnRail) screenMessage = "Gerçek görüntü rayın ölçüm alanının dışında oluşuyor.";
  if (ready && lightOn && realImage && imageOnRail && !screenAligned) screenMessage = `${screenMoveDirection}; hedef ${imageX.toFixed(1)} cm.`;
  if (screenAligned) screenMessage = "Net gerçek görüntü ekranda oluştu.";

  const toPercent = (position: number) => 10 + position * 0.8;
  const focusPositions = [lensX - 2 * focalLength, lensX - focalLength, lensX + focalLength, lensX + 2 * focalLength]
    .filter((position) => position >= 0 && position <= 100);
  const screenImageHeight = clamp(imageHeight * 9, 10, 78);
  const screenBlur = screenCanProject ? clamp(screenDistance * 1.25, 0, 8) : 0;
  const screenImageOpacity = screenCanProject ? clamp(1 - screenDistance * 0.07, .22, 1) : 0;

  const placeEquipment = (kind: EquipmentKind) => {
    if (kind !== nextEquipment || placed.includes(kind)) return;
    setPlaced((items) => [...items, kind]);
  };

  const onEquipmentDragStart = (event: ReactDragEvent<HTMLButtonElement>, kind: EquipmentKind) => {
    event.dataTransfer.setData(MIME, kind);
    event.dataTransfer.effectAllowed = "move";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    placeEquipment(event.dataTransfer.getData(MIME) as EquipmentKind);
  };

  const moveFromPointer = useCallback((clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    const dragging = dragRef.current;
    if (!rect || !dragging) return;
    const rawPosition = clamp(((clientX - rect.left - rect.width * 0.1) / (rect.width * 0.8)) * 100, 0, 100);
    if (dragging === "object") setObjectX(clamp(Math.round(rawPosition), 5, lensX - 5));
    if (dragging === "lens") setLensX(clamp(Math.round(rawPosition), objectX + 5, screenX - 5));
    if (dragging === "screen") setScreenX(clamp(Math.round(rawPosition * 2) / 2, lensX + 5, 95));
  }, [lensX, objectX, screenX]);

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

  const changeLens = (type: LensType) => {
    setLensType(type);
    setLensAngle(0);
    setLightOn(false);
    setReadings([]);
  };

  const toggleRay = (kind: RayKind) => setRays((current) => ({ ...current, [kind]: !current[kind] }));

  const recordReading = () => {
    if (!ready || !lightOn) return;
    const imageDistanceLabel = atInfinity ? "Sonsuz" : `${tidy(imageDistance, 2)} cm`;
    const next: Reading = {
      id: `${lensType}-${objectX}-${lensX}-${focalLength}`,
      lens: lensType === "converging" ? "İnce kenarlı" : "Kalın kenarlı",
      objectDistance: tidy(objectDistance, 1),
      focalLength,
      imageDistance: imageDistanceLabel,
      magnification: atInfinity ? "—" : `${tidy(Math.abs(magnification), 2)}×`,
      result: imageDescription,
    };
    setReadings((items) => [...items.filter(({ id }) => id !== next.id), next].slice(-10));
  };

  const resetLab = () => {
    setPlaced([]);
    setLensType("converging");
    setObjectX(20);
    setLensX(50);
    setScreenX(65);
    setFocalLength(10);
    setObjectHeight(4);
    setLensAngle(0);
    setLightOn(false);
    setRays({ parallel: true, center: true, focus: true });
    setReadings([]);
  };

  return (
    <section className="optics-lens-lab" aria-labelledby="lens-lab-title">
      <div className="oll-heading">
        <div>
          <span>OPTİK DENEY SETİ · MERCEKLER</span>
          <h1 id="lens-lab-title">Merceği değiştir, görüntüyü ray üzerinde bul.</h1>
          <p>
            Gerçek bir optik ray düzeni kur. Cismi, merceği ve ekranı elle taşı; ince ve kalın kenarlı
            merceklerde özel ışınları, odak noktalarını ve görüntü özelliklerini aynı deneyde karşılaştır.
          </p>
        </div>
        <aside><small>TYMM · LİSE OPTİK</small><b>Kur · gözle · ölç · açıkla</b><span>İdeal ışın modeli ve kesin ölçümler</span></aside>
      </div>

      <div className="oll-inquiry-strip">
        <div><small>ARAŞTIRMA</small><b>Cisim konumu görüntüyü nasıl değiştirir?</b></div>
        <div><small>DEĞİŞKENLER</small><b>Mercek türü · odak · cisim · ekran</b></div>
        <div><small>KANIT</small><b>Ekrandaki görüntü · özel ışınlar · ölçüm</b></div>
      </div>

      <div className="oll-workspace">
        <aside className="oll-equipment-panel">
          <div className="oll-section-heading"><span>1 · DÜZENEĞİ KUR</span><h2>Malzeme tepsisi</h2><p>Sıradaki parçayı tutup ray masasına bırak. Dokunarak da ekleyebilirsin.</p></div>
          <div className="oll-equipment-list">
            {EQUIPMENT.map((item, index) => {
              const isPlaced = placed.includes(item.kind);
              const isNext = item.kind === nextEquipment;
              return (
                <button
                  type="button"
                  key={item.kind}
                  className={`${isPlaced ? "placed" : ""} ${isNext ? "next" : ""}`}
                  draggable={!isPlaced && isNext}
                  disabled={!isPlaced && !isNext}
                  onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                  onClick={() => placeEquipment(item.kind)}
                >
                  <EquipmentIcon kind={item.kind} />
                  <span><small>{String(index + 1).padStart(2, "0")}</small><b>{item.name}</b><em>{isPlaced ? "Ray masasında" : item.detail}</em></span>
                  <strong>{isPlaced ? "✓" : isNext ? "Tut" : "Kilitli"}</strong>
                </button>
              );
            })}
          </div>
          <button type="button" className="oll-reset" onClick={resetLab}>Düzeneği sıfırla</button>
        </aside>

        <div className="oll-stage-column">
          <div className="oll-stage-toolbar">
            <div><small>2 · OPTİK RAY</small><b>{ready ? situation : `Sıradaki: ${EQUIPMENT[placed.length]?.name ?? "Tamamlandı"}`}</b></div>
            <span className={lightOn ? "live" : ""}><i /> {lightOn ? "Işık açık" : "Işık kapalı"}</span>
          </div>
          <div
            ref={stageRef}
            className={`oll-stage ${ready ? "ready" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onStageDrop}
          >
            <div className="oll-lab-wall"><span>FİZİK ATÖLYESİ · MERCEK DENEY MASASI</span></div>
            <img className="oll-bench-photo" src={LAB_BENCH_ASSET} alt="" draggable="false" />
            <div className="oll-lab-fixtures" aria-hidden="true"><i /><i /><i /></div>
            <div className="oll-bench" />
            <RayDiagram
              objectX={objectX}
              lensX={lensX}
              screenX={screenX}
              focalLength={focalLength}
              objectHeight={objectHeight}
              imageX={imageX}
              magnification={magnification}
              lensType={lensType}
              lightOn={lightOn}
              ready={ready}
              rays={rays}
              finiteImage={finiteImage}
            />
            {placed.includes("rail") && (
              <div className="oll-rail">
                <img src={OPTICAL_RAIL_ASSET} alt="Gerçek cetvelli optik ray" draggable="false" />
                <div>{[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => <span key={value}>{value}</span>)}</div>
                <i className="first" /><i className="second" /><i className="third" /><b className="left" /><b className="right" />
              </div>
            )}
            {placed.includes("ray-box") && !placed.includes("object") && (
              <div className="oll-ray-box" style={{ "--object-left": `${toPercent(objectX)}%` } as CSSProperties}>
                <img src={ILLUMINATED_OBJECT_ASSET} alt="Işıklı ok cismi kutusu" draggable="false" />
                <span>Ok maskesini yerleştir</span>
              </div>
            )}
            {placed.includes("object") && (
              <button
                type="button"
                className={`oll-object ${lightOn ? "on" : ""}`}
                style={{ "--object-left": `${toPercent(objectX)}%`, "--object-height": `${objectHeight * 9}px` } as CSSProperties}
                onPointerDown={(event) => beginMove(event, "object")}
                aria-label={`Cisim ${objectX} santimetrede; ray üzerinde sürükle`}
              >
                <img src={ILLUMINATED_OBJECT_ASSET} alt="Yukarı yönlü ışıklı ok cismi" draggable="false" />
                <span className="oll-object-emitter"><i /></span>
                <b>CİSİM · {objectX} cm</b>
              </button>
            )}
            {placed.includes("lens-holder") && placed.includes("lens-set") && (
              <button
                type="button"
                className={`oll-lens-assembly ${lensType} ${lensAligned ? "aligned" : "misaligned"}`}
                style={{
                  "--lens-left": `${toPercent(lensX)}%`,
                  "--lens-yaw": `${lensAngle}deg`,
                  "--lens-yaw-scale": Math.max(.48, 1 - Math.abs(lensAngle) / 38),
                  "--parallel-hit": `${57 - objectHeight * 9}px`,
                } as CSSProperties}
                onPointerDown={(event) => beginMove(event, "lens")}
                aria-label={`${lensType === "converging" ? "İnce" : "Kalın"} kenarlı mercek ${lensX} santimetrede; ray üzerinde sürükle`}
              >
                <img className="oll-lens-holder-photo" src={LENS_HOLDER_ASSET} alt="Gerçek optik ray mercek taşıyıcısı" draggable="false" />
                <span className="oll-lens-frame">
                  <img
                    className="oll-lens-cell-photo"
                    src={lensType === "converging" ? CONVEX_LENS_ASSET : CONCAVE_LENS_ASSET}
                    alt={lensType === "converging" ? "İnce kenarlı yakınsak mercek" : "Kalın kenarlı ıraksak mercek"}
                    draggable="false"
                  />
                  <i className="oll-lens-glass"><span /></i><i className="oll-lens-lock" />
                </span>
                {lightOn && rays.parallel && <span className="oll-lens-contact parallel"><i />GİRİŞ</span>}
                {lightOn && rays.center && <span className="oll-lens-contact center"><i />O</span>}
                <span className="oll-lens-post" /><span className="oll-lens-carriage" />
                <b>{lensType === "converging" ? "İNCE KENARLI" : "KALIN KENARLI"} · {lensX} cm</b>
              </button>
            )}
            {placed.includes("screen") && (
              <button
                type="button"
                className={`oll-screen ${screenAligned ? "sharp" : ""} ${screenCanProject ? "projecting" : ""} ${screenX > 76 ? "info-left" : ""}`}
                style={{ "--screen-left": `${toPercent(screenX)}%`, "--focus-quality": `${focusQuality}%` } as CSSProperties}
                onPointerDown={(event) => beginMove(event, "screen")}
                aria-label={`Ekran ${screenX} santimetrede; ray üzerinde sürükle`}
              >
                <img className="oll-screen-photo" src={SCREEN_ASSET} alt="Optik ray üzerindeki beyaz görüntü ekranı" draggable="false" />
                <span className="oll-screen-face">
                  <span className="oll-screen-surface-label">EKRAN</span>
                  {screenCanProject && <i className={`oll-screen-image ${screenAligned ? "focused" : "defocused"}`} style={{ "--image-height": `${screenImageHeight}px`, "--image-blur": `${screenBlur}px`, "--image-opacity": screenImageOpacity } as CSSProperties} />}
                  {lightOn && !screenCanProject && <i className="oll-no-projection">×</i>}
                </span>
                <span className="oll-screen-info">
                  <small>EKRAN ANALİZİ</small>
                  <strong>{lightOn ? imageKind : "Işık bekleniyor"}</strong>
                  <em>{lightOn ? `${imageOrientation} · ${imageSize}` : "Tür · yön · boyut"}</em>
                  <span className="oll-focus-meter"><i /></span>
                  <b>{screenCanProject ? `Netlik ${focusQuality}%` : lightOn ? "Ekrana düşmez" : "—"}</b>
                </span>
                <span className="oll-screen-post" /><span className="oll-screen-carriage" />
                <span className="oll-screen-move"><i />{lightOn ? screenMoveDirection : "Ekranı rayda sürükle"}</span>
                <b>EKRAN · {screenX.toFixed(1)} cm</b>
              </button>
            )}
            {ready && focusPositions.map((position) => {
              const distance = Math.abs(position - lensX);
              return <span key={position} className="oll-focus-marker" style={{ "--focus-left": `${toPercent(position)}%` } as CSSProperties}><i />{Math.abs(distance - focalLength) < 0.2 ? "F" : "2F"}</span>;
            })}
            {ready && <div className="oll-eye"><i /><span>GÖZLE DOĞRUDAN BAKIŞ</span></div>}
            {!ready && (
              <div className="oll-drop-guide"><EquipmentIcon kind={nextEquipment ?? "rail"} /><b>{EQUIPMENT.find(({ kind }) => kind === nextEquipment)?.name ?? "Düzenek hazır"}</b><span>Bu parçayı deney masasına bırak</span></div>
            )}
            <div className="oll-stage-status"><b>{screenAligned ? "NET GÖRÜNTÜ" : lightOn ? "GÖZLEM" : "HAZIRLIK"}</b><span>{screenMessage}</span></div>
          </div>

          <div className={`oll-controls ${ready ? "enabled" : ""}`}>
            <div className="oll-control-heading"><div><span>3 · DENEYİ YÖNET</span><h2>Aynı rayda iki mercek</h2></div><p>Taşıyıcıları sahnede sürükleyebilir veya konum cetvellerini kullanabilirsin.</p></div>
            <div className="oll-lens-selector">
              <button type="button" className={lensType === "converging" ? "active" : ""} onClick={() => changeLens("converging")} disabled={!ready}><img src={CONVEX_LENS_ASSET} alt="" draggable="false" /><span><b>İnce kenarlı mercek</b><small>Yakınsak · gerçek veya sanal görüntü</small></span></button>
              <button type="button" className={lensType === "diverging" ? "active" : ""} onClick={() => changeLens("diverging")} disabled={!ready}><img src={CONCAVE_LENS_ASSET} alt="" draggable="false" /><span><b>Kalın kenarlı mercek</b><small>Iraksak · sanal, düz ve küçük görüntü</small></span></button>
            </div>
            <label className={`oll-lens-alignment ${lensAligned ? "aligned" : ""}`}>
              <span><small>MERCEK YÖNÜ</small><b>{lensAngle}°</b><em>{lensAligned ? "Asal eksene dik ve ölçüme hazır" : "Mercek hücresini 0° konumuna getir"}</em></span>
              <input type="range" min="-20" max="20" step="5" value={lensAngle} onChange={(event) => { setLensAngle(Number(event.target.value)); setLightOn(false); }} disabled={!ready} aria-label="Mercek yönü" />
              <button type="button" onClick={() => setLensAngle(0)} disabled={!ready || lensAligned}>0° hizala</button>
            </label>
            <div className="oll-control-grid">
              <label><span>Odak uzaklığı <b>{focalLength} cm</b></span><input type="range" min="8" max="16" step="2" value={focalLength} onChange={(event) => setFocalLength(Number(event.target.value))} disabled={!ready} /><small>F ve 2F işaretleri rayda otomatik yer değiştirir.</small></label>
              <label><span>Cisim yüksekliği <b>{objectHeight} cm</b></span><input type="range" min="2" max="6" step="1" value={objectHeight} onChange={(event) => setObjectHeight(Number(event.target.value))} disabled={!ready} /><small>Görüntü büyüklüğünü karşılaştırmak için değiştir.</small></label>
              <div className="oll-ray-controls"><span>Özel ışınlar</span><button type="button" className={rays.parallel ? "active orange" : ""} onClick={() => toggleRay("parallel")} disabled={!ready}>Paralel → F</button><button type="button" className={rays.center ? "active teal" : ""} onClick={() => toggleRay("center")} disabled={!ready}>Optik merkez</button><button type="button" className={rays.focus ? "active blue" : ""} onClick={() => toggleRay("focus")} disabled={!ready}>F → paralel</button></div>
              <div className="oll-live-reading">
                <span>CANLI SONUÇ</span><b>{imageDescription}</b><div><p><small>Cisim uzaklığı</small><strong>{objectDistance.toFixed(1)} cm</strong></p><p><small>Görüntü uzaklığı</small><strong>{atInfinity ? "Sonsuz" : `${imageDistance.toFixed(1)} cm`}</strong></p><p><small>Büyütme</small><strong>{atInfinity ? "—" : `${Math.abs(magnification).toFixed(2)}×`}</strong></p><p><small>Ekran netliği</small><strong>{screenCanProject ? `%${focusQuality}` : "Düşmez"}</strong></p></div>
                <div><button type="button" className={lightOn ? "stop" : "start"} onClick={() => setLightOn((value) => !value)} disabled={!ready || !lensAligned}>{lightOn ? "Işığı kapat" : lensAligned ? "Işığı aç" : "Önce 0° hizala"}</button><button type="button" onClick={recordReading} disabled={!lightOn}>Ölçümü kaydet</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="oll-evidence">
        <div className="oll-evidence-heading"><div><span>4 · ÖZELLİKLERİ KARŞILAŞTIR</span><h2>Mercek değiştiğinde ne değişiyor?</h2></div><p>Mavi kesikli ok sanal, düz mavi ok gerçek görüntüyü gösterir. Sanal görüntü yalnızca gözle doğrudan bakıldığında görülür.</p></div>
        <div className="oll-property-grid">
          <article className={lensType === "converging" ? "active" : ""}><img src={CONVEX_LENS_ASSET} alt="İnce kenarlı mercek" draggable="false" /><div><span>İNCE KENARLI · YAKINSAK</span><b>Beş temel cisim konumu</b><p>2F dışı: küçük · 2F: aynı boy · F–2F: büyük · F: sonsuz · F içi: sanal ve büyük.</p></div></article>
          <article className={lensType === "diverging" ? "active" : ""}><img src={CONCAVE_LENS_ASSET} alt="Kalın kenarlı mercek" draggable="false" /><div><span>KALIN KENARLI · IRAKSAK</span><b>Her cisim konumunda aynı nitelik</b><p>Görüntü mercek ile F arasında; sanal, düz ve cisimden küçüktür. Ekrana düşürülemez.</p></div></article>
          <article><i className="real-life" /><div><span>GÜNLÜK YAŞAM</span><b>Mercek seçimi amaca bağlıdır</b><p>İnce kenarlı: büyüteç, kamera, projektör. Kalın kenarlı: miyop gözlük ve kapı dürbünü.</p></div></article>
        </div>
        <div className="oll-data-card">
          <div><div><span>İDEAL ÖLÇÜM TABLOSU</span><b>Kaydettiğin mercek durumları</b></div><button type="button" onClick={() => setReadings([])} disabled={readings.length === 0}>Kayıtları temizle</button></div>
          <div className="oll-table-wrap"><table><thead><tr><th>Mercek</th><th>Cisim uzaklığı</th><th>Odak</th><th>Görüntü uzaklığı</th><th>Büyütme</th><th>Görüntü özelliği</th></tr></thead><tbody>{readings.length === 0 ? <tr><td colSpan={6}>Işığı aç, bir mercek durumu oluştur ve ölçümü kaydet.</td></tr> : readings.map((row) => <tr key={row.id}><td>{row.lens}</td><td>{row.objectDistance} cm</td><td>{row.focalLength} cm</td><td>{row.imageDistance}</td><td>{row.magnification}</td><td>{row.result}</td></tr>)}</tbody></table></div>
        </div>
      </div>

      <div className="oll-report">
        <div><span>5 · TYMM KISA DENEY RAPORU</span><h2>Gözlemini kanıtla açıkla.</h2><p>Yanıtlarını ray üzerindeki konumlara, ekrandaki görüntüye ve kayıtlarına dayandır.</p></div>
        <div className="oll-report-grid">
          <label><span>1</span><b>İnce kenarlı mercekte cismi 2F dışından F içine taşırken görüntü nasıl değişti?</b><textarea value={report.convex} onChange={(event) => setReport({ ...report, convex: event.target.value })} placeholder="En az üç cisim konumunu karşılaştır…" /></label>
          <label><span>2</span><b>Kalın kenarlı mercekte cisim konumu değişse de değişmeyen özellikler nelerdi?</b><textarea value={report.concave} onChange={(event) => setReport({ ...report, concave: event.target.value })} placeholder="Yön, büyüklük ve görüntü türünü yaz…" /></label>
          <label><span>3</span><b>Hangi görüntüler ekranda yakalandı, hangileri yalnızca gözle görüldü?</b><textarea value={report.screen} onChange={(event) => setReport({ ...report, screen: event.target.value })} placeholder="Gerçek ve sanal görüntüyü kanıtınla ayır…" /></label>
          <label><span>4</span><b>Günlük yaşamdan bir araç seç; neden o mercek türünü kullandığını açıkla.</b><textarea value={report.life} onChange={(event) => setReport({ ...report, life: event.target.value })} placeholder="Büyüteç, kamera, gözlük veya kapı dürbünü…" /></label>
        </div>
        <div className="oll-ideal-note"><b>İDEAL SİSTEM</b><span>Mercekler ince mercek modeliyle, ışınlar tek renkli ve ölçümler tam değerlerle gösterilir.</span></div>
      </div>
    </section>
  );
}
