"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import ConcaveMirrorLab from "./ConcaveMirrorLab";
import PlaneMirrorLab from "./PlaneMirrorLab";
import PrismLab from "./PrismLab";

type OpticsTopic = "prism" | "mirrors" | null;
type MirrorType = "plane" | "concave" | "convex" | null;

export default function OpticsLabHub({ onBack }: { onBack: () => void }) {
  const [activeTopic, setActiveTopic] = useState<OpticsTopic>(null);
  const [activeMirror, setActiveMirror] = useState<MirrorType>(null);

  const openTopic = (topic: Exclude<OpticsTopic, null>) => {
    setActiveTopic(topic);
    if (topic !== "mirrors") setActiveMirror(null);
  };

  return (
    <main className="page-shell optics-hub-shell">
      <header className="site-header optics-site-header">
        <button
          className="mechanics-back-button"
          type="button"
          onClick={onBack}
          aria-label="Fizik deney setlerine dön"
        >
          ←
        </button>
        <a className="brand" href="#optik-ust" aria-label="Fizik Atölyesi Dalgalar ve Optik">
          <span className="brand-mark optics-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Dalgalar - Optik deney setleri</small>
          </span>
        </a>
        <nav aria-label="Dalgalar ve Optik deneyleri">
          <button className={activeTopic === "prism" ? "active" : ""} type="button" onClick={() => openTopic("prism")}>Kırılma ve prizma</button>
          <button className={activeTopic === "mirrors" ? "active" : ""} type="button" onClick={() => openTopic("mirrors")}>Aynalar</button>
        </nav>
        <span className="curriculum-chip">TYMM · Lise</span>
      </header>

      <div id="optik-ust">
        <section className="optics-topic-launcher">
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
          </div>
        </section>

        {activeTopic === "mirrors" && (
          <section className="mirror-type-launcher">
            <div className="mirror-type-heading">
              <span>AYNALAR</span>
              <h2>Deney yapmak istediğin aynayı seç.</h2>
              <p>Düzlem ve çukur ayna deneyleri hazırdır. Tümsek ayna butonu sonraki deney için yerleştirildi.</p>
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
                <span><small>DENEY 03 · SIRADAKİ</small><b>Tümsek ayna</b><em>Dağılan ışınlar ve görüş alanı</em></span>
                <strong>Butonu aç →</strong>
              </button>
            </div>
          </section>
        )}

        {activeTopic === "prism" && <PrismLab />}
        {activeTopic === "mirrors" && activeMirror === "plane" && <PlaneMirrorLab />}
        {activeTopic === "mirrors" && activeMirror === "concave" && <ConcaveMirrorLab />}
        {activeTopic === "mirrors" && activeMirror === "convex" && (
          <section className="mirror-placeholder">
            <span>AYNALAR · SONRAKİ DENEY</span>
            <h2>Tümsek ayna</h2>
            <p>Buton ve görsel hazır. Bu deney, düzlem ayna çalışmasından sonra aynı ayrıntı düzeyinde hazırlanacak.</p>
            <button type="button" onClick={() => setActiveMirror("concave")}>Çukur ayna deneyini aç →</button>
          </section>
        )}
      </div>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark optics-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Dalgalar - Optik deney setleri</small>
          </span>
        </div>
        <p>Kırılma, prizma ve ayna deneyleri TYMM lise düzeyine uygun ideal ölçümlerle hazırlanır.</p>
        <a href="#optik-ust">Başa dön ↑</a>
      </footer>
    </main>
  );
}
