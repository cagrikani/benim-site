"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import PrismLab from "./PrismLab";
import UnifiedOpticsLab from "./UnifiedOpticsLab";

type OpticsTopic = "prism" | "optical-bench" | null;

export default function OpticsLabHub({ onBack }: { onBack: () => void }) {
  const [activeTopic, setActiveTopic] = useState<OpticsTopic>(null);
  const experimentIsOpen = activeTopic !== null;

  const openTopic = (topic: Exclude<OpticsTopic, null>) => {
    setActiveTopic(topic);
  };

  useEffect(() => {
    if (activeTopic !== null) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [activeTopic]);

  const goBack = () => {
    if (activeTopic !== null) {
      setActiveTopic(null);
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
          aria-label={experimentIsOpen ? "Deney seçimine dön" : "Fizik deney setlerine dön"}
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
          <button className={activeTopic === "optical-bench" ? "active" : ""} type="button" onClick={() => openTopic("optical-bench")}>Aynalar ve mercekler</button>
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
            <button className={activeTopic === "optical-bench" ? "active" : ""} type="button" onClick={() => openTopic("optical-bench")}>
              <span className="optics-topic-image"><img src="./optics-universal-holder-real-v2.webp" alt="" draggable="false" /></span>
              <span><small>OPTİK ALANI 02</small><b>Aynalar ve mercekler</b><em>Beş optik elemanı aynı gerçekçi düzeneğe kendin yerleştir.</em></span>
              <strong>{activeTopic === "optical-bench" ? "Açık" : "Alanı aç"} →</strong>
            </button>
          </div>
        </section>}

        <div id="optik-deney" className={experimentIsOpen ? "focused-experiment-view" : ""}>
          {activeTopic === "prism" && <PrismLab />}
          {activeTopic === "optical-bench" && <UnifiedOpticsLab />}
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
