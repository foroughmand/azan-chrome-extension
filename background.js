// background worker: compute next azan and update action badge/title

// import PrayTimes and CITIES (local files)
// importScripts('cities.js');
importScripts('praytime.js');
importScripts('helper.js');

const BADGE_COLOR_RED = '#d32f2f';
const BADGE_COLOR_GREEN = '#2f932f';
const BADGE_COLOR_PINK = '#FF46A2';
const UPDATE_ALARM = 'update-next-azan';

const order = ['fajr', 'sunrise', 'dhuhr', 'sunset', 'maghrib', 'midnight'];
const AZAN_EMOJIS = {
    fajr: "🌄",
    sunrise: "🌅",
    dhuhr: "☀️",
    sunset: "🌇",
    maghrib: "🌆",
    midnight: "🌙"
};

const focusThresholdMs = [10 * 60 * 1000, 10 * 60 * 1000]; // prev, next

const praytime = new PrayTime('Tehran');
praytime.format((timestamp) => { return timestamp; });
chrome.storage.sync.get('method', (res) => {
    praytime.method(res.method || 'Tehran');
});

// var lastTtitleUpdate = null;

async function updateBadgeAndTitle() {
    chrome.storage.sync.get(['selectedCity', 'method'], (res) => {
        const city = res.selectedCity;
        if (!city) {
            chrome.action.setBadgeText({ text: '' });
            chrome.action.setTitle({ title: 'No city selected' });
            return;
        }
        const now = new Date();
        // const coords = [city.lat, city.lon, city.elevation || 0];
        // const times = getTimes(now, coords, tz, 0);
        const nexts = findNextPrayerTimesForCityObj(praytime, city, now);
        // const diffMs = next.timeDate.getTime() - now.getTime();
        // const badgeText = diffMs <= 0 ? '' : formatDiffForBadge(diffMs);
        // const title = diffMs <= 0
        //     ? `Next: ${next.name.toUpperCase()} at ${next.timeStr}`
        //     : `Next: ${next.name.toUpperCase()} in ${timeDiffToStr(diffMs)} (${next.timeStr})`;
        const focusPrev = nexts.timeSincePrev < focusThresholdMs[0] && nexts.timeToNext > focusThresholdMs[1];
        var badgeText = focusPrev ? '-' + formatDiffForBadge(nexts.timeSincePrev) : formatDiffForBadge(nexts.timeToNext);
        const title = focusPrev
            ? `Prev: ${orderText[nexts.prev.name].toUpperCase()} at ${timeStampToStr(nexts.prev.time)}`
            : `Next: ${orderText[nexts.next.name].toUpperCase()} in ${timeStampToStr(nexts.next.time)}`;
        // const title = focusPrev
        //     ? `Prev: ${nexts.prev.name.toUpperCase()} at ${timeStampToStr(nexts.prev.time)} (-${timeDiffToStr(nexts.timeSincePrev)})`
        //     : `Next: ${nexts.next.name.toUpperCase()} in ${timeStampToStr(nexts.next.time)} (${timeDiffToStr(nexts.timeToNext)})`;

        // badgeText = (AZAN_EMOJIS[nexts.timeSincePrev < 10 * 60 * 1000 ? nexts.prev.name.split('-')[0] : nexts.next.name.split('-')[0]] || '') + ' ' + badgeText;
        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeTextColor({ color: '#ffffff' });       // white text
        if (focusPrev) {
            chrome.action.setBadgeBackgroundColor({ color: mixRGB(BADGE_COLOR_PINK, BADGE_COLOR_GREEN, nexts.timeSincePrev / focusThresholdMs[0]) });
            // chrome.action.setIcon({ path: `${nexts.prev.name}.png` });
        } else if (nexts.timeToNext < 10 * 60 * 1000) {
            chrome.action.setBadgeBackgroundColor({ color: mixRGB(BADGE_COLOR_RED, BADGE_COLOR_PINK, 1 - nexts.timeToNext / focusThresholdMs[1]) });
            // chrome.action.setIcon({ path: `${nexts.next.name}.png` });
        } else {
            chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_PINK });
            // chrome.action.setIcon({ path: `${nexts.next.name}.png` });
        }
        chrome.action.setTitle({ title: title });

        // chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
        // if (lastTtitleUpdate == null || now.getTime() - lastTtitleUpdate > 60 * 1000) {
        //     chrome.action.setTitle({ title: title });
        //     lastTtitleUpdate = now.getTime();
        // }
        //  + ` [${res.method}]`

        // if (nexts.timeSincePrev < 10 * 60 * 1000) {
        //     updateAzanIcon(nexts.prev.name, -nexts.timeSincePrev);
        // } else {
        //     updateAzanIcon(nexts.next.name, nexts.timeToNext);
        // }
    });
}

// setup periodic alarm to update every minute
chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 1 / 60 });

// update on alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === UPDATE_ALARM) updateBadgeAndTitle();
});

// update on extension installed / startup
chrome.runtime.onStartup.addListener(() => updateBadgeAndTitle());
chrome.runtime.onInstalled.addListener(() => updateBadgeAndTitle());

// update when storage changes (city selection or cities list)
chrome.storage.onChanged.addListener((changes, namespace) => {
    // if (area === 'sync' && (changes.selectedCityId || changes.citiesList)) {
    //     updateBadgeAndTitle();
    // }
    // if (area === 'sync') {
        if (changes.selectedCity) {
            praytime.location([changes.selectedCity.lat, changes.selectedCity.lon]);
        }
        if (changes.method) {
            praytime.method(changes.method);
        }
        updateBadgeAndTitle();
    // }

}

);


// initial update
updateBadgeAndTitle();
