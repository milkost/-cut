const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const defaultStocks = [{ name: "Стандартен прът", length: 6000, quantity: null }];
const defaultParts = [
  { name: "Напречна греда A", length: 1840, quantity: 4 },
  { name: "Стойка B", length: 1260, quantity: 4 },
  { name: "Укрепващ елемент C", length: 920, quantity: 5 },
  { name: "Опора D", length: 540, quantity: 6 },
];
const colors = ["#d9e9dc", "#e8ebcf", "#f2dfd0", "#d9e7ed", "#e8dff0"];
let stocks = structuredClone(defaultStocks);
let parts = structuredClone(defaultParts);
let lastPlan = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderRows() {
  $("#stocks-body").innerHTML = stocks.map((stock, index) => `
    <tr data-index="${index}">
      <td><input data-field="name" aria-label="Наименование на вид ${index + 1}" placeholder="Напр. профил 40×40" value="${escapeHtml(stock.name)}"></td>
      <td><input data-field="length" aria-label="Дължина на вид ${index + 1}" type="number" min="0.1" step="any" placeholder="6000" value="${stock.length ?? ""}"></td>
      <td><input data-field="quantity" aria-label="Брой от вид ${index + 1}" type="number" min="1" step="1" placeholder="∞" value="${stock.quantity ?? ""}"></td>
      <td><button class="remove-row" type="button" data-remove="stock" aria-label="Премахни вид ${index + 1}">×</button></td>
    </tr>`).join("");
  $("#parts-body").innerHTML = parts.map((part, index) => `
    <tr data-index="${index}">
      <td><input data-field="name" aria-label="Наименование на детайл ${index + 1}" placeholder="Напр. детайл ${index + 1}" value="${escapeHtml(part.name)}"></td>
      <td><input data-field="length" aria-label="Дължина на детайл ${index + 1}" type="number" min="0.1" step="any" placeholder="1200" value="${part.length ?? ""}"></td>
      <td><input data-field="quantity" aria-label="Количество на детайл ${index + 1}" type="number" min="1" step="1" placeholder="1" value="${part.quantity ?? ""}"></td>
      <td><button class="remove-row" type="button" data-remove="part" aria-label="Премахни детайл ${index + 1}">×</button></td>
    </tr>`).join("");
  $("#stock-count").textContent = `${stocks.length} ${stocks.length === 1 ? "вид" : "вида"}`;
  $("#parts-count").textContent = `${parts.length} ${parts.length === 1 ? "позиция" : "позиции"}`;
  $$(".unit-label").forEach(label => { label.textContent = $("#unit").value; });
}

function readRows() {
  const read = (body, target) => {
    $$("#" + body + " tr").forEach((row, index) => {
      const values = Object.fromEntries($$("input", row).map(input => [input.dataset.field, input.value.trim()]));
      target[index] = {
        name: values.name,
        length: values.length === "" ? null : Number(values.length),
        quantity: values.quantity === "" ? null : Number(values.quantity),
      };
    });
  };
  read("stocks-body", stocks);
  read("parts-body", parts);
}

function setError(message = "") {
  const element = $("#form-error");
  element.textContent = message;
  element.hidden = !message;
}

function validate() {
  readRows();
  if (!stocks.length) return "Добавете поне един вид материал.";
  if (!parts.length) return "Добавете поне един детайл, за да изчислите плана.";
  for (const [index, stock] of stocks.entries()) {
    if (!Number.isFinite(stock.length) || stock.length <= 0) return `Въведете валидна дължина за вид материал ${index + 1}.`;
    if (stock.quantity !== null && (!Number.isInteger(stock.quantity) || stock.quantity < 1)) return `Броят на вид материал ${index + 1} трябва да е положително цяло число или да остане празен при неограничена наличност.`;
  }
  for (const [index, part] of parts.entries()) {
    if (!Number.isFinite(part.length) || part.length <= 0) return `Въведете валидна дължина за детайл ${index + 1}.`;
    if (!Number.isInteger(part.quantity) || part.quantity < 1) return `Количеството на детайл ${index + 1} трябва да е положително цяло число.`;
  }
  const kerf = Number($("#kerf").value);
  const trim = Number($("#trim").value);
  if (!Number.isFinite(kerf) || kerf < 0) return "Ширината на среза трябва да е число, равно или по-голямо от нула.";
  if (!Number.isFinite(trim) || trim < 0) return "Подрязването на прът трябва да е число, равно или по-голямо от нула.";
  return "";
}

