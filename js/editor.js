/* ============================================================
   editor.js ― ブロックとくり返しの編集
   ------------------------------------------------------------
   ブロックの図をタップしたときに出てくる編集パネルです。
   メニューの中身（state.plan）を書き換えたら、必ず
   commitPlanChange() を呼んで、保存と表示の更新をします。
   ============================================================ */

// メニューを変更したあとに呼ぶ：保存 → 実行用リストを作り直す → 図を描き直す
function commitPlanChange() {
  saveState();
  buildRunList();
  renderPlan();
}


/* ---------- 図がタップされたとき ---------- */

function handlePlanClick(event) {
  // タップされた場所から、一番近い「data-add」や「data-edit」が付いた要素を探す
  const addButton = event.target.closest("[data-add]");
  const selectButton = event.target.closest("[data-select-start]");
  const editTarget = event.target.closest("[data-edit]");
  if (!addButton && !selectButton && !editTarget) return;

  // タイマーの途中で編集すると、どこまで進んだかわからなくなるので止める
  if (isInProgress()) {
    showToast("編集するには、左下のボタンで最初に戻してください");
    return;
  }
  if (state.finished) resetTimer();

  if (addButton) {
    openStepCreator();
    return;
  }
  if (selectButton) {
    startSelecting();
    return;
  }

  const id = Number(editTarget.dataset.edit);

  // 選択中は、タップで選ぶ
  if (state.selecting) {
    toggleSelected(id);
    return;
  }

  const found = findNode(id, state.plan);
  if (!found) return;

  if (found.node.type === "step") {
    openStepEditor(id);
  } else {
    openGroupEditor(id);
  }
}


/* ---------- ブロックの追加パネル ---------- */

// 「＋ ブロック」を押したとき。「追加」を押すまでメニューには入らない
function openStepCreator() {
  const step = makeNewStep();

  openSheet(function (body) {
    body.append(createEl("h2", null, "ブロックを追加"));

    const nameInput = createNameInput(step);
    body.append(makeField("名前", nameInput));
    body.append(makeField("種類", createKindSwitch(step)));
    body.append(makeField("時間", createTimeControls(step)));

    const actions = createEl("div", "actions");
    const cancelButton = makeButton("やめる", "btn wide", closeSheet);
    const addButton = makeButton("追加", "btn primary", function () {
      const name = nameInput.value.trim();
      step.name = name !== "" ? name : findKind(step.kind).name;
      state.plan.push(step);
      commitPlanChange();
      closeSheet();
    });
    actions.append(cancelButton, addButton);
    body.append(actions);
  });
}


/* ---------- ブロックの編集パネル ---------- */

function openStepEditor(id) {
  openSheet(function (body) {
    const found = findNode(id, state.plan);
    if (!found) {
      closeSheet();
      return;
    }

    body.append(createEl("h2", null, "ブロックを編集"));

    const nameInput = createNameInput(found.node);
    body.append(makeField("名前", nameInput));
    body.append(makeField("種類", createKindSwitch(found.node)));
    body.append(makeField("時間", createTimeControls(found.node)));
    body.append(createStepActions(found, nameInput));
  });
}

// 名前の入力欄
function createNameInput(node) {
  const input = createEl("input");
  input.type = "text";
  input.id = "editName";
  input.maxLength = CONFIG.maxNameLength;
  input.value = node.name;

  // 入力が終わったとき（決定・別の場所をタップ）に反映する
  input.addEventListener("change", function () {
    applyName(node, input.value);
  });
  return input;
}

function applyName(node, text) {
  const name = text.trim();
  const kind = findKind(node.kind);
  node.name = name !== "" ? name : (kind ? kind.name : node.name);  // 空なら種類の名前にする
  commitPlanChange();
}

// 種類の切り替えボタン
function createKindSwitch(node) {
  const wrapper = createEl("div", "seg");

  for (const kind of state.kinds) {
    const button = makeButton(kind.name, "k-" + kind.color, function () {
      node.kind = kind.id;
      // 押したボタンだけ「選ばれている」状態にする
      for (const other of wrapper.querySelectorAll("button")) {
        other.setAttribute("aria-pressed", other === button);
      }
      commitPlanChange();
    });
    button.setAttribute("aria-pressed", node.kind === kind.id);
    wrapper.append(button);
  }
  return wrapper;
}

// 時間の「分」「秒」のホイール
function createTimeControls(node) {
  function applyTime() {
    const total = minutesWheel.getValue() * 60 + secondsWheel.getValue();
    node.seconds = clamp(total, 1, CONFIG.maxSeconds);
  }

  function finishTime() {
    // 0分0秒にはできないので、回し終わったら1秒に戻す
    if (minutesWheel.getValue() === 0 && secondsWheel.getValue() === 0) {
      secondsWheel.setValue(1);
    }
    commitPlanChange();
  }

  const minutesWheel = makeWheel({
    values: makeRange(0, Math.floor(CONFIG.maxSeconds / 60)),
    value: Math.floor(node.seconds / 60),
    unit: "分",
    onChange: applyTime,
    onSettle: finishTime,
  });

  const secondsWheel = makeWheel({
    values: makeRange(0, 59),
    value: node.seconds % 60,
    unit: "秒",
    format: pad2,
    onChange: applyTime,
    onSettle: finishTime,
  });

  const wheels = createEl("div", "wheels");
  wheels.append(minutesWheel, secondsWheel);
  return wheels;
}

// ブロックの編集パネルの下のボタン
function createStepActions(found, nameInput) {
  const actions = createEl("div", "actions");

  const deleteButton = makeButton("削除", "btn danger wide", function () {
    found.parentList.splice(found.index, 1);
    commitPlanChange();
    closeSheet();
  });

  const doneButton = makeButton("完了", "btn primary", function () {
    // 名前を入力したまま「完了」を押したときも反映されるように
    if (nameInput.value.trim() !== found.node.name) {
      applyName(found.node, nameInput.value);
    }
    closeSheet();
  });

  actions.append(deleteButton, doneButton);
  return actions;
}


/* ---------- くり返しの編集パネル ---------- */

function openGroupEditor(id) {
  openSheet(function (body) {
    const found = findNode(id, state.plan);
    if (!found) {
      closeSheet();
      return;
    }
    const group = found.node;

    body.append(createEl("h2", null, "くり返しを編集"));

    const repeatWheel = makeWheel({
      values: makeRange(1, CONFIG.maxRepeat),
      value: group.repeat,
      unit: "セット",
      onChange: function (value) { group.repeat = value; },
      onSettle: commitPlanChange,
    });
    const wheels = createEl("div", "wheels");
    wheels.append(repeatWheel);
    body.append(makeField("セット数", wheels));
    body.append(createGroupActions(found));
  });
}

// くり返しの編集パネルの下のボタン
function createGroupActions(found) {
  const group = found.node;
  const actions = createEl("div", "actions");

  const unwrapButton = makeButton("くり返しを解除", "btn", function () {
    // くり返しの枠だけ外して、中身はその場所に残す
    found.parentList.splice(found.index, 1, ...group.items);
    commitPlanChange();
    closeSheet();
    showToast("中身だけ残しました");
  });

  const deleteButton = makeButton("まとめて削除", "btn danger", function () {
    found.parentList.splice(found.index, 1);
    commitPlanChange();
    closeSheet();
  });

  const doneButton = makeButton("完了", "btn primary", closeSheet);

  actions.append(unwrapButton, deleteButton, doneButton);
  return actions;
}
