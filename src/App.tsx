import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  Batch,
  CLARITY_ORDER,
  CUTS,
  Gem,
  gemSizeMm,
  nextGemId,
  Order,
  Position,
  POSITIONS,
  SHAPES,
  SIZE_RANGES,
  SPECIES,
  Status,
  STATUSES,
  uid,
  validateGem,
} from "./domain";

const STORAGE_KEY = "gem-sorting-bench-v1";

interface Persisted {
  gems: Gem[];
  batches: Batch[];
  orders: Order[];
}

const seedGems: Gem[] = [
  {
    id: "ST-2048",
    species: "蓝宝石",
    shape: "椭圆",
    carat: 1.24,
    size: "6x4mm",
    clarity: "VS1",
    color: "皇家蓝",
    cut: "很好",
    position: "主石位",
    status: "待镶嵌",
    defect: "",
    orderId: "ORD-1001",
    batchId: "seed",
  },
  {
    id: "ST-2061",
    species: "钻石",
    shape: "圆形",
    carat: 0.08,
    size: "2.7mm",
    clarity: "VS2",
    color: "F",
    cut: "理想",
    position: "配石位",
    status: "待镶嵌",
    defect: "",
    orderId: "ORD-1001",
    batchId: "seed",
  },
  {
    id: "ST-2099",
    species: "祖母绿",
    shape: "祖母绿切",
    carat: 0.92,
    size: "6x4.5mm",
    clarity: "SI1",
    color: "艳绿",
    cut: "好",
    position: "退回待定",
    status: "退回待定",
    defect: "内含物明显，需客户确认",
    orderId: null,
    batchId: "seed",
  },
];

const seedOrders: Order[] = [
  { id: "ORD-1001", name: "蓝宝石戒指订单", client: "陈女士" },
  { id: "ORD-1002", name: "钻石耳钉订单", client: "王先生" },
];

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Persisted;
    if (Array.isArray(data.gems) && Array.isArray(data.batches) && Array.isArray(data.orders)) {
      return data;
    }
  } catch {
    /* 数据损坏时回退到种子数据 */
  }
  return null;
}

interface FormState {
  id: string;
  species: string;
  shape: string;
  carat: string;
  size: string;
  clarity: string;
  color: string;
  cut: string;
  position: Position;
  status: Status;
  defect: string;
  orderId: string;
}

function emptyForm(id: string): FormState {
  return {
    id,
    species: SPECIES[0],
    shape: SHAPES[0],
    carat: "",
    size: "",
    clarity: "VS1",
    color: "",
    cut: CUTS[0],
    position: "配石位",
    status: "待分拣",
    defect: "",
    orderId: "",
  };
}

/** 镶嵌位置示意图：主石位居中，配石位环绕，退回待定单独置旁 */
function PositionDiagram({
  gems,
  active,
  onSelect,
}: {
  gems: Gem[];
  active: Position | null;
  onSelect: (p: Position | null) => void;
}) {
  const count = (p: Position) => gems.filter((g) => g.position === p).length;
  const halo = Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    return { x: 110 + 48 * Math.cos(angle), y: 92 + 48 * Math.sin(angle) };
  });
  const toggle = (p: Position) => onSelect(active === p ? null : p);

  return (
    <svg viewBox="0 0 220 190" className="diagram" role="img" aria-label="镶嵌位置示意图">
      <circle cx="110" cy="92" r="72" className="band" />
      <circle cx="110" cy="92" r="60" className="band-inner" />

      <g
        className={`node ${active === "配石位" ? "active" : ""}`}
        onClick={() => toggle("配石位")}
      >
        {halo.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="9" className="accent-stone" />
        ))}
        <text x="110" y="180" textAnchor="middle" className="node-label">
          配石位 × {count("配石位")}
        </text>
      </g>

      <g
        className={`node ${active === "主石位" ? "active" : ""}`}
        onClick={() => toggle("主石位")}
      >
        <circle cx="110" cy="92" r="24" className="center-stone" />
        <text x="110" y="97" textAnchor="middle" className="node-count">
          {count("主石位")}
        </text>
        <text x="110" y="62" textAnchor="middle" className="node-label">
          主石位
        </text>
      </g>

      <g
        className={`node ${active === "退回待定" ? "active" : ""}`}
        onClick={() => toggle("退回待定")}
      >
        <rect x="8" y="8" width="58" height="24" rx="6" className="pending-box" />
        <text x="37" y="24" textAnchor="middle" className="node-label small">
          退回待定 × {count("退回待定")}
        </text>
      </g>
    </svg>
  );
}

