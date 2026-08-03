"use client";

import { useMemo, useState } from "react";

type ResistorLabel = "A" | "B";
type ConnectionKind = "single-a" | "single-b" | "series" | "parallel" | "open";
type TargetKind = "series" | "parallel";

type CircuitTarget = {
  kind: TargetKind;
  title: string;
  notation: string;
  purpose: string;
  switches: number[];
  instruction: string;
};

type CircuitAnalysis = {
  complete: boolean;
  kind: ConnectionKind;
  topology: string;
  equivalentResistance: number;
  totalCurrentMilliamp: number;
  currentsMilliamp: Record<ResistorLabel, number>;
  activeResistors: ResistorLabel[];
  activeSwitches: number[];
};

type Trial = CircuitAnalysis & {
  id: string;
  voltage: number;
  switches: number[];
};

const RESISTORS: Record<ResistorLabel, number> = { A: 100, B: 150 };

const SWITCH_INFO: Record<number, { title: string; short: string; description: string }> = {
  1: {
    title: "Seri köprü",
    short: "A → B",
    description: "A direncinin çıkışını B direncinin girişine bağlar.",
  },
  2: {
    title: "A kolu",
    short: "A → −",
    description: "A direncinin çıkışını kaynağın eksi ucuna bağlar.",
  },
  3: {
    title: "B kolu",
    short: "+ → B",
    description: "Kaynağın artı ucunu B direncinin girişine bağlar.",
  },
};

const TARGETS: CircuitTarget[] = [
  {
    kind: "series",
    title: "Seri bağlantı",
    notation: "A — B",
    purpose: "Akımın önce A, ardından B direncinden geçtiği tek yolu oluştur.",
    switches: [1],
    instruction: "Yalnız S1'i kapat. S2 ve S3 açık kalsın.",
  },
  {
    kind: "parallel",
    title: "Paralel bağlantı",
    notation: "A ∥ B",
    purpose: "Akımın A ve B kollarına ayrıldığı iki yol oluştur.",
    switches: [2, 3],
    instruction: "S1'i aç; S2 ve S3'ü kapat.",
  },
];

