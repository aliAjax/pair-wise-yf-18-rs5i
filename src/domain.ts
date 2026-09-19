export type Position = "主石位" | "配石位" | "退回待定";
export type Status = "待分拣" | "待镶嵌" | "已镶嵌" | "退回待定";

export interface Gem {
  id: string; // 宝石编号
  species: string; // 种类
  shape: string; // 形状
  carat: number; // 克拉重量
  size: string; // 尺寸，如 6x4mm
  clarity: string; // 净度
  color: string; // 颜色
  cut: string; // 切工
  position: Position; // 镶嵌位置
  status: Status; // 分拣状态
  defect: string; // 缺陷备注
  orderId: string | null; // 所属订单
  batchId: string | null; // 入库批次
}

export interface Batch {
  id: string;
  name: string;
  time: string;
  count: number;
  status: "已入库" | "已拒绝";
  reasons: string[];
}

export interface Order {
  id: string;
  name: string;
  client: string;
}

export const SPECIES = ["钻石", "蓝宝石", "红宝石", "祖母绿", "尖晶石", "碧玺", "坦桑石", "其他"];
export const SHAPES = ["圆形", "椭圆", "梨形", "祖母绿切", "公主方", "马眼形", "垫形", "心形"];
export const CLARITY_ORDER = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"];
export const CUTS = ["理想", "很好", "好", "一般"];
export const POSITIONS: Position[] = ["主石位", "配石位", "退回待定"];
export const STATUSES: Status[] = ["待分拣", "待镶嵌", "已镶嵌", "退回待定"];

export const SIZE_RANGES: { label: string; test: (mm: number) => boolean }[] = [
  { label: "< 3mm", test: (mm) => mm < 3 },
  { label: "3–5mm", test: (mm) => mm >= 3 && mm < 5 },
  { label: "5–8mm", test: (mm) => mm >= 5 && mm < 8 },
  { label: "≥ 8mm", test: (mm) => mm >= 8 },
];

/** 从尺寸文本（如 "6x4mm"、"2.7mm"）中取最大边长（mm），用于尺寸筛选 */
export function gemSizeMm(size: string): number | null {
  const nums = size.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return nums.length ? Math.max(...nums) : null;
}

/** 净度是否低于 VS2（未知等级按低于处理，禁止进主石位） */
export function clarityBelowVS2(clarity: string): boolean {
  const idx = CLARITY_ORDER.indexOf(clarity);
  return idx < 0 || idx > CLARITY_ORDER.indexOf("VS2");
}

/**
 * 分拣规则：
 * 1. 净度低于 VS2 的宝石不能进入主石位；
 * 2. 有缺陷备注的宝石只能归到配石位或退回待定。
 */
export function validateGem(gem: Gem): string[] {
  const errors: string[] = [];
  if (gem.position === "主石位" && clarityBelowVS2(gem.clarity)) {
    errors.push(`净度 ${gem.clarity} 低于 VS2，不能进入主石位`);
  }
  if (gem.defect.trim() && gem.position === "主石位") {
    errors.push("存在缺陷备注，只能归到配石位或退回待定");
  }
  return errors;
}

export function nextGemId(existing: { id: string }[]): string {
  const max = existing.reduce((m, g) => {
    const n = parseInt(g.id.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 2047);
  return `ST-${max + 1}`;
}

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