function optimize() {
  const error = validate();
  if (error) {
    setError(error);
    return;
  }
  setError();
  const kerf = Number($("#kerf").value);
  const trim = Number($("#trim").value);
  const unit = $("#unit").value;
  const pieces = parts.flatMap((part, partIndex) =>
    Array.from({ length: part.quantity }, (_, copyIndex) => ({
      name: part.name || `Детайл ${partIndex + 1}`,
      length: part.length,
      id: `${partIndex}-${copyIndex}`,
      partIndex,
    }))).sort((a, b) => b.length - a.length || a.name.localeCompare(b.name));
  const buildPlan = (orderedPieces, strategy) => {
    const stockUse = stocks.map(stock => ({ ...stock, used: 0 }));
    const bars = [];
    const unplaced = [];

    for (const piece of orderedPieces) {
      const candidates = [];
      for (const bar of bars) {
        const extraKerf = bar.pieces.length ? kerf : 0;
        const remaining = bar.stock.length - trim - bar.used - extraKerf - piece.length;
        if (remaining >= -1e-9) {
          candidates.push({ kind: "existing", bar, stock: bar.stock, remaining: Math.max(0, remaining) });
        }
      }
      for (const stock of stockUse) {
        if (stock.quantity !== null && stock.used >= stock.quantity) continue;
        const remaining = stock.length - trim - piece.length;
        if (remaining >= -1e-9) {
          candidates.push({ kind: "new", stock, remaining: Math.max(0, remaining) });
        }
      }

      candidates.sort((a, b) => {
        if (strategy === 1 && a.kind !== b.kind) return a.kind === "existing" ? -1 : 1;
        if (strategy === 2) {
          const relativeFit = a.remaining / a.stock.length - b.remaining / b.stock.length;
          if (Math.abs(relativeFit) > 1e-9) return relativeFit;
        }
        return a.remaining - b.remaining || a.stock.length - b.stock.length || (a.kind === "existing" ? -1 : 1);
      });
      const chosen = candidates[0];
      if (!chosen) {
        unplaced.push(piece);
        continue;
      }

      let bar;
      if (chosen.kind === "existing") {
        bar = chosen.bar;
        bar.used += (bar.pieces.length ? kerf : 0) + piece.length;
      } else {
        chosen.stock.used += 1;
        bar = { stock: chosen.stock, used: piece.length, pieces: [], index: bars.length + 1 };
        bars.push(bar);
      }
      bar.pieces.push(piece);
    }
    return { bars, unplaced };
  };

  const scorePlan = plan => {
    const totalLength = plan.bars.reduce((sum, bar) => sum + bar.stock.length, 0);
    const usedLength = plan.bars.reduce((sum, bar) => sum + bar.used + trim, 0);
    return [
      plan.unplaced.length,
      plan.unplaced.reduce((sum, piece) => sum + piece.length, 0),
      totalLength,
      Math.max(0, totalLength - usedLength),
      plan.bars.length,
    ];
  };
  const isBetter = (candidate, current) => {
    if (!current) return true;
    const candidateScore = scorePlan(candidate);
    const currentScore = scorePlan(current);
    for (let index = 0; index < candidateScore.length; index += 1) {
      if (Math.abs(candidateScore[index] - currentScore[index]) > 1e-9) {
        return candidateScore[index] < currentScore[index];
      }
    }
    return false;
  };

  const alternatingOrder = [];
  for (let left = 0, right = pieces.length - 1; left <= right; left += 1, right -= 1) {
    alternatingOrder.push(pieces[left]);
    if (left !== right) alternatingOrder.push(pieces[right]);
  }
  let seed = pieces.reduce((value, piece) => (Math.imul(value, 31) + Math.round(piece.length * 10) + piece.partIndex) >>> 0, 0x9e3779b9);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const randomAttempts = pieces.length <= 80 ? 16 : pieces.length <= 300 ? 8 : pieces.length <= 800 ? 4 : 2;
  const trials = [
    { ordered: pieces, strategy: 0 },
    { ordered: [...pieces].reverse(), strategy: 0 },
    { ordered: alternatingOrder, strategy: 0 },
  ];
  for (let attempt = 0; attempt < randomAttempts; attempt += 1) {
    const ordered = [...pieces];
    for (let index = ordered.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
    }
    trials.push({ ordered, strategy: attempt % 3 });
  }

  let bestPlan = null;
  for (const trial of trials) {
    const candidate = buildPlan(trial.ordered, trial.strategy);
    if (isBetter(candidate, bestPlan)) bestPlan = candidate;
  }
  const { bars, unplaced } = bestPlan;
  const totalLength = bars.reduce((sum, bar) => sum + bar.stock.length, 0);
  const usedLength = bars.reduce((sum, bar) => sum + bar.used + trim, 0);
  lastPlan = {
    bars,
    unplaced,
    totalLength,
    usedLength,
    remaining: Math.max(0, totalLength - usedLength),
    utilization: totalLength ? Math.min(100, usedLength / totalLength * 100) : 0,
    unit,
    createdAt: Date.now(),
    input: { stocks: structuredClone(stocks), parts: structuredClone(parts), kerf, trim, unit },
  };
  renderResults(lastPlan);
  saveHistory(lastPlan);
}

