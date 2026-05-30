export const DEFAULT_DURATION = 90;

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function overlaps(
  existingStart: string, existingDuration: number,
  newStart: string, newDuration: number,
): boolean {
  const eStart = toMinutes(existingStart);
  const eEnd = eStart + existingDuration;
  const nStart = toMinutes(newStart);
  const nEnd = nStart + newDuration;
  return eStart < nEnd && eEnd > nStart;
}
