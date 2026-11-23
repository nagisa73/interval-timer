/* ============================================================
   menu.js ― 右上の ≡ ボタンで開くメニュー
   ============================================================ */

function openMenu() {
  openSheet(function (body) {
    body.append(createEl("h2", null, "メニュー"));
    body.append(makeMenuSection("マイセット", "タップで読み込み（今の内容は置き換わります）", createPresetManager()));
    body.append(makeMenuSection("種類", "タップで編集", createKindManager()));
    body.append(makeMenuSection("設定", null, createThemeSwitch(), createSettingToggles(), createEl("p", "note",
      "設定はこの端末のブラウザに自動で保存されます。" +
      "タイマー中は画面が消えないようにしています。" +
      "iPhoneはマナーモードだと音が鳴らないことがあります。")));
    body.append(makeButton("閉じる", "btn primary", closeSheet));
  });
}

// メニューの1つのまとまり（見出し＋説明＋中身）
function makeMenuSection(title, hint, ...children) {
  const section = createEl("section", "menu-section");
  section.append(createEl("h3", null, title));
  if (hint) section.append(createEl("p", "note", hint));
  section.append(...children);
  return section;
}

// 画面の色の切り替え
function createThemeSwitch() {
  const wrapper = createEl("div", "theme-switch");
  const options = [
    ["auto",  "自動"],
    ["light", "ライト"],
    ["dark",  "ダーク"],
  ];

  for (const [value, label] of options) {
    const button = makeButton(label, null, function () {
      state.settings.theme = value;
      saveState();
      applyTheme();
      for (const other of wrapper.querySelectorAll("button")) {
        other.setAttribute("aria-pressed", other === button);
      }
    });
    button.setAttribute("aria-pressed", state.settings.theme === value);
    wrapper.append(button);
  }
  return makeField("テーマ", wrapper);
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
