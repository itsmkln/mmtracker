import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { History, User, ChevronLeft, ChevronRight, Lock, Trash2, AlertCircle } from 'lucide-react';
import './App.css';

type Driver = 'Maciej' | 'Michał';

interface Trip {
  id: string;
  created_at: string;
  driver: Driver;
}

function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(localStorage.getItem('mcd_auth') === 'true');

  const fetchTrips = async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trips:', error);
    } else {
      setTrips(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrips();
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => fetchTrips())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data, error } = await supabase
      .from('secrets')
      .select('value')
      .eq('name', 'access_password')
      .single();

    if (error || !data) {
      alert('Błąd połączenia z bazą haseł!');
      setLoading(false);
      return;
    }

    if (password === data.value) {
      setIsAuthorized(true);
      localStorage.setItem('mcd_auth', 'true');
    } else {
      alert('Błędne hasło!');
    }
    setLoading(false);
  };

  const addTrip = async (driver: Driver) => {
    if (tripsToday.length >= 2) {
      alert('Osiągnięto limit 2 wyjazdów na dziś!');
      return;
    }
    const { error } = await supabase.from('trips').insert([{ driver }]);
    if (error) alert('Błąd bazy: ' + error.message);
  };

  const deleteTrip = async (id: string) => {
    if (!confirm('Czy na pewno chcesz cofnąć ten wyjazd?')) return;
    const { error } = await supabase.from('trips').delete().eq('id', id);
    if (error) alert('Błąd podczas usuwania: ' + error.message);
  };

  const getNextTurn = () => {
    if (trips.length === 0) return 'Maciej';
    return trips[0].driver === 'Maciej' ? 'Michał' : 'Maciej';
  };

  const tripsToday = trips.filter(t => {
    const d = new Date(t.created_at);
    const now = new Date();
    return d.getDate() === now.getDate() && 
           d.getMonth() === now.getMonth() && 
           d.getFullYear() === now.getFullYear();
  });

  // Logika Kalendarza
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    return { days, offset, year, month };
  };

  const { days, offset, year, month } = getDaysInMonth(currentMonth);
  const daysArray = Array.from({ length: days }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: offset }, (_, i) => i);

  const getTripsForDay = (day: number) => {
    return trips.filter(t => {
      const d = new Date(t.created_at);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  if (loading) return <div className="loading">Ładowanie...</div>;

  if (!isAuthorized) {
    return (
      <div className="app-container auth-screen">
        <div className="card">
          <Lock size={48} className="auth-icon" />
          <h2>Podaj hasło</h2>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Hasło..."
              autoFocus
            />
            <button type="submit" className="maciej-btn">Odblokuj</button>
          </form>
        </div>
      </div>
    );
  }

  const canUndo = (createdAt: string) => {
    const tripTime = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diffInMinutes = (now - tripTime) / (1000 * 60);
    return diffInMinutes <= 15;
  };

  const nextPerson = getNextTurn();
  const limitReached = tripsToday.length >= 2;

  return (
    <div className="app-container">
      <header>
        <h1>DRIVE TRACKER</h1>
      </header>

      <div className="card main-card">
        <div className="next-turn-box">
          <div className="next-label">TERAZ KOLEJ</div>
          <div className="next-name">{nextPerson}</div>
        </div>

        <div className="registration-section">
          <h2 className="section-title">
            {limitReached ? 'LIMIT WYJAZDÓW OSIĄGNIĘTY' : 'KTO DZISIAJ POJECHAŁ?'}
          </h2>
          
          {limitReached ? (
            <div className="limit-msg">
              <AlertCircle size={20} />
              <span>Dziś odbyły się już 2 wyjazdy.</span>
            </div>
          ) : (
            <div className="actions main-actions">
              <button className="maciej-btn" onClick={() => addTrip('Maciej')}>Maciej</button>
              <button className="michal-btn" onClick={() => addTrip('Michał')}>Michał</button>
            </div>
          )}
          <div className="daily-counter">Wyjazdy dzisiaj: {tripsToday.length} / 2</div>
        </div>

        <button 
          className="calendar-toggle"
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        >
          {isCalendarOpen ? 'Ukryj kalendarz' : 'Pokaż kalendarz wyjazdów'}
        </button>

        {isCalendarOpen && (
          <div className="calendar-section">
            <div className="calendar-header">
              <button onClick={() => setCurrentMonth(new Date(year, month - 1))}><ChevronLeft size={20}/></button>
              <h3>{currentMonth.toLocaleString('pl-PL', { month: 'long', year: 'numeric' })}</h3>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1))}><ChevronRight size={20}/></button>
            </div>
            
            <div className="calendar-grid">
              {['Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sb', 'Nd'].map(d => <div key={d} className="weekday">{d}</div>)}
              {emptyDays.map(i => <div key={`e-${i}`} className="day empty"></div>)}
              {daysArray.map(day => {
                const dayTrips = getTripsForDay(day);
                return (
                  <div key={day} className="day">
                    {day}
                    <div className="dots">
                      {dayTrips.map(t => (
                        <div key={t.id} className={`dot ${t.driver === 'Maciej' ? 'blue' : 'yellow'}`}></div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span className="legend-item"><div className="dot blue"></div> Maciej</span>
              <span className="legend-item"><div className="dot yellow) "></div> Michał</span>
            </div>
          </div>
        )}

        <div className="history">
          <h3><History size={14} /> Historia:</h3>
          <div className="history-list">
            {trips.slice(0, 3).map((trip, index) => (
              <div key={trip.id} className="history-item">
                <span className="history-name-box">
                  <User size={12} /> {trip.driver}
                  {index === 0 && canUndo(trip.created_at) && (
                    <button 
                      className="undo-btn" 
                      onClick={() => deleteTrip(trip.id)}
                      title="Cofnij ten wyjazd"
                    >
                      <Trash2 size={14} /> Cofnij
                    </button>
                  )}
                </span>
                <span className="history-date">{new Date(trip.created_at).toLocaleDateString('pl-PL', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
