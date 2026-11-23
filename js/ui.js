/* ============================================================
   ui.js ― パネルやお知らせなどの部品
   ------------------------------------------------------------
   編集画面やメニューで何度も使う部品を、関数にまとめています。
   ============================================================ */


/* ---------- お知らせ（画面下に一瞬出る文字） ---------- */

let toastTimerId = null;

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  // 前のお知らせの「消す予約」を取り消してから、新しく予約する
  clearTimeout(toastTimerId);
  toastTimerId = setTimeout(function () {
    toast.classList.remove("show");
  }, 2200);
}


/* ---------- 下から出てくるパネル ---------- */

// パネルを開く。buildContent は、パネルの中身を作る関数
//   例：openSheet(function (body) { body.append(…); });
//   isFull を true にすると、画面全体をおおい、右上に閉じるボタンが出る
function openSheet(buildContent, isFull) {
  flushWheels();
  sheetWheels = [];

  const body = $("sheetBody");
  const title = $("sheetTitle");
  body.replaceChildren();
  title.replaceChildren();
  buildContent(body);

  // 全画面のときは、見出しを閉じるボタンの横に移す
  $("sheetWrap").classList.toggle("full", Boolean(isFull));
  $("sheetBar").hidden = !isFull;
  if (isFull) {
    const heading = body.querySelector("h2");
    if (heading) title.append(heading);
  }

  $("sheetWrap").hidden = false;
  $("sheetPanel").scrollTop = 0;

  // ホイールは、画面に出てからでないと位置を合わせられない
  for (const wheel of sheetWheels) wheel.sync();
}

// 画面全体をおおうパネルを開く（メニューと、メニューから開く画面）
function openFullSheet(buildContent) {
  openSheet(buildContent, true);
}

// リセットの確認
function openResetConfirm() {
  openSheet(function (body) {
    body.append(createEl("h2", null, "リセットしますか？"));
    body.append(createEl("p", "note", "タイマーを最初のブロックに戻します。"));

    const actions = createEl("div", "actions");
    actions.append(
      makeButton("やめる", "btn", closeSheet),
      makeButton("リセット", "btn danger", function () {
        closeSheet();
        resetTimer();
        showToast("リセットしました");
      })
    );
    body.append(actions);
  });
}

function closeSheet() {
  flushWheels();
  $("sheetWrap").hidden = true;
}

// 今のパネルにあるホイール
let sheetWheels = [];

// 回している途中の値を、すぐに確定する
function flushWheels() {
  for (const wheel of sheetWheels) wheel.flush();
}

function isSheetOpen() {
  return !$("sheetWrap").hidden;
}


/* ---------- パネルの中の部品 ---------- */

