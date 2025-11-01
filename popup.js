// Popup: load selected city, compute prayer times, show next prayer and all times.
// importScripts('praytime.js');

const order = ['fajr', 'sunrise', 'dhuhr', 'sunset', 'maghrib', 'midnight'];
const orderNextColor = {
  fajr:    '#4b6cb7',
  sunrise: '#f5a623',
  dhuhr:   '#ffdc73',
  sunset:  '#ff8c42',
  maghrib: '#8b3a3a',
  midnight:'#1b1b2f'
};

const AZAN_ICONS = {};
async function loadAzanIcons() {
    for (const name of order) {
        const url = chrome.runtime.getURL(`${name}.png`);
        const res = await fetch(url);
        const blob = await res.blob();
        AZAN_ICONS[name] = await createImageBitmap(blob);
    }
}

var iconHitboxes = [];

const ribbonTimeLength = [3600 * 1000, 24 * 3600 * 1000];


(async function () {
    // const praytime = new PrayTime('ISNA');
    //   const response = await fetch(chrome.runtime.getURL('praytime.js'));
    //   const code = await response.text();

    //   // Evaluate it in global context
    //   (0, eval)(code); // parentheses prevent scope shadowing

    const praytime = new PrayTime('Tehran');
    praytime.format((timestamp) => { return timestamp; });
    chrome.storage.sync.get('method', (res) => {
        praytime.method(res.method || 'Tehran');
    });


    let tooltipTimer = null;
    function showTooltip(el) {
        const tooltip = document.getElementById('azanTooltip');
        if (!tooltip) return;
        tooltip.textContent = el._title;
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.maxWidth = 'none';

        const rect = el.getBoundingClientRect();
        const popupRect = document.body.getBoundingClientRect();

        // Position above element
        let left = rect.left + rect.width / 2;
        let top = rect.top - 8;

        // Clamp within popup bounds
        const tooltipWidth = tooltip.offsetWidth || 150; // fallback if not yet rendered
        const margin = 4; // small margin from edges
        if (left - tooltipWidth / 2 < margin) {
            left = tooltipWidth / 2 + margin;
        } else if (left + tooltipWidth / 2 > popupRect.width - margin) {
            left = popupRect.width - tooltipWidth / 2 - margin;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.opacity = 1;

        clearInterval(tooltipTimer);
        tooltipTimer = setInterval(() => {
            tooltip.textContent = el._title;
        }, 300);
    }

    function hideTooltip() {
        const tooltip = document.getElementById('azanTooltip');
        if (!tooltip) return;
        tooltip.style.opacity = 0;
        clearInterval(tooltipTimer);
    }


    try {
        await loadAzanIcons();
    } catch (err) {
        console.warn('Icon loading failed:', err);
    }

    // DOM helpers
    function el(id) { return document.getElementById(id); }

    // function parseTimeStrToDate(timeStr, refDate) {
    //     var parts = timeStr.split(':').map(function (p) { return parseInt(p, 10); });
    //     return new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), parts[0], parts[1]);
    // }

    // function timeStampToStr(timestamp) {
    //     // console.log(timestamp);
    //     var date = new Date(timestamp);
    //     var h = date.getHours();
    //     var m = date.getMinutes();
    //     return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
    // }

    function drawAzanCircle(times, now) {
        const container = document.getElementById('azanContainer');
        if (!container) return;
        const W = container.clientWidth;
        const H = container.clientHeight;

        // === Update or create icons ===
        const seenIcons = new Set();
        const seenLines = new Set();
        const iconSize = 25;
        const minGap = iconSize + 6;
        const ribbonY = H - 32 - 8;

        // Time range: last 1h to next 24h
        const startTs = now.getTime() - ribbonTimeLength[0];
        const endTs = now.getTime() + ribbonTimeLength[1];
        const totalRange = endTs - startTs;

        const xForTime = (t) => ((t - startTs) / totalRange) * W;

        // === Compute plot data ===
        const plot_points = [], plot_arcs = [];
        plot_points.push({ name: 'NOW', time: now.getTime(), prev_next: 0, icon: null });
        let lastTime = null, lastName = null;
        for (const t of times) {
            if (!order.includes(t.name)) continue;
            if (lastTime != null) {
                plot_arcs.push({ name: lastName, startTime: lastTime, endTime: t.time , time: t});
            }
            plot_points.push({ name: t.name, time: t.time, icon: AZAN_ICONS[t.name] });
            lastName = t.name;
            lastTime = t.time;
        }

        console.log('Ribbons', plot_arcs, 'Times', times);

        // === Update or create ribbons ===
        const seenRibbons = new Set();
        for (const arc of plot_arcs) {
            const id = `ribbon_${arc.name}_${arc.startTime}`;
            seenRibbons.add(id);
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('div');
                el.id = id;
                el.className = 'ribbon-segment';
                el.style.background = orderNextColor[arc.name] || '#bbb';
                el.style.top = `${ribbonY}px`;
                container.appendChild(el);
            }
            const x1 = xForTime(arc.startTime);
            const x2 = xForTime(arc.endTime);
            el.style.left = `${x1}px`;
            el.style.width = `${Math.max(x2 - x1, 1)}px`;
        }


        // Compute x positions and shift to avoid overlaps
        let iconPositions = plot_points
            .filter(p => p.name !== 'NOW')
            .map(p => ({ ...p, x: xForTime(p.time), y: ribbonY - iconSize - 16 }));
        iconPositions.sort((a, b) => a.x - b.x);
        for (let i = 1; i < iconPositions.length; i++) {
            const prev = iconPositions[i - 1];
            const cur = iconPositions[i];
            if (cur.x - prev.x < minGap) cur.x += minGap - (cur.x - prev.x);
        }

        for (const p of iconPositions) {
            const id = `icon_${p.name}_${p.time}`;
            seenIcons.add(id);
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('img');
                el.id = id;
                el.className = 'azan-icon';
                el.src = chrome.runtime.getURL(`${p.name}.png`);
                el.dataset.name = p.name;
                el.dataset.time = p.time;

                el.addEventListener('mouseenter', () => {
                    // const text = `${p.name} – ${new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                    showTooltip(el);
                });
                el.addEventListener('mouseleave', hideTooltip);

                container.appendChild(el);
            }
            // if (el.title == null || el.title === '') {
            el._title = `${orderText[p.name]} – ${new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            if (p.time > now.getTime()) {
                el._title += ` (in ${timeDiffToStr(p.time - now.getTime())})`;
            } else {
                el._title += ` (was in ${timeDiffToStr(now.getTime() - p.time)})`;
            }
            // }
            // if (el.style.left != `${p.x}px`)
            el.style.left = `${p.x}px`;
            // if (el.style.top != `${p.y}px`)
            el.style.top = `${p.y}px`;

            // Connector line if shifted
            const trueX = xForTime(p.time);
            if (Math.abs(trueX - p.x) > 1) {
                const lineId = `line_${p.name}_${p.time}`;
                seenLines.add(lineId);
                let line = document.getElementById(lineId);
                if (!line) {
                    line = document.createElement('div');
                    line.id = lineId;
                    line.className = 'connector-line';
                    container.appendChild(line);
                }

                const dx = p.x - trueX;
                const dy = (p.y + iconSize) - (ribbonY - 1);
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                line.style.width = `${length}px`;
                line.style.transform = `rotate(${angle}deg)`;
                line.style.left = `${trueX}px`;
                line.style.top = `${ribbonY - 1}px`;
            }
        }

        // === Update or create NOW marker ===
        const nowId = 'now_marker';
        let nowMarker = document.getElementById(nowId);
        if (!nowMarker) {
            nowMarker = document.createElement('div');
            nowMarker.id = nowId;
            nowMarker.className = 'now-marker';
            container.appendChild(nowMarker);
        }
        const xNow = xForTime(now.getTime());
        nowMarker.style.left = `${xNow}px`;
        nowMarker.style.top = `${ribbonY - 10}px`;
        nowMarker.style.height = `${32+10+10}px`;

        // === Cleanup ===
        for (const el of container.querySelectorAll('.ribbon-segment')) {
            if (!seenRibbons.has(el.id)) { el.remove(); console.log('Removed ribbon:', el.id); }
        }
        for (const el of container.querySelectorAll('.azan-icon')) {
            if (!seenIcons.has(el.id)) { el.remove(); console.log('Removed ribbon:', el.id); }
        }
        for (const el of container.querySelectorAll('.connector-line')) {
            if (!seenLines.has(el.id)) { el.remove(); console.log('Removed ribbon:', el.id); }
        }
    }

    // function drawAzanCircle(times, now) {
    //     const canvas = document.getElementById('azanCircle');
    //     if (!canvas) return;
    //     const ctx = canvas.getContext('2d');
    //     const W = canvas.width, H = canvas.height;
    //     ctx.clearRect(0, 0, W, H);

    //     // helper to convert time → angle
    //     function angleForTime(nowTime, dateTime) {
    //         // const hours = date.getHours() + date.getMinutes() / 60;
    //         // return (hours / 24) * 2 * Math.PI - Math.PI / 2; // top = 0h
    //         return (dateTime - nowTime) / (24 * 3600 * 1000) * 2 * Math.PI - Math.PI / 2;
    //     }

    //     var plot_points = [], plot_arcs = [];
    //     plot_points.push({ name: 'NOW', time: now.getTime(), a: angleForTime(now.getTime(), now.getTime()), prev_next: 0, icon: null });
    //     var lastAngle = null, lastTime = null, lastName = null;
    //     for (const t of times) {
    //         if (!order.includes(t.name)) continue;
    //         const a = angleForTime(now.getTime(), t.time);
    //         // if (t.time - now.getTime() > 24 * 3600 * 1000) continue; // out of circle range
    //         if (t.time - now.getTime() > 0) {
    //             if (lastAngle != null) {
    //                 plot_points.push({ name: t.name, time: t.time, a, prev_next: +1, icon: AZAN_ICONS[t.name] });
    //                 plot_arcs.push({ lastAngle, a, startTime: lastTime, endTime: t.time, name: lastName });
    //             }
    //             lastAngle = a;
    //             lastName = t.name;
    //             lastTime = t.time;
    //         } else {
    //             if (lastAngle != null) {
    //                 plot_arcs.push({ lastAngle, a, startTime: lastTime, endTime: t.time, name: lastName });
    //                 plot_points.push({ name: t.name, time: t.time, a, prev_next: -1, icon: AZAN_ICONS[t.name] });
    //             }
    //             lastAngle = a;
    //             lastName = t.name;
    //             lastTime = t.time;
    //         }
    //     }

    //     const ribbonY = H / 2;
    //     const ribbonHeight = 32;

    //     // time range: last 1h to next 24h
    //     const startTs = now.getTime() - 3600 * 1000;
    //     const endTs = now.getTime() + 24 * 3600 * 1000;
    //     const totalRange = endTs - startTs;

    //     const xForTime = (t) => ((t - startTs) / totalRange) * W;

    //     // draw base ribbon
    //     ctx.fillStyle = '#eee';
    //     ctx.fillRect(0, ribbonY - ribbonHeight / 2, W, ribbonHeight);


    //     console.log('times:', times);
    //     // draw colored arcs (segments)
    //     for (const arc of plot_arcs) {
    //         console.log('Drawing arc for', arc.name, 'from', arc.startTime, 'to', arc.endTime);
    //         const color = orderNextColor[arc.name] || '#bbb';
    //         const x1 = xForTime(arc.startTime);
    //         const x2 = xForTime(arc.endTime);
    //         if (x2 < 0 || x1 > W) continue;
    //         console.log('Drawing arc for', arc.name, 'from', arc.startTime, 'to', arc.endTime, 'x1=', x1, 'x2=', x2);
    //         ctx.fillStyle = color;
    //         ctx.fillRect(x1, ribbonY - ribbonHeight / 2, x2 - x1, ribbonHeight);
    //     }


    //     // "Now" marker
    //     const xNow = xForTime(now.getTime());
    //     ctx.strokeStyle = '#d32f2f';
    //     ctx.lineWidth = 2;
    //     ctx.beginPath();
    //     ctx.moveTo(xNow, ribbonY - ribbonHeight);
    //     ctx.lineTo(xNow, ribbonY + ribbonHeight);
    //     ctx.stroke();

    //     // // icons from your plot_points
    //     // const iconSize = 18;
    //     // for (const p of plot_points) {
    //     //     if (p.name === 'NOW') continue;
    //     //     // const t = now.getTime() + (p.a / (2 * Math.PI)) * 24 * 3600 * 1000; // reuse your angle relation
    //     //     const x = xForTime(p.time);
    //     //     if (x < 0 || x > W) continue;
    //     //     const y = ribbonY - ribbonHeight / 2 - 6 - iconSize;
    //     //     if (p.icon) ctx.drawImage(p.icon, x - iconSize / 2, y, iconSize, iconSize);
    //     // }

    //     // --- ICON COLLISION-AVOIDANCE DRAWING ---
    //     iconHitboxes = [];

    //     const iconSize = 25;
    //     const minGap = iconSize + 6; // minimum horizontal distance in px

    //     // Compute icon positions
    //     let iconPositions = [];
    //     for (const p of plot_points) {
    //         if (p.name === 'NOW') continue;
    //         const x = xForTime(p.time);
    //         if (x < 0 || x > W) continue;
    //         iconPositions.push({
    //             x,
    //             y: ribbonY - ribbonHeight / 2 - 6 - iconSize,
    //             icon: p.icon,
    //             name: p.name,
    //             time: p.time
    //         });
    //     }

    //     // Sort icons by x (left → right)
    //     iconPositions.sort((a, b) => a.x - b.x);

    //     // Resolve overlaps by shifting horizontally
    //     for (let i = 1; i < iconPositions.length; i++) {
    //         const prev = iconPositions[i - 1];
    //         const cur = iconPositions[i];
    //         if (cur.x - prev.x < minGap) {
    //             const overlap = minGap - (cur.x - prev.x);
    //             cur.x += overlap; // shift right
    //         }
    //     }

    //     // Draw connectors + icons
    //     ctx.strokeStyle = '#888';
    //     ctx.lineWidth = 1;
    //     for (const p of iconPositions) {
    //         // Compute the "true" x based on time (before shifting)
    //         const trueX = xForTime(p.time);
    //         const yBase = ribbonY - ribbonHeight / 2;

    //         // Connector line if shifted
    //         if (Math.abs(trueX - p.x) > 1) {
    //             ctx.beginPath();
    //             ctx.moveTo(trueX, yBase);
    //             ctx.lineTo(p.x, p.y + iconSize);
    //             ctx.stroke();
    //         }

    //         iconHitboxes.push({
    //             name: p.name,
    //             time: p.time,
    //             x: p.x - iconSize / 2,
    //             y: p.y,
    //             w: iconSize,
    //             h: iconSize,
    //         });

    //         // Draw icon
    //         if (p.icon) ctx.drawImage(p.icon, p.x - iconSize / 2, p.y, iconSize, iconSize);

    //         // // Optional: label below icon
    //         // ctx.fillStyle = '#333';
    //         // ctx.font = '10px sans-serif';
    //         // ctx.textAlign = 'center';
    //         // ctx.fillText(p.name, p.x, p.y + iconSize + 10);
    //     }
    //     // --- END ICON COLLISION-AVOIDANCE DRAWING ---

    // }

    // function findNextPrayerTimesForCityObj(city, now) {
    //     // ensure praytime instance is configured for city
    //     praytime.location([city.lat, city.lon]).timezone(city.timezone);

    //     const days = [-1, 0, 1]; // yesterday, today, tomorrow
    //     const all = [];

    //     for (const d of days) {
    //         const date = new Date(now.getTime() + d * 24 * 3600 * 1000);
    //         const times = praytime.getTimes(date);

    //         for (const key of order) {
    //             const t = times[key];
    //             if (!t) continue;

    //             // Each time value may be Date or timestamp depending on your praytime.js
    //             // Here we assume it’s a JS timestamp (number). If it’s a Date, use t.getTime()
    //             const timestamp = t;
    //             // const name = key + (d === -1 ? '-' : d === 1 ? '+' : '');
    //             const name = key;
    //             all.push({ name: name, time: timestamp, dayOffset: d });
    //         }
    //     }

    //     // // Sort by time just in case
    //     // all.sort((a, b) => a.time - b.time);

    //     // Find the next event
    //     const nowTs = now.getTime();
    //     let nextIndex = all.findIndex(ev => ev.time > nowTs);
    //     if (nextIndex === -1) nextIndex = all.length - 1; // fallback

    //     const next = all[nextIndex];
    //     const prev = all[nextIndex - 1] || all[0];

    //     const timeSincePrev = nowTs - prev.time;
    //     const timeToNext = next.time - nowTs;

    //     return { times: all, nextIndex, next, prev, timeSincePrev, timeToNext };
    // }

    function setupUI() {
        console.log("setupUI running, readyState:", document.readyState);
        var cityEl = el('city');
        var prayerNameEl = el('prayer-name');
        var prayerTimeEl = el('prayer-time');
        var allTimesEl = el('all-times');
        // var openOptionsBtn = el('open-options');
        var openOptionsBtn = el('settings');
        var refreshBtn = el('refresh');

        function render(city, method) {
            if (!city) {
                cityEl.textContent = 'No city selected';
                prayerNameEl.textContent = '';
                prayerTimeEl.textContent = '';
                allTimesEl.textContent = 'Open options to select a city.';
                return;
            }
            // normalize keys
            //   var lat = city.lat != null ? Number(city.lat) : (city.latitude != null ? Number(city.latitude) : null);
            //   var lon = city.lon != null ? Number(city.lon) : (city.lng != null ? Number(city.lng) : (city.lon || city.lng));
            //   var height = city.height != null ? Number(city.height) : (city.elevation != null ? Number(city.elevation) : 0);
            //   if (lat == null || lon == null) {
            //     cityEl.textContent = city.city || city.name || 'Unknown city';
            //     allTimesEl.textContent = 'City missing coordinates.';
            //     return;
            //   }
            const cityText = (city.city || city.name || (city.name || 'Selected City')) + ` [${method}]`;
            if (cityEl.textContent !== cityText)
                cityEl.textContent = cityText;
            var now = new Date();
            praytime.location([city.lat, city.lon]).timezone(city.timezone);
            const times = praytime.getTimes(now);

            //   var tz = computeTzFromLon(lon);
            //   window._popup_coords = [lat, lon, height];
            //   window._popup_tz = tz;
            //   var times = getTimes(now, window._popup_coords, tz, 0);
            var nexts = findNextPrayerTimesForCityObj(praytime, city, now);
            prayerNameEl.textContent = orderText[nexts.next.name].toUpperCase();
            prayerTimeEl.textContent = timeStampToStr(nexts.next.time) + ' (in ' + timeDiffToStr(nexts.timeToNext) + ')';
            // var lines = [];
            // ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(function (k) {
            //     lines.push(k + ': ' + timeStampToStr(times[k]));
            // });
            var importantTimeIndex = nexts.nextIndex,
                importantTimeIndexEnd = nexts.nextIndex + order.length;
            if (nexts.timeSincePrev < 10 * 60 * 1000) { // 10 minutes
                importantTimeIndex = nexts.nextIndex - 1;
            }

            var lines = [];
            for (var i = importantTimeIndex; i < importantTimeIndexEnd; i++) {
                var ev = nexts.times[i];
                if (!ev) continue;
                lines.push(orderText[ev.name] + ': ' + timeStampToStr(ev.time));
            }
            allTimesEl.textContent = lines.join('  |  ');

            // console.log('nexts:', nexts.times)

            // drawAzanCircle(nexts.times.slice(nexts.nextIndex - (nexts.timeSincePrev < 10 * 60 * 1000 ? 1 : 0) - 2, nexts.nextIndex + order.length + 2), now);
            drawAzanCircle(nexts.times, now);

        }

        function refresh() {
            chrome.storage.sync.get(['selectedCity', 'method'], function (res) {
                render(res.selectedCity, res.method);
            });
        }

        setInterval(refresh, 500);

        openOptionsBtn && openOptionsBtn.addEventListener('click', function () {
            if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
            else window.open('options.html');
        });
        refreshBtn && refreshBtn.addEventListener('click', refresh);

        // function showIconTooltip(box, canvas) {
        //     const tooltip = document.getElementById('azanTooltip');
        //     if (!tooltip) return;

        //     const rect = canvas.getBoundingClientRect();
        //     const label = `${box.name} – ${new Date(box.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        //     tooltip.textContent = label;

        //     // Tooltip position (above the icon)
        //     const tooltipX = rect.left + box.x + box.w / 2;
        //     const tooltipY = rect.top + box.y - 10;

        //     tooltip.style.left = `${tooltipX}px`;
        //     tooltip.style.top = `${tooltipY}px`;
        //     tooltip.style.opacity = 1;
        // }


        // const canvas = document.getElementById('azanCircle');
        // let hoverTarget = null;

        // canvas.addEventListener('mousemove', (e) => {
        //     const rect = canvas.getBoundingClientRect();
        //     const mx = e.clientX - rect.left;
        //     const my = e.clientY - rect.top;

        //     let found = null;
        //     for (const box of iconHitboxes) {
        //         if (
        //             mx >= box.x &&
        //             mx <= box.x + box.w &&
        //             my >= box.y &&
        //             my <= box.y + box.h
        //         ) {
        //             found = box;
        //             break;
        //         }
        //     }

        //     if (found !== hoverTarget) {
        //         hoverTarget = found;
        //         // drawAzanCircle(times, now); // redraw to remove old highlight
        //         if (found) showIconTooltip(found, canvas);
        //     }
        // });

        // canvas.addEventListener('mouseleave', () => {
        //     hoverTarget = null;
        //     // drawAzanCircle(times, now);
        // });

        // initial
        refresh();
        console.log("setupUI ran; cityEl =", document.getElementById("city"));
    }

    // Main render
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupUI);
    } else {
        setupUI(); // DOM already parsed
    }

})();
