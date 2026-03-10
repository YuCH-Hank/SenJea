const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwtEGF6RTPePO1i4J7Vh8Ju4WOWPU6XJj8T8mSs7AdgwJOzGXdpp2BpnhSXC4m6w6LX/exec";

const STAFF_TOGGLE_NAMES = [
  "余承翰",
  "向興聖",
  "呂龍雄",
  "陳慶星",
  "郭靖瑋",
  "郭俊廷",
  "鄒永福",
  "徐子凡",
  "石雅龍",
];
const COUNT_NAMES = [
  "吊掛",
  "洗孔",
  "防火填塞",
  "弘憶",
  "詠業",
  "聖勳",
  "帝律",
  "頂成",
  "兆又昌",
  "其他",
];
const PEOPLE_NAMES = [...STAFF_TOGGLE_NAMES, ...COUNT_NAMES];

const recordForm = document.getElementById("recordForm");
const projectNameInput = document.getElementById("projectName");
const workDateInput = document.getElementById("workDate");
const siteInputs = Array.from(document.querySelectorAll('input[name="site"]'));
const attendanceToggles = Array.from(
  document.querySelectorAll(".attendance-toggle"),
);
const countInputs = Array.from(
  document.querySelectorAll('input[name="peopleCount"]'),
);
const statusMessage = document.getElementById("statusMessage");

const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

const searchInput = document.getElementById("searchInput");
const filterProjectNameInput = document.getElementById("filterProjectName");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const reloadBtn = document.getElementById("reloadBtn");
const exportBtn = document.getElementById("exportBtn");
const historyCount = document.getElementById("historyCount");
const historyList = document.getElementById("historyList");
const summaryTableWrap = document.getElementById("summaryTableWrap");

let allRecords = [];

function init() {
  setDefaultDate();
  bindEvents();
  attendanceToggles.forEach(updateAttendanceButton);
  fetchHistory();
}

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  workDateInput.value = `${yyyy}-${mm}-${dd}`;
}

function bindEvents() {
  recordForm.addEventListener("submit", submitRecord);
  reloadBtn.addEventListener("click", fetchHistory);
  exportBtn.addEventListener("click", exportCsv);
  searchInput.addEventListener("input", applyFilters);
  filterProjectNameInput.addEventListener("input", applyFilters);
  startDateInput.addEventListener("change", applyFilters);
  endDateInput.addEventListener("change", applyFilters);

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tabTarget));
  });

  attendanceToggles.forEach((button) => {
    button.addEventListener("click", () => {
      button.dataset.value = button.dataset.value === "1" ? "0" : "1";
      updateAttendanceButton(button);
    });
  });

  historyList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-delete-id]");
    if (!deleteButton) return;

    const recordId = deleteButton.dataset.deleteId;
    const ok = window.confirm("確定要刪除這筆資料嗎？");
    if (!ok) return;

    await deleteRecord(recordId);
  });
}

function showTab(targetId) {
  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tabTarget === targetId);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === targetId);
  });
}

function updateAttendanceButton(button) {
  const active = button.dataset.value === "1";
  button.textContent = active ? "有出工" : "未出工";
  button.classList.toggle("is-active", active);
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#b91c1c" : "#2563eb";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSelectedSites() {
  return siteInputs
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function getPeopleDetail() {
  const peopleDetail = {};

  attendanceToggles.forEach((button) => {
    if (button.dataset.value === "1") {
      peopleDetail[button.dataset.name] = 1;
    }
  });

  countInputs.forEach((input) => {
    const value = Number(input.value || 0);
    if (value > 0) {
      peopleDetail[input.dataset.name] = value;
    }
  });

  return peopleDetail;
}

function validateForm(payload) {
  if (!payload.projectName) return "請輸入工程名稱";
  if (!payload.workDate) return "請選擇出工日期";
  if (!payload.site) return "請至少勾選一個出工地點";
  if (!Object.keys(payload.peopleDetail).length)
    return "請至少登記一位出工人員或一項工項人數";
  return "";
}

async function submitRecord(event) {
  event.preventDefault();

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("請貼上")) {
    setStatus("請先設定 APPS_SCRIPT_URL", true);
    return;
  }

  const payload = {
    action: "add",
    projectName: projectNameInput.value.trim(),
    workDate: workDateInput.value,
    site: getSelectedSites().join("、"),
    peopleDetail: getPeopleDetail(),
  };

  const error = validateForm(payload);
  if (error) {
    setStatus(error, true);
    return;
  }

  setStatus("送出中...");

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message || "送出失敗");

    resetForm();
    setStatus("登記成功");
    await fetchHistory();
    showTab("historyTab");
  } catch (error) {
    setStatus(error.message || "發生錯誤", true);
  }
}

function resetForm() {
  recordForm.reset();
  setDefaultDate();
  siteInputs.forEach((input) => {
    input.checked = false;
  });
  attendanceToggles.forEach((button) => {
    button.dataset.value = "0";
    updateAttendanceButton(button);
  });
  countInputs.forEach((input) => {
    input.value = 0;
  });
}

