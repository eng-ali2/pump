import { FIELDS, checkAlarms, createStore, ymd } from './store.js';

const store = createStore();
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d); };
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const num = v => (v === '' || v === null || v === undefined || isNaN(+v)) ? null : +v;
const fmt = v => (v === null || v === undefined || isNaN(v)) ? '—' : (Math.round(v * 10) / 10).toString();
const fieldOf = k => FIELDS.find(f => f.k === k);
const KIND = { routine: 'صيانة يومية', fault: 'عطل' };

let pumpsCache = null;
async function pumps(force) { if (!pumpsCache || force) pumpsCache = await store.listPumps(); return pumpsCache; }
const pumpById = id => (pumpsCache || []).find(p => p.id === id);

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast', 3200);
}

// ------------------------------------------------------------ التنقل
const ICON = {
  dash: '<path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z"/>',
  readings: '<path d="M3 3h18v4H3zm0 7h18v4H3zm0 7h18v4H3z" opacity=".9"/>',
  maint: '<path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>',
  reports: '<path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/>',
  entry: '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/>',
  'maint-entry': '<path d="M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z"/>',
  pumps: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4l1.5 5.5L19 13l-5.5 1.5L12 20l-1.5-5.5L5 13l5.5-1.5z"/>',
  users: '<path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm-8 0c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z"/>',
  mine: '<path d="M14 2H6a2 2 0 00-2 2v16c0 1.1.9 2 2 2h12a2 2 0 002-2V8zm2 16H8v-2h8zm0-4H8v-2h8zm-3-5V3.5L18.5 9z"/>',
  more: '<path d="M6 10a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4zm-6 0a2 2 0 100 4 2 2 0 000-4z"/>',
};
const ic = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
// [المفتاح، الاسم، يظهر بالشريط السفلي للموبايل؟]
const TABS = {
  admin: [['dash', 'لوحة التحكم', 1], ['readings', 'القراءات', 1], ['entry', 'إدخال قراءة', 1], ['reports', 'التقارير', 1],
          ['maint', 'الصيانة والأعطال'], ['maint-entry', 'تسجيل صيانة/عطل'], ['pumps', 'المضخات'], ['users', 'المستخدمين']],
  operator: [['entry', 'إدخال قراءة', 1], ['maint-entry', 'صيانة / عطل', 1], ['mine', 'سجلاتي', 1]],
};
const ROUTES = {
  login: viewLogin, setup: viewSetup, dash: viewDash, readings: viewReadings, maint: viewMaint, reports: viewReports,
  entry: viewEntry, 'maint-entry': viewMaintEntry, pumps: viewPumps, users: viewUsers, mine: viewMine,
};

function renderNav(r) {
  const tabs = TABS[store.user.role];
  $('#tabs').innerHTML = `<div class="tabs-in">${tabs.map(([k, l]) => `<a href="#${k}" class="${k === r ? 'on' : ''}">${ic(k)}<span>${l}</span></a>`).join('')}</div>`;
  const main = tabs.filter(t => t[2]), more = tabs.filter(t => !t[2]);
  const moreOn = more.some(t => t[0] === r);
  $('#bnav').innerHTML = main.map(([k, l]) => `<a href="#${k}" class="${k === r ? 'on' : ''}">${ic(k)}<span>${l}</span></a>`).join('')
    + (more.length ? `<button id="moreBtn" class="${moreOn ? 'on' : ''}">${ic('more')}<span>المزيد</span></button>` : '');
  $('#sheet').innerHTML = `<div class="sheet-in"><div class="grab"></div>${more.map(([k, l]) => `<a href="#${k}" class="${k === r ? 'on' : ''}">${ic(k)}<span>${l}</span></a>`).join('')}</div>`;
  $('#bnav').classList.toggle('n' + (main.length + (more.length ? 1 : 0)), true);
  const mb = $('#moreBtn'); if (mb) mb.onclick = () => $('#sheet').classList.add('open');
}
$('#sheet').onclick = e => { if (e.target.id === 'sheet' || e.target.closest('a')) $('#sheet').classList.remove('open'); };

