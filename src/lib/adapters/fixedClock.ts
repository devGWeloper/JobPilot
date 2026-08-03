import type { Clock } from '../ports/clock'

/** 테스트용. 시각을 고정하고 임의로 옮긴다. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime())
  }

  set(d: Date): void {
    this.current = new Date(d.getTime())
  }
}
