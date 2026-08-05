"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type ExperimentMode = "reflection" | "image";
type ImageReading = {
  id: number;
  objectDistance: number;
  imageDistance: number;
  objectHeight: number;
  imageHeight: number;
};

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
  context.lineWidth = dashed ? 2 : 7;
  context.globalAlpha = dashed ? 0.62 : 0.14;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.lineWidth = dashed ? 1.5 : 2.4;
  context.globalAlpha = dashed ? 0.82 : 1;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.restore();
}

function ReflectionCanvas({
  angle,
  lampOn,
  onAngleChange,
}: {
  angle: number;
  lampOn: boolean;
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

      context.save();
      context.strokeStyle = "rgba(216, 234, 230, 0.24)";
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
        const innerX = centerX + Math.sin(radian) * (radius - length);
        const innerY = centerY - Math.cos(radian) * (radius - length);
        context.strokeStyle =
          tick % 10 === 0
            ? "rgba(232, 242, 239, 0.68)"
            : "rgba(232, 242, 239, 0.34)";
        context.beginPath();
        context.moveTo(innerX, innerY);
        context.lineTo(outerX, outerY);
        context.stroke();
        if (tick % 20 === 0) {
          context.fillStyle = "rgba(232, 242, 239, 0.72)";
          context.font = "700 10px Arial";
          context.textAlign = "center";
          context.fillText(
            String(Math.abs(tick)),
            centerX + Math.sin(radian) * (radius - 27),
            centerY - Math.cos(radian) * (radius - 27) + 4,
          );
        }
      }

      context.setLineDash([7, 7]);
      context.strokeStyle = "rgba(255,255,255,0.68)";
      context.beginPath();
      context.moveTo(centerX, centerY + 15);
      context.lineTo(centerX, centerY - radius - 25);
      context.stroke();
      context.setLineDash([]);

      const angleRad = (angle * Math.PI) / 180;
      const sourceX = centerX - Math.sin(angleRad) * radius;
      const sourceY = centerY - Math.cos(angleRad) * radius;
      const reflectedX = centerX + Math.sin(angleRad) * (radius + 23);
      const reflectedY = centerY - Math.cos(angleRad) * (radius + 23);

      if (lampOn) {
        drawGlowLine(
          context,
          sourceX + 27 * Math.cos(angleRad),
          sourceY + 27 * Math.sin(angleRad),
          centerX,
          centerY,
          "#ff735d",
        );
        drawGlowLine(
          context,
          centerX,
          centerY,
          reflectedX,
          reflectedY,
          "#ffb23f",
        );
        context.fillStyle = "#fff7d7";
        context.shadowColor = "#ff765f";
        context.shadowBlur = 18;
        context.beginPath();
        context.arc(centerX, centerY, 4.5, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }

      context.save();
      context.translate(sourceX, sourceY);
      context.rotate(angleRad);
      const sourceGradient = context.createLinearGradient(-47, 0, 42, 0);
      sourceGradient.addColorStop(0, "#0d1820");
      sourceGradient.addColorStop(0.55, "#293c43");
      sourceGradient.addColorStop(1, "#0c171e");
      context.fillStyle = sourceGradient;
      context.strokeStyle = "#587178";
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-50, -18, 78, 36, 9);
      context.fill();
      context.stroke();
      context.fillStyle = lampOn ? "#ff6958" : "#5f6c70";
      context.beginPath();
      context.arc(29, 0, 8, 0, Math.PI * 2);
      context.fill();
      context.restore();

      const mirrorGradient = context.createLinearGradient(
        centerX - 106,
        0,
        centerX + 106,
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

      context.fillStyle = "rgba(238, 247, 244, 0.78)";
      context.font = "800 11px Arial";
      context.textAlign = "center";
      context.fillText("NORMAL", centerX, centerY - radius - 35);
      context.fillStyle = "#ff9684";
      context.fillText(`GELEN IŞIN · ${angle}°`, centerX - 92, centerY - 73);
      context.fillStyle = "#ffd17b";
      context.fillText(`YANSIYAN IŞIN · ${angle}°`, centerX + 102, centerY - 73);
      context.restore();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [angle, lampOn]);

  const updateAngle = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !draggingRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width * 0.5;
    const centerY = 440 * 0.73;
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const nextAngle = Math.round(
      (Math.atan2(Math.max(0, centerX - localX), Math.max(10, centerY - localY)) *
        180) /
        Math.PI,
    );
    onAngleChange(clamp(nextAngle, 10, 75));
  };

  return (
    <canvas
      ref={canvasRef}
      className="pm-reflection-canvas"
      height={440}
      aria-label={`Işın kutusu aynaya ${angle} dereceyle ışın gönderiyor`}
      onPointerDown={(event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateAngle(event);
      }}
      onPointerMove={updateAngle}
      onPointerUp={(event) => {
        draggingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    />
  );
}

function ImageRayCanvas({
  objectDistance,
  objectHeight,
  showConstruction,
}: {
  objectDistance: number;
  objectHeight: number;
  showConstruction: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 360);
      const height = 420;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const mirrorX = width * 0.52;
      const baseY = height * 0.76;
      const offset = width * objectDistance * 0.0075;
      const objectX = mirrorX - offset;
      const imageX = mirrorX + offset;
      const heightPixels = 72 + objectHeight * 3.4;
      const topY = baseY - heightPixels;

      context.strokeStyle = "rgba(226, 239, 235, 0.22)";
      context.lineWidth = 1;
      for (let x = 28; x < width - 28; x += 34) {
        context.beginPath();
        context.moveTo(x, baseY + 35);
        context.lineTo(x, baseY + 47);
        context.stroke();
      }

      if (showConstruction) {
        const mirrorPoints = [topY + 20, topY + heightPixels * 0.62];
        mirrorPoints.forEach((mirrorY, index) => {
          const color = index === 0 ? "#ff765f" : "#ffbd4c";
          drawGlowLine(context, objectX, topY, mirrorX, mirrorY, color);
          const dx = mirrorX - imageX;
          const dy = mirrorY - topY;
          const reflectedLength = Math.max(width * 0.4, 250);
          const magnitude = Math.hypot(dx, dy);
          drawGlowLine(
            context,
            mirrorX,
            mirrorY,
            mirrorX + (dx / magnitude) * reflectedLength,
            mirrorY + (dy / magnitude) * reflectedLength,
            color,
          );
          drawGlowLine(
            context,
            mirrorX,
            mirrorY,
            imageX,
            topY,
            color,
            true,
          );
        });
      }

      context.fillStyle = "rgba(215, 231, 227, 0.68)";
      context.font = "800 11px Arial";
      context.textAlign = "center";
      context.fillText(`${objectDistance} cm`, (objectX + mirrorX) / 2, baseY + 61);
      context.fillText(`${objectDistance} cm`, (imageX + mirrorX) / 2, baseY + 61);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [objectDistance, objectHeight, showConstruction]);

  return (
    <canvas
      ref={canvasRef}
      className="pm-image-ray-canvas"
      height={420}
      aria-label="Düzlem aynada görüntü oluşumu ışın çizimi"
    />
  );
}

