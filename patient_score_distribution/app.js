const state = {
  data: null,
  selectedPatient: null,
  scoreMode: "totalScore",
  filter: null,
};

const scoreModeLabels = {
  totalScore: "Total score",
  noEligibilityScore: "Score without eligibility",
  riskBenefitScore: "Risk + benefit score",
};

const palette = [
  "#2563EB",
  "#F97316",
  "#16A34A",
  "#DC2626",
  "#7C3AED",
  "#0891B2",
  "#CA8A04",
  "#DB2777",
];

const patientSelect = document.getElementById("patientSelect");
const scoreModeSelect = document.getElementById("scoreModeSelect");
const clearFilterButton = document.getElementById("clearFilterButton");
const selectionAllButton = document.getElementById("selectionAllButton");
const datasetSummary = document.getElementById("datasetSummary");
const patientMetric = document.getElementById("patientMetric");
const trialMetric = document.getElementById("trialMetric");
const showingMetric = document.getElementById("showingMetric");
const filterMetric = document.getElementById("filterMetric");
const patientNoteText = document.getElementById("patientNoteText");
const histogramTitle = document.getElementById("histogramTitle");
const histogramEl = document.getElementById("histogram");
const pieGrid = document.getElementById("pieGrid");
const trialList = document.getElementById("trialList");
const trialListTitle = document.getElementById("trialListTitle");

function svgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function textEl(name, text, attrs = {}) {
  const el = svgEl(name, attrs);
  el.textContent = text;
  return el;
}

function formatLabel(label) {
  const replacements = {
    "not enough information": "not enough info",
    "active diagnostic or sample collection": "active dx/sample",
    "behavioral or lifestyle": "behavior/lifestyle",
    "device or procedure": "device/procedure",
    "modification of standard treatment": "modify SOC",
    "replacement of standard care": "replace SOC",
    "known side effects or risks": "known SE/risks",
    "no incremental benefit": "no incr. benefit",
    "optimization of existing care": "optimize care",
    "effective options exist": "effective options",
    "no effective standard care": "no effective SOC",
  };
  return replacements[label] || label;
}

function patientRecords() {
  const records = state.data.records.filter((record) => record.queryId === state.selectedPatient);
  if (state.scoreMode === "noEligibilityScore") {
    return records.filter((record) => record.labels.eligibility !== "ineligible");
  }
  return records;
}

function filteredRecords(records) {
  if (!state.filter) return records;
  if (state.filter.type === "score") {
    return records.filter((record) => record[state.scoreMode] === state.filter.score);
  }
  if (state.filter.type === "label") {
    return records.filter(
      (record) => record.labels[state.filter.dimension] === state.filter.label,
    );
  }
  return records;
}

function setFilter(nextFilter) {
  if (
    state.filter &&
    nextFilter &&
    JSON.stringify(state.filter) === JSON.stringify(nextFilter)
  ) {
    state.filter = null;
  } else {
    state.filter = nextFilter;
  }
  render();
}

function clearFilter() {
  state.filter = null;
  render();
}

function setPatient(queryId) {
  state.selectedPatient = queryId;
  state.filter = null;
  render();
}

function setScoreMode(mode) {
  state.scoreMode = mode;
  state.filter = null;
  render();
}

function activeFilterText() {
  if (!state.filter) {
    return state.scoreMode === "noEligibilityScore" ? "All non-ineligible trials" : "All trials";
  }
  if (state.filter.type === "score") {
    return `${scoreModeLabels[state.scoreMode]} = ${state.filter.score}`;
  }
  const dim = state.data.dimensions.find((item) => item.key === state.filter.dimension);
  return `${dim.label}: ${state.filter.label}`;
}

function renderSummary(records, visibleRecords) {
  const patient = state.data.patients.find((item) => item.queryId === state.selectedPatient);
  patientMetric.textContent = state.selectedPatient;
  trialMetric.textContent = String(records.length);
  showingMetric.textContent = String(visibleRecords.length);
  filterMetric.textContent = activeFilterText();
  clearFilterButton.disabled = !state.filter;
  selectionAllButton.hidden = !state.filter;
  histogramTitle.textContent = `${scoreModeLabels[state.scoreMode]} distribution`;
  trialListTitle.textContent = `Trials (${visibleRecords.length})`;
  datasetSummary.textContent = `${state.data.recordCount.toLocaleString()} scored trials across ${state.data.patientCount.toLocaleString()} patients`;
  if (patient) {
    patientMetric.textContent = `${patient.queryId}`;
    patientNoteText.textContent = patient.note || "No note text available.";
  }
}

