/* strava-export-parse_grokbot.js (_grokbot) — reads a member's Strava export in the browser.
   Only activities.csv is read. In a zip we locate that one entry through the zip's central directory and read only its bytes
   (Blob.slice), so the .fit/.gpx/.tcx(.gz) GPS files are never opened, decompressed or uploaded. Needs fflate (inflateSync/gunzipSync).
   Output rows carry summary numbers only: no names, descriptions, notes, gear, filenames or coordinates. */
(function (root) {
  'use strict';
  function err(code, m) { var e = new Error(m || code); e.code = code; return e; }
  function u8(blob, a, b) { return blob.slice(a, b).arrayBuffer().then(function (x) { return new Uint8Array(x); }); }
  function le(d, o, n) { var v = 0; for (var i = n - 1; i >= 0; i--) v = v * 256 + d[o + i]; return v; }
  // ---- zip: find activities.csv via the central directory (supports zip64), read just that entry ----
  function zipEntry(file, want) {
    var size = file.size, tailLen = Math.min(size, 65557 + 20);
    return u8(file, size - tailLen, size).then(function (t) {
      var e = -1; for (var i = t.length - 22; i >= 0; i--) if (t[i] === 0x50 && t[i + 1] === 0x4b && t[i + 2] === 5 && t[i + 3] === 6) { e = i; break; }
      if (e < 0) throw err('read', 'no zip end record');
      var cdSize = le(t, e + 12, 4), cdOff = le(t, e + 16, 4), n = le(t, e + 10, 2);
      var z64 = e - 20;
      if ((cdOff === 0xffffffff || cdSize === 0xffffffff || n === 0xffff) && z64 >= 0 && le(t, z64, 4) === 0x07064b50) {
        var recOff = le(t, z64 + 8, 8);
        return u8(file, recOff, recOff + 56).then(function (r) { return { cdOff: le(r, 48, 8), cdSize: le(r, 40, 8) }; });
      }
      return { cdOff: cdOff, cdSize: cdSize };
    }).then(function (cd) {
      if (cd.cdSize > 64 * 1024 * 1024) throw err('read', 'central directory too large');
      return u8(file, cd.cdOff, cd.cdOff + cd.cdSize);
    }).then(function (d) {
      var p = 0, found = null, names = 0;
      while (p + 46 <= d.length && le(d, p, 4) === 0x02014b50) {
        var method = le(d, p + 10, 2), csize = le(d, p + 20, 4), usize = le(d, p + 24, 4), fl = le(d, p + 28, 2), xl = le(d, p + 30, 2), cl = le(d, p + 32, 2), loc = le(d, p + 42, 4);
        var name = new TextDecoder().decode(d.subarray(p + 46, p + 46 + fl)); names++;
        if (csize === 0xffffffff || usize === 0xffffffff || loc === 0xffffffff) { // zip64 extra field
          var x = p + 46 + fl, xe = x + xl;
          while (x + 4 <= xe) { var id = le(d, x, 2), sz = le(d, x + 2, 2), q = x + 4;
            if (id === 1) { if (usize === 0xffffffff) { usize = le(d, q, 8); q += 8; } if (csize === 0xffffffff) { csize = le(d, q, 8); q += 8; } if (loc === 0xffffffff) { loc = le(d, q, 8); } }
            x += 4 + sz; }
        }
        if (want.test(name) && (!found || name.split('/').length < found.name.split('/').length)) found = { name: name, method: method, csize: csize, usize: usize, loc: loc };
        p += 46 + fl + xl + cl;
      }
      if (!found) throw err('no_csv', 'activities.csv not in zip (' + names + ' entries)');
      if (found.usize > 300 * 1024 * 1024) throw err('read', 'activities.csv too large');
      return u8(file, found.loc, found.loc + 30).then(function (h) {
        if (le(h, 0, 4) !== 0x04034b50) throw err('read', 'bad local header');
        var start = found.loc + 30 + le(h, 26, 2) + le(h, 28, 2);
        return u8(file, start, start + found.csize);
      }).then(function (c) {
        var out = found.method === 0 ? c : found.method === 8 ? root.fflate.inflateSync(c) : null;
        if (!out) throw err('read', 'unsupported compression ' + found.method);
        if (/\.gz$/i.test(found.name)) out = root.fflate.gunzipSync(out);
        return new TextDecoder('utf-8').decode(out);
      });
    });
  }
  // ---- CSV (RFC 4180: quoted fields with commas, quotes and newlines — Strava descriptions have all three) ----
  function csv(text) {
    var rows = [], row = [], f = '', q = false, i = 0, n = text.length, c;
    if (text.charCodeAt(0) === 0xfeff) i = 1;
    for (; i < n; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  // ---- value parsing ----
  function number(s) {
    if (s == null) return null; s = String(s).trim().replace(/[\u00a0 ]/g, ''); if (!s || /^(-|n\/?a|null|none)$/i.test(s)) return null;
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');          // 1,234.5
    else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,5
    else if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');                // 8,05 (decimal comma)
    var v = Number(s); return isFinite(v) ? v : null;
  }
  function seconds(s) {
    if (s == null) return null; var t = String(s).trim(); if (!t) return null;
    var m = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.\d+)?$/.exec(t); if (m) return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]);
    var v = number(t); return v == null ? null : Math.round(v);
  }
  var MON = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, sept:8, oct:9, nov:10, dec:11 };
  function mon(x) { x = x.toLowerCase(); return x === 'sept' ? 'sept' : x.slice(0, 3); }
  function date(s) { // Strava writes Activity Date in UTC, e.g. "Oct 18, 2026, 6:12:33 AM"; also "18 Oct 2026, 06:12:33" and ISO
    if (!s) return null; var t = String(s).trim().replace(/\s+/g, ' '), m, y, mo, d, h = 0, mi = 0, se = 0, ap;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(t))) {
      if (m[7] && m[7] !== 'Z') { var p = Date.parse(t.replace(' ', 'T')); return isFinite(p) ? new Date(p) : null; }
      y = +m[1]; mo = +m[2] - 1; d = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); se = +(m[6] || 0);
    } else if ((m = /^([A-Za-z]{3,4})[a-z]*\.? (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([AaPp][Mm])?$/.exec(t))) {
      mo = MON[mon(m[1])]; d = +m[2]; y = +m[3]; h = +m[4]; mi = +m[5]; se = +(m[6] || 0); ap = m[7];
    } else if ((m = /^(\d{1,2}) ([A-Za-z]{3,4})[a-z]*\.? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([AaPp][Mm])?$/.exec(t))) {
      d = +m[1]; mo = MON[mon(m[2])]; y = +m[3]; h = +m[4]; mi = +m[5]; se = +(m[6] || 0); ap = m[7];
    } else return null;
    if (mo == null || isNaN(mo)) return null;
    if (ap) { ap = ap.toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; }
    var r = new Date(Date.UTC(y, mo, d, h, mi, se)); return isNaN(r.getTime()) ? null : r;
  }
  // ---- header mapping (Strava repeats some names: Elapsed Time, Distance, Max Heart Rate, Relative Effort...) ----
  function norm(h) { return String(h || '').replace(/^\ufeff/, '').replace(/<[^>]*>/g, '').toLowerCase().replace(/[_\s]+/g, ' ').trim(); }
  function unitOf(h) { var m = /\(([^)]+)\)\s*$/.exec(h); return m ? m[1].toLowerCase().trim() : ''; }
  function base(h) { return h.replace(/\s*\([^)]*\)\s*$/, '').trim(); }
  var ALIAS = {
    id: ['activity id', 'id'], date: ['activity date', 'date', 'start time', 'start date', 'start date local'], type: ['activity type', 'type', 'sport type', 'sport'],
    elapsed: ['elapsed time', 'total time', 'duration'], moving: ['moving time'], distance: ['distance'], speed: ['average speed', 'avg speed'],
    elev: ['elevation gain', 'total elevation gain', 'elev gain', 'ascent'], avghr: ['average heart rate', 'avg heart rate', 'average hr', 'avg hr'],
    maxhr: ['max heart rate', 'maximum heart rate', 'max hr'], kcal: ['calories', 'kcal'], effort: ['relative effort', 'suffer score']
  };
  function mapHeader(hdr) {
    var cols = {}, H = hdr.map(norm);
    Object.keys(ALIAS).forEach(function (k) {
      cols[k] = []; H.forEach(function (h, i) { if (ALIAS[k].indexOf(base(h)) >= 0) cols[k].push({ i: i, unit: unitOf(h) }); });
    });
    return cols;
  }
  function pickLast(row, list, fn) { for (var j = list.length - 1; j >= 0; j--) { var v = fn(row[list[j].i]); if (v != null) return { v: v, c: list[j] }; } return null; }
  var DIST = { m: 1, meters: 1, metres: 1, km: 1000, kilometers: 1000, mi: 1609.344, miles: 1609.344, ft: 0.3048, feet: 0.3048 };
  function parseCsvText(text) {
    var all = csv(text); if (all.length < 2) throw err('no_rows', 'empty csv');
    var cols = mapHeader(all[0]);
    if (!cols.date.length) throw err('no_csv', 'no Activity Date column');
    var notes = [], body = all.slice(1);
    // Distance unit per column. Strava's export repeats Distance: the first copy is in the member's display units (km or mi), a later copy is metres.
    var dcols = cols.distance.map(function (c, idx) {
      var f = DIST[c.unit]; if (f) return { i: c.i, f: f };
      if (cols.distance.length > 1 && idx === cols.distance.length - 1) return { i: c.i, f: 1 };
      return { i: c.i, f: null };
    });
    var metres = dcols.filter(function (d) { return d.f === 1; })[0];
    dcols.forEach(function (d) {
      if (d.f != null) return;
      // infer: compare with the metres copy, or with average speed (m/s) x moving time, else by magnitude
      var ratios = [];
      for (var r = 0; r < body.length && ratios.length < 50; r++) {
        var v = number(body[r][d.i]); if (!v) continue; var ref = null;
        if (metres) ref = number(body[r][metres.i]);
        else if (cols.speed.length && cols.moving.length) { var sp = number(body[r][cols.speed[cols.speed.length - 1].i]), mv = seconds(body[r][cols.moving[cols.moving.length - 1].i]); if (sp && mv) ref = sp * mv; }
        if (ref) ratios.push(ref / v);
      }
      if (ratios.length) { ratios.sort(function (a, b) { return a - b; }); var med = ratios[ratios.length >> 1];
        d.f = [1, 1000, 1609.344].reduce(function (best, f) { return Math.abs(Math.log(med / f)) < Math.abs(Math.log(med / best)) ? f : best; }, 1000); }
      else { var vals = body.map(function (r) { return number(r[d.i]); }).filter(function (x) { return x; }).sort(function (a, b) { return a - b; });
        d.f = vals.length && vals[vals.length >> 1] > 200 ? 1 : 1000; notes.push(d.f === 1 ? 'distance_assumed_m' : 'distance_assumed_km'); }
    });
    var ecols = cols.elev.map(function (c) { return { i: c.i, f: DIST[c.unit] || 1 }; });
    var out = [], seen = {}, skipped = 0, dups = 0;
    body.forEach(function (row) {
      var dt = null; for (var j = 0; j < cols.date.length && !dt; j++) dt = date(row[cols.date[j].i]);
      if (!dt) { skipped++; return; }
      var id = pickLast(row, cols.id, function (s) { s = String(s || '').trim(); return /^\d{1,19}$/.test(s) ? s : null; });
      var type = pickLast(row, cols.type, function (s) { s = String(s || '').trim(); return s ? s.slice(0, 40) : null; });
      var el = pickLast(row, cols.elapsed, seconds), mv = pickLast(row, cols.moving, seconds);
      var dist = null; for (var k = dcols.length - 1; k >= 0 && dist == null; k--) { var dv = number(row[dcols[k].i]); if (dv != null) dist = Math.round(dv * dcols[k].f * 10) / 10; }
      var elev = null; for (var q = ecols.length - 1; q >= 0 && elev == null; q--) { var ev = number(row[ecols[q].i]); if (ev != null) elev = Math.round(ev * ecols[q].f * 10) / 10; }
      var r = { start_at: dt.toISOString(), activity_type: type ? type.v.replace(/[^\p{L}\p{N} &\/().,'+-]/gu, '').slice(0, 40) || null : null,
        elapsed_s: el ? el.v : null, moving_s: mv ? mv.v : null, distance_m: dist, elevation_gain_m: elev,
        avg_hr: (pickLast(row, cols.avghr, number) || {}).v || null, max_hr: (pickLast(row, cols.maxhr, number) || {}).v || null,
        calories: (pickLast(row, cols.kcal, number) || {}).v, relative_effort: (pickLast(row, cols.effort, number) || {}).v };
      if (r.calories === undefined) r.calories = null; if (r.relative_effort === undefined) r.relative_effort = null;
      r.activity_key = id ? id.v : ('d:' + r.start_at.slice(0, 19) + '|' + (r.activity_type || '').slice(0, 12).replace(/[^A-Za-z0-9 ._-]/g, '') + '|' + (r.elapsed_s || 0)).slice(0, 60);
      if (seen[r.activity_key]) { dups++; return; } seen[r.activity_key] = 1;
      out.push(r);
    });
    out.sort(function (a, b) { return a.start_at < b.start_at ? 1 : -1; });
    var found = Object.keys(cols).filter(function (k) { return cols[k].length; }).map(function (k) {
      return { id: 'activity_id', date: 'activity_date', type: 'activity_type', elapsed: 'elapsed_time', moving: 'moving_time', distance: 'distance', speed: 'average_speed', elev: 'elevation_gain', avghr: 'average_heart_rate', maxhr: 'max_heart_rate', kcal: 'calories', effort: 'relative_effort' }[k]; });
    return { rows: out, columns: found, skipped: skipped, duplicates: dups, notes: notes };
  }
  function parseFiles(files) {
    var f = files.filter(function (x) { return /\.zip$/i.test(x.name) || /zip/.test(x.type || ''); })[0];
    var c = files.filter(function (x) { return /activities[^\/]*\.csv(\.gz)?$/i.test(x.name) || /\.csv(\.gz)?$/i.test(x.name); })[0];
    var p, src;
    if (f) { src = 'zip'; p = zipEntry(f, /(^|\/)activities\.csv(\.gz)?$/i); }
    else if (c) { src = 'activities.csv'; p = c.arrayBuffer().then(function (b) { var d = new Uint8Array(b); if (/\.gz$/i.test(c.name)) d = root.fflate.gunzipSync(d); return new TextDecoder('utf-8').decode(d); }); }
    else return Promise.reject(err('no_csv', 'pick the zip or activities.csv'));
    return p.then(function (text) { var r = parseCsvText(text); r.files = [src]; return r; });
  }
  root.StravaExportParse = { parseFiles: parseFiles, parseCsvText: parseCsvText, _number: number, _date: date, _seconds: seconds };
})(typeof window !== 'undefined' ? window : globalThis);