export default function PlaneMirrorLab() {
  const nextImageReadingId = useRef(0);
  const [mode, setMode] = useState<ExperimentMode>("reflection");
  const [lampOn, setLampOn] = useState(true);
  const [angle, setAngle] = useState(25);
  const [angleReadings, setAngleReadings] = useState<number[]>([]);
  const [showReflectionResult, setShowReflectionResult] = useState(false);
  const [objectDistance, setObjectDistance] = useState(20);
  const [objectHeight, setObjectHeight] = useState(12);
  const [screenDistance, setScreenDistance] = useState(12);
  const [showConstruction, setShowConstruction] = useState(true);
  const [imageReadings, setImageReadings] = useState<ImageReading[]>([]);
  const [showImageResult, setShowImageResult] = useState(false);

  const reflectionReady = angleReadings.length >= 3;
  const imageReady = imageReadings.length >= 2;
  const allEvidenceReady = reflectionReady && imageReady;
  const objectOffset = objectDistance * 0.75;
  const screenOffset = screenDistance * 0.75;
  const markerHeight = 72 + objectHeight * 3.4;

  const recordAngle = () => {
    setAngleReadings((current) =>
      current.includes(angle) ? current : [...current, angle],
    );
  };

  const recordImage = () => {
    setImageReadings((current) => [
      ...current,
      {
        id: nextImageReadingId.current++,
        objectDistance,
        imageDistance: objectDistance,
        objectHeight,
        imageHeight: objectHeight,
      },
    ]);
  };

  return (
    <section className="pm-lab" id="duzlem-ayna-deneyi">
      <div className="pm-hero">
        <div>
          <span>AYNALAR · DÜZLEM AYNA · İDEAL DENEY</span>
          <h1>Yansımayı ölç, görüntünün yerini deneyle bul.</h1>
          <p>
            Işın kutusunu açı tablasında hareket ettir; ardından cismi ve ekranı
            optik cetvel üzerinde taşıyarak düzlem aynanın bütün görüntü
            özelliklerini kanıtla.
          </p>
        </div>
        <aside>
          <small>İKİ DÜZENEK</small>
          <strong>Yansıma + görüntü</strong>
          <span>Hava ve yüzey koşulları idealdir.</span>
        </aside>
      </div>

      <div className="pm-equipment-strip" aria-label="Deney malzemeleri">
        <span><i className="pm-equipment-raybox" /><b>Işın kutusu</b></span>
        <span><i className="pm-equipment-mirror" /><b>Düzlem ayna</b></span>
        <span><i className="pm-equipment-disc" /><b>Açı tablası</b></span>
        <span><i className="pm-equipment-object" /><b>Asimetrik cisim</b></span>
        <span><i className="pm-equipment-ruler" /><b>Optik cetvel</b></span>
        <span><i className="pm-equipment-screen" /><b>Beyaz ekran</b></span>
      </div>

      <div className="pm-mode-switch" aria-label="Düzlem ayna deneyleri">
        <button
          type="button"
          className={mode === "reflection" ? "active" : ""}
          onClick={() => setMode("reflection")}
        >
          <small>DENEY 1</small>
          <b>Yansıma kanunları</b>
          <span>Işın kutusunu sürükle, açıları ölç.</span>
        </button>
        <button
          type="button"
          className={mode === "image" ? "active" : ""}
          onClick={() => setMode("image")}
        >
          <small>DENEY 2</small>
          <b>Görüntü oluşumu</b>
          <span>Cismi ve ekranı taşı, görüntüyü incele.</span>
        </button>
      </div>

      {mode === "reflection" ? (
        <div className="pm-experiment-panel">
          <div className="pm-panel-heading">
            <div>
              <span>1 · AÇI TABLASI</span>
              <h2>Işın kutusunu tablanın üzerinde sürükle.</h2>
            </div>
            <strong className={lampOn ? "on" : ""}>
              <i /> {lampOn ? "Işın açık" : "Işın kapalı"}
            </strong>
          </div>

          <div className="pm-reflection-layout">
            <div className="pm-reflection-stage">
              <ReflectionCanvas
                angle={angle}
                lampOn={lampOn}
                onAngleChange={setAngle}
              />
              <span className="pm-drag-hint">Işın kutusunu tut ve açı boyunca sürükle</span>
            </div>

            <aside className="pm-control-console">
              <div className="pm-console-screen">
                <small>AÇI ÖLÇER</small>
                <b>{angle}°</b>
                <span>Normal doğrultusuna göre</span>
              </div>
              <label>
                <span>Işın kutusunun konumu</span>
                <input
                  type="range"
                  min="10"
                  max="75"
                  step="5"
                  value={angle}
                  onChange={(event) => setAngle(Number(event.target.value))}
                />
              </label>
              <button
                className="pm-power-button"
                type="button"
                onClick={() => setLampOn((current) => !current)}
              >
                <i /> Işın kutusunu {lampOn ? "kapat" : "aç"}
              </button>
              <div className="pm-live-measurement">
                <span><small>Gelme açısı</small><b>{lampOn ? `${angle}°` : "—"}</b></span>
                <span><small>Yansıma açısı</small><b>{lampOn ? `${angle}°` : "—"}</b></span>
              </div>
              <button
                className="pm-record-button"
                type="button"
                disabled={!lampOn || angleReadings.includes(angle)}
                onClick={recordAngle}
              >
                Ölçümü kaydet
              </button>
            </aside>
          </div>

          <div className="pm-data-card">
            <div>
              <span>ÖLÇÜM TABLOSU</span>
              <strong>{angleReadings.length}/3 gerekli ölçüm</strong>
            </div>
            <table>
              <thead><tr><th>Deneme</th><th>Gelme açısı</th><th>Yansıma açısı</th><th>Karşılaştırma</th></tr></thead>
              <tbody>
                {angleReadings.length ? angleReadings.map((reading, index) => (
                  <tr key={reading}>
                    <td>{index + 1}</td><td>{reading}°</td><td>{reading}°</td><td>Eşit</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4}>Farklı açılarda ilk ölçümünü kaydet.</td></tr>
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
                <span><b>i = r</b><small>Gelme ve yansıma açıları eşittir.</small></span>
                <span><b>Aynı düzlem</b><small>Gelen ışın, normal ve yansıyan ışın aynı düzlemdedir.</small></span>
                <span><b>Normale göre</b><small>Her iki açı da ayna yüzeyine değil normale göre ölçülür.</small></span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="pm-experiment-panel">
          <div className="pm-panel-heading">
            <div>
              <span>2 · OPTİK CETVEL</span>
              <h2>Cismin uzaklığını değiştir, ekranla görüntüyü ara.</h2>
            </div>
            <strong className="on"><i /> Işın çizimi ideal</strong>
          </div>

          <div className="pm-image-stage-wrap">
            <div className="pm-image-stage">
              <ImageRayCanvas
                objectDistance={objectDistance}
                objectHeight={objectHeight}
                showConstruction={showConstruction}
              />
              <div className="pm-mirror-device" aria-hidden="true"><i /><b /></div>
              <div
                className="pm-object-marker"
                style={{
                  left: `calc(52% - ${objectOffset}%)`,
                  height: markerHeight,
                }}
                aria-hidden="true"
              ><i /><b /></div>
              <div
                className="pm-object-marker pm-virtual-image"
                style={{
                  left: `calc(52% + ${objectOffset}%)`,
                  height: markerHeight,
                }}
                aria-hidden="true"
              ><i /><b /></div>
              <div
                className="pm-screen-device"
                style={{ left: `calc(52% - ${screenOffset}%)` }}
                aria-label="Hareketli beyaz ekran"
              ><i /><b>EKRAN</b></div>
              <span className="pm-real-side">CİSİMİN BULUNDUĞU BÖLGE</span>
              <span className="pm-virtual-side">AYNANIN ARKASI · SANAL BÖLGE</span>
            </div>

            <div className="pm-image-controls">
              <label>
                <span>Cismin aynaya uzaklığı <b>{objectDistance} cm</b></span>
                <input type="range" min="10" max="40" step="5" value={objectDistance} onChange={(event) => setObjectDistance(Number(event.target.value))} />
              </label>
              <label>
                <span>Cismin boyu <b>{objectHeight} cm</b></span>
                <input type="range" min="8" max="18" step="2" value={objectHeight} onChange={(event) => setObjectHeight(Number(event.target.value))} />
              </label>
              <label>
                <span>Ekranın aynaya uzaklığı <b>{screenDistance} cm</b></span>
                <input type="range" min="6" max="34" step="2" value={screenDistance} onChange={(event) => setScreenDistance(Number(event.target.value))} />
              </label>
              <button type="button" onClick={() => setShowConstruction((current) => !current)}>
                {showConstruction ? "Işınları gizle" : "Işın çizimini göster"}
              </button>
              <div className="pm-screen-test">
                <i />
                <span><small>Ekran sonucu</small><b>Net görüntü oluşmadı</b><em>Ekranı nereye taşırsan taşı sonuç değişmez.</em></span>
              </div>
              <button className="pm-record-button" type="button" onClick={recordImage}>
                Uzaklık ve boy ölçümünü kaydet
              </button>
            </div>
          </div>

          <div className="pm-data-card">
            <div>
              <span>GÖRÜNTÜ ÖLÇÜMLERİ</span>
              <strong>{imageReadings.length}/2 gerekli ölçüm</strong>
            </div>
            <table>
              <thead><tr><th>Cisim uzaklığı</th><th>Görüntü uzaklığı</th><th>Cisim boyu</th><th>Görüntü boyu</th><th>Ekran</th></tr></thead>
              <tbody>
                {imageReadings.length ? imageReadings.map((reading) => (
                  <tr key={reading.id}>
                    <td>{reading.objectDistance} cm</td><td>{reading.imageDistance} cm</td><td>{reading.objectHeight} cm</td><td>{reading.imageHeight} cm</td><td>Görüntü yok</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5}>Cismi iki farklı konuma getirerek ölçüm kaydet.</td></tr>
                )}
              </tbody>
            </table>
            <button type="button" disabled={!imageReady} onClick={() => setShowImageResult((current) => !current)}>
              {showImageResult ? "Görüntü özelliklerini gizle" : "Görüntü özelliklerini göster"}
            </button>
            {showImageResult && (
              <div className="pm-image-result-grid">
                <span><b>Eşit uzaklık</b><small>Görüntü aynanın arkasında, cismin aynaya uzaklığı kadar uzaktadır.</small></span>
                <span><b>Aynı boy</b><small>Görüntünün boyu cismin boyuna eşittir.</small></span>
                <span><b>Düz görüntü</b><small>Görüntü cisme göre baş aşağı dönmez.</small></span>
                <span><b>Sanal görüntü</b><small>Yansıyan ışınların uzantıları kesişir; görüntü ekrana düşürülemez.</small></span>
                <span><b>Yanal terslik</b><small>Sağ ve sol yönler aynaya göre yer değiştirmiş görünür.</small></span>
              </div>
            )}
          </div>
        </div>
      )}

      <section className="pm-evidence-section">
        <div>
          <span>TOPLU KANIT</span>
          <h2>Düzlem aynanın bütün özelliklerini ölçümlerinle aç.</h2>
          <p>Sonuç kartı için en az üç açı ve iki görüntü ölçümü kaydet.</p>
        </div>
        <div className="pm-evidence-progress">
          <span className={reflectionReady ? "done" : ""}><i>{reflectionReady ? "✓" : angleReadings.length}</i>Yansıma ölçümleri</span>
          <span className={imageReady ? "done" : ""}><i>{imageReady ? "✓" : imageReadings.length}</i>Görüntü ölçümleri</span>
        </div>
        {allEvidenceReady && (
          <article>
            <strong>DENEY SONUCU</strong>
            <p>
              Düzlem aynada gelme ve yansıma açıları eşittir. Görüntü aynanın
              arkasında, cisimle eşit uzaklıkta; cisimle aynı boyda, düz,
              yanal ters ve sanaldır.
            </p>
          </article>
        )}
      </section>

      <section className="pm-report">
        <div><span>TYMM · DENEY RAPORU</span><h2>Ölçümlerini kanıt olarak kullan.</h2></div>
        <div className="pm-report-grid">
          <label><span>Farklı açılarda gelme ve yansıma açılarını karşılaştır.</span><textarea rows={4} /></label>
          <label><span>Normal çizgisinin açı ölçümündeki görevini açıkla.</span><textarea rows={4} /></label>
          <label><span>Cisim uzaklığı değiştiğinde görüntünün yeri nasıl değişti?</span><textarea rows={4} /></label>
          <label><span>Ekran deneyi görüntünün hangi özelliğini kanıtladı?</span><textarea rows={4} /></label>
          <label className="wide"><span>Düzlem aynadaki görüntünün uzaklık, boy, yön ve oluşum özelliklerini ölçümlerine dayanarak özetle.</span><textarea rows={5} /></label>
        </div>
      </section>
    </section>
  );
}
