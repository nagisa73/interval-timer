/* ============================================================
   editor.js ― ブロックとくり返しの編集
   ------------------------------------------------------------
   ブロックの図をタップしたときに出てくる編集パネルです。
   メニューの中身（state.plan）を書き換えたら、必ず
   commitPlanChange() を呼んで、保存と表示の更新をします。
   ============================================================ */

// メニューを変更したあとに呼ぶ：保存 → 実行用リストを作り直す → 図を描き直す
function commitPlanChange() {
  dismissUndoToast();
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
    showToast("編集するには、左下のボタンでリセットしてください");
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
    body.append(spaced(makeField("種類", createKindSwitch(step, function (previousKindId) {
      // 名前を自分で変えていないときは、種類の名前に合わせる
      const previousKind = findKind(previousKindId);
      const current = nameInput.value.trim();
      if (current === "" || (previousKind && current === previousKind.name)) {
        nameInput.value = findKind(step.kind).name;
      }
    }))));
    body.append(spaced(makeField("時間", createTimeControls(step))));

    const actions = createEl("div", "actions");
    const cancelButton = makeButton("やめる", "btn wide", closeSheet);
    const addButton = makeButton("追加", "btn primary", function () {
      flushWheels();  // 回している途中のホイールの値を確定する
      step.name = resolveName(nameInput.value, step.kind);
      state.plan.push(step);
      commitPlanChange();
      closeSheet();
    });
    actions.append(cancelButton, addButton);
    body.append(actions);
  });
}


/* ---------- ブロックの編集パネル ----------
   編集中は下書き（draft）だけを書き換え、「完了」を押したときに反映する。
   枠の外をタップして閉じたときは、下書きを捨てるので何も変わらない */

function openStepEditor(id) {
  openSheet(function (body) {
    const found = findNode(id, state.plan);
    if (!found) {
      closeSheet();
      return;
    }

    body.append(createEl("h2", null, "ブロックを編集"));

    const draft = { kind: found.node.kind, seconds: found.node.seconds, name: found.node.name };
    const nameInput = createNameInput(draft);
    body.append(makeField("名前", nameInput));
    body.append(spaced(makeField("種類", createKindSwitch(draft))));
    body.append(spaced(makeField("時間", createTimeControls(draft))));
    body.append(createStepActions(found, draft, nameInput));
  });
}

// ブロックの追加・編集パネルで、前の項目との間を少し空ける（style.css の .field.spaced）
function spaced(field) {
  field.classList.add("spaced");
  return field;
}

// 名前の入力欄
function createNameInput(node) {
  const input = createEl("input");
  input.type = "text";
  input.id = "editName";
  input.maxLength = CONFIG.maxNameLength;
  input.value = node.name;
  return input;
}

// 入力された名前を整える（空なら種類の名前にする）
function resolveName(text, kindId) {
  const name = text.trim();
  return name !== "" ? name : findKind(kindId).name;
}

// 種類の切り替えボタン
//   onKindChange : 種類が変わったときに呼ぶ関数（省略可）。前の種類の id を渡す
function createKindSwitch(node, onKindChange) {
  const wrapper = createEl("div", "seg");

  for (const kind of state.kinds) {
    const button = makeButton(kind.name, "k-" + kind.color, function () {
      const previousKindId = node.kind;
      node.kind = kind.id;
      // 押したボタンだけ「選ばれている」状態にする
      for (const other of wrapper.querySelectorAll("button")) {
        other.setAttribute("aria-pressed", other === button);
      }
      if (onKindChange) onKindChange(previousKindId);
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
    // 上限を超えるとき（60分30秒など）は、上限ちょうどに秒を合わせる
    const maxMinutes = Math.floor(CONFIG.maxSeconds / 60);
    if (minutesWheel.getValue() === maxMinutes && secondsWheel.getValue() > CONFIG.maxSeconds % 60) {
      secondsWheel.setValue(CONFIG.maxSeconds % 60);
    }
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
function createStepActions(found, draft, nameInput) {
  const actions = createEl("div", "actions");

  const deleteButton = makeButton("削除", "btn danger wide", function () {
    closeSheet();  // 回している途中のホイールの値を先に確定する
    const previousPlan = copyPlan();
    found.parentList.splice(found.index, 1);
    commitPlanChange();
    showUndoToast("ブロックを削除しました", previousPlan);
  });

  const doneButton = makeButton("完了", "btn primary", function () {
    flushWheels();  // 回している途中のホイールの値を確定する
    const node = found.node;
    const name = resolveName(nameInput.value, draft.kind);
    const changed = name !== node.name || draft.kind !== node.kind || draft.seconds !== node.seconds;

    // 何も変えていないときは、タイマーの位置などをそのままにする
    if (changed) {
      node.name = name;
      node.kind = draft.kind;
      node.seconds = draft.seconds;
      commitPlanChange();
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

    // 「完了」を押すまでは、ホイールの値だけを変える
    const repeatWheel = makeWheel({
      values: makeRange(1, CONFIG.maxRepeat),
      value: group.repeat,
      unit: "セット",
      onChange: function () {},
      onSettle: function () {},
    });
    const wheels = createEl("div", "wheels");
    wheels.append(repeatWheel);
    body.append(makeField("セット数", wheels));
    body.append(createGroupActions(found, repeatWheel));
  });
}

// くり返しの編集パネルの下のボタン
function createGroupActions(found, repeatWheel) {
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
    closeSheet();  // 回している途中のホイールの値を先に確定する
    const previousPlan = copyPlan();
    found.parentList.splice(found.index, 1);
    commitPlanChange();
    showUndoToast("くり返しを削除しました", previousPlan);
  });

  const doneButton = makeButton("完了", "btn primary", function () {
    flushWheels();  // 回している途中のホイールの値を確定する
    const repeat = repeatWheel.getValue();
    if (repeat !== group.repeat) {
      group.repeat = repeat;
      commitPlanChange();
    }
    closeSheet();
  });

  actions.append(unwrapButton, deleteButton, doneButton);
  return actions;
}