async function route() {
  const u = store.user;
  let r = location.hash.slice(1) || '';
  document.body.classList.toggle('authed', !!u);
  if (!u) {
    r = (store.mode === 'firebase' && await store.setupNeeded()) ? 'setup' : 'login';
  } else {
    const allowed = TABS[u.role].map(t => t[0]);
    if (!allowed.includes(r)) r = allowed[0];
    $('#whoName').textContent = u.name;
    $('#whoRole').textContent = u.role === 'admin' ? 'مشرف' : 'موظف';
    $('#avatar').textContent = (u.name || '?').trim().charAt(0);
    renderNav(r);
  }
  window.scrollTo(0, 0);
  view.innerHTML = '<div class="loading">جاري التحميل…</div>';
  try { await ROUTES[r](); } catch (e) { console.error(e); view.innerHTML = `<div class="card err">صار خطأ: ${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', route);
$('#logoutBtn').onclick = async () => { await store.logout(); pumpsCache = null; location.hash = ''; route(); };

// ------------------------------------------------------------ الدخول
async function viewLogin() {
  const demo = store.mode === 'demo';
  view.innerHTML = `
  <div class="login-wrap">
    <div class="logo"><img src="icons/logo.png" alt=""><h2>${esc(window.APP_NAME)}</h2><div class="muted">${esc(window.COMPANY_NAME)}</div></div>
    <form class="card" id="f">
      <div class="field"><label>اسم المستخدم</label><input name="u" autocomplete="username" autocapitalize="none" required></div>
      <div class="field"><label>كلمة المرور</label><input name="p" type="password" autocomplete="current-password" required></div>
      <div class="err" id="err"></div>
      <button class="btn block">دخول</button>
    </form>
    ${demo ? `<div class="hint">
      <b>وضع تجريبي</b> — جرّب هذه الحسابات:<br>
      المشرف: <span class="ltr">admin / admin</span><br>
      موظف: <span class="ltr">ali / 1234</span>
      <div style="margin-top:8px"><button class="btn sm sec" id="reset" type="button">إعادة البيانات التجريبية</button></div>
    </div>` : ''}
  </div>`;
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const b = e.target.querySelector('button'); b.disabled = true; $('#err').textContent = '';
    try { await store.login(e.target.u.value, e.target.p.value); location.hash = ''; await route(); }
    catch (er) { $('#err').textContent = er.message; b.disabled = false; }
  };
  if (demo) $('#reset').onclick = async () => { await store.resetDemo(); pumpsCache = null; toast('تمت إعادة البيانات التجريبية'); };
}

async function viewSetup() {
  view.innerHTML = `
  <div class="login-wrap">
    <div class="logo"><img src="icons/logo.png" alt=""><h2>الإعداد الأول</h2></div>
    <form class="card" id="f">
      <p class="muted">هذا أول تشغيل للنظام. سوِّ حساب المشرف الرئيسي (يظهر هذا مرة وحدة بس).</p>
      <div class="field"><label>اسم المشرف</label><input name="n" required></div>
      <div class="field"><label>اسم المستخدم (إنكليزي بدون فراغات)</label><input name="u" pattern="[A-Za-z0-9._\\-]+" autocapitalize="none" required></div>
      <div class="field"><label>كلمة المرور (6 أحرف أو أكثر)</label><input name="p" type="password" minlength="6" required></div>
      <div class="err" id="err"></div>
      <button class="btn block">إنشاء حساب المشرف</button>
    </form>
  </div>`;
  $('#f').onsubmit = async e => {
    e.preventDefault(); const f = e.target; const b = f.querySelector('button'); b.disabled = true;
    try { await store.setupAdmin({ name: f.n.value.trim(), username: f.u.value, password: f.p.value }); location.hash = '#pumps'; await route(); toast('تم. هسه أضف المضخات'); }
    catch (er) { $('#err').textContent = er.message; b.disabled = false; }
  };
}

// ------------------------------------------------------------ إدخال قراءة
const GROUPS = [
  { t: 'السحب', en: 'Suction', k: ['p_suction', 't_suction'] },
  { t: 'الدفع', en: 'Discharge', k: ['p_discharge'] },
  { t: 'الميكانيكال سيل', en: 'Mechanical Seal', k: ['t_in_ms', 't_out_ms', 'p_ms'] },
  { t: 'المحرك والهاوسنك', en: 'Motor & Housing', k: ['amp_motor', 't_motor', 't_housing'] },
];
async function viewEntry() {
  const ps = (await pumps()).filter(p => p.active);
  const u = store.user;
  if (!ps.length) { view.innerHTML = `<div class="card">ماكو مضخات مسجلة. ${u.role === 'admin' ? '<a href="#pumps">أضف مضخة</a>' : 'راجع المشرف.'}</div>`; return; }
  view.innerHTML = `
  <h2>إدخال قراءة مضخة</h2>
  <form class="card" id="f">
    <div class="row">
      <div class="field"><label>الاسم</label><input name="userName" value="${esc(u.name)}" required></div>
      <div class="field"><label>التاريخ <b>Date</b></label><input name="date" type="date" value="${today()}" max="${today()}" required></div>
      <div class="field"><label>الوقت (يُسجّل تلقائياً)</label><input id="clock" value="${nowHM()}" readonly class="ltr"></div>
    </div>
    <div class="field"><label>المضخة</label>
      <select name="pumpId" required>${ps.map(p => `<option value="${p.id}">${esc(p.tag)} — ${esc(p.name)}</option>`).join('')}</select>
    </div>
    <div id="vals">
      ${GROUPS.map(g => `<fieldset class="grp"><legend>${g.t} <span class="ltr">${g.en}</span></legend><div class="grid">
        ${g.k.map(k => { const f = fieldOf(k); return `<div class="field"><label><b>${f.label}</b> · ${f.ar}</label>
          <div class="unit-in"><input name="${f.k}" type="number" step="any" inputmode="decimal" required><span class="ltr">${f.unit}</span></div>
          <div class="muted lim-hint" data-k="${f.k}"></div></div>`; }).join('')}
      </div></fieldset>`).join('')}
    </div>
    <div class="field"><label>ملاحظات (اختياري)</label><textarea name="notes"></textarea></div>
    <button class="btn block">حفظ وإرسال القراءة</button>
  </form>`;
  const f = $('#f');
  const clk = setInterval(() => { const c = $('#clock'); if (!c) return clearInterval(clk); c.value = nowHM(); }, 15000);
  const showLimits = () => {
    const p = pumpById(f.pumpId.value); const lim = p?.limits || {};
    $$('.lim-hint', f).forEach(el => {
      const l = lim[el.dataset.k] || {}; const parts = [];
      if (num(l.min) !== null) parts.push('أقل ' + l.min); if (num(l.max) !== null) parts.push('أعلى ' + l.max);
      el.textContent = parts.length ? 'الحد المسموح: ' + parts.join(' — ') : '';
    });
    check();
  };
  const check = () => {
    const p = pumpById(f.pumpId.value); const r = {};
    FIELDS.forEach(x => r[x.k] = num(f[x.k].value));
    const al = checkAlarms(r, p);
    FIELDS.forEach(x => f[x.k].classList.toggle('bad', al.includes(x.k)));
  };
  f.pumpId.onchange = showLimits; $('#vals').oninput = check; showLimits();
  f.onsubmit = async e => {
    e.preventDefault();
    const p = pumpById(f.pumpId.value); const time = nowHM();
    const r = { pumpId: p.id, pumpTag: p.tag, date: f.date.value, time, ts: new Date(f.date.value + 'T' + time).getTime(),
      userId: u.id, userName: f.userName.value.trim(), notes: f.notes.value.trim() };
    FIELDS.forEach(x => r[x.k] = num(f[x.k].value));
    r.alarms = checkAlarms(r, p);
    const b = f.querySelector('button'); b.disabled = true;
    try {
      await store.addReading(r);
      toast(r.alarms.length ? `تم الحفظ — تنبيه: ${r.alarms.map(k => fieldOf(k).label).join('، ')} خارج الحد` : 'تم حفظ القراءة ✓', r.alarms.length > 0);
      FIELDS.forEach(x => { f[x.k].value = ''; f[x.k].classList.remove('bad'); }); f.notes.value = '';
      const i = f.pumpId.selectedIndex; if (i < f.pumpId.options.length - 1) { f.pumpId.selectedIndex = i + 1; showLimits(); }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (er) { toast(er.message, true); }
    b.disabled = false;
  };
}

// ------------------------------------------------------------ تسجيل صيانة / عطل
const CHECKS = ['فحص التسريب', 'تزييت/تشحيم المحامل', 'فحص الاهتزاز', 'فحص الصوت', 'فحص الميكانيكال سيل', 'تنظيف الفلتر (الاستريـنر)', 'فحص الكوبلنك', 'فحص التأريض والكيبلات'];
async function viewMaintEntry() {
  const ps = (await pumps()).filter(p => p.active); const u = store.user;
  if (!ps.length) { view.innerHTML = `<div class="card">ماكو مضخات مسجلة.</div>`; return; }
  view.innerHTML = `
  <h2>تسجيل صيانة أو عطل</h2>
  <form class="card" id="f">
    <div class="field"><div class="seg" id="kind"><button type="button" data-k="routine" class="on">صيانة يومية</button><button type="button" data-k="fault">عطل</button></div></div>
    <div class="row">
      <div class="field"><label>الاسم</label><input name="userName" value="${esc(u.name)}" required></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" value="${today()}" max="${today()}" required></div>
      <div class="field"><label>المضخة</label><select name="pumpId">${ps.map(p => `<option value="${p.id}">${esc(p.tag)} — ${esc(p.name)}</option>`).join('')}</select></div>
    </div>
    <div id="routineBox" class="field"><label>الأعمال المنجزة</label>
      <div class="grid">${CHECKS.map((c, i) => `<label style="display:flex;gap:6px;align-items:center;color:var(--ink)"><input type="checkbox" value="${c}" style="width:auto;min-height:0"> ${c}</label>`).join('')}</div>
    </div>
    <div id="faultBox" hidden>
      <div class="field"><label>وصف العطل</label><input name="faultDesc" placeholder="مثلاً: تسريب من الميكانيكال سيل"></div>
      <div class="row">
        <div class="field"><label>مدة التوقف (ساعات)</label><input name="downtime" type="number" step="any" min="0" inputmode="decimal" value="0"></div>
        <div class="field"><label>الحالة</label><select name="status"><option value="open">مفتوح (لم يُصلح)</option><option value="done">تم الإصلاح</option></select></div>
      </div>
    </div>
    <div class="field"><label>ملاحظات / الإجراء المتخذ</label><textarea name="notes"></textarea></div>
    <button class="btn block">حفظ</button>
  </form>`;
  const f = $('#f'); let kind = 'routine';
  $('#kind').onclick = e => {
    const k = e.target.dataset.k; if (!k) return; kind = k;
    $$('#kind button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    $('#routineBox').hidden = k !== 'routine'; $('#faultBox').hidden = k !== 'fault';
  };
  f.onsubmit = async e => {
    e.preventDefault();
    const p = pumpById(f.pumpId.value); const time = nowHM();
    let work;
    if (kind === 'routine') {
      work = $$('#routineBox input:checked').map(i => i.value).join('، ');
      if (!work && !f.notes.value.trim()) return toast('اختر عمل واحد على الأقل أو اكتب ملاحظة', true);
    } else {
      work = f.faultDesc.value.trim(); if (!work) return toast('اكتب وصف العطل', true);
    }
    const m = { kind, pumpId: p.id, pumpTag: p.tag, date: f.date.value, time, ts: new Date(f.date.value + 'T' + time).getTime(),
      userId: u.id, userName: f.userName.value.trim(), work, notes: f.notes.value.trim(),
      status: kind === 'fault' ? f.status.value : 'done', downtime: kind === 'fault' ? (num(f.downtime.value) || 0) : 0 };
    try { await store.addMaint(m); toast('تم الحفظ ✓'); f.reset(); f.date.value = today(); f.userName.value = u.name; f.pumpId.value = p.id; }
    catch (er) { toast(er.message, true); }
  };
}

// ------------------------------------------------------------ جداول مشتركة
function readingsTable(rows, { del } = {}) {
  if (!rows.length) return '<div class="card muted">ماكو قراءات بهذي الفترة.</div>';
  return `<div class="tbl-wrap"><table><thead><tr>
    <th>Date</th><th>الوقت</th><th>المضخة</th><th class="l">الاسم</th>
    ${FIELDS.map(f => `<th>${f.label}<small>${f.unit}</small></th>`).join('')}<th class="l">ملاحظات</th>${del ? '<th></th>' : ''}
  </tr></thead><tbody>${rows.map(r => `<tr>
    <td class="ltr">${r.date}</td><td class="ltr">${esc(r.time)}</td><td class="ltr"><b>${esc(r.pumpTag)}</b></td><td class="l">${esc(r.userName)}</td>
    ${FIELDS.map(f => `<td class="${(r.alarms || []).includes(f.k) ? 'bad' : ''}">${fmt(r[f.k])}</td>`).join('')}
    <td class="l">${esc(r.notes)}</td>${del ? `<td><button class="btn sm sec" data-del="${r.id}">حذف</button></td>` : ''}
  </tr>`).join('')}</tbody></table></div>`;
}
function maintTable(rows, { admin } = {}) {
  if (!rows.length) return '<div class="card muted">ماكو سجلات بهذي الفترة.</div>';
  return `<div class="tbl-wrap"><table><thead><tr><th>التاريخ</th><th>الوقت</th><th>المضخة</th><th>النوع</th><th class="l">العمل / العطل</th>
    <th>التوقف (س)</th><th>الحالة</th><th class="l">الاسم</th><th class="l">ملاحظات</th></tr></thead><tbody>
    ${rows.map(m => `<tr><td class="ltr">${m.date}</td><td class="ltr">${esc(m.time)}</td><td class="ltr"><b>${esc(m.pumpTag)}</b></td>
      <td><span class="pill ${m.kind === 'fault' ? 'bad' : 'ok'}">${KIND[m.kind]}</span></td>
      <td class="l" style="white-space:normal;min-width:180px">${esc(m.work)}</td><td>${m.kind === 'fault' ? fmt(m.downtime) : '—'}</td>
      <td>${m.kind === 'fault' ? (m.status === 'open'
        ? `<span class="pill warn">مفتوح</span>${admin ? ` <button class="btn sm sec" data-close="${m.id}">إغلاق</button>` : ''}`
        : '<span class="pill ok">تم الإصلاح</span>') : '<span class="pill ok">منجز</span>'}</td>
      <td class="l">${esc(m.userName)}</td><td class="l" style="white-space:normal">${esc(m.notes)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function rangeBar(from, to, extra = '') {
  return `<div class="card no-print"><div class="row">
    <div><label>من</label><input type="date" id="from" value="${from}"></div>
    <div><label>إلى</label><input type="date" id="to" value="${to}"></div>
    ${extra}<div class="actions" style="flex:0 0 auto"><button class="btn" id="go">عرض</button><button class="btn sec" id="csv">تصدير Excel</button></div>
  </div></div>`;
}
function downloadCSV(name, header, rows) {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = '﻿' + [header, ...rows].map(r => r.map(q).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const readingsCSV = (rows, name) => downloadCSV(name,
  ['Date', 'Time', 'Pump', 'Name', ...FIELDS.map(f => `${f.label} (${f.unit})`), 'Alarms', 'Notes'],
  rows.map(r => [r.date, r.time, r.pumpTag, r.userName, ...FIELDS.map(f => r[f.k]), (r.alarms || []).map(k => fieldOf(k).label).join(' | '), r.notes]));
const pumpOptions = (ps, sel) => `<option value="">كل المضخات</option>` + ps.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.tag)}</option>`).join('');

// ------------------------------------------------------------ سجلاتي (الموظف)
async function viewMine() {
  await pumps();
  const from = addDays(today(), -6), to = today();
  const [rs, ms] = await Promise.all([store.readings(from, to), store.maint(from, to)]);
  const mine = rs.filter(r => r.userId === store.user.id), myM = ms.filter(m => m.userId === store.user.id);
  view.innerHTML = `<h2>سجلاتي — آخر 7 أيام</h2>
    <div class="stats"><div class="stat"><div class="v">${mine.length}</div><div class="l">قراءة</div></div>
    <div class="stat"><div class="v">${myM.length}</div><div class="l">صيانة/عطل</div></div></div>
    <h3>القراءات</h3>${readingsTable(mine)}<h3 style="margin-top:14px">الصيانة والأعطال</h3>${maintTable(myM)}`;
}

// ------------------------------------------------------------ لوحة التحكم
async function viewDash() {
  const ps = (await pumps(true)).filter(p => p.active);
  const t = today();
  const [rs, ms, msOld] = await Promise.all([store.readings(t, t), store.maint(t, t), store.maint(addDays(t, -60), t)]);
  const alarmRs = rs.filter(r => r.alarms?.length);
  const openFaults = msOld.filter(m => m.kind === 'fault' && m.status === 'open');
  const readPumps = new Set(rs.map(r => r.pumpId));
  const notRead = ps.filter(p => !readPumps.has(p.id));
  const last = {}; rs.forEach(r => { if (!last[r.pumpId]) last[r.pumpId] = r; });

  view.innerHTML = `<h2>لوحة التحكم — <span class="ltr">${t}</span></h2>
  <div class="stats">
    <div class="stat"><div class="v">${rs.length}</div><div class="l">قراءات اليوم</div></div>
    <div class="stat"><div class="v">${readPumps.size}/${ps.length}</div><div class="l">مضخات مقروءة اليوم</div></div>
    <div class="stat ${alarmRs.length ? 'alert' : ''}"><div class="v">${alarmRs.length}</div><div class="l">قراءات خارج الحدود</div></div>
    <div class="stat ${openFaults.length ? 'alert' : ''}"><div class="v">${openFaults.length}</div><div class="l">أعطال مفتوحة</div></div>
    <div class="stat"><div class="v">${ms.filter(m => m.kind === 'routine').length}</div><div class="l">صيانات اليوم</div></div>
  </div>
  <div class="card"><h3>حالة المضخات (آخر قراءة اليوم)</h3>
    <div class="tbl-wrap"><table><thead><tr><th>المضخة</th><th class="l">الاسم</th><th>آخر قراءة</th><th class="l">بواسطة</th>
      ${FIELDS.map(f => `<th>${f.label}</th>`).join('')}<th>الحالة</th></tr></thead><tbody>
      ${ps.map(p => { const r = last[p.id]; const fault = openFaults.some(m => m.pumpId === p.id);
        return `<tr><td class="ltr"><b>${esc(p.tag)}</b></td><td class="l">${esc(p.name)}</td>
        <td class="ltr">${r ? esc(r.time) : '—'}</td><td class="l">${r ? esc(r.userName) : ''}</td>
        ${FIELDS.map(f => `<td class="${r?.alarms?.includes(f.k) ? 'bad' : ''}">${r ? fmt(r[f.k]) : ''}</td>`).join('')}
        <td>${fault ? '<span class="pill bad">عطل مفتوح</span>' : !r ? '<span class="pill warn">بدون قراءة</span>' : r.alarms?.length ? '<span class="pill bad">تنبيه</span>' : '<span class="pill ok">طبيعي</span>'}</td></tr>`; }).join('')}
    </tbody></table></div></div>
  ${openFaults.length ? `<div class="card"><h3>الأعطال المفتوحة</h3>${maintTable(openFaults, { admin: true })}</div>` : ''}
  ${notRead.length ? `<div class="card"><h3>مضخات بدون قراءة اليوم</h3>${notRead.map(p => `<span class="pill warn ltr" style="margin:2px">${esc(p.tag)}</span>`).join(' ')}</div>` : ''}
  <div class="card"><h3>تنبيهات اليوم</h3>${readingsTable(alarmRs)}</div>`;
  bindClose(viewDash);
}
function bindClose(reload) {
  $$('[data-close]').forEach(b => b.onclick = async () => {
    try { await store.updateMaint(b.dataset.close, { status: 'done', closedAt: Date.now() }); toast('تم إغلاق العطل'); reload(); } catch (e) { toast(e.message, true); }
  });
}

// ------------------------------------------------------------ كل القراءات
let rf = { from: null, to: null, pump: '', alarms: false };
async function viewReadings() {
  const ps = await pumps();
  rf.from ||= addDays(today(), -6); rf.to ||= today();
  view.innerHTML = `<h2>القراءات</h2>` + rangeBar(rf.from, rf.to,
    `<div><label>المضخة</label><select id="pump">${pumpOptions(ps, rf.pump)}</select></div>
     <div style="flex:0 0 auto"><label style="display:flex;gap:6px;align-items:center;min-height:42px;color:var(--ink)"><input type="checkbox" id="al" style="width:auto;min-height:0" ${rf.alarms ? 'checked' : ''}> التنبيهات فقط</label></div>`) + '<div id="out"></div>';
  const load = async () => {
    rf = { from: $('#from').value, to: $('#to').value, pump: $('#pump').value, alarms: $('#al').checked };
    let rows = await store.readings(rf.from, rf.to);
    if (rf.pump) rows = rows.filter(r => r.pumpId === rf.pump);
    if (rf.alarms) rows = rows.filter(r => r.alarms?.length);
    $('#out').innerHTML = `<p class="muted">${rows.length} قراءة</p>` + readingsTable(rows, { del: true });
    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('تحذف هذي القراءة؟')) return;
      try { await store.deleteReading(b.dataset.del); toast('انحذفت'); load(); } catch (e) { toast(e.message, true); }
    });
    $('#csv').onclick = () => readingsCSV(rows, `readings_${rf.from}_${rf.to}.csv`);
  };
  $('#go').onclick = load; await load();
}

