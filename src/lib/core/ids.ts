/**
 * 접두사가 붙은 고유 id를 만든다.
 * crypto.randomUUID는 Tauri WebView와 Node 18+ 모두에서 사용할 수 있다.
 */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
