import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Utensils, Dumbbell, History, User } from 'lucide-react';
import './App.css';

type TripType = 'mcdonalds' | 'gym';
type Driver = 'maciej' | 'michal';

interface Trip {
  id: string;
  created_at: string;
  type: TripType;
  driver: Driver;
}

function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Real-time subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => {
          fetchTrips();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addTrip = async (type: TripType, driver: Driver) => {
    const { error } = await supabase
      .from('trips')
      .insert([{ type, driver }]);

    if (error) {
      alert('Błąd podczas zapisywania: ' + error.message);
    }
  };

  const getNextTurn = (type: TripType) => {
    const lastTrip = trips.find(t => t.type === type);
    if (!lastTrip) return 'maciej'; // Domyślnie zaczyna Maciej
    return lastTrip.driver === 'maciej' ? 'Michał' : 'Maciej';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const TrackerCard = ({ type, title, icon: Icon, accentClass }: { 
    type: TripType, 
    title: string, 
    icon: any, 
    accentClass: string 
  }) => {
    const next = getNextTurn(type);
    const typeTrips = trips.filter(t => t.type === type).slice(0, 3);

    return (
      <div className={`card ${accentClass}`}>
        <div className="card-header">
          <Icon size={24} color={`var(--accent-${accentClass})`} />
          <h2>{title}</h2>
        </div>

        <div className="next-turn-box">
          <div className="next-label">TERAZ KOLEJ</div>
          <div className="next-name">{next}</div>
        </div>

        <div className="actions">
          <button className="maciej" onClick={() => addTrip(type, 'maciej')}>
            Ja (Maciej)
          </button>
          <button className="michal" onClick={() => addTrip(type, 'michal')}>
            Michał
          </button>
        </div>

        <div className="history">
          <h3><History size={14} style={{ marginRight: 4 }} /> Ostatnie wyjazdy:</h3>
          <div className="history-list">
            {typeTrips.length === 0 && <div className="history-item">Brak historii</div>}
            {typeTrips.map(trip => (
              <div key={trip.id} className="history-item">
                <span className="history-name">
                  <User size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {trip.driver}
                </span>
                <span className="history-date">{formatDate(trip.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="loading">Ładowanie danych...</div>;

  return (
    <div className="app-container">
      <header>
        <h1>DRIVE TRACKER</h1>
      </header>

      <TrackerCard 
        type="mcdonalds" 
        title="McDonald's" 
        icon={Utensils} 
        accentClass="mcd" 
      />

      <TrackerCard 
        type="gym" 
        title="Siłownia" 
        icon={Dumbbell} 
        accentClass="gym" 
      />
    </div>
  );
}

export default App;
