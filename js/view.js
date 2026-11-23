/* ============================================================
   view.js ― 画面の表示
   ------------------------------------------------------------
   renderPlan() : ブロックの図を、メニューの中身から作り直す
                  （メニューを編集したときに呼ぶ）
   updateView() : 数字・ゲージ・ボタンなどを、今の状態に合わせて書き換える
                  （タイマー中は何度も呼ばれる）
   ============================================================ */

// 作ったブロックの要素を、id で探せるように覚えておく
let blockElements = new Map();  // id → ブロックの要素
let groupElements = new Map();  // id → { box, node, count, unit }

const ICON_PLAY  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.9v14.2a1 1 0 0 0 1.53.85l11.1-7.1a1 1 0 0 0 0-1.7L8.53 4.05A1 1 0 0 0 7 4.9z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/></svg>';


/* ---------- ブロックの図を作る ---------- */

function renderPlan() {
  blockElements = new Map();
  groupElements = new Map();

  const list = $("planList");
  list.replaceChildren();  // 中身を空にする

  if (state.plan.length === 0) {
    list.append(createEl("p", "plan-hint", "ブロックがありません。下のボタンから追加してください。"));
  }
  renderItems(state.plan, list);
  updateSelectBar();
  updatePresetBanner();
  updateView();
}

// マイセットの中身を編集している間に出す帯
function updatePresetBanner() {
  const preset = state.presetEdit ? findPreset(state.presetEdit.id) : null;
  $("presetBanner").hidden = !preset;
  if (preset) $("presetBannerName").textContent = "「" + preset.name + "」を編集中";
}

// items の中身を、parent の中に順番に並べる
function renderItems(items, parent) {
  for (const node of items) {
    if (node.type === "step") {
      parent.append(createStepBlock(node));
    } else {
      parent.append(createGroupBox(node));
    }
  }
}

// ブロック1つ分の要素を作る
//   <button class="block k-work">
//     <span class="fill"></span>          … ゲージ
//     <span class="b-name">筋トレ</span>
//     <span class="b-time">00:20</span>
//   </button>
function createStepBlock(node) {
  const block = createEl("button", "block k-" + kindColor(node.kind));
  block.dataset.edit = node.id;  // タップしたときに、どれを編集するかわかるように
  block.dataset.node = node.id;  // ドラッグで動かすときの目印
  block.classList.toggle("selected", state.selectedIds.has(node.id));

  block.append(
    createEl("span", "fill"),
    createEl("span", "b-name", node.name),
    createEl("span", "b-time", formatBlockTime(node.seconds))
  );

  blockElements.set(node.id, block);
  return block;
}

// くり返し1つ分の要素を作る
//   <div class="group">
//     <div class="g-body"> …中のブロック… </div>
//     <button class="g-label"> ×8 </button>
//   </div>
function createGroupBox(node) {
  const box = createEl("div", "group");
  box.dataset.node = node.id;  // ドラッグで動かすときの目印
  box.classList.toggle("selected", state.selectedIds.has(node.id));

  // 左側：中身
  const body = createEl("div", "g-body");
  if (node.items.length > 0) {
    renderItems(node.items, body);  // 中身を作る（中にくり返しがあれば、さらにその中も）
  } else {
    const empty = createEl("button", "empty", "空のくり返し（ここへドラッグで追加）");
    empty.dataset.edit = node.id;
    body.append(empty);
  }

  // 右側：セット数
  const label = createEl("button", "g-label");
  label.dataset.edit = node.id;
  label.setAttribute("aria-label", node.repeat + "セットくり返し");
  const count = createEl("span", "g-count");
  label.append(count);

  box.append(body, label);
  groupElements.set(node.id, { box: box, node: node, count: count });
  return box;
}


/* ---------- 今の状態を画面に反映する ---------- */

function updateView() {
  updateNowPanel();
  updateBlocks();
  updateGroups();
  updateControls();
  updateTitle();
}

// 上の「今のブロック」の表示
function updateNowPanel() {
  const item = currentItem();
  const next = nextItem();
  const secondsLeft = Math.ceil(state.remainingMs / 1000);

  // 色（今のブロックの種類に合わせる）
  $("now").className = "now k-" + (item ? kindColor(item.node.kind) : "none");

  // 名前
  if (state.finished) {
    $("chip").textContent = "完了";
  } else if (item) {
    $("chip").textContent = item.node.name;
  } else {
    $("chip").textContent = "ブロックなし";
  }

  // 大きな残り時間
  $("clock").textContent = formatBlockTime(state.finished ? 0 : secondsLeft);

  // 次のブロック
  if (state.finished) {
    $("next").textContent = "おつかれさまでした";
  } else if (!item) {
    $("next").textContent = "";
  } else if (next) {
    $("next").textContent = "次：" + next.node.name + " " + formatBlockTime(next.node.seconds);
  } else {
    $("next").textContent = "次：終了";
  }

  // 全体の残り時間と、進み具合のバー
  const left = totalRemainingMs();
  const total = totalMs();
  $("total").textContent = formatClock(Math.ceil(left / 1000));
  const progress = total > 0 ? (1 - left / total) * 100 : 0;
  $("bar").style.width = progress.toFixed(2) + "%";
}

// ブロックの図：今のブロックに印を付けて、経過に合わせてゲージを増やす
function updateBlocks() {
  const item = currentItem();

  for (const [id, block] of blockElements) {
    const isCurrent = item !== null && item.node.id === id;
    block.classList.toggle("current", isCurrent);

    // --p は CSS に渡す値（0 = 空、1 = 満タン）
    let ratio = 0;
    if (isCurrent) ratio = 1 - state.remainingMs / stepMs(item);
    block.style.setProperty("--p", ratio.toFixed(4));
  }
}

// くり返しのセット数の表示：
// スタート後に今いるくり返しは「3/8」、それ以外は「×8」
function updateGroups() {
  const item = currentItem();

  for (const [id, info] of groupElements) {
    const nowCount = item && state.started ? item.iterations[id] : undefined;
    const isActive = nowCount !== undefined;

    info.box.classList.toggle("active", isActive);
    if (isActive) {
      info.count.textContent = nowCount + "/" + info.node.repeat;
    } else {
      info.count.textContent = "×" + info.node.repeat;
    }
  }
}

// 下のボタン
let lastPlayIcon = null;  // アイコンを毎回作り直さないように、前回の状態を覚えておく

function updateControls() {
  const playButton = $("playBtn");
  const icon = state.running ? "pause" : "play";

  if (icon !== lastPlayIcon) {
    playButton.innerHTML = state.running ? ICON_PAUSE : ICON_PLAY;
    lastPlayIcon = icon;
  }

  if (state.running) {
    playButton.setAttribute("aria-label", "一時停止");
  } else if (isInProgress()) {
    playButton.setAttribute("aria-label", "再開");
  } else {
    playButton.setAttribute("aria-label", "スタート");
  }

  const isEmpty = state.runList.length === 0;
  $("playBtn").disabled = isEmpty || state.presetEdit !== null;  // マイセットの編集中は動かさない
  $("prevBtn").disabled = isEmpty;
  $("nextBtn").disabled = isEmpty || state.finished;

  // タイマー中は「＋ ブロック」などを隠す（style.css の .is-started を参照）
  $("app").classList.toggle("is-started", isInProgress());
}

// ブラウザのタブに残り時間を出す
function updateTitle() {
  const item = currentItem();
  if (state.running && item) {
    document.title = formatBlockTime(Math.ceil(state.remainingMs / 1000)) + " " + item.node.name;
  } else {
    document.title = "インターバルタイマー";
  }
}