function formatNumber(value) {
  return new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 2 }).format(value);
}

function renderResults(plan) {
  $("#empty-state").hidden = true;
  $("#results").hidden = false;
  $("#export-button").disabled = false;
  const cutCount = plan.bars.reduce((sum, bar) => sum + bar.pieces.length, 0);
  const barCount = plan.bars.length;
  const metrics = `
    <div class="result-summary">
      <div class="metric-card primary"><span class="metric-label">Използване</span><strong class="metric-value">${formatNumber(plan.utilization)}<small>%</small></strong></div>
      <div class="metric-card"><span class="metric-label">Използвани пръти</span><strong class="metric-value">${barCount}<small> бр.</small></strong></div>
      <div class="metric-card"><span class="metric-label">Детайли</span><strong class="metric-value">${cutCount}<small> бр.</small></strong></div>
    </div>
    <div class="utilization-wrap"><span>Използван материал</span><strong>${formatNumber(plan.usedLength)} / ${formatNumber(plan.totalLength)} ${plan.unit}</strong></div>
    <div class="utilization-track"><div class="utilization-fill" style="width:${plan.utilization}%"></div></div>
    <p class="algorithm-note">Сравнени са няколко варианта на разпределение. Това е най-добрият намерен план; глобален оптимум не е гарантиран.</p>`;
  const barMarkup = plan.bars.map((bar, index) => {
    const usable = Math.max(1, bar.stock.length - Number($("#trim").value));
    const segments = bar.pieces.map((piece, pieceIndex) => {
      const width = piece.length / usable * 100;
      const label = width > 12 ? escapeHtml(piece.name) : "";
      return `<div class="cut-segment" title="${escapeHtml(piece.name)} · ${formatNumber(piece.length)} ${plan.unit}" style="flex-basis:${width}%;background:${colors[pieceIndex % colors.length]}">${label}</div>`;
    }).join("");
    const pieceLabels = bar.pieces.map(piece =>
      `<span class="bar-piece-label">${escapeHtml(piece.name)} <strong>${formatNumber(piece.length)} ${plan.unit}</strong></span>`
    ).join("");
    const scrap = Math.max(0, bar.stock.length - bar.used - Number($("#trim").value));
    const scrapWidth = scrap / usable * 100;
    return `<article class="bar-plan">
      <div class="bar-plan-header"><span class="bar-plan-title">Прът ${String(index + 1).padStart(2, "0")} <span>${escapeHtml(bar.stock.name || "Материал")} · ${formatNumber(bar.stock.length)} ${plan.unit}</span></span><span class="bar-plan-waste">${formatNumber(scrap)} ${plan.unit} остатък</span></div>
      <div class="cut-bar" role="img" aria-label="Прът ${index + 1}, ${bar.pieces.length} детайла и ${formatNumber(scrap)} ${plan.unit} остатък">${segments}<div class="cut-segment scrap" style="width:${scrapWidth}%"></div></div>
      <div class="bar-pieces" aria-label="Размери на детайлите">${pieceLabels}</div>
      <div class="bar-legend"><span>${bar.pieces.length} ${bar.pieces.length === 1 ? "разрез" : "разреза"}</span><span>${formatNumber(bar.used + Number($("#trim").value))} ${plan.unit} използвани</span></div>
    </article>`;
  }).join("");
  const warning = plan.unplaced.length
    ? `<p class="result-warning"><strong>${plan.unplaced.length} ${plan.unplaced.length === 1 ? "детайл не е разпределен" : "детайла не са разпределени"}.</strong> Наличният материал не е достатъчен за ${plan.unplaced.map(piece => `${escapeHtml(piece.name)} (${formatNumber(piece.length)} ${plan.unit})`).join(", ")}. Проверете количеството или дължината на материала.</p>`
    : "";
  $("#results").innerHTML = metrics + (barMarkup || `<p class="result-warning">Не може да се разпредели материал за детайлите.</p>`) + warning;
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("trazo.history") || "[]");
  } catch (error) {
    console.error("Неуспешно зареждане на запазената история.", error);
    return [];
  }
}

