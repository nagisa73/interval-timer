/* ============================================================
   library.js ― 種類とマイセットの追加・編集・削除
   ============================================================ */

// 重ならない id を作る
function makeLibraryId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

// 名前の入力欄を作る
function makeLibraryInput(value, maxLength) {
  const input = createEl("input");
  input.type = "text";
  input.maxLength = maxLength;
  input.value = value;
  return input;
}

// 確認のパネル
function openConfirm(title, message, confirmLabel, onConfirm, onCancel) {
  openSheet(function (body) {
    body.append(createEl("h2", null, title));
    body.append(createEl("p", "note", message));
    const actions = createEl("div", "actions");
    actions.append(
      makeButton("戻る", "btn", onCancel),
      makeButton(confirmLabel, "btn danger", onConfirm)
    );
    body.append(actions);
  });
}


/* ---------- 種類 ---------- */

// メニューに出す種類の一覧
function createKindManager() {
  const list = createEl("div", "kind-list");

  for (const kind of state.kinds) {
    const button = makeButton("", "kind-chip k-" + kind.color, function () {
      openKindEditor(kind.id);
    });
    button.append(createEl("span", "kind-dot"), createEl("span", null, kind.name));
    button.setAttribute("aria-label", kind.name + "を編集");
    list.append(button);
  }

  list.append(makeButton("＋ 追加", "kind-chip kind-add", function () {
    openKindEditor(null);
  }));
  return list;
}

// 種類の追加・編集パネル（id が null なら追加）
function openKindEditor(id) {
  const kind = id ? findKind(id) : null;
  const usedColors = state.kinds.map(function (k) { return k.color; });
  const unused = CONFIG.kindColors.find(function (c) { return !usedColors.includes(c.id); });
  let color = kind ? kind.color : (unused || CONFIG.kindColors[0]).id;

  openSheet(function (body) {
    body.append(createEl("h2", null, kind ? "種類を編集" : "種類を追加"));

    const input = makeLibraryInput(kind ? kind.name : "", CONFIG.maxKindNameLength);
    input.placeholder = "例：ストレッチ";
    body.append(makeField("名前（" + CONFIG.maxKindNameLength + "文字まで）", input));

    const swatches = createEl("div", "swatches");
    for (const option of CONFIG.kindColors) {
      const swatch = makeButton("", "swatch k-" + option.id, function () {
        color = option.id;
        for (const other of swatches.children) {
          other.setAttribute("aria-pressed", other === swatch);
        }
      });
      swatch.setAttribute("aria-label", option.label);
      swatch.setAttribute("aria-pressed", option.id === color);
      swatches.append(swatch);
    }
    body.append(makeField("色", swatches));

    const actions = createEl("div", "actions");
    // 追加のときは「追加」ボタンと同じ横幅にする
    actions.append(makeButton("戻る", kind ? "btn" : "btn wide", openMenu));

    if (kind) {
      const deleteButton = makeButton("削除", "btn danger", function () {
        openKindDelete(kind);
      });
      deleteButton.disabled = state.kinds.length <= 1;
      if (deleteButton.disabled) deleteButton.title = "種類は1つ以上必要です";
      actions.append(deleteButton);
    }

    actions.append(makeButton(kind ? "保存" : "追加", "btn primary", function () {
      const name = input.value.trim();
      if (name === "") {
        showToast("名前を入力してください");
        return;
      }
      const duplicated = state.kinds.some(function (k) { return k !== kind && k.name === name; });
      if (duplicated) {
        showToast("同じ名前の種類があります");
        return;
      }

      if (kind) {
        kind.name = name;
        kind.color = color;
      } else {
        state.kinds.push({ id: makeLibraryId("kind"), name: name, color: color });
      }
      saveState();
      renderPlan();  // タイマーの進み具合は変えずに、色だけ描き直す
      openMenu();
    }));
    body.append(actions);
  });
}

// 種類の削除。使われているときは、変更先を選んでもらう
function openKindDelete(kind) {
  let useCount = 0;
  forEachSavedStep(function (step) {
    if (step.kind === kind.id) useCount++;
  });

  function remove(replacementId) {
    if (replacementId) {
      forEachSavedStep(function (step) {
        if (step.kind === kind.id) step.kind = replacementId;
      });
    }
    state.kinds = state.kinds.filter(function (k) { return k !== kind; });
    saveState();
    renderPlan();
    openMenu();
    showToast("「" + kind.name + "」を削除しました");
  }

  if (useCount === 0) {
    openConfirm("種類を削除", "「" + kind.name + "」を削除します。", "削除する",
      function () { remove(null); },
      function () { openKindEditor(kind.id); });
    return;
  }

  openSheet(function (body) {
    body.append(createEl("h2", null, "「" + kind.name + "」を削除"));
    body.append(createEl("p", "note",
      "メニューとマイセットの " + useCount + " 個のブロックで使われています。変更先の種類を選ぶと削除します。"));

    const options = createEl("div", "seg");
    for (const other of state.kinds) {
      if (other === kind) continue;
      options.append(makeButton(other.name, "k-" + other.color, function () {
        remove(other.id);
      }));
    }
    body.append(makeField("変更先", options));
    body.append(makeButton("戻る", "btn", function () { openKindEditor(kind.id); }));
  });
}


/* ---------- マイセット ---------- */