function App() {
  const persisted = useMemo(loadPersisted, []);
  const [gems, setGems] = useState<Gem[]>(persisted?.gems ?? seedGems);
  const [batches, setBatches] = useState<Batch[]>(persisted?.batches ?? []);
  const [orders, setOrders] = useState<Order[]>(persisted?.orders ?? seedOrders);
  const [draft, setDraft] = useState<Gem[]>([]);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(nextGemId(persisted?.gems ?? seedGems))
  );
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [shapeFilter, setShapeFilter] = useState<string | null>(null);
  const [sizeIdx, setSizeIdx] = useState<number | null>(null);
  const [positionFilter, setPositionFilter] = useState<Position | null>(null);
  const [orderFilter, setOrderFilter] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState({ name: "", client: "" });

  // 数据仅存浏览器：任何变更都写回 localStorage，刷新后保留
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ gems, batches, orders }));
  }, [gems, batches, orders]);

  const metrics = useMemo(
    () => [
      { label: "分拣批次", value: String(batches.filter((b) => b.status === "已入库").length) },
      { label: "待镶嵌", value: String(gems.filter((g) => g.status === "待镶嵌").length) },
      { label: "缺陷备注", value: String(gems.filter((g) => g.defect.trim()).length) },
      { label: "总克拉", value: gems.reduce((s, g) => s + g.carat, 0).toFixed(2) },
    ],
    [gems, batches]
  );

  const filteredGems = useMemo(
    () =>
      gems.filter((g) => {
        if (shapeFilter && g.shape !== shapeFilter) return false;
        if (positionFilter && g.position !== positionFilter) return false;
        if (orderFilter && g.orderId !== orderFilter) return false;
        if (sizeIdx !== null) {
          const mm = gemSizeMm(g.size);
          if (mm === null || !SIZE_RANGES[sizeIdx].test(mm)) return false;
        }
        return true;
      }),
    [gems, shapeFilter, sizeIdx, positionFilter, orderFilter]
  );

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function addToDraft() {
    const id = form.id.trim();
    const carat = parseFloat(form.carat);
    if (!id) return setFormError("请填写宝石编号");
    if (gems.some((g) => g.id === id) || draft.some((g) => g.id === id)) {
      return setFormError(`编号 ${id} 已存在`);
    }
    if (!Number.isFinite(carat) || carat <= 0) return setFormError("克拉重量需为正数");
    if (!form.size.trim()) return setFormError("请填写尺寸，如 6x4mm");

    const gem: Gem = {
      id,
      species: form.species,
      shape: form.shape,
      carat,
      size: form.size.trim(),
      clarity: form.clarity,
      color: form.color.trim() || "未标注",
      cut: form.cut,
      position: form.position,
      status: form.status,
      defect: form.defect.trim(),
      orderId: form.orderId || null,
      batchId: null,
    };
    setDraft((d) => [...d, gem]);
    setForm(emptyForm(nextGemId([...gems, ...draft, gem])));
    setFormError("");
    setNotice(null);
  }

  /** 提交批次：整批校验，任何一颗违规则整批拒绝，已保存记录保持不变 */
  function commitBatch() {
    if (!draft.length) return;
    const time = new Date().toLocaleString("zh-CN", { hour12: false });
    const name = `批次 #${batches.length + 1}`;
    const problems = draft.flatMap((g) => validateGem(g).map((e) => `${g.id}：${e}`));

    if (problems.length) {
      setBatches((bs) => [
        ...bs,
        { id: uid(), name, time, count: draft.length, status: "已拒绝", reasons: problems },
      ]);
      setNotice({
        type: "error",
        text: `${name} 校验未通过（${problems.length} 处违规），整批已拒绝，原有记录未改动。请修正草稿后重新提交。`,
      });
      return;
    }

    const batchId = uid();
    setGems((gs) => [...gs, ...draft.map((g) => ({ ...g, batchId }))]);
    setBatches((bs) => [
      ...bs,
      { id: batchId, name, time, count: draft.length, status: "已入库", reasons: [] },
    ]);
    setDraft([]);
    setNotice({ type: "ok", text: `${name} 已入库，共 ${draft.length} 颗宝石。` });
  }

  /** 修改已入库宝石的镶嵌位置：违规则拒绝修改，原记录不变 */
  function changePosition(gem: Gem, position: Position) {
    const next = { ...gem, position };
    const errors = validateGem(next);
    if (errors.length) {
      setNotice({ type: "error", text: `${gem.id}：${errors.join("；")}，修改未生效。` });
      return;
    }
    setGems((gs) => gs.map((g) => (g.id === gem.id ? next : g)));
    setNotice(null);
  }

  function addOrder() {
    const name = orderForm.name.trim();
    if (!name) return;
    const id = `ORD-${1001 + orders.length}`;
    setOrders((os) => [...os, { id, name, client: orderForm.client.trim() || "未登记" }]);
    setOrderForm({ name: "", client: "" });
  }

  function exportSummary() {
    const blob = new Blob([JSON.stringify({ gems, batches, orders }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gem-sorting-summary.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const draftProblems = draft.map((g) => ({ gem: g, errors: validateGem(g) }));

  return (
    <main className="app">
      <section className="hero">
        <p>珠宝镶嵌 · 本地分拣台</p>
        <h1>珠宝镶嵌宝石分拣</h1>
        <span>
          录入宝石编号、种类、形状、克拉、尺寸、净度、颜色、切工、镶嵌位置与缺陷备注；按批次提交分拣，
          净度低于 VS2 不得进入主石位，有缺陷备注的宝石只能归到配石位或退回待定，违规时整批拒绝。
          数据仅保存在本浏览器，刷新后保留。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      <section className="workspace">
        <aside className="panel">
          <h2>筛选</h2>
          <p className="group-label">形状</p>
          <div className="chips">
            {SHAPES.map((s) => (
              <button
                key={s}
                className={shapeFilter === s ? "chip active" : "chip"}
                onClick={() => setShapeFilter(shapeFilter === s ? null : s)}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="group-label">尺寸（最大边长）</p>
          <div className="chips">
            {SIZE_RANGES.map((r, i) => (
              <button
                key={r.label}
                className={sizeIdx === i ? "chip active" : "chip"}
                onClick={() => setSizeIdx(sizeIdx === i ? null : i)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="group-label">镶嵌位置示意图（点击筛选）</p>
          <PositionDiagram gems={gems} active={positionFilter} onSelect={setPositionFilter} />
          {(shapeFilter || sizeIdx !== null || positionFilter || orderFilter) && (
            <button
              className="clear-filter"
              onClick={() => {
                setShapeFilter(null);
                setSizeIdx(null);
                setPositionFilter(null);
                setOrderFilter(null);
              }}
            >
              清除全部筛选
            </button>
          )}
        </aside>

        <section className="panel form-panel">
          <div className="heading">
            <div>
              <p>专业字段</p>
              <h2>录入宝石（加入当前批次草稿）</h2>
            </div>
            <button className="primary" onClick={addToDraft}>
              加入批次
            </button>
          </div>
          <div className="field-grid">
            <label>
              <span>宝石编号</span>
              <input value={form.id} onChange={(e) => setField("id", e.target.value)} />
            </label>
            <label>
              <span>种类</span>
              <select value={form.species} onChange={(e) => setField("species", e.target.value)}>
                {SPECIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>形状</span>
              <select value={form.shape} onChange={(e) => setField("shape", e.target.value)}>
                {SHAPES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>克拉重量</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="如 1.24"
                value={form.carat}
                onChange={(e) => setField("carat", e.target.value)}
              />
            </label>
            <label>
              <span>尺寸</span>
              <input
                placeholder="如 6x4mm"
                value={form.size}
                onChange={(e) => setField("size", e.target.value)}
              />
            </label>
            <label>
              <span>净度</span>
              <select value={form.clarity} onChange={(e) => setField("clarity", e.target.value)}>
                {CLARITY_ORDER.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <span>颜色</span>
              <input
                placeholder="如 皇家蓝 / F"
                value={form.color}
                onChange={(e) => setField("color", e.target.value)}
              />
            </label>
            <label>
              <span>切工</span>
              <select value={form.cut} onChange={(e) => setField("cut", e.target.value)}>
                {CUTS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <span>镶嵌位置</span>
              <select
                value={form.position}
                onChange={(e) => setField("position", e.target.value as Position)}
              >
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              <span>分拣状态</span>
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>归属订单</span>
              <select value={form.orderId} onChange={(e) => setField("orderId", e.target.value)}>
                <option value="">未分配</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2">
              <span>缺陷备注（有缺陷时只能归到配石位或退回待定）</span>
              <input
                placeholder="无缺陷可留空"
                value={form.defect}
                onChange={(e) => setField("defect", e.target.value)}
              />
            </label>
          </div>
          {formError && <p className="form-error">{formError}</p>}

          <div className="heading draft-heading">
            <div>
              <p>当前批次草稿</p>
              <h2>待提交 {draft.length} 颗</h2>
            </div>
            <button className="primary" disabled={!draft.length} onClick={commitBatch}>
              提交批次
            </button>
          </div>
          {draft.length === 0 ? (
            <p className="empty">尚未录入宝石。提交时整批校验：任何一颗违规，整批拒绝且已保存记录不变。</p>
          ) : (
            <div className="records">
              {draftProblems.map(({ gem, errors }, i) => (
                <article key={gem.id} className={errors.length ? "invalid" : ""}>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <div>
                    <h3>
                      {gem.id} · {gem.species} · {gem.shape} · {gem.carat}ct → {gem.position}
                    </h3>
                    <p>
                      {gem.size} · {gem.clarity} · {gem.color} · {gem.cut}
                      {gem.defect && ` · 缺陷：${gem.defect}`}
                    </p>
                    {errors.map((e) => (
                      <p key={e} className="rule-error">
                        ⚠ {e}
                      </p>
                    ))}
                  </div>
                  <button onClick={() => setDraft((d) => d.filter((g) => g.id !== gem.id))}>
                    移除
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>宝石清单</p>
            <h2>
              已入库 {filteredGems.length} / {gems.length} 颗
              {orderFilter && ` · 订单 ${orderFilter}`}
            </h2>
          </div>
          <button onClick={exportSummary}>导出摘要</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>编号</th>
                <th>种类</th>
                <th>形状</th>
                <th>克拉</th>
                <th>尺寸</th>
                <th>净度</th>
                <th>颜色</th>
                <th>切工</th>
                <th>镶嵌位置</th>
                <th>状态</th>
                <th>缺陷备注</th>
                <th>订单</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredGems.map((g) => (
                <tr key={g.id}>
                  <td>{g.id}</td>
                  <td>{g.species}</td>
                  <td>{g.shape}</td>
                  <td>{g.carat}</td>
                  <td>{g.size}</td>
                  <td>{g.clarity}</td>
                  <td>{g.color}</td>
                  <td>{g.cut}</td>
                  <td>
                    <select
                      value={g.position}
                      onChange={(e) => changePosition(g, e.target.value as Position)}
                    >
                      {POSITIONS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={g.status}
                      onChange={(e) =>
                        setGems((gs) =>
                          gs.map((x) =>
                            x.id === g.id ? { ...x, status: e.target.value as Status } : x
                          )
                        )
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className={g.defect ? "defect" : ""}>{g.defect || "—"}</td>
                  <td>
                    <select
                      value={g.orderId ?? ""}
                      onChange={(e) =>
                        setGems((gs) =>
                          gs.map((x) =>
                            x.id === g.id ? { ...x, orderId: e.target.value || null } : x
                          )
                        )
                      }
                    >
                      <option value="">未分配</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button onClick={() => setGems((gs) => gs.filter((x) => x.id !== g.id))}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredGems.length && (
                <tr>
                  <td colSpan={13} className="empty">
                    没有符合筛选条件的宝石
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="two-col">
        <div className="panel">
          <div className="heading">
            <div>
              <p>分拣批次</p>
              <h2>批次记录</h2>
            </div>
          </div>
          <div className="records">
            {batches.length === 0 && <p className="empty">暂无批次记录</p>}
            {[...batches].reverse().map((b) => (
              <article key={b.id}>
                <b className={b.status === "已拒绝" ? "rejected" : ""}>
                  {b.status === "已入库" ? "入库" : "拒绝"}
                </b>
                <div>
                  <h3>
                    {b.name} · {b.count} 颗 · {b.status}
                  </h3>
                  <p>{b.time}</p>
                  {b.reasons.map((r) => (
                    <p key={r} className="rule-error">
                      ⚠ {r}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="heading">
            <div>
              <p>按订单查看</p>
              <h2>订单清单</h2>
            </div>
          </div>
          <div className="order-form">
            <input
              placeholder="订单名称"
              value={orderForm.name}
              onChange={(e) => setOrderForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              placeholder="客户"
              value={orderForm.client}
              onChange={(e) => setOrderForm((f) => ({ ...f, client: e.target.value }))}
            />
            <button className="primary" onClick={addOrder}>
              新建订单
            </button>
          </div>
          <div className="records">
            {orders.map((o) => {
              const list = gems.filter((g) => g.orderId === o.id);
              return (
                <article key={o.id}>
                  <b>{list.length}</b>
                  <div>
                    <h3>
                      {o.id} · {o.name}（{o.client}）
                    </h3>
                    <p>{list.length ? list.map((g) => g.id).join("、") : "暂无宝石"}</p>
                  </div>
                  <button
                    onClick={() => setOrderFilter(orderFilter === o.id ? null : o.id)}
                    className={orderFilter === o.id ? "active-btn" : ""}
                  >
                    {orderFilter === o.id ? "取消" : "查看"}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
