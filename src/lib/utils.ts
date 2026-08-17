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

// shadcn-svelte 1.5.0이 생성하는 컴포넌트들이 이 세 타입 헬퍼를 $lib/utils에서
// 가져온다. CLI의 registry/utils.json이 배포하는 정의 그대로다 — init을
// 대화형 없이 돌릴 수 없어 add로만 컴포넌트를 설치했고, 그래서 CLI가
// 보통 여기 써넣는 이 타입들을 직접 옮겨 적었다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null }
