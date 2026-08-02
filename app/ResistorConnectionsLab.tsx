"use client";

import {
  type DragEvent as ReactDragEvent,
  useMemo,
  useState,
} from "react";

type EquipmentKind =
  | "power-supply"
  | "switch-board"
  | "resistor-set"
  | "ammeter"
  | "voltmeter";
type CircuitKind =
  | "single-a"
  | "single-b"
  | "series-ab"
  | "parallel-ac"
  | "mixed-abc";
type CircuitTask = {
  kind: CircuitKind;
  title: string;
  notation: string;
  description: string;
  switches: number[];
  type: "single" | "series" | "parallel" | "mixed";
};
type Trial = {
  id: string;
  task: CircuitKind;
  title: string;
  type: CircuitTask["type"];
  voltage: number;
  equivalentResistance: number;
  totalCurrentMilliamp: number;
  observation: string;
};

const MIME = "application/x-resistor-connections-equipment";
const RESISTORS = { A: 100, B: 150, C: 220, D: 330 } as const;
const EQUIPMENT: Array<{
  kind: EquipmentKind;
  name: string;
  detail: string;
}> = [
  { kind: "power-supply", name: "0-12 V güç kaynağı", detail: "Devreye ideal doğru gerilim uygular" },
  { kind: "switch-board", name: "1-11 anahtarlı devre panosu", detail: "Akım yolunu anahtarlarla oluşturur" },
  { kind: "resistor-set", name: "A-B-C-D direnç takımı", detail: "100, 150, 220 ve 330 Ω modüller" },
  { kind: "ammeter", name: "Dijital ampermetre", detail: "Devrenin toplam akımını gösterir" },
  { kind: "voltmeter", name: "Dijital voltmetre", detail: "Kaynak gerilimini gösterir" },
];

const TASKS: CircuitTask[] = [
  {
    kind: "single-a",
    title: "Yalnız A direnci",
    notation: "A",
    description: "Tek dirençli devreyi referans ölçüm olarak kur.",
    switches: [1, 2],
    type: "single",
  },
  {
    kind: "single-b",
    title: "Yalnız B direnci",
    notation: "B",
    description: "İkinci tekli devreyi kur ve A ile karşılaştır.",
    switches: [2, 3, 6],
    type: "single",
  },
  {
    kind: "series-ab",
    title: "A ve B seri",
    notation: "A — B",
    description: "Akımın A ve B üzerinden art arda geçtiği yolu oluştur.",
    switches: [1, 3, 7, 10],
    type: "series",
  },
  {
    kind: "parallel-ac",
    title: "A ve C paralel",
    notation: "A ∥ C",
    description: "A ve C için iki ayrı kol oluşturup yeniden birleştir.",
    switches: [1, 2, 4, 6, 10],
    type: "parallel",
  },
  {
    kind: "mixed-abc",
    title: "A seri, B-C paralel",
    notation: "A — (B ∥ C)",
    description: "Önce A, ardından B ve C’nin paralel kollarını kullan.",
    switches: [1, 4, 5, 7, 8, 10],
    type: "mixed",
  },
];

function equivalentResistance(kind: CircuitKind) {
  if (kind === "single-a") return RESISTORS.A;
  if (kind === "single-b") return RESISTORS.B;
  if (kind === "series-ab") return RESISTORS.A + RESISTORS.B;
  if (kind === "parallel-ac") {
    return (RESISTORS.A * RESISTORS.C) / (RESISTORS.A + RESISTORS.C);
  }
  return RESISTORS.A + (RESISTORS.B * RESISTORS.C) / (RESISTORS.B + RESISTORS.C);
}

