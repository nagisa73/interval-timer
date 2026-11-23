/* ============================================================
   storage.js ― 保存と読み込み
   ------------------------------------------------------------
   localStorage は、ブラウザの中に文字を保存しておける場所です。
   ページを閉じても消えませんが、その端末のそのブラウザの中だけに
   保存されます（別のスマホやパソコンには引き継がれません）。

   プライベートブラウズなどでは使えないことがあるので、
   失敗してもアプリが止まらないように try { } catch { } で囲んでいます。
   ============================================================ */

// 今のメニュー・設定・種類・マイセットを保存する
function saveState() {
  try {
    const data = {
      plan: state.plan,
      settings: state.settings,
      kinds: state.kinds,
      kindsVersion: CONFIG.kindsVersion,
      presets: state.presets,
      presetEdit: state.presetEdit,
    };
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
  } catch (error) {
    // 保存できなくても、アプリはそのまま使えるので何もしない
  }
}

// 保存されていた内容を読み込む
// 読み込めたら true、何も保存されていなければ false を返す
// （種類やマイセットがない古い保存データは、はじめからの内容で補う）
function loadState() {
  try {
    const text = localStorage.getItem(CONFIG.storageKey);
    if (!text) return false;

    const data = JSON.parse(text);
    const hadPresets = Array.isArray(data.presets);

    // ブロックの種類を確認するので、種類を先に読み込む
    state.kinds = normalizeKinds(data.kinds);

    // はじめから入っている種類の初期色を変えたので、保存データも1回だけ移す
    // （初期色のままのものだけ変える。このあと自分で選び直した色は変更しない）
    const savedKindsVersion = data.kindsVersion || 1;
    const needsKindUpdate = savedKindsVersion < CONFIG.kindsVersion;
    if (savedKindsVersion < 2) changeKindColor("work", "orange", "red");
    if (savedKindsVersion < 3) {
      changeKindColor("rest", "teal", "blue");
      changeKindColor("prep", "indigo", "orange");
    }

    state.plan = normalizePlan(data.plan);
    state.presets = normalizePresets(data.presets);

    if (data.settings) {
      // 以前の「音を鳴らす」をオフにしていた場合は、どちらも「鳴らさない」にする
      if (data.settings.sound === false) {
        state.settings.countSound = SOUND_NONE;
        state.settings.changeSound = SOUND_NONE;
      }
      if (isSoundId(data.settings.countSound)) state.settings.countSound = data.settings.countSound;
      if (isSoundId(data.settings.changeSound)) state.settings.changeSound = data.settings.changeSound;
    }
    if (data.settings && ["auto", "light", "dark"].includes(data.settings.theme)) {
      state.settings.theme = data.settings.theme;
    }
    if (data.presetEdit && findPreset(data.presetEdit.id)) {
      state.presetEdit = {
        id: data.presetEdit.id,
        backup: normalizePlan(data.presetEdit.backup),
      };
    }
    removeOldDefaultPreset(hadPresets);
    if (needsKindUpdate) saveState();
    return true;
  } catch (error) {
    return false;
  }
}


// 種類の色が from のままなら to に変える
function changeKindColor(id, from, to) {
  const kind = findKind(id);
  if (kind && kind.color === from) kind.color = to;
}


/* ---------- 以前の初期マイセットを取り除く ---------- */

// 以前はじめから入っていた「いつものセット」の中身
const OLD_DEFAULT_PLAN_TEXT = JSON.stringify([
  ["準備", 30, "prep"],
  [4, [[8, [["筋トレ", 20, "work"], ["休憩", 10, "rest"]]], ["大休憩", 240, "rest"]]],
]);

// メニューの中身を、比べやすい形にする（id は毎回変わるので含めない）
function planToComparable(items) {
  return items.map(function (node) {
    if (node.type === "step") return [node.name, node.seconds, node.kind];
    return [node.repeat, planToComparable(node.items)];
  });
}

// 保存データに残っている「いつものセット」を消す。
// 今のメニューがその中身のままなら、タバタ式に置き換える
function removeOldDefaultPreset(hadPresets) {
  const old = state.presets.find(function (preset) {
    return preset.id === "default-1" && preset.name === "いつものセット";
  });
  if (hadPresets && !old) return;  // すでに処理済み

  if (old) {
    // 「いつものセット」の中身を編集している途中なら、編集前のメニューに戻す
    if (state.presetEdit && state.presetEdit.id === old.id) {
      state.plan = state.presetEdit.backup;
      state.presetEdit = null;
    }
    state.presets = state.presets.filter(function (preset) { return preset !== old; });
  }

  if (JSON.stringify(planToComparable(state.plan)) === OLD_DEFAULT_PLAN_TEXT) {
    const tabata = findPreset("default-2") || makeDefaultPresets()[0];
    state.plan = normalizePlan(tabata.plan);
  }
  saveState();
}
