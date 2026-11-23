/* ============================================================
   menu.js ― 右上の ≡ ボタンで開くメニュー
   ============================================================ */

function openMenu() {
  openFullSheet(function (body) {
    body.append(createEl("h2", null, "メニュー"));
    body.append(makeMenuSection("マイセット", "タップで読み込み（今のタイマーは置き換わります）", createPresetManager()));
    body.append(makeMenuSection("種類", "タップで編集", createKindManager()));
    body.append(makeMenuSection("設定", null, createThemeSwitch(), createSoundSettings()));
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

// 音の設定（押すと音を選ぶ画面が開く）
function createSoundSettings() {
  const wrapper = createEl("div", "sound-settings");
  const options = [
    ["countSound", "残り3秒"],
    ["changeSound", "切り替わり"],
  ];

  for (const [key, label] of options) {
    const row = makeButton("", "sound-setting", function () {
      openSoundPicker(key, label);
    });
    row.append(createEl("span", null, label), createEl("b", null, soundLabel(state.settings[key])));
    row.setAttribute("aria-label", label + "を変更（今は" + soundLabel(state.settings[key]) + "）");
    wrapper.append(row);
  }
  return makeField("音", wrapper);
}

// 音を選ぶ画面。押すと選ばれて、その音が鳴る
function openSoundPicker(key, title) {
  openFullSheet(function (body) {
    body.append(createEl("h2", null, title));

    const list = createEl("div", "sound-list");
    const choices = [{ id: SOUND_NONE, name: "鳴らさない" }].concat(SOUND_LIST);

    for (const sound of choices) {
      const option = makeButton("", "sound-option", function () {
        state.settings[key] = sound.id;
        saveState();
        for (const other of list.children) {
          other.setAttribute("aria-pressed", other === option);
        }
        if (sound.id === SOUND_NONE) stopPreview();
        else previewSound(sound.id);
      });
      option.append(createEl("b", null, sound.name));
      option.setAttribute("aria-pressed", state.settings[key] === sound.id);
      list.append(option);
    }
    body.append(list);
    body.append(makeButton("戻る", "btn sound-back", backToSoundSettings));
  });

  // 今選んでいる音が見える位置まで動かす
  const selected = $("sheetBody").querySelector('.sound-option[aria-pressed="true"]');
  if (selected) selected.scrollIntoView({ block: "center" });
}

// メニューの「設定」の位置に戻る
function backToSoundSettings() {
  stopPreview();
  openMenu();
  const sections = $("sheetBody").querySelectorAll(".menu-section");
  sections[sections.length - 1].scrollIntoView({ block: "end" });
}
