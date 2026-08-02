"use client";

import { useMemo, useState } from "react";

type CircuitKind =
  | "single-a"
  | "single-b"
  | "series-ab"
  | "parallel-ac"
  | "mixed-abcd";

type CircuitType = "single" | "series" | "parallel" | "mixed";

type CircuitTask = {
  kind: CircuitKind;
  title: string;
  notation: string;
  type: CircuitType;
  purpose: string;
  switches: number[];
  components: Array<keyof typeof RESISTORS>;
};

type Trial = {
  id: string;
  task: CircuitKind;
  type: CircuitType;
  title: string;
  voltage: number;
  equivalentResistance: number;
  totalCurrentMilliamp: number;
  currentNote: string;
};

type SwitchControlProps = {
  number: number;
  closed: boolean;
  highlighted: boolean;
  powered: boolean;
  onToggle: (number: number) => void;
};

const RESISTORS = { A: 100, B: 150, C: 220, D: 330 } as const;

const SWITCH_INFO: Record<number, { short: string; description: string }> = {
  1: { short: "+ → A", description: "Kaynağın (+) ucunu A direncinin üst ucuna bağlar." },
  2: { short: "A → −", description: "A direncinin alt ucunu kaynağın (−) ucuna bağlar." },
  3: { short: "A ↔ B", description: "A direncinin alt ucunu B direncinin alt ucuna bağlar." },
  4: { short: "B ↔ C", description: "B direncinin üst ucunu C direncinin üst ucuna bağlar." },
  5: { short: "A/B → C", description: "A-B birleşim noktasını C paralel kolunun girişine bağlar." },
  6: { short: "+ → B", description: "Kaynağın (+) ucunu B direncinin üst ucuna bağlar." },
  7: { short: "B → dönüş", description: "B direncinin üst ucunu ortak dönüş hattına bağlar." },
  8: { short: "+ → D", description: "Kaynağın (+) ucunu D direncinin üst ucuna bağlar." },
  9: { short: "D → −", description: "D direncinin üst ucunu kaynağın (−) ucuna bağlar." },
  10: { short: "C/D → −", description: "C-D ortak dönüş hattını kaynağın (−) ucuna bağlar." },
  11: { short: "B → C/D", description: "B direncinin alt ucunu C-D ortak hattına bağlar." },
};

const TASKS: CircuitTask[] = [
  {
    kind: "single-a",
    title: "A direnci",
    notation: "A",
    type: "single",
    purpose: "Tek dirençli devreyi referans ölçüm olarak çalıştır.",
    switches: [1, 2],
    components: ["A"],
  },
  {
    kind: "single-b",
    title: "B direnci",
    notation: "B",
    type: "single",
    purpose: "B direncini tek başına kaynağa bağla ve A ile karşılaştır.",
    switches: [6, 3, 2],
    components: ["B"],
  },
  {
    kind: "series-ab",
    title: "A-B seri",
    notation: "A — B",
    type: "series",
    purpose: "Akımın önce A, sonra B üzerinden geçtiği tek yolu tamamla.",
    switches: [1, 3, 7, 10],
    components: ["A", "B"],
  },
  {
    kind: "parallel-ac",
    title: "A-C paralel",
    notation: "A ∥ C",
    type: "parallel",
    purpose: "Akımı A ve C kollarına ayırıp çıkışta yeniden birleştir.",
    switches: [1, 2, 6, 4, 10],
    components: ["A", "C"],
  },
  {
    kind: "mixed-abcd",
    title: "Birleşik devre",
    notation: "A — (B ∥ C) — D",
    type: "mixed",
    purpose: "A ve D seri kalırken B-C arasında iki paralel akım yolu oluştur.",
    switches: [1, 3, 5, 7, 9],
    components: ["A", "B", "C", "D"],
  },
];

