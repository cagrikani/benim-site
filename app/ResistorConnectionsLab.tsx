"use client";

import { useMemo, useState } from "react";

type ResistorLabel = "A" | "B" | "C" | "D";
type NodeId = "P" | "N" | "AT" | "AB" | "BT" | "BB" | "CT" | "X" | "DT";
type CircuitKind = "single-a" | "single-b" | "series-ab" | "parallel-ac" | "mixed-abcd";
type CircuitType = "single" | "series" | "parallel" | "mixed";

type CircuitTask = {
  kind: CircuitKind;
  title: string;
  notation: string;
  type: CircuitType;
  purpose: string;
  switches: number[];
};

type Trial = {
  id: string;
  task: CircuitKind;
  type: CircuitType;
  title: string;
  switches: number[];
  voltage: number;
  equivalentResistance: number;
  totalCurrentMilliamp: number;
  currentNote: string;
};

type CircuitAnalysis = {
  complete: boolean;
  shortCircuit: boolean;
  circuitType: CircuitType;
  topology: string;
  equivalentResistance: number;
  totalCurrentMilliamp: number;
  currentsMilliamp: Record<ResistorLabel, number>;
  activeResistors: ResistorLabel[];
  activeSwitches: number[];
};

const RESISTORS: Record<ResistorLabel, number> = { A: 100, B: 150, C: 220, D: 330 };
const NODES: NodeId[] = ["P", "N", "AT", "AB", "BT", "BB", "CT", "X", "DT"];

const RESISTOR_EDGES: Array<{ label: ResistorLabel; from: NodeId; to: NodeId; resistance: number }> = [
  { label: "A", from: "AT", to: "AB", resistance: RESISTORS.A },
  { label: "B", from: "BT", to: "BB", resistance: RESISTORS.B },
  { label: "C", from: "CT", to: "X", resistance: RESISTORS.C },
  { label: "D", from: "DT", to: "X", resistance: RESISTORS.D },
];

const SWITCH_EDGES: Record<number, [NodeId, NodeId]> = {
  1: ["P", "AT"],
  2: ["AB", "N"],
  3: ["AB", "BB"],
  4: ["BT", "CT"],
  5: ["BB", "CT"],
  6: ["P", "BT"],
  7: ["BT", "X"],
  8: ["P", "DT"],
  9: ["DT", "N"],
  10: ["X", "N"],
  11: ["BB", "X"],
};

const SWITCH_INFO: Record<number, { short: string; description: string; orientation: "horizontal" | "vertical" }> = {
  1: { short: "+ → A", description: "Pozitif ana hattı A direncinin üst ucuna bağlar.", orientation: "vertical" },
  2: { short: "A → −", description: "A direncinin alt ucunu negatif ana hatta bağlar.", orientation: "vertical" },
  3: { short: "A ↔ B", description: "A ve B dirençlerinin alt uçlarını birbirine bağlar.", orientation: "horizontal" },
  4: { short: "B ↔ C üst", description: "B ve C dirençlerinin üst uçlarını birbirine bağlar.", orientation: "horizontal" },
  5: { short: "B alt → C üst", description: "B'nin alt ucunu C'nin üst ucuna bağlayan çapraz yolu tamamlar.", orientation: "horizontal" },
  6: { short: "+ → B", description: "Pozitif ana hattı B direncinin üst ucuna bağlar.", orientation: "vertical" },
  7: { short: "B üst → dönüş", description: "B'nin üst ucunu C-D ortak dönüş hattına bağlar.", orientation: "vertical" },
  8: { short: "+ → D", description: "Pozitif ana hattı D direncinin üst ucuna bağlar.", orientation: "vertical" },
  9: { short: "D üst → −", description: "D'nin üst ucunu sağ dönüş yoluyla negatif ana hatta bağlar.", orientation: "vertical" },
  10: { short: "C-D → −", description: "C-D ortak dönüş hattını negatif ana hatta bağlar.", orientation: "vertical" },
  11: { short: "B alt → C-D", description: "B'nin alt ucunu C-D ortak dönüş hattına bağlar.", orientation: "horizontal" },
};

