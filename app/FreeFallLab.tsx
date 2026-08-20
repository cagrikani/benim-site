"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SetupKind = "stand" | "release" | "sensor" | "timer" | "ruler";
type BallKind = "light" | "heavy";
type BallState = "ready" | "falling" | "landed";
type Trial = {
  time: number;
  gravity: number;
};
type Measurements = Record<BallKind, Record<number, Trial[]>>;
type GraphKind = "height-time" | "height-time-squared";
type TrialLogEntry = Trial & {
  id: number;
  ball: BallKind;
  height: number;
  experimentalGravity: number;
};

const HEIGHTS = [25, 50, 75, 100, 125, 150] as const;
const SETUP_ORDER: SetupKind[] = [
  "stand",
  "release",
  "sensor",
  "timer",
  "ruler",
];
const EQUIPMENT: Array<{
  kind: SetupKind;
  name: string;
  shortName: string;
}> = [
  { kind: "stand", name: "Statif ve düşey çubuk", shortName: "Statif" },
  {
    kind: "release",
    name: "Bilye bırakma mekanizması",
    shortName: "Bırakma mekanizması",
  },
  { kind: "sensor", name: "Algılayıcı tabla", shortName: "Algılayıcı tabla" },
  { kind: "timer", name: "Dijital kronometre", shortName: "Kronometre" },
  { kind: "ruler", name: "Yükseklik cetveli", shortName: "Cetvel" },
];
const EQUIPMENT_PHOTOS: Partial<Record<SetupKind, string>> = {
  stand: "./freefall-equipment-stand.webp",
  release: "./freefall-equipment-release.webp",
  sensor: "./freefall-equipment-sensor.webp",
  timer: "./freefall-equipment-timer.webp",
  ruler: "./freefall-equipment-ruler.webp",
};
const BALLS: Record<
  BallKind,
  { name: string; mass: string; colorClass: string }
