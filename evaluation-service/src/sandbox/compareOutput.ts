export function compareOutput(actual: string, expected: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .split("\n")
      .map(line => line.trim().replace(/\s+/g, " "))
      .filter(line => line.length > 0);

  const a = norm(actual);
  const e = norm(expected);

  if (a.length !== e.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== e[i]) return false;
  }
  return true;
}