function renderHistogram(records) {
  histogramEl.replaceChildren();
  const width = 1100;
  const height = 300;
  const margin = { top: 22, right: 18, bottom: 52, left: 48 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const counts = new Map();
  records.forEach((record) => {
    const score = Number(record[state.scoreMode]);
    counts.set(score, (counts.get(score) || 0) + 1);
  });
  const observedScores = [...counts.keys()].sort((a, b) => a - b);
  const scores = observedScores.length
    ? Array.from(
        { length: observedScores[observedScores.length - 1] - observedScores[0] + 1 },
        (_, index) => observedScores[0] + index,
      )
    : [];
  const maxCount = Math.max(1, ...counts.values());
  const svg = svgEl("svg", {
    class: "chart-svg",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `${scoreModeLabels[state.scoreMode]} histogram`,
  });

  if (!scores.length) {
    svg.appendChild(textEl("text", "No trials", { x: width / 2, y: height / 2, "text-anchor": "middle", class: "empty-state" }));
    histogramEl.appendChild(svg);
    return;
  }

  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    const count = Math.round(maxCount * frac);
    const y = margin.top + plotH - (count / maxCount) * plotH;
    svg.appendChild(svgEl("line", {
      x1: margin.left,
      y1: y.toFixed(2),
      x2: width - margin.right,
      y2: y.toFixed(2),
      stroke: "#E1E6EE",
      "stroke-width": "1",
    }));
    svg.appendChild(textEl("text", String(count), {
      x: margin.left - 9,
      y: (y + 4).toFixed(2),
      "text-anchor": "end",
      class: "bar-label",
      "font-size": "12",
    }));
  }

  const slot = plotW / scores.length;
  const barW = Math.max(7, slot * 0.72);
  scores.forEach((score, index) => {
    const count = counts.get(score);
    const x = margin.left + index * slot + (slot - barW) / 2;
    const barH = (count / maxCount) * plotH;
    const y = margin.top + plotH - barH;
    const group = svgEl("g", {
      class: [
        "bar-button",
        state.filter?.type === "score" && state.filter.score === score ? "is-active" : "",
        state.filter?.type === "score" && state.filter.score !== score ? "is-muted" : "",
      ].join(" ").trim(),
      role: "button",
      tabindex: "0",
      "aria-label": `${scoreModeLabels[state.scoreMode]} ${score}, ${count} trials`,
    });
    group.appendChild(svgEl("rect", {
      class: "bar-rect",
      x: x.toFixed(2),
      y: y.toFixed(2),
      width: barW.toFixed(2),
      height: barH.toFixed(2),
      rx: "3",
    }));
    group.appendChild(textEl("text", String(count), {
      x: (x + barW / 2).toFixed(2),
      y: (Math.max(14, y - 6)).toFixed(2),
      "text-anchor": "middle",
      class: "bar-count",
    }));
    const labelY = margin.top + plotH + 24;
    group.appendChild(textEl("text", String(score), {
      x: (x + barW / 2).toFixed(2),
      y: labelY,
      "text-anchor": "middle",
      class: "bar-label",
      "font-size": "12",
    }));
    group.addEventListener("click", () => setFilter({ type: "score", score }));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setFilter({ type: "score", score });
      }
    });
    svg.appendChild(group);
  });

  svg.appendChild(textEl("text", scoreModeLabels[state.scoreMode], {
    x: margin.left + plotW / 2,
    y: height - 10,
    "text-anchor": "middle",
    class: "bar-label",
    "font-size": "13",
    "font-weight": "700",
  }));
  histogramEl.appendChild(svg);
}