function saveHistory(plan) {
  try {
    const history = getHistory();
    history.unshift({
      id: plan.createdAt,
      date: new Date(plan.createdAt).toLocaleString("bg-BG", { dateStyle: "medium", timeStyle: "short" }),
      stockCount: plan.bars.length,
      pieceCount: plan.bars.reduce((sum, bar) => sum + bar.pieces.length, 0),
      utilization: plan.utilization,
      input: plan.input,
    });
    localStorage.setItem("trazo.history", JSON.stringify(history.slice(0, 20)));
    renderHistory();
  } catch (error) {
    console.error("Неуспешно запазване на историята.", error);
    setError("Планът е изчислен, но историята не можа да бъде запазена на това устройство.");
  }
}

function renderHistory() {
  const history = getHistory();
  $("#history-count").textContent = history.length;
  $("#history-list").innerHTML = history.length ? history.map(item => `
    <div class="history-item">
      <div><strong>${item.stockCount} ${item.stockCount === 1 ? "прът" : "пръта"} · ${item.pieceCount} ${item.pieceCount === 1 ? "детайл" : "детайла"}</strong><span>${escapeHtml(item.date)} · ${formatNumber(item.utilization)}% използване</span></div>
      <button class="history-load" type="button" data-history-id="${item.id}">Отвори</button>
    </div>`).join("") : `<div class="history-empty">Все още няма запазени планове.<br>Следващото изчисление ще се появи тук.</div>`;
}

