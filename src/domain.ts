export type Position = "主石位" | "配石位" | "退回待定";
export type GemStatus = "待分拣" | "已入批";
export type BatchStatus = "已接收" | "已拒绝";

export interface Gem {
  id: string;
  code: string; // 宝石编号
  species: string; // 种类
  shape: string; // 形状
  carat: number; // 克拉重量
  sizeMm: number; // 主尺寸 mm
  clarity: string; // 净度
  color: string; // 颜色
  cut: string; // 切工
  position: Position; // 镶嵌位置
  status: GemStatus; // 分拣状态
  defectNote: string; // 缺陷备注
  batchId: string | null;
  orderId: string | null;
}

export interface Batch {
  id: string;
  name: string;
  orderId: string | null;
  createdAt: string;
  status: BatchStatus;
  gemIds: string[];
  rejectReasons: string[];
}

export interface Order {
  id: string;
  name: string;
  customer: string;
  needCenter: number; // 需要主石数量
  needSide: number; // 需要配石数量
}

export const POSITIONS: Position[] = ["主石位", "配石位", "退回待定"];

export const SPECIES = ["钻石", "红宝石", "蓝宝石", "祖母绿", "尖晶石", "碧玺", "坦桑石", "其他"];

export const SHAPES = ["圆形", "椭圆", "梨形", "祖母绿切", "公主方", "马眼", "垫形", "心形"];

export const CUTS = ["理想", "很好", "好", "一般"];

/** 净度由高到低排序 */
export const CLARITY_ORDER = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"];

export function clarityRank(clarity: string): number {
  const idx = CLARITY_ORDER.indexOf(clarity);
  return idx === -1 ? CLARITY_ORDER.length : idx;
}

/** 净度低于 VS2（即 SI1 及更差） */
export function belowVS2(clarity: string): boolean {
  return clarityRank(clarity) > clarityRank("VS2");
}

/**
 * 分拣规则：
 * 1. 净度低于 VS2 的宝石不能进入主石位；
 * 2. 有缺陷备注的宝石只能归到配石位或退回待定。
 */
export function validateGem(gem: Gem): string[] {
  const errors: string[] = [];
  if (gem.position === "主石位" && belowVS2(gem.clarity)) {
    errors.push(`净度 ${gem.clarity} 低于 VS2，不能进入主石位`);
  }
  if (gem.position === "主石位" && gem.defectNote.trim() !== "") {
    errors.push(`存在缺陷备注「${gem.defectNote}」，只能归到配石位或退回待定`);
  }
  return errors;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
