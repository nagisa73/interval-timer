/* ============================================================
   arrange.js ― ドラッグ＆ドロップと複数選択
   ------------------------------------------------------------
   【ドラッグ】
   パソコンはそのままドラッグ、スマホは長押ししてからドラッグします。
   スマホの標準のドラッグは使えないので、指やマウスの位置（pointer）を
   自分で追いかけて、「どこに入るか」を線で表示します。

   【複数選択】
   「選択」を押すと、タップで選べるようになります。
   同じ段で隣り合ったものを、まとめてくり返しで囲めます。
   ============================================================ */


/* ---------- 複数選択 ---------- */

function startSelecting() {
  if (state.plan.length === 0) {
    showToast("先にブロックを追加してください");
    return;
  }
  state.selecting = true;
  state.selectedIds = new Set();
  renderPlan();
}

function stopSelecting() {
  if (!state.selecting) return;
  state.selecting = false;
  state.selectedIds = new Set();
  renderPlan();
}

function toggleSelected(id) {
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
  } else {
    state.selectedIds.add(id);
  }
  renderPlan();
}

function wrapSelected() {
  if (!wrapNodes([...state.selectedIds])) return;
  state.selecting = false;
  state.selectedIds = new Set();
  commitPlanChange();
  showToast("2セットのくり返しにしました");
}

// 選択中の案内と「くり返しで囲む」ボタンを更新する
function updateSelectBar() {
  $("app").classList.toggle("is-selecting", state.selecting);
  $("selectBar").hidden = !state.selecting;
  if (!state.selecting) return;

  const check = checkWrap([...state.selectedIds]);
  const count = state.selectedIds.size;
  $("selectInfo").textContent = check.ok ? count + "個を選択中" : check.reason;
  $("wrapBtn").disabled = !check.ok;
}


/* ---------- ドラッグ ---------- */

const drag = {
  pointerId: null,   // 今追いかけている指・マウス
  id: null,          // 動かすブロック／くり返しの id
  el: null,          // 動かす要素
  active: false,     // ドラッグが始まったか
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  offsetX: 0,
  offsetY: 0,
  pressTimer: null,  // 長押しの判定
  ghost: null,       // 指についてくる半透明のコピー
  line: null,        // 入る場所を示す線
  slot: null,        // 入る場所 { groupId, index, ... }
  frame: null,
  warned: false,
  suppressClick: false,
};

function setupDrag() {
  const plan = $("plan");
  plan.addEventListener("pointerdown", onDragPointerDown);
  document.addEventListener("pointermove", onDragPointerMove);
  document.addEventListener("pointerup", onDragPointerUp);
  document.addEventListener("pointercancel", cancelDrag);

  // ドラッグ中は画面がスクロールしないようにする
  document.addEventListener("touchmove", function (event) {
    if (drag.active) event.preventDefault();
  }, { passive: false });

  // 長押しで出るメニューを出さない
  plan.addEventListener("contextmenu", function (event) {
    if (drag.pointerId !== null) event.preventDefault();
  });

  // ドラッグの直後に「タップ」と扱われないようにする
  plan.addEventListener("click", function (event) {
    if (drag.suppressClick) {
      event.stopPropagation();
      event.preventDefault();
      drag.suppressClick = false;
    }
  }, true);
}

function onDragPointerDown(event) {
  if (event.button !== 0 || drag.pointerId !== null) return;
  if (state.selecting || isInProgress()) return;

  const el = event.target.closest("[data-node]");
  if (!el) return;

  drag.pointerId = event.pointerId;
  drag.id = Number(el.dataset.node);
  drag.el = el;
  drag.startX = drag.x = event.clientX;
  drag.startY = drag.y = event.clientY;

  // スマホはスクロールと区別するため、長押しで始める
  if (event.pointerType !== "mouse") {
    drag.pressTimer = setTimeout(beginDrag, CONFIG.dragPressMs);
  }
}

function onDragPointerMove(event) {
  if (event.pointerId !== drag.pointerId) return;
  drag.x = event.clientX;
  drag.y = event.clientY;

  if (!drag.active) {
    const moved = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
    if (event.pointerType === "mouse") {
      if (moved > 5) beginDrag();
    } else if (moved > 8) {
      resetDrag();  // 長押しの前に動いたらスクロール
    }
    return;
  }
  event.preventDefault();
  updateDrag();
}

function onDragPointerUp(event) {
  if (event.pointerId !== drag.pointerId) return;

  if (!drag.active) {
    resetDrag();
    return;
  }

  const slot = drag.slot;
  const id = drag.id;
  resetDrag();
  suppressNextClick();

  if (slot && !isInProgress() && moveNode(id, slot.groupId, slot.index)) {
    commitPlanChange();
  }
}

