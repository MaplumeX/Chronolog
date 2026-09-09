// 分类/标签名称 → 色板索引（0–7），FNV-1a 32-bit hash。
// 与前端 web/src/format.ts 的 categoryIndex 为双实现（无共享包机制），两边实现必须逐字一致，
// 由两侧测试用同一批已知向量锚定（server/test/color-hash.test.ts ↔ web/src/format.test.ts）。
// 旧 31 进制多项式 hash 因 31 ≡ -1 (mod 8) 退化为码点交错和，对中文分布有系统性偏差（task 09-09 换用 FNV-1a）。
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit：offset basis 0x811c9dc5、prime 0x01000193，对 8 取模返回 0–7。 */
export function categoryIndex(name: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h % 8;
}
