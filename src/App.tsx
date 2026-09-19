import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  Batch,
  CLARITY_ORDER,
  CUTS,
  Gem,
  Order,
  Position,
  POSITIONS,
  SHAPES,
  SPECIES,
  belowVS2,
  uid,
  validateGem,
} from "./domain";
import { clearState, loadState, saveState } from "./storage";

type Tab = "entry" | "batch" | "map" | "orders";

interface FormState {
  code: string;
  species: string;
  shape: string;
  carat: string;
  sizeMm: string;
  clarity: string;
  color: string;
  cut: string;
  position: Position;
  defectNote: string;
}

const emptyForm: FormState = {
  code: "",
  species: "钻石",
  shape: "圆形",
  carat: "",
  sizeMm: "",
  clarity: "VS1",
  color: "",
  cut: "很好",
  position: "配石位",
  defectNote: "",
};

const initial = loadState();

function App() {
  const [gems, setGems] = useState<Gem[]>(initial.gems);
  const [batches, setBatches] = useState<Batch[]>(initial.batches);
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [stagedIds, setStagedIds] = useState<string[]>(initial.stagedIds);
  const [tab, setTab] = useState<Tab>("entry");

  useEffect(() => {
    saveState({ gems, batches, orders, stagedIds });
  }, [gems, batches, orders, stagedIds]);

  const metrics = useMemo(() => {
    const received = batches.filter((b) => b.status === "已接收").length;
    const pending = gems.filter((g) => g.status === "待分拣").length;
    const defects = gems.filter((g) => g.defectNote.trim() !== "").length;
    const carat = gems.reduce((sum, g) => sum + g.carat, 0);
    return { received, pending, defects, carat: carat.toFixed(2) };
  }, [gems, batches]);

  return (
    <main className="app">
      <section className="hero">
        <p>本地工作台 · 数据仅保存在浏览器</p>
        <h1>珠宝镶嵌宝石分拣台</h1>
        <span>
          录入宝石编号、种类、形状、克拉、尺寸、净度、颜色、切工、镶嵌位置与缺陷备注；按批次提交分拣，
          净度低于 VS2 不得进入主石位，有缺陷备注的宝石只能归到配石位或退回待定，违反规则将整批拒绝且原记录不变。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>已接收批次</small>
          <strong>{metrics.received}</strong>
        </article>
        <article>
          <small>待分拣</small>
          <strong>{metrics.pending}</strong>
        </article>
        <article>
          <small>缺陷备注</small>
          <strong>{metrics.defects}</strong>
        </article>
        <article>
          <small>总克拉</small>
          <strong>{metrics.carat}</strong>
        </article>
      </section>

      <nav className="tabs">
        {(
          [
            ["entry", "录入与分拣"],
            ["batch", `分拣批次 (${stagedIds.length})`],
            ["map", "镶嵌位置示意图"],
            ["orders", "订单清单"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} className={tab === key ? "tab active" : "tab"} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "entry" && (
        <EntrySection gems={gems} setGems={setGems} stagedIds={stagedIds} setStagedIds={setStagedIds} />
      )}
      {tab === "batch" && (
        <BatchSection
          gems={gems}
          setGems={setGems}
          batches={batches}
          setBatches={setBatches}
          orders={orders}
          stagedIds={stagedIds}
          setStagedIds={setStagedIds}
        />
      )}
      {tab === "map" && <MapSection gems={gems} />}
      {tab === "orders" && <OrdersSection gems={gems} orders={orders} setOrders={setOrders} />}

      <footer className="footer">
        <span>数据保存在浏览器 localStorage，刷新后保留。</span>
        <button
          onClick={() => {
            if (window.confirm("确定清空全部本地数据并恢复演示数据？")) {
              clearState();
              window.location.reload();
            }
          }}
        >
          重置演示数据
        </button>
      </footer>
    </main>
  );
}

/* ---------------- 录入与分拣 ---------------- */

function EntrySection({
  gems,
  setGems,
  stagedIds,
  setStagedIds,
}: {
  gems: Gem[];
  setGems: (g: Gem[]) => void;
  stagedIds: string[];
  setStagedIds: (ids: string[]) => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [shapeFilter, setShapeFilter] = useState<string | null>(null);
  const [clarityFilter, setClarityFilter] = useState("");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    return gems.filter((g) => {
      if (shapeFilter && g.shape !== shapeFilter) return false;
      if (clarityFilter && g.clarity !== clarityFilter) return false;
      if (minSize !== "" && g.sizeMm < Number(minSize)) return false;
      if (maxSize !== "" && g.sizeMm > Number(maxSize)) return false;
      if (keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        const hay = `${g.code} ${g.species} ${g.color} ${g.cut} ${g.defectNote}`.toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [gems, shapeFilter, clarityFilter, minSize, maxSize, keyword]);

  const formWarnings = validateGem({
    ...({} as Gem),
    position: form.position,
    clarity: form.clarity,
    defectNote: form.defectNote,
  } as Gem);

  function addGem() {
    const code = form.code.trim();
    if (!code) return setFormError("请填写宝石编号");
    if (gems.some((g) => g.code === code)) return setFormError(`编号 ${code} 已存在`);
    const carat = Number(form.carat);
    const sizeMm = Number(form.sizeMm);
    if (!carat || carat <= 0) return setFormError("克拉重量需为正数");
    if (!sizeMm || sizeMm <= 0) return setFormError("尺寸需为正数（mm）");
    const gem: Gem = {
      id: uid(),
      code,
      species: form.species,
      shape: form.shape,
      carat,
      sizeMm,
      clarity: form.clarity,
      color: form.color.trim() || "未分级",
      cut: form.cut,
      position: form.position,
      status: "待分拣",
      defectNote: form.defectNote.trim(),
      batchId: null,
      orderId: null,
    };
    setGems([...gems, gem]);
    setForm({ ...emptyForm, code: "" });
    setFormError("");
  }

  function updatePosition(id: string, position: Position) {
    setGems(gems.map((g) => (g.id === id ? { ...g, position } : g)));
  }

  function removeGem(id: string) {
    setGems(gems.filter((g) => g.id !== id));
    setStagedIds(stagedIds.filter((s) => s !== id));
  }

  function toggleStaged(id: string) {
    setStagedIds(stagedIds.includes(id) ? stagedIds.filter((s) => s !== id) : [...stagedIds, id]);
  }

  return (
    <>
      <section className="workspace">
        <aside className="panel">
          <h2>筛选</h2>
          <div className="filter-block">
            <span className="filter-label">形状</span>
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
          </div>
          <label>
            <span>净度</span>
            <select value={clarityFilter} onChange={(e) => setClarityFilter(e.target.value)}>
              <option value="">全部</option>
              {CLARITY_ORDER.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="size-range">
            <label>
              <span>尺寸 ≥ mm</span>
              <input type="number" min="0" step="0.1" value={minSize} onChange={(e) => setMinSize(e.target.value)} />
            </label>
            <label>
              <span>尺寸 ≤ mm</span>
              <input type="number" min="0" step="0.1" value={maxSize} onChange={(e) => setMaxSize(e.target.value)} />
            </label>
          </div>
          <label>
            <span>关键字</span>
            <input placeholder="编号 / 颜色 / 缺陷…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </label>
          <p className="hint">共 {filtered.length} 颗符合筛选</p>
        </aside>

        <section className="panel form-panel">
          <div className="heading">
            <div>
              <p>专业字段</p>
              <h2>录入宝石</h2>
            </div>
            <button className="primary" onClick={addGem}>
              录入
            </button>
          </div>
          <div className="field-grid">
            <label>
              <span>宝石编号 *</span>
              <input placeholder="如 ST-2120" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </label>
            <label>
              <span>种类</span>
              <select value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
                {SPECIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>形状</span>
              <select value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value })}>
                {SHAPES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>克拉重量 *</span>
              <input type="number" min="0" step="0.01" placeholder="如 0.52" value={form.carat} onChange={(e) => setForm({ ...form, carat: e.target.value })} />
            </label>
            <label>
              <span>尺寸（主尺寸 mm）*</span>
              <input type="number" min="0" step="0.1" placeholder="如 5.2" value={form.sizeMm} onChange={(e) => setForm({ ...form, sizeMm: e.target.value })} />
            </label>
            <label>
              <span>净度</span>
              <select value={form.clarity} onChange={(e) => setForm({ ...form, clarity: e.target.value })}>
                {CLARITY_ORDER.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <span>颜色</span>
              <input placeholder="如 D / 鸽血红 / 皇家蓝" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </label>
            <label>
              <span>切工</span>
              <select value={form.cut} onChange={(e) => setForm({ ...form, cut: e.target.value })}>
                {CUTS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <span>镶嵌位置</span>
              <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value as Position })}>
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="span-2">
              <span>缺陷备注</span>
              <input placeholder="无缺陷可留空；填写后只能归到配石位或退回待定" value={form.defectNote} onChange={(e) => setForm({ ...form, defectNote: e.target.value })} />
            </label>
          </div>
          {formWarnings.length > 0 && (
            <div className="warn-box">
              {formWarnings.map((w) => (
                <p key={w}>⚠ {w}（提交批次时将被整批拒绝）</p>
              ))}
            </div>
          )}
          {formError && <p className="error-text">{formError}</p>}
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>共用数据</p>
            <h2>宝石台账（{filtered.length}）</h2>
          </div>
          <span className="hint">勾选「待分拣」宝石加入当前批次，到「分拣批次」页提交</span>
        </div>
        <div className="table-wrap">
          <table className="gem-table">
            <thead>
              <tr>
                <th>入批</th>
                <th>编号</th>
                <th>种类</th>
                <th>形状</th>
                <th>克拉</th>
                <th>尺寸mm</th>
                <th>净度</th>
                <th>颜色</th>
                <th>切工</th>
                <th>镶嵌位置</th>
                <th>状态</th>
                <th>缺陷备注</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const violations = validateGem(g);
                const staged = stagedIds.includes(g.id);
                return (
                  <tr key={g.id} className={violations.length ? "row-violation" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        disabled={g.status !== "待分拣"}
                        checked={staged}
                        onChange={() => toggleStaged(g.id)}
                      />
                    </td>
                    <td>
                      <b>{g.code}</b>
                    </td>
                    <td>{g.species}</td>
                    <td>{g.shape}</td>
                    <td>{g.carat.toFixed(2)}</td>
                    <td>{g.sizeMm.toFixed(1)}</td>
                    <td>
                      <span className={belowVS2(g.clarity) ? "badge bad" : "badge ok"}>{g.clarity}</span>
                    </td>
                    <td>{g.color}</td>
                    <td>{g.cut}</td>
                    <td>
                      <select
                        className="cell-select"
                        value={g.position}
                        disabled={g.status !== "待分拣"}
                        onChange={(e) => updatePosition(g.id, e.target.value as Position)}
                      >
                        {POSITIONS.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                      {violations.length > 0 && (
                        <span className="badge bad" title={violations.join("\n")}>
                          违规
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={g.status === "待分拣" ? "badge pending" : "badge ok"}>{g.status}</span>
                    </td>
                    <td className="defect-cell">{g.defectNote || "—"}</td>
                    <td>
                      {g.status === "待分拣" && (
                        <button className="link" onClick={() => removeGem(g.id)}>
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="empty">
                    没有符合条件的宝石
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ---------------- 分拣批次 ---------------- */

function BatchSection({
  gems,
  setGems,
  batches,
  setBatches,
  orders,
  stagedIds,
  setStagedIds,
}: {
  gems: Gem[];
  setGems: (g: Gem[]) => void;
  batches: Batch[];
  setBatches: (b: Batch[]) => void;
  orders: Order[];
  stagedIds: string[];
  setStagedIds: (ids: string[]) => void;
}) {
  const [batchName, setBatchName] = useState("");
  const [batchOrder, setBatchOrder] = useState("");
  const [result, setResult] = useState<{ ok: boolean; problems: string[] } | null>(null);

  const staged = gems.filter((g) => stagedIds.includes(g.id));

  function submitBatch() {
    if (staged.length === 0) {
      setResult({ ok: false, problems: ["当前批次为空，请先在「录入与分拣」勾选待分拣宝石"] });
      return;
    }
    const problems = staged.flatMap((g) => validateGem(g).map((m) => `${g.code}：${m}`));
    const name = batchName.trim() || `批次 ${new Date().toLocaleString("zh-CN")}`;
    const orderId = batchOrder || null;
    if (problems.length > 0) {
      // 整批拒绝：仅记录一条「已拒绝」批次，宝石原记录保持不变
      setBatches([
        ...batches,
        { id: uid(), name, orderId, createdAt: new Date().toISOString(), status: "已拒绝", gemIds: staged.map((g) => g.id), rejectReasons: problems },
      ]);
      setResult({ ok: false, problems });
    } else {
      const batchId = uid();
      setGems(
        gems.map((g) =>
          stagedIds.includes(g.id) ? { ...g, status: "已入批" as const, batchId, orderId } : g
        )
      );
      setBatches([
        ...batches,
        { id: batchId, name, orderId, createdAt: new Date().toISOString(), status: "已接收", gemIds: staged.map((g) => g.id), rejectReasons: [] },
      ]);
      setStagedIds([]);
      setBatchName("");
      setResult({ ok: true, problems: [] });
    }
  }

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>当前批次</p>
            <h2>待提交（{staged.length} 颗）</h2>
          </div>
          <button className="primary" onClick={submitBatch}>
            提交整批
          </button>
        </div>
        <div className="field-grid">
          <label>
            <span>批次名称</span>
            <input placeholder="留空则按时间命名" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
          </label>
          <label>
            <span>关联订单</span>
            <select value={batchOrder} onChange={(e) => setBatchOrder(e.target.value)}>
              <option value="">不关联</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {staged.length > 0 ? (
          <div className="staged-list">
            {staged.map((g) => {
              const problems = validateGem(g);
              return (
                <article key={g.id} className={problems.length ? "staged-item bad" : "staged-item"}>
                  <div>
                    <b>{g.code}</b> · {g.species} · {g.shape} · {g.carat.toFixed(2)}ct · {g.clarity} → {g.position}
                    {problems.map((p) => (
                      <p key={p} className="error-text">
                        ⚠ {p}
                      </p>
                    ))}
                  </div>
                  <button className="link" onClick={() => setStagedIds(stagedIds.filter((s) => s !== g.id))}>
                    移出
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="hint">尚未勾选宝石。</p>
        )}
        {result &&
          (result.ok ? (
            <div className="result-ok">✓ 批次已接收，宝石状态更新为「已入批」并关联订单。</div>
          ) : (
            <div className="result-err">
              <b>✗ 整批已拒绝，所有宝石记录保持不变：</b>
              <ul>
                {result.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>历史</p>
            <h2>批次记录（{batches.length}）</h2>
          </div>
        </div>
        <div className="records">
          {batches.length === 0 && <p className="hint">暂无批次。</p>}
          {[...batches].reverse().map((b) => {
            const order = orders.find((o) => o.id === b.orderId);
            const batchGems = gems.filter((g) => b.gemIds.includes(g.id));
            return (
              <article key={b.id}>
                <b className={b.status === "已拒绝" ? "batch-badge bad" : "batch-badge"}>
                  {b.status === "已拒绝" ? "拒" : "收"}
                </b>
                <div>
                  <h3>
                    {b.name} <span className={b.status === "已拒绝" ? "badge bad" : "badge ok"}>{b.status}</span>
                  </h3>
                  <p>
                    {new Date(b.createdAt).toLocaleString("zh-CN")} · {b.gemIds.length} 颗
                    {order ? ` · 订单：${order.name}` : ""}
                    {batchGems.length > 0 && ` · ${batchGems.map((g) => g.code).join("、")}`}
                  </p>
                  {b.rejectReasons.length > 0 && (
                    <ul className="reject-list">
                      {b.rejectReasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

/* ---------------- 镶嵌位置示意图 ---------------- */

function MapSection({ gems }: { gems: Gem[] }) {
  const [zone, setZone] = useState<Position>("主石位");
  const byPosition = (p: Position) => gems.filter((g) => g.position === p);
  const zoneGems = byPosition(zone);

  const halo = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: 160 + 96 * Math.cos(angle), y: 160 + 96 * Math.sin(angle) };
  });

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>镶嵌位置示意图</p>
          <h2>戒托俯视图 · 点击分区查看宝石</h2>
        </div>
      </div>
      <div className="map-wrap">
        <svg viewBox="0 0 320 340" className="ring-svg" role="img" aria-label="镶嵌位置示意图">
          <circle cx="160" cy="150" r="132" className="band" />
          <circle cx="160" cy="150" r="108" className="band-inner" />
          {halo.map((h, i) => (
            <g key={i} className={zone === "配石位" ? "zone active" : "zone"} onClick={() => setZone("配石位")}>
              <circle cx={h.x} cy={h.y} r="17" className="side-stone" />
            </g>
          ))}
          <g className={zone === "主石位" ? "zone active" : "zone"} onClick={() => setZone("主石位")}>
            <circle cx="160" cy="150" r="44" className="center-stone" />
            <text x="160" y="146" textAnchor="middle" className="zone-label">
              主石位
            </text>
            <text x="160" y="164" textAnchor="middle" className="zone-count">
              {byPosition("主石位").length} 颗
            </text>
          </g>
          <g className={zone === "退回待定" ? "zone active" : "zone"} onClick={() => setZone("退回待定")}>
            <rect x="80" y="292" width="160" height="36" rx="8" className="tray" />
            <text x="160" y="315" textAnchor="middle" className="zone-label">
              退回待定（{byPosition("退回待定").length}）
            </text>
          </g>
        </svg>
        <div className="zone-panel">
          <div className="zone-stats">
            {POSITIONS.map((p) => (
              <button key={p} className={zone === p ? "chip active" : "chip"} onClick={() => setZone(p)}>
                {p} · {byPosition(p).length}
              </button>
            ))}
          </div>
          <p className="hint">
            配石位共 {byPosition("配石位").length} 颗（围石 8 位可循环排布）；净度低于 VS2 或有缺陷备注的宝石不会出现在主石位已接收批次中。
          </p>
          <div className="records">
            {zoneGems.length === 0 && <p className="hint">该位置暂无宝石。</p>}
            {zoneGems.map((g, i) => (
              <article key={g.id}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                <div>
                  <h3>
                    {g.code} · {g.species}
                  </h3>
                  <p>
                    {g.shape} · {g.carat.toFixed(2)}ct · {g.sizeMm.toFixed(1)}mm · {g.clarity} · {g.color} · {g.cut}
                    {g.defectNote && ` · 缺陷：${g.defectNote}`} · {g.status}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 订单清单 ---------------- */

function OrdersSection({
  gems,
  orders,
  setOrders,
}: {
  gems: Gem[];
  orders: Order[];
  setOrders: (o: Order[]) => void;
}) {
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [needCenter, setNeedCenter] = useState("1");
  const [needSide, setNeedSide] = useState("8");
  const [error, setError] = useState("");

  function addOrder() {
    if (!name.trim()) return setError("请填写订单名称");
    const order: Order = {
      id: uid(),
      name: name.trim(),
      customer: customer.trim() || "未填写",
      needCenter: Math.max(0, Number(needCenter) || 0),
      needSide: Math.max(0, Number(needSide) || 0),
    };
    setOrders([...orders, order]);
    setName("");
    setCustomer("");
    setError("");
  }

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>新订单</p>
            <h2>创建订单</h2>
          </div>
          <button className="primary" onClick={addOrder}>
            创建
          </button>
        </div>
        <div className="field-grid">
          <label>
            <span>订单名称 *</span>
            <input placeholder="如 ORD-1002 钻石耳钉" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>客户</span>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </label>
          <label>
            <span>需要主石（颗）</span>
            <input type="number" min="0" value={needCenter} onChange={(e) => setNeedCenter(e.target.value)} />
          </label>
          <label>
            <span>需要配石（颗）</span>
            <input type="number" min="0" value={needSide} onChange={(e) => setNeedSide(e.target.value)} />
          </label>
        </div>
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>按订单查看 · 与台账共用数据</p>
            <h2>订单清单（{orders.length}）</h2>
          </div>
        </div>
        <div className="order-grid">
          {orders.map((o) => {
            const assigned = gems.filter((g) => g.orderId === o.id && g.status === "已入批");
            const centers = assigned.filter((g) => g.position === "主石位");
            const sides = assigned.filter((g) => g.position === "配石位");
            const returned = assigned.filter((g) => g.position === "退回待定");
            return (
              <article key={o.id} className="order-card">
                <div className="heading">
                  <div>
                    <h3>{o.name}</h3>
                    <p className="hint">客户：{o.customer}</p>
                  </div>
                  <button className="link" onClick={() => setOrders(orders.filter((x) => x.id !== o.id))}>
                    删除订单
                  </button>
                </div>
                <div className="progress-row">
                  <span>主石 {centers.length}/{o.needCenter}</span>
                  <div className="progress">
                    <i style={{ width: `${Math.min(100, o.needCenter ? (centers.length / o.needCenter) * 100 : 100)}%` }} />
                  </div>
                </div>
                <div className="progress-row">
                  <span>配石 {sides.length}/{o.needSide}</span>
                  <div className="progress">
                    <i style={{ width: `${Math.min(100, o.needSide ? (sides.length / o.needSide) * 100 : 100)}%` }} />
                  </div>
                </div>
                {returned.length > 0 && <p className="hint">退回待定 {returned.length} 颗（不计入订单进度）</p>}
                {assigned.length === 0 ? (
                  <p className="hint">暂无已入批宝石，请在「分拣批次」提交时关联本订单。</p>
                ) : (
                  <ul className="order-gems">
                    {assigned.map((g) => (
                      <li key={g.id}>
                        <b>{g.code}</b> {g.species} · {g.shape} · {g.carat.toFixed(2)}ct · {g.clarity} ·{" "}
                        <span className="badge ok">{g.position}</span>
                        {g.defectNote && <em className="error-text">（缺陷：{g.defectNote}）</em>}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
          {orders.length === 0 && <p className="hint">暂无订单。</p>}
        </div>
      </section>
    </>
  );
}

export default App;