// ------------------------------------------------------------ الصيانة والأعطال
let mf = { from: null, to: null, pump: '', kind: '' };
async function viewMaint() {
  const ps = await pumps();
  mf.from ||= addDays(today(), -6); mf.to ||= today();
  view.innerHTML = `<h2>الصيانة والأعطال</h2>` + rangeBar(mf.from, mf.to,
    `<div><label>المضخة</label><select id="pump">${pumpOptions(ps, mf.pump)}</select></div>
     <div><label>النوع</label><select id="kind"><option value="">الكل</option><option value="routine" ${mf.kind === 'routine' ? 'selected' : ''}>صيانة يومية</option><option value="fault" ${mf.kind === 'fault' ? 'selected' : ''}>أعطال</option></select></div>`) + '<div id="out"></div>';
  const load = async () => {
    mf = { from: $('#from').value, to: $('#to').value, pump: $('#pump').value, kind: $('#kind').value };
    let rows = await store.maint(mf.from, mf.to);
    if (mf.pump) rows = rows.filter(r => r.pumpId === mf.pump);
    if (mf.kind) rows = rows.filter(r => r.kind === mf.kind);
    $('#out').innerHTML = `<p class="muted">${rows.length} سجل</p>` + maintTable(rows, { admin: true });
    bindClose(load);
    $('#csv').onclick = () => downloadCSV(`maintenance_${mf.from}_${mf.to}.csv`,
      ['Date', 'Time', 'Pump', 'Type', 'Work/Fault', 'Downtime (h)', 'Status', 'Name', 'Notes'],
      rows.map(m => [m.date, m.time, m.pumpTag, KIND[m.kind], m.work, m.kind === 'fault' ? m.downtime : '', m.status === 'open' ? 'مفتوح' : 'منجز', m.userName, m.notes]));
  };
  $('#go').onclick = load; await load();
}

