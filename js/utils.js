/* ============================================================
   utils.js ― どこからでも使う小さな道具
   ============================================================ */

// id を指定して、HTMLの要素を探す（document.getElementById の短縮形）
function $(id) {
  return document.getElementById(id);
}

// HTMLの要素を新しく作る
//   tag  : "div" や "button" などのタグ名
//   cls  : クラス名（なければ省略）
//   text : 中に入れる文字（なければ省略）
function createEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

// value を、lo 以上 hi 以下の範囲におさめる
//   例：clamp(120, 1, 99) → 99
function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

// lo から hi までの数字の配列を作る
//   例：makeRange(1, 3) → [1, 2, 3]
function makeRange(lo, hi) {
  const result = [];
  for (let n = lo; n <= hi; n++) result.push(n);
  return result;
}

// 数字を2桁にそろえる
//   例：pad2(5) → "05"
function pad2(n) {
  return String(n).padStart(2, "0");
}

// 秒数を「03:15」の形にする（1時間以上なら「1:03:15」）
function formatClock(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(m)}:${pad2(s)}`;
}
