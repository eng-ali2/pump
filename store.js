// =============================================================
//  طبقة البيانات: نفس الواجهة بنسختين
//   - LocalStore  : وضع تجريبي، البيانات على نفس الجهاز (localStorage)
//   - FirebaseStore: تشغيل حقيقي، كل البيانات تروح لقاعدة بيانات المشرف
// =============================================================

export const FIELDS = [
  { k: 'p_suction',   label: 'P suction',    ar: 'ضغط السحب',               unit: 'bar' },
  { k: 'p_discharge', label: 'P discharge',  ar: 'ضغط الدفع',               unit: 'bar' },
  { k: 't_suction',   label: 'T suction',    ar: 'حرارة السحب',             unit: '°C'  },
  { k: 't_in_ms',     label: 'T(in) M.S',    ar: 'حرارة دخول الميكانيكال سيل', unit: '°C'  },
  { k: 't_out_ms',    label: 'T(out) M.S',   ar: 'حرارة خروج الميكانيكال سيل', unit: '°C'  },
  { k: 'p_ms',        label: 'P M.S',        ar: 'ضغط الميكانيكال سيل',      unit: 'bar' },
  { k: 't_housing',   label: 'T Housing',    ar: 'حرارة الهاوسنك',           unit: '°C'  },
  { k: 'amp_motor',   label: 'Ampere Motor', ar: 'أمبير المحرك',             unit: 'A'   },
  { k: 't_motor',     label: 'T Motor',      ar: 'حرارة المحرك',             unit: '°C'  },
];

