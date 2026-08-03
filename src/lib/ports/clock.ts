/**
 * 현재 시각을 얻는 유일한 통로.
 * 도메인 로직이 new Date()를 직접 부르지 않게 해서
 * 시간 의존 동작을 결정적으로 테스트할 수 있게 한다.
 */
export interface Clock {
  now(): Date
}
