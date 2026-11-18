/* =========================================================
   Googleスプレッドシートからコーヒー豆の一覧を読み込む
   ---------------------------------------------------------
   ★設定するのはここだけ★
   スプレッドシートの「ウェブに公開」で取得した CSV の URL を貼ってください。
   ========================================================= */
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1kTXqUNXjoBq2CdQx3Y8kbqUA8njqQPnvW4IPVOBeYf3Ihup1tgRFPWT9_1kAUqXdIDMALBijoibl/pub?gid=0&single=true&output=csv";

/* 焙煎度（1〜5の数字）と表示ラベルの対応 */
const ROAST_LABELS = {
  1: "浅煎り",
  2: "中浅煎り",
  3: "中煎り",
  4: "中深煎り",
  5: "深煎り",
};

/* スプレッドシート1行目の見出し名（列の順番は自由） */
const COLUMNS = {
  name: "名前",
  roast: "焙煎度",
  country: "生産国",
  desc: "説明",
};

/* ========================================================= */

const listEl = document.getElementById("bean-list");
const statusEl = document.getElementById("status");
const template = document.getElementById("bean-card-template");

main();

async function main() {
  if (!SHEET_CSV_URL) {
    showStatus("script.js の SHEET_CSV_URL にスプレッドシートのURLを設定してください。", true);
    return;
  }

  try {
    // キャッシュを避けるため毎回URLに時刻を付ける
    const url = SHEET_CSV_URL + (SHEET_CSV_URL.includes("?") ? "&" : "?") + "t=" + Date.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);

    const rows = parseCSV(await res.text());
    const beans = toBeans(rows);

    if (beans.length === 0) {
      showStatus("現在ご紹介できる豆はありません。");
      return;
    }

    beans.forEach((bean) => listEl.appendChild(createCard(bean)));
    statusEl.hidden = true;
  } catch (err) {
    console.error(err);
    showStatus("豆の情報を読み込めませんでした。時間をおいて再度お試しください。", true);
  }
}

/* 見出し行をもとに、各行を { name, roast, country, desc } に変換 */
function toBeans(rows) {
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim());
  const idx = {};
  for (const key in COLUMNS) {
    idx[key] = header.indexOf(COLUMNS[key]);
  }

  return rows
    .slice(1)
    .map((r) => ({
      name: cell(r, idx.name),
      roast: clampRoast(cell(r, idx.roast)),
      country: cell(r, idx.country),
      desc: cell(r, idx.desc),
    }))
    .filter((b) => b.name !== ""); // 名前が空の行は表示しない
}

function cell(row, i) {
  return i >= 0 && row[i] != null ? row[i].trim() : "";
}

/* 全角数字も許容し、1〜5の範囲におさめる */
function clampRoast(value) {
  const n = parseInt(value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)), 10);
  if (isNaN(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

/* テンプレートを複製してカードを作る（textContent を使うので安全） */
function createCard(bean) {
  const card = template.content.cloneNode(true);
  const label = ROAST_LABELS[bean.roast];

  card.querySelector(".bean-card__name").textContent = bean.name;
  card.querySelector(".bean-card__country").textContent = bean.country;
  card.querySelector(".bean-card__desc").textContent = bean.desc;
  card.querySelector(".roast__label").textContent = label;
  card.querySelector(".roast").setAttribute("aria-label", `焙煎度 5段階中${bean.roast}：${label}`);

  card.querySelectorAll(".bean").forEach((el, i) => {
    if (i < bean.roast) el.classList.add("is-on");
  });

  return card;
}

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
  statusEl.hidden = false;
}

/* CSVを2次元配列に変換（セル内のカンマ・改行・"" に対応） */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  text = text.replace(/^﻿/, "");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
