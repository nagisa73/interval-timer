/* ============================================================
   presets.js ― はじめから入っている「マイセット」
   ------------------------------------------------------------
   初めて開いたときに、ここの内容が state.presets に入ります。
   そのあとの追加・編集・削除はアプリの中で行い、ブラウザに保存されます。
     id   : マイセットの番号（重ならない文字）
     name : メニューに出る名前
     desc : 自分で書く説明（なくてもよい）
     plan : メニューの中身
   ============================================================ */

function makeDefaultPresets() {
  return [
    {
      id: "default-2",
      name: "タバタ式",
      plan: [
        makeStep("準備", 10, "prep"),
        makeGroup(8, [
          makeStep("運動", 20, "work"),
          makeStep("休憩", 10, "rest"),
        ]),
      ],
    },
    {
      id: "default-3",
      name: "HIIT 40/20",
      plan: [
        makeStep("準備", 10, "prep"),
        makeGroup(3, [
          makeGroup(6, [
            makeStep("運動", 40, "work"),
            makeStep("休憩", 20, "rest"),
          ]),
          makeStep("休憩", 60, "rest"),
        ]),
      ],
    },
    {
      id: "default-4",
      name: "ポモドーロ（勉強）",
      plan: [
        makeGroup(4, [
          makeStep("勉強", 25 * 60, "work"),
          makeStep("休憩", 5 * 60, "rest"),
        ]),
      ],
    },
  ];
}

// 保存されていたマイセットを、安全な形に整える
function normalizePresets(rawPresets) {
  if (!Array.isArray(rawPresets)) return makeDefaultPresets();

  const result = [];
  for (const raw of rawPresets) {
    if (!raw || typeof raw.id !== "string" || raw.id === "") continue;
    if (result.some(function (p) { return p.id === raw.id; })) continue;
    const name = String(raw.name || "マイセット").slice(0, CONFIG.maxPresetNameLength);
    const desc = String(raw.desc || "").slice(0, CONFIG.maxPresetDescLength);
    result.push({ id: raw.id, name: name, desc: desc, plan: normalizePlan(raw.plan) });
  }
  return result;
}

function findPreset(id) {
  return state.presets.find(function (preset) { return preset.id === id; }) || null;
}
