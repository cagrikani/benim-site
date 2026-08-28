"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import ConcaveMirrorLab from "./ConcaveMirrorLab";
import ConvexMirrorLab from "./ConvexMirrorLab";
import LensLab from "./LensLab";
import PlaneMirrorLab from "./PlaneMirrorLab";
import PrismLab from "./PrismLab";

type OpticsTopic = "prism" | "mirrors" | "lenses" | null;
type MirrorType = "plane" | "concave" | "convex" | null;

export default function OpticsLabHub({ onBack }: { onBack: () => void }) {
  const [activeTopic, setActiveTopic] = useState<OpticsTopic>(null);
  const [activeMirror, setActiveMirror] = useState<MirrorType>(null);
  const experimentIsOpen =
    activeTopic === "prism" ||
    activeTopic === "lenses" ||
    (activeTopic === "mirrors" && activeMirror !== null);

  const openTopic = (topic: Exclude<OpticsTopic, null>) => {
    setActiveTopic(topic);
    if (topic !== "mirrors") setActiveMirror(null);
  };

  useEffect(() => {
    if (activeTopic !== null) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [activeMirror, activeTopic]);

  const goBack = () => {
    if (activeTopic === "mirrors" && activeMirror !== null) {
      setActiveMirror(null);
      return;
    }
    if (activeTopic !== null) {
      setActiveTopic(null);
      setActiveMirror(null);
      return;
    }
    onBack();
  };

  return (
    <main className="page-shell optics-hub-shell">
      <header className={`site-header optics-site-header ${activeTopic ? "experiment-focus-header" : ""}`}>
        <button
          className={`mechanics-back-button ${activeTopic ? "experiment-selection-back" : ""}`}
          type="button"
          onClick={goBack}
          aria-label={experimentIsOpen ? "Deney seçimine dön" : activeTopic === "mirrors" ? "Optik alanlarına dön" : "Fizik deney setlerine dön"}
        >
          <span aria-hidden="true">←</span>
          {activeTopic && <b>{experimentIsOpen ? "Deneylere dön" : "Alanlara dön"}</b>}
        </button>
        <a className="brand" href={activeTopic ? "#optik-deney" : "#optik-ust"} aria-label="Fizik Atölyesi Dalgalar ve Optik">
          <span className="brand-mark optics-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Dalgalar - Optik deney setleri</small>
          </span>
        </a>
        {!activeTopic && <nav aria-label="Dalgalar ve Optik deneyleri">
          <button className={activeTopic === "prism" ? "active" : ""} type="button" onClick={() => openTopic("prism")}>Kırılma ve prizma</button>
          <button className={activeTopic === "mirrors" ? "active" : ""} type="button" onClick={() => openTopic("mirrors")}>Aynalar</button>
          <button className={activeTopic === "lenses" ? "active" : ""} type="button" onClick={() => openTopic("lenses")}>Mercekler</button>
        </nav>}
        <span className="curriculum-chip">TYMM · Lise</span>
      </header>

      <div id="optik-ust">
        {!activeTopic && <section className="optics-topic-launcher">
          <div className="optics-topic-heading">
            <span>DALGALAR · OPTİK · ETKİLEŞİMLİ DENEYLER</span>
            <h1>Çalışmak istediğin optik alanını seç.</h1>
            <p>Kartı aç; ardından düzeneği kur, değişkenleri değiştir ve ölçümünü kaydet.</p>
          </div>

          <div className="optics-topic-grid">
            <button className={activeTopic === "prism" ? "active" : ""} type="button" onClick={() => openTopic("prism")}>
              <span className="optics-topic-image"><img src="./portal-optics.webp" alt="" draggable="false" /></span>
              <span><small>OPTİK ALANI 01</small><b>Kırılma ve prizma</b><em>Işın rengini, açıyı ve prizmayı değiştir.</em></span>
              <strong>{activeTopic === "prism" ? "Açık" : "Alanı aç"} →</strong>
            </button>
            <button className={activeTopic === "mirrors" ? "active" : ""} type="button" onClick={() => openTopic("mirrors")}>
              <span className="optics-topic-image"><img src="./optics-mirrors.webp" alt="" draggable="false" /></span>
              <span><small>OPTİK ALANI 02</small><b>Aynalar</b><em>Düzlem, çukur ve tümsek aynaları deneyle.</em></span>
              <strong>{activeTopic === "mirrors" ? "Açık" : "Alanı aç"} →</strong>
            </button>
            <button className={activeTopic === "lenses" ? "active" : ""} type="button" onClick={() => openTopic("lenses")}>
              <span className="optics-topic-image"><img src="./optics-lenses.webp" alt="" draggable="false" /></span>
              <span><small>OPTİK ALANI 03</small><b>Mercekler</b><em>İnce ve kalın kenarlı merceklerle görüntü oluştur.</em></span>
              <strong>{activeTopic === "lenses" ? "Açık" : "Alanı aç"} →</strong>
            </button>
          </div>
        </section>}

        {activeTopic === "mirrors" && activeMirror === null && (
          <section className="mirror-type-launcher">
            <div className="mirror-type-heading">
              <span>AYNALAR</span>
              <h2>Deney yapmak istediğin aynayı seç.</h2>
              <p>Düzlem, çukur ve tümsek ayna deneyleri kullanıma hazırdır.</p>
            </div>
            <div className="mirror-type-grid">
              <button className={activeMirror === "plane" ? "active" : ""} type="button" onClick={() => setActiveMirror("plane")}>
                <span className="mirror-type-image"><img src="./optics-plane-mirror.webp" alt="" draggable="false" /></span>
                <span><small>DENEY 01 · HAZIR</small><b>Düzlem ayna</b><em>Yansıma kanunları ve görüntü özellikleri</em></span>
                <strong>{activeMirror === "plane" ? "Açık" : "Deneyi aç"} →</strong>
              </button>
              <button className={activeMirror === "concave" ? "active" : ""} type="button" onClick={() => setActiveMirror("concave")}>
                <span className="mirror-type-image"><img src="./optics-concave-mirror.webp" alt="" draggable="false" /></span>
                <span><small>DENEY 02 · HAZIR</small><b>Çukur ayna</b><em>Odak, ışınlar ve görüntü oluşumu</em></span>
                <strong>{activeMirror === "concave" ? "Açık" : "Deneyi aç"} →</strong>
              </button>
              <button className={activeMirror === "convex" ? "active" : ""} type="button" onClick={() => setActiveMirror("convex")}>
                <span className="mirror-type-image"><img src="./optics-convex-mirror.webp" alt="" draggable="false" /></span>
                <span><small>DENEY 03 · HAZIR</small><b>Tümsek ayna</b><em>Dağılan ışınlar ve sanal görüntü</em></span>
                <strong>{activeMirror === "convex" ? "Açık" : "Deneyi aç"} →</strong>
              </button>
            </div>
          </section>
        )}

        <div id="optik-deney" className={experimentIsOpen ? "focused-experiment-view" : ""}>
          {activeTopic === "prism" && <PrismLab />}
          {activeTopic === "lenses" && <LensLab />}
          {activeTopic === "mirrors" && activeMirror === "plane" && <PlaneMirrorLab />}
          {activeTopic === "mirrors" && activeMirror === "concave" && <ConcaveMirrorLab />}
          {activeTopic === "mirrors" && activeMirror === "convex" && <ConvexMirrorLab />}
        </div>
      </div>

      {!activeTopic && <footer>
        <div className="brand footer-brand">
          <span className="brand-mark optics-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Dalgalar - Optik deney setleri</small>
          </span>
        </div>
        <p>Kırılma, prizma, ayna ve mercek deneyleri TYMM lise düzeyine uygun ideal ölçümlerle hazırlanır.</p>
        <a href="#optik-ust">Başa dön ↑</a>
      </footer>}
    </main>
  );
}
