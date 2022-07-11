export const lerp = (min: number, max: number, percentage: number): number =>
  min * (1 - percentage) + max * percentage;