// ボタンを作る
function makeButton(text, cls, onClick) {
  const button = createEl("button", cls, text);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

// 「見出し＋中身」のまとまりを作る
//   例：makeField("名前", 入力欄)
function makeField(label, ...children) {
  const field = createEl("div", "field");
  field.append(createEl("div", "field-label", label), ...children);
  return field;
}

// ホイールピッカーを作る
//   values   : 選べる数字の配列
//   value    : 最初の値
//   unit     : "分" "秒" "セット" など
//   format   : 数字の見せ方（省略可）
//   onChange : 値が変わるたびに呼ぶ関数
//   onSettle : 回し終わったときに呼ぶ関数（保存や描き直しはこちらで）
// スマホは指で回す。パソコンはマウスホイール・ドラッグ・クリック・上下キーで動かせる
function makeWheel(options) {
  const values = options.values;
  const itemHeight = CONFIG.wheelItemHeight;
  const format = options.format || String;

  let index = Math.max(0, values.indexOf(options.value));
  let targetIndex = null;   // ボタン操作などで移動している先
  let dirty = false;        // まだ確定していない変更があるか
  let settleTimer = null;
  let mouseDrag = null;
  let wheelDelta = 0;

  const root = createEl("div", "wheel");
  root.style.setProperty("--wheel-item", itemHeight + "px");
  if (options.unit.length > 1) root.classList.add("wide-unit");

  const list = createEl("div", "wheel-list");
  list.tabIndex = 0;
  list.setAttribute("role", "spinbutton");
  list.setAttribute("aria-label", options.unit);
  list.setAttribute("aria-valuemin", values[0]);
  list.setAttribute("aria-valuemax", values[values.length - 1]);

  list.append(createEl("div", "wheel-spacer"));
  const items = values.map(function (value, i) {
    const item = createEl("div", "wheel-item", format(value));
    item.dataset.index = i;
    list.append(item);
    return item;
  });
  list.append(createEl("div", "wheel-spacer"));
  root.append(list, createEl("span", "wheel-unit", options.unit));

  function paint(previous) {
    if (previous !== null) items[previous].classList.remove("selected");
    items[index].classList.add("selected");
    list.setAttribute("aria-valuenow", values[index]);
  }

  function setIndex(next, notify) {
    if (next === index) return;
    const previous = index;
    index = next;
    paint(previous);
    if (notify) {
      dirty = true;
      options.onChange(values[index]);
    }
  }

  function settle() {
    clearTimeout(settleTimer);
    targetIndex = null;
    if (!dirty) return;
    dirty = false;
    options.onSettle(values[index]);
  }

  function armSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 140);
  }

  // 指定の行までなめらかに動かす
  function moveTo(next) {
    const clamped = clamp(next, 0, values.length - 1);
    targetIndex = clamped;
    setIndex(clamped, true);
    list.scrollTo({ top: clamped * itemHeight, behavior: "smooth" });
    armSettle();
  }

  list.addEventListener("scroll", function () {
    if (list.clientHeight === 0) return;  // パネルが閉じているとき

    if (targetIndex !== null) {
      // 目的の行へ動いている途中は、通過した行を選ばない
      if (Math.abs(list.scrollTop - targetIndex * itemHeight) < 1) targetIndex = null;
    } else {
      setIndex(clamp(Math.round(list.scrollTop / itemHeight), 0, values.length - 1), true);
    }
    armSettle();
  });

  // マウスホイール：1目盛りで1行
  list.addEventListener("wheel", function (event) {
    event.preventDefault();
    wheelDelta += event.deltaY;
    if (Math.abs(wheelDelta) >= 30) {
      moveTo(index + Math.sign(wheelDelta));
      wheelDelta = 0;
    }
  }, { passive: false });

  // マウスでのドラッグ
  list.addEventListener("pointerdown", function (event) {
    targetIndex = null;
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    mouseDrag = { y: event.clientY, top: list.scrollTop, moved: false };
    list.setPointerCapture(event.pointerId);
    list.classList.add("grabbing");
  });
  list.addEventListener("pointermove", function (event) {
    if (!mouseDrag) return;
    const moved = event.clientY - mouseDrag.y;
    if (Math.abs(moved) > 3) mouseDrag.moved = true;
    list.scrollTop = mouseDrag.top - moved;
  });
  function endMouseDrag(event) {
    if (!mouseDrag) return;
    const wasMoved = mouseDrag.moved;
    mouseDrag = null;
    list.classList.remove("grabbing");

    if (wasMoved) {
      moveTo(Math.round(list.scrollTop / itemHeight));
      return;
    }
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const item = under && under.closest(".wheel-item");
    if (item && list.contains(item)) moveTo(Number(item.dataset.index));
  }
  list.addEventListener("pointerup", endMouseDrag);
  list.addEventListener("pointercancel", endMouseDrag);

  // タップで、その行を選ぶ
  list.addEventListener("click", function (event) {
    const item = event.target.closest(".wheel-item");
    if (item) moveTo(Number(item.dataset.index));
  });

  // 上下キー
  list.addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp") moveTo(index - 1);
    else if (event.key === "ArrowDown") moveTo(index + 1);
    else return;
    event.preventDefault();
  });

  root.getValue = function () { return values[index]; };

  // 値を直す（onChange は呼ばない）
  root.setValue = function (value) {
    const next = values.indexOf(value);
    if (next < 0) return;
    targetIndex = next;
    setIndex(next, false);
    list.scrollTo({ top: next * itemHeight, behavior: "smooth" });
    armSettle();
  };

  root.sync = function () { list.scrollTop = index * itemHeight; };

  // 回している途中でパネルを閉じても、今見えている行を値にする
  root.flush = function () {
    if (targetIndex === null && list.clientHeight > 0) {
      setIndex(clamp(Math.round(list.scrollTop / itemHeight), 0, values.length - 1), true);
    }
    settle();
  };

  paint(null);
  sheetWheels.push(root);
  return root;
}
