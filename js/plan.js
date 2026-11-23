/* ============================================================
   plan.js ― ブロックとくり返しのデータ
   ------------------------------------------------------------
   メニューは「ブロック」と「くり返し」を組み合わせて作ります。

   ブロック  : { id, type: "step",  name: "筋トレ", seconds: 20, kind: "work" }
   くり返し  : { id, type: "group", repeat: 8, items: [ …中身… ] }

   くり返しの items の中に、さらにくり返しを入れることもできます（入れ子）。
   入れ子の上限は CONFIG.maxNestDepth です。
   ============================================================ */

// ブロックやくり返しに付ける番号。1つ作るたびに1ずつ増える
let nextId = 1;

// ブロックを1つ作る
function makeStep(name, seconds, kind) {
  return { id: nextId++, type: "step", name: name, seconds: seconds, kind: kind };
}

// くり返しを1つ作る
function makeGroup(repeat, items) {
  return { id: nextId++, type: "group", repeat: repeat, items: items };
}

// 「＋ ブロック」で追加される、新しいブロック
function makeNewStep() {
  const kind = state.kinds[0];
  return makeStep(kind.name, 30, kind.id);
}


/* ---------- 種類 ---------- */

function findKind(id) {
  return state.kinds.find(function (kind) { return kind.id === id; }) || null;
}

// 種類の色の名前（CSS の k-〇〇 に使う）
function kindColor(id) {
  const kind = findKind(id);
  return kind ? kind.color : "none";
}

// 保存されていた種類を、安全な形に整える
function normalizeKinds(rawKinds) {
  if (!Array.isArray(rawKinds)) return DEFAULT_KINDS.map(function (k) { return Object.assign({}, k); });

  const colors = CONFIG.kindColors.map(function (c) { return c.id; });
  const result = [];
  for (const raw of rawKinds) {
    if (!raw || typeof raw.id !== "string" || raw.id === "") continue;
    if (result.some(function (k) { return k.id === raw.id; })) continue;
    const name = String(raw.name || "").trim().slice(0, CONFIG.maxKindNameLength);
    if (name === "") continue;
    result.push({ id: raw.id, name: name, color: colors.includes(raw.color) ? raw.color : colors[0] });
  }
  return result.length > 0 ? result : DEFAULT_KINDS.map(function (k) { return Object.assign({}, k); });
}

// items の中のブロックすべてに fn を実行する
function forEachStep(items, fn) {
  for (const node of items) {
    if (node.type === "step") fn(node);
    else forEachStep(node.items, fn);
  }
}

// 今のメニュー・マイセット・編集前のメニューをすべて対象に fn を実行する
function forEachSavedStep(fn) {
  forEachStep(state.plan, fn);
  for (const preset of state.presets) forEachStep(preset.plan, fn);
  if (state.presetEdit) forEachStep(state.presetEdit.backup, fn);
}


/* ------------------------------------------------------------
   入れ子をほどいて、上から順に並んだ「実行用のリスト」を作る
   ------------------------------------------------------------
   例：[準備30, くり返し2回[運動20, 休憩10]]
     → [準備30, 運動20, 休憩10, 運動20, 休憩10]

   リストの1つ1つは { node, iterations } の形です。
     node       : 元のブロック
     iterations : 「どのくり返しの何回目か」の記録
                  例：{ 5: 2, 8: 3 } は「id 5 のくり返しの2回目、
                       id 8 のくり返しの3回目」という意味
   ------------------------------------------------------------ */
function flattenPlan(items) {
  const result = [];
  collectSteps(items, {}, result);
  return result;
}

// flattenPlan の中身。くり返しを見つけたら、自分自身を呼び出して中に入っていく
function collectSteps(items, iterations, result) {
  for (const node of items) {
    if (node.type === "step") {
      result.push({ node: node, iterations: iterations });
    } else {
      for (let i = 1; i <= node.repeat; i++) {
        // 「このくり返しの i 回目」を記録に足してから、中身を処理する
        const inner = Object.assign({}, iterations, { [node.id]: i });
        collectSteps(node.items, inner, result);
      }
    }
  }
}


/* ------------------------------------------------------------
   id からブロックやくり返しを探す
   ------------------------------------------------------------
   見つかったら次の形で返す。見つからなければ null。
     node        : 見つかったもの
     parentList  : それが入っている配列（削除や置き換えに使う）
     index       : 配列の何番目か
     depth       : いくつのくり返しの中にあるか（一番外なら 0）
     parentGroup : すぐ外側のくり返し（一番外なら null）
   ------------------------------------------------------------ */