function cancelDrag(event) {
  if (event && event.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
  if (drag.pointerId === null) return;
  const wasActive = drag.active;
  resetDrag();
  if (wasActive) suppressNextClick();
}

function suppressNextClick() {
  drag.suppressClick = true;
  setTimeout(function () { drag.suppressClick = false; }, 60);
}

function beginDrag() {
  clearTimeout(drag.pressTimer);
  if (drag.pointerId === null || isInProgress()) return;

  const rect = drag.el.getBoundingClientRect();
  drag.active = true;
  drag.warned = false;
  drag.offsetX = drag.startX - rect.left;
  drag.offsetY = Math.min(drag.startY - rect.top, 60);

  const ghost = drag.el.cloneNode(true);
  ghost.classList.add("drag-ghost");
  ghost.style.width = rect.width + "px";
  drag.ghost = ghost;

  const line = createEl("div", "drop-line");
  line.hidden = true;
  drag.line = line;

  document.body.append(ghost, line);

  // ドラッグ中は並びの間隔を広げて、入れる場所を狙いやすくする。
  // 広げても、つかんだものが指の下からずれないようにスクロールで補正する
  document.body.classList.add("is-dragging");
  drag.el.classList.add("dragging");
  $("plan").scrollTop += drag.el.getBoundingClientRect().top - rect.top;

  updateDrag();
  drag.frame = requestAnimationFrame(autoScroll);
}

function updateDrag() {
  drag.ghost.style.transform =
    "translate(" + (drag.x - drag.offsetX) + "px," + (drag.y - drag.offsetY) + "px)";

  const node = findNode(drag.id, state.plan);
  if (!node) return;
  drag.slot = findSlot($("planList"), null, 0, node.node);
  showSlot(drag.slot);
}

// 指が画面の端に近づいたら、図をスクロールする
function autoScroll() {
  if (!drag.active) return;
  const plan = $("plan");
  const rect = plan.getBoundingClientRect();
  const zone = 44;
  let speed = 0;
  if (drag.y < rect.top + zone) speed = -Math.ceil((rect.top + zone - drag.y) / 6);
  if (drag.y > rect.bottom - zone) speed = Math.ceil((drag.y - (rect.bottom - zone)) / 6);
  if (speed !== 0) {
    plan.scrollTop += clamp(speed, -14, 14);
    updateDrag();
  }
  drag.frame = requestAnimationFrame(autoScroll);
}

// 今の指の位置から、入る場所を探す
//   listEl  : 調べる並び
//   groupId : その並びのくり返しの id（一番外は null）
//   depth   : その並びがいくつのくり返しの中にあるか
function findSlot(listEl, groupId, depth, dragged) {
  const children = [...listEl.children].filter(function (c) { return c.dataset.node; });

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const rect = el.getBoundingClientRect();
    if (drag.y > rect.bottom) continue;

    if (el.classList.contains("group") && Number(el.dataset.node) !== drag.id) {
      const label = el.querySelector(":scope > .g-label").getBoundingClientRect();
      const onLabel = drag.x >= label.left;

      // 枠の中ならどこでも中に入れる。外に出すときは、枠の間かセット数の部分へ
      if (!onLabel && drag.y >= rect.top) {
        if (depth + 1 + nestHeight(dragged) <= CONFIG.maxNestDepth) {
          const body = el.querySelector(":scope > .g-body");
          return findSlot(body, Number(el.dataset.node), depth + 1, dragged);
        }
        if (!drag.warned) {
          drag.warned = true;
          showToast("くり返しの入れ子は" + CONFIG.maxNestDepth + "段までです");
        }
      }
    }

    const isBefore = drag.y < rect.top + rect.height / 2;
    return {
      groupId: groupId,
      index: isBefore ? i : i + 1,
      left: rect.left,
      width: rect.width,
      top: isBefore ? rect.top - 8 : rect.bottom + 8,
      listEl: listEl,
    };
  }

  // 並びの一番下
  const last = children[children.length - 1];
  const box = (last || listEl).getBoundingClientRect();
  return {
    groupId: groupId,
    index: children.length,
    left: box.left,
    width: box.width,
    top: last ? box.bottom + 8 : box.top + box.height / 2,
    listEl: listEl,
  };
}

// 入る場所に線を出し、入る先のくり返しを強調する
function showSlot(slot) {
  for (const el of document.querySelectorAll(".group.drop-into")) {
    el.classList.remove("drop-into");
  }
  if (!slot) {
    drag.line.hidden = true;
    return;
  }

  drag.line.hidden = false;
  drag.line.style.left = slot.left + "px";
  drag.line.style.top = slot.top + "px";
  drag.line.style.width = slot.width + "px";

  if (slot.groupId !== null) slot.listEl.parentElement.classList.add("drop-into");
}

// ドラッグの状態をすべて元に戻す
function resetDrag() {
  clearTimeout(drag.pressTimer);
  cancelAnimationFrame(drag.frame);
  if (drag.ghost) drag.ghost.remove();
  if (drag.line) drag.line.remove();
  if (drag.el) drag.el.classList.remove("dragging");
  for (const el of document.querySelectorAll(".group.drop-into")) {
    el.classList.remove("drop-into");
  }
  document.body.classList.remove("is-dragging");

  drag.pointerId = null;
  drag.id = null;
  drag.el = null;
  drag.active = false;
  drag.ghost = null;
  drag.line = null;
  drag.slot = null;
}