function polarPoint(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

function countsForDimension(records, dimension) {
  const counts = new Map();
  records.forEach((record) => {
    const label = record.labels[dimension.key] || "missing";
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const ordered = [];
  dimension.order.forEach((label) => {
    if (counts.has(label)) ordered.push([label, counts.get(label)]);
  });
  [...counts.keys()]
    .filter((label) => !dimension.order.includes(label))
    .sort()
    .forEach((label) => ordered.push([label, counts.get(label)]));
  return ordered;
}

function renderPies(records) {
  pieGrid.replaceChildren();
  state.data.dimensions.forEach((dimension) => {
    const panel = document.createElement("article");
    panel.className = "pie-panel";
    const title = document.createElement("h3");
    title.className = "pie-title";
    title.textContent = dimension.label;
    panel.appendChild(title);

    const layout = document.createElement("div");
    layout.className = "pie-layout";
    const svg = svgEl("svg", {
      class: "pie-svg",
      viewBox: "0 0 160 160",
      role: "img",
      "aria-label": `${dimension.label} distribution`,
    });
    const legend = document.createElement("div");
    legend.className = "legend";
    const entries = countsForDimension(records, dimension);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);

    if (!total) {
      svg.appendChild(svgEl("circle", { cx: "80", cy: "80", r: "58", class: "pie-empty" }));
    } else {
      let start = -Math.PI / 2;
      entries.forEach(([label, count], index) => {
        const end = start + (count / total) * Math.PI * 2;
        const color = palette[index % palette.length];
        const isActive =
          state.filter?.type === "label" &&
          state.filter.dimension === dimension.key &&
          state.filter.label === label;
        const group = svgEl("g", {
          class: `slice-button${isActive ? " is-active" : ""}`,
          role: "button",
          tabindex: "0",
          "aria-label": `${dimension.label}, ${label}, ${count} trials`,
        });
        if (count === total) {
          group.appendChild(svgEl("circle", { cx: "80", cy: "80", r: "58", fill: color }));
        } else {
          group.appendChild(svgEl("path", {
            d: arcPath(80, 80, 58, start, end),
            fill: color,
          }));
        }
        group.addEventListener("click", () => setFilter({ type: "label", dimension: dimension.key, label }));
        group.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setFilter({ type: "label", dimension: dimension.key, label });
          }
        });
        svg.appendChild(group);
        start = end;
      });
      svg.appendChild(svgEl("circle", { cx: "80", cy: "80", r: "29", fill: "#FBFCFE" }));
      svg.appendChild(textEl("text", String(total), {
        x: "80",
        y: "84",
        "text-anchor": "middle",
        "font-size": "18",
        "font-weight": "800",
        fill: "#18212F",
      }));
    }

    entries.forEach(([label, count], index) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = palette[index % palette.length];
      const labelEl = document.createElement("span");
      labelEl.className = "legend-label";
      labelEl.textContent = formatLabel(label);
      const countEl = document.createElement("span");
      countEl.className = "legend-count";
      countEl.textContent = `${count}`;
      item.append(swatch, labelEl, countEl);
      legend.appendChild(item);
    });

    layout.append(svg, legend);
    panel.appendChild(layout);
    pieGrid.appendChild(panel);
  });
}

function renderTrialList(records) {
  trialList.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "empty-text";
    empty.textContent = "No trials match the current selection.";
    trialList.appendChild(empty);
    return;
  }
  const sorted = [...records].sort((a, b) => {
    const byScore = Number(b[state.scoreMode]) - Number(a[state.scoreMode]);
    if (byScore !== 0) return byScore;
    return a.trialId.localeCompare(b.trialId);
  });
  sorted.forEach((record) => {
    const row = document.createElement("div");
    row.className = "trial-row";

    const link = document.createElement("a");
    link.className = "trial-link";
    link.href = `https://clinicaltrials.gov/study/${record.trialId}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = record.trialId;

    const score = document.createElement("span");
    score.className = "score-pill";
    score.textContent = String(record[state.scoreMode]);

    const titleBox = document.createElement("div");
    const title = document.createElement("div");
    title.className = "trial-title";
    title.textContent = record.title || record.trialId;
    const meta = document.createElement("div");
    meta.className = "trial-meta";
    meta.textContent = [record.dataset, record.practicalityLocation, record.practicalityDate]
      .filter(Boolean)
      .join(" · ");
    titleBox.append(title, meta);

    row.append(link, score, titleBox);
    trialList.appendChild(row);
  });
}

function render() {
  const records = patientRecords();
  const visibleRecords = filteredRecords(records);
  renderSummary(records, visibleRecords);
  renderHistogram(records);
  renderPies(visibleRecords);
  renderTrialList(visibleRecords);
}

function populateControls() {
  patientSelect.replaceChildren();
  state.data.patients.forEach((patient) => {
    const option = document.createElement("option");
    option.value = patient.queryId;
    option.textContent = `${patient.queryId} (${patient.trialCount})`;
    patientSelect.appendChild(option);
  });
  const params = new URLSearchParams(window.location.search);
  const requestedPatient = params.get("patient");
  const firstPatient = state.data.patients[0]?.queryId;
  state.selectedPatient = state.data.patients.some((patient) => patient.queryId === requestedPatient)
    ? requestedPatient
    : firstPatient;
  patientSelect.value = state.selectedPatient;
}

patientSelect.addEventListener("change", (event) => setPatient(event.target.value));
scoreModeSelect.addEventListener("change", (event) => setScoreMode(event.target.value));
clearFilterButton.addEventListener("click", clearFilter);
selectionAllButton.addEventListener("click", clearFilter);

fetch("data.json?v=patient-notes-20260520", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load data.json: ${response.status}`);
    return response.json();
  })
  .then((payload) => {
    state.data = payload;
    populateControls();
    render();
  })
  .catch((error) => {
    datasetSummary.textContent = error.message;
    histogramEl.textContent = "Data could not be loaded.";
  });
