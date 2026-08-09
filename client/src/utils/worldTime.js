export function deriveWorldConditions(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  const hours = match ? Math.min(23, Number(match[1])) : 12;
  const minutes = match ? Math.min(59, Number(match[2])) : 0;
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const decimalHour = hours + minutes / 60;
  let dayPeriod = 'Noche';
  if (decimalHour < 6) dayPeriod = 'Madrugada';
  else if (decimalHour < 14) dayPeriod = 'Día';
  else if (decimalHour < 20) dayPeriod = 'Tarde';
  const temperatureC = Math.round(17 + 7 * Math.sin(((decimalHour - 8) / 24) * Math.PI * 2));
  return { time, dayPeriod, temperatureC };
}
