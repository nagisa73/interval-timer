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

    // ブロックの種類を確認するので、種類を先に読み込む
    state.kinds = normalizeKinds(data.kinds);
    state.plan = normalizePlan(data.plan);
    state.presets = normalizePresets(data.presets);

    if (data.settings && typeof data.settings.sound === "boolean") {
      state.settings.sound = data.settings.sound;
    }
    if (data.presetEdit && findPreset(data.presetEdit.id)) {
      state.presetEdit = {
        id: data.presetEdit.id,
        backup: normalizePlan(data.presetEdit.backup),
      };
    }
    return true;
  } catch (error) {
    return false;
  }
}
