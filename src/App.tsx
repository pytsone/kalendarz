import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { CalendarDays, ChevronLeft, ChevronRight, CirclePlus, Cloud, Heart, LogOut, Sparkles, Users, X } from 'lucide-react';

type EventItem = { id: string; family_id: string; title: string; details: string | null; event_date: string; created_by: string; created_at: string };
type Family = { id: string; name: string; invite_code: string };
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const weekdays = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];
const palette = ['peach', 'lilac', 'mint', 'yellow', 'blue'];
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthLabel = (date: Date) => new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(date);

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(dateKey(new Date()));
  const [modal, setModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [invite, setInvite] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, current) => setSession(current));
    return () => subscription.unsubscribe();
  }, []);

  const loadFamily = useCallback(async () => {
    if (!supabase || !session) { setFamily(null); return; }
    const { data, error: loadError } = await supabase.from('family_members').select('families(id,name,invite_code)').eq('user_id', session.user.id).maybeSingle();
    if (loadError) { setError(loadError.message); return; }
    const joined = data?.families as unknown as Family | null;
    setFamily(joined ?? null);
  }, [session]);

  useEffect(() => { void loadFamily(); }, [loadFamily]);
  const loadEvents = useCallback(async () => {
    if (!supabase || !family) { setEvents([]); return; }
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const { data, error: loadError } = await supabase.from('calendar_events').select('*').eq('family_id', family.id).gte('event_date', dateKey(start)).lte('event_date', dateKey(end)).order('created_at');
    if (loadError) setError(loadError.message); else setEvents((data ?? []) as EventItem[]);
  }, [family, month]);
  useEffect(() => { void loadEvents(); }, [loadEvents]);
  useEffect(() => {
    if (!supabase || !family) return;
    const channel = supabase.channel(`family-calendar-${family.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events', filter: `family_id=eq.${family.id}` }, () => { void loadEvents(); }).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [family, loadEvents]);

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const count = Math.ceil((offset + days) / 7) * 7;
    return Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1));
  }, [month]);
  const dayEvents = events.filter((event) => event.event_date === selectedDay);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget); const email = String(form.get('email')); const password = String(form.get('password'));
    const result = authMode === 'signup' ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError(result.error.message);
    else if (authMode === 'signup' && !result.data.session) setNotice('Sprawdź skrzynkę — wysłaliśmy link potwierdzający konto.');
    setBusy(false);
  }
  async function createFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setError('');
    const name = String(new FormData(event.currentTarget).get('family')).trim();
    const { error: rpcError } = await supabase.rpc('create_family', { family_name: name });
    if (rpcError) setError(rpcError.message); else { setNotice('Rodzinny kalendarz gotowy!'); await loadFamily(); }
    setBusy(false);
  }
  async function joinFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setError('');
    const { error: rpcError } = await supabase.rpc('join_family', { code: invite.trim().toUpperCase() });
    if (rpcError) setError(rpcError.message); else { setNotice('Dołączono do rodzinnego kalendarza!'); await loadFamily(); }
    setBusy(false);
  }
  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !family) return;
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const { error: insertError } = await supabase.from('calendar_events').insert({ family_id: family.id, title: String(form.get('title')).trim(), details: String(form.get('details')).trim() || null, event_date: selectedDay, created_by: session?.user.id });
    if (insertError) setError(insertError.message); else { setModal(false); void loadEvents(); }
    setBusy(false);
  }
  async function deleteEvent(id: string) {
    if (!supabase || !window.confirm('Usunąć ten wpis?')) return;
    const { error: deleteError } = await supabase.from('calendar_events').delete().eq('id', id);
    if (deleteError) setError(deleteError.message); else void loadEvents();
  }
  async function copyInvite() {
    if (!family) return;
    await navigator.clipboard.writeText(family.invite_code);
    setNotice('Skopiowano kod zaproszenia. Wyślij go drugiej osobie.');
  }
  const todayKey = dateKey(new Date());

  if (!supabase) return <main className="setup-screen"><div className="setup-card"><div className="brand-mark"><Heart size={25} fill="currentColor" /></div><p className="eyebrow">WASZ MAŁY WSPÓLNY ŚWIAT</p><h1>Nasz kalendarz</h1><p>Aby włączyć synchronizację między telefonami, połącz aplikację z bezpłatną bazą Supabase.</p><ol><li>Utwórz projekt na <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.</li><li>Wykonaj instrukcje z pliku <code>supabase/schema.sql</code>.</li><li>Skopiuj <code>.env.example</code> do <code>.env</code> i uzupełnij dane projektu.</li><li>Uruchom aplikację ponownie poleceniem <code>npm run dev</code>.</li></ol><p className="small-note">Dzięki logowaniu i uprawnieniom tylko osoby z zaproszeniem zobaczą wspólny kalendarz.</p></div></main>;

  if (!session) return <main className="setup-screen"><div className="setup-card auth-card"><div className="brand-mark"><Heart size={25} fill="currentColor" /></div><p className="eyebrow">WASZ MAŁY WSPÓLNY ŚWIAT</p><h1>Nasz kalendarz</h1><p>Zalogujcie się na dwóch telefonach, aby wspólnie planować każdy dzień.</p><form onSubmit={submitAuth} className="stack-form"><label>E-mail<input type="email" name="email" autoComplete="email" placeholder="ty@przyklad.pl" required /></label><label>Hasło<input type="password" name="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={6} placeholder="Co najmniej 6 znaków" required /></label><button className="primary-button" disabled={busy}>{busy ? 'Chwileczkę…' : authMode === 'signup' ? 'Utwórz konto' : 'Zaloguj się'}</button></form><button className="text-button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setError(''); }}>{authMode === 'signup' ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Utwórz je'}</button>{error && <p className="error-message">{error}</p>}{notice && <p className="notice-message">{notice}</p>}</div></main>;

  if (!family) return <main className="setup-screen"><div className="setup-card"><div className="brand-mark"><Users size={25} /></div><p className="eyebrow">CZEŚĆ, MIŁO WAS WIDZIEĆ</p><h1>Połączcie kalendarze</h1><p>Jedna osoba tworzy rodzinny kalendarz i wysyła kod drugiej osobie.</p><form className="stack-form" onSubmit={createFamily}><label>Nazwa rodziny<input name="family" placeholder="np. Rodzina Kowalskich" required maxLength={60} /></label><button className="primary-button" disabled={busy}>Utwórz kalendarz</button></form><div className="divider"><span>albo dołącz z kodem</span></div><form className="stack-form" onSubmit={joinFamily}><label>Kod zaproszenia<input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="np. AB12CD34" required /></label><button className="secondary-button" disabled={busy}>Dołącz do rodziny</button></form><button className="text-button" onClick={() => void supabase.auth.signOut()}>Wyloguj</button>{error && <p className="error-message">{error}</p>}{notice && <p className="notice-message">{notice}</p>}</div></main>;

  return <main className="app-shell"><header className="topbar"><a className="brand" href="#"><span className="brand-mark small"><Heart size={19} fill="currentColor" /></span><span>Nasz kalendarz<small>{family.name}</small></span></a><div className="top-actions"><button className="invite-button" onClick={() => void copyInvite()}><Users size={17} /><span>Kod dla bliskich</span></button><button className="icon-button" aria-label="Wyloguj" title="Wyloguj" onClick={() => void supabase.auth.signOut()}><LogOut size={18} /></button></div></header>
    <section className="welcome-row"><div><p className="eyebrow"><Sparkles size={14} /> RAZEM ŁATWIEJ ZAPLANOWAĆ</p><h1>Witajcie w domu <span>♡</span></h1><p>Wasze plany, zawsze pod ręką.</p></div><div className="cloud-pill"><span className="online-dot" /><Cloud size={16} /> Synchronizacja włączona</div></section>
    <div className="content-grid"><section className="calendar-card"><div className="calendar-heading"><div><p className="eyebrow">RODZINNE PLANY</p><h2>{monthLabel(month)}</h2></div><div className="month-controls"><button className="icon-button" aria-label="Poprzedni miesiąc" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={20} /></button><button className="today-button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(dateKey(now)); }}>Dziś</button><button className="icon-button" aria-label="Następny miesiąc" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={20} /></button></div></div><div className="calendar-grid weekday-row">{weekdays.map((day) => <div key={day}>{day}</div>)}</div><div className="calendar-grid day-grid">{calendarDays.map((day, index) => { const key = dateKey(day); const items = events.filter((item) => item.event_date === key); const inMonth = day.getMonth() === month.getMonth(); return <button key={`${key}-${index}`} className={`day-cell ${inMonth ? '' : 'outside'} ${key === selectedDay ? 'selected' : ''} ${key === todayKey ? 'today' : ''}`} onClick={() => setSelectedDay(key)}><span className="day-number">{day.getDate()}</span>{items.length > 0 && <span className="event-dots">{items.slice(0, 3).map((item, i) => <i key={item.id} className={palette[i % palette.length]} />)}{items.length > 3 && <b>+{items.length - 3}</b>}</span>}</button>; })}</div><div className="calendar-footer"><span className="legend-dot peach" /> <span>Wspólne chwile</span><span className="footer-note">Zmiany pojawiają się na obu telefonach</span></div></section>
    <aside className="agenda-card"><div className="agenda-heading"><div><p className="eyebrow">PLAN DNIA</p><h2>{new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selectedDay}T12:00:00`))}</h2></div><button className="add-button" onClick={() => { setError(''); setModal(true); }} aria-label="Dodaj wpis"><CirclePlus size={19} /><span>Dodaj</span></button></div><div className="agenda-list">{dayEvents.length ? dayEvents.map((item, i) => <article className={`event-card ${palette[i % palette.length]}`} key={item.id}><div className="event-time">RODZINNY WPIS</div><div className="event-title-row"><h3>{item.title}</h3><button className="delete-button" onClick={() => void deleteEvent(item.id)} aria-label="Usuń wpis"><X size={16} /></button></div>{item.details && <p>{item.details}</p>}</article>) : <div className="empty-state"><div className="empty-illustration"><CalendarDays size={28} /></div><h3>Ten dzień jest wolny</h3><p>Dodajcie coś miłego do wspólnego planu.</p><button className="text-button" onClick={() => setModal(true)}>+ Dodaj pierwszy wpis</button></div>}</div><div className="love-note"><Heart size={16} fill="currentColor" /><span>Najlepsze plany to te razem.</span></div></aside></div>
    <footer className="app-footer"><span>Stworzone z myślą o Was <Heart size={13} fill="currentColor" /></span><span><span className="online-dot" /> Bezpieczny kalendarz rodzinny</span></footer>
    {error && <div className="toast error-toast" role="alert">{error}<button onClick={() => setError('')} aria-label="Zamknij"><X size={16} /></button></div>}{notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Zamknij"><X size={16} /></button></div>}
    {modal && <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" onClick={() => setModal(false)} aria-label="Zamknij"><X size={20} /></button><p className="eyebrow">MAŁY PLAN, WIELKA RADOŚĆ</p><h2 id="modal-title">Dodaj wpis</h2><p className="modal-date">{new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selectedDay}T12:00:00`))}</p><form className="stack-form" onSubmit={saveEvent}><label>Co planujecie?<input name="title" placeholder="np. Wspólne śniadanie" maxLength={100} required autoFocus /></label><label>Szczegóły <span className="optional">(opcjonalnie)</span><textarea name="details" placeholder="Godzina, miejsce albo mała notatka…" rows={3} maxLength={500} /></label><button className="primary-button" disabled={busy}>{busy ? 'Zapisuję…' : 'Zapisz w kalendarzu'}</button></form></section></div>}
  </main>;
}