function findNode(id, items, depth, parentGroup) {
  const level = depth || 0;
  for (let i = 0; i < items.length; i++) {
    const node = items[i];
    if (node.id === id) {
      return { node: node, parentList: items, index: i, depth: level, parentGroup: parentGroup || null };
    }
    if (node.type === "group") {
      const found = findNode(id, node.items, level + 1, node);
      if (found) return found;
    }
  }
  return null;
}


/* ---------- 入れ子の段数 ---------- */

// そのブロック／くり返しが持つ、くり返しの段数（ブロックは 0）
function nestHeight(node) {
  if (node.type === "step") return 0;
  let inner = 0;
  for (const child of node.items) inner = Math.max(inner, nestHeight(child));
  return inner + 1;
}


/* ---------- 並べ替え・くり返しで囲む ---------- */

// id のものを、targetGroupId のくり返し（null なら一番外）の index 番目へ動かす
// 動いたら true を返す
function moveNode(id, targetGroupId, targetIndex) {
  const from = findNode(id, state.plan);
  if (!from) return false;

  let targetList = state.plan;
  if (targetGroupId !== null) {
    const target = findNode(targetGroupId, state.plan);
    if (!target) return false;
    targetList = target.node.items;
  }

  let index = targetIndex;
  if (from.parentList === targetList && from.index < index) index--;
  if (from.parentList === targetList && from.index === index) return false;

  from.parentList.splice(from.index, 1);
  targetList.splice(index, 0, from.node);

  // 最後の1つを外に出して空になったくり返しは、枠ごと消す
  let group = from.parentGroup;
  while (group && group.items.length === 0) {
    const found = findNode(group.id, state.plan);
    found.parentList.splice(found.index, 1);
    group = found.parentGroup;
  }
  return true;
}

// ids をくり返しで囲めるか調べる。{ ok, reason, founds } を返す
function checkWrap(ids) {
  const founds = ids
    .map(function (id) { return findNode(id, state.plan); })
    .filter(Boolean)
    .sort(function (a, b) { return a.index - b.index; });

  if (founds.length === 0) {
    return { ok: false, reason: "囲むものをタップして選んでください" };
  }
  if (founds.some(function (f) { return f.parentList !== founds[0].parentList; })) {
    return { ok: false, reason: "同じ段にあるものを選んでください" };
  }
  if (founds.some(function (f, i) { return f.index !== founds[0].index + i; })) {
    return { ok: false, reason: "隣り合ったものを選んでください" };
  }
  const height = Math.max(...founds.map(function (f) { return nestHeight(f.node); }));
  if (founds[0].depth + height + 1 > CONFIG.maxNestDepth) {
    return { ok: false, reason: "くり返しの入れ子は" + CONFIG.maxNestDepth + "段までです" };
  }
  return { ok: true, reason: "", founds: founds };
}

// ids を「2回くり返し」で囲む。囲めたら true を返す
function wrapNodes(ids) {
  const check = checkWrap(ids);
  if (!check.ok) return false;

  const first = check.founds[0];
  const nodes = check.founds.map(function (f) { return f.node; });
  first.parentList.splice(first.index, nodes.length, makeGroup(2, nodes));
  return true;
}


/* ------------------------------------------------------------
   保存されていたデータを、安全な形に整える
   ------------------------------------------------------------
   保存データが壊れていても動くように、値をチェックしながら作り直す。
   id もここで振り直す。マイセットの複製にも使う。
   ------------------------------------------------------------ */
function normalizePlan(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  const result = [];
  for (const raw of rawItems) {
    if (!raw) continue;

    if (raw.type === "group") {
      const repeat = clamp(Number(raw.repeat) || 1, 1, CONFIG.maxRepeat);
      result.push(makeGroup(repeat, normalizePlan(raw.items)));
    }

    if (raw.type === "step") {
      const kind = findKind(raw.kind) || state.kinds[0];
      const name = String(raw.name || kind.name).slice(0, CONFIG.maxNameLength);
      const seconds = clamp(Number(raw.seconds) || 10, 1, CONFIG.maxSeconds);
      result.push(makeStep(name, seconds, kind.id));
    }
  }
  return result;
}