// ------------------------------------------------------------ التقارير
let rep = { period: 'weekly', anchor: null, pump: '', field: 't_motor' };
function periodRange(period, anchor) {
  if (period === 'daily') return [anchor, anchor];
  if (period === 'weekly') return [addDays(anchor, -6), anchor];
  const [y, m] = anchor.split('-').map(Number);
  return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
}
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

async function viewReports() {
  const ps = await pumps(true);
  rep.anchor ||= today(); if (!rep.pump && ps[0]) rep.pump = ps[0].id;
  const [from, to] = periodRange(rep.period, rep.anchor);
  const [rs, ms] = await Promise.all([store.readings(from, to), store.maint(from, to)]);
  const title = { daily: 'التقرير اليومي', weekly: 'التقرير الأسبوعي', monthly: 'التقرير الشهري' }[rep.period];

  // إحصائيات لكل مضخة
  const stats = ps.map(p => {
    const r = rs.filter(x => x.pumpId === p.id), m = ms.filter(x => x.pumpId === p.id);
    const faults = m.filter(x => x.kind === 'fault');
    const per = {}; FIELDS.forEach(f => { const v = r.map(x => x[f.k]).filter(v => v !== null && v !== undefined);
      per[f.k] = { avg: avg(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null }; });
    return { p, n: r.length, alarms: r.filter(x => x.alarms?.length).length, faults: faults.length,
      downtime: faults.reduce((s, x) => s + (+x.downtime || 0), 0), routine: m.filter(x => x.kind === 'routine').length,
      openF: faults.filter(x => x.status === 'open').length, per,
      score: faults.length * 3 + r.filter(x => x.alarms?.length).length,
      topAlarm: (() => { const c = {}; r.forEach(x => (x.alarms || []).forEach(k => c[k] = (c[k] || 0) + 1));
        const k = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; return k ? `${fieldOf(k).label} (${c[k]})` : '—'; })() };
  });
  const ranked = [...stats].filter(s => s.faults || s.alarms).sort((a, b) => b.score - a.score);
  const maxS = Math.max(1, ...ranked.map(s => s.score));
  const tot = k => stats.reduce((s, x) => s + x[k], 0);

  view.innerHTML = `
  <div class="no-print card"><div class="row">
    <div style="flex:0 0 auto"><label>نوع التقرير</label><div class="seg" id="per">
      <button data-p="daily">يومي</button><button data-p="weekly">أسبوعي</button><button data-p="monthly">شهري</button></div></div>
    <div><label>${rep.period === 'monthly' ? 'أي يوم من الشهر' : rep.period === 'weekly' ? 'آخر يوم بالأسبوع' : 'اليوم'}</label><input type="date" id="anc" value="${rep.anchor}"></div>
    <div class="actions" style="flex:0 0 auto"><button class="btn sec" id="print">طباعة / PDF</button><button class="btn sec" id="csv">تصدير Excel</button></div>
  </div></div>
  <h2>${title} — وحدة الأسفلت <span class="muted ltr">${from}${from !== to ? ' → ' + to : ''}</span></h2>
  <div class="stats">
    <div class="stat"><div class="v">${rs.length}</div><div class="l">قراءة مسجلة</div></div>
    <div class="stat ${tot('alarms') ? 'alert' : ''}"><div class="v">${tot('alarms')}</div><div class="l">قراءة خارج الحدود</div></div>
    <div class="stat ${tot('faults') ? 'alert' : ''}"><div class="v">${tot('faults')}</div><div class="l">عطل</div></div>
    <div class="stat"><div class="v">${fmt(tot('downtime'))}</div><div class="l">ساعات توقف</div></div>
    <div class="stat"><div class="v">${tot('routine')}</div><div class="l">صيانة يومية منجزة</div></div>
  </div>

  <div class="card"><h3>أكثر المضخات أعطالاً</h3><p class="muted">الترتيب حسب الأعطال (كل عطل = 3 نقاط) + القراءات الخارجة عن الحدود</p>
    ${ranked.length ? ranked.map(s => `<div class="bar"><span class="name">${esc(s.p.tag)}</span>
      <div class="track"><div class="fill" style="width:${Math.max(3, s.score / maxS * 100)}%"></div></div>
      <span class="num">${s.faults} عطل · ${s.alarms} تنبيه</span></div>`).join('') : '<p class="muted">ماكو أعطال أو تنبيهات بهذي الفترة 👍</p>'}
  </div>

  <div class="card"><h3>ملخص الأداء لكل مضخة</h3><div class="tbl-wrap"><table><thead><tr>
    <th>المضخة</th><th>القراءات</th><th>التنبيهات</th><th>أكثر قيمة متجاوزة</th><th>الأعطال</th><th>مفتوحة</th><th>ساعات التوقف</th><th>صيانات يومية</th>
  </tr></thead><tbody>${stats.map(s => `<tr><td class="ltr"><b>${esc(s.p.tag)}</b></td><td>${s.n}</td>
    <td class="${s.alarms ? 'bad' : ''}">${s.alarms}</td><td class="ltr">${s.topAlarm}</td><td class="${s.faults ? 'bad' : ''}">${s.faults}</td>
    <td>${s.openF}</td><td>${fmt(s.downtime)}</td><td>${s.routine}</td></tr>`).join('')}</tbody></table></div></div>

  <div class="card"><h3>معدلات القراءات (المعدل / الأقل – الأعلى)</h3><div class="tbl-wrap"><table><thead><tr><th>المضخة</th>
    ${FIELDS.map(f => `<th>${f.label}<small>${f.unit}</small></th>`).join('')}</tr></thead><tbody>
    ${stats.map(s => `<tr><td class="ltr"><b>${esc(s.p.tag)}</b></td>${FIELDS.map(f => { const v = s.per[f.k]; const l = s.p.limits?.[f.k] || {};
      const over = (num(l.max) !== null && v.max > +l.max) || (num(l.min) !== null && v.min !== null && v.min < +l.min);
      return `<td class="${over ? 'bad' : ''}"><b>${fmt(v.avg)}</b><br><small class="muted ltr">${fmt(v.min)} – ${fmt(v.max)}</small></td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div></div>

  <div class="card"><h3>منحنى قراءة</h3>
    <div class="row no-print"><div><label>المضخة</label><select id="cp">${ps.map(p => `<option value="${p.id}" ${p.id === rep.pump ? 'selected' : ''}>${esc(p.tag)}</option>`).join('')}</select></div>
    <div><label>القراءة</label><select id="cf">${FIELDS.map(f => `<option value="${f.k}" ${f.k === rep.field ? 'selected' : ''}>${f.label} — ${f.ar}</option>`).join('')}</select></div></div>
    <div id="chart"></div>
  </div>
  <p class="print-only muted">طُبع بتاريخ ${today()} ${nowHM()}</p>`;

  $$('#per button').forEach(b => { b.classList.toggle('on', b.dataset.p === rep.period); b.onclick = () => { rep.period = b.dataset.p; viewReports(); }; });
  $('#anc').onchange = e => { if (e.target.value) { rep.anchor = e.target.value; viewReports(); } };
  $('#print').onclick = () => window.print();
  $('#csv').onclick = () => downloadCSV(`report_${rep.period}_${from}_${to}.csv`,
    ['Pump', 'Readings', 'Alarms', 'Faults', 'Open faults', 'Downtime (h)', 'Routine maintenance', ...FIELDS.flatMap(f => [`${f.label} avg`, `${f.label} min`, `${f.label} max`])],
    stats.map(s => [s.p.tag, s.n, s.alarms, s.faults, s.openF, fmt(s.downtime), s.routine, ...FIELDS.flatMap(f => [fmt(s.per[f.k].avg), fmt(s.per[f.k].min), fmt(s.per[f.k].max)])]));
  const drawC = () => {
    rep.pump = $('#cp').value; rep.field = $('#cf').value;
    const p = pumpById(rep.pump); const pr = rs.filter(r => r.pumpId === rep.pump && r[rep.field] !== null && r[rep.field] !== undefined).sort((a, b) => a.ts - b.ts);
    let pts;
    if (rep.period === 'daily') pts = pr.map(r => ({ x: r.time, y: r[rep.field] }));
    else { const byD = {}; pr.forEach(r => (byD[r.date] ||= []).push(r[rep.field])); pts = Object.keys(byD).sort().map(d => ({ x: d.slice(5), y: avg(byD[d]) })); }
    $('#chart').innerHTML = lineChart(pts, p?.limits?.[rep.field] || {}, fieldOf(rep.field).unit, rep.period !== 'daily');
  };
  $('#cp').onchange = $('#cf').onchange = drawC; drawC();
}

function lineChart(pts, lim, unit, isAvg) {
  if (!pts.length) return '<p class="muted">ماكو بيانات.</p>';
  const W = 800, H = 260, L = 46, R = 14, T = 14, B = 34;
  const ys = pts.map(p => p.y).concat([num(lim.min), num(lim.max)].filter(v => v !== null));
  let lo = Math.min(...ys), hi = Math.max(...ys); if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const Xl = i => pts.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (pts.length - 1);
  const Y = v => T + (hi - v) * (H - T - B) / (hi - lo);
  const grid = [0, 1, 2, 3, 4].map(i => { const v = lo + (hi - lo) * i / 4;
    return `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e2e7eb"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }).join('');
  const step = Math.ceil(pts.length / 10);
  const xl = pts.map((p, i) => i % step === 0 || i === pts.length - 1 ? `<text x="${Xl(i)}" y="${H - 12}" text-anchor="middle">${esc(p.x)}</text>` : '').join('');
  const limLine = (v, t) => num(v) === null ? '' : `<line x1="${L}" x2="${W - R}" y1="${Y(+v)}" y2="${Y(+v)}" stroke="#c0392b" stroke-dasharray="6 4"/><text x="${W - R}" y="${Y(+v) - 4}" text-anchor="end" style="fill:#c0392b">${t} ${v}</text>`;
  const over = p => (num(lim.max) !== null && p.y > +lim.max) || (num(lim.min) !== null && p.y < +lim.min);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" direction="ltr" style="direction:ltr">
    ${grid}${limLine(lim.max, 'الحد الأعلى')}${limLine(lim.min, 'الحد الأدنى')}
    <polyline fill="none" stroke="#16697a" stroke-width="2.5" points="${pts.map((p, i) => Xl(i) + ',' + Y(p.y)).join(' ')}"/>
    ${pts.map((p, i) => `<circle cx="${Xl(i)}" cy="${Y(p.y)}" r="${over(p) ? 5 : 3.5}" fill="${over(p) ? '#c0392b' : '#16697a'}"><title>${esc(p.x)}: ${fmt(p.y)} ${unit}</title></circle>`).join('')}
    ${xl}</svg><p class="muted">${isAvg ? 'المعدل اليومي' : 'كل قراءة'} · الوحدة: <span class="ltr">${unit}</span> · الخط الأحمر المتقطع = الحد المسموح</p>`;
}

// ------------------------------------------------------------ المضخات
async function viewPumps() {
  const ps = await pumps(true);
  view.innerHTML = `<h2>المضخات</h2><div class="actions" style="margin-bottom:12px"><button class="btn" id="add">+ إضافة مضخة</button></div>
  <div class="tbl-wrap"><table><thead><tr><th>الرقم</th><th class="l">الاسم</th><th class="l">الموقع</th><th>الحدود المحددة</th><th>الحالة</th><th></th></tr></thead><tbody>
  ${ps.map(p => `<tr><td class="ltr"><b>${esc(p.tag)}</b></td><td class="l">${esc(p.name)}</td><td class="l">${esc(p.location)}</td>
    <td>${Object.values(p.limits || {}).filter(l => num(l.min) !== null || num(l.max) !== null).length} / ${FIELDS.length}</td>
    <td>${p.active ? '<span class="pill ok">فعالة</span>' : '<span class="pill warn">متوقفة</span>'}</td>
    <td><button class="btn sm sec" data-edit="${p.id}">تعديل</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">ماكو مضخات بعد</td></tr>'}
  </tbody></table></div>`;
  $('#add').onclick = () => pumpDialog();
  $$('[data-edit]').forEach(b => b.onclick = () => pumpDialog(pumpById(b.dataset.edit)));
}
function pumpDialog(p) {
  p = p || { tag: '', name: '', location: 'وحدة الأسفلت', active: true, limits: {} };
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog" id="pf"><div class="dh">${p.id ? 'تعديل مضخة' : 'إضافة مضخة'}</div><div class="db">
    <div class="row"><div class="field"><label>رقم المضخة (Tag)</label><input name="tag" class="ltr" value="${esc(p.tag)}" placeholder="P-101" required></div>
      <div class="field"><label>الاسم / الوصف</label><input name="name" value="${esc(p.name)}" required></div></div>
    <div class="row"><div class="field"><label>الموقع</label><input name="location" value="${esc(p.location)}"></div>
      <div class="field"><label>الحالة</label><select name="active"><option value="1">فعالة</option><option value="0" ${p.active ? '' : 'selected'}>متوقفة</option></select></div></div>
    <h3 style="margin-top:6px">حدود التنبيه</h3><p class="muted">إذا القراءة طلعت برّه الحدود، تتلوّن بالأحمر وتنحسب كتنبيه. اترك الخانة فارغة إذا ما تحتاجها.</p>
    <div class="lim"><b>القراءة</b><b>الأقل</b><b>الأعلى</b></div>
    ${FIELDS.map(f => { const l = p.limits?.[f.k] || {}; return `<div class="lim"><span><b class="ltr">${f.label}</b> <span class="muted">${f.unit}</span></span>
      <input type="number" step="any" name="min_${f.k}" value="${l.min ?? ''}"><input type="number" step="any" name="max_${f.k}" value="${l.max ?? ''}"></div>`; }).join('')}
  </div><div class="df"><button class="btn" value="save">حفظ</button><button class="btn sec" value="cancel" formnovalidate>إلغاء</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('close', async () => {
    if (d.returnValue === 'save') {
      const f = $('#pf', d); const limits = {};
      FIELDS.forEach(x => { const mn = num(f['min_' + x.k].value), mx = num(f['max_' + x.k].value);
        if (mn !== null || mx !== null) limits[x.k] = { ...(mn !== null && { min: mn }), ...(mx !== null && { max: mx }) }; });
      const data = { tag: f.tag.value.trim().toUpperCase(), name: f.name.value.trim(), location: f.location.value.trim(), active: f.active.value === '1', limits };
      if (p.id) data.id = p.id;
      try { await store.savePump(data); toast('تم الحفظ'); viewPumps(); } catch (e) { toast(e.message, true); }
    }
    d.remove();
  });
}

// ------------------------------------------------------------ المستخدمين
async function viewUsers() {
  const us = (await store.listUsers()).sort((a, b) => (a.role > b.role ? 1 : -1) || a.name.localeCompare(b.name));
  view.innerHTML = `<h2>المستخدمين</h2><div class="actions" style="margin-bottom:12px"><button class="btn" id="add">+ إضافة مستخدم</button></div>
  <div class="tbl-wrap"><table><thead><tr><th class="l">الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>الحالة</th><th></th></tr></thead><tbody>
  ${us.map(u => `<tr><td class="l">${esc(u.name)}</td><td class="ltr">${esc(u.username)}</td>
    <td>${u.role === 'admin' ? '<span class="pill warn">مشرف</span>' : 'موظف'}</td>
    <td>${u.active ? '<span class="pill ok">فعال</span>' : '<span class="pill bad">موقوف</span>'}</td>
    <td>${u.id === store.user.id ? '<span class="muted">أنت</span>' : `<button class="btn sm sec" data-tog="${u.id}" data-a="${u.active ? 1 : 0}">${u.active ? 'إيقاف' : 'تفعيل'}</button>
      <button class="btn sm sec" data-role="${u.id}" data-r="${u.role}">${u.role === 'admin' ? 'جعله موظف' : 'جعله مشرف'}</button>`}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="muted">الموظف يكدر يدخل قراءات وصيانة فقط. المشرف يشوف لوحة التحكم والتقارير ويدير المضخات والمستخدمين.</p>`;
  $$('[data-tog]').forEach(b => b.onclick = async () => { try { await store.updateUser(b.dataset.tog, { active: b.dataset.a !== '1' }); viewUsers(); } catch (e) { toast(e.message, true); } });
  $$('[data-role]').forEach(b => b.onclick = async () => { try { await store.updateUser(b.dataset.role, { role: b.dataset.r === 'admin' ? 'operator' : 'admin' }); viewUsers(); } catch (e) { toast(e.message, true); } });
  $('#add').onclick = () => {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog" id="uf"><div class="dh">إضافة مستخدم</div><div class="db">
      <div class="field"><label>الاسم الكامل</label><input name="name" required></div>
      <div class="field"><label>اسم المستخدم (إنكليزي بدون فراغات)</label><input name="username" class="ltr" pattern="[A-Za-z0-9._\\-]+" autocapitalize="none" required></div>
      <div class="field"><label>كلمة المرور (6 أحرف أو أكثر)</label><input name="password" class="ltr" minlength="${store.mode === 'demo' ? 4 : 6}" required></div>
      <div class="field"><label>الصلاحية</label><select name="role"><option value="operator">موظف</option><option value="admin">مشرف</option></select></div>
      <div class="err" id="uerr"></div></div>
      <div class="df"><button class="btn" value="save">إضافة</button><button class="btn sec" value="cancel" formnovalidate>إلغاء</button></div></form>`;
    document.body.appendChild(d); d.showModal();
    const f = $('#uf', d);
    f.onsubmit = async e => {
      if (e.submitter?.value !== 'save') return;
      e.preventDefault();
      try { await store.createUser({ name: f.name.value.trim(), username: f.username.value, password: f.password.value, role: f.role.value });
        d.close(); d.remove(); toast('تمت الإضافة'); viewUsers(); }
      catch (er) { $('#uerr', d).textContent = er.message; }
    };
    d.addEventListener('close', () => d.remove());
  };
}

// ------------------------------------------------------------ تشغيل
(async () => {
  $('#appName').textContent = window.APP_NAME; $('#coName').textContent = window.COMPANY_NAME;
  $('#demoBar').hidden = store.mode !== 'demo';
  try { await store.init(); }
  catch (e) { console.error(e); view.innerHTML = `<div class="card err">ما كدرنا نتصل بقاعدة البيانات. تأكد من الإنترنت ومن إعدادات Firebase في ملف config.js<br><small class="ltr">${esc(e.message)}</small></div>`; return; }
  route();
})();