const TASKS: CircuitTask[] = [
  {
    kind: "single-a",
    title: "Yalnız A",
    notation: "A",
    type: "single",
    purpose: "A direncini tek başına kaynak uçlarına bağla.",
    switches: [1, 2],
  },
  {
    kind: "single-b",
    title: "Yalnız B",
    notation: "B",
    type: "single",
    purpose: "Akımı yalnızca B direncinden geçir.",
    switches: [6, 3, 2],
  },
  {
    kind: "series-ab",
    title: "A-B seri",
    notation: "A — B",
    type: "series",
    purpose: "Akımın A ve B üzerinden art arda geçtiği tek yolu oluştur.",
    switches: [1, 3, 7, 10],
  },
  {
    kind: "parallel-ac",
    title: "A-C paralel",
    notation: "A ∥ C",
    type: "parallel",
    purpose: "A ve C için aynı iki nokta arasında iki ayrı akım yolu oluştur.",
    switches: [1, 2, 6, 4, 10],
  },
  {
    kind: "mixed-abcd",
    title: "Birleşik devre",
    notation: "A — (B ∥ C) — D",
    type: "mixed",
    purpose: "A ve D seri kalırken B ile C arasında paralel kollar oluştur.",
    switches: [1, 3, 5, 7, 9],
  },
];

