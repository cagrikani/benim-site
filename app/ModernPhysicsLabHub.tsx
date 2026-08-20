"use client";

import { useEffect, useState } from "react";
import CernAcceleratorLab from "./CernAcceleratorLab";
import PhotoelectricLab from "./PhotoelectricLab";

export default function ModernPhysicsLabHub({ onBack }: { onBack: () => void }) {
  const [activeExperiment, setActiveExperiment] = useState<"photoelectric" | "cern" | null>(null);

  useEffect(() => {
    if (activeExperiment !== null) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [activeExperiment]);

  return (
    <main className="page-shell modern-hub-shell">
      <header className={`site-header modern-site-header ${activeExperiment ? "experiment-focus-header" : ""}`}>
        <button
          className={`mechanics-back-button ${activeExperiment ? "experiment-selection-back" : ""}`}
          type="button"
          onClick={activeExperiment ? () => setActiveExperiment(null) : onBack}
          aria-label={activeExperiment ? "Modern Fizik deneylerine dön" : "Fizik deney setlerine dön"}
        >
          <span aria-hidden="true">←</span>
          {activeExperiment && <b>Deneylere dön</b>}
        </button>
        <a className="brand" href={activeExperiment ? "#modern-deney" : "#modern-ust"} aria-label="Fizik Atölyesi Modern Fizik">
          <span className="brand-mark modern-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Modern Fizik deney setleri</small>
          </span>
        </a>
        {!activeExperiment && <nav aria-label="Modern Fizik deneyleri">
          <button type="button" className={activeExperiment === "photoelectric" ? "active" : ""} onClick={() => setActiveExperiment("photoelectric")}>Fotoelektrik etki</button>
          <button type="button" className={activeExperiment === "cern" ? "active" : ""} onClick={() => setActiveExperiment("cern")}>CERN parçacık hızlandırıcı</button>
        </nav>}
        <span className="curriculum-chip">TYMM · 12. Sınıf</span>
      </header>

      <div id="modern-ust">
        {!activeExperiment && <div className="modern-experiment-switch" aria-label="Modern Fizik deney seçimi">
          <button type="button" className={activeExperiment === "photoelectric" ? "active" : ""} onClick={() => setActiveExperiment("photoelectric")}>
            <i className="modern-switch-photo" aria-hidden="true" />
            <span><small>DENEY 1</small><b>Fotoelektrik etki</b><em>Işığın tanecikli yapısını gerçek düzenekle incele.</em></span>
          </button>
          <button type="button" className={activeExperiment === "cern" ? "active" : ""} onClick={() => setActiveExperiment("cern")}>
            <i className="modern-switch-cern" aria-hidden="true"><u /><u /><u /></i>
            <span><small>DENEY 2</small><b>CERN parçacık hızlandırıcı</b><em>LHC’yi kur, çarpışma izlerinden temel parçacıkları tanı.</em></span>
          </button>
        </div>}
        <div id="modern-deney" className={activeExperiment ? "focused-experiment-view" : ""}>
          {activeExperiment === "photoelectric" && <PhotoelectricLab />}
          {activeExperiment === "cern" && <CernAcceleratorLab />}
        </div>
      </div>

      {!activeExperiment && <footer>
        <div className="brand footer-brand">
          <span className="brand-mark modern-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Modern Fizik deney setleri</small>
          </span>
        </div>
        <p>TYMM 12. sınıf Modern Fizik kapsamında model kurma, deney yapma, veri okuryazarlığı ve bilimsel çıkarım becerilerini destekler.</p>
        <a href="#modern-ust">Başa dön ↑</a>
      </footer>}
    </main>
  );
}
