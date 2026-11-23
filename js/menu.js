/* ============================================================
   menu.js ― 右上の ≡ ボタンで開くメニュー
   ============================================================ */

function openMenu() {
  openSheet(function (body) {
    body.append(createEl("h2", null, "メニュー"));
    body.append(makeField("マイセット（タップで読み込み。今の設定は置き換わります）", createPresetManager()));
    body.append(makeField("種類（タップで編集）", createKindManager()));
    body.append(makeField("設定", createSettingToggles()));
    body.append(createEl("p", "note",
      "設定はこの端末のブラウザに自動で保存されます。" +
      "タイマー中は画面が消えないようにしています。" +
      "iPhoneはマナーモードだと音が鳴らないことがあります。"));
    body.append(makeButton("閉じる", "btn primary", closeSheet));
  });
}

// オン・オフの設定
function createSettingToggles() {
  const wrapper = createEl("div");

  // [設定の名前, 画面に出す文字]
  const options = [
    ["sound", "音を鳴らす"],
  ];

  for (const [key, label] of options) {
    const row = createEl("label", "toggle");
    const checkbox = createEl("input");
    checkbox.type = "checkbox";
    checkbox.id = "setting-" + key;
    checkbox.checked = state.settings[key];

    checkbox.addEventListener("change", function () {
      state.settings[key] = checkbox.checked;
      saveState();
    });

    row.append(createEl("span", null, label), checkbox);
    wrapper.append(row);
  }
  return wrapper;
}