> = {
  light: { name: "Çelik bilye 1", mass: "20 g", colorClass: "ball-light" },
  heavy: { name: "Çelik bilye 2", mass: "40 g", colorClass: "ball-heavy" },
};
function emptyMeasurements(): Measurements {
  return {
    light: Object.fromEntries(HEIGHTS.map((height) => [height, []])),
    heavy: Object.fromEntries(HEIGHTS.map((height) => [height, []])),
  } as Measurements;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function releaseTopForHeight(height: number) {
  return 71 - height * 0.36;
}

function EquipmentIcon({ kind }: { kind: SetupKind }) {
  const photo = EQUIPMENT_PHOTOS[kind];
  return (
    <span
      className={`freefall-equipment-icon freefall-icon-${kind}${photo ? " has-photo" : ""}`}
      aria-hidden="true"
    >
      {photo ? (
        <img src={photo} alt="" draggable={false} />
      ) : (
        <>
          <i />
          <i />
          <i />
        </>
      )}
    </span>
  );
}

function FreeFallGraph({
  kind,
  measurements,
}: {
  kind: GraphKind;
  measurements: Measurements;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const points = useMemo(
    () =>
      (Object.keys(BALLS) as BallKind[]).map((ball) => ({
        ball,
        values: HEIGHTS.flatMap((height) => {
          const times = measurements[ball][height];
          if (!times.length) return [];
          const meanTime = average(times.map((trial) => trial.time));
          return [
            {
              x: kind === "height-time" ? meanTime : meanTime * meanTime,
              y: height / 100,
            },
          ];
        }),
      })),
    [kind, measurements],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.getBoundingClientRect().width, 280);
    const height = 270;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fbfdfc";
    context.fillRect(0, 0, width, height);

    const margin = { top: 18, right: 18, bottom: 39, left: 48 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const allPoints = points.flatMap((series) => series.values);
    const xMax = Math.max(
      kind === "height-time" ? 0.6 : 0.32,
      ...allPoints.map((point) => point.x * 1.12),
    );
    const yMax = 1.6;
    const pointX = (value: number) =>
      margin.left + (value / xMax) * plotWidth;
    const pointY = (value: number) =>
      margin.top + plotHeight - (value / yMax) * plotHeight;

    context.font = "700 10px Arial";
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let index = 0; index <= 4; index += 1) {
      const value = (yMax / 4) * index;
      const y = pointY(value);
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(width - margin.right, y);
      context.strokeStyle = "#dce8e5";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = "#6d8387";
      context.fillText(value.toFixed(1), margin.left - 8, y);
    }

    context.textAlign = "center";
    context.textBaseline = "top";
    for (let index = 0; index <= 4; index += 1) {
      const value = (xMax / 4) * index;
      const x = pointX(value);
      context.beginPath();
      context.moveTo(x, margin.top);
      context.lineTo(x, margin.top + plotHeight);
      context.strokeStyle = "#edf3f1";
      context.stroke();
      context.fillStyle = "#6d8387";
      context.fillText(
        value.toFixed(kind === "height-time" ? 2 : 3),
        x,
        margin.top + plotHeight + 8,
      );
    }

    context.beginPath();
    context.moveTo(margin.left, margin.top);
    context.lineTo(margin.left, margin.top + plotHeight);
    context.lineTo(width - margin.right, margin.top + plotHeight);
    context.strokeStyle = "#718b8f";
    context.lineWidth = 1.5;
    context.stroke();

    const colors: Record<BallKind, string> = {
      light: "#ef9f28",
      heavy: "#167f75",
    };
    points.forEach((series) => {
      const sorted = [...series.values].sort((a, b) => a.x - b.x);
      if (sorted.length > 1) {
        context.beginPath();
        sorted.forEach((point, index) => {
          const x = pointX(point.x);
          const y = pointY(point.y);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.strokeStyle = colors[series.ball];
        context.lineWidth = 2.5;
        context.stroke();
      }
      sorted.forEach((point) => {
        context.beginPath();
        context.arc(pointX(point.x), pointY(point.y), 4.5, 0, Math.PI * 2);
        context.fillStyle = colors[series.ball];
        context.fill();
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.stroke();
      });
    });

    context.save();
    context.translate(13, margin.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillStyle = "#38575d";
    context.font = "800 10px Arial";
    context.textAlign = "center";
    context.fillText("Yükseklik h (m)", 0, 0);
    context.restore();

    context.fillStyle = "#38575d";
    context.font = "800 10px Arial";
    context.textAlign = "center";
    context.fillText(
      kind === "height-time" ? "Zaman t (s)" : "Zamanın karesi t² (s²)",
      margin.left + plotWidth / 2,
      height - 14,
    );
  }, [kind, points]);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  return (
    <article className="freefall-graph">
      <div className="freefall-graph-heading">
        <b>{kind === "height-time" ? "Yükseklik – zaman" : "Yükseklik – zaman²"}</b>
        <span>
          <i className="legend-light" /> 20 g
          <i className="legend-heavy" /> 40 g
        </span>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={
          kind === "height-time"
            ? "İki bilyenin yükseklik zaman grafiği"
            : "İki bilyenin yükseklik zamanın karesi grafiği"
        }
      />
    </article>
  );
}

function MeasurementTable({
  ball,
  measurements,
}: {
  ball: BallKind;
  measurements: Measurements;
}) {
  return (
    <article className="freefall-table-card">
      <div>
        <span className={BALLS[ball].colorClass} aria-hidden="true" />
        <b>{BALLS[ball].name}</b>
        <small>{BALLS[ball].mass}</small>
      </div>
      <div className="freefall-table-wrap">
        <table>
          <thead>
            <tr>
              <th>h</th>
              <th>t₁</th>
              <th>t₂</th>
              <th>t₃</th>
              <th>t₄</th>
              <th>t₅</th>
              <th>Ort.</th>
            </tr>
          </thead>
          <tbody>
            {HEIGHTS.map((height) => {
              const times = measurements[ball][height];
              return (
                <tr key={height}>
                  <th>{height} cm</th>
                  {Array.from({ length: 5 }, (_, index) => (
                    <td key={index}>
                      {times[index] === undefined
                        ? "—"
                        : times[index].time.toFixed(3)}
                    </td>
                  ))}
                  <td>
                    {times.length
                      ? average(times.map((trial) => trial.time)).toFixed(3)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default function FreeFallLab() {
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingReleaseRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const nextTrialIdRef = useRef(1);
  const [installed, setInstalled] = useState<SetupKind[]>([]);
  const [activeBall, setActiveBall] = useState<BallKind | null>(null);
  const [heightCm, setHeightCm] = useState<number>(100);
  const [gravity, setGravity] = useState(9.81);
  const [ballState, setBallState] = useState<BallState>("ready");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [dropDuration, setDropDuration] = useState(0.2);
  const [measurements, setMeasurements] =
    useState<Measurements>(emptyMeasurements);
  const [trialLog, setTrialLog] = useState<TrialLogEntry[]>([]);
  const [notice, setNotice] = useState(
    "İlk olarak statifi deney alanına yerleştir.",
  );

  const setupReady = SETUP_ORDER.every((kind) => installed.includes(kind));
  const nextSetupKind = SETUP_ORDER.find((kind) => !installed.includes(kind));
  const currentTrials = activeBall
    ? measurements[activeBall][heightCm]
    : [];
  const releaseTop = releaseTopForHeight(heightCm);

  const experimentalG = useMemo(() => {
    if (!trialLog.length) return null;
    return average(trialLog.map((trial) => trial.experimentalGravity));
  }, [trialLog]);

  const latestTrial = trialLog.at(-1) ?? null;

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  const installEquipment = (kind: SetupKind) => {
    if (installed.includes(kind)) {
      setNotice("Bu parça düzeneğe zaten yerleştirildi.");
      return;
    }
    if (kind !== nextSetupKind) {
      const expected = EQUIPMENT.find((item) => item.kind === nextSetupKind);
      setNotice(`Önce ${expected?.shortName.toLocaleLowerCase("tr-TR")} yerleştirilmeli.`);
      return;
    }
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    const next = SETUP_ORDER.find((item) => !nextInstalled.includes(item));
    if (next) {
      const nextName = EQUIPMENT.find((item) => item.kind === next)?.shortName;
      setNotice(`${nextName} deney alanına yerleştirilebilir.`);
    } else {
      setNotice("Düzenek hazır. Bir bilyeyi bırakma mekanizmasına yerleştir.");
    }
  };

  const selectBall = (ball: BallKind) => {
    if (!setupReady) {
      setNotice("Bilyeden önce deney düzeneğini tamamla.");
      return;
    }
    if (ballState === "falling") return;
    setActiveBall(ball);
    setBallState("ready");
    setElapsedSeconds(0);
    setDropDuration(0.2);
    setNotice(`${BALLS[ball].name} bırakma mekanizmasına yerleştirildi.`);
  };

  const onEquipmentDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    kind: SetupKind,
  ) => {
    event.dataTransfer.setData("application/x-freefall-equipment", kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onBallDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    ball: BallKind,
  ) => {
    event.dataTransfer.setData("application/x-freefall-ball", ball);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onStageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const equipment = event.dataTransfer.getData(
      "application/x-freefall-equipment",
    ) as SetupKind;
    const ball = event.dataTransfer.getData(
      "application/x-freefall-ball",
    ) as BallKind;
    if (SETUP_ORDER.includes(equipment)) installEquipment(equipment);
    else if (ball === "light" || ball === "heavy") selectBall(ball);
  };

  const updateHeightFromPointer = (clientY: number) => {
    const stage = stageRef.current;
    if (!stage || ballState === "falling") return;
    const rect = stage.getBoundingClientRect();
    const yPercent = ((clientY - rect.top) / rect.height) * 100;
    const rawHeight = (71 - yPercent) / 0.36;
    const snappedHeight = Math.max(
      25,
      Math.min(150, Math.round(rawHeight / 25) * 25),
    );
    setHeightCm(snappedHeight);
    setBallState("ready");
    setElapsedSeconds(0);
    setDropDuration(0.2);
    setNotice(`Bırakma yüksekliği ${snappedHeight} cm olarak ayarlandı.`);
  };

  const startReleaseDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setupReady || ballState === "falling") return;
    draggingReleaseRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveRelease = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingReleaseRef.current) return;
    updateHeightFromPointer(event.clientY);
  };

  const stopReleaseDrag = () => {
    draggingReleaseRef.current = false;
  };

  const resetTimer = () => {
    if (ballState === "falling") return;
    setElapsedSeconds(0);
    setBallState("ready");
    setDropDuration(0.2);
    setNotice("Kronometre sıfırlandı. Bilye bırakılabilir.");
  };

  const changeGravity = (value: number) => {
    if (ballState === "falling") return;
    const safeValue = Math.max(1.5, Math.min(15, value));
    setGravity(Number(safeValue.toFixed(2)));
    setElapsedSeconds(0);
    setBallState("ready");
    setDropDuration(0.2);
    setNotice(
      `Yer çekimi ivmesi ${safeValue.toFixed(2)} m/s² olarak ayarlandı.`,
    );
  };

  const releaseBall = () => {
    if (!setupReady || !activeBall || ballState === "falling") return;
    if (currentTrials.length >= 5) {
      setNotice("Bu yükseklikte beş ölçüm tamamlandı. Yüksekliği değiştir.");
      return;
    }
    const measuredTime = Math.sqrt((2 * (heightCm / 100)) / gravity);
    const activeGravity = gravity;
    const experimentalGravity = activeGravity;
    const startTime = performance.now();
    setDropDuration(measuredTime);
    setBallState("falling");
    setElapsedSeconds(0);
    setNotice("Bilye düşüyor; kronometre algılayıcı darbeyi bekliyor.");

    const tick = (now: number) => {
      const elapsed = Math.min((now - startTime) / 1000, measuredTime);
      setElapsedSeconds(elapsed);
      if (elapsed >= measuredTime) {
        setBallState("landed");
        setMeasurements((current) => ({
          ...current,
          [activeBall]: {
            ...current[activeBall],
            [heightCm]: [
              ...current[activeBall][heightCm],
              { time: measuredTime, gravity: activeGravity },
            ].slice(0, 5),
          },
        }));
        setTrialLog((current) => [
          ...current,
          {
            id: nextTrialIdRef.current++,
            ball: activeBall,
            height: heightCm,
            time: measuredTime,
            gravity: activeGravity,
            experimentalGravity,
          },
        ]);
        setNotice(
          `${activeGravity.toFixed(2)} m/s² ve ${heightCm} cm için ${measuredTime.toFixed(3)} s ölçüldü; iki değer de kaydedildi.`,
        );
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const clearExperiment = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setInstalled([]);
    setActiveBall(null);
    setHeightCm(100);
    setGravity(9.81);
    setBallState("ready");
    setElapsedSeconds(0);
    setDropDuration(0.2);
    setMeasurements(emptyMeasurements());
    setTrialLog([]);
    nextTrialIdRef.current = 1;
    setNotice("İlk olarak statifi deney alanına yerleştir.");
  };

  const ballStyle = {
    "--release-top": `${releaseTop - 1}%`,
    "--fall-time": `${dropDuration}s`,
  } as CSSProperties;

  return (
    <section className="freefall-lab-section" id="serbest-dusme-deneyi">
      <div className="freefall-heading">
        <div>
          <span>DENEY 2 · FİZ.10.1.4 · FİZ.10.1.5</span>
          <h2>Serbest düşme deneyini kur ve ölç.</h2>
        </div>
        <p>
          Düzenek parçalarını sırayla yerleştir, bırakma yüksekliğini mekanizma
          üzerinden ayarla; farklı yer çekimi ivmelerinde iki bilyenin
          verilerini karşılaştır.
        </p>
      </div>

      <div className="freefall-builder">
        <aside className="freefall-equipment-panel">
          <div className="freefall-panel-heading">
            <span>TÜM MALZEMELER AÇIK</span>
            <b>Düzeneği kur</b>
          </div>
          <div className="freefall-equipment-list">
            {EQUIPMENT.map((item) => (
              <button
                type="button"
                draggable
                className={installed.includes(item.kind) ? "installed" : ""}
                disabled={installed.includes(item.kind)}
                onClick={() => installEquipment(item.kind)}
                onDragStart={(event) => onEquipmentDragStart(event, item.kind)}
                key={item.kind}
              >
                <EquipmentIcon kind={item.kind} />
                <span>
                  <b>{item.shortName}</b>
                  <small>
                    {installed.includes(item.kind) ? "Yerleştirildi" : "Sürükle veya dokun"}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <div className="freefall-ball-tray">
            {(Object.keys(BALLS) as BallKind[]).map((ball) => (
              <button
                type="button"
                draggable
                className={activeBall === ball ? "selected" : ""}
                onClick={() => selectBall(ball)}
                onDragStart={(event) => onBallDragStart(event, ball)}
                key={ball}
              >
                <span className={BALLS[ball].colorClass} aria-hidden="true" />
                <b>{BALLS[ball].name}</b>
                <small>{BALLS[ball].mass}</small>
              </button>
            ))}
          </div>
          <button
            className="freefall-clear-button"
            type="button"
            onClick={clearExperiment}
          >
            Deneyi baştan kur
          </button>
        </aside>

        <div
          className="freefall-stage"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onStageDrop}
        >
          <div className="freefall-stage-toolbar">
            <span>
              <small>SİSTEMİN TANIDIĞI DÜZENEK</small>
              <b>{setupReady ? "Serbest düşme düzeneği" : "Kurulum bekleniyor"}</b>
            </span>
            <span className={setupReady ? "ready" : ""}>
              {installed.length} / {SETUP_ORDER.length} parça
            </span>
          </div>

          <div className="freefall-notice" role="status">
            <i aria-hidden="true">{setupReady ? "✓" : installed.length + 1}</i>
            <span>{notice}</span>
          </div>

          <div
            className="freefall-apparatus"
            ref={stageRef}
            aria-label="Serbest düşme deney düzeneği"
          >
            <div className="freefall-lab-wall" />
            <div className="freefall-model-assumption">
              <i aria-hidden="true">≈</i>
              <span>
                <small>MODEL VARSAYIMI</small>
                <b>Hava sürtünmesi ihmal edilmiştir.</b>
              </span>
            </div>
            <div className="freefall-bench">
              <img
                src="./motion-lab-bench-v3.webp"
                alt=""
                draggable={false}
              />
            </div>

            {installed.includes("stand") && (
              <div className="freefall-stand">
                <img
                  src="./freefall-equipment-stand.webp"
                  alt="Gerçekçi metal statif ve düşey çubuk"
                  draggable={false}
                />
              </div>
            )}

            {installed.includes("ruler") && (
              <div className="freefall-ruler">
                <img
                  src="./freefall-equipment-ruler.webp"
                  alt="Gerçekçi düşey yükseklik cetveli"
                  draggable={false}
                />
                {HEIGHTS.map((height) => (
                  <i
                    style={{ bottom: `${11.5 + (height / 150) * 78.5}%` }}
                    key={height}
                  >
                    {height}
                  </i>
                ))}
              </div>
            )}

            {installed.includes("release") && (
              <button
                type="button"
                className="freefall-release-carriage"
                style={{ "--release-top": `${releaseTop}%` } as CSSProperties}
                aria-label={`Bırakma mekanizması, yükseklik ${heightCm} santimetre. Dikey sürükleyerek ayarla.`}
                onPointerDown={startReleaseDrag}
                onPointerMove={moveRelease}
                onPointerUp={stopReleaseDrag}
                onPointerCancel={stopReleaseDrag}
              >
                <img
                  className="freefall-release-photo"
                  src="./freefall-equipment-release.webp"
                  alt=""
                  draggable={false}
                />
                <b>{heightCm} cm</b>
              </button>
            )}

            {installed.includes("sensor") && (
              <div className={`freefall-sensor ${ballState === "landed" ? "hit" : ""}`}>
                <img
                  src="./freefall-equipment-sensor.webp"
                  alt="Gerçekçi darbe algılayıcı tablası"
                  draggable={false}
                />
                <span aria-hidden="true" />
                <b>Algılayıcı tabla</b>
              </div>
            )}

            {installed.includes("timer") && (
              <div className="freefall-timer-station">
                <img
                  className="freefall-timer-photo"
                  src="./freefall-equipment-timer.webp"
                  alt="Gerçekçi dijital laboratuvar kronometresi"
                  draggable={false}
                />
                <div className="freefall-timer">
                  <div className="freefall-timer-brand">
                    <small>DİJİTAL ZAMAN ÖLÇER</small>
                    <i className={ballState === "falling" ? "live" : ""} />
                  </div>
                  <div className="freefall-timer-screen">
                    <b>{elapsedSeconds.toFixed(3)}</b>
                    <span>s</span>
                  </div>
                  <div className="freefall-timer-channels">
                    <span>
                      <i className="channel-release" />
                      CH 1 · BIRAKMA
                    </span>
                    <span>
                      <i className="channel-sensor" />
                      CH 2 · DARBE
                    </span>
                  </div>
                </div>
              </div>
            )}

            {installed.includes("timer") && installed.includes("release") && (
              <span
                className="freefall-cable cable-release"
                style={
                  {
                    "--cable-start": `${releaseTop - 14}%`,
                  } as CSSProperties
                }
              >
                <i>CH 1</i>
              </span>
            )}
            {installed.includes("timer") && installed.includes("sensor") && (
              <span className="freefall-cable cable-sensor">
                <i>CH 2</i>
              </span>
            )}

            {activeBall && setupReady && (
              <span
                className={`freefall-dropping-ball ${BALLS[activeBall].colorClass} ${ballState}`}
                style={ballStyle}
                aria-label={`${BALLS[activeBall].name}, ${BALLS[activeBall].mass}`}
              />
            )}

            {!installed.includes("stand") && (
              <div className="freefall-empty-target">
                <i>＋</i>
                <b>Malzemeleri bu alana sürükle</b>
              </div>
            )}
          </div>

          <div className="freefall-controls">
            <div className="freefall-height-readout">
              <span>Ölçülen düşme yüksekliği</span>
              <b>{heightCm} cm</b>
              <small>Bırakma mekanizmasını düşeyde sürükle</small>
            </div>
            <div className="freefall-gravity-control">
              <div>
                <span>Yer çekimi ivmesi</span>
                <b>{gravity.toFixed(2)} m/s²</b>
              </div>
              <input
                type="range"
                min="1.5"
                max="15"
                step="0.01"
                value={gravity}
                disabled={ballState === "falling"}
                aria-label="Yer çekimi ivmesi"
                onChange={(event) => changeGravity(Number(event.target.value))}
              />
              <div className="freefall-gravity-presets">
                <button
                  type="button"
                  className={gravity === 1.62 ? "active" : ""}
                  onClick={() => changeGravity(1.62)}
                  disabled={ballState === "falling"}
                >
                  Ay
                </button>
                <button
                  type="button"
                  className={gravity === 3.71 ? "active" : ""}
                  onClick={() => changeGravity(3.71)}
                  disabled={ballState === "falling"}
                >
                  Mars
                </button>
                <button
                  type="button"
                  className={gravity === 9.81 ? "active" : ""}
                  onClick={() => changeGravity(9.81)}
                  disabled={ballState === "falling"}
                >
                  Dünya
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={resetTimer}
              disabled={!setupReady || !activeBall || ballState === "falling"}
            >
              Kronometreyi sıfırla
            </button>
            <button
              className="primary"
              type="button"
              onClick={releaseBall}
              disabled={
                !setupReady ||
                !activeBall ||
                ballState === "falling" ||
                currentTrials.length >= 5
              }
            >
              Bilyeyi serbest bırak
            </button>
          </div>
        </div>
      </div>

      <div className="freefall-progress">
        <span className={setupReady ? "done" : ""}>1 · Düzeneği kur</span>
        <span className={setupReady ? "done" : ""}>2 · Yüksekliği ayarla</span>
        <span className={activeBall ? "done" : ""}>3 · Bilyeyi yerleştir</span>
        <span className={elapsedSeconds > 0 ? "done" : ""}>4 · Süreyi ölç</span>
      </div>

      <div className="freefall-data-heading">
        <div>
          <span>CANLI DENEY VERİLERİ</span>
          <h3>İki bilyenin ölçümleri aynı ekranda</h3>
        </div>
        <div className="freefall-g-result">
          <small>Son ölçümden hesaplanan g</small>
          <b>
            {latestTrial === null
              ? "—"
              : `${latestTrial.experimentalGravity.toFixed(2)} m/s²`}
          </b>
          <span>
            {latestTrial === null
              ? "İlk ölçümden sonra hesaplanır"
              : "İdeal hareket modeliyle tam uyumlu"}
          </span>
          {experimentalG !== null && (
            <em>
              Tüm kayıtların deneysel ortalaması: {experimentalG.toFixed(2)} m/s²
            </em>
          )}
        </div>
      </div>

      <div className="freefall-tables">
        <MeasurementTable ball="light" measurements={measurements} />
        <MeasurementTable ball="heavy" measurements={measurements} />
      </div>

      <article className="freefall-gravity-log">
        <div className="freefall-gravity-log-heading">
          <span>DEĞİŞKEN YER ÇEKİMİ KAYITLARI</span>
          <div>
            <h3>Her düşüşün ayarı ve sonucu</h3>
            <p>
              Ayarlanan g değeri, ölçülen süre ve veriden hesaplanan g birlikte
              saklanır.
            </p>
          </div>
          <b>{trialLog.length} kayıt</b>
        </div>
        <div className="freefall-gravity-log-wrap">
          <table>
            <thead>
              <tr>
                <th>Deneme</th>
                <th>Bilye</th>
                <th>Yükseklik</th>
                <th>Ayarlanan g</th>
                <th>Ölçülen süre</th>
                <th>Hesaplanan g</th>
              </tr>
            </thead>
            <tbody>
              {trialLog.length ? (
                [...trialLog].reverse().map((trial) => (
                  <tr key={trial.id}>
                    <th>#{trial.id}</th>
                    <td>{BALLS[trial.ball].mass}</td>
                    <td>{trial.height} cm</td>
                    <td>{trial.gravity.toFixed(2)} m/s²</td>
                    <td>{trial.time.toFixed(3)} s</td>
                    <td>{trial.experimentalGravity.toFixed(2)} m/s²</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    Yer çekimi ivmesini seçip ilk düşüşü gerçekleştirdiğinde
                    kayıtlar burada oluşur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <div className="freefall-graphs">
        <FreeFallGraph kind="height-time" measurements={measurements} />
        <FreeFallGraph kind="height-time-squared" measurements={measurements} />
      </div>

      <section className="freefall-report">
        <div className="freefall-report-heading">
          <span>KISA DENEY RAPORU</span>
          <h3>Kanıtını ölçümlerinden seç.</h3>
          <p>Yanıtlarını tablodaki ve grafiklerdeki verileri kullanarak yaz.</p>
        </div>
        <div className="freefall-report-grid">
          <label>
            <span>1</span>
            Aynı yükseklikte iki bilyenin düşme sürelerini karşılaştır.
            <textarea rows={4} aria-label="İki bilyenin düşme sürelerini karşılaştırma" />
          </label>
          <label>
            <span>2</span>
            Yükseklik–zaman ve yükseklik–zaman² grafiklerinin biçimini yorumla.
            <textarea rows={4} aria-label="Serbest düşme grafiklerini yorumlama" />
          </label>
          <label>
            <span>3</span>
            En az iki farklı g kaydını seç. Yer çekimi ivmesi değiştiğinde düşme
            süresinin nasıl değiştiğini kanıtlarıyla yorumla.
            <textarea rows={4} aria-label="Değişen yer çekimi ivmesini yorumlama" />
          </label>
          <label>
            <span>4</span>
            İdeal modelde bilyenin düşey hızı düşüş boyunca nasıl değişir?
            Zaman ölçümlerini kullanarak açıkla.
            <textarea rows={4} aria-label="Serbest düşmede hız değişimini yorumlama" />
          </label>
        </div>
        <label className="freefall-report-conclusion">
          <span>SONUÇ</span>
          Serbest düşme hareketini verilerine dayanarak kendi cümlelerinle açıkla.
          <textarea rows={5} aria-label="Serbest düşme deney sonucu" />
        </label>
      </section>
    </section>
  );
}