function formatResistance(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length;
  if (!size) return [];
  const augmented = matrix.map((row, index) => [...row, values[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];

    const divisor = augmented[column][column];
    for (let item = column; item <= size; item += 1) augmented[column][item] /= divisor;

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const multiplier = augmented[row][column];
      for (let item = column; item <= size; item += 1) {
        augmented[row][item] -= multiplier * augmented[column][item];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function analyzeCircuit(closedSwitches: number[], voltage: number): CircuitAnalysis {
  const parent = new Map<NodeId, NodeId>(NODES.map((node) => [node, node]));
  const find = (node: NodeId): NodeId => {
    const current = parent.get(node) ?? node;
    if (current === node) return node;
    const root = find(current);
    parent.set(node, root);
    return root;
  };
  const union = (first: NodeId, second: NodeId) => {
    const firstRoot = find(first);
    const secondRoot = find(second);
    if (firstRoot !== secondRoot) parent.set(secondRoot, firstRoot);
  };

  closedSwitches.forEach((number) => {
    const edge = SWITCH_EDGES[number];
    if (edge) union(edge[0], edge[1]);
  });

  const positiveRoot = find("P");
  const negativeRoot = find("N");
  const emptyCurrents: Record<ResistorLabel, number> = { A: 0, B: 0, C: 0, D: 0 };

  if (positiveRoot === negativeRoot) {
    return {
      complete: false,
      shortCircuit: true,
      circuitType: "mixed",
      topology: "Kısa devre: kaynak uçları doğrudan birleşti",
      equivalentResistance: 0,
      totalCurrentMilliamp: 0,
      currentsMilliamp: emptyCurrents,
      activeResistors: [],
      activeSwitches: [],
    };
  }

  const reducedEdges = RESISTOR_EDGES.map((edge) => ({
    ...edge,
    fromRoot: find(edge.from),
    toRoot: find(edge.to),
  })).filter((edge) => edge.fromRoot !== edge.toRoot);

  const adjacency = new Map<NodeId, Set<NodeId>>();
  reducedEdges.forEach((edge) => {
    if (!adjacency.has(edge.fromRoot)) adjacency.set(edge.fromRoot, new Set());
    if (!adjacency.has(edge.toRoot)) adjacency.set(edge.toRoot, new Set());
    adjacency.get(edge.fromRoot)?.add(edge.toRoot);
    adjacency.get(edge.toRoot)?.add(edge.fromRoot);
  });

  const reachable = new Set<NodeId>([positiveRoot]);
  const queue: NodeId[] = [positiveRoot];
  while (queue.length) {
    const current = queue.shift() as NodeId;
    adjacency.get(current)?.forEach((neighbor) => {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  if (!reachable.has(negativeRoot)) {
    return {
      complete: false,
      shortCircuit: false,
      circuitType: "mixed",
      topology: "Açık devre: kaynaktan dönüş hattına kesintisiz yol yok",
      equivalentResistance: 0,
      totalCurrentMilliamp: 0,
      currentsMilliamp: emptyCurrents,
      activeResistors: [],
      activeSwitches: [],
    };
  }

  const unknownNodes = [...reachable].filter((node) => node !== positiveRoot && node !== negativeRoot);
  const nodeIndex = new Map<NodeId, number>(unknownNodes.map((node, index) => [node, index]));
  const matrix = Array.from({ length: unknownNodes.length }, () => Array(unknownNodes.length).fill(0));
  const constants = Array(unknownNodes.length).fill(0);
  const fixedVoltage = (node: NodeId) => node === positiveRoot ? voltage : 0;

  reducedEdges.forEach((edge) => {
    if (!reachable.has(edge.fromRoot) || !reachable.has(edge.toRoot)) return;
    const conductance = 1 / edge.resistance;
    const firstIndex = nodeIndex.get(edge.fromRoot);
    const secondIndex = nodeIndex.get(edge.toRoot);

    if (firstIndex !== undefined) {
      matrix[firstIndex][firstIndex] += conductance;
      if (secondIndex !== undefined) matrix[firstIndex][secondIndex] -= conductance;
      else constants[firstIndex] += conductance * fixedVoltage(edge.toRoot);
    }
    if (secondIndex !== undefined) {
      matrix[secondIndex][secondIndex] += conductance;
      if (firstIndex !== undefined) matrix[secondIndex][firstIndex] -= conductance;
      else constants[secondIndex] += conductance * fixedVoltage(edge.fromRoot);
    }
  });

  const solved = solveLinearSystem(matrix, constants);
  if (solved === null) {
    return {
      complete: false,
      shortCircuit: false,
      circuitType: "mixed",
      topology: "Açık devre: bağlantı yolu tamamlanmadı",
      equivalentResistance: 0,
      totalCurrentMilliamp: 0,
      currentsMilliamp: emptyCurrents,
      activeResistors: [],
      activeSwitches: [],
    };
  }

  const potentials = new Map<NodeId, number>([[positiveRoot, voltage], [negativeRoot, 0]]);
  unknownNodes.forEach((node, index) => potentials.set(node, solved[index]));
  const currentsMilliamp: Record<ResistorLabel, number> = { A: 0, B: 0, C: 0, D: 0 };

  reducedEdges.forEach((edge) => {
    const firstVoltage = potentials.get(edge.fromRoot);
    const secondVoltage = potentials.get(edge.toRoot);
    if (firstVoltage === undefined || secondVoltage === undefined) return;
    currentsMilliamp[edge.label] = Math.abs((firstVoltage - secondVoltage) / edge.resistance) * 1000;
  });

  let totalCurrentAmp = 0;
  reducedEdges.forEach((edge) => {
    if (edge.fromRoot === positiveRoot) {
      totalCurrentAmp += (voltage - (potentials.get(edge.toRoot) ?? voltage)) / edge.resistance;
    } else if (edge.toRoot === positiveRoot) {
      totalCurrentAmp += (voltage - (potentials.get(edge.fromRoot) ?? voltage)) / edge.resistance;
    }
  });
  totalCurrentAmp = Math.abs(totalCurrentAmp);

  const activeResistors = (Object.keys(currentsMilliamp) as ResistorLabel[])
    .filter((label) => currentsMilliamp[label] > 1e-6);
  const currentRoots = new Set<NodeId>();
  reducedEdges.forEach((edge) => {
    if (currentsMilliamp[edge.label] > 1e-6) {
      currentRoots.add(edge.fromRoot);
      currentRoots.add(edge.toRoot);
    }
  });
  const activeSwitches = closedSwitches.filter((number) => {
    const edge = SWITCH_EDGES[number];
    return edge ? currentRoots.has(find(edge[0])) || currentRoots.has(find(edge[1])) : false;
  });

  const parallelGroups = new Map<string, ResistorLabel[]>();
  reducedEdges.forEach((edge) => {
    if (currentsMilliamp[edge.label] <= 1e-6) return;
    const key = [edge.fromRoot, edge.toRoot].sort().join("|");
    parallelGroups.set(key, [...(parallelGroups.get(key) ?? []), edge.label]);
  });
  const parallelGroup = [...parallelGroups.values()].find((group) => group.length > 1) ?? null;
  const activeCurrents = activeResistors.map((label) => currentsMilliamp[label]);
  const sameCurrent = activeCurrents.length > 1
    && Math.max(...activeCurrents) - Math.min(...activeCurrents) < 1e-5;

  let circuitType: CircuitType = "mixed";
  let topology = "Birleşik bağlantı";
  if (activeResistors.length === 1) {
    circuitType = "single";
    topology = `Tek direnç: ${activeResistors[0]}`;
  } else if (parallelGroup && parallelGroup.length === activeResistors.length) {
    circuitType = "parallel";
    topology = `Paralel bağlantı: ${parallelGroup.join(" ∥ ")}`;
  } else if (parallelGroup) {
    circuitType = "mixed";
    const seriesLabels = activeResistors.filter((label) => !parallelGroup.includes(label));
    topology = `Birleşik bağlantı: ${seriesLabels[0] ?? ""} — (${parallelGroup.join(" ∥ ")})${seriesLabels[1] ? ` — ${seriesLabels[1]}` : ""}`;
  } else if (sameCurrent) {
    circuitType = "series";
    topology = `Seri bağlantı: ${activeResistors.join(" — ")}`;
  }

  return {
    complete: totalCurrentAmp > 1e-12,
    shortCircuit: false,
    circuitType,
    topology,
    equivalentResistance: totalCurrentAmp > 1e-12 ? voltage / totalCurrentAmp : 0,
    totalCurrentMilliamp: totalCurrentAmp * 1000,
    currentsMilliamp,
    activeResistors,
    activeSwitches,
  };
}

function BoardResistor({
  label,
  powered,
  currentMilliamp,
}: {
  label: ResistorLabel;
  powered: boolean;
  currentMilliamp: number;
}) {
  return (
    <div className={`rc3-board-resistor rc3-resistor-${label.toLowerCase()} ${powered ? "powered" : ""}`}>
      <i className="rc3-resistor-lead top" />
      <span className="rc3-resistor-body"><i /><i /><i /><i /></span>
      <i className="rc3-resistor-lead bottom" />
      <b>{label}</b>
      <small>{RESISTORS[label]} Ω</small>
      <em>{powered ? `${currentMilliamp.toFixed(1)} mA` : ""}</em>
    </div>
  );
}

function BoardSwitch({
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
      className={`rc3-board-switch rc3-switch-${number} ${info.orientation} ${closed ? "closed" : "open"} ${highlighted ? "highlighted" : ""} ${energized ? "energized" : ""}`}
      onClick={() => onToggle(number)}
      aria-pressed={closed}
      aria-label={`S${number}: ${info.description} Şu anda ${closed ? "kapalı" : "açık"}.`}
      data-testid={`resistor-switch-${number}`}
    >
      <span className="rc3-switch-tag">S{number}</span>
      <span className="rc3-switch-contact" aria-hidden="true"><i /><i /><b /></span>
      <small>{info.short}</small>
    </button>
  );
}

function FixedCircuitBoard({
  closedSwitches,
  highlightedSwitch,
  powerOn,
  analysis,
  onToggle,
}: {
  closedSwitches: number[];
  highlightedSwitch: number | null;
  powerOn: boolean;
  analysis: CircuitAnalysis;
  onToggle: (number: number) => void;
}) {
  return (
    <div className={`rc3-fixed-board ${powerOn ? "powered" : ""}`}>
      <div className="rc3-board-title">
        <span><b>SABİT DİRENÇ BAĞLANTI PANOSU</b><small>A, B, C ve D her zaman aynı yerde</small></span>
        <strong>{analysis.complete ? analysis.topology : "Anahtarlarla kesintisiz bir yol oluştur"}</strong>
      </div>
      <div className="rc3-network" data-testid="fixed-resistor-network">
        <span className="rc3-main-rail positive"><b>+ POZİTİF ANA HAT</b></span>
        <span className="rc3-main-rail negative"><b>− NEGATİF ANA HAT</b></span>

        <i className="rc3-wire wire-a" /><i className="rc3-wire wire-b" />
        <i className="rc3-wire wire-ab" /><i className="rc3-wire wire-b-upper" />
        <i className="rc3-wire wire-bc-upper" /><i className="rc3-wire wire-bc-drop" />
        <i className="rc3-wire wire-bc-cross" /><i className="rc3-wire wire-bc-cross-rise" />
        <i className="rc3-wire wire-b-return" /><i className="rc3-wire wire-bb-drop" />
        <i className="rc3-wire wire-bb-return" /><i className="rc3-wire wire-common-return" />
        <i className="rc3-wire wire-c" /><i className="rc3-wire wire-d" />
        <i className="rc3-wire wire-d-source" /><i className="rc3-wire wire-d-right" />
        <i className="rc3-wire wire-d-right-drop" /><i className="rc3-wire wire-return-negative" />

        <span className="rc3-node node-btop">B üst düğümü</span>
        <span className="rc3-node node-bbottom">A-B alt düğümü</span>
        <span className="rc3-node node-return">C-D ortak dönüş hattı</span>

        <BoardResistor label="A" powered={powerOn && analysis.activeResistors.includes("A")} currentMilliamp={analysis.currentsMilliamp.A} />
        <BoardResistor label="B" powered={powerOn && analysis.activeResistors.includes("B")} currentMilliamp={analysis.currentsMilliamp.B} />
        <BoardResistor label="C" powered={powerOn && analysis.activeResistors.includes("C")} currentMilliamp={analysis.currentsMilliamp.C} />
        <BoardResistor label="D" powered={powerOn && analysis.activeResistors.includes("D")} currentMilliamp={analysis.currentsMilliamp.D} />

        {Array.from({ length: 11 }, (_, index) => index + 1).map((number) => (
          <BoardSwitch
            number={number}
            closed={closedSwitches.includes(number)}
            highlighted={highlightedSwitch === number}
            energized={powerOn && analysis.activeSwitches.includes(number)}
            onToggle={onToggle}
            key={number}
          />
        ))}
      </div>
      <div className="rc3-board-legend">
        <span><i className="open" />Açık anahtar</span>
        <span><i className="closed" />Kapalı anahtar</span>
        <span><i className="flow" />Akım taşıyan direnç ve bağlantı</span>
        <em>Pano hiçbir görevde biçim değiştirmez.</em>
      </div>
    </div>
  );
}

export default function ResistorConnectionsLab() {
  const [selectedTask, setSelectedTask] = useState<CircuitKind>("series-ab");
  const [closedSwitches, setClosedSwitches] = useState<number[]>([]);
  const [highlightedSwitch, setHighlightedSwitch] = useState<number | null>(1);
  const [selectedSwitch, setSelectedSwitch] = useState<number>(1);
  const [voltage, setVoltage] = useState(9);
  const [powerOn, setPowerOn] = useState(false);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [prediction, setPrediction] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [notice, setNotice] = useState("S1 seçili: Pozitif ana hattı A direncinin üst ucuna bağlar.");

  const task = TASKS.find((item) => item.kind === selectedTask) ?? TASKS[0];
  const analysis = useMemo(
    () => analyzeCircuit(closedSwitches, voltage),
    [closedSwitches, voltage],
  );
  const targetClosedCount = task.switches.filter((number) => closedSwitches.includes(number)).length;
  const extraSwitches = closedSwitches.filter((number) => !task.switches.includes(number));
  const goalComplete = targetClosedCount === task.switches.length && extraSwitches.length === 0;
  const nextTargetSwitch = task.switches.find((number) => !closedSwitches.includes(number)) ?? null;
  const displayTotalCurrent = powerOn && analysis.complete ? analysis.totalCurrentMilliamp : 0;
  const displayEquivalent = powerOn && analysis.complete ? analysis.equivalentResistance : 0;
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
    const selected = TASKS.find((item) => item.kind === kind) ?? TASKS[0];
    setSelectedTask(kind);
    const next = selected.switches.find((number) => !closedSwitches.includes(number)) ?? selected.switches[0];
    setHighlightedSwitch(next);
    setSelectedSwitch(next);
    setShowAnalysis(false);
    setNotice(`Yeni hedef seçildi; pano ve anahtar konumları değişmedi. S${next}: ${SWITCH_INFO[next].description}`);
  };

  const toggleSwitch = (number: number) => {
    setSelectedSwitch(number);
    if (powerOn) {
      setNotice("Akım varken anahtar değiştirilmez. Önce güç kaynağını kapat.");
      return;
    }
    const closing = !closedSwitches.includes(number);
    const next = closing
      ? [...closedSwitches, number]
      : closedSwitches.filter((item) => item !== number);
    setClosedSwitches(next);
    const nextMissing = task.switches.find((item) => !next.includes(item));
    setHighlightedSwitch(nextMissing ?? null);
    setNotice(`S${number} ${closing ? "kapandı" : "açıldı"}: ${SWITCH_INFO[number].description}`);
  };

  const showNextTarget = () => {
    if (nextTargetSwitch === null) {
      setNotice(extraSwitches.length
        ? `Hedef dışındaki anahtarları aç: ${extraSwitches.map((number) => `S${number}`).join(", ")}.`
        : "Hedef anahtarları tamam. Devrenin fiziksel sonucunu üst göstergeden kontrol et.");
      return;
    }
    setHighlightedSwitch(nextTargetSwitch);
    setSelectedSwitch(nextTargetSwitch);
    setNotice(`Panoda S${nextTargetSwitch} vurgulandı: ${SWITCH_INFO[nextTargetSwitch].description}`);
  };

  const resetSwitches = () => {
    if (powerOn) return;
    setClosedSwitches([]);
    setHighlightedSwitch(task.switches[0]);
    setSelectedSwitch(task.switches[0]);
    setNotice("Bütün anahtarlar açıldı; A-B-C-D dirençleri aynı yerlerinde kaldı.");
  };

  const togglePower = () => {
    if (analysis.shortCircuit) {
      setNotice("Kısa devre oluştu. Güç vermeden önce kaynak uçlarını doğrudan birleştiren anahtarlardan birini aç.");
      return;
    }
    if (!analysis.complete) {
      setHighlightedSwitch(nextTargetSwitch);
      setNotice("Devre açık: pozitif ana hattan negatif ana hatta direnç içeren kesintisiz bir yol oluştur.");
      return;
    }
    setPowerOn((current) => !current);
    setNotice(powerOn
      ? "Güç kaynağı kapatıldı; anahtarlar yeniden düzenlenebilir."
      : `${analysis.topology} çalışıyor. Akım taşıyan dirençler turuncu-yeşil renkte.`);
  };

  const recordTrial = () => {
    if (!powerOn || !analysis.complete) {
      setNotice("Ölçüm kaydı için geçerli devreyi çalıştır.");
      return;
    }
    const switches = [...closedSwitches].sort((a, b) => a - b);
    const currentNote = analysis.activeResistors
      .map((label) => `${label}: ${analysis.currentsMilliamp[label].toFixed(1)} mA`)
      .join(" · ");
    const trial: Trial = {
      id: `${switches.join("-")}-${voltage}`,
      task: task.kind,
      type: analysis.circuitType,
      title: analysis.topology,
      switches,
      voltage,
      equivalentResistance: analysis.equivalentResistance,
      totalCurrentMilliamp: analysis.totalCurrentMilliamp,
      currentNote,
    };
    setTrials((current) => [...current.filter((item) => item.id !== trial.id), trial]);
    setNotice(`${analysis.topology} kaydedildi: ${formatResistance(analysis.equivalentResistance)} Ω, ${analysis.totalCurrentMilliamp.toFixed(1)} mA.`);
  };

  return (
    <section className="resistor-connections-lab rc2-lab rc3-lab" id="direnc-baglantilari-deneyi">
      <header className="rc2-hero rc3-hero">
        <div>
          <span>ELEKTRİK · DENEY 2 · FİZ.10.3.4</span>
          <h1>Tek pano, değişen bağlantılar.</h1>
          <p>
            A, B, C ve D dirençleri ile S1-S11 anahtarları sürekli aynı devre üzerinde kalır.
            Yalnız anahtarları açıp kapat; seri, paralel ve birleşik yolları pano üzerinde oluştur.
          </p>
        </div>
        <aside><i>4R</i><span><b>SABİT DEVRE TOPOLOJİSİ</b><small>4 direnç · 11 anahtar · tek fiziksel pano</small></span></aside>
      </header>

      <div className="rc2-prediction">
        <span><small>DENEY ÖNCESİ TAHMİN</small><b>Aynı panoda hangi anahtarlar paralel iki akım yolu oluşturabilir?</b></span>
        <input value={prediction} onChange={(event) => setPrediction(event.target.value)} placeholder="Tahminini buraya yaz…" />
      </div>

      <section className="rc2-task-picker rc3-task-picker">
        <div className="rc2-section-heading"><span>1 · HEDEFİ SEÇ</span><h2>Hedef değişir; devre şeması ve parçaların yeri değişmez.</h2></div>
        <div className="rc2-task-tabs">
          {TASKS.map((item, index) => (
            <button type="button" className={task.kind === item.kind ? "active" : ""} onClick={() => selectTask(item.kind)} aria-pressed={task.kind === item.kind} key={item.kind}>
              <small>{String(index + 1).padStart(2, "0")}</small><b>{item.title}</b><strong>{item.notation}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="rc2-workspace rc3-workspace">
        <aside className="rc2-guide-card rc3-guide-card">
          <span className="rc2-eyebrow">HEDEF BAĞLANTI</span>
          <h2>{task.title}</h2>
          <strong>{task.notation}</strong>
          <p>{task.purpose}</p>
          <div className="rc3-progress"><i><b style={{ width: `${(targetClosedCount / task.switches.length) * 100}%` }} /></i><span>{targetClosedCount}/{task.switches.length} hedef anahtarı kapalı</span></div>
          <div className="rc2-connection-list">
            {task.switches.map((number, index) => {
              const closed = closedSwitches.includes(number);
              return (
                <button type="button" className={`${closed ? "done" : ""} ${highlightedSwitch === number ? "next" : ""}`} onClick={() => { setHighlightedSwitch(number); setSelectedSwitch(number); }} key={number}>
                  <i>{closed ? "✓" : index + 1}</i>
                  <span><b>S{number} · {SWITCH_INFO[number].short}</b><small>{SWITCH_INFO[number].description}</small></span>
                </button>
              );
            })}
          </div>
          <button type="button" className="rc2-find-next" onClick={showNextTarget}>{goalComplete ? "Hedef bağlantı tamam" : "Sıradaki hedefi panoda göster"}</button>
          <button type="button" className="rc2-reset-links" onClick={resetSwitches} disabled={powerOn}>Bütün anahtarları aç</button>
          <div className="rc3-selected-switch"><span>SEÇİLİ ANAHTAR · S{selectedSwitch}</span><b>{SWITCH_INFO[selectedSwitch].short}</b><p>{SWITCH_INFO[selectedSwitch].description}</p></div>
        </aside>

        <section className="rc2-stage rc3-stage">
          <div className="rc2-stage-topbar">
            <span><small>TEK VE SABİT DENEY PANOSU</small><b>{analysis.topology}</b></span>
            <strong className={analysis.complete ? "ready" : analysis.shortCircuit ? "danger" : ""}>{analysis.shortCircuit ? "Kısa devre" : analysis.complete ? "Geçerli devre" : "Açık devre"}</strong>
          </div>
          <div className={`rc2-instruction ${analysis.shortCircuit ? "danger" : ""}`} role="status">
            <i>{analysis.shortCircuit ? "!" : analysis.complete ? "✓" : "i"}</i>
            <span><small>{analysis.shortCircuit ? "GÜÇ VERİLEMEZ" : analysis.complete ? "DEVRE TANIMLANDI" : `ANAHTAR ${selectedSwitch}`}</small><b>{notice}</b></span>
          </div>

          <div className="rc2-workbench rc3-workbench">
            <div className="rc2-wall"><i /><i /></div><div className="rc2-table"><i /><i /></div>

            <FixedCircuitBoard closedSwitches={closedSwitches} highlightedSwitch={highlightedSwitch} powerOn={powerOn} analysis={analysis} onToggle={toggleSwitch} />

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

          <div className="rc2-controls">
            <label><span>Kaynak gerilimi</span><select value={voltage} onChange={(event) => setVoltage(Number(event.target.value))} disabled={powerOn}><option value={6}>6 V</option><option value={9}>9 V</option><option value={12}>12 V</option></select></label>
            <span><small>Tanımlanan bağlantı</small><b>{analysis.complete ? analysis.topology : "—"}</b></span>
            <span><small>Eşdeğer direnç</small><b>{powerOn ? `${formatResistance(displayEquivalent)} Ω` : "Devreyi çalıştır"}</b></span>
            <span><small>Toplam akım</small><b>{powerOn ? `${displayTotalCurrent.toFixed(1)} mA` : "—"}</b></span>
            <button type="button" onClick={recordTrial} disabled={!powerOn}>Ölçümü kaydet</button>
          </div>
        </section>
      </div>

      <section className="rc2-data-section">
        <div className="rc2-data-heading"><div><span>2 · AYNI PANODAKİ SONUÇLAR</span><h2>Anahtar durumu değiştiğinde bağlantı türü nasıl değişti?</h2></div><b>{trials.length}<small>kayıt</small></b></div>
        <div className="rc2-data-grid">
          <article className="rc2-table-card">
            <div><b>İdeal ölçüm tablosu</b><span>Tek sabit pano</span></div>
            <div className="rc2-table-wrap"><table><thead><tr><th>Tanımlanan devre</th><th>Anahtarlar</th><th>Gerilim</th><th>R eş</th><th>I toplam</th><th>Direnç akımları</th></tr></thead><tbody>
              {trials.length ? trials.map((trial) => <tr key={trial.id}><th>{trial.title}</th><td>{trial.switches.map((number) => `S${number}`).join(", ")}</td><td>{trial.voltage} V</td><td>{formatResistance(trial.equivalentResistance)} Ω</td><td>{trial.totalCurrentMilliamp.toFixed(1)} mA</td><td>{trial.currentNote}</td></tr>) : <tr><td colSpan={6}>Aynı panoda geçerli bir yol oluştur, çalıştır ve ilk ölçümü kaydet.</td></tr>}
            </tbody></table></div>
          </article>
          <article className="rc2-comparison-card">
            <div><b>Hedef deneyler</b><span>Son kayıtlar</span></div>
            <div className="rc2-comparison-bars">
              {latestTrials.map(({ task: item, trial }) => <div key={item.kind}><span><b>{item.notation}</b><small>{trial ? `${formatResistance(trial.equivalentResistance)} Ω` : "ölçülmedi"}</small></span><i><b style={{ width: trial ? `${Math.max(5, trial.equivalentResistance / 6)}%` : "0%" }} /></i></div>)}
            </div>
          </article>
        </div>
      </section>

      <section className="rc2-analysis-gate">
        <div><span>3 · SONUCU AÇIKLA</span><h2>Tek pano üzerindeki örüntüyü matematiksel modele dönüştür.</h2><p>{analysisReady ? "Seri, paralel ve birleşik devre kayıtların hazır." : "Analiz için aynı panoda seri, paralel ve birleşik birer devre ölç."}</p></div>
        <button type="button" disabled={!analysisReady} onClick={() => setShowAnalysis((current) => !current)}>{showAnalysis ? "Analizi kapat" : "İşlemsel analizi göster"} →</button>
      </section>

      {showAnalysis && analysisReady && <section className="rc2-analysis-cards">
        <article><span>SERİ BAĞLANTI</span><b>R<sub>eş</sub> = R<sub>1</sub> + R<sub>2</sub></b><p>Aynı akım, etkin dirençlerden art arda geçer.</p></article>
        <article><span>PARALEL BAĞLANTI</span><b>1/R<sub>eş</sub> = 1/R<sub>1</sub> + 1/R<sub>2</sub></b><p>Aynı iki düğüm arasında birden fazla akım yolu oluşur.</p></article>
        <article><span>BİRLEŞİK DEVRE</span><b>Önce paralel kol, sonra seri toplam</b><p>Pano değişmeden yalnız anahtar durumları yeni devreyi oluşturur.</p></article>
      </section>}

      <section className="rc2-report">
        <div className="rc2-report-heading"><span>TYMM · KISA DENEY RAPORU</span><h2>Sabit panoda oluşan devreleri kanıtlarınla açıkla.</h2><p>Yanıtlarında anahtar numaralarını, direnç akımlarını ve ölçüm tablonu kullan.</p></div>
        <div className="rc2-report-grid">
          <label><span>1 · SERİ YOL</span>Hangi anahtarlar kapandığında akım A ve B&apos;den art arda geçti?<textarea rows={4} /></label>
          <label><span>2 · PARALEL KOLLAR</span>Hangi düğümler ortak olduğunda A ve C paralel hâle geldi?<textarea rows={4} /></label>
          <label><span>3 · AKIMLAR</span>Seri ve paralel durumda A-B-C-D akımlarını karşılaştır.<textarea rows={4} /></label>
          <label><span>4 · BİRLEŞİK DEVRE</span>A-(B∥C)-D yolunu aynı pano üzerinde hangi anahtarlarla oluşturdun?<textarea rows={4} /></label>
        </div>
        <label className="rc2-report-conclusion"><span>SONUÇ</span>Anahtarların devrenin seri, paralel veya birleşik olmasını nasıl belirlediğini açıkla.<textarea rows={5} /></label>
      </section>
    </section>
  );
}
