(() => {
  "use strict";
  const REF = window.REF;
    const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // ---------- Données en mémoire (sauvegarde via export / import JSON) ----------
  const seed = () => window.SEED.map((p) => ({ id: uid(), ...p, createdAt: p.receivedAt, updatedAt: p.receivedAt }));
  let projects = seed();
  let dirty = false;
  const save = () => { dirty = true; };
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- Dimensions ----------
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const monthKey = (d) => (d || "").slice(0, 7);
  const monthLabel = (k) => { if (!k) return "—"; const [y, m] = k.split("-"); return `${MONTHS[+m - 1]} ${y}`; };
  const quarterKey = (d) => { if (!d) return ""; const m = +d.slice(5, 7); return `${d.slice(0, 4)}-T${Math.ceil(m / 3)}`; };
  const DIMS = {
    format: { label: "Format", get: (p) => p.format, order: REF.format },
    destination: { label: "Destination", get: (p) => p.destination, order: REF.destination },
    genre: { label: "Genre", get: (p) => p.genre, order: REF.genre },
    status: { label: "Statut", get: (p) => p.status, order: REF.status },
    verdict: { label: "Avis", get: (p) => p.verdict || "—", order: REF.verdict },
    senderType: { label: "Type d'expéditeur", get: (p) => p.senderType, order: REF.senderType },
    sender: { label: "Expéditeur", get: (p) => p.sender || "—" },
    reader: { label: "Lecteur·rice", get: (p) => p.reader || "Non attribué" },
    author: { label: "Auteur", get: (p) => p.author || "—" },
    month: { label: "Mois de réception", get: (p) => monthKey(p.receivedAt), fmt: monthLabel, sortKey: true },
    quarter: { label: "Trimestre", get: (p) => quarterKey(p.receivedAt), fmt: (k) => k.replace("-", " "), sortKey: true },
    year: { label: "Année", get: (p) => (p.receivedAt || "").slice(0, 4), sortKey: true },
  };
  const FACETS = ["status", "format", "genre", "destination", "verdict", "senderType", "sender", "reader"];
  const fmtDim = (dim, v) => (DIMS[dim].fmt ? DIMS[dim].fmt(v) : v);

  const STATUS_CLS = { "À lire": "st-alire", "En lecture": "st-encours", "Lu": "st-lu", "En discussion": "st-disc", "Retenu": "st-ret", "Refusé": "st-ref", "En attente": "st-att" };
  const STATUS_ORDER = Object.fromEntries(REF.status.map((s, i) => [s, i]));

  // ---------- Filter state ----------
  const state = {
    view: "list",
    q: "", from: "", to: "",
    facets: Object.fromEntries(FACETS.map((f) => [f, new Set()])),
    drill: [], // [{dim, val}] from pivot cells
    sort: "date-desc",
    expanded: new Set(),
    pv: { rows: "genre", cols: "format", measure: "count" },
  };

  const matchesText = (p) => {
    if (!state.q) return true;
    const q = state.q.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const hay = [p.title, p.author, p.sender, p.logline, p.notes, p.genre, p.reader].join(" ").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    return hay.includes(q);
  };
  const matchesBase = (p) =>
    matchesText(p) &&
    (!state.from || p.receivedAt >= state.from) &&
    (!state.to || p.receivedAt <= state.to) &&
    state.drill.every((d) => DIMS[d.dim].get(p) === d.val);
  const matchesFacets = (p, except) =>
    FACETS.every((f) => f === except || state.facets[f].size === 0 || state.facets[f].has(DIMS[f].get(p)));
  const filtered = () => projects.filter((p) => matchesBase(p) && matchesFacets(p));

  const sortList = (list) => {
    const s = state.sort;
    const byDate = (a, b) => (a.receivedAt || "").localeCompare(b.receivedAt || "");
    const cmp = {
      "date-desc": (a, b) => byDate(b, a),
      "date-asc": byDate,
      "title-asc": (a, b) => a.title.localeCompare(b.title, "fr"),
      "title-desc": (a, b) => b.title.localeCompare(a.title, "fr"),
      "rating-desc": (a, b) => (b.rating || 0) - (a.rating || 0) || byDate(b, a),
      "rating-asc": (a, b) => (a.rating || 0) - (b.rating || 0) || byDate(b, a),
      status: (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99) || byDate(b, a),
    }[s];
    return [...list].sort(cmp);
  };

  // ---------- Helpers ----------
  const fmtDate = (d) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
  const daysAgo = (d) => {
    if (!d) return "";
    const n = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d + "T00:00:00")) / 86400000);
    if (n <= 0) return "aujourd'hui";
    if (n === 1) return "hier";
    if (n < 31) return `il y a ${n} j`;
    if (n < 365) return `il y a ${Math.round(n / 30)} mois`;
    return `il y a ${Math.floor(n / 365)} an${n >= 730 ? "s" : ""}`;
  };
  const stars = (r) => { r = +r || 0; if (!r) return `<span class="rating"><span class="off">—</span></span>`; return `<span class="rating" aria-label="${r} sur 5">${"★".repeat(r)}<span class="off">${"★".repeat(5 - r)}</span></span>`; };
  const statusPill = (s) => `<span class="status ${STATUS_CLS[s] || "st-alire"}">${esc(s)}</span>`;
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200); };

  // ---------- KPIs ----------
  function renderKpis(list) {
    const total = list.length;
    const toRead = list.filter((p) => p.status === "À lire").length;
    const reading = list.filter((p) => p.status === "En lecture").length;
    const read = list.filter((p) => !["À lire", "En lecture"].includes(p.status));
    const kept = list.filter((p) => ["Retenu", "En discussion"].includes(p.status)).length;
    const rated = list.filter((p) => +p.rating > 0);
    const avg = rated.length ? (rated.reduce((s, p) => s + +p.rating, 0) / rated.length).toFixed(1).replace(".", ",") : "—";
    const now = new Date(); const d90 = new Date(now - 90 * 864e5).toISOString().slice(0, 10);
    const recent = list.filter((p) => p.receivedAt >= d90).length;
    const backlog = list.filter((p) => p.status === "À lire").map((p) => (now - new Date(p.receivedAt)) / 864e5);
    const oldest = backlog.length ? Math.round(Math.max(...backlog)) : 0;
    const k = [
      ["Projets", total, `${recent} reçus sur 90 jours`],
      ["À lire", toRead, oldest ? `plus ancien : ${oldest} j` : "pile vide"],
      ["En lecture", reading, "en cours"],
      ["Lus", read.length, total ? `${Math.round((read.length / total) * 100)} % du flux` : "—"],
      ["Retenus / en discussion", kept, read.length ? `${Math.round((kept / read.length) * 100)} % des lus` : "—"],
      ["Note moyenne", avg, `${rated.length} projet${rated.length > 1 ? "s" : ""} noté${rated.length > 1 ? "s" : ""}`],
    ];
    $("#kpis").innerHTML = k.map(([l, v, s]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-sub">${s}</div></div>`).join("");
  }

  // ---------- Facets ----------
  function facetValues(f) {
    const d = DIMS[f];
    const vals = new Set(projects.map(d.get).filter(Boolean));
    let arr = [...vals];
    if (d.order) arr.sort((a, b) => (d.order.indexOf(a) + 1 || 99) - (d.order.indexOf(b) + 1 || 99));
    else arr.sort((a, b) => a.localeCompare(b, "fr"));
    return arr;
  }
  function renderFacets() {
    const base = projects.filter(matchesBase);
    $("#facet-groups").innerHTML = FACETS.map((f) => {
      const vals = facetValues(f);
      const counts = {};
      base.filter((p) => matchesFacets(p, f)).forEach((p) => { const v = DIMS[f].get(p); counts[v] = (counts[v] || 0) + 1; });
      const limit = state.expanded.has(f) ? Infinity : 7;
      const shown = vals.filter((v, i) => i < limit || state.facets[f].has(v));
      const sel = state.facets[f].size;
      return `<div class="facet">
        <div class="facet-head"><span class="facet-title">${DIMS[f].label}</span>${sel ? `<button class="link" data-clear-facet="${f}">Effacer (${sel})</button>` : ""}</div>
        ${shown.map((v) => `<label class="facet-opt ${counts[v] ? "" : "zero"}"><input type="checkbox" data-facet="${f}" value="${esc(v)}" ${state.facets[f].has(v) ? "checked" : ""}/><span class="lbl" title="${esc(v)}">${esc(v)}</span><span class="cnt">${counts[v] || 0}</span></label>`).join("")}
        ${vals.length > 7 ? `<button class="link facet-more" data-expand="${f}">${state.expanded.has(f) ? "Réduire" : `Voir les ${vals.length}`}</button>` : ""}
      </div>`;
    }).join("");
  }

  function renderChips() {
    const chips = [];
    if (state.q) chips.push({ k: "q", label: `« ${state.q} »` });
    if (state.from || state.to) chips.push({ k: "date", label: `${state.from ? fmtDate(state.from) : "…"} → ${state.to ? fmtDate(state.to) : "…"}` });
    FACETS.forEach((f) => state.facets[f].forEach((v) => chips.push({ k: "facet", f, v, label: `${DIMS[f].label} : ${v}` })));
    state.drill.forEach((d, i) => chips.push({ k: "drill", i, label: `${DIMS[d.dim].label} : ${fmtDim(d.dim, d.val)}` }));
    $("#active-chips").innerHTML = chips.map((c, i) => `<button class="chip" data-chip="${i}">${esc(c.label)} <span aria-hidden="true">×</span></button>`).join("");
    renderChips.chips = chips;
  }

  // ---------- List ----------
  function renderList(list) {
    const sorted = sortList(list);
    $("#result-count").innerHTML = `<strong>${list.length}</strong> projet${list.length > 1 ? "s" : ""} sur ${projects.length}`;
    $("#projects-body").innerHTML = sorted.map((p) => `
      <tr data-id="${p.id}" tabindex="0">
        <td class="td-date">${fmtDate(p.receivedAt)}<span class="ago">${daysAgo(p.receivedAt)}</span></td>
        <td class="td-title"><div class="p-title">${esc(p.title)}</div><div class="p-author">${esc(p.author || "Auteur non renseigné")}</div>${p.logline ? `<div class="p-log">${esc(p.logline)}</div>` : ""}</td>
        <td><span class="fmt">${esc(p.format || "—")}</span><span class="dest">${esc(p.destination || "")}</span></td>
        <td class="td-genre">${esc(p.genre || "—")}</td>
        <td class="td-sender">${esc(p.sender || "—")}<span class="st">${esc(p.senderType || "")}</span></td>
        <td>${statusPill(p.status)}</td>
        <td>${stars(p.rating)}<span class="verdict ${p.verdict === "Coup de cœur" ? "heart" : ""}">${p.verdict && p.verdict !== "—" ? esc(p.verdict) : ""}</span></td>
      </tr>`).join("");
    $("#empty").hidden = list.length > 0;
    $("#projects-table").hidden = list.length === 0;
    // header arrows
    const [key, dir] = state.sort.split("-");
    $$(".projects th.sortable").forEach((th) => {
      th.querySelector(".arrow")?.remove();
      if (th.dataset.sort === key) th.insertAdjacentHTML("beforeend", `<span class="arrow">${dir === "asc" ? "↑" : "↓"}</span>`);
    });
    $("#sort").value = state.sort;
  }

  // ---------- Pivot ----------
  function orderedKeys(dim, keys) {
    const d = DIMS[dim];
    if (d.order) return keys.sort((a, b) => (d.order.indexOf(a) + 1 || 99) - (d.order.indexOf(b) + 1 || 99));
    if (d.sortKey) return keys.sort();
    return keys.sort((a, b) => a.localeCompare(b, "fr"));
  }
  function measure(items, rowItems) {
    const m = state.pv.measure;
    if (!items.length) return { v: null, txt: "·" };
    if (m === "count") return { v: items.length, txt: String(items.length) };
    if (m === "pct-row") { const v = rowItems.length ? items.length / rowItems.length : 0; return { v, txt: `${Math.round(v * 100)} %` }; }
    if (m === "avg-rating") { const r = items.filter((p) => +p.rating > 0); if (!r.length) return { v: null, txt: "–" }; const v = r.reduce((s, p) => s + +p.rating, 0) / r.length; return { v, txt: v.toFixed(1).replace(".", ",") }; }
    if (m === "retained") { const v = items.filter((p) => ["Retenu", "En discussion"].includes(p.status) || ["Favorable", "Coup de cœur"].includes(p.verdict)).length / items.length; return { v, txt: `${Math.round(v * 100)} %` }; }
  }
  function renderPivot(list) {
    const { rows, cols } = state.pv;
    const R = DIMS[rows], C = DIMS[cols];
    const rKeys = orderedKeys(rows, [...new Set(list.map(R.get))]);
    const cKeys = orderedKeys(cols, [...new Set(list.map(C.get))]);
    const grid = {};
    list.forEach((p) => { const r = R.get(p), c = C.get(p); ((grid[r] ||= {})[c] ||= []).push(p); });
    const rowAll = (r) => list.filter((p) => R.get(p) === r);
    const colAll = (c) => list.filter((p) => C.get(p) === c);
    const cells = [];
    rKeys.forEach((r) => cKeys.forEach((c) => { const m = measure(grid[r]?.[c] || [], rowAll(r)); if (m.v != null) cells.push(m.v); }));
    const max = state.pv.measure === "avg-rating" ? 5 : state.pv.measure === "count" ? Math.max(1, ...cells) : 1;
    const min = state.pv.measure === "avg-rating" ? 1 : 0;
    const bg = (v) => { if (v == null) return ""; const a = Math.max(0.04, Math.min(0.85, ((v - min) / (max - min || 1)) * 0.8 + 0.05)); return `background: rgba(var(--heat), ${a.toFixed(3)}); color: ${a > 0.5 ? "var(--on-accent)" : "inherit"}`; };
    const showTot = state.pv.measure !== "pct-row";
    let html = `<thead><tr><th class="corner">${R.label} \\ ${C.label}</th>${cKeys.map((c) => `<th>${esc(fmtDim(cols, c))}</th>`).join("")}<th class="tot">Total</th></tr></thead><tbody>`;
    rKeys.forEach((r) => {
      const ra = rowAll(r);
      html += `<tr><th class="rowh">${esc(fmtDim(rows, r))}</th>`;
      cKeys.forEach((c) => {
        const items = grid[r]?.[c] || [];
        const m = measure(items, ra);
        html += items.length
          ? `<td class="cell" style="${bg(m.v)}" data-r="${esc(r)}" data-c="${esc(c)}" title="${items.length} projet(s) — ${esc(items.map((p) => p.title).join(", "))}">${m.txt}</td>`
          : `<td class="empty-cell">·</td>`;
      });
      const mt = state.pv.measure === "pct-row" ? { txt: "100 %" } : measure(ra, ra);
      html += `<td class="tot cell" data-r="${esc(r)}">${mt.txt}</td></tr>`;
    });
    if (showTot) {
      html += `<tr><th class="rowh tot">Total</th>${cKeys.map((c) => { const ca = colAll(c); return `<td class="tot cell" data-c="${esc(c)}">${measure(ca, ca).txt}</td>`; }).join("")}<td class="tot">${measure(list, list).txt}</td></tr>`;
    }
    html += "</tbody>";
    if (!list.length) html = `<tbody><tr><td class="empty-cell" style="text-align:center;padding:40px">Aucun projet avec ces filtres.</td></tr></tbody>`;
    $("#pivot-table").innerHTML = html;
    renderFlow(list);
  }

  const FLOW_COLORS = ["#8b2e2a", "#c46a3b", "#d9a441", "#7d8f4e", "#3f7a7a", "#2f5a73", "#6b4f8a"];
  function renderFlow(list) {
    const months = list.map((p) => monthKey(p.receivedAt)).filter(Boolean).sort();
    if (!months.length) { $("#flow-chart").innerHTML = ""; $("#flow-legend").innerHTML = ""; return; }
    const keys = [];
    let [y, m] = months[0].split("-").map(Number);
    const [ey, em] = months[months.length - 1].split("-").map(Number);
    while (y < ey || (y === ey && m <= em)) { keys.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
    const by = {}; list.forEach((p) => { const k = monthKey(p.receivedAt); ((by[k] ||= {})[p.format] = (by[k]?.[p.format] || 0) + 1); });
    const tot = (k) => Object.values(by[k] || {}).reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...keys.map(tot));
    const fmts = REF.format.filter((f) => list.some((p) => p.format === f));
    $("#flow-legend").innerHTML = fmts.map((f) => `<span><i style="background:${FLOW_COLORS[REF.format.indexOf(f) % FLOW_COLORS.length]}"></i>${esc(f)}</span>`).join("");
    $("#flow-chart").innerHTML = keys.map((k) => {
      const t = tot(k);
      const segs = fmts.map((f) => { const n = by[k]?.[f] || 0; return n ? `<span style="height:${(n / max) * 130}px;background:${FLOW_COLORS[REF.format.indexOf(f) % FLOW_COLORS.length]}" title="${esc(f)} : ${n}"></span>` : ""; }).join("");
      return `<div class="bar-col"><span class="bar-n">${t || ""}</span><div class="bar" data-month="${k}" title="${monthLabel(k)} : ${t} projet(s)">${segs}</div><span class="bar-m">${monthLabel(k)}</span></div>`;
    }).join("");
  }

  function renderPivotSelects() {
    const opts = (sel) => Object.entries(DIMS).map(([k, d]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${d.label}</option>`).join("");
    $("#pv-rows").innerHTML = opts(state.pv.rows);
    $("#pv-cols").innerHTML = opts(state.pv.cols);
    $("#pv-measure").value = state.pv.measure;
  }

  // ---------- Render all ----------
  function render() {
    const list = filtered();
    renderKpis(list);
    renderFacets();
    renderChips();
    if (state.view === "list") renderList(list); else renderPivot(list);
    $("#dl-author").innerHTML = [...new Set(projects.map((p) => p.author).filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join("");
    $("#dl-sender").innerHTML = [...new Set(projects.map((p) => p.sender).filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join("");
    $("#dl-reader").innerHTML = [...new Set(projects.map((p) => p.reader).filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join("");
  }

  function setView(v) {
    state.view = v;
    $$(".tab").forEach((t) => { const on = t.dataset.view === v; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", on); });
    $("#view-list").hidden = v !== "list";
    $("#view-pivot").hidden = v !== "pivot";
    render();
  }

  // ---------- Drawer / fiche ----------
  const form = $("#fiche");
  let editingId = null;
  const F = (k) => form.querySelector(`[name="${k}"]`);
  const fillSelect = (name, list) => { F(name).innerHTML = list.map((v) => `<option>${esc(v)}</option>`).join(""); };
  fillSelect("format", REF.format); fillSelect("destination", REF.destination); fillSelect("genre", REF.genre);
  fillSelect("senderType", REF.senderType); fillSelect("status", REF.status); fillSelect("verdict", REF.verdict);

  function setStars(n) {
    F("rating").value = n || 0;
    $("#stars").innerHTML = [1, 2, 3, 4, 5].map((i) => `<button type="button" role="radio" aria-checked="${i === +n}" aria-label="${i} sur 5" data-star="${i}" class="${i <= n ? "on" : ""}">★</button>`).join("") + (n ? `<button type="button" class="clear" data-star="0">Effacer</button>` : "");
  }
  function openDrawer(id) {
    editingId = id || null;
    const p = id ? projects.find((x) => x.id === id) : { receivedAt: new Date().toISOString().slice(0, 10), status: "À lire", verdict: "—", format: "Synopsis", destination: "Série TV", genre: "Drame", senderType: "Agent", rating: 0 };
    ["title", "author", "sender", "senderType", "receivedAt", "format", "destination", "genre", "length", "logline", "status", "reader", "verdict", "notes", "next"].forEach((k) => { F(k).value = p[k] ?? ""; });
    setStars(+p.rating || 0);
    $("#drawer-title").textContent = id ? p.title : "Nouveau projet";
    $("#drawer-eyebrow").textContent = id ? `Fiche de lecture · ${p.format}` : "Nouvelle fiche de lecture";
    $("#btn-delete").hidden = !id;
    $("#fiche-meta").textContent = id && p.updatedAt ? `Dernière modification : ${fmtDate(p.updatedAt.slice(0, 10))}` : "";
    $("#scrim").hidden = false;
    const d = $("#drawer"); d.classList.add("open"); d.setAttribute("aria-hidden", "false");
    setTimeout(() => F("title").focus(), 50);
  }
  function closeDrawer() {
    const d = $("#drawer"); d.classList.remove("open"); d.setAttribute("aria-hidden", "true");
    $("#scrim").hidden = true; editingId = null;
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.title = data.title.trim();
    if (!data.title) { F("title").focus(); toast("Le titre est obligatoire."); return; }
    if (!data.receivedAt) { F("receivedAt").focus(); toast("La date de réception est obligatoire."); return; }
    data.rating = +data.rating || 0;
    const now = new Date().toISOString();
    if (editingId) { const i = projects.findIndex((p) => p.id === editingId); projects[i] = { ...projects[i], ...data, updatedAt: now }; toast("Fiche enregistrée."); }
    else { projects.push({ id: uid(), ...data, createdAt: now, updatedAt: now }); toast("Projet ajouté."); }
    save(); closeDrawer(); render();
  });
  $("#stars").addEventListener("click", (e) => { const b = e.target.closest("[data-star]"); if (b) setStars(+b.dataset.star); });
  $("#drawer-close").onclick = closeDrawer; $("#btn-cancel").onclick = closeDrawer; $("#scrim").onclick = closeDrawer;
  $("#btn-delete").onclick = () => {
    const p = projects.find((x) => x.id === editingId);
    confirmDialog("Supprimer ce projet ?", `« ${p.title} » et sa fiche de lecture seront définitivement supprimés.`, "Supprimer", () => {
      projects = projects.filter((x) => x.id !== p.id); save(); closeDrawer(); render(); toast("Projet supprimé.");
    });
  };

  function confirmDialog(title, text, okLabel, onOk) {
    $("#modal-title").textContent = title; $("#modal-text").textContent = text; $("#modal-ok").textContent = okLabel;
    $("#modal").hidden = false; $("#modal-cancel").focus();
    $("#modal-ok").onclick = () => { $("#modal").hidden = true; onOk(); };
    $("#modal-cancel").onclick = () => { $("#modal").hidden = true; };
  }

  // ---------- Events ----------
  $$(".tab").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));
  $("#btn-new").onclick = () => openDrawer();
  $("#projects-body").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openDrawer(tr.dataset.id); });
  $("#projects-body").addEventListener("keydown", (e) => { if (e.key === "Enter") { const tr = e.target.closest("tr[data-id]"); if (tr) openDrawer(tr.dataset.id); } });
  let qT; $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 120); });
  $("#date-from").addEventListener("change", (e) => { state.from = e.target.value; render(); });
  $("#date-to").addEventListener("change", (e) => { state.to = e.target.value; render(); });
  $("#facet-groups").addEventListener("change", (e) => {
    const cb = e.target.closest("[data-facet]"); if (!cb) return;
    const s = state.facets[cb.dataset.facet]; cb.checked ? s.add(cb.value) : s.delete(cb.value); render();
  });
  $("#facet-groups").addEventListener("click", (e) => {
    const c = e.target.closest("[data-clear-facet]"); if (c) { state.facets[c.dataset.clearFacet].clear(); render(); }
    const x = e.target.closest("[data-expand]"); if (x) { const f = x.dataset.expand; state.expanded.has(f) ? state.expanded.delete(f) : state.expanded.add(f); renderFacets(); }
  });
  $("#active-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-chip]"); if (!b) return;
    const c = renderChips.chips[+b.dataset.chip];
    if (c.k === "q") { state.q = ""; $("#q").value = ""; }
    if (c.k === "date") { state.from = state.to = ""; $("#date-from").value = $("#date-to").value = ""; }
    if (c.k === "facet") state.facets[c.f].delete(c.v);
    if (c.k === "drill") state.drill.splice(c.i, 1);
    render();
  });
  const resetFilters = () => {
    state.q = state.from = state.to = ""; state.drill = [];
    FACETS.forEach((f) => state.facets[f].clear());
    $("#q").value = $("#date-from").value = $("#date-to").value = "";
    render();
  };
  $("#reset-filters").onclick = resetFilters; $("#empty-reset").onclick = resetFilters;
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $$(".projects th.sortable").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.sort; const [cur, dir] = state.sort.split("-");
    const def = { date: "desc", title: "asc", rating: "desc" }[k];
    let next = cur === k ? (dir === "asc" ? "desc" : "asc") : def;
    state.sort = `${k}-${next}`;
    if (![...$("#sort").options].some((o) => o.value === state.sort)) { const o = new Option(th.textContent.replace(/[↑↓]/g, "").trim() + (next === "asc" ? " ↑" : " ↓"), state.sort); $("#sort").add(o); }
    render();
  }));
  $("#toggle-filters").onclick = () => $("#filters").classList.toggle("show");

  // Pivot events
  $("#pv-rows").onchange = (e) => { state.pv.rows = e.target.value; render(); };
  $("#pv-cols").onchange = (e) => { state.pv.cols = e.target.value; render(); };
  $("#pv-measure").onchange = (e) => { state.pv.measure = e.target.value; render(); };
  $("#pv-swap").onclick = () => { const { rows, cols } = state.pv; state.pv.rows = cols; state.pv.cols = rows; renderPivotSelects(); render(); };
  $("#pivot-table").addEventListener("click", (e) => {
    const td = e.target.closest("td.cell"); if (!td) return;
    const add = (dim, val) => { state.drill = state.drill.filter((d) => d.dim !== dim); state.drill.push({ dim, val }); };
    if (td.dataset.r !== undefined) add(state.pv.rows, td.dataset.r);
    if (td.dataset.c !== undefined) add(state.pv.cols, td.dataset.c);
    setView("list"); toast("Fiches filtrées depuis le tableau croisé.");
  });
  $("#flow-chart").addEventListener("click", (e) => {
    const b = e.target.closest("[data-month]"); if (!b) return;
    state.drill = state.drill.filter((d) => d.dim !== "month"); state.drill.push({ dim: "month", val: b.dataset.month });
    setView("list");
  });

  // Data menu
  const menu = $("#data-menu");
  $("#btn-menu").onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; $("#btn-menu").setAttribute("aria-expanded", !menu.hidden); };
  document.addEventListener("click", (e) => { if (!menu.contains(e.target)) menu.hidden = true; });
  const download = (name, content, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  menu.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    menu.hidden = true;
    const stamp = new Date().toISOString().slice(0, 10);
    if (act === "export-json") { dirty = false; toast("Sauvegarde JSON téléchargée."); } if (act === "export-json") download(`comite-lecture-${stamp}.json`, JSON.stringify(projects, null, 2), "application/json");
    if (act === "export-csv") {
      const cols = ["receivedAt", "title", "author", "sender", "senderType", "format", "destination", "genre", "length", "logline", "status", "reader", "verdict", "rating", "notes", "next"];
      const head = ["Date de réception", "Titre", "Auteur", "Expéditeur", "Type d'expéditeur", "Format", "Destination", "Genre", "Longueur", "Logline", "Statut", "Lecteur", "Avis", "Note", "Notes", "Suite à donner"];
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = sortList(filtered()).map((p) => cols.map((c) => q(p[c])).join(";"));
      download(`comite-lecture-${stamp}.csv`, "\uFEFF" + [head.map(q).join(";"), ...rows].join("\n"), "text/csv;charset=utf-8");
      toast("Export CSV des projets filtrés.");
    }
    if (act === "reset-demo") confirmDialog("Recharger les exemples ?", "Vos projets actuels seront remplacés par le jeu d'exemples.", "Recharger", () => { projects = seed(); save(); resetFilters(); toast("Exemples rechargés."); });
    if (act === "clear-all") confirmDialog("Tout effacer ?", "Tous les projets et fiches de lecture seront supprimés. Pensez à exporter une sauvegarde JSON.", "Tout effacer", () => { projects = []; save(); resetFilters(); toast("Base vidée."); });
  });
  $("#import-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data)) throw 0;
      projects = data.filter((p) => p && p.title).map((p) => ({ id: p.id || uid(), ...p }));
      save(); menu.hidden = true; resetFilters(); toast(`${projects.length} projets importés.`);
    } catch { toast("Fichier JSON invalide."); }
    e.target.value = "";
  });

  // Theme
  const root = document.documentElement;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = prefersDark ? "dark" : "light";
  $("#theme-toggle").onclick = () => { root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark"; };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!$("#modal").hidden) $("#modal").hidden = true; else if ($("#drawer").classList.contains("open")) closeDrawer(); }
  });

  renderPivotSelects();
  render();
})();
