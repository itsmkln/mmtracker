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
      
      // Heartbeat: Log login activity to prevent Supabase pausing
      await supabase.from('activity_log').insert([{ 
        event_type: 'login', 
        user_agent: navigator.userAgent 
      }]);
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
    if (error) {
      alert('Błąd bazy: ' + error.message);
    } else {
      // Heartbeat: Log trip addition activity
      await supabase.from('activity_log').insert([{ 
        event_type: `trip_added_${driver.toLowerCase()}`, 
        user_agent: navigator.userAgent 
      }]);
    }
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

  if (loading) return <div className="loading">Wchodzę do garażu...</div>;

  if (!isAuthorized) {
    return (
      <div className="app-container auth-screen">
        <div className="card">
          <Lock size={48} className="auth-icon" />
          <h2>Zaloguj się</h2>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Hasło dostępowe"
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
    const diffInHours = (now - tripTime) / (1000 * 60 * 60);
    return diffInHours <= 12; // Zmienione na 12 godzin
  };

  const nextPerson = getNextTurn();
  const limitReached = tripsToday.length >= 2;
  const today = new Date();
  const isCurrentMonth = currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear();

  return (
    <div className="app-container">
      <header>
        <h1>DRIVE TRACKER</h1>
      </header>

      <div className="card main-card">
        <div className="next-turn-box">
          <div className="next-label">TERAZ KOLEJ NA:</div>
          <div className={`next-name ${nextPerson.toLowerCase()}`}>{nextPerson}</div>
        </div>

        <div className="registration-section">
          <h2 className="section-title">
            {limitReached ? 'LIMIT WYJAZDÓW OSIĄGNIĘTY' : 'KTO DZISIAJ POJECHAŁ?'}
          </h2>
          
          {limitReached ? (
            <div className="limit-msg">
              <AlertCircle size={20} />
              <span>Zrobiliście już oba wyjazdy!</span>
            </div>
          ) : (
            <div className="actions main-actions">
              <button className="maciej-btn" onClick={() => addTrip('Maciej')}>Maciej</button>
              <button className="michal-btn" onClick={() => addTrip('Michał')}>Michał</button>
            </div>
          )}
          <div className="daily-counter">Dzisiaj: <strong>{tripsToday.length}</strong> / 2</div>
        </div>

        <button 
          className="calendar-toggle"
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        >
          {isCalendarOpen ? 'Ukryj kalendarz' : 'Widok kalendarza'}
        </button>

        {isCalendarOpen && (
          <div className="calendar-section">
            <div className="calendar-header">
              <button onClick={() => setCurrentMonth(new Date(year, month - 1))}><ChevronLeft size={20}/></button>
              <h3>{currentMonth.toLocaleString('pl-PL', { month: 'long', year: 'numeric' })}</h3>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1))}><ChevronRight size={20}/></button>
            </div>
            
            <div className="calendar-grid">
              {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map(d => <div key={d} className="weekday">{d}</div>)}
              {emptyDays.map(i => <div key={`e-${i}`} className="day empty"></div>)}
              {daysArray.map(day => {
                const dayTrips = getTripsForDay(day);
                const isToday = isCurrentMonth && day === today.getDate();
                return (
                  <div key={day} className={`day ${isToday ? 'today' : ''}`}>
                    <span className="day-number">{day}</span>
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
              <span className="legend-item"><div className="dot yellow"></div> Michał</span>
            </div>
          </div>
        )}

        <div className="history">
          <h3><History size={14} /> Ostatnie wyjazdy:</h3>
          <div className="history-list">
            {trips.slice(0, 5).map((trip, index) => (
              <div key={trip.id} className="history-item">
                <div className="history-main-info">
                  <div className="history-name-box">
                    <User size={12} /> 
                    <span className={trip.driver.toLowerCase()}>{trip.driver}</span>
                  </div>
                  <span className="history-date">
                    {new Date(trip.created_at).toLocaleDateString('pl-PL', {day:'2-digit', month:'2-digit'})}
                    {' '}{new Date(trip.created_at).toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit'})}
                  </span>
                </div>
                {index === 0 && canUndo(trip.created_at) && (
                  <button 
                    className="undo-btn" 
                    onClick={() => deleteTrip(trip.id)}
                    title="Cofnij ten wyjazd"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
