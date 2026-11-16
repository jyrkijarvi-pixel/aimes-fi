export function parsePeriod(input) {
  const value = input.trim();
  if (!value) return null;
  const match = value.match(/^(\d{4})(?:\s*(s|[-– ]?luku))?$/i);
  if (!match) throw Error('Invalid period');
  const year = Number(match[1]);
  const decade = Boolean(match[2]);
  if (year < (decade ? 1820 : 1826) || year > new Date().getUTCFullYear() || (decade && year % 10)) {
    throw Error('Invalid period');
  }
  return { year, decade };
}

export function inPeriod(capture, period) {
  if (!period) return true;
  if (capture.start === null || capture.uncertain) return false;
  if (!period.decade) return capture.precision === 'exact' && capture.start === period.year;
  return capture.start >= period.year && capture.end < period.year + 10;
}
