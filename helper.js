
const orderText = { 'fajr': 'Fajr', 'sunrise': 'Sunrise', 'dhuhr': 'Midday', 'sunset': 'Sunset', 'maghrib': 'Maghrib', 'midnight': 'Midnight' };

async function loadCities() {
    try {
        let CITIES = [];
        const url = chrome.runtime.getURL('cities.json');
        const response = await fetch(url);
        CITIES = await response.json();
        console.log('Loaded', CITIES.length, 'cities');
        return CITIES;
    } catch (err) {
        console.error('Error loading cities:', err);
    }
}

async function loadCountriesDict() {
    try {
        const url = chrome.runtime.getURL('countryInfo.txt');
        const response = await fetch(url);
        const text = await response.text();

        const lines = text.trim().split('\n');
        const dict = {};

        // detect and skip header line if it contains non-country codes
        const startIndex = lines[0].startsWith('country_code') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const [code, ISO3, ISO_Numeric, fips, Country, Capital, Area, Population, Continent, tld, CurrencyCode, CurrencyName, Phone, Postal_Code_Format, Postal_Code_Regex, Languages, geonameid, neighbours, EquivalentFipsCode] = lines[i].split('\t');
            if (code && Country) dict[code.trim()] = Country.trim();
        }

        console.log('Loaded', Object.keys(dict).length, 'countries');
        return dict;

    } catch (err) {
        console.error('Error loading countries:', err);
        return {};
    }
}

function mixRGB(c1, c2, ratio) {
    // Normalize and parse
    const hexToRgb = hex => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
    ];

    const rgbToHex = ([r, g, b]) =>
        '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));

    const [r1, g1, b1] = hexToRgb(c1);
    const [r2, g2, b2] = hexToRgb(c2);

    const r = clamp(r1 * (1 - ratio) + r2 * ratio);
    const g = clamp(g1 * (1 - ratio) + g2 * ratio);
    const b = clamp(b1 * (1 - ratio) + b2 * ratio);

    return rgbToHex([r, g, b]);
}


function findNextPrayerTimesForCityObj(praytime, city, now) {
    // ensure praytime instance is configured for city
    praytime.location([city.lat, city.lon]).timezone(city.timezone);

    const days = [-1, 0, 1]; // yesterday, today, tomorrow
    const all = [];

    for (const d of days) {
        const date = new Date(now.getTime() + d * 24 * 3600 * 1000);
        const times = praytime.getTimes(date);

        for (const key of order) {
            const t = times[key];
            if (!t) continue;

            // Each time value may be Date or timestamp depending on your praytime.js
            // Here we assume it’s a JS timestamp (number). If it’s a Date, use t.getTime()
            const timestamp = t;
            // const name = key + (d === -1 ? '-' : d === 1 ? '+' : '');
            const name = key;
            all.push({ name: name, time: timestamp, dayOffset: d });
        }
    }

    // Find the next event
    const nowTs = now.getTime();
    let nextIndex = all.findIndex(ev => ev.time > nowTs);
    if (nextIndex === -1) nextIndex = all.length - 1; // fallback

    const next = all[nextIndex];
    const prev = all[nextIndex - 1] || all[0];

    const timeSincePrev = nowTs - prev.time;
    const timeToNext = next.time - nowTs;

    return { times: all, nextIndex, next, prev, timeSincePrev, timeToNext };
}

// // Helper: parse "HH:MM" into Date for given reference date
// function parseTimeStrToDate(timeStr, refDate) {
//     const parts = timeStr.split(':').map(p => parseInt(p, 10));
//     return new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), parts[0], parts[1]);
// }

// function computeTzFromLon(lon) {
//   return Math.round(lon / 15);
// }


function timeStampToStr(timestamp) {
    // console.log(timestamp);
    var date = new Date(timestamp);
    var h = date.getHours();
    var m = date.getMinutes();
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
}

function formatDiffForBadge(diffMs) {
    const diffMin = Math.floor(diffMs / (60 * 1000));
    if (diffMin < 1) {
        return Math.floor(diffMs / 1000).toString() + 's';
    }
    if (diffMin < 60) {
        return `${diffMin}m`;
    }
    const hours = Math.floor(diffMin / 60);
    if (hours < 100) {
        return `${hours}h`;
    }
    return '...';
}

// function formatDiffForTitle(diffMs) {
//     let remaining = Math.floor(diffMs / 1000);
//     const hours = Math.floor(remaining / 3600);
//     remaining %= 3600;
//     const minutes = Math.floor(remaining / 60);
//     return `${hours}h ${minutes}m`;
// }

function timeDiffToStr(diffMs) {
    // const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always', style: 'narrow' });
    const hours = Math.floor(diffMs / (3600 * 1000));
    const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
    const seconds = Math.floor((diffMs % (60 * 1000)) / 1000);

    const parts = [];
    if (hours !== 0 || true) parts.push(hours.toString().padStart(2, '0'));
    if (minutes !== 0 || hours !== 0 || true) parts.push(minutes.toString().padStart(2, '0'));
    parts.push(seconds.toString().padStart(2, '0'));

    return parts.join(':');
}


function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

async function loadImageBitmap(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return await createImageBitmap(blob);
}