function equivalentResistance(kind: CircuitKind) {
  if (kind === "single-a") return RESISTORS.A;
  if (kind === "single-b") return RESISTORS.B;
  if (kind === "series-ab") return RESISTORS.A + RESISTORS.B;
  if (kind === "parallel-ac") {
    return (RESISTORS.A * RESISTORS.C) / (RESISTORS.A + RESISTORS.C);
  }
  return RESISTORS.A
    + (RESISTORS.B * RESISTORS.C) / (RESISTORS.B + RESISTORS.C)
    + RESISTORS.D;
}

function formatResistance(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

function ResistorModule({
  label,
  powered,
}: {
  label: keyof typeof RESISTORS;
  powered: boolean;
}) {
  return (
    <span className={`rc2-resistor rc2-resistor-${label.toLowerCase()} ${powered ? "powered" : ""}`}>
      <i className="rc2-lead lead-left" />
      <span className="rc2-resistor-body"><i /><i /><i /><i /></span>
      <i className="rc2-lead lead-right" />
      <b>{label}</b>
      <small>{RESISTORS[label]} Ω</small>
    </span>
  );
}

function SwitchControl({
  number,
  closed,
  highlighted,
  powered,
  onToggle,
}: SwitchControlProps) {
  const info = SWITCH_INFO[number];
  return (
    <button
      type="button"
      className={`rc2-inline-switch ${closed ? "closed" : "open"} ${highlighted ? "highlighted" : ""} ${powered ? "powered" : ""}`}
      onClick={() => onToggle(number)}
      aria-pressed={closed}
      aria-label={`Anahtar ${number}: ${info.description} Şu anda ${closed ? "kapalı" : "açık"}.`}
      data-testid={`resistor-switch-${number}`}
    >
      <span className="rc2-switch-number">S{number}</span>
      <span className="rc2-switch-mechanism" aria-hidden="true"><i /><i /><b /></span>
      <strong>{info.short}</strong>
      <small>{closed ? "BAĞLANTI TAMAM" : "BAĞLANTI AÇIK"}</small>
    </button>
  );
}

function Wire({ powered = false }: { powered?: boolean }) {
  return <i className={`rc2-route-wire ${powered ? "powered" : ""}`} aria-hidden="true" />;
}

function SourceTerminal({ sign }: { sign: "+" | "−" }) {
  return (
    <span className={`rc2-source-terminal ${sign === "+" ? "positive" : "negative"}`}>
      <i />
      <b>{sign}</b>
      <small>KAYNAK</small>
    </span>
  );
}

function CircuitRoute({
  task,
  closedSwitches,
  highlightedSwitch,
  powered,
  onToggle,
}: {
  task: CircuitTask;
  closedSwitches: number[];
  highlightedSwitch: number | null;
  powered: boolean;
  onToggle: (number: number) => void;
}) {
  const switchControl = (number: number) => (
    <SwitchControl
      number={number}
      closed={closedSwitches.includes(number)}
      highlighted={highlightedSwitch === number}
      powered={powered}
      onToggle={onToggle}
    />
  );
  const resistor = (label: keyof typeof RESISTORS) => (
    <ResistorModule label={label} powered={powered && task.components.includes(label)} />
  );

  if (task.kind === "single-a") {
    return (
      <div className="rc2-route rc2-route-linear">
        <SourceTerminal sign="+" /><Wire powered={powered} />{switchControl(1)}<Wire powered={powered} />
        {resistor("A")}<Wire powered={powered} />{switchControl(2)}<Wire powered={powered} /><SourceTerminal sign="−" />
      </div>
    );
  }

  if (task.kind === "single-b") {
    return (
      <div className="rc2-route rc2-route-linear rc2-route-four-switches">
        <SourceTerminal sign="+" /><Wire powered={powered} />{switchControl(6)}<Wire powered={powered} />
        {resistor("B")}<Wire powered={powered} />{switchControl(3)}<Wire powered={powered} />
        {switchControl(2)}<Wire powered={powered} /><SourceTerminal sign="−" />
      </div>
    );
  }

  if (task.kind === "series-ab") {
    return (
      <div className="rc2-route rc2-route-linear rc2-route-series">
        <SourceTerminal sign="+" /><Wire powered={powered} />{switchControl(1)}<Wire powered={powered} />
        {resistor("A")}<Wire powered={powered} />{switchControl(3)}<Wire powered={powered} />
        {resistor("B")}<Wire powered={powered} />{switchControl(7)}<Wire powered={powered} />
        {switchControl(10)}<Wire powered={powered} /><SourceTerminal sign="−" />
      </div>
    );
  }

  if (task.kind === "parallel-ac") {
    return (
      <div className="rc2-parallel-route">
        <SourceTerminal sign="+" />
        <span className={`rc2-junction ${powered ? "powered" : ""}`}><i /><b>AKIM AYRILIR</b></span>
        <div className="rc2-branches">
          <div className="rc2-branch"><span className="rc2-branch-name">A KOLU</span>{switchControl(1)}<Wire powered={powered} />{resistor("A")}<Wire powered={powered} />{switchControl(2)}</div>
          <div className="rc2-branch"><span className="rc2-branch-name">C KOLU</span>{switchControl(6)}<Wire powered={powered} />{switchControl(4)}<Wire powered={powered} />{resistor("C")}<Wire powered={powered} />{switchControl(10)}</div>
        </div>
        <span className={`rc2-junction ${powered ? "powered" : ""}`}><i /><b>AKIM BİRLEŞİR</b></span>
        <SourceTerminal sign="−" />
      </div>
    );
  }

  return (
    <div className="rc2-mixed-route">
      <div className="rc2-mixed-edge"><SourceTerminal sign="+" /><Wire powered={powered} />{switchControl(1)}<Wire powered={powered} />{resistor("A")}</div>
      <span className={`rc2-junction ${powered ? "powered" : ""}`}><i /><b>İKİ KOLA AYRILIR</b></span>
      <div className="rc2-branches rc2-mixed-branches">
        <div className="rc2-branch"><span className="rc2-branch-name">B KOLU</span>{switchControl(3)}<Wire powered={powered} />{resistor("B")}<Wire powered={powered} />{switchControl(7)}</div>
        <div className="rc2-branch"><span className="rc2-branch-name">C KOLU</span>{switchControl(5)}<Wire powered={powered} />{resistor("C")}</div>
      </div>
      <span className={`rc2-junction ${powered ? "powered" : ""}`}><i /><b>YENİDEN BİRLEŞİR</b></span>
      <div className="rc2-mixed-edge">{resistor("D")}<Wire powered={powered} />{switchControl(9)}<Wire powered={powered} /><SourceTerminal sign="−" /></div>
    </div>
  );
}

export default function ResistorConnectionsLab() {
  const [selectedTask, setSelectedTask] = useState<CircuitKind>("series-ab");
  const [closedSwitches, setClosedSwitches] = useState<number[]>([]);
  const [highlightedSwitch, setHighlightedSwitch] = useState<number | null>(1);
  const [lastTouchedSwitch, setLastTouchedSwitch] = useState<number | null>(null);
  const [voltage, setVoltage] = useState(9);
  const [powerOn, setPowerOn] = useState(false);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [prediction, setPrediction] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [notice, setNotice] = useState("S1 anahtarını bul: Kaynağın (+) ucunu A direncine bağlar.");

  const task = TASKS.find((item) => item.kind === selectedTask) ?? TASKS[0];
  const requiredSorted = [...task.switches].sort((a, b) => a - b);
  const closedSorted = [...closedSwitches].sort((a, b) => a - b);
  const circuitReady =
    requiredSorted.length === closedSorted.length
    && requiredSorted.every((value, index) => value === closedSorted[index]);
  const missingSwitches = task.switches.filter((number) => !closedSwitches.includes(number));
  const nextMissingSwitch = missingSwitches[0] ?? null;
  const equivalent = equivalentResistance(task.kind);
  const totalCurrentMilliamp = powerOn && circuitReady ? (voltage / equivalent) * 1000 : 0;
  const analysisReady =
    trials.some((trial) => trial.type === "series")
    && trials.some((trial) => trial.type === "parallel")
    && trials.some((trial) => trial.type === "mixed");

  const latestTrials = useMemo(
    () => TASKS.map((item) => ({
      task: item,
      trial: [...trials].reverse().find((trial) => trial.task === item.kind) ?? null,
    })),
    [trials],
  );

  const selectTask = (kind: CircuitKind) => {
    if (powerOn) {
      setNotice("Önce güç kaynağını kapat, ardından devreyi değiştir.");
      return;
    }
    const selected = TASKS.find((item) => item.kind === kind) ?? TASKS[0];
    setSelectedTask(kind);
    setClosedSwitches([]);
    setLastTouchedSwitch(null);
    setHighlightedSwitch(selected.switches[0]);
    setShowAnalysis(false);
    setNotice(`Önce S${selected.switches[0]}: ${SWITCH_INFO[selected.switches[0]].description}`);
  };

  const toggleSwitch = (number: number) => {
    if (powerOn) {
      setNotice("Akım varken bağlantı değiştirilmez. Önce güç kaynağını kapat.");
      return;
    }
    const isClosed = closedSwitches.includes(number);
    const next = isClosed
      ? closedSwitches.filter((item) => item !== number)
      : [...closedSwitches, number];
    setClosedSwitches(next);
    setLastTouchedSwitch(number);
    const remaining = task.switches.filter((item) => !next.includes(item));
    setHighlightedSwitch(remaining[0] ?? null);
    if (isClosed) {
      setNotice(`S${number} açıldı. ${SWITCH_INFO[number].description}`);
    } else if (remaining.length) {
      setNotice(`S${number} kapandı. Sıradaki S${remaining[0]}: ${SWITCH_INFO[remaining[0]].description}`);
    } else {
      setNotice("Akım yolu tamamlandı. Artık güç kaynağını çalıştırabilirsin.");
    }
  };

  const showNextConnection = () => {
    if (nextMissingSwitch === null) {
      setNotice("Bütün bağlantılar tamam. Güç kaynağını çalıştırabilirsin.");
      return;
    }
    setHighlightedSwitch(nextMissingSwitch);
    setNotice(`Panoda S${nextMissingSwitch} parlıyor: ${SWITCH_INFO[nextMissingSwitch].description}`);
  };

  const resetConnections = () => {
    if (powerOn) return;
    setClosedSwitches([]);
    setLastTouchedSwitch(null);
    setHighlightedSwitch(task.switches[0]);
    setNotice(`Bağlantılar açıldı. S${task.switches[0]} ile başla: ${SWITCH_INFO[task.switches[0]].description}`);
  };

  const togglePower = () => {
    if (!circuitReady) {
      setHighlightedSwitch(nextMissingSwitch);
      setNotice(nextMissingSwitch === null
        ? "Devre bağlantılarını kontrol et."
        : `Devre henüz açık. S${nextMissingSwitch} eksik: ${SWITCH_INFO[nextMissingSwitch].description}`);
      return;
    }
    setPowerOn((current) => !current);
    setNotice(powerOn
      ? "Güç kaynağı kapatıldı; bağlantılar yeniden düzenlenebilir."
      : "Devre çalışıyor. Yeşil yol, akımın geçtiği bağlantıları gösteriyor.");
  };

  const currentNote = () => {
    if (task.kind === "parallel-ac") {
      return `A kolu ${(voltage / RESISTORS.A * 1000).toFixed(1)} mA · C kolu ${(voltage / RESISTORS.C * 1000).toFixed(1)} mA`;
    }
    if (task.kind === "mixed-abcd") {
      const branchEquivalent = (RESISTORS.B * RESISTORS.C) / (RESISTORS.B + RESISTORS.C);
      const branchVoltage = totalCurrentMilliamp / 1000 * branchEquivalent;
      return `B kolu ${(branchVoltage / RESISTORS.B * 1000).toFixed(1)} mA · C kolu ${(branchVoltage / RESISTORS.C * 1000).toFixed(1)} mA`;
    }
    return `${totalCurrentMilliamp.toFixed(1)} mA tek akım yolu`;
  };

  const recordTrial = () => {
    if (!powerOn || !circuitReady) {
      setNotice("Ölçüm kaydı için devreyi tamamla ve güç kaynağını çalıştır.");
      return;
    }
    const trial: Trial = {
      id: `${task.kind}-${voltage}`,
      task: task.kind,
      type: task.type,
      title: task.title,
      voltage,
      equivalentResistance: equivalent,
      totalCurrentMilliamp,
      currentNote: currentNote(),
    };
    setTrials((current) => [...current.filter((item) => item.id !== trial.id), trial]);
    setNotice(`${task.title} ölçümü kaydedildi: ${formatResistance(equivalent)} Ω, ${totalCurrentMilliamp.toFixed(1)} mA.`);
  };

  const inspectorSwitch = lastTouchedSwitch ?? highlightedSwitch ?? task.switches[0];

  return (
    <section className="resistor-connections-lab rc2-lab" id="direnc-baglantilari-deneyi">
      <header className="rc2-hero">
        <div>
          <span>ELEKTRİK · DENEY 2 · FİZ.10.3.4</span>
          <h1>Bağlantıyı gör, devreyi tamamla.</h1>
          <p>
            Her anahtar doğrudan bağladığı iki noktanın üzerinde. Anahtarı kapat,
            akım yolunu izle ve seri-paralel bağlantıların sonucunu ölç.
          </p>
        </div>
        <aside><i>11</i><span><b>ANAHTARLI DENEY PANOSU</b><small>Görevde yalnız kullanılan bağlantılar gösterilir.</small></span></aside>
      </header>

      <div className="rc2-prediction">
        <span><small>DENEY ÖNCESİ TAHMİN</small><b>Paralel bağlantının eşdeğer direnci neden azalabilir?</b></span>
        <input value={prediction} onChange={(event) => setPrediction(event.target.value)} placeholder="Tahminini buraya yaz…" />
      </div>

      <section className="rc2-task-picker">
        <div className="rc2-section-heading"><span>1 · DEVREYİ SEÇ</span><h2>Bağlantıları tek bir büyük akım yolu üzerinde incele.</h2></div>
        <div className="rc2-task-tabs">
          {TASKS.map((item, index) => (
            <button type="button" className={task.kind === item.kind ? "active" : ""} onClick={() => selectTask(item.kind)} aria-pressed={task.kind === item.kind} key={item.kind}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{item.title}</b>
              <strong>{item.notation}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="rc2-workspace">
        <aside className="rc2-guide-card">
          <span className="rc2-eyebrow">BAĞLANTI REHBERİ</span>
          <h2>{task.title}</h2>
          <strong>{task.notation}</strong>
          <p>{task.purpose}</p>
          <div className="rc2-connection-list">
            {task.switches.map((number, index) => {
              const closed = closedSwitches.includes(number);
              return (
                <button type="button" className={`${closed ? "done" : ""} ${highlightedSwitch === number ? "next" : ""}`} onClick={() => setHighlightedSwitch(number)} key={number}>
                  <i>{closed ? "✓" : index + 1}</i>
                  <span><b>S{number} · {SWITCH_INFO[number].short}</b><small>{SWITCH_INFO[number].description}</small></span>
                </button>
              );
            })}
          </div>
          <button type="button" className="rc2-find-next" onClick={showNextConnection}>{nextMissingSwitch === null ? "Bağlantılar tamam" : "Sıradaki anahtarı göster"}</button>
          <button type="button" className="rc2-reset-links" onClick={resetConnections} disabled={powerOn}>Tüm bağlantıları aç</button>
        </aside>

        <section className="rc2-stage">
          <div className="rc2-stage-topbar">
            <span><small>LABORATUVAR TEZGÂHI</small><b>{task.notation}</b></span>
            <strong className={circuitReady ? "ready" : ""}>{circuitReady ? "Devre tamam" : `${closedSwitches.length}/${task.switches.length} bağlantı`}</strong>
          </div>

          <div className="rc2-instruction" role="status">
            <i>{circuitReady ? "✓" : "i"}</i>
            <span><small>{circuitReady ? "AKIM YOLU HAZIR" : `ANAHTAR ${inspectorSwitch}`}</small><b>{notice}</b></span>
          </div>

          <div className="rc2-workbench">
            <div className="rc2-wall"><i /><i /></div>
            <div className="rc2-table"><i /><i /></div>

            <div className={`rc2-power-supply ${powerOn ? "on" : ""}`}>
              <div className="rc2-device-handle" />
              <small>DC GÜÇ KAYNAĞI</small>
              <div className="rc2-power-display"><b>{powerOn ? voltage.toFixed(1) : "0.0"}</b><em>V</em></div>
              <div className="rc2-power-controls"><span><i />GERİLİM</span><span><i />AKIM</span></div>
              <div className="rc2-power-terminals"><span className="positive">+</span><span className="negative">−</span></div>
              <button type="button" onClick={togglePower}>{powerOn ? "GÜCÜ KAPAT" : "DEVREYİ ÇALIŞTIR"}</button>
            </div>

            <div className={`rc2-main-board ${powerOn ? "powered" : ""}`}>
              <div className="rc2-board-header"><span><b>BAĞLANTI PANOSU</b><small>{task.title}</small></span><em>Her şalter bağladığı iki noktayı yazar</em></div>
              <div className="rc2-circuit-window">
                <CircuitRoute task={task} closedSwitches={closedSwitches} highlightedSwitch={highlightedSwitch} powered={powerOn && circuitReady} onToggle={toggleSwitch} />
              </div>
              <div className="rc2-board-legend"><span><i className="open" />Açık bağlantı</span><span><i className="closed" />Kapalı bağlantı</span><span><i className="flow" />Akım geçen yol</span></div>
            </div>

            <div className="rc2-cable red" /><div className="rc2-cable blue" />

            <div className={`rc2-digital-meter amp ${powerOn ? "on" : ""}`}>
              <small>TOPLAM AKIM</small><b>{totalCurrentMilliamp.toFixed(1)}</b><em>mA</em><span>A</span>
            </div>
            <div className={`rc2-digital-meter volt ${powerOn ? "on" : ""}`}>
              <small>KAYNAK GERİLİMİ</small><b>{powerOn ? voltage.toFixed(2) : "0.00"}</b><em>V</em><span>V</span>
            </div>
          </div>

          <div className="rc2-controls">
            <label><span>Kaynak gerilimi</span><select value={voltage} onChange={(event) => setVoltage(Number(event.target.value))} disabled={powerOn}><option value={6}>6 V</option><option value={9}>9 V</option><option value={12}>12 V</option></select></label>
            <span><small>Eşdeğer direnç</small><b>{powerOn ? `${formatResistance(equivalent)} Ω` : "Devreyi çalıştır"}</b></span>
            <span><small>Toplam akım</small><b>{powerOn ? `${totalCurrentMilliamp.toFixed(1)} mA` : "—"}</b></span>
            <button type="button" onClick={recordTrial} disabled={!powerOn}>Ölçümü tabloya kaydet</button>
          </div>
        </section>
      </div>

      <section className="rc2-data-section">
        <div className="rc2-data-heading"><div><span>2 · ÖLÇÜMLERİ KARŞILAŞTIR</span><h2>Bağlantı türü değiştiğinde eşdeğer direnç nasıl değişti?</h2></div><b>{trials.length}<small>kayıt</small></b></div>
        <div className="rc2-data-grid">
          <article className="rc2-table-card">
            <div><b>İdeal ölçüm tablosu</b><span>Doğrudan deney verisi</span></div>
            <div className="rc2-table-wrap"><table><thead><tr><th>Devre</th><th>Gerilim</th><th>R eş</th><th>I toplam</th><th>Akım yolu</th></tr></thead><tbody>
              {trials.length ? trials.map((trial) => <tr key={trial.id}><th>{trial.title}</th><td>{trial.voltage} V</td><td>{formatResistance(trial.equivalentResistance)} Ω</td><td>{trial.totalCurrentMilliamp.toFixed(1)} mA</td><td>{trial.currentNote}</td></tr>) : <tr><td colSpan={5}>Bir devreyi tamamla, çalıştır ve ilk ölçümü kaydet.</td></tr>}
            </tbody></table></div>
          </article>
          <article className="rc2-comparison-card">
            <div><b>Eşdeğer direnç görünümü</b><span>Aynı ölçekte</span></div>
            <div className="rc2-comparison-bars">
              {latestTrials.map(({ task: item, trial }) => <div key={item.kind}><span><b>{item.notation}</b><small>{trial ? `${formatResistance(trial.equivalentResistance)} Ω` : "ölçülmedi"}</small></span><i><b style={{ width: trial ? `${Math.max(5, trial.equivalentResistance / 6)}%` : "0%" }} /></i></div>)}
            </div>
          </article>
        </div>
      </section>

      <section className="rc2-analysis-gate">
        <div><span>3 · SONUCU AÇIKLA</span><h2>Ölçümden matematiksel modele geç.</h2><p>{analysisReady ? "Seri, paralel ve birleşik devre kayıtların hazır." : "Analizi açmak için seri, paralel ve birleşik devreden birer ölçüm kaydet."}</p></div>
        <button type="button" disabled={!analysisReady} onClick={() => setShowAnalysis((current) => !current)}>{showAnalysis ? "Analizi kapat" : "İşlemsel analizi göster"} →</button>
      </section>

      {showAnalysis && analysisReady && <section className="rc2-analysis-cards">
        <article><span>SERİ BAĞLANTI</span><b>R<sub>eş</sub> = R<sub>1</sub> + R<sub>2</sub></b><p>Akım tek bir yol izler. Eşdeğer direnç, devredeki her bir dirençten büyüktür.</p></article>
        <article><span>PARALEL BAĞLANTI</span><b>1/R<sub>eş</sub> = 1/R<sub>1</sub> + 1/R<sub>2</sub></b><p>Akım kollara ayrılır. Eşdeğer direnç, paralel kollardaki en küçük dirençten küçüktür.</p></article>
        <article><span>BİRLEŞİK DEVRE</span><b>Önce paralel kol, sonra seri toplam</b><p>B-C paralel kolunu tek eşdeğer dirence dönüştür; ardından A ve D ile seri topla.</p></article>
      </section>}

      <section className="rc2-report">
        <div className="rc2-report-heading"><span>TYMM · KISA DENEY RAPORU</span><h2>Devreyi değil, kanıtını anlat.</h2><p>Yanıtlarında kendi ölçüm tablonu ve akım yolu görüntüsünü kullan.</p></div>
        <div className="rc2-report-grid">
          <label><span>1 · AKIM YOLU</span>Seri devrede akım hangi sırayla hangi dirençlerden geçti?<textarea rows={4} /></label>
          <label><span>2 · PARALEL KOLLAR</span>A-C paralel devresinde akım neden iki farklı değere ayrıldı?<textarea rows={4} /></label>
          <label><span>3 · EŞDEĞER DİRENÇ</span>Seri ve paralel bağlantıların eşdeğer dirençlerini veriye göre karşılaştır.<textarea rows={4} /></label>
          <label><span>4 · BİRLEŞİK DEVRE</span>A-(B∥C)-D devresini eşdeğer dirence dönüştürürken hangi sırayı izledin?<textarea rows={4} /></label>
        </div>
        <label className="rc2-report-conclusion"><span>SONUÇ</span>Bağlantı biçiminin toplam akım üzerindeki etkisini ölçümlerine dayanarak açıkla.<textarea rows={5} /></label>
      </section>
    </section>
  );
}
