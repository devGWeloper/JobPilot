import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 조건부 클래스를 합치고 Tailwind 충돌을 해소한다.
 * cn('p-2', 'p-4') === 'p-4' — 뒤에 온 값이 이긴다.
 * shadcn 컴포넌트가 전부 이 함수를 통해 사용자 클래스를 병합한다.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
