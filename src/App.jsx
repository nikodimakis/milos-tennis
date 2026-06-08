import { useState } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "dimos2024";
const STORAGE_KEY = "tennis_bookings_v5";

// Πρόγραμμα αντισφαίρισης: 2/6/2026 – 19/6/2026
const SCHEDULE_START = "2026-06-02";
const SCHEDULE_END   = "2026-06-19";

// ─── HELPERS ───────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split("T")[0]; }
function addDays(n) { return new Date(Date.now() + n * 86400000).toISOString().split("T")[0]; }
function formatDate(d) {
  return new Date(d + "T12:00:00").toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" });
}
function pad(n) { return String(n).padStart(2, "0"); }
function slotLabel(h) { return `${pad(h)}:00 – ${pad(h + 1)}:00`; }

// Επιστρέφει τις διαθέσιμες ώρες αντισφαίρισης για μια ημερομηνία
function getSlotsForDate(dateStr) {
  if (dateStr < SCHEDULE_START || dateStr > SCHEDULE_END) return [];
  const dow = new Date(dateStr + "T12:00:00").getDay(); // 0=Κυρ, 6=Σαβ
  const isWeekend = dow === 0 || dow === 6;
  return isWeekend
    ? Array.from({ length: 7 }, (_, i) => 15 + i)  // 15:00–22:00
    : [16, 17, 18];                                   // 16:00–19:00
}

function dateHasSlots(dateStr) { return getSlotsForDate(dateStr).length > 0; }
function loadBookings() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
function saveBookings(b) { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); }

const MOCK_ACCOUNTS = [
  { uid: "g_001", name: "Γιώργος Παπαδόπουλος", email: "gpapadopoulos@gmail.com" },
  { uid: "g_002", name: "Μαρία Κωνσταντίνου",   email: "mkonstantinou@gmail.com" },
  { uid: "g_003", name: "Νίκος Αλεξίου",         email: "nalexiou@gmail.com" },
];

// ─── STYLES ────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight: "100vh", background: "#f0f4f0", fontFamily: "'Palatino Linotype', Palatino, serif", color: "#1a2e1a" },
  body: { maxWidth: 520, margin: "0 auto", padding: "20px 14px 60px" },
  card: { background: "#fff", borderRadius: 18, padding: "20px 18px", marginBottom: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.07)", border: "1px solid #e0ebe0" },
  adminCard: { background: "#1b4332", borderRadius: 18, padding: "20px 18px", marginBottom: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.2)", border: "1px solid #0d2b1f" },
  cardTitle: { margin: "0 0 14px", fontSize: 15, fontWeight: "bold", color: "#1b4332" },
  adminTitle: { margin: "0 0 14px", fontSize: 15, fontWeight: "bold", color: "#d8f3dc" },
  btn: { background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 12, padding: "13px 24px", fontSize: 15, fontWeight: "bold", cursor: "pointer", width: "100%", marginTop: 10 },
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
};

// ─── GOOGLE LOGIN MODAL ────────────────────────────────────────────────────
function GoogleLoginModal({ onLogin, onClose }) {
  const [mode, setMode] = useState("pick");
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🔵</div>
          <h2 style={{ margin: 0, fontSize: 18, color: "#1b4332" }}>Είσοδος με Google</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#666" }}>Επιλέξτε λογαριασμό</p>
        </div>
        {mode === "pick" && <>
          {MOCK_ACCOUNTS.map(acc => (
            <button key={acc.uid} onClick={() => onLogin(acc)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e0e0e0",
              background: "#fafafa", cursor: "pointer", marginBottom: 10, textAlign: "left",
            }}>
              <div style={S.avatar}>{acc.name[0]}</div>
              <div><div style={{ fontWeight: "bold", fontSize: 14 }}>{acc.name}</div><div style={{ fontSize: 12, color: "#888" }}>{acc.email}</div></div>
            </button>
          ))}
          <button onClick={() => setMode("custom")} style={{ ...S.btnOutline, width: "100%", marginTop: 4 }}>+ Άλλος λογαριασμός</button>
        </>}
        {mode === "custom" && <>
          <label style={S.label}>Ονοματεπώνυμο</label>
          <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="π.χ. Κώστας Νικολάου" style={S.input} />
          <label style={S.label}>Gmail</label>
          <input value={customEmail} onChange={e => setCustomEmail(e.target.value)} placeholder="π.χ. kostas@gmail.com" style={S.input} type="email" />
          <button onClick={() => { if (customName.trim() && customEmail.includes("@")) onLogin({ uid: "g_" + Date.now(), name: customName.trim(), email: customEmail.trim() }); }} style={{ ...S.btn, marginTop: 16 }}>Σύνδεση</button>
          <button onClick={() => setMode("pick")} style={{ ...S.btnOutline, width: "100%", marginTop: 8 }}>← Πίσω</button>
        </>}
        <button onClick={onClose} style={{ color: "#999", background: "none", border: "none", width: "100%", marginTop: 12, cursor: "pointer", fontSize: 13 }}>Ακύρωση</button>
      </div>
    </div>
  );
}

