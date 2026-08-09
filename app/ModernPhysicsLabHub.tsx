"use client";

import { useState } from "react";
import CernAcceleratorLab from "./CernAcceleratorLab";
import PhotoelectricLab from "./PhotoelectricLab";

export default function ModernPhysicsLabHub({ onBack }: { onBack: () => void }) {
  const [activeExperiment, setActiveExperiment] = useState<"photoelectric" | "cern">("photoelectric");

  return (
    <main className="page-shell modern-hub-shell">
      <header className="site-header modern-site-header">
        <button
          className="mechanics-back-button"
          type="button"
          onClick={onBack}
          aria-label="Fizik deney setlerine dön"
        >
          ←
        </button>
        <a className="brand" href="#modern-ust" aria-label="Fizik Atölyesi Modern Fizik">
          <span className="brand-mark modern-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Modern Fizik deney setleri</small>
          </span>
        </a>
        <nav aria-label="Modern Fizik deneyleri">
          <button type="button" className={activeExperiment === "photoelectric" ? "active" : ""} onClick={() => setActiveExperiment("photoelectric")}>Fotoelektrik etki</button>
          <button type="button" className={activeExperiment === "cern" ? "active" : ""} onClick={() => setActiveExperiment("cern")}>CERN parçacık hızlandırıcı</button>
        </nav>
        <span className="curriculum-chip">TYMM · 12. Sınıf</span>
      </header>

      <div id="modern-ust">
        <div className="modern-experiment-switch" aria-label="Modern Fizik deney seçimi">
          <button type="button" className={activeExperiment === "photoelectric" ? "active" : ""} onClick={() => setActiveExperiment("photoelectric")}>
            <i className="modern-switch-photo" aria-hidden="true" />
            <span><small>DENEY 1</small><b>Fotoelektrik etki</b><em>Işığın tanecikli yapısını gerçek düzenekle incele.</em></span>
          </button>
          <button type="button" className={activeExperiment === "cern" ? "active" : ""} onClick={() => setActiveExperiment("cern")}>
            <i className="modern-switch-cern" aria-hidden="true"><u /><u /><u /></i>
            <span><small>DENEY 2</small><b>CERN parçacık hızlandırıcı</b><em>LHC’yi kur, çarpışma izlerinden temel parçacıkları tanı.</em></span>
          </button>
        </div>
        {activeExperiment === "photoelectric" ? <PhotoelectricLab /> : <CernAcceleratorLab />}
      </div>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark modern-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Modern Fizik deney setleri</small>
          </span>
        </div>
        <p>TYMM 12. sınıf Modern Fizik kapsamında model kurma, deney yapma, veri okuryazarlığı ve bilimsel çıkarım becerilerini destekler.</p>
        <a href="#modern-ust">Başa dön ↑</a>
      </footer>
    </main>
  );
}
