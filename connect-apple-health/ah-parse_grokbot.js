/* ah-parse_grokbot.js (_grokbot): reads an Apple Health "Export All Health Data" zip ON THE DEVICE.
   Streams the zip (fflate) and the XML (no DOM), keeps only per-day totals for the last N days. Nothing raw leaves the phone. */
(function (root) {
  var ASLEEP = /^HKCategoryValueSleepAnalysisAsleep/;
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function attrs(s) { var o = {}, m, re = /([A-Za-z]+)="([^"]*)"/g; while ((m = re.exec(s))) o[m[1]] = m[2]; return o; }
  function ts(s) { var m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ?([+-]\d{2})(\d{2})$/.exec(s || ''); return m ? Date.parse(m[1] + 'T' + m[2] + m[3] + ':' + m[4]) : NaN; }
  function createAggregator(opts) {
    opts = opts || {}; var now = opts.now || new Date(), N = opts.days == null ? 90 : opts.days; // s3y180: days 0 = all history
    var from = N > 0 ? ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (N - 1))) : '1900-01-01', to = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    var D = {}, buf = '', records = 0, exportDate = null, sawRoot = false;
    function day(k) { return D[k] || (D[k] = { steps: {}, kcal: {}, sleep: {}, rhr: [0, 0], hrv: [0, 0], spo2: [0, 0], vo2: null, vo2t: 0, w: 0, wm: 0, wt: {} }); }
    function inWin(k) { return k >= from && k <= to; }
    function add(map, src, v) { map[src] = (map[src] || 0) + v; }
    function rec(a) {
      var t = a.type, k, v = parseFloat(a.value), src = a.sourceName || '?';
      switch (t) {
        case 'HKQuantityTypeIdentifierStepCount': k = a.startDate.slice(0, 10); if (inWin(k) && isFinite(v)) add(day(k).steps, src, v); break;
        case 'HKQuantityTypeIdentifierActiveEnergyBurned': k = a.startDate.slice(0, 10); if (inWin(k) && isFinite(v)) add(day(k).kcal, src, a.unit === 'kJ' ? v / 4.184 : v); break;
        case 'HKCategoryTypeIdentifierSleepAnalysis':
          if (!ASLEEP.test(a.value || '')) break; k = (a.endDate || '').slice(0, 10); if (!inWin(k)) break;
          var mins = (ts(a.endDate) - ts(a.startDate)) / 60000; if (mins > 0 && mins < 1440) add(day(k).sleep, src, mins); break;
        case 'HKQuantityTypeIdentifierRestingHeartRate': k = a.startDate.slice(0, 10); if (inWin(k) && isFinite(v)) { var r = day(k).rhr; r[0] += v; r[1]++; } break;
        case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': k = a.startDate.slice(0, 10); if (inWin(k) && isFinite(v)) { var h = day(k).hrv; h[0] += v; h[1]++; } break;
        case 'HKQuantityTypeIdentifierOxygenSaturation': k = a.startDate.slice(0, 10); if (inWin(k) && isFinite(v)) { var o = day(k).spo2; o[0] += v <= 1 ? v * 100 : v; o[1]++; } break;
        case 'HKQuantityTypeIdentifierVO2Max': k = a.startDate.slice(0, 10); if (inWin(k) && isFinite(v)) { var dd = day(k), tt = ts(a.startDate) || 0; if (tt >= dd.vo2t) { dd.vo2 = v; dd.vo2t = tt; } } break;
      }
    }
    function workout(a) {
      var k = (a.startDate || '').slice(0, 10); if (!inWin(k)) return; var d = day(k), m = parseFloat(a.duration);
      if (!isFinite(m)) m = (ts(a.endDate) - ts(a.startDate)) / 60000; else if (a.durationUnit === 's') m /= 60; else if (a.durationUnit === 'hr') m *= 60;
      d.w++; if (isFinite(m) && m > 0) d.wm += m; var ty = (a.workoutActivityType || '').replace(/^HKWorkoutActivityType/, ''); if (ty) d.wt[ty] = 1;
    }
    var RE = /<(Record|Workout|ExportDate|HealthData)[\s>]([^>]*)>/g;
    function scan(s) {
      RE.lastIndex = 0; var m;
      while ((m = RE.exec(s))) {
        var tag = m[1], body = m[2];
        if (tag === 'Record') { records++; var ti = body.indexOf('type="'); if (ti < 0) continue; var te = body.indexOf('"', ti + 6), type = body.slice(ti + 6, te);
          if (type === 'HKQuantityTypeIdentifierHeartRate' || type.indexOf('Identifier') < 0) continue; rec(attrs(body)); }
        else if (tag === 'Workout') workout(attrs(body));
        else if (tag === 'ExportDate') exportDate = attrs(body).value || null;
        else sawRoot = true;
      }
    }
    return {
      feed: function (text) { buf += text; var cut = buf.lastIndexOf('>'); if (cut < 0) { if (buf.length > 1e6) buf = ''; return; } scan(buf.slice(0, cut + 1)); buf = buf.slice(cut + 1); },
      finish: function () {
        if (buf) scan(buf); buf = '';
        var mx = function (o) { var b = null; for (var s in o) if (b === null || o[s] > b) b = o[s]; return b; };
        var avg = function (p) { return p[1] ? Math.round(p[0] / p[1] * 10) / 10 : null; };
        var days = Object.keys(D).sort().reverse().map(function (k) {
          var d = D[k], st = mx(d.steps), kc = mx(d.kcal), sl = mx(d.sleep);
          return { day: k, steps: st == null ? null : Math.round(st), sleep_minutes: sl == null ? null : Math.min(1440, Math.round(sl)), resting_hr: avg(d.rhr), hrv_ms: avg(d.hrv),
            active_kcal: kc == null ? null : Math.round(kc), workouts: d.w || null, workout_minutes: d.w ? Math.round(d.wm) : null,
            workout_types: d.w ? Object.keys(d.wt).slice(0, 10) : null, vo2max: d.vo2 == null ? null : Math.round(d.vo2 * 10) / 10, spo2_pct: avg(d.spo2) };
        });
        return { days: days, exportDate: exportDate, records: records, healthData: sawRoot, from: from };
      }
    };
  }
  function isMainXml(name) { var n = name.replace(/\\/g, '/'), base = n.split('/').pop();
    return /\.xml$/i.test(base) && !/cda/i.test(base) && n.split('/').length <= 2 && !/^__MACOSX/.test(n) && !/workout-routes|electrocardiograms/i.test(n); }
  // file: Blob/File. onProgress(fraction). Returns Promise of finish() result.
  function parseFile(file, opts, onProgress) {
    var ff = (opts && opts.fflate) || root.fflate, agg = createAggregator(opts), dec = new TextDecoder('utf-8');
    var isZip = !/\.xml$/i.test(file.name || '');
    return new Promise(function (resolve, reject) {
      var found = false, done = false, failed = false, uz = null;
      function fail(e) { if (!failed) { failed = true; reject(e); } }
      function end() { if (done || failed) return; done = true; try { agg.feed(dec.decode()); resolve(agg.finish()); } catch (e) { fail(e); } }
      if (isZip) {
        uz = new ff.Unzip(); uz.register(ff.UnzipInflate);
        uz.onfile = function (f) {
          if (found || !isMainXml(f.name)) return; found = true;
          f.ondata = function (err, chunk, final) { if (err) return fail(err); try { agg.feed(dec.decode(chunk, { stream: true })); } catch (e) { return fail(e); } if (final) end(); };
          f.start();
        };
      }
      var reader = file.stream().getReader(), read = 0, size = file.size || 1;
      (function pump() {
        reader.read().then(function (r) {
          if (failed || done) { try { reader.cancel(); } catch (e) {} return; }
          if (r.done) { if (isZip) { try { uz.push(new Uint8Array(0), true); } catch (e) { return fail(e); } if (!found) return fail(new Error('no_xml')); if (!done) return fail(new Error('truncated')); } else end(); return; }
          read += r.value.length; if (onProgress) onProgress(Math.min(1, read / size));
          try { if (isZip) uz.push(r.value, false); else agg.feed(dec.decode(r.value, { stream: true })); } catch (e) { return fail(e); }
          setTimeout(pump, 0);
        }, fail);
      })();
    });
  }
  var api = { createAggregator: createAggregator, parseFile: parseFile, isMainXml: isMainXml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AHParse = api;
})(typeof self !== 'undefined' ? self : this);
