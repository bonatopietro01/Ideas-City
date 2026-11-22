// Motore 3D della città, portato dall'artefatto "Città delle Idee" e generalizzato:
// quartieri, strade tra progetti collegati, segnali di "cosa manca",
// stili delle case (mare, montagna…) e città fuse con stili mescolati.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DefStile, STILI } from "@/lib/stili";
import { Citta, LIVELLI, LIVELLI_ATTIVITA, Progetto, Stile } from "@/lib/types";
import { FH, layoutCitta, zoneCitta } from "./city-layout";
import { BUDGET, creaKit, creaRng, generaPaesaggio, hashSeme, mobile } from "./landscape";

export interface Vista { pos: [number, number, number]; target: [number, number, number] }

export interface Scena {
  seleziona(id: string | null): void;
  vistaCitta(): void;
  vista(): Vista;
  distruggi(): void;
}

export function creaScena(host: HTMLElement, citta: Citta, onClick: (id: string) => void, opz: { vista?: Vista; anima?: boolean } = {}): Scena {
  const RIDUCI = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ANIMA = !RIDUCI && opz.anima !== false;
  const stileCitta = citta.stili.length ? citta.stili : (["citta"] as Stile[]);
  const base = STILI[stileCitta[0]];

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(base.cielo);

  // --- layout: quartieri su un cerchio, edifici ad anello nel quartiere (city-layout.ts, condiviso con il mondo)
  const layout = layoutCitta(citta);
  const centri = layout.quartieri;
  const estensione = layout.estensione;
  scene.fog = new THREE.Fog(base.cielo, estensione * 2.2, estensione * 5);

  const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.5, estensione * 10);
  const d = Math.max(estensione, 22) * (centri.length > 1 ? 0.95 : 1.35);
  const VISTA = { pos: new THREE.Vector3(d * 0.75, d * 0.8, d), target: new THREE.Vector3(0, 2, 0) };
  const controls = new OrbitControls(camera, renderer.domElement);
  if (opz.vista) {
    camera.position.fromArray(opz.vista.pos);
    controls.target.fromArray(opz.vista.target);
  } else {
    camera.position.copy(VISTA.pos);
    controls.target.copy(VISTA.target);
  }
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 8;
  controls.maxDistance = estensione * 5;
  controls.autoRotate = ANIMA && !opz.vista;
  controls.autoRotateSpeed = 0.35;

  scene.add(new THREE.HemisphereLight("#fff6e5", "#6b8a5a", 1.6));
  const sole = new THREE.DirectionalLight("#fff1d6", 2.2);
  sole.position.set(estensione * 0.6, estensione, estensione * 0.4);
  sole.castShadow = true;
  sole.shadow.mapSize.set(2048, 2048);
  Object.assign(sole.shadow.camera, { left: -estensione * 1.3, right: estensione * 1.3, top: estensione * 1.3, bottom: -estensione * 1.3, near: 1, far: estensione * 5 });
  scene.add(sole);

  // --- utilità (condivise con il mondo: landscape.ts)
  const kit = creaKit();
  const { mat, mesh, box, tex, scuro, etichetta, albero } = kit;
  // D3: seme dalla città; edifici e paesaggio usano due flussi separati
  const rnd = creaRng(hashSeme(citta.id));

  // facciata di un piano: muro + finestre + fascia nel colore del progetto
  function facciata(def: DefStile, colore: string, acceso: boolean, larghezza: number, stile: Stile) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 32;
    const x = c.getContext("2d")!;
    x.fillStyle = def.muro ?? colore; x.fillRect(0, 0, 128, 32);
    if (stile === "montagna") { x.fillStyle = "rgba(0,0,0,0.12)"; for (let i = 0; i < 32; i += 6) x.fillRect(0, i, 128, 1); }
    if (stile === "arte") { x.fillStyle = scuro(colore, 1.25); x.beginPath(); x.arc(110, 26, 14, 0, Math.PI * 2); x.fill(); }
    const n = Math.max(2, Math.round(larghezza * 0.9));
    const pw = 128 / n;
    for (let i = 0; i < n; i++) {
      x.fillStyle = acceso ? (rnd() > 0.2 ? def.finestraAccesa : scuro(def.finestraAccesa, 0.9)) : def.finestraSpenta;
      if (stile === "arte" || stile === "mare") { x.beginPath(); x.roundRect(i * pw + pw * 0.22, 7, pw * 0.56, 16, [6, 6, 0, 0]); x.fill(); }
      else x.fillRect(i * pw + pw * (stile === "tech" ? 0.08 : 0.22), 8, pw * (stile === "tech" ? 0.84 : 0.56), 15);
      if (stile === "montagna" || stile === "campagna") { x.fillStyle = def.bordo; x.fillRect(i * pw + pw * 0.14, 8, pw * 0.08, 15); x.fillRect(i * pw + pw * 0.78, 8, pw * 0.08, 15); }
    }
    // fascia: nelle case con muro fisso è nel colore del progetto, così restano riconoscibili
    x.fillStyle = def.muro ? colore : def.bordo;
    x.fillRect(0, 28, 128, 4);
    if (stile === "tech") { x.fillStyle = def.bordo; x.fillRect(0, 0, 128, 2); }
    return tex(c);
  }

  function cartello(simbolo: string, colore: string) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 96;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fffaf0"; x.fillRect(0, 0, 128, 96);
    x.fillStyle = colore; x.fillRect(0, 0, 128, 10);
    x.fillStyle = "#1f2a33"; x.font = "800 60px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(simbolo, 64, 56);
    return new THREE.MeshLambertMaterial({ map: tex(c) });
  }

  // tetto in base allo stile (o all'accento, nelle città fuse)
  function tetto(def: DefStile, stile: Stile, w: number, y: number, colore: string) {
    const g = new THREE.Group();
    if (def.tetto === "spiovente") {
      const r = mesh(new THREE.CylinderGeometry(0.01, (w + 0.8) * 0.72, 2.2, 4, 1), mat(def.coloreTetto));
      r.rotation.y = Math.PI / 4; r.position.y = y + 1.1; g.add(r);
      if (stile === "montagna") {
        const neve = mesh(new THREE.CylinderGeometry(0.01, (w + 0.8) * 0.36, 1.1, 4, 1), mat("#f5f7fa"));
        neve.rotation.y = Math.PI / 4; neve.position.y = y + 1.66; g.add(neve);
      } else {
        const camino = box(0.5, 1.2, 0.5, mat(def.bordo)); camino.position.set(w * 0.25, y + 1.3, w * 0.15); g.add(camino);
      }
    } else if (def.tetto === "cupola") {
      const c = mesh(new THREE.SphereGeometry(w * 0.48, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(def.coloreTetto));
      c.position.y = y; g.add(c);
      const punta = mesh(new THREE.ConeGeometry(0.2, 0.9, 8), mat(colore)); punta.position.y = y + w * 0.48 + 0.4; g.add(punta);
    } else if (def.tetto === "vetro") {
      const p = mesh(new THREE.CylinderGeometry(0.01, w * 0.68, 1.6, 4, 1), new THREE.MeshLambertMaterial({ color: def.coloreTetto, transparent: true, opacity: 0.55, emissive: new THREE.Color("#0b4a5a") }));
      p.rotation.y = Math.PI / 4; p.position.y = y + 0.8; g.add(p);
      const base = box(w + 0.3, 0.2, w + 0.3, mat("#1a2333")); base.position.y = y + 0.1; g.add(base);
    } else if (def.tetto === "terrazza") {
      const lastra = box(w + 0.5, 0.25, w + 0.5, mat(def.coloreTetto)); lastra.position.y = y + 0.12; g.add(lastra);
      const parap = box(w + 0.5, 0.4, 0.12, mat(def.bordo)); parap.position.set(0, y + 0.45, (w + 0.5) / 2); g.add(parap);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const pal = box(0.1, 1.2, 0.1, mat("#ffffff")); pal.position.set(sx * w * 0.3, y + 0.85, sz * w * 0.3); g.add(pal);
      }
      const perg = box(w * 0.7, 0.08, w * 0.7, mat("#c9a46a")); perg.position.y = y + 1.45; g.add(perg);
      const ombr = mesh(new THREE.ConeGeometry(0.8, 0.4, 8), mat(colore)); ombr.position.set(-w * 0.15, y + 1.1, w * 0.1); g.add(ombr);
    } else {
      const tt = box(w + 0.4, 0.35, w + 0.4, mat(def.coloreTetto)); tt.position.y = y + 0.17; g.add(tt);
      const giardino = box(w * 0.6, 0.2, w * 0.6, mat("#5d9c4f")); giardino.position.y = y + 0.45; g.add(giardino);
    }
    return g;
  }

  // --- terreno
  const prato = new THREE.Mesh(new THREE.CircleGeometry(estensione * 3, 64), mat(base.terreno));
  prato.rotation.x = -Math.PI / 2; prato.receiveShadow = true; scene.add(prato);
  const asfalto = mat("#6f747a");

  const lampeggianti: THREE.Object3D[] = [], gru: THREE.Object3D[] = [], crescita: THREE.Group[] = [], avvisi: THREE.Object3D[] = [];

  function edificio(p: Progetto, wBase: number) {
    const stile: Stile = p.stile ?? stileCitta[0];
    const def = STILI[stile];
    const defTetto = p.accento ? STILI[p.accento] : def;
    const stileTetto = p.accento ?? stile;
    const attivita = p.tipo === "attivita";
    const w = attivita ? wBase * 1.15 : wBase;
    const g = new THREE.Group();
    const lv = p.livello, colore = p.colore;
    const corpo = new THREE.Group(); g.add(corpo);
    const lotto = box(w + 3, 0.18, w + 3, mat(lv === 0 ? scuro(def.terreno, 1.05) : def.piazza)); lotto.position.y = 0.09; g.add(lotto);
    const bordo = box(w + 3.2, 0.12, 0.3, mat(colore)); bordo.position.set(0, 0.12, (w + 3) / 2); g.add(bordo);

    const fatte = p.tappe.filter((t) => t.s === "fatto");
    let altezza: number;
    const vuoto = attivita ? fatte.length === 0 : lv === 0 || p.tappe.length === 0;
    if (vuoto) {
      const palo = box(0.15, 2.2, 0.15, mat("#7a5634")); palo.position.set(0, 1.1, 0); g.add(palo);
      const cart = box(1.8, 1.3, 0.1, cartello(attivita ? "+" : "?", colore)); cart.position.set(0, 2.4, 0.1); g.add(cart);
      for (let i = 0; i < 3; i++) g.add(albero(def.albero, -w / 2 + rnd() * w, -w / 2 + rnd() * w * 0.6, 0.6 + rnd() * 0.3));
      altezza = 3.4;
    } else {
      const fond = box(w + 0.6, 0.5, w + 0.6, mat(stile === "montagna" ? "#8c8a84" : "#a7a39b")); fond.position.y = 0.43; corpo.add(fond);
      let y = 0.68;
      const fh = attivita ? 1.0 : FH;
      if (attivita) {
        // Attività: una casa che cresce di un piano ogni (gruppo di) volte che la fai
        const piani = Math.min(6, Math.max(1, Math.ceil(fatte.length / Math.max(1, Math.ceil(fatte.length / 6)))));
        for (let i = 0; i < piani; i++) {
          const lato = new THREE.MeshLambertMaterial({ map: facciata(def, colore, true, w, stile), emissive: new THREE.Color("#2a1e06") });
          const piano = box(w, fh, w, [lato, lato, mat(scuro(def.muro ?? colore)), mat(scuro(def.muro ?? colore)), lato, lato]);
          piano.position.y = y + fh / 2; corpo.add(piano);
          y += fh;
        }
        const daFare = p.tappe.filter((t) => t.s !== "fatto").length;
        if (daFare) {
          const m = p.tappe.some((t) => t.s === "chiarire") ? mat("#d1495b") : mat("#c9a46a");
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const pal = box(0.1, fh * 0.9, 0.1, m); pal.position.set((sx * w) / 2, y + fh * 0.45, (sz * w) / 2); corpo.add(pal);
          }
          y += fh * 0.9;
        }
        altezza = y;
        corpo.add(tetto(defTetto, stileTetto, w, altezza, colore));
        // recinto basso e giardino davanti
        const recinto = box(w + 2.6, 0.35, 0.08, mat("#ffffff")); recinto.position.set(0, 0.35, -(w + 2.6) / 2); g.add(recinto);
        for (let i = 0; i < 2; i++) g.add(albero(def.albero, (i ? 1 : -1) * (w / 2 + 0.9), w / 2 + 0.9, 0.55));
        altezza += defTetto.tetto === "spiovente" ? 2.3 : defTetto.tetto === "cupola" ? w * 0.5 + 0.8 : 1.6;
      } else {
        const ordine = { fatto: 0, parziale: 1, dafare: 2, chiarire: 3 };
        const tappe = p.tappe.slice().sort((a, b) => ordine[a.s] - ordine[b.s]);
        const impalc = mat("#c9a46a"), impalcRosso = mat("#d1495b");
        for (const t of tappe) {
          if (t.s === "fatto" || t.s === "parziale") {
            const lato = new THREE.MeshLambertMaterial({ map: facciata(def, colore, t.s === "fatto", w, stile), emissive: t.s === "fatto" ? new THREE.Color(stile === "tech" ? "#06303a" : "#3a2a08") : new THREE.Color("#000") });
            const top = mat(scuro(def.muro ?? colore));
            const piano = box(w, FH, w, [lato, lato, top, top, lato, lato]);
            piano.position.y = y + FH / 2; corpo.add(piano);
          } else {
            const m = t.s === "chiarire" ? impalcRosso : impalc;
            const solaio = box(w, 0.12, w, mat("#d9d2c2", { transparent: true, opacity: 0.85 })); solaio.position.y = y + 0.06; corpo.add(solaio);
            for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
              const pal = box(0.12, FH, 0.12, m); pal.position.set((sx * w) / 2, y + FH / 2, (sz * w) / 2); corpo.add(pal);
            }
            for (const k of [0, 1]) {
              const yy = y + FH * (0.5 + k * 0.45);
              const a = box(w, 0.08, 0.08, m); a.position.set(0, yy, w / 2); corpo.add(a);
              const b = box(0.08, 0.08, w, m); b.position.set(w / 2, yy, 0); corpo.add(b);
              const c = a.clone(); c.position.z = -w / 2; corpo.add(c);
              const dd = b.clone(); dd.position.x = -w / 2; corpo.add(dd);
            }
          }
          y += FH;
        }
        altezza = y;
        if (lv <= 2) for (let i = 0; i < 3; i++) {
          const cono = mesh(new THREE.ConeGeometry(0.25, 0.6, 10), mat("#ff7a1a"));
          cono.position.set(w / 2 + 1 - i * 0.7, 0.48, w / 2 + 1.1); g.add(cono);
        }
        if (lv >= 2) {
          const n = Math.min(6, 2 + p.tappe.length);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + 0.4;
            g.add(albero(def.albero, Math.cos(a) * (w / 2 + 1.1), Math.sin(a) * (w / 2 + 1.1), 0.55));
          }
        }
        if (lv === 3) {
          const cg = new THREE.Group();
          const torre = box(0.35, altezza + 4, 0.35, mat("#f2b632")); torre.position.y = (altezza + 4) / 2; cg.add(torre);
          const braccio = new THREE.Group(); braccio.position.y = altezza + 4;
          const b1 = box(w + 5, 0.3, 0.3, mat("#f2b632")); b1.position.x = (w + 5) / 2 - 2; braccio.add(b1);
          const cp = box(1, 0.7, 0.7, mat("#5d6b77")); cp.position.x = -2; braccio.add(cp);
          const cavo = box(0.04, 3, 0.04, mat("#333")); cavo.position.set(w + 1.5, -1.5, 0); braccio.add(cavo);
          cg.add(braccio); cg.position.set(-w / 2 - 1, 0, -w / 2 - 1); g.add(cg);
          gru.push(braccio);
          altezza += 4.5;
        }
        if (lv >= 4) {
          corpo.add(tetto(defTetto, stileTetto, w, altezza, colore));
          altezza += defTetto.tetto === "spiovente" ? 2.3 : defTetto.tetto === "cupola" ? w * 0.5 + 0.8 : 1.4;
        }
        if (lv >= 5) {
          const ant = box(0.12, 3.2, 0.12, mat("#c9ced3")); ant.position.y = altezza + 1.6; corpo.add(ant);
          const luce = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: "#ff3b30" }));
          luce.position.y = altezza + 3.3; corpo.add(luce); lampeggianti.push(luce);
          const asta = box(0.08, 2.4, 0.08, mat("#ddd")); asta.position.set(w / 2 + 1, 1.2, w / 2 + 1); g.add(asta);
          const band = box(1.2, 0.7, 0.04, mat(colore)); band.position.set(w / 2 + 1.6, 2.1, w / 2 + 1); g.add(band);
          altezza += 3.6;
        }
        altezza += 0.8;
      }
      crescita.push(corpo);
    }

    if (p.lacune.length) {
      const c = document.createElement("canvas");
      c.width = 96; c.height = 96;
      const x = c.getContext("2d")!;
      x.fillStyle = "#d1495b"; x.beginPath(); x.arc(48, 48, 44, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.font = "800 52px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(String(p.lacune.length), 48, 52);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), depthTest: false, transparent: true }));
      s.scale.set(1.3, 1.3, 1);
      s.renderOrder = 11;
      s.position.set(w / 2 + 1.2, 1.8, w / 2 + 1.2);
      g.add(s);
      avvisi.push(s);
    }
    // idee raccolte non ancora costruite: lampadina gialla sul lotto
    if (p.idee.some((i) => !i.usata)) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: "#ffd23f" }));
      l.position.set(-w / 2 - 1.1, 1.6, w / 2 + 1.1);
      g.add(l); lampeggianti.push(l);
    }
    return { g, h: altezza, w };
  }

  // --- posiziona edifici
  const selezionabili: THREE.Object3D[] = [];
  const registro: Record<string, { p: Progetto; g: THREE.Group; h: number; w: number }> = {};
  for (const { q, ps, cx, cz, r } of centri) {
    // nelle città fuse ogni quartiere prende la piazza dello stile della maggioranza delle sue case
    const conta: Record<string, number> = {};
    ps.forEach((p) => { const s = p.stile ?? stileCitta[0]; conta[s] = (conta[s] ?? 0) + 1; });
    const sq = STILI[(Object.entries(conta).sort((a, b) => b[1] - a[1])[0][0]) as Stile];
    const piazza = new THREE.Mesh(new THREE.CircleGeometry(r + 4.5, 64), mat(sq.piazza));
    piazza.rotation.x = -Math.PI / 2; piazza.position.set(cx, 0.03, cz); piazza.receiveShadow = true; scene.add(piazza);
    const anello = new THREE.Mesh(new THREE.RingGeometry(r + 4.5, r + 7, 96), asfalto);
    anello.rotation.x = -Math.PI / 2; anello.position.set(cx, 0.02, cz); anello.receiveShadow = true; scene.add(anello);
    const insegna = etichetta(q.nome, `${ps.length} edifici`, "#ff6b2c");
    insegna.scale.set(10, 2.9, 1);
    insegna.position.set(cx, 1.8, cz + r + (r ? 5.7 : 8.5));
    (insegna.material as THREE.SpriteMaterial).depthTest = true;
    scene.add(insegna);
    ps.forEach((p) => {
      const { x, z, rotY, wBase } = layout.pos[p.id];
      const { g, h, w } = edificio(p, wBase);
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      const fatte = p.tappe.filter((t) => t.s === "fatto").length;
      const sotto = p.tipo === "attivita"
        ? `${LIVELLI_ATTIVITA[p.livello].nome} · fatta ${fatte} volte`
        : `${LIVELLI[p.livello].nome} · ${fatte}/${p.tappe.length} tappe`;
      const lab = etichetta(p.nome, sotto, p.colore);
      lab.position.set(x, h + 2.2, z);
      scene.add(lab);
      g.traverse((o) => { o.userData.id = p.id; });
      lab.userData.id = p.id;
      selezionabili.push(g, lab);
      scene.add(g);
      registro[p.id] = { p, g, h, w };
    });
  }

  // --- strade tra progetti collegati
  const fatti = new Set<string>();
  const stradaMat = mat("#8a8f95");
  for (const p of citta.progetti) for (const c of p.collegamenti) {
    const k = [p.id, c].sort().join("|");
    if (fatti.has(k) || !registro[c] || !registro[p.id]) continue;
    fatti.add(k);
    const a = registro[p.id].g.position, b = registro[c].g.position;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, a.distanceTo(b)), stradaMat);
    s.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    s.position.set((a.x + b.x) / 2, 0.04, (a.z + b.z) / 2);
    s.receiveShadow = true;
    scene.add(s);
  }

  // --- paesaggio (landscape.ts): ogni stile occupa uno spicchio intorno (fusione = paesaggi affiancati),
  // con boschi, catene innevate, laghi, fiumi e ponti; seme proprio, stabile al variare degli edifici
  const paesaggio = generaPaesaggio(kit, {
    stili: stileCitta,
    centro: [0, 0],
    rInterno: estensione + 2,
    rEsterno: estensione * 3,
    seme: hashSeme(citta.id + "|paesaggio"),
    zone: zoneCitta(layout, citta),
    scala: mobile() ? BUDGET.mobile : BUDGET.desktop,
  });
  scene.add(paesaggio.gruppo);

  // --- selezione e volo camera
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.1, 48), new THREE.MeshBasicMaterial({ color: "#ff6b2c", transparent: true, opacity: 0.9 }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  let volo: null | { t: number; da: { tg: THREE.Vector3; ps: THREE.Vector3 }; a: { tg: THREE.Vector3; ps: THREE.Vector3 } } = null;
  const vola = (tg: THREE.Vector3, ps: THREE.Vector3) => {
    if (RIDUCI) { controls.target.copy(tg); camera.position.copy(ps); return; }
    volo = { t: 0, da: { tg: controls.target.clone(), ps: camera.position.clone() }, a: { tg, ps } };
  };

  function seleziona(id: string | null) {
    if (!id || !registro[id]) { ring.visible = false; return; }
    const r = registro[id];
    controls.autoRotate = false;
    const s = r.w / 4;
    ring.scale.set(s, s, s);
    ring.position.set(r.g.position.x, 0.25, r.g.position.z);
    ring.visible = true;
    const gp = r.g.position;
    const dir = new THREE.Vector3(camera.position.x - gp.x, 0, camera.position.z - gp.z);
    if (dir.lengthSq() < 1) dir.set(0.6, 0, 1);
    dir.normalize();
    const tg = new THREE.Vector3(gp.x, r.h * 0.45, gp.z);
    if (window.innerWidth < 760) tg.y = Math.max(0, tg.y - 2.5); // mai sotto il prato
    const dist = 16 + r.h * 0.9;
    vola(tg, new THREE.Vector3(gp.x + dir.x * dist, r.h * 0.55 + dist * 0.55, gp.z + dir.z * dist));
  }

  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let giu: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => { giu = { x: e.clientX, y: e.clientY }; controls.autoRotate = false; };
  const onUp = (e: PointerEvent) => {
    if (!giu || Math.hypot(e.clientX - giu.x, e.clientY - giu.y) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(selezionabili, true).find((h) => h.object.userData.id);
    if (hit) onClick(hit.object.userData.id);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  const resize = () => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);

  crescita.forEach((c, i) => { c.scale.y = ANIMA ? 0.001 : 1; c.userData.ritardo = i * 0.08; });
  const clock = new THREE.Clock();
  let raf = 0;
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!RIDUCI) {
      if (ANIMA) crescita.forEach((c) => { const k = Math.min(1, Math.max(0, (t - c.userData.ritardo) / 1.1)); c.scale.y = Math.max(0.001, 1 - Math.pow(1 - k, 3)); });
      gru.forEach((b, i) => { b.rotation.y = Math.sin(t * 0.25 + i) * 0.9; });
      lampeggianti.forEach((l, i) => { l.visible = Math.sin(t * 3 + i) > -0.3; });
      avvisi.forEach((a, i) => { a.position.y = 1.8 + Math.sin(t * 2 + i) * 0.15; });
      paesaggio.aggiorna(t);
      if (ring.visible) (ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.35 * Math.sin(t * 3);
    }
    if (volo) {
      volo.t = Math.min(1, volo.t + dt / 1.1);
      const k = 1 - Math.pow(1 - volo.t, 3);
      controls.target.lerpVectors(volo.da.tg, volo.a.tg, k);
      camera.position.lerpVectors(volo.da.ps, volo.a.ps, k);
      if (volo.t >= 1) volo = null;
    }
    controls.update();
    if (camera.position.y < 2) camera.position.y = 2; // mai sotto il prato
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  return {
    seleziona,
    vistaCitta() { ring.visible = false; vola(VISTA.target.clone(), VISTA.pos.clone()); },
    vista: () => ({ pos: camera.position.toArray() as Vista["pos"], target: controls.target.toArray() as Vista["target"] }),
    distruggi() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      controls.dispose();
      paesaggio.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          const lista = (Array.isArray(o.material) ? o.material : [o.material]) as (THREE.Material & { map?: THREE.Texture | null })[];
          lista.forEach((m) => { m.map?.dispose(); m.dispose(); });
        }
      });
      kit.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
