import type { Batch, Gem, Order } from "./domain";
import { uid } from "./domain";

export interface PersistedState {
  gems: Gem[];
  batches: Batch[];
  orders: Order[];
  stagedIds: string[];
}

const KEY = "gem-sorting-workbench-v1";

function seed(): PersistedState {
  const order1 = uid();
  const order2 = uid();
  return {
    gems: [
      { id: uid(), code: "ST-2048", species: "蓝宝石", shape: "椭圆", carat: 1.24, sizeMm: 6.0, clarity: "VS1", color: "皇家蓝", cut: "很好", position: "主石位", status: "待分拣", defectNote: "", batchId: null, orderId: null },
      { id: uid(), code: "ST-2061", species: "钻石", shape: "圆形", carat: 0.08, sizeMm: 2.7, clarity: "VS2", color: "G", cut: "理想", position: "配石位", status: "待分拣", defectNote: "", batchId: null, orderId: null },
      { id: uid(), code: "ST-2099", species: "祖母绿", shape: "祖母绿切", carat: 0.92, sizeMm: 6.5, clarity: "SI1", color: "艳绿", cut: "好", position: "退回待定", status: "待分拣", defectNote: "内含物明显，需客户确认", batchId: null, orderId: null },
      { id: uid(), code: "ST-2105", species: "红宝石", shape: "梨形", carat: 0.65, sizeMm: 5.8, clarity: "VVS2", color: "鸽血红", cut: "很好", position: "主石位", status: "待分拣", defectNote: "", batchId: null, orderId: null },
      { id: uid(), code: "ST-2110", species: "钻石", shape: "圆形", carat: 0.05, sizeMm: 2.4, clarity: "SI1", color: "H", cut: "好", position: "配石位", status: "待分拣", defectNote: "台面细微划痕", batchId: null, orderId: null },
      { id: uid(), code: "ST-2116", species: "尖晶石", shape: "垫形", carat: 0.48, sizeMm: 4.6, clarity: "VS1", color: "热粉", cut: "很好", position: "配石位", status: "待分拣", defectNote: "", batchId: null, orderId: null },
    ],
    batches: [],
    orders: [
      { id: order1, name: "ORD-0926 祖母绿戒指", customer: "林女士", needCenter: 1, needSide: 12 },
      { id: order2, name: "ORD-0931 蓝宝石吊坠", customer: "陈先生", needCenter: 1, needSide: 8 },
    ],
    stagedIds: [],
  };
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.gems) || !Array.isArray(parsed.batches) || !Array.isArray(parsed.orders)) {
      return seed();
    }
    return { ...parsed, stagedIds: Array.isArray(parsed.stagedIds) ? parsed.stagedIds : [] };
  } catch {
    return seed();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默失败，页面仍可继续使用
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
