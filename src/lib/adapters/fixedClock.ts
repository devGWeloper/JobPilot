import type { Clock } from '../ports/clock'

/** 테스트용. 시각을 고정하고 임의로 옮긴다. */
export class FixedClock implements Clock {
  private current: Date

  // 들어오고 나가는 모든 경로에서 Date를 복사한다.
  // 한 경로라도 참조를 그대로 쥐면 바깥에서 원본을 바꿨을 때
  // 고정돼 있어야 할 시계가 흔들린다.
  constructor(current: Date) {
    this.current = new Date(current.getTime())
  }

  now(): Date {
    return new Date(this.current.getTime())
  }

  set(d: Date): void {
    this.current = new Date(d.getTime())
  }
}