// メニューに出すマイセットの一覧
function createPresetManager() {
  const wrapper = createEl("div", "presets");

  if (state.presetEdit) {
    wrapper.append(createEl("p", "note", "マイセットの編集中です。図の上の「保存」か「やめる」を押すと操作できます。"));
    return wrapper;
  }

  for (const preset of state.presets) {
    const row = createEl("div", "preset-row");

    const loadButton = makeButton("", "preset", function () {
      loadPreset(preset);
    });
    loadButton.append(createEl("b", null, preset.name));
    if (preset.desc) loadButton.append(createEl("small", null, preset.desc));

    const editButton = makeButton("編集", "preset-edit", function () {
      openPresetEditor(preset.id);
    });
    editButton.setAttribute("aria-label", preset.name + "を編集");

    row.append(loadButton, editButton);
    wrapper.append(row);
  }

  wrapper.append(makeButton("＋ 今のメニューをマイセットに保存", "btn", openPresetCreator));
  return wrapper;
}

function loadPreset(preset) {
  cancelAnimationFrame(frameId);
  allowScreenOff();
  state.selecting = false;
  state.selectedIds = new Set();
  state.plan = normalizePlan(preset.plan);
  commitPlanChange();
  closeSheet();
  showToast("「" + preset.name + "」を読み込みました");
}

// マイセットの説明の入力欄
function makePresetDescInput(value) {
  const textarea = createEl("textarea");
  textarea.rows = 2;
  textarea.maxLength = CONFIG.maxPresetDescLength;
  textarea.placeholder = "例：週3回、朝にやるメニュー";
  textarea.value = value;
  return textarea;
}

// 今のメニューを新しいマイセットにする
function openPresetCreator() {
  if (state.plan.length === 0) {
    showToast("先にブロックを追加してください");
    return;
  }

  openSheet(function (body) {
    body.append(createEl("h2", null, "マイセットを追加"));

    const input = makeLibraryInput("", CONFIG.maxPresetNameLength);
    input.placeholder = "例：朝のトレーニング";
    body.append(makeField("名前", input));
    const descInput = makePresetDescInput("");
    body.append(makeField("説明（なくてもOK・" + CONFIG.maxPresetDescLength + "文字まで）", descInput));

    const actions = createEl("div", "actions");
    actions.append(makeButton("戻る", "btn wide", openMenu));
    actions.append(makeButton("追加", "btn primary", function () {
      const name = input.value.trim();
      if (name === "") {
        showToast("名前を入力してください");
        return;
      }
      state.presets.push({
        id: makeLibraryId("preset"),
        name: name,
        desc: descInput.value.trim(),
        plan: normalizePlan(state.plan),
      });
      saveState();
      openMenu();
      showToast("「" + name + "」を追加しました");
    }));
    body.append(actions);
  });
}

// マイセットの編集パネル
function openPresetEditor(id) {
  const preset = findPreset(id);
  if (!preset) return;

  openSheet(function (body) {
    body.append(createEl("h2", null, "マイセットを編集"));

    const input = makeLibraryInput(preset.name, CONFIG.maxPresetNameLength);
    body.append(makeField("名前", input));
    const descInput = makePresetDescInput(preset.desc || "");
    body.append(makeField("説明（なくてもOK・" + CONFIG.maxPresetDescLength + "文字まで）", descInput));

    function applyFields() {
      const name = input.value.trim();
      if (name === "") {
        showToast("名前を入力してください");
        return false;
      }
      preset.name = name;
      preset.desc = descInput.value.trim();
      saveState();
      return true;
    }

    const actions = createEl("div", "actions");
    const contentButton = makeButton("中身を編集", "btn", function () {
      if (applyFields()) startPresetEdit(preset);
    });
    const deleteButton = makeButton("削除", "btn danger", function () {
      openConfirm("マイセットを削除", "「" + preset.name + "」を削除します。元に戻せません。", "削除する",
        function () {
          state.presets = state.presets.filter(function (p) { return p !== preset; });
          saveState();
          openMenu();
          showToast("「" + preset.name + "」を削除しました");
        },
        function () { openPresetEditor(preset.id); });
    });
    const backButton = makeButton("戻る", "btn", openMenu);
    backButton.classList.add("wide");
    const saveButton = makeButton("保存", "btn primary", function () {
      if (applyFields()) openMenu();
    });
    actions.append(contentButton, deleteButton, backButton, saveButton);
    body.append(actions);
  });
}

// マイセットの中身を、メインの図で編集する
function startPresetEdit(preset) {
  if (isInProgress()) {
    showToast("編集するには、左下のボタンで最初に戻してください");
    return;
  }
  state.selecting = false;
  state.selectedIds = new Set();
  state.presetEdit = { id: preset.id, backup: state.plan };
  state.plan = normalizePlan(preset.plan);
  commitPlanChange();
  closeSheet();
}

// マイセットの編集を終える。save が true なら保存する
function finishPresetEdit(save) {
  if (!state.presetEdit) return;
  const preset = findPreset(state.presetEdit.id);

  if (save && state.plan.length === 0) {
    showToast("ブロックを1つ以上入れてください");
    return;
  }
  if (save && preset) preset.plan = normalizePlan(state.plan);

  state.plan = state.presetEdit.backup;
  state.presetEdit = null;
  state.selecting = false;
  state.selectedIds = new Set();
  commitPlanChange();
  showToast(save ? "マイセットを保存しました" : "編集をやめました");
}