function loadHistory(id) {
  const item = getHistory().find(entry => entry.id === Number(id));
  if (!item) return;
  stocks = structuredClone(item.input.stocks);
  parts = structuredClone(item.input.parts);
  $("#kerf").value = item.input.kerf;
  $("#trim").value = item.input.trim;
  $("#unit").value = item.input.unit;
  renderRows();
  $("#history-dialog").close();
  optimize();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function exportPlan() {
  if (!lastPlan) return;
  const rows = [["Прът", "Материал", "Дължина на материала", "Позиция", "Дължина на детайла", "Остатък", "Единица"]];
  lastPlan.bars.forEach((bar, index) => bar.pieces.forEach(piece => rows.push([
    index + 1, bar.stock.name, bar.stock.length, piece.name, piece.length,
    Math.max(0, bar.stock.length - bar.used - lastPlan.input.trim), lastPlan.unit,
  ])));
  const csv = "\uFEFF" + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `trazo-plan-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importParts() {
  const input = $("#import-text").value.trim();
  const errorElement = $("#import-error");
  errorElement.textContent = "";
  if (!input) {
    errorElement.textContent = "Поставете поне един ред за импортиране.";
    return;
  }
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const parsed = [];
  for (const [index, line] of lines.entries()) {
    const fields = line.split(/[;,\t|]/).map(field => field.trim());
    if (index === 0 && /nombre|referencia|name|length|largo|име|позиция|дължина|количество/i.test(line)) continue;
    if (fields.length < 2) {
      errorElement.textContent = `Ред ${index + 1} не е в очаквания формат.`;
      return;
    }
    const [name, lengthValue, quantityValue = "1"] = fields;
    const length = Number(lengthValue.replace(",", "."));
    const quantity = Number(quantityValue);
    if (!Number.isFinite(length) || length <= 0 || !Number.isInteger(quantity) || quantity < 1) {
      errorElement.textContent = `Проверете дължината или количеството на ред ${index + 1}.`;
      return;
    }
    parsed.push({ name: name || `Импортиран детайл ${index + 1}`, length, quantity });
  }
  if (!parsed.length) {
    errorElement.textContent = "В списъка не са намерени валидни детайли.";
    return;
  }
  parts = parsed;
  renderRows();
  $("#import-dialog").close();
  $("#import-text").value = "";
  optimize();
}

function resetExample() {
  stocks = structuredClone(defaultStocks);
  parts = structuredClone(defaultParts);
  $("#kerf").value = "3";
  $("#trim").value = "0";
  $("#unit").value = "mm";
  renderRows();
  optimize();
}

$("#stocks-body").addEventListener("input", readRows);
$("#parts-body").addEventListener("input", readRows);
$("#stocks-body").addEventListener("click", event => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  readRows();
  stocks.splice(Number(button.closest("tr").dataset.index), 1);
  renderRows();
  setError();
});
$("#parts-body").addEventListener("click", event => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  readRows();
  parts.splice(Number(button.closest("tr").dataset.index), 1);
  renderRows();
  setError();
});
$("#add-stock").addEventListener("click", () => {
  readRows();
  stocks.push({ name: "", length: null, quantity: null });
  renderRows();
  $("#stocks-body tr:last-child input").focus();
});
$("#add-part").addEventListener("click", () => {
  readRows();
  parts.push({ name: "", length: null, quantity: 1 });
  renderRows();
  $("#parts-body tr:last-child input").focus();
});
$("#calculate").addEventListener("click", optimize);
$("#reset-button").addEventListener("click", resetExample);
$("#export-button").addEventListener("click", exportPlan);
$("#unit").addEventListener("change", () => {
  $$(".unit-label").forEach(label => { label.textContent = $("#unit").value; });
  if (lastPlan) {
    lastPlan.unit = $("#unit").value;
    renderResults(lastPlan);
  }
});
$("#import-open").addEventListener("click", () => $("#import-dialog").showModal());
$("#import-submit").addEventListener("click", importParts);
$("#history-open").addEventListener("click", () => {
  renderHistory();
  $("#history-dialog").showModal();
});
$$("[data-close-modal]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
$("#history-list").addEventListener("click", event => {
  const button = event.target.closest("[data-history-id]");
  if (button) loadHistory(button.dataset.historyId);
});
$("#clear-history").addEventListener("click", () => {
  try {
    localStorage.removeItem("trazo.history");
    renderHistory();
  } catch (error) {
    console.error("Неуспешно изчистване на историята.", error);
    $("#history-list").insertAdjacentHTML("afterbegin", `<p class="modal-error">Запазената история не можа да бъде изчистена.</p>`);
  }
});
$("#export-button").disabled = true;
renderRows();
renderHistory();
