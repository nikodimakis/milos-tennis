import { useState, useEffect } from "react";
import { loginWithGoogle, logout, onUserChange, db } from "./firebase.js";
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "dimos2024";
const SCHEDULE_START  = "2026-06-02";
const SCHEDULE_END    = "2026-08-30";
const SCHEDULE2_START = "2026-06-19"; // Νέο πρόγραμμα από 19/6
const PENDING_EXPIRY_MS = 60 * 60 * 1000; // 1 ώρα σε milliseconds

// ─── HELPERS ───────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split("T")[0]; }
function addDays(n) { return new Date(Date.now() + n * 86400000).toISOString().split("T")[0]; }
function formatDate(d) {
  return new Date(d + "T12:00:00").toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" });
}
function pad(n) { return String(n).padStart(2, "0"); }
function slotLabel(h) { return `${pad(h)}:00 – ${pad(h + 1)}:00`; }

function getWeekMonday(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function getWeekDays(mondayStr) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayStr + "T12:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

const DAY_NAMES_FULL = ["Κυριακή","Δευτέρα","Τρίτη","Τετάρτη","Πέμπτη","Παρασκευή","Σάββατο"];

function getSlotsForDate(dateStr, hiddenWeeks = []) {
  if (dateStr < SCHEDULE_START || dateStr > SCHEDULE_END) return [];
  // Έλεγξε αν η εβδομάδα είναι κρυμμένη
  const monday = getWeekMonday(dateStr);
  if (hiddenWeeks.includes(monday)) return [];

  const dow = new Date(dateStr + "T12:00:00").getDay();

  if (dateStr < SCHEDULE2_START) {
    // Παλιό πρόγραμμα: 2/6–19/6
    if (dow === 3) return [19, 20, 21];                         // Τετ: 19–22
    if (dow === 0 || dow === 6) return [15,16,17,18,19,20,21]; // Σαβ/Κυρ: 15–22
    return [16, 17, 18];                                        // Δευ/Τρι/Πεμ/Παρ: 16–19
  } else {
    // Νέο πρόγραμμα: 19/6–30/8
    if (dow === 1 || dow === 3 || dow === 5) return [19, 20, 21];     // Δευ/Τετ/Παρ: 19–22
    if (dow === 2 || dow === 4) return [16, 17, 18];                   // Τρι/Πεμ: 16–19
    if (dow === 6) return [8, 9, 10, 11, 12, 13, 14];                 // Σαβ: 08–15
    if (dow === 0) return [15,16,17,18,19,20,21];                      // Κυρ: 15–22
    return [];
  }
}

async function saveDayBookings(dateStr, data) {
  await setDoc(doc(db, "bookings", dateStr), data);
}

// ─── STYLES ────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight: "100vh", background: "#f0f4f0", fontFamily: "'Palatino Linotype', Palatino, serif", color: "#1a2e1a" },
  body: { maxWidth: 520, margin: "0 auto", padding: "20px 14px 60px" },
  card: { background: "#fff", borderRadius: 18, padding: "20px 18px", marginBottom: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.07)", border: "1px solid #e0ebe0" },
  adminCard: { background: "#1b4332", borderRadius: 18, padding: "20px 18px", marginBottom: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.2)" },
  cardTitle: { margin: "0 0 14px", fontSize: 15, fontWeight: "bold", color: "#1b4332" },
  adminTitle: { margin: "0 0 14px", fontSize: 15, fontWeight: "bold", color: "#d8f3dc" },
  btn: { background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 12, padding: "13px 24px", fontSize: 15, fontWeight: "bold", cursor: "pointer", width: "100%", marginTop: 10 },
  btnYellow: { background: "#e6a817", color: "#fff", border: "none", borderRadius: 12, padding: "13px 24px", fontSize: 15, fontWeight: "bold", cursor: "pointer", width: "100%", marginTop: 10 },
  btnAdmin: { background: "#40916c", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: "bold", cursor: "pointer", width: "100%", marginTop: 8 },
  btnDanger: { background: "#c0392b", color: "#fff", border: "none", borderRadius: 8, padding: "5px 11px", fontSize: 11, cursor: "pointer", marginTop: 4 },
  btnOutline: { background: "transparent", color: "#2d6a4f", border: "2px solid #2d6a4f", borderRadius: 12, padding: "11px 20px", fontSize: 14, cursor: "pointer" },
  btnOutlineLight: { background: "transparent", color: "#d8f3dc", border: "1.5px solid #40916c", borderRadius: 10, padding: "9px 16px", fontSize: 13, cursor: "pointer" },
  input: { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #c8dcc8", fontSize: 15, background: "#f8faf8", boxSizing: "border-box", marginTop: 6, fontFamily: "inherit" },
  inputDark: { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #40916c", fontSize: 14, background: "rgba(255,255,255,0.1)", color: "#fff", boxSizing: "border-box", marginTop: 6, fontFamily: "inherit" },
  label: { fontSize: 13, color: "#4a6741", fontWeight: "bold", display: "block", marginTop: 12 },
  labelDark: { fontSize: 13, color: "#95d5b2", fontWeight: "bold", display: "block", marginTop: 12 },
  error: { color: "#c0392b", fontSize: 13, marginTop: 8, background: "#fff0ee", borderRadius: 8, padding: "8px 12px" },
  success: { color: "#1b4332", fontSize: 14, background: "#d8f3dc", borderRadius: 8, padding: "10px 14px", marginTop: 8 },
  avatar: { width: 34, height: 34, borderRadius: "50%", background: "#40916c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold", flexShrink: 0 },
  pending: { background: "#fff8e1", border: "1.5px solid #e6a817", borderRadius: 12, padding: "14px 16px", marginBottom: 14 },
};

// ─── ADMIN BOOKING MODAL ───────────────────────────────────────────────────
function AdminBookingModal({ slot, date, existing, onSave, onCancel, onClose }) {
  const [name, setName] = useState(existing?.name || "");
  const [partner, setPartner] = useState(existing?.partner || "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div style={{ background: "#1b4332", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        <h3 style={{ margin: "0 0 4px", color: "#d8f3dc", fontSize: 17 }}>{existing ? "✏️ Επεξεργασία" : "➕ Νέα κράτηση"}</h3>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#95d5b2" }}>{slotLabel(slot)} · {formatDate(date)}</p>
        <label style={S.labelDark}>👤 Παίκτης 1 *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ονοματεπώνυμο" style={S.inputDark} />
        <label style={S.labelDark}>👤 Παίκτης 2 <span style={{ fontWeight: "normal", color: "#52b788" }}>(προαιρετικό)</span></label>
        <input value={partner} onChange={e => setPartner(e.target.value)} placeholder="Ονοματεπώνυμο" style={S.inputDark} />
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...S.btnOutlineLight, flex: 1 }}>Άκυρο</button>
          <button onClick={() => { if (name.trim()) onSave({ uid: existing?.uid || ("admin_" + Date.now()), name: name.trim(), partner: partner.trim() || null, byAdmin: true }); }} style={{ ...S.btnAdmin, flex: 2, marginTop: 0 }}>💾 Αποθήκευση</button>
        </div>
        {existing && (
          <button onClick={onCancel} style={{ ...S.btnDanger, width: "100%", marginTop: 12, padding: "11px", fontSize: 13, borderRadius: 10 }}>
            🗑️ Ακύρωση κράτησης
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [weekBookings, setWeekBookings] = useState({});
  const [weekMonday, setWeekMonday] = useState(() => getWeekMonday(todayStr()));
  const [userActiveBooking, setUserActiveBooking] = useState(null); // { date, hour } or null
  const [pendingInvite, setPendingInvite] = useState(null); // πρόσκληση που περιμένει αποδοχή από εμένα
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep] = useState("slots");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [lastBooking, setLastBooking] = useState(null);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerEmailError, setPartnerEmailError] = useState("");
  const [adminModal, setAdminModal] = useState(null);
  const [hiddenWeeks, setHiddenWeeks] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false); // array of monday strings

  // ── Firebase Auth ──
  useEffect(() => {
    return onUserChange(firebaseUser => {
      if (firebaseUser) {
        setUser({ uid: firebaseUser.uid, name: firebaseUser.displayName || firebaseUser.email, email: firebaseUser.email, photo: firebaseUser.photoURL });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
  }, []);

  // ── Hidden weeks listener ──
  useEffect(() => {
    return onSnapshot(doc(db, "settings", "hiddenWeeks"), snap => {
      setHiddenWeeks(snap.exists() ? (snap.data().weeks || []) : []);
    });
  }, []);

  // ── Week bookings listener ──
  useEffect(() => {
    const days = getWeekDays(weekMonday);
    const unsubs = days.map(date => {
      return onSnapshot(doc(db, "bookings", date), snap => {
        setWeekBookings(prev => ({ ...prev, [date]: snap.exists() ? snap.data() : {} }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [weekMonday]);

  // ── User active booking listener ──
  useEffect(() => {
    if (!user) { setUserActiveBooking(null); return; }
    return onSnapshot(doc(db, "userBookings", user.uid), snap => {
      setUserActiveBooking(snap.exists() ? snap.data() : null);
    });
  }, [user]);

  // ── Pending invite listener (πρόσκληση προς εμένα) ──
  useEffect(() => {
    if (!user) { setPendingInvite(null); return; }
    return onSnapshot(doc(db, "pendingInvites", user.email.toLowerCase()), snap => {
      if (snap.exists()) {
        const data = snap.data();
        // Έλεγξε αν έχει λήξει (1 ώρα)
        if (Date.now() - data.createdAt > PENDING_EXPIRY_MS) {
          // Λήξε — καθάρισε
          handleExpiredInvite(data);
          setPendingInvite(null);
        } else {
          setPendingInvite(data);
        }
      } else {
        setPendingInvite(null);
      }
    });
  }, [user]);

  // Καθάρισμα ληγμένης πρόσκλησης
  async function handleExpiredInvite(invite) {
    try {
      // Αφαίρεσε εκκρεμή κράτηση από το γήπεδο
      const dayB = (await getDoc(doc(db, "bookings", invite.date))).data() || {};
      const newDay = { ...dayB };
      delete newDay[invite.hour];
      await setDoc(doc(db, "bookings", invite.date), newDay);
      // Ελευθέρωσε τον Παίκτη 1
      await deleteDoc(doc(db, "userBookings", invite.player1uid));
      // Διέγραψε την πρόσκληση
      await deleteDoc(doc(db, "pendingInvites", invite.player2email));
    } catch(e) {}
  }

  function isBooked(date, h) { return !!(weekBookings[date] || {})[h]; }
  function isMyBooking(date, h) { return user && (weekBookings[date] || {})[h]?.uid === user.uid; }
  function isPending(date, h) { return (weekBookings[date] || {})[h]?.status === "pending"; }
  function isMyPendingAsPlayer2(date, h) {
    const b = (weekBookings[date] || {})[h];
    return b?.status === "pending" && b?.player2email === user?.email?.toLowerCase();
  }

  function userCanBook() {
    if (!userActiveBooking) return true;
    const nowDate = todayStr();
    const nowHour = new Date().getHours();
    if (userActiveBooking.date > nowDate) return false;
    if (userActiveBooking.date === nowDate && Number(userActiveBooking.hour) >= nowHour) return false;
    return true;
  }

  async function handleGoogleLogin() {
    try { setLoading(true); await loginWithGoogle(); }
    catch(e) { setError("Αποτυχία σύνδεσης. Δοκιμάστε ξανά."); }
    finally { setLoading(false); }
  }

  async function handleLogout() {
    await logout(); setSelectedSlot(null); setStep("slots"); setError("");
  }

  async function handleBook() {
    if (!user) { handleGoogleLogin(); return; }
    if (selectedSlot === null) { setError("Επιλέξτε μία ώρα."); return; }
    // Live check
    const snap = await getDoc(doc(db, "userBookings", user.uid));
    if (snap.exists()) {
      const b = snap.data();
      const nowDate = todayStr(), nowHour = new Date().getHours();
      if (b.date > nowDate || (b.date === nowDate && Number(b.hour) >= nowHour)) {
        setError("Έχετε ήδη κράτηση που δεν έχει ακόμα παιχτεί.");
        return;
      }
    }
    setStep("confirm");
  }

  async function handleConfirm() {
    setPartnerEmailError("");
    if (!userCanBook()) { setError("Έχετε ήδη κράτηση."); setStep("slots"); return; }

    const email2 = partnerEmail.trim().toLowerCase();

    // Υποχρεωτικό το email 2ου παίκτη
    if (!email2) { setPartnerEmailError("Το Gmail του 2ου παίκτη είναι υποχρεωτικό."); return; }
    if (!email2.includes("@")) { setPartnerEmailError("Μη έγκυρο email."); return; }
    if (email2 === user.email.toLowerCase()) { setPartnerEmailError("Δεν μπορείτε να βάλετε το δικό σας email."); return; }

    // Έλεγξε αν ο 2ος παίκτης έχει ήδη κράτηση
    setLoading(true);
    try {
      // Έλεγξε αν υπάρχει ήδη πρόσκληση για αυτό το email
      const existingInvite = await getDoc(doc(db, "pendingInvites", email2));
      if (existingInvite.exists()) {
        setPartnerEmailError("Αυτός ο παίκτης έχει ήδη εκκρεμή πρόσκληση.");
        setLoading(false); return;
      }

      // Αποθήκευσε ως εκκρεμής
      const dayB = weekBookings[selectedDate] || {};
      const newDay = { ...dayB, [selectedSlot]: {
        uid: user.uid, name: user.name, email: user.email,
        player2email: email2, status: "pending", createdAt: Date.now()
      }};
      await saveDayBookings(selectedDate, newDay);
      // Δέσμευσε τον Παίκτη 1
      await setDoc(doc(db, "userBookings", user.uid), { date: selectedDate, hour: selectedSlot, status: "pending" });
      // Δημιούργησε πρόσκληση για τον Παίκτη 2
      await setDoc(doc(db, "pendingInvites", email2), {
        player1uid: user.uid, player1name: user.name,
        player2email: email2,
        date: selectedDate, hour: selectedSlot,
        createdAt: Date.now()
      });

      setLastBooking({ date: selectedDate, slot: selectedSlot, name: user.name, partner: email2, pending: true });
      setStep("success"); setSelectedSlot(null); setPartnerEmail("");
    } catch(e) { setError("Σφάλμα αποθήκευσης."); }
    finally { setLoading(false); }
  }

  // Παίκτης 2 αποδέχεται
  async function handleAcceptInvite() {
    if (!pendingInvite || !user) return;
    setLoading(true);
    try {
      const { date, hour, player1uid, player1name, player2email } = pendingInvite;
      const dayB = (await getDoc(doc(db, "bookings", date))).data() || {};
      const newDay = { ...dayB, [hour]: {
        ...dayB[hour], status: "confirmed",
        player2uid: user.uid, player2name: user.name
      }};
      await saveDayBookings(date, newDay);
      // Δέσμευσε τον Παίκτη 2
      await setDoc(doc(db, "userBookings", user.uid), { date, hour, status: "confirmed" });
      // Ενημέρωσε τον Παίκτη 1
      await setDoc(doc(db, "userBookings", player1uid), { date, hour, status: "confirmed" });
      // Διέγραψε την πρόσκληση
      await deleteDoc(doc(db, "pendingInvites", player2email));
    } catch(e) { setError("Σφάλμα αποδοχής."); }
    finally { setLoading(false); }
  }

  // Ακύρωση κράτησης (και από τους 2)
  async function handleCancelBooking(date, h) {
    const booking = (weekBookings[date] || {})[h];
    if (!booking) return;
    const newDay = { ...(weekBookings[date] || {}) };
    delete newDay[h];
    await saveDayBookings(date, newDay);
    // Ελευθέρωσε Παίκτη 1
    if (booking.uid) await deleteDoc(doc(db, "userBookings", booking.uid));
    // Ελευθέρωσε Παίκτη 2 αν υπάρχει
    if (booking.player2uid) await deleteDoc(doc(db, "userBookings", booking.player2uid));
    // Διέγραψε τυχόν εκκρεμή πρόσκληση
    if (booking.player2email) await deleteDoc(doc(db, "pendingInvites", booking.player2email));
  }

  async function adminCancel(h) {
    await handleCancelBooking(selectedDate, h);
  }

  async function adminSaveBooking(slot, data) {
    const newDay = { ...(weekBookings[selectedDate] || {}), [slot]: data };
    await saveDayBookings(selectedDate, newDay);
    setAdminModal(null);
  }

  async function loadStats() {
    setStatsLoading(true);
    try {
      // Φόρτωσε όλες τις κρατήσεις από SCHEDULE_START έως σήμερα
      const allDays = [];
      let d = new Date(SCHEDULE_START + "T12:00:00");
      const endD = new Date(Math.min(new Date(SCHEDULE_END + "T12:00:00"), new Date()));
      while (d <= endD) {
        allDays.push(d.toISOString().split("T")[0]);
        d.setDate(d.getDate() + 1);
      }

      const bookingsByUser = {}; // { name: count }
      const bookingsByHour = {}; // { hour: count }
      const bookingsByDay  = {}; // { dayName: count }
      const bookingsByWeek = {}; // { monday: { total, available } }
      let totalBookings = 0;
      let totalSlotsDone = 0;

      for (const date of allDays) {
        const snap = await getDoc(doc(db, "bookings", date));
        const slots = getSlotsForDate(date, []);
        totalSlotsDone += slots.length;
        if (snap.exists()) {
          const data = snap.data();
          for (const [h, b] of Object.entries(data)) {
            if (!b || !b.name) continue;
            totalBookings++;
            // Ανά χρήστη
            bookingsByUser[b.name] = (bookingsByUser[b.name] || 0) + 1;
            // Ανά ώρα
            bookingsByHour[h] = (bookingsByHour[h] || 0) + 1;
            // Ανά μέρα εβδομάδας
            const dow = DAY_NAMES_FULL[new Date(date + "T12:00:00").getDay()];
            bookingsByDay[dow] = (bookingsByDay[dow] || 0) + 1;
            // Ανά εβδομάδα
            const monday = getWeekMonday(date);
            if (!bookingsByWeek[monday]) bookingsByWeek[monday] = { total: 0, available: 0 };
            bookingsByWeek[monday].total++;
          }
        }
        // Διαθέσιμες ανά εβδομάδα
        const monday = getWeekMonday(date);
        if (!bookingsByWeek[monday]) bookingsByWeek[monday] = { total: 0, available: 0 };
        bookingsByWeek[monday].available += slots.length;
      }

      setStatsData({
        totalBookings,
        totalSlotsDone,
        occupancy: totalSlotsDone > 0 ? Math.round(totalBookings / totalSlotsDone * 100) : 0,
        byUser: Object.entries(bookingsByUser).sort((a,b) => b[1]-a[1]).slice(0,10),
        byHour: Object.entries(bookingsByHour).sort((a,b) => b[1]-a[1]),
        byDay: Object.entries(bookingsByDay).sort((a,b) => b[1]-a[1]),
        byWeek: Object.entries(bookingsByWeek).sort((a,b) => a[0].localeCompare(b[0])),
      });
    } catch(e) { console.error(e); }
    finally { setStatsLoading(false); }
  }

  async function toggleWeekVisibility(mondayStr) {
    const newHidden = hiddenWeeks.includes(mondayStr)
      ? hiddenWeeks.filter(w => w !== mondayStr)
      : [...hiddenWeeks, mondayStr];
    await setDoc(doc(db, "settings", "hiddenWeeks"), { weeks: newHidden });
  }

  function handleAdminLogin() {
    if (adminInput === ADMIN_PASSWORD) { setAdminMode(true); setShowAdminLogin(false); setAdminErr(""); setAdminInput(""); }
    else setAdminErr("Λάθος κωδικός.");
  }

  const dayBookings = weekBookings[selectedDate] || {};
  const bookedCount = Object.keys(dayBookings).length;
  const totalSlots = getSlotsForDate(selectedDate).length;

  // Χρόνος που απομένει για εκκρεμή πρόσκληση
  function timeLeft(createdAt) {
    const ms = PENDING_EXPIRY_MS - (Date.now() - createdAt);
    if (ms <= 0) return "0λ";
    const mins = Math.floor(ms / 60000);
    return `${mins}λ`;
  }

  // Stats Modal
  const StatsModal = () => {
    useEffect(() => { if (showStats && !statsData) loadStats(); }, [showStats]);
    if (!showStats) return null;
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, overflowY: "auto", padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: "#1b4332" }}>📊 Στατιστικά</h2>
            <button onClick={() => { setShowStats(false); setStatsData(null); }} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>×</button>
          </div>

          {statsLoading && <div style={{ textAlign: "center", padding: 40, color: "#2d6a4f" }}>⏳ Φόρτωση...</div>}

          {statsData && !statsLoading && (
            <>
              {/* Γενικά */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  ["🎾", "Κρατήσεις", statsData.totalBookings],
                  ["📅", "Διαθέσιμες", statsData.totalSlotsDone],
                  ["📈", "Πληρότητα", statsData.occupancy + "%"],
                ].map(([icon, label, val]) => (
                  <div key={label} style={{ background: "#f0f8f2", borderRadius: 12, padding: "12px 8px", textAlign: "center", border: "1px solid #d8f3dc" }}>
                    <div style={{ fontSize: 22 }}>{icon}</div>
                    <div style={{ fontSize: 18, fontWeight: "bold", color: "#1b4332" }}>{val}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Top χρήστες */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#1b4332" }}>👤 Top παίκτες</h3>
                {statsData.byUser.length === 0 && <p style={{ fontSize: 13, color: "#aaa" }}>Καμία κράτηση ακόμα.</p>}
                {statsData.byUser.map(([name, count], i) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: 13, color: "#888", width: 20 }}>#{i+1}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{name}</span>
                    <div style={{ background: "#2d6a4f", height: 8, borderRadius: 4, width: Math.max(20, count * 20) }} />
                    <span style={{ fontSize: 13, fontWeight: "bold", color: "#2d6a4f", width: 30, textAlign: "right" }}>{count}</span>
                  </div>
                ))}
              </div>

              {/* Ανά ώρα */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#1b4332" }}>🕐 Πιο δημοφιλείς ώρες</h3>
                {statsData.byHour.map(([h, count]) => (
                  <div key={h} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: 13, width: 80 }}>{slotLabel(parseInt(h))}</span>
                    <div style={{ flex: 1, background: "#f0f0f0", borderRadius: 4, height: 8 }}>
                      <div style={{ background: "#40916c", height: 8, borderRadius: 4, width: `${Math.min(100, count * 20)}%` }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: "bold", color: "#2d6a4f", width: 20 }}>{count}</span>
                  </div>
                ))}
              </div>

              {/* Ανά μέρα */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#1b4332" }}>📆 Ανά ημέρα εβδομάδας</h3>
                {statsData.byDay.map(([day, count]) => (
                  <div key={day} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: 13, flex: 1 }}>{day}</span>
                    <div style={{ width: 100, background: "#f0f0f0", borderRadius: 4, height: 8 }}>
                      <div style={{ background: "#52b788", height: 8, borderRadius: 4, width: `${Math.min(100, count * 15)}%` }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: "bold", color: "#2d6a4f", width: 20 }}>{count}</span>
                  </div>
                ))}
              </div>

              {/* Ανά εβδομάδα */}
              <div>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#1b4332" }}>📅 Πληρότητα ανά εβδομάδα</h3>
                {statsData.byWeek.map(([monday, { total, available }]) => {
                  const pct = available > 0 ? Math.round(total / available * 100) : 0;
                  return (
                    <div key={monday} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: "#444" }}>
                          {monday.split("-").reverse().join("/")}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: "bold", color: pct > 70 ? "#c0392b" : "#2d6a4f" }}>
                          {total}/{available} ({pct}%)
                        </span>
                      </div>
                      <div style={{ background: "#f0f0f0", borderRadius: 4, height: 6 }}>
                        <div style={{ background: pct > 70 ? "#e74c3c" : "#2d6a4f", height: 6, borderRadius: 4, width: `${pct}%`, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={loadStats} style={{ ...S.btn, marginTop: 16, background: "#40916c" }}>🔄 Ανανέωση</button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎾</div>
          <p style={{ color: "#2d6a4f", fontSize: 16 }}>Φόρτωση...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {/* HEADER */}
      <div style={{ background: "linear-gradient(160deg, #1b4332 0%, #2d6a4f 60%, #40916c 100%)", padding: "28px 20px 24px", color: "#fff", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 38, marginBottom: 4 }}>🎾</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: "bold" }}>Milos Tennis Club</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.7, fontStyle: "italic" }}>Ηλεκτρονική κράτηση ώρας</p>

        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", borderRadius: 30, padding: "6px 14px" }}>
              {user.photo ? <img src={user.photo} style={{ width: 28, height: 28, borderRadius: "50%" }} /> : <div style={{ ...S.avatar, width: 28, height: 28, fontSize: 11, background: "rgba(255,255,255,0.3)" }}>{user.name[0]}</div>}
              <span style={{ fontSize: 13 }}>{user.name}</span>
              <button onClick={handleLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          ) : (
            <button onClick={handleGoogleLogin} disabled={loading} style={{ background: "#fff", color: "#2d6a4f", border: "none", borderRadius: 20, padding: "8px 18px", fontSize: 13, fontWeight: "bold", cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
              🔵 {loading ? "Σύνδεση..." : "Σύνδεση με Google"}
            </button>
          )}

          {!adminMode ? (
            <button onClick={() => setShowAdminLogin(v => !v)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 20, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>🔑 Admin</button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, background: "rgba(255,220,100,0.25)", border: "1px solid rgba(255,220,100,0.5)", borderRadius: 20, padding: "5px 12px" }}>⚙️ Διαχειριστής</span>
              <button onClick={() => setAdminMode(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          )}
        </div>

        {showAdminLogin && !adminMode && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <input type="password" value={adminInput} onChange={e => setAdminInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} placeholder="Κωδικός admin" style={{ padding: "7px 12px", borderRadius: 8, border: "none", fontSize: 13 }} />
            <button onClick={handleAdminLogin} style={{ background: "#fff", color: "#2d6a4f", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: "bold" }}>OK</button>
            {adminErr && <span style={{ color: "#ffb3b3", fontSize: 12, alignSelf: "center" }}>{adminErr}</span>}
          </div>
        )}
      </div>

      <div style={S.body}>

        {/* ΕΚΚΡΕΜΗΣ ΠΡΟΣΚΛΗΣΗ για τον Παίκτη 2 */}
        {pendingInvite && user && (
          <div style={S.pending}>
            <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: "bold", color: "#7a4f00" }}>
              🎾 Εκκρεμής πρόσκληση!
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#5a3a00" }}>
              Ο <strong>{pendingInvite.player1name}</strong> σας προσκαλεί για:
              <br />📅 {formatDate(pendingInvite.date)} · 🕐 {slotLabel(pendingInvite.hour)}
              <br /><span style={{ fontSize: 11, color: "#888" }}>Λήγει σε: {timeLeft(pendingInvite.createdAt)}</span>
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleCancelBooking(pendingInvite.date, pendingInvite.hour)} style={{ ...S.btnDanger, flex: 1, padding: "10px", fontSize: 13, borderRadius: 10 }}>
                ✕ Απόρριψη
              </button>
              <button onClick={handleAcceptInvite} disabled={loading} style={{ ...S.btn, flex: 2, marginTop: 0, background: "#e6a817" }}>
                ✅ Αποδοχή
              </button>
            </div>
          </div>
        )}

        {/* ADMIN PANEL */}
        {adminMode && (
          <div style={S.adminCard}>
            <p style={S.adminTitle}>⚙️ Πίνακας Διαχειριστή</p>
            <div style={{ fontSize: 13, color: "#95d5b2", marginBottom: 14 }}>
              📅 {formatDate(selectedDate)} &nbsp;·&nbsp; {bookedCount}/{totalSlots} ώρες κλεισμένες
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#d8f3dc" }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>✅</div>
                <strong>{totalSlots - bookedCount}</strong> διαθέσιμες
              </div>
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#d8f3dc" }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>🎾</div>
                <strong>{bookedCount}</strong> κρατημένες
              </div>
            </div>
            <p style={{ margin: "14px 0 6px", fontSize: 12, color: "#74c69d" }}>💡 Κλικ σε ώρα για προσθήκη, επεξεργασία ή ακύρωση.</p>
            <button onClick={() => setShowStats(true)} style={{ ...S.btnAdmin, marginTop: 10 }}>
              📊 Στατιστικά
            </button>
          </div>
        )}

        {/* WEEKLY VIEW */}
        {step === "slots" && (() => {
          const weekDays = getWeekDays(weekMonday);
          const prevMonday = new Date(weekMonday + "T12:00:00"); prevMonday.setDate(prevMonday.getDate() - 7);
          const prevMondayStr = prevMonday.toISOString().split("T")[0];
          const nextMonday = new Date(weekMonday + "T12:00:00"); nextMonday.setDate(nextMonday.getDate() + 7);
          const nextMondayStr = nextMonday.toISOString().split("T")[0];
          const canGoPrev = adminMode || weekMonday > SCHEDULE_START;
          const canGoNext = adminMode || nextMondayStr <= SCHEDULE_END;

          return (
            <>
              <div style={{ background: "#e8f4ec", borderRadius: 12, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "#2d6a4f" }}>
                📋 <strong>02/06–19/06:</strong> Δευ/Τρι/Πεμ/Παρ: 16–19 · Τετ: 19–22 · Σαβ/Κυρ: 15–22<br/>
                📋 <strong>19/06–30/08:</strong> Δευ/Τετ/Παρ: 19–22 · Τρι/Πεμ: 16–19 · Σαβ: 08–15 · Κυρ: 15–22
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <button onClick={() => { setWeekMonday(prevMondayStr); setSelectedSlot(null); }} disabled={!canGoPrev}
                  style={{ background: canGoPrev ? "#2d6a4f" : "#ccc", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", cursor: canGoPrev ? "pointer" : "default", fontSize: 16 }}>‹</button>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "#1b4332" }}>
                    {weekDays[0].split("-").reverse().join("/")} – {weekDays[6].split("-").reverse().join("/")}
                  </div>
                  {adminMode && (
                    <button onClick={() => toggleWeekVisibility(weekMonday)} style={{
                      marginTop: 4, fontSize: 11, padding: "3px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: hiddenWeeks.includes(weekMonday) ? "#2d6a4f" : "#c0392b",
                      color: "#fff"
                    }}>
                      {hiddenWeeks.includes(weekMonday) ? "👁️ Εμφάνιση εβδομάδας" : "🙈 Απόκρυψη εβδομάδας"}
                    </button>
                  )}
                </div>
                <button onClick={() => { setWeekMonday(nextMondayStr); setSelectedSlot(null); }} disabled={!canGoNext}
                  style={{ background: canGoNext ? "#2d6a4f" : "#ccc", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", cursor: canGoNext ? "pointer" : "default", fontSize: 16 }}>›</button>
              </div>

              {weekDays.map(date => {
                const slots = adminMode ? getSlotsForDate(date, []) : getSlotsForDate(date, hiddenWeeks);
                if (!adminMode && getSlotsForDate(date, hiddenWeeks).length === 0 && hiddenWeeks.includes(getWeekMonday(date))) return null;
                const dbDay = weekBookings[date] || {};
                const isToday = date === todayStr();
                const hasSlots = slots.length > 0;

                return (
                  <div key={date} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e0ebe0", marginBottom: 10, overflow: "hidden", opacity: hasSlots ? 1 : 0.45, boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>
                    <div style={{ background: isToday ? "#2d6a4f" : "#f4f9f4", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <span style={{ fontWeight: "bold", fontSize: 14, color: isToday ? "#fff" : "#1b4332" }}>{DAY_NAMES_FULL[new Date(date + "T12:00:00").getDay()]}</span>
                        <span style={{ marginLeft: 8, fontSize: 13, color: isToday ? "rgba(255,255,255,0.8)" : "#666" }}>{date.split("-").reverse().join("/")}</span>
                        {isToday && <span style={{ marginLeft: 6, fontSize: 11, background: "rgba(255,255,255,0.25)", borderRadius: 8, padding: "1px 6px", color: "#fff" }}>Σήμερα</span>}
                      </div>
                      {hasSlots && <span style={{ fontSize: 12, color: isToday ? "rgba(255,255,255,0.8)" : "#888" }}>{slots.filter(h => !dbDay[h]).length} ελεύθερες</span>}
                    </div>

                    {adminMode && hiddenWeeks.includes(getWeekMonday(date)) && (
                      <div style={{ padding: "6px 14px", fontSize: 11, color: "#e6a817", background: "#fff8e1" }}>
                        🙈 Κρυμμένη εβδομάδα (μόνο admin τη βλέπει)
                      </div>
                    )}
                    {hasSlots ? (
                      <div style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {slots.map(h => {
                          const booked = !!dbDay[h];
                          const mine = user && dbDay[h]?.uid === user.uid;
                          const isPlayer2 = user && dbDay[h]?.player2uid === user.uid;
                          const pending = dbDay[h]?.status === "pending";
                          const selThis = selectedDate === date && selectedSlot === h;
                          const info = dbDay[h];

                          let bg = "#f0fff4", border = "#74c69d", color = "#1b4332", cursor = "pointer";
                          if (booked && (mine || isPlayer2) && !pending) { bg = "#d8f3dc"; border = "#2d6a4f"; cursor = "default"; }
                          else if (booked && pending && (mine || isPlayer2)) { bg = "#fff8e1"; border = "#e6a817"; color = "#7a4f00"; cursor = "default"; }
                          else if (booked && adminMode) { bg = "#fff3cd"; border = "#e6a817"; color = "#7a4f00"; cursor = "pointer"; }
                          else if (booked) { bg = "#fde8e8"; border = "#e5a0a0"; color = "#c0392b"; cursor = "not-allowed"; }
                          else if (selThis) { bg = "#2d6a4f"; border = "#1b4332"; color = "#fff"; }

                          return (
                            <button key={h}
                              onClick={() => {
                                if (adminMode) { setSelectedDate(date); setAdminModal({ slot: h, existing: booked ? info : null }); }
                                else if (!booked) { setSelectedDate(date); setSelectedSlot(h === selectedSlot && date === selectedDate ? null : h); setError(""); }
                              }}
                              style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${border}`, background: bg, color, fontSize: 12, cursor, fontFamily: "inherit", transition: "all 0.12s", minWidth: 80, textAlign: "center" }}>
                              <div>{slotLabel(h)}</div>
                              {booked && (
                                <div style={{ fontSize: 10, marginTop: 1 }}>
                                  {pending && <div style={{ fontSize: 9, color: "#e6a817", fontWeight: "bold" }}>🟡 Εκκρεμής</div>}
                                  <div style={{ fontWeight: "bold" }}>👤 {info.name}</div>
                                  {info.player2name && <div>👤 {info.player2name}</div>}
                                  {(mine || isPlayer2) && !adminMode && (
                                    <button onClick={e => { e.stopPropagation(); handleCancelBooking(date, h); }}
                                      style={{ ...S.btnDanger, padding: "2px 6px", fontSize: 10, marginTop: 2 }}>Ακύρωση</button>
                                  )}
                                  {adminMode && <div style={{ fontSize: 9, marginTop: 2, opacity: 0.7 }}>✏️ Επεξεργασία</div>}
                                </div>
                              )}
                              {selThis && !booked && <div style={{ fontSize: 9, marginTop: 1 }}>✓</div>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ padding: "8px 14px", fontSize: 12, color: "#aaa" }}>Κλειστό</div>
                    )}
                  </div>
                );
              })}

              <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, color: "#666", flexWrap: "wrap" }}>
                {[["#f0fff4","#74c69d","Διαθέσιμο"],["#fde8e8","#e5a0a0","Κλεισμένο"],["#d8f3dc","#2d6a4f","Δική μου"],["#fff8e1","#e6a817","Εκκρεμής"],["#2d6a4f","#1b4332","Επιλεγμένο"]]
                  .map(([bg,br,label]) => (
                  <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1.5px solid ${br}`, display: "inline-block" }} />{label}
                  </span>
                ))}
              </div>

              {!adminMode && hiddenWeeks.includes(weekMonday) && (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#888" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
                  <p style={{ margin: 0, fontSize: 14 }}>Δεν υπάρχουν διαθέσιμες ώρες αυτή την εβδομάδα.</p>
                </div>
              )}
              {error && <div style={{ ...S.error, marginTop: 10 }}>⚠️ {error}</div>}

              {selectedSlot !== null && !adminMode && (
                <div style={{ marginTop: 12, background: "#f0f8f2", borderRadius: 12, padding: "12px 14px", border: "1.5px solid #74c69d" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 14, color: "#1b4332" }}>
                    📅 {formatDate(selectedDate)} · <strong>{slotLabel(selectedSlot)}</strong>
                  </p>
                  <button onClick={handleBook} style={S.btn}>
                    {user ? "Κράτηση →" : "🔵 Σύνδεση & Κράτηση →"}
                  </button>
                </div>
              )}
            </>
          );
        })()}

        {/* CONFIRM */}
        {step === "confirm" && (
          <div style={S.card}>
            <p style={S.cardTitle}>📋 Επιβεβαίωση κράτησης</p>
            <div style={{ background: "#f0f8f2", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                {user?.photo ? <img src={user.photo} style={{ width: 34, height: 34, borderRadius: "50%" }} /> : <div style={S.avatar}>{user?.name[0]}</div>}
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 15 }}>{user?.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{user?.email}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, color: "#1b4332" }}>
                📅 {formatDate(selectedDate)}<br />🕐 {slotLabel(selectedSlot)}
              </div>
            </div>

            <label style={S.label}>👤 Gmail 2ου παίκτη <span style={{ color: "#c0392b" }}>*</span></label>
            <input value={partnerEmail} onChange={e => { setPartnerEmail(e.target.value); setPartnerEmailError(""); }}
              placeholder="π.χ. kostas@gmail.com" style={S.input} type="email" />
            {partnerEmailError && <div style={S.error}>⚠️ {partnerEmailError}</div>}

            {partnerEmail.trim() && (
              <div style={{ background: "#fff8e1", borderRadius: 10, padding: "8px 12px", marginTop: 8, fontSize: 12, color: "#7a4f00" }}>
                🟡 Ο 2ος παίκτης θα λάβει πρόσκληση και πρέπει να αποδεχτεί μέσα σε <strong>1 ώρα</strong>.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep("slots")} style={{ ...S.btnOutline, flex: 1 }}>← Πίσω</button>
              <button onClick={handleConfirm} disabled={loading} style={{ ...S.btn, flex: 2, marginTop: 0, opacity: loading ? 0.7 : 1 }}>
                {loading ? "⏳..." : partnerEmail.trim() ? "📨 Αποστολή πρόσκλησης" : "✅ Επιβεβαίωση"}
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {step === "success" && lastBooking && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>{lastBooking.pending ? "🟡" : "✅"}</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#1b4332" }}>
              {lastBooking.pending ? "Πρόσκληση εστάλη!" : "Η κράτηση έγινε!"}
            </h3>
            <div style={{ ...S.success, textAlign: "left" }}>
              📅 {formatDate(lastBooking.date)}<br />
              🕐 {slotLabel(lastBooking.slot)}<br />
              👤 {lastBooking.name}
              {lastBooking.partner && <><br />📧 {lastBooking.partner}</>}
            </div>
            {lastBooking.pending && (
              <p style={{ fontSize: 13, color: "#e6a817", marginTop: 10, fontWeight: "bold" }}>
                ⏳ Αναμονή αποδοχής από τον 2ο παίκτη (1 ώρα)
              </p>
            )}
            <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>💡 Μπορείτε να κλείσετε ξανά μόνο αφού παίξετε.</p>
            <button onClick={() => setStep("slots")} style={{ ...S.btn, marginTop: 8 }}>Πίσω στο πρόγραμμα</button>
          </div>
        )}
      </div>

      <StatsModal />

      {adminModal && (
        <AdminBookingModal
          slot={adminModal.slot} date={selectedDate} existing={adminModal.existing}
          onSave={(data) => adminSaveBooking(adminModal.slot, data)}
          onCancel={() => { adminCancel(adminModal.slot); setAdminModal(null); }}
          onClose={() => setAdminModal(null)}
        />
      )}
    </div>
  );
}