// يرجع قائمة الحقول اللي طلعت خارج الحدود المسموحة للمضخة
export function checkAlarms(reading, pump) {
  const out = [];
  const lim = (pump && pump.limits) || {};
  for (const f of FIELDS) {
    const v = reading[f.k];
    if (v === null || v === undefined || v === '') continue;
    const l = lim[f.k] || {};
    if ((l.min !== undefined && l.min !== null && l.min !== '' && v < +l.min) ||
        (l.max !== undefined && l.max !== null && l.max !== '' && v > +l.max)) out.push(f.k);
  }
  return out;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const byTsDesc = (a, b) => (b.ts || 0) - (a.ts || 0);

// ---------------------------------------------------------------
//  الوضع التجريبي
// ---------------------------------------------------------------
class LocalStore {
  constructor() { this.mode = 'demo'; this.key = 'pumpsDemoV1'; this.user = null; }

  _load() {
    try { return JSON.parse(localStorage.getItem(this.key)); } catch { return null; }
  }
  _save() { try { localStorage.setItem(this.key, JSON.stringify(this.db)); } catch {} }

  async init() {
    this.db = this._load() || this._seed();
    this._save();
    try {
      const s = sessionStorage.getItem('pumpsDemoUser');
      if (s) this.user = this.db.users.find(u => u.id === s && u.active) || null;
    } catch {}
    return this.user;
  }

  _seed() {
    const db = { users: [], pumps: [], readings: [], maint: [] };
    db.users.push({ id: 'u-admin', username: 'admin', password: 'admin', name: 'المشرف', role: 'admin', active: true });
    db.users.push({ id: 'u-op1', username: 'ali', password: '1234', name: 'علي حسين', role: 'operator', active: true });
    db.users.push({ id: 'u-op2', username: 'omar', password: '1234', name: 'عمر كريم', role: 'operator', active: true });
    const limits = {
      p_suction: { min: 0.3, max: 2 }, p_discharge: { min: 4, max: 12 }, t_suction: { min: 120, max: 180 },
      t_in_ms: { max: 90 }, t_out_ms: { max: 100 }, p_ms: { min: 1, max: 6 },
      t_housing: { max: 85 }, amp_motor: { max: 60 }, t_motor: { max: 80 },
    };
    const names = ['مضخة تغذية الأسفلت', 'مضخة الخزان الرئيسي', 'مضخة التدوير', 'مضخة التحميل', 'مضخة الزيت الحراري', 'مضخة الاحتياط'];
    names.forEach((n, i) => db.pumps.push({
      id: 'p' + (i + 1), tag: 'P-10' + (i + 1), name: n, location: 'وحدة الأسفلت', active: true,
      limits: JSON.parse(JSON.stringify(limits)),
    }));
    // بيانات عشوائية لآخر 35 يوم حتى تبين التقارير
    const ops = db.users.filter(u => u.role === 'operator');
    const r = (a, b) => +(a + Math.random() * (b - a)).toFixed(1);
    const now = new Date();
    for (let d = 35; d >= 0; d--) {
      const day = new Date(now); day.setDate(now.getDate() - d);
      const date = ymd(day);
      for (const p of db.pumps) {
        // اليوم الحالي: قراءة وحدة لكل مضخة (عدا الأخيرة) حتى تبين لوحة التحكم
        const hours = d === 0 ? (p.tag === 'P-106' ? [] : [-1]) : [8, 16];
        for (let hour of hours) {
          let minute;
          if (hour === -1) { const t = new Date(now.getTime() - 20 * 60000); if (ymd(t) !== date) { t.setTime(new Date(date + 'T00:05').getTime()); } hour = t.getHours(); minute = t.getMinutes(); }
          const bad = (p.tag === 'P-103' && Math.random() < 0.25) || Math.random() < 0.04;
          const op = ops[(d + hour) % ops.length];
          const rd = {
            id: uid(), pumpId: p.id, pumpTag: p.tag, date, time: String(hour).padStart(2, '0') + ':' + String(minute ?? Math.floor(Math.random() * 50)).padStart(2, '0'),
            userId: op.id, userName: op.name, notes: '',
            p_suction: r(0.6, 1.4), p_discharge: r(6, 10), t_suction: r(140, 165), t_in_ms: r(55, 80), t_out_ms: r(65, 90),
            p_ms: r(2, 4.5), t_housing: r(55, 75), amp_motor: bad ? r(58, 70) : r(35, 55), t_motor: bad ? r(78, 92) : r(50, 72),
          };
          rd.ts = new Date(date + 'T' + rd.time).getTime();
          rd.alarms = checkAlarms(rd, p);
          db.readings.push(rd);
        }
        if (Math.random() < 0.5) db.maint.push({
          id: uid(), kind: 'routine', pumpId: p.id, pumpTag: p.tag, date, time: '09:15', ts: new Date(date + 'T09:15').getTime(),
          userId: ops[0].id, userName: ops[0].name, work: 'فحص تسريب، تزييت المحامل، فحص الاهتزاز', notes: '', status: 'done', downtime: 0,
        });
        const faultChance = p.tag === 'P-103' ? 0.18 : p.tag === 'P-105' ? 0.09 : 0.03;
        if (Math.random() < faultChance) db.maint.push({
          id: uid(), kind: 'fault', pumpId: p.id, pumpTag: p.tag, date, time: '13:40', ts: new Date(date + 'T13:40').getTime(),
          userId: ops[1].id, userName: ops[1].name,
          work: ['تسريب من الميكانيكال سيل', 'ارتفاع حرارة المحرك', 'اهتزاز عالي', 'انخفاض ضغط الدفع'][Math.floor(Math.random() * 4)],
          notes: '', status: d > 2 ? 'done' : 'open', downtime: r(0.5, 6),
        });
      }
    }
    return db;
  }

  async setupNeeded() { return false; }

  async login(username, password) {
    const u = this.db.users.find(x => x.username === username.trim().toLowerCase() && x.password === password);
    if (!u) throw new Error('اسم المستخدم أو كلمة المرور غلط');
    if (!u.active) throw new Error('هذا الحساب موقوف، راجع المشرف');
    this.user = u;
    try { sessionStorage.setItem('pumpsDemoUser', u.id); } catch {}
    return u;
  }
  async logout() { this.user = null; try { sessionStorage.removeItem('pumpsDemoUser'); } catch {} }
  async resetDemo() { localStorage.removeItem(this.key); this.db = this._seed(); this._save(); }

  async listUsers() { return this.db.users.map(({ password, ...u }) => u); }
  async createUser({ username, password, name, role }) {
    username = username.trim().toLowerCase();
    if (this.db.users.some(u => u.username === username)) throw new Error('اسم المستخدم موجود');
    this.db.users.push({ id: uid(), username, password, name, role, active: true }); this._save();
  }
  async updateUser(id, patch) { Object.assign(this.db.users.find(u => u.id === id), patch); this._save(); }

  async listPumps() { return [...this.db.pumps].sort((a, b) => a.tag.localeCompare(b.tag)); }
  async savePump(p) {
    if (p.id) Object.assign(this.db.pumps.find(x => x.id === p.id), p);
    else this.db.pumps.push({ ...p, id: uid() });
    this._save();
  }

  async addReading(r) { this.db.readings.push({ ...r, id: uid() }); this._save(); }
  async readings(from, to) { return this.db.readings.filter(r => r.date >= from && r.date <= to).sort(byTsDesc); }
  async deleteReading(id) { this.db.readings = this.db.readings.filter(r => r.id !== id); this._save(); }

  async addMaint(m) { this.db.maint.push({ ...m, id: uid() }); this._save(); }
  async maint(from, to) { return this.db.maint.filter(r => r.date >= from && r.date <= to).sort(byTsDesc); }
  async updateMaint(id, patch) { Object.assign(this.db.maint.find(m => m.id === id), patch); this._save(); }
}

// ---------------------------------------------------------------
//  Firebase (التشغيل الحقيقي)
// ---------------------------------------------------------------
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const EMAIL_DOMAIN = '@pumps.app';   // اسم المستخدم يتحول داخلياً لإيميل وهمي

class FirebaseStore {
  constructor(cfg) { this.mode = 'firebase'; this.cfg = cfg; this.user = null; }

  async init() {
    const [appM, authM, fsM] = await Promise.all([
      import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
    this.A = authM; this.F = fsM;
    this.app = appM.initializeApp(this.cfg);
    this.appM = appM;
    this.auth = authM.getAuth(this.app);
    try {
      this.fs = fsM.initializeFirestore(this.app, { localCache: fsM.persistentLocalCache() }); // يشتغل بدون نت ويرسل بعدين
    } catch { this.fs = fsM.getFirestore(this.app); }
    const fbUser = await new Promise(res => { const un = authM.onAuthStateChanged(this.auth, u => { un(); res(u); }); });
    if (fbUser) { try { this.user = await this._profile(fbUser.uid); } catch { this.user = null; } }
    return this.user;
  }

  _col(name) { return this.F.collection(this.fs, name); }
  _doc(name, id) { return this.F.doc(this.fs, name, id); }
  _email(u) { return u.trim().toLowerCase() + EMAIL_DOMAIN; }
  _err(e) {
    const c = (e && e.code) || '';
    if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return new Error('اسم المستخدم أو كلمة المرور غلط');
    if (c.includes('email-already-in-use')) return new Error('اسم المستخدم موجود');
    if (c.includes('weak-password')) return new Error('كلمة المرور لازم 6 أحرف أو أكثر');
    if (c.includes('permission-denied')) return new Error('ما عندك صلاحية لهذي العملية');
    if (c.includes('network')) return new Error('ماكو اتصال بالإنترنت');
    return new Error(e.message || 'صار خطأ');
  }
  async _profile(id) {
    const s = await this.F.getDoc(this._doc('users', id));
    if (!s.exists()) return null;
    return { id, ...s.data() };
  }

  async setupNeeded() {
    try { const s = await this.F.getDoc(this._doc('meta', 'setup')); return !s.exists(); }
    catch { return false; }
  }
  // أول مرة فقط: إنشاء حساب المشرف
  async setupAdmin({ username, password, name }) {
    try {
      const cred = await this.A.createUserWithEmailAndPassword(this.auth, this._email(username), password);
      const b = this.F.writeBatch(this.fs);
      b.set(this._doc('users', cred.user.uid), { username: username.trim().toLowerCase(), name, role: 'admin', active: true });
      b.set(this._doc('meta', 'setup'), { done: true, at: Date.now() });
      await b.commit();
      this.user = await this._profile(cred.user.uid);
      return this.user;
    } catch (e) { throw this._err(e); }
  }

  async login(username, password) {
    try {
      const cred = await this.A.signInWithEmailAndPassword(this.auth, this._email(username), password);
      const p = await this._profile(cred.user.uid);
      if (!p || !p.active) { await this.A.signOut(this.auth); throw new Error(p ? 'هذا الحساب موقوف، راجع المشرف' : 'الحساب غير مسجل بالنظام'); }
      this.user = p; return p;
    } catch (e) { throw e.code ? this._err(e) : e; }
  }
  async logout() { await this.A.signOut(this.auth); this.user = null; }

  async listUsers() { const s = await this.F.getDocs(this._col('users')); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
  async createUser({ username, password, name, role }) {
    // نستخدم نسخة ثانية من Firebase حتى ما يطلع المشرف من حسابه
    try {
      const sec = this.appM.initializeApp(this.cfg, 'sec-' + Date.now());
      const secAuth = this.A.getAuth(sec);
      const cred = await this.A.createUserWithEmailAndPassword(secAuth, this._email(username), password);
      await this.F.setDoc(this._doc('users', cred.user.uid), { username: username.trim().toLowerCase(), name, role, active: true });
      await this.A.signOut(secAuth);
      await this.appM.deleteApp(sec);
    } catch (e) { throw this._err(e); }
  }
  async updateUser(id, patch) { try { await this.F.updateDoc(this._doc('users', id), patch); } catch (e) { throw this._err(e); } }

  async listPumps() {
    const s = await this.F.getDocs(this._col('pumps'));
    return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.tag.localeCompare(b.tag));
  }
  async savePump(p) {
    try {
      const { id, ...data } = p;
      if (id) await this.F.setDoc(this._doc('pumps', id), data);
      else await this.F.addDoc(this._col('pumps'), data);
    } catch (e) { throw this._err(e); }
  }

  async _range(col, from, to) {
    const q = this.F.query(this._col(col), this.F.where('date', '>=', from), this.F.where('date', '<=', to), this.F.orderBy('date', 'desc'));
    const s = await this.F.getDocs(q);
    return s.docs.map(d => ({ id: d.id, ...d.data() })).sort(byTsDesc);
  }
  // الإضافة ما تنتظر الرد من السيرفر: إذا ماكو نت تنحفظ وتنرسل تلقائياً بعدين
  async addReading(r) { const p = this.F.addDoc(this._col('readings'), r).catch(e => console.error(e)); await Promise.race([p, wait(1500)]); }
  async readings(from, to) { return this._range('readings', from, to); }
  async deleteReading(id) { try { await this.F.deleteDoc(this._doc('readings', id)); } catch (e) { throw this._err(e); } }

  async addMaint(m) { const p = this.F.addDoc(this._col('maint'), m).catch(e => console.error(e)); await Promise.race([p, wait(1500)]); }
  async maint(from, to) { return this._range('maint', from, to); }
  async updateMaint(id, patch) { try { await this.F.updateDoc(this._doc('maint', id), patch); } catch (e) { throw this._err(e); } }
}

const wait = ms => new Promise(r => setTimeout(r, ms));

export function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function createStore() {
  return window.FIREBASE_CONFIG ? new FirebaseStore(window.FIREBASE_CONFIG) : new LocalStore();
}