// ─── ADMIN BOOKING MODAL ────────────────────────────────────────────────────
function AdminBookingModal({ slot, date, existing, onSave, onCancel, onClose }) {
  const [name, setName] = useState(existing?.name || "");
  const [partner, setPartner] = useState(existing?.partner || "");

  function handleSave() {
    if (!name.trim()) return;
    onSave({ uid: existing?.uid || ("admin_" + Date.now()), name: name.trim(), partner: partner.trim() || null, byAdmin: true });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div style={{ background: "#1b4332", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        <h3 style={{ margin: "0 0 4px", color: "#d8f3dc", fontSize: 17 }}>
          {existing ? "✏️ Επεξεργασία κράτησης" : "➕ Νέα κράτηση"}
        </h3>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#95d5b2" }}>{slotLabel(slot)} · {formatDate(date)}</p>

        <label style={S.labelDark}>👤 Παίκτης 1 *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ονοματεπώνυμο" style={S.inputDark} />

        <label style={S.labelDark}>👤 Παίκτης 2 <span style={{ fontWeight: "normal", color: "#52b788" }}>(προαιρετικό)</span></label>
        <input value={partner} onChange={e => setPartner(e.target.value)} placeholder="Ονοματεπώνυμο" style={S.inputDark} />

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...S.btnOutlineLight, flex: 1 }}>Άκυρο</button>
          <button onClick={handleSave} style={{ ...S.btnAdmin, flex: 2, marginTop: 0 }}>💾 Αποθήκευση</button>
        </div>

        {existing && (
          <button onClick={onCancel} style={{ ...S.btnDanger, width: "100%", marginTop: 12, padding: "11px", fontSize: 13, borderRadius: 10 }}>
            🗑️ Ακύρωση αυτής της κράτησης
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [bookings, setBookings] = useState(loadBookings);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep] = useState("slots");
  const [error, setError] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [lastBooking, setLastBooking] = useState(null);
  const [partnerName, setPartnerName] = useState("");
  // Admin booking modal
  const [adminModal, setAdminModal] = useState(null); // { slot, existing? }

  const dayBookings = bookings[selectedDate] || {};
  function persist(nb) { setBookings(nb); saveBookings(nb); }
  function handleLogin(acc) { setUser(acc); setShowLogin(false); }
  function handleLogout() { setUser(null); setSelectedSlot(null); setStep("slots"); setError(""); }
  function isBooked(h) { return !!dayBookings[h]; }
  function isMyBooking(h) { return user && dayBookings[h]?.uid === user.uid; }

  function userCanBookAgain() {
    if (!user) return true;
    const nowDate = todayStr();
    const nowHour = new Date().getHours();
    for (const [date, slots] of Object.entries(bookings)) {
      for (const [h, b] of Object.entries(slots)) {
        if (b.uid !== user.uid) continue;
        if (date > nowDate) return false;
        if (date === nowDate && parseInt(h) >= nowHour) return false;
      }
    }
    return true;
  }

  function handleSlotClick(h) {
    if (isBooked(h)) return;
    setError("");
    setSelectedSlot(h === selectedSlot ? null : h);
  }

  function handleBook() {
    if (!user) { setShowLogin(true); return; }
    if (selectedSlot === null) { setError("Επιλέξτε μία ώρα."); return; }
    if (!userCanBookAgain()) {
      setError("Έχετε ήδη κράτηση που δεν έχει ακόμα παιχτεί. Μπορείτε να κλείσετε νέα ώρα μόνο αφού παίξετε.");
      return;
    }
    setStep("confirm");
  }

  function handleConfirm() {
    const nb = { ...bookings, [selectedDate]: { ...(bookings[selectedDate] || {}) } };
    nb[selectedDate][selectedSlot] = { uid: user.uid, name: user.name, email: user.email, partner: partnerName.trim() || null };
    persist(nb);
    setLastBooking({ date: selectedDate, slot: selectedSlot, name: user.name, partner: partnerName.trim() });
    setStep("success");
    setSelectedSlot(null);
    setPartnerName("");
  }

  function handleCancelMine(h) {
    const nb = { ...bookings, [selectedDate]: { ...(bookings[selectedDate] || {}) } };
    delete nb[selectedDate][h];
    persist(nb);
  }

  // ADMIN: cancel any slot
  function adminCancel(h) {
    const nb = { ...bookings, [selectedDate]: { ...(bookings[selectedDate] || {}) } };
    delete nb[selectedDate][h];
    persist(nb);
  }

  // ADMIN: save from modal (new or edit)
  function adminSaveBooking(slot, data) {
    const nb = { ...bookings, [selectedDate]: { ...(bookings[selectedDate] || {}) } };
    nb[selectedDate][slot] = data;
    persist(nb);
    setAdminModal(null);
  }

  function handleAdminLogin() {
    if (adminInput === ADMIN_PASSWORD) { setAdminMode(true); setShowAdminLogin(false); setAdminErr(""); setAdminInput(""); }
    else setAdminErr("Λάθος κωδικός.");
  }

  const minDate = todayStr();
  const maxDate = addDays(14);

  function slotColors(h) {
    const booked = isBooked(h);
    const mine = isMyBooking(h);
    const sel = selectedSlot === h;
    if (booked && mine) return { bg: "#d8f3dc", border: "#2d6a4f", color: "#1b4332", cursor: "default" };
    if (booked && adminMode) return { bg: "#fff3cd", border: "#e6a817", color: "#7a4f00", cursor: "pointer" };
    if (booked) return { bg: "#fde8e8", border: "#e5a0a0", color: "#c0392b", cursor: "not-allowed" };
    if (sel) return { bg: "#2d6a4f", border: "#1b4332", color: "#fff", cursor: "pointer" };
    if (adminMode) return { bg: "#f0fff4", border: "#74c69d", color: "#1b4332", cursor: "pointer" };
    return { bg: "#f8faf8", border: "#d0e8d0", color: "#2d6a4f", cursor: "pointer" };
  }

  // Slots for selected date
  const daySlots = getSlotsForDate(selectedDate);
  const bookedCount = Object.keys(dayBookings).length;
  const totalSlots = daySlots.length;

  return (
    <div style={S.app}>
      {/* HEADER */}
      <div style={{ background: "linear-gradient(160deg, #1b4332 0%, #2d6a4f 60%, #40916c 100%)", padding: "28px 20px 24px", color: "#fff", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 38, marginBottom: 4 }}>🎾</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: "bold" }}>Δημοτικό Γήπεδο Τένις</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.7, fontStyle: "italic" }}>Ηλεκτρονική κράτηση ώρας</p>

        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", borderRadius: 30, padding: "6px 14px" }}>
              <div style={{ ...S.avatar, width: 28, height: 28, fontSize: 11, background: "rgba(255,255,255,0.3)" }}>{user.name[0]}</div>
              <span style={{ fontSize: 13 }}>{user.name}</span>
              <button onClick={handleLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          ) : (
            <button onClick={() => setShowLogin(true)} style={{ background: "#fff", color: "#2d6a4f", border: "none", borderRadius: 20, padding: "8px 18px", fontSize: 13, fontWeight: "bold", cursor: "pointer" }}>
              🔵 Σύνδεση με Google
            </button>
          )}

          {!adminMode ? (
            <button onClick={() => setShowAdminLogin(v => !v)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 20, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>
              🔑 Admin
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, background: "rgba(255,220,100,0.25)", border: "1px solid rgba(255,220,100,0.5)", borderRadius: 20, padding: "5px 12px" }}>⚙️ Λειτουργία Διαχειριστή</span>
              <button onClick={() => setAdminMode(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          )}
        </div>

        {showAdminLogin && !adminMode && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <input type="password" value={adminInput} onChange={e => setAdminInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
              placeholder="Κωδικός admin" style={{ padding: "7px 12px", borderRadius: 8, border: "none", fontSize: 13 }} />
            <button onClick={handleAdminLogin} style={{ background: "#fff", color: "#2d6a4f", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: "bold" }}>OK</button>
            {adminErr && <span style={{ color: "#ffb3b3", fontSize: 12, alignSelf: "center" }}>{adminErr}</span>}
          </div>
        )}
      </div>

      <div style={S.body}>

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
            <p style={{ margin: "14px 0 6px", fontSize: 12, color: "#74c69d" }}>
              💡 Κάντε κλικ σε οποιαδήποτε ώρα για να προσθέσετε, επεξεργαστείτε ή ακυρώσετε κράτηση.
            </p>
          </div>
        )}

        {/* Date picker */}
        <div style={S.card}>
          <p style={{ ...S.cardTitle, marginBottom: 10 }}>📅 Επιλογή ημερομηνίας</p>
          <div style={{ background: "#e8f4ec", borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#2d6a4f" }}>
            📋 Πρόγραμμα αντισφαίρισης: <strong>2/6 – 19/6/2026</strong><br/>
            Δευτ–Παρ: 16:00–19:00 &nbsp;|&nbsp; Σαβ–Κυρ: 15:00–22:00
          </div>
          <input type="date" value={selectedDate}
            min={adminMode ? "2026-06-02" : SCHEDULE_START}
            max={adminMode ? addDays(365) : SCHEDULE_END}
            onChange={e => { setSelectedDate(e.target.value); setSelectedSlot(null); setStep("slots"); setError(""); }}
            style={{ ...S.input, marginTop: 0 }} />
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#4a6741", fontStyle: "italic" }}>{formatDate(selectedDate)}</p>
        </div>

        {/* SLOTS */}
        {step === "slots" && (
          <div style={S.card}>
            <p style={S.cardTitle}>
              🕐 Ώρες αντισφαίρισης
              <span style={{ fontWeight: "normal", fontSize: 12, color: "#888", marginLeft: 8 }}>1 ώρα ανά κράτηση</span>
            </p>

            {daySlots.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#888" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
                <p style={{ margin: 0, fontSize: 14 }}>Δεν υπάρχουν ώρες αντισφαίρισης<br/>για αυτή την ημερομηνία.</p>
                {!adminMode && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#aaa" }}>Επιλέξτε ημερομηνία μεταξύ 2/6 και 19/6/2026.</p>}
              </div>
            )}

            {daySlots.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {daySlots.map(h => {
                const booked = isBooked(h);
                const mine = isMyBooking(h);
                const sel = selectedSlot === h;
                const { bg, border, color, cursor } = slotColors(h);
                const info = dayBookings[h];

                return (
                  <button key={h}
                    onClick={() => {
                      if (adminMode) {
                        // Admin: click booked → edit modal, click free → add modal
                        setAdminModal({ slot: h, existing: booked ? info : null });
                      } else {
                        if (!booked) handleSlotClick(h);
                      }
                    }}
                    style={{ padding: "12px 8px", borderRadius: 12, border: `2px solid ${border}`, background: bg, color, fontSize: 13, cursor, textAlign: "center", fontFamily: "inherit", transition: "all 0.15s" }}>

                    <div style={{ fontSize: 12, marginBottom: 2 }}>{slotLabel(h)}</div>

                    {booked && (
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        <div style={{ fontWeight: "bold" }}>👤 {info.name}</div>
                        {info.partner && <div style={{ opacity: 0.85 }}>👤 {info.partner}</div>}
                        {info.byAdmin && <div style={{ opacity: 0.6, fontSize: 10 }}>📋 Admin</div>}
                        {mine && !adminMode && (
                          <button onClick={e => { e.stopPropagation(); handleCancelMine(h); }} style={S.btnDanger}>Ακύρωση</button>
                        )}
                        {adminMode && (
                          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 4 }}>
                            <span style={{ fontSize: 10, color: "#7a4f00", background: "rgba(255,200,0,0.2)", borderRadius: 4, padding: "2px 6px" }}>✏️ Επεξεργασία</span>
                          </div>
                        )}
                      </div>
                    )}

                    {!booked && adminMode && (
                      <div style={{ fontSize: 10, marginTop: 3, color: "#2d6a4f", opacity: 0.7 }}>+ Προσθήκη</div>
                    )}

                    {sel && !booked && !adminMode && <div style={{ fontSize: 10, marginTop: 3 }}>✓ Επιλεγμένο</div>}
                  </button>
                );
              })}
            </div>}

            {error && <div style={S.error}>⚠️ {error}</div>}

            {/* Legend */}
            <div style={{ display: "flex", gap: 10, marginTop: 14, fontSize: 11, color: "#666", flexWrap: "wrap" }}>
              {(adminMode
                ? [["#f0fff4","#74c69d","Διαθέσιμο"],["#fff3cd","#e6a817","Κλεισμένο"],["#d8f3dc","#2d6a4f","Δική μου"]]
                : [["#f8faf8","#d0e8d0","Διαθέσιμο"],["#fde8e8","#e5a0a0","Κλεισμένο"],["#d8f3dc","#2d6a4f","Δική μου"],["#2d6a4f","#1b4332","Επιλεγμένο"]]
              ).map(([bg, br, label]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1.5px solid ${br}`, display: "inline-block" }} />
                  {label}
                </span>
              ))}
            </div>

            {selectedSlot !== null && !adminMode && (
              <div style={{ marginTop: 16, background: "#f0f8f2", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ margin: "0 0 6px", fontSize: 14, color: "#1b4332" }}>
                  Επιλογή: <strong>{slotLabel(selectedSlot)}</strong>
                </p>
                <button onClick={handleBook} style={S.btn}>
                  {user ? "Κράτηση →" : "🔵 Σύνδεση & Κράτηση →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* USER CONFIRM */}
        {step === "confirm" && (
          <div style={S.card}>
            <p style={S.cardTitle}>📋 Επιβεβαίωση κράτησης</p>
            <div style={{ background: "#f0f8f2", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={S.avatar}>{user?.name[0]}</div>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 15 }}>{user?.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{user?.email}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, color: "#1b4332" }}>
                📅 {formatDate(selectedDate)}<br />
                🕐 {slotLabel(selectedSlot)}
              </div>
            </div>
            <label style={S.label}>👤 Όνομα 2ου παίκτη <span style={{ fontWeight: "normal", color: "#999" }}>(προαιρετικό)</span></label>
            <input value={partnerName} onChange={e => setPartnerName(e.target.value)} placeholder="π.χ. Κώστας Νικολάου" style={S.input} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep("slots")} style={{ ...S.btnOutline, flex: 1 }}>← Πίσω</button>
              <button onClick={handleConfirm} style={{ ...S.btn, flex: 2, marginTop: 0 }}>✅ Επιβεβαίωση</button>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {step === "success" && lastBooking && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#1b4332" }}>Η κράτηση έγινε!</h3>
            <div style={{ ...S.success, textAlign: "left" }}>
              📅 {formatDate(lastBooking.date)}<br />
              🕐 {slotLabel(lastBooking.slot)}<br />
              👤 {lastBooking.name}
              {lastBooking.partner && <><br />👤 {lastBooking.partner}</>}
            </div>
            <p style={{ fontSize: 13, color: "#666", marginTop: 10 }}>💡 Μπορείτε να κλείσετε ξανά μόνο αφού παίξετε.</p>
            <button onClick={() => setStep("slots")} style={{ ...S.btn, marginTop: 8 }}>Πίσω στο πρόγραμμα</button>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showLogin && <GoogleLoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />}

      {adminModal && (
        <AdminBookingModal
          slot={adminModal.slot}
          date={selectedDate}
          existing={adminModal.existing}
          onSave={(data) => adminSaveBooking(adminModal.slot, data)}
          onCancel={() => { adminCancel(adminModal.slot); setAdminModal(null); }}
          onClose={() => setAdminModal(null)}
        />
      )}
    </div>
  );
}
