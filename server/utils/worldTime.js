function normalizeWorldTime(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function deriveWorldConditions(value) {
    const time = normalizeWorldTime(value) || '12:00';
    const [hours, minutes] = time.split(':').map(Number);
    const decimalHour = hours + minutes / 60;
    let dayPeriod = 'Noche';
    if (decimalHour < 6) dayPeriod = 'Madrugada';
    else if (decimalHour < 14) dayPeriod = 'Día';
    else if (decimalHour < 20) dayPeriod = 'Tarde';
    const temperatureC = Math.round(17 + 7 * Math.sin(((decimalHour - 8) / 24) * Math.PI * 2));
    return { time, dayPeriod, temperatureC };
}

module.exports = { deriveWorldConditions, normalizeWorldTime };