async function fetchHistory() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("請貼上")) {
    historyCount.textContent = "請先設定 APPS_SCRIPT_URL";
    historyList.innerHTML =
      '<div class="empty-state">尚未設定 Google Apps Script 網址</div>';
    summaryTableWrap.innerHTML =
      '<div class="empty-state">尚未設定 Google Apps Script 網址</div>';
    return;
  }

  historyCount.textContent = "讀取中...";
  historyList.innerHTML = "";
  summaryTableWrap.innerHTML = "";

  try {
    const response = await fetch(
      `${APPS_SCRIPT_URL}?action=list&ts=${Date.now()}`,
    );
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "讀取失敗");

    allRecords = Array.isArray(result.data) ? result.data : [];
    applyFilters();
  } catch (error) {
    historyCount.textContent = "讀取失敗";
    const message = escapeHtml(error.message || "發生錯誤");
    historyList.innerHTML = `<div class="empty-state">${message}</div>`;
    summaryTableWrap.innerHTML = `<div class="empty-state">${message}</div>`;
  }
}

async function deleteRecord(recordId) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("請貼上")) return;

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "delete", recordId }),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message || "刪除失敗");

    await fetchHistory();
  } catch (error) {
    window.alert(error.message || "刪除失敗");
  }
}

function normalizePeopleDetail(record) {
  const result = {};
  PEOPLE_NAMES.forEach((name) => {
    result[name] = 0;
  });

  const source =
    record.peopleDetail && typeof record.peopleDetail === "object"
      ? record.peopleDetail
      : {};
  Object.keys(source).forEach((name) => {
    result[name] = Number(source[name] || 0);
  });

  return result;
}

function applyFilters() {
  const keyword = searchInput.value.trim().toLowerCase();
  const projectKeyword = filterProjectNameInput.value.trim().toLowerCase();
  const start = startDateInput.value || "";
  const end = endDateInput.value || "";

  const filtered = allRecords.filter((record) => {
    const workDate = formatDateOnly(record.workDate || record.createdAt || "");
    const peopleDetail = normalizePeopleDetail(record);
    const searchText = [
      record.projectName || "",
      record.site || "",
      workDate,
      ...Object.keys(peopleDetail),
      ...Object.entries(peopleDetail).map(
        ([name, count]) => `${name} ${count}`,
      ),
    ]
      .join(" ")
      .toLowerCase();

    if (keyword && !searchText.includes(keyword)) return false;
    if (
      projectKeyword &&
      !(record.projectName || "").toLowerCase().includes(projectKeyword)
    )
      return false;
    if (start && workDate < start) return false;
    if (end && workDate > end) return false;
    return true;
  });

  renderHistory(filtered);
  renderSummary(filtered);
}

function renderHistory(records) {
  historyCount.textContent = `共 ${records.length} 筆資料`;

  if (!records.length) {
    historyList.innerHTML =
      '<div class="empty-state">目前沒有符合條件的資料</div>';
    return;
  }

  historyList.innerHTML = records
    .map((record) => {
      const peopleDetail = normalizePeopleDetail(record);
      const badges = Object.entries(peopleDetail)
        .filter(([, count]) => Number(count) > 0)
        .map(
          ([name, count]) =>
            `<span class="badge">${escapeHtml(name)} × ${count}</span>`,
        )
        .join("");

      return `
      <article class="history-item">
        <div class="history-title">${escapeHtml(record.projectName || "未填工程名稱")}｜${escapeHtml(record.site || "未填地點")}</div>
        <div class="history-meta">出工日期：${escapeHtml(formatDateOnly(record.workDate || record.createdAt || ""))}　登記時間：${escapeHtml(formatDateTime(record.createdAt || ""))}</div>
        <div class="badge-list">${badges || '<span class="badge">無資料</span>'}</div>
        <div class="history-actions">
          <button type="button" class="button button--danger" data-delete-id="${escapeHtml(record.recordId || "")}">刪除</button>
        </div>
      </article>
    `;
    })
    .join("");
}

function renderSummary(records) {
  const grouped = {};

  records.forEach((record) => {
    const dateKey = formatDateOnly(record.workDate || record.createdAt || "");
    if (!dateKey) return;

    if (!grouped[dateKey]) {
      grouped[dateKey] = {};
      PEOPLE_NAMES.forEach((name) => {
        grouped[dateKey][name] = 0;
      });
    }

    const peopleDetail = normalizePeopleDetail(record);
    Object.entries(peopleDetail).forEach(([name, count]) => {
      grouped[dateKey][name] += Number(count || 0);
    });
  });

  const dates = Object.keys(grouped).sort();

  if (!dates.length) {
    summaryTableWrap.innerHTML =
      '<div class="empty-state">此區間沒有可統計資料</div>';
    return;
  }

  const headHtml = PEOPLE_NAMES.map(
    (name) => `<th>${escapeHtml(name)}</th>`,
  ).join("");
  const bodyHtml = dates
    .map((date) => {
      const cells = PEOPLE_NAMES.map((name) => {
        const value = grouped[date][name] || 0;
        const className = value === 0 ? "zero-cell" : "";
        return `<td class="${className}">${value}</td>`;
      }).join("");
      return `<tr><td>${date}</td>${cells}</tr>`;
    })
    .join("");

  summaryTableWrap.innerHTML = `
    <div class="muted-text">統計日期數：${dates.length} 天</div>
    <div class="table-wrap">
      <table class="report-table">
        <thead><tr><th>日期</th>${headHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

function exportCsv() {
  const rows = [
    ["登記時間", "出工日期", "工程名稱", "出工地點", ...PEOPLE_NAMES],
  ];

  allRecords.forEach((record) => {
    const peopleDetail = normalizePeopleDetail(record);
    rows.push([
      formatDateTime(record.createdAt || ""),
      formatDateOnly(record.workDate || record.createdAt || ""),
      record.projectName || "",
      record.site || "",
      ...PEOPLE_NAMES.map((name) => peopleDetail[name] || 0),
    ]);
  });

  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `出工登記_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

init();