function formatResistance(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

function analyzeCircuit(closedSwitches: number[], voltage: number): CircuitAnalysis {
  const closed = new Set(closedSwitches);
  const emptyCurrents: Record<ResistorLabel, number> = { A: 0, B: 0 };
  const open: CircuitAnalysis = {
    complete: false,
    kind: "open",
    topology: "Açık devre",
    equivalentResistance: 0,
    totalCurrentMilliamp: 0,
    currentsMilliamp: emptyCurrents,
    activeResistors: [],
    activeSwitches: [],
  };

  if (closed.has(1)) {
    const equivalentResistance = RESISTORS.A + RESISTORS.B;
    const current = (voltage / equivalentResistance) * 1000;
    return {
      complete: true,
      kind: "series",
      topology: "Seri bağlantı: A — B",
      equivalentResistance,
      totalCurrentMilliamp: current,
      currentsMilliamp: { A: current, B: current },
      activeResistors: ["A", "B"],
      activeSwitches: [1],
    };
  }

  if (closed.has(2) && closed.has(3)) {
    const equivalentResistance = (RESISTORS.A * RESISTORS.B) / (RESISTORS.A + RESISTORS.B);
    const currentA = (voltage / RESISTORS.A) * 1000;
    const currentB = (voltage / RESISTORS.B) * 1000;
    return {
      complete: true,
      kind: "parallel",
      topology: "Paralel bağlantı: A ∥ B",
      equivalentResistance,
      totalCurrentMilliamp: currentA + currentB,
      currentsMilliamp: { A: currentA, B: currentB },
      activeResistors: ["A", "B"],
      activeSwitches: [2, 3],
    };
  }

  if (closed.has(2)) {
    const current = (voltage / RESISTORS.A) * 1000;
    return {
      complete: true,
      kind: "single-a",
      topology: "Yalnız A direnci",
      equivalentResistance: RESISTORS.A,
      totalCurrentMilliamp: current,
      currentsMilliamp: { A: current, B: 0 },
      activeResistors: ["A"],
      activeSwitches: [2],
    };
  }

  if (closed.has(3)) {
    const current = (voltage / RESISTORS.B) * 1000;
    return {
      complete: true,
      kind: "single-b",
      topology: "Yalnız B direnci",
      equivalentResistance: RESISTORS.B,
      totalCurrentMilliamp: current,
      currentsMilliamp: { A: 0, B: current },
      activeResistors: ["B"],
      activeSwitches: [3],
    };
  }

  return open;
}

function BenchResistor({
  label,
  powered,
  currentMilliamp,
}: {
  label: ResistorLabel;
  powered: boolean;
  currentMilliamp: number;
}) {
  return (
    <div className={`rc4-resistor rc4-resistor-${label.toLowerCase()} ${powered ? "powered" : ""}`}>
      <i className="rc4-resistor-lead left" />
      <span className="rc4-resistor-body"><i /><i /><i /><i /></span>
      <i className="rc4-resistor-lead right" />
      <b>{label}</b>
      <small>{RESISTORS[label]} Ω</small>
      <em>{powered ? `${currentMilliamp.toFixed(1)} mA` : ""}</em>
    </div>
  );
}

function CircuitSwitch({
  number,
  closed,
  highlighted,
  energized,
  onToggle,
}: {
  number: number;
  closed: boolean;
  highlighted: boolean;
  energized: boolean;
  onToggle: (number: number) => void;
}) {
  const info = SWITCH_INFO[number];
  return (
    <button
      type="button"
      className={`rc4-switch rc4-switch-${number} ${closed ? "closed" : "open"} ${highlighted ? "highlighted" : ""} ${energized ? "energized" : ""}`}
      onClick={() => onToggle(number)}
      aria-pressed={closed}
      aria-label={`S${number} ${info.title}: ${info.description} Şu anda ${closed ? "kapalı" : "açık"}.`}
      data-testid={`resistor-switch-${number}`}
    >
      <span>S{number}</span>
      <i className="rc4-switch-mechanism"><b /><b /><em /></i>
      <strong>{info.title}</strong>
      <small>{closed ? "KAPALI" : "AÇIK"}</small>
    </button>
  );
}

function SimpleCircuit({
  closedSwitches,
  targetSwitches,
  powerOn,
  analysis,
  onToggle,
}: {
  closedSwitches: number[];
  targetSwitches: number[];
  powerOn: boolean;
  analysis: CircuitAnalysis;
  onToggle: (number: number) => void;
}) {
  const seriesActive = powerOn && analysis.kind === "series";
  const parallelActive = powerOn && analysis.kind === "parallel";

  return (
    <div className={`rc4-circuit ${powerOn ? "powered" : ""}`} data-testid="simple-resistor-circuit">
      <div className="rc4-circuit-caption">
        <span><b>İKİ DİRENÇLİ DEVRE</b><small>Parçaların yeri değişmez</small></span>
        <strong>{analysis.complete ? analysis.topology : "Bir akım yolu oluştur"}</strong>
      </div>

      <div className="rc4-circuit-field">
        <span className="rc4-terminal positive"><b>+</b><small>KAYNAK</small></span>
        <span className="rc4-terminal negative"><b>−</b><small>DÖNÜŞ</small></span>

        <i className={`rc4-wire wire-source-a ${powerOn ? "active" : ""}`} />
        <i className={`rc4-wire wire-a-split ${powerOn ? "active" : ""}`} />
        <i className={`rc4-wire wire-series ${seriesActive ? "active" : ""}`} />
        <i className={`rc4-wire wire-series-b ${seriesActive ? "active" : ""}`} />
        <i className={`rc4-wire wire-a-return ${parallelActive || (powerOn && analysis.kind === "single-a") ? "active" : ""}`} />
        <i className={`rc4-wire wire-b-feed ${parallelActive || (powerOn && analysis.kind === "single-b") ? "active" : ""}`} />
        <i className={`rc4-wire wire-b-left ${powerOn && analysis.activeResistors.includes("B") ? "active" : ""}`} />
        <i className={`rc4-wire wire-b-return ${powerOn && analysis.activeResistors.includes("B") ? "active" : ""}`} />
        <i className={`rc4-wire wire-negative ${powerOn ? "active" : ""}`} />

        <span className="rc4-junction junction-positive" />
        <span className="rc4-junction junction-a" />
        <span className="rc4-junction junction-b" />
        <span className="rc4-junction junction-negative" />

        <BenchResistor label="A" powered={powerOn && analysis.activeResistors.includes("A")} currentMilliamp={analysis.currentsMilliamp.A} />
        <BenchResistor label="B" powered={powerOn && analysis.activeResistors.includes("B")} currentMilliamp={analysis.currentsMilliamp.B} />

        {[1, 2, 3].map((number) => (
          <CircuitSwitch
            number={number}
            closed={closedSwitches.includes(number)}
            highlighted={targetSwitches.includes(number) && !closedSwitches.includes(number)}
            energized={powerOn && analysis.activeSwitches.includes(number)}
            onToggle={onToggle}
            key={number}
          />
        ))}

        <span className="rc4-route-label series">SERİ YOL</span>
        <span className="rc4-route-label parallel">PARALEL KOLLAR</span>
      </div>

      <div className="rc4-legend">
        <span><i />Açık anahtar</span>
        <span><i className="closed" />Kapalı anahtar</span>
        <span><i className="flow" />Akım geçen yol</span>
      </div>
    </div>
  );
}

export default function ResistorConnectionsLab() {
  const [selectedTarget, setSelectedTarget] = useState<TargetKind>("series");
  const [closedSwitches, setClosedSwitches] = useState<number[]>([]);
  const [voltage, setVoltage] = useState(9);
  const [powerOn, setPowerOn] = useState(false);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [prediction, setPrediction] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [notice, setNotice] = useState("Seri bağlantı için yalnız S1 anahtarını kapat.");

  const target = TARGETS.find((item) => item.kind === selectedTarget) ?? TARGETS[0];
  const analysis = useMemo(() => analyzeCircuit(closedSwitches, voltage), [closedSwitches, voltage]);
  const goalComplete = target.switches.length === closedSwitches.length
    && target.switches.every((number) => closedSwitches.includes(number));
  const displayTotalCurrent = powerOn && analysis.complete ? analysis.totalCurrentMilliamp : 0;
  const analysisReady = trials.some((trial) => trial.kind === "series")
    && trials.some((trial) => trial.kind === "parallel");

  const latestTargetTrials = useMemo(
    () => TARGETS.map((item) => ({
      target: item,
      trial: [...trials].reverse().find((trial) => trial.kind === item.kind) ?? null,
    })),
    [trials],
  );

  const selectTarget = (kind: TargetKind) => {
    const nextTarget = TARGETS.find((item) => item.kind === kind) ?? TARGETS[0];
    setSelectedTarget(kind);
    setShowAnalysis(false);
    setNotice(`${nextTarget.title} seçildi. ${nextTarget.instruction}`);
  };

  const toggleSwitch = (number: number) => {
    if (powerOn) {
      setNotice("Anahtar değiştirmek için önce güç kaynağını kapat.");
      return;
    }

    const closing = !closedSwitches.includes(number);
    let next: number[];
    if (!closing) {
      next = closedSwitches.filter((item) => item !== number);
    } else if (number === 1) {
      next = [1];
    } else {
      next = [...closedSwitches.filter((item) => item !== 1), number].filter(
        (item, index, items) => items.indexOf(item) === index,
      );
    }
    setClosedSwitches(next.sort((first, second) => first - second));
    setNotice(`S${number} ${closing ? "kapandı" : "açıldı"}. ${SWITCH_INFO[number].description}`);
  };

  const resetSwitches = () => {
    if (powerOn) return;
    setClosedSwitches([]);
    setNotice("Üç anahtar da açıldı. Devre parçaları aynı yerlerinde kaldı.");
  };

  const togglePower = () => {
    if (!analysis.complete) {
      setNotice(`Devre açık. ${target.instruction}`);
      return;
    }
    setPowerOn((current) => !current);
    setNotice(powerOn
      ? "Güç kaynağı kapatıldı; anahtarlar yeniden ayarlanabilir."
      : `${analysis.topology} çalışıyor. Akım geçen yol yeşil renkte gösteriliyor.`);
  };

  const recordTrial = () => {
    if (!powerOn || !analysis.complete) return;
    const switches = [...closedSwitches].sort((first, second) => first - second);
    const trial: Trial = {
      ...analysis,
      id: `${analysis.kind}-${voltage}`,
      voltage,
      switches,
    };
    setTrials((current) => [...current.filter((item) => item.id !== trial.id), trial]);
    setNotice(`${analysis.topology} ölçümü kaydedildi.`);
  };

  return (
    <section className="resistor-connections-lab rc2-lab rc4-lab" id="direnc-baglantilari-deneyi">
      <header className="rc2-hero rc4-hero">
        <div>
          <span>ELEKTRİK · DENEY 2 · FİZ.10.3.4</span>
          <h1>İki direnç, üç anahtar, tek devre.</h1>
          <p>
            A ve B dirençleri aynı yerde kalır. S1 ile seri yolu, S2 ve S3 ile paralel
            kolları oluştur; devrenin tamamını tek bakışta izle.
          </p>
        </div>
        <aside><i>2R</i><span><b>SADE DENEY DÜZENEĞİ</b><small>2 direnç · 3 anahtar · ideal ölçüm</small></span></aside>
      </header>

      <div className="rc2-prediction">
        <span><small>DENEY ÖNCESİ TAHMİN</small><b>Seri ve paralel bağlandığında toplam direnç nasıl değişir?</b></span>
        <input value={prediction} onChange={(event) => setPrediction(event.target.value)} placeholder="Tahminini buraya yaz…" />
      </div>

      <section className="rc2-task-picker rc4-task-picker">
        <div className="rc2-section-heading"><span>1 · BAĞLANTIYI SEÇ</span><h2>Aynı devrede yalnız gerekli anahtarları kullan.</h2></div>
        <div className="rc4-target-tabs">
          {TARGETS.map((item, index) => (
            <button type="button" className={target.kind === item.kind ? "active" : ""} onClick={() => selectTarget(item.kind)} aria-pressed={target.kind === item.kind} key={item.kind}>
              <small>0{index + 1}</small><span><b>{item.title}</b><em>{item.purpose}</em></span><strong>{item.notation}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="rc2-workspace rc4-workspace">
        <aside className="rc2-guide-card rc4-guide-card">
          <span className="rc2-eyebrow">HEDEF BAĞLANTI</span>
          <h2>{target.title}</h2>
          <strong>{target.notation}</strong>
          <p>{target.instruction}</p>
          <div className={`rc4-goal-state ${goalComplete ? "complete" : ""}`}>
            <i>{goalComplete ? "✓" : target.switches.length}</i>
            <span><b>{goalComplete ? "Bağlantı hazır" : "Gerekli anahtar"}</b><small>{target.switches.map((number) => `S${number}`).join(" ve ")}</small></span>
          </div>
          <div className="rc4-switch-key">
            {[1, 2, 3].map((number) => (
              <span className={closedSwitches.includes(number) ? "closed" : ""} key={number}>
                <b>S{number}</b><small>{SWITCH_INFO[number].title}</small><em>{closedSwitches.includes(number) ? "Kapalı" : "Açık"}</em>
              </span>
            ))}
          </div>
          <button type="button" className="rc2-reset-links" onClick={resetSwitches} disabled={powerOn}>Anahtarları aç</button>
        </aside>

        <section className="rc2-stage rc4-stage">
          <div className="rc2-stage-topbar">
            <span><small>MASA ÜSTÜ DENEY DEVRESİ</small><b>{analysis.topology}</b></span>
            <strong className={analysis.complete ? "ready" : ""}>{analysis.complete ? "Devre tamam" : "Açık devre"}</strong>
          </div>
          <div className="rc2-instruction" role="status">
            <i>{analysis.complete ? "✓" : "i"}</i>
            <span><small>{analysis.complete ? "BAĞLANTI TANINDI" : "YÖNERGE"}</small><b>{notice}</b></span>
          </div>

          <div className="rc2-workbench rc4-workbench">
            <div className="rc2-wall"><i /><i /></div><div className="rc2-table"><i /><i /></div>

            <SimpleCircuit closedSwitches={closedSwitches} targetSwitches={target.switches} powerOn={powerOn} analysis={analysis} onToggle={toggleSwitch} />

            <div className={`rc2-power-supply ${powerOn ? "on" : ""}`}>
              <div className="rc2-device-handle" /><small>DC GÜÇ KAYNAĞI</small>
              <div className="rc2-power-display"><b>{powerOn ? voltage.toFixed(1) : "0.0"}</b><em>V</em></div>
              <div className="rc2-power-controls"><span><i />GERİLİM</span><span><i />AKIM</span></div>
              <div className="rc2-power-terminals"><span className="positive">+</span><span className="negative">−</span></div>
              <button type="button" onClick={togglePower}>{powerOn ? "GÜCÜ KAPAT" : "DEVREYİ ÇALIŞTIR"}</button>
            </div>
            <div className="rc2-cable red" /><div className="rc2-cable blue" />
            <div className={`rc2-digital-meter amp ${powerOn ? "on" : ""}`}><small>TOPLAM AKIM</small><b>{displayTotalCurrent.toFixed(1)}</b><em>mA</em><span>A</span></div>
            <div className={`rc2-digital-meter volt ${powerOn ? "on" : ""}`}><small>KAYNAK GERİLİMİ</small><b>{powerOn ? voltage.toFixed(2) : "0.00"}</b><em>V</em><span>V</span></div>
          </div>

          <div className="rc2-controls rc4-controls">
            <label><span>Kaynak gerilimi</span><select value={voltage} onChange={(event) => setVoltage(Number(event.target.value))} disabled={powerOn}><option value={6}>6 V</option><option value={9}>9 V</option><option value={12}>12 V</option></select></label>
            <span><small>Tanımlanan bağlantı</small><b>{analysis.complete ? analysis.topology : "—"}</b></span>
            <span><small>Eşdeğer direnç</small><b>{powerOn ? `${formatResistance(analysis.equivalentResistance)} Ω` : "Devreyi çalıştır"}</b></span>
            <span><small>Toplam akım</small><b>{powerOn ? `${displayTotalCurrent.toFixed(1)} mA` : "—"}</b></span>
            <button type="button" onClick={recordTrial} disabled={!powerOn}>Ölçümü kaydet</button>
          </div>
        </section>
      </div>

      <section className="rc2-data-section">
        <div className="rc2-data-heading"><div><span>2 · İDEAL ÖLÇÜM SONUÇLARI</span><h2>Seri ve paralel bağlantıyı karşılaştır.</h2></div><b>{trials.length}<small>kayıt</small></b></div>
        <div className="rc2-data-grid">
          <article className="rc2-table-card">
            <div><b>Ölçüm tablosu</b><span>İdeal devre</span></div>
            <div className="rc2-table-wrap"><table><thead><tr><th>Bağlantı</th><th>Anahtarlar</th><th>Gerilim</th><th>R eş</th><th>I toplam</th><th>I A</th><th>I B</th></tr></thead><tbody>
              {trials.length ? trials.map((trial) => <tr key={trial.id}><th>{trial.topology}</th><td>{trial.switches.map((number) => `S${number}`).join(", ")}</td><td>{trial.voltage} V</td><td>{formatResistance(trial.equivalentResistance)} Ω</td><td>{trial.totalCurrentMilliamp.toFixed(1)} mA</td><td>{trial.currentsMilliamp.A.toFixed(1)} mA</td><td>{trial.currentsMilliamp.B.toFixed(1)} mA</td></tr>) : <tr><td colSpan={7}>Seri veya paralel devreyi çalıştırıp ilk ölçümü kaydet.</td></tr>}
            </tbody></table></div>
          </article>
          <article className="rc2-comparison-card">
            <div><b>Bağlantılar</b><span>Son kayıtlar</span></div>
            <div className="rc2-comparison-bars">
              {latestTargetTrials.map(({ target: item, trial }) => <div key={item.kind}><span><b>{item.notation}</b><small>{trial ? `${formatResistance(trial.equivalentResistance)} Ω` : "ölçülmedi"}</small></span><i><b style={{ width: trial ? `${Math.min(100, Math.max(8, trial.equivalentResistance / 2.5))}%` : "0%" }} /></i></div>)}
            </div>
          </article>
        </div>
      </section>

      <section className="rc2-analysis-gate">
        <div><span>3 · SONUCU AÇIKLA</span><h2>İki bağlantı arasındaki örüntüyü incele.</h2><p>{analysisReady ? "Seri ve paralel ölçümlerin hazır." : "Analiz için bir seri ve bir paralel ölçüm kaydet."}</p></div>
        <button type="button" disabled={!analysisReady} onClick={() => setShowAnalysis((current) => !current)}>{showAnalysis ? "Analizi kapat" : "İşlemsel analizi göster"} →</button>
      </section>

      {showAnalysis && analysisReady && <section className="rc2-analysis-cards rc4-analysis-cards">
        <article><span>SERİ BAĞLANTI</span><b>R<sub>eş</sub> = R<sub>A</sub> + R<sub>B</sub></b><p>A ve B üzerinden aynı akım geçer.</p></article>
        <article><span>PARALEL BAĞLANTI</span><b>1/R<sub>eş</sub> = 1/R<sub>A</sub> + 1/R<sub>B</sub></b><p>Akım iki kola ayrılır; kol akımları toplanır.</p></article>
      </section>}

      <section className="rc2-report">
        <div className="rc2-report-heading"><span>TYMM · KISA DENEY RAPORU</span><h2>Seri ve paralel bağlantıyı kanıtlarınla karşılaştır.</h2><p>Yanıtlarında anahtar durumlarını ve ölçüm tablosunu kullan.</p></div>
        <div className="rc2-report-grid">
          <label><span>1 · ANAHTARLAR</span>Seri ve paralel bağlantıda hangi anahtarları kapattın?<textarea rows={4} /></label>
          <label><span>2 · AKIM</span>İki bağlantıda toplam akım ve direnç akımları nasıl değişti?<textarea rows={4} /></label>
        </div>
        <label className="rc2-report-conclusion"><span>SONUÇ</span>Bağlantı biçiminin eşdeğer dirence etkisini ölçümlerine dayanarak açıkla.<textarea rows={5} /></label>
      </section>
    </section>
  );
}