function formatResistance(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

function EquipmentIcon({ kind }: { kind: EquipmentKind }) {
  return (
    <span className={`rcl-equipment-icon rcl-icon-${kind}`} aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

function CircuitSchematic({ task, powered }: { task: CircuitTask; powered: boolean }) {
  const resistor = (label: keyof typeof RESISTORS) => (
    <span className={`rcl-schematic-resistor resistor-${label.toLowerCase()}`}>
      <i />
      <b>{label}</b>
      <small>{RESISTORS[label]} Ω</small>
    </span>
  );

  return (
    <div className={`rcl-schematic rcl-layout-${task.type} ${powered ? "powered" : ""}`}>
      <span className="rcl-source-symbol"><i /><b>+</b><em>-</em></span>
      <i className="rcl-wire wire-entry" />
      <div className="rcl-schematic-content">
        {task.kind === "single-a" && resistor("A")}
        {task.kind === "single-b" && resistor("B")}
        {task.kind === "series-ab" && <>{resistor("A")}<i className="between" />{resistor("B")}</>}
        {task.kind === "parallel-ac" && (
          <div className="rcl-parallel-branches">
            <span>{resistor("A")}</span>
            <span>{resistor("C")}</span>
          </div>
        )}
        {task.kind === "mixed-abc" && (
          <>
            {resistor("A")}
            <i className="between" />
            <div className="rcl-parallel-branches">
              <span>{resistor("B")}</span>
              <span>{resistor("C")}</span>
            </div>
          </>
        )}
      </div>
      <i className="rcl-wire wire-return" />
      {powered && <span className="rcl-current-pulse"><i /><i /><i /></span>}
    </div>
  );
}

export default function ResistorConnectionsLab() {
  const [installed, setInstalled] = useState<EquipmentKind[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CircuitKind>("series-ab");
  const [closedSwitches, setClosedSwitches] = useState<number[]>([]);
  const [voltage, setVoltage] = useState(9);
  const [powerOn, setPowerOn] = useState(false);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [prediction, setPrediction] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [notice, setNotice] = useState("Önce güç kaynağını deney tezgâhına yerleştir.");

  const task = TASKS.find((item) => item.kind === selectedTask) ?? TASKS[0];
  const allInstalled = installed.length === EQUIPMENT.length;
  const closedSorted = [...closedSwitches].sort((a, b) => a - b);
  const requiredSorted = [...task.switches].sort((a, b) => a - b);
  const circuitCorrect =
    closedSorted.length === requiredSorted.length &&
    closedSorted.every((value, index) => value === requiredSorted[index]);
  const equivalent = equivalentResistance(task.kind);
  const totalCurrentMilliamp = powerOn && circuitCorrect ? (voltage / equivalent) * 1000 : 0;
  const analysisReady =
    trials.some((trial) => trial.type === "series") &&
    trials.some((trial) => trial.type === "parallel") &&
    trials.some((trial) => trial.type === "mixed");

  const resultByTask = useMemo(
    () => TASKS.map((item) => ({
      task: item,
      trial: [...trials].reverse().find((trial) => trial.task === item.kind) ?? null,
    })),
    [trials],
  );

  const install = (kind: EquipmentKind) => {
    if (installed.includes(kind)) return;
    const nextInstalled = [...installed, kind];
    setInstalled(nextInstalled);
    const next = EQUIPMENT.find((item) => !nextInstalled.includes(item.kind));
    setNotice(
      next
        ? `${EQUIPMENT.find((item) => item.kind === kind)?.name} yerleştirildi. Sıradaki: ${next.name}.`
        : `Düzenek tamamlandı. ${task.title} için gerekli anahtarları kapat.`,
    );
  };

  const onDragStart = (event: ReactDragEvent<HTMLButtonElement>, kind: EquipmentKind) => {
    event.dataTransfer.setData(MIME, kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const kind = event.dataTransfer.getData(MIME) as EquipmentKind;
    if (EQUIPMENT.some((item) => item.kind === kind)) install(kind);
  };

  const selectTask = (kind: CircuitKind) => {
    if (powerOn) {
      setNotice("Devre türünü değiştirmeden önce güç kaynağını kapat.");
      return;
    }
    const nextTask = TASKS.find((item) => item.kind === kind) ?? TASKS[0];
    setSelectedTask(kind);
    setClosedSwitches([]);
    setShowAnalysis(false);
    setNotice(`${nextTask.title} seçildi. Hedef anahtarlar: ${nextTask.switches.join(", ")}.`);
  };

  const toggleSwitch = (switchNumber: number) => {
    if (!installed.includes("switch-board") || powerOn) return;
    setClosedSwitches((current) =>
      current.includes(switchNumber)
        ? current.filter((value) => value !== switchNumber)
        : [...current, switchNumber],
    );
  };

  const setGuidedSwitches = () => {
    if (!allInstalled) {
      setNotice("Önce tüm malzemeleri deney tezgâhına yerleştir.");
      return;
    }
    setClosedSwitches([...task.switches]);
    setNotice(`${task.switches.join(", ")} numaralı anahtarlar kapatıldı. Devre çalıştırılabilir.`);
  };

  const togglePower = () => {
    if (!allInstalled || !circuitCorrect) {
      setNotice(`Güç vermeden önce yalnızca ${task.switches.join(", ")} numaralı anahtarları kapat.`);
      return;
    }
    setPowerOn((current) => !current);
    setNotice(powerOn ? "Güç kaynağı kapatıldı." : "Devre çalışıyor; ölçüm cihazları ideal değerleri gösteriyor.");
  };

  const observationForTask = () => {
    if (task.type === "series") {
      return `A ve B üzerinden ${totalCurrentMilliamp.toFixed(1)} mA geçer`;
    }
    if (task.type === "parallel") {
      return `A: ${(voltage / RESISTORS.A * 1000).toFixed(1)} mA · C: ${(voltage / RESISTORS.C * 1000).toFixed(1)} mA`;
    }
    if (task.type === "mixed") {
      const branchVoltage = voltage - totalCurrentMilliamp / 1000 * RESISTORS.A;
      return `B: ${(branchVoltage / RESISTORS.B * 1000).toFixed(1)} mA · C: ${(branchVoltage / RESISTORS.C * 1000).toFixed(1)} mA`;
    }
    return `${totalCurrentMilliamp.toFixed(1)} mA tek akım yolu`;
  };

  const recordTrial = () => {
    if (!powerOn || !circuitCorrect) {
      setNotice("Kayıt için doğru anahtarları kapatıp devreyi çalıştır.");
      return;
    }
    const trial: Trial = {
      id: `${task.kind}-${voltage}`,
      task: task.kind,
      title: task.title,
      type: task.type,
      voltage,
      equivalentResistance: equivalent,
      totalCurrentMilliamp,
      observation: observationForTask(),
    };
    setTrials((current) => [
      ...current.filter((item) => item.id !== trial.id),
      trial,
    ]);
    setNotice(`${task.title}: ${formatResistance(equivalent)} Ω ve ${totalCurrentMilliamp.toFixed(1)} mA kaydedildi.`);
  };

  const resetExperiment = () => {
    setInstalled([]);
    setSelectedTask("series-ab");
    setClosedSwitches([]);
    setVoltage(9);
    setPowerOn(false);
    setTrials([]);
    setPrediction("");
    setShowAnalysis(false);
    setNotice("Önce güç kaynağını deney tezgâhına yerleştir.");
  };

  return (
    <section className="resistor-connections-lab" id="direnc-baglantilari-deneyi">
      <div className="rcl-heading">
        <div>
          <span>ELEKTRİK · DENEY 2 · FİZ.10.3.4</span>
          <h1>Anahtarları seç, eşdeğer direnci keşfet.</h1>
          <p>
            A-B-C-D direnç panosunda tekli, seri, paralel ve birleşik devreler
            kur; aynı düzenekte ideal ölçümleri karşılaştır.
          </p>
        </div>
        <aside>
          <b>İDEAL SİSTEM</b>
          <span>11 anahtarlı deney panosu</span>
          <small>Seri · paralel · birleşik</small>
        </aside>
      </div>

      <div className="rcl-prediction">
        <span>
          <small>ÖNCE TAHMİN ET</small>
          <b>İki direnç seri ve paralel bağlandığında eşdeğer direnç nasıl değişir?</b>
        </span>
        <input value={prediction} onChange={(event) => setPrediction(event.target.value)} placeholder="Tahminini yaz…" />
      </div>

      <section className="rcl-task-selector">
        <div className="rcl-section-heading">
          <span>1 · HEDEF DEVREYİ SEÇ</span>
          <h2>Aynı panoda beş farklı akım yolu</h2>
        </div>
        <div className="rcl-task-grid">
          {TASKS.map((item, index) => (
            <button
              type="button"
              className={task.kind === item.kind ? "active" : ""}
              onClick={() => selectTask(item.kind)}
              aria-pressed={task.kind === item.kind}
              key={item.kind}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item.title}</b>
              <strong>{item.notation}</strong>
              <small>{item.switches.join(" · ")} anahtarları</small>
            </button>
          ))}
        </div>
      </section>

      <div className="rcl-builder">
        <aside className="rcl-equipment-panel">
          <div>
            <span>MALZEME RAFI</span>
            <b>Sürükle veya dokun</b>
          </div>
          {EQUIPMENT.map((item) => (
            <button
              type="button"
              draggable={!installed.includes(item.kind)}
              disabled={installed.includes(item.kind)}
              className={installed.includes(item.kind) ? "installed" : ""}
              onClick={() => install(item.kind)}
              onDragStart={(event) => onDragStart(event, item.kind)}
              key={item.kind}
            >
              <EquipmentIcon kind={item.kind} />
              <span><b>{item.name}</b><small>{installed.includes(item.kind) ? "Tezgâhta" : item.detail}</small></span>
            </button>
          ))}
          <button type="button" className="rcl-reset" onClick={resetExperiment}>Deneyi baştan kur</button>
        </aside>

        <div
          className={`rcl-stage ${dragOver ? "drag-over" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="rcl-stage-toolbar">
            <span><small>DÜZENEK</small><b>{allInstalled ? task.title : "Kurulum bekleniyor"}</b></span>
            <strong className={allInstalled ? "ready" : ""}>{installed.length}/{EQUIPMENT.length} araç</strong>
          </div>
          <div className="rcl-notice" role="status"><i>{circuitCorrect ? "✓" : "!"}</i><span>{notice}</span></div>

          <div className="rcl-switch-guide">
            <div>
              <span>BU DEVRE İÇİN KAPAT</span>
              <b>{task.switches.join(" · ")}</b>
              <small>{task.description}</small>
            </div>
            <button type="button" onClick={setGuidedSwitches} disabled={!allInstalled || powerOn}>
              Gerekli anahtarları kapat
            </button>
          </div>

          <div className="rcl-apparatus">
            <div className="rcl-wall" />
            <div className="rcl-bench"><i /><i /></div>

            {installed.includes("power-supply") && (
              <div className={`rcl-power ${powerOn ? "on" : ""}`}>
                <small>DC GÜÇ KAYNAĞI</small>
                <b>{powerOn ? voltage.toFixed(1) : "0.0"}<em>V</em></b>
                <button type="button" onClick={togglePower}>{powerOn ? "KAPAT" : "ÇALIŞTIR"}</button>
              </div>
            )}

            {installed.includes("switch-board") && (
              <div className="rcl-switch-board">
                <div className="rcl-board-label"><span>ANAHTARLI DİRENÇ PANOSU</span><b>A · B · C · D</b></div>
                <CircuitSchematic task={task} powered={powerOn && circuitCorrect} />
                <div className="rcl-switch-grid">
                  {Array.from({ length: 11 }, (_, index) => index + 1).map((number) => {
                    const required = task.switches.includes(number);
                    const closed = closedSwitches.includes(number);
                    const wrong = closed && !required;
                    return (
                      <button
                        type="button"
                        className={`${required ? "required" : ""} ${closed ? "closed" : ""} ${wrong ? "wrong" : ""}`}
                        onClick={() => toggleSwitch(number)}
                        disabled={powerOn}
                        aria-pressed={closed}
                        aria-label={`${number}. anahtar, ${closed ? "kapalı" : "açık"}${required ? ", hedef devrede gerekli" : ""}`}
                        key={number}
                      >
                        <span><i /></span><b>{number}</b>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {installed.includes("resistor-set") && (
              <div className="rcl-resistor-rack">
                <small>DİRENÇ MODÜLLERİ</small>
                {(Object.entries(RESISTORS) as Array<[keyof typeof RESISTORS, number]>).map(([label, value]) => (
                  <span key={label}><i /><b>{label}</b><em>{value} Ω</em></span>
                ))}
              </div>
            )}

            {installed.includes("ammeter") && (
              <div className={`rcl-meter rcl-ammeter ${powerOn ? "active" : ""}`}>
                <small>DC AMPERMETRE</small><b>{totalCurrentMilliamp.toFixed(1)}</b><em>mA</em>
              </div>
            )}
            {installed.includes("voltmeter") && (
              <div className={`rcl-meter rcl-voltmeter ${powerOn ? "active" : ""}`}>
                <small>DC VOLTMETRE</small><b>{powerOn ? voltage.toFixed(2) : "0.00"}</b><em>V</em>
              </div>
            )}

            {!installed.length && (
              <div className="rcl-empty-stage"><i>＋</i><b>Malzemeleri bu tezgâha yerleştir</b></div>
            )}
          </div>

          <div className="rcl-switch-status">
            <span><small>Kapatılan</small><b>{closedSorted.length ? closedSorted.join(", ") : "—"}</b></span>
            <span><small>Gerekli</small><b>{requiredSorted.join(", ")}</b></span>
            <span className={circuitCorrect ? "correct" : ""}><small>Devre sonucu</small><b>{circuitCorrect ? "Doğru yol" : "Anahtarları düzelt"}</b></span>
          </div>
        </div>
      </div>

      <section className="rcl-measurement-panel">
        <div className="rcl-section-heading">
          <span>2 · ÇALIŞTIR VE ÖLÇ</span>
          <h2>Gerilim, eşdeğer direnç ve toplam akım</h2>
        </div>
        <div className="rcl-measurement-grid">
          <label>
            <small>Kaynak gerilimi</small>
            <select value={voltage} onChange={(event) => setVoltage(Number(event.target.value))} disabled={powerOn}>
              <option value={6}>6 V</option><option value={9}>9 V</option><option value={12}>12 V</option>
            </select>
          </label>
          <span><small>Seçilen devre</small><b>{task.notation}</b></span>
          <span><small>Eşdeğer direnç</small><b>{powerOn ? `${formatResistance(equivalent)} Ω` : "—"}</b></span>
          <span><small>Toplam akım</small><b>{powerOn ? `${totalCurrentMilliamp.toFixed(1)} mA` : "—"}</b></span>
          <button type="button" onClick={recordTrial} disabled={!powerOn}>Ölçümü kaydet</button>
        </div>
      </section>

      <section className="rcl-evidence">
        <div className="rcl-evidence-heading">
          <div><span>CANLI DENEY KANITLARI</span><h2>Aynı gerilimde bağlantı türlerini karşılaştır.</h2></div>
          <b>{trials.length}<small>kayıt</small></b>
        </div>
        <div className="rcl-evidence-grid">
          <article className="rcl-table-card">
            <div className="rcl-card-heading"><b>Ölçüm tablosu</b><span>İdeal değerler</span></div>
            <div className="rcl-table-wrap">
              <table>
                <thead><tr><th>Devre</th><th>V</th><th>R eş</th><th>I toplam</th><th>Akım gözlemi</th></tr></thead>
                <tbody>
                  {trials.length ? trials.map((trial) => (
                    <tr key={trial.id}><th>{trial.title}</th><td>{trial.voltage} V</td><td>{formatResistance(trial.equivalentResistance)} Ω</td><td>{trial.totalCurrentMilliamp.toFixed(1)} mA</td><td>{trial.observation}</td></tr>
                  )) : <tr><td colSpan={5}>İlk doğru devreyi çalıştırıp ölçümü kaydet.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>
          <article className="rcl-bars-card">
            <div className="rcl-card-heading"><b>Eşdeğer direnç karşılaştırması</b><span>Son kayıtlar</span></div>
            <div className="rcl-resistance-bars">
              {resultByTask.map(({ task: item, trial }) => (
                <div key={item.kind}>
                  <span><b>{item.notation}</b><small>{trial ? `${formatResistance(trial.equivalentResistance)} Ω` : "ölçülmedi"}</small></span>
                  <i><b style={{ width: trial ? `${Math.max(3, trial.equivalentResistance / 2.5)}%` : "0%" }} /></i>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="rcl-analysis-prompt">
        <div><span>3 · ÖRÜNTÜYÜ AÇIKLA</span><h2>Bağlantı biçiminden matematiksel modele</h2><p>{analysisReady ? "Seri, paralel ve birleşik kayıtların analize hazır." : "Analiz için en az bir seri, bir paralel ve bir birleşik devre ölç."}</p></div>
        <button type="button" disabled={!analysisReady} onClick={() => setShowAnalysis((current) => !current)}>{showAnalysis ? "Analizi kapat" : "İşlemsel analizi göster"} →</button>
      </section>

      {showAnalysis && analysisReady && (
        <section className="rcl-analysis">
          <article><span>SERİ</span><b>R<sub>eş</sub> = R<sub>1</sub> + R<sub>2</sub></b><p>Akım tek yoldan geçer; eşdeğer direnç her bir dirençten büyüktür.</p></article>
          <article><span>PARALEL</span><b>1/R<sub>eş</sub> = 1/R<sub>1</sub> + 1/R<sub>2</sub></b><p>Akım için birden fazla kol oluşur; eşdeğer direnç en küçük dirençten küçüktür.</p></article>
          <article><span>BİRLEŞİK</span><b>Devreyi aşamalarla sadeleştir</b><p>Önce paralel B-C kolunu tek eşdeğere dönüştür, sonra A ile seri düşün.</p></article>
        </section>
      )}

      <section className="rcl-report">
        <div className="rcl-report-heading"><span>TYMM · KISA DENEY RAPORU</span><h2>Çıkarımını ölçümlerinden oluştur.</h2><p>Yanıtlarında tablo ve direnç karşılaştırma çubuklarını kullan.</p></div>
        <div className="rcl-report-grid">
          <label><span>1 · SERİ BAĞLAMA</span>A ve B seri bağlandığında eşdeğer direnç neden her ikisinden büyük oldu?<textarea rows={4} /></label>
          <label><span>2 · PARALEL BAĞLAMA</span>A ve C paralel bağlandığında eşdeğer direnç neden en küçük dirençten de küçük oldu?<textarea rows={4} /></label>
          <label><span>3 · AKIM YOLLARI</span>Seri ve paralel devrelerde akımın izleyebileceği yolları karşılaştır.<textarea rows={4} /></label>
          <label><span>4 · BİRLEŞİK DEVRE</span>A-(B∥C) devresini hangi iki aşamada eşdeğer dirence dönüştürdün?<textarea rows={4} /></label>
        </div>
        <label className="rcl-report-conclusion"><span>SONUÇ</span>Bağlantı türünün eşdeğer direnç ve toplam akım üzerindeki etkisini veriye dayalı olarak açıkla.<textarea rows={5} /></label>
      </section>
    </section>
  );
}
