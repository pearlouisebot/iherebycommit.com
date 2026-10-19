// s3y185 (_grokbot): Colmi ring protocol (R02/R03/R06/R10 family), from the open-source colmi_r02_client and Gadgetbridge Colmi docs.
// Pure functions (no Bluetooth) so they can be unit tested. 16-byte packets: [cmd, data..., checksum = sum(bytes 0..14) & 0xFF].
(function (root) {
  var P = {
    SVC: '6e40fff0-b5a3-f393-e0a9-e50e24dcca9e', RX: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', TX: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
    BIG_SVC: 'de5bf728-d711-4e47-af26-65e3012a5dc7', BIG_WRITE: 'de5bf72a-d711-4e47-af26-65e3012a5dc7', BIG_NOTIFY: 'de5bf729-d711-4e47-af26-65e3012a5dc7',
    CMD_SET_TIME: 0x01, CMD_BATTERY: 0x03, CMD_HR_LOG: 0x15, CMD_STEPS: 0x43, CMD_RT_START: 0x69, CMD_RT_STOP: 0x6a
  };
  P.checksum = function (b) { var s = 0; for (var i = 0; i < 15; i++) s += b[i] || 0; return s & 0xff; };
  P.packet = function (cmd, data) {
    if (cmd < 0 || cmd > 255) throw new Error('cmd');
    data = data || []; if (data.length > 14) throw new Error('data too long');
    var b = new Uint8Array(16); b[0] = cmd; for (var i = 0; i < data.length; i++) b[i + 1] = data[i] & 0xff; b[15] = P.checksum(b); return b;
  };
  P.valid = function (b) { return b && b.length === 16 && P.checksum(b) === b[15]; };
  P.bcd = function (n) { return ((Math.floor(n / 10) % 10) << 4) | (n % 10); };
  P.unbcd = function (b) { return (b >> 4) * 10 + (b & 15); };
  // Set time: the ring keeps local wall-clock time. Last byte 1 = English.
  P.setTime = function (d) { return P.packet(P.CMD_SET_TIME, [P.bcd(d.getFullYear() % 100), P.bcd(d.getMonth() + 1), P.bcd(d.getDate()), P.bcd(d.getHours()), P.bcd(d.getMinutes()), P.bcd(d.getSeconds()), 1]); };
  P.battery = function () { return P.packet(P.CMD_BATTERY); };
  P.parseBattery = function (b) { return b[0] === P.CMD_BATTERY ? { level: b[1], charging: !!b[2] } : null; };
  // Steps for one day: dayOffset 0 = today.
  P.steps = function (dayOffset) { return P.packet(P.CMD_STEPS, [dayOffset & 0xff, 0x0f, 0x00, 0x5f, 0x01]); };
  // Heart-rate log for the local day starting at `d` (local midnight expressed as if UTC, matching the ring clock).
  P.dayTs = function (d) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 1000); };
  P.hrLog = function (d) { var t = P.dayTs(d); return P.packet(P.CMD_HR_LOG, [t & 0xff, (t >>> 8) & 0xff, (t >>> 16) & 0xff, (t >>> 24) & 0xff]); };
  // s3y186: real-UTC variant of the day start (some firmware keys the HR log by true UTC midnight) and today's total steps (0x48).
  P.hrLogUtc = function (d) { var t = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000); return P.packet(P.CMD_HR_LOG, [t & 0xff, (t >>> 8) & 0xff, (t >>> 16) & 0xff, (t >>> 24) & 0xff]); };
  P.CMD_STEPS_TODAY = 0x48; P.stepsToday = function () { return P.packet(P.CMD_STEPS_TODAY); };
  P.hex = function (b) { return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(' '); };
  // s3y187: heart-rate log settings (0x16), per colmi_r02_client: read = [0x16, 0x01]; write = [0x16, 0x02, 1 on | 2 off, minutes].
  P.CMD_HR_SETTINGS = 0x16;
  P.hrSettingsRead = function () { return P.packet(P.CMD_HR_SETTINGS, [0x01]); };
  P.hrSettingsWrite = function (enabled, minutes) { minutes = Math.max(5, Math.min(60, Math.round((+minutes || 5) / 5) * 5)); return P.packet(P.CMD_HR_SETTINGS, [0x02, enabled ? 1 : 2, minutes]); };
  P.parseHrSettings = function (b) { return b && b[0] === P.CMD_HR_SETTINGS ? { enabled: b[2] === 1, minutes: b[3] } : null; };
  // s3y188: other health settings + history, per Gadgetbridge ColmiR0xConstants / colmi_r02_client (not yet confirmed on her ring).
  // Settings: read [cmd, 0x01]; write [cmd, 0x02, 1|0]. Temperature: [0x3a, 0x03, 0x01] read / [0x3a, 0x03, 0x02, 1|0] write.
  P.PREF = { spo2: 0x2c, stress: 0x36, hrv: 0x38, temp: 0x3a };
  P.prefRead = function (k) { return k === 'temp' ? P.packet(0x3a, [0x03, 0x01]) : P.packet(P.PREF[k], [0x01]); };
  P.prefWrite = function (k, on) { return k === 'temp' ? P.packet(0x3a, [0x03, 0x02, on ? 1 : 0]) : P.packet(P.PREF[k], [0x02, on ? 1 : 0]); };
  // Tolerant: value byte after the sub-command; 1 = on (some firmware answer 1/2 like the HR setting: 2 = off).
  P.parsePref = function (k, b) { if (!b || b[0] !== P.PREF[k]) return null; var v = k === 'temp' ? b[3] : b[2]; return { enabled: v === 1, raw: v }; };
  // Stress (0x37) and HRV (0x39) history: [cmd, daysAgo]. Reply like the HR log: sub 0 = header (packets, interval min), sub 1 values from byte 3, later from byte 2; 0xff = no data.
  P.CMD_STRESS = 0x37; P.CMD_HRV = 0x39;
  P.histReq = function (cmd, daysAgo) { return P.packet(cmd, [daysAgo & 0xff]); };
  P.HistParser = function (cmd) { this.cmd = cmd; this.size = 0; this.range = 30; this.vals = []; this.done = false; this.none = false; };
  P.HistParser.prototype.feed = function (b) {
    if (b[0] !== this.cmd) return this.done; var sub = b[1], i;
    if (sub === 0xff) { this.none = true; this.done = true; return true; }
    if (sub === 0) { this.size = b[2]; this.range = b[3] || 30; if (this.size <= 1) this.done = true; return this.done; }
    for (i = sub === 1 ? 3 : 2; i < 15; i++) this.vals.push(b[i]);
    if (sub >= this.size - 1) this.done = true; return this.done;
  };
  P.HistParser.prototype.samples = function () { var r = this.range; return this.vals.map(function (v, i) { return { min: i * r, v: v }; }).filter(function (x) { return x.v > 0 && x.v < 255 && x.min < 1440; }); };
  // Big-data channel (0xbc): SpO2 0x2a, temperature 0x25. Requests as in Gadgetbridge.
  P.spo2Req = function () { return new Uint8Array([0xbc, 0x2a, 0x01, 0x00, 0xff, 0x00, 0xff]); };
  P.tempReq = function () { return new Uint8Array([0xbc, 0x25, 0x01, 0x00, 0x3e, 0x81, 0x02]); };
  P.BigParser = function (type) { this.type = type; this.buf = []; this.need = null; this.done = false; };
  P.BigParser.prototype.feed = function (b) {
    if (this.need == null) { if (b[0] !== 0xbc || b[1] !== this.type) return false; this.need = 6 + (b[2] | (b[3] << 8)); }
    for (var i = 0; i < b.length; i++) this.buf.push(b[i]); if (this.buf.length >= this.need) this.done = true; return this.done;
  };
  // SpO2: per day [daysAgo, then 24 x (min, max)]; zeros skipped.
  P.BigParser.prototype.spo2 = function (today) { var b = this.buf, out = [], i = 6, end = Math.min(b.length, this.need || b.length);
    while (i + 49 <= end) { var ago = b[i++]; for (var h = 0; h < 24; h++, i += 2) { var lo = b[i], hi = b[i + 1]; if (lo > 0 && hi > 0 && lo <= 100 && hi <= 100) out.push({ daysAgo: ago, min: h * 60, lo: lo, hi: hi, day: today ? P.ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - ago)) : null }); } }
    return out; };
  // Temperature: per day [daysAgo, then 48 half-hour bytes]; °C = byte/10 + 20; zeros skipped.
  P.BigParser.prototype.temp = function (today) { var b = this.buf, out = [], i = 6, end = Math.min(b.length, this.need || b.length);
    while (i + 49 <= end) { var ago = b[i++]; for (var k = 0; k < 48; k++, i++) { var v = b[i]; if (v > 0) out.push({ daysAgo: ago, min: k * 30, c: Math.round((v / 10 + 20) * 10) / 10, day: today ? P.ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - ago)) : null }); } }
    return out; };
  // Extra daily fields from the new metrics, added onto summarize() output.
  P.summarizeExtra = function (days, extra) {
    var m = {}; days.forEach(function (d) { m[d.day] = d; });
    function g(d) { return m[d] || (m[d] = { day: d, summary: {} }); }
    function agg(list, key, val, pre, dp) { var by = {}; list.forEach(function (x) { if (!x.day) return; (by[x.day] = by[x.day] || []).push(val(x)); });
      Object.keys(by).forEach(function (d) { var v = by[d], s = g(d).summary, mul = Math.pow(10, dp || 0); s[pre + '_avg'] = Math.round(v.reduce(function (a, c) { return a + c; }, 0) / v.length * mul) / mul; s[pre + '_min'] = Math.min.apply(null, v); s[pre + '_max'] = Math.max.apply(null, v); }); }
    agg(extra.spo2 || [], 'spo2', function (x) { return (x.lo + x.hi) / 2; }, 'spo2', 1); (extra.spo2 || []).forEach(function (x) { if (x.day) { var s = g(x.day).summary; s.spo2_max = Math.max(s.spo2_max || 0, x.hi); s.spo2_min = Math.min(s._lo == null ? 999 : s._lo, x.lo); s._lo = s.spo2_min; } });
    Object.keys(m).forEach(function (k) { delete m[k].summary._lo; });
    agg(extra.stress || [], 'stress', function (x) { return x.v; }, 'stress');
    agg(extra.hrv || [], 'hrv', function (x) { return x.v; }, 'hrv');
    agg(extra.temp || [], 'temp', function (x) { return x.c; }, 'temp', 1);
    return Object.keys(m).sort().reverse().map(function (k) { return m[k]; });
  };
  P.rtStart = function () { return P.packet(P.CMD_RT_START, [0x01, 0x01]); };
  P.rtStop = function () { return P.packet(P.CMD_RT_STOP, [0x01, 0x00, 0x00]); };
  P.sleepReq = function () { return new Uint8Array([0xbc, 0x27, 0x01, 0x00, 0xff, 0x00, 0xff]); };
  // Steps parser: feed packets; returns {done, rows}. rows = 15-minute slots.
  P.StepsParser = function () { this.rows = []; this.newCal = false; this.done = false; this.none = false; };
  P.StepsParser.prototype.feed = function (b) {
    if (b[0] !== P.CMD_STEPS) return this.done;
    if (b[1] === 0xff) { this.none = true; this.done = true; return true; }
    if (b[1] === 0xf0) { this.newCal = b[3] === 1; return false; }
    var cal = b[7] | (b[8] << 8); if (this.newCal) cal *= 10;
    this.rows.push({ date: '20' + String(P.unbcd(b[1])).padStart(2, '0') + '-' + String(P.unbcd(b[2])).padStart(2, '0') + '-' + String(P.unbcd(b[3])).padStart(2, '0'),
      slot: b[4], calories: cal, steps: b[9] | (b[10] << 8), distance_m: b[11] | (b[12] << 8) });
    if (b[5] >= b[6] - 1) this.done = true; return this.done;
  };
  // Heart-rate log parser.
  P.HrParser = function () { this.size = 0; this.range = 5; this.ts = null; this.hr = []; this.done = false; this.none = false; };
  P.HrParser.prototype.feed = function (b) {
    if (b[0] !== P.CMD_HR_LOG) return this.done;
    var sub = b[1], i;
    if (sub === 0xff) { this.none = true; this.done = true; return true; }
    if (sub === 0) { this.size = b[2]; this.range = b[3] || 5; if (this.size <= 1) this.done = true; return this.done; }
    if (sub === 1) { this.ts = (b[2] | (b[3] << 8) | (b[4] << 16) | (b[5] << 24)) >>> 0; for (i = 6; i < 15; i++) this.hr.push(b[i]); }
    else for (i = 2; i < 15; i++) this.hr.push(b[i]);
    if (sub >= this.size - 1) this.done = true; return this.done;
  };
  P.HrParser.prototype.readings = function () { var r = this.range; return this.hr.map(function (v, i) { return { min: i * r, bpm: v }; }).filter(function (x) { return x.bpm > 0 && x.min < 1440; }); };
  // Sleep (big-data channel, type 0x27). Collect chunks until the announced length arrives.
  P.SleepParser = function () { this.buf = []; this.need = null; this.done = false; };
  P.SleepParser.prototype.feed = function (b) {
    if (this.need == null) { if (b[0] !== 0xbc || b[1] !== 0x27) return false; this.need = 6 + (b[2] | (b[3] << 8)); }
    for (var i = 0; i < b.length; i++) this.buf.push(b[i]);
    if (this.buf.length >= this.need) this.done = true; return this.done;
  };
  // Stage codes per Gadgetbridge: 2 light, 3 deep, 4 REM, 5 awake.
  P.SleepParser.prototype.days = function (today) {
    var b = this.buf, out = [], n = b[6] || 0, i = 7;
    for (var d = 0; d < n && i + 6 <= b.length; d++) {
      var ago = b[i], len = b[i + 1], st = b[i + 2] | (b[i + 3] << 8), en = b[i + 4] | (b[i + 5] << 8), rec = { daysAgo: ago, start_min: st, end_min: en, light_min: 0, deep_min: 0, rem_min: 0, awake_min: 0 };
      for (var j = i + 6; j + 1 < i + 2 + len && j + 1 < b.length; j += 2) { var t = b[j], m = b[j + 1]; if (t === 2) rec.light_min += m; else if (t === 3) rec.deep_min += m; else if (t === 4) rec.rem_min += m; else if (t === 5) rec.awake_min += m; }
      rec.sleep_min = rec.light_min + rec.deep_min + rec.rem_min;
      if (today) { var dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ago); rec.day = P.ymd(dt); }
      out.push(rec); i += 2 + len;
    }
    return out;
  };
  P.ymd = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  // Daily summaries from parsed pieces.
  P.summarize = function (stepsRows, hrByDay, sleepDays) {
    var m = {};
    function g(d) { return m[d] || (m[d] = { day: d, summary: {} }); }
    (stepsRows || []).forEach(function (r) { var s = g(r.date).summary; s.steps = (s.steps || 0) + r.steps; s.calories = (s.calories || 0) + r.calories; s.distance_km = Math.round(((s.distance_km || 0) * 1000 + r.distance_m)) / 1000; });
    Object.keys(hrByDay || {}).forEach(function (d) { var v = hrByDay[d].map(function (x) { return x.bpm; }); if (!v.length) return; var s = g(d).summary;
      s.hr_avg = Math.round(v.reduce(function (a, c) { return a + c; }, 0) / v.length); s.hr_min = Math.min.apply(null, v); s.hr_max = Math.max.apply(null, v); s.hr_readings = v.length; });
    (sleepDays || []).forEach(function (r) { if (!r.day || !r.sleep_min) return; var s = g(r.day).summary; s.sleep_min = r.sleep_min; s.deep_min = r.deep_min; s.light_min = r.light_min; s.rem_min = r.rem_min; s.awake_min = r.awake_min; });
    return Object.keys(m).sort().reverse().map(function (k) { return m[k]; });
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = P; else root.ColmiProto = P;
})(this);
