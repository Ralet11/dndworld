import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PlayerBoard from './pages/PlayerBoard';
import DMAdmin from './pages/DMAdmin';
import LoginPage from './pages/LoginPage';


import API_URL from './config';

const socket = io(API_URL);

function App() {
  const [partyStats, setPartyStats] = useState([]);
  const [sharedMedia, setSharedMedia] = useState([]);
  const [partyPosition, setPartyPosition] = useState({ x: 50, y: 50 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socket.on('init', (data) => {
      setPartyStats(data.partyStats);
      setSharedMedia(data.sharedMedia);
      setPartyPosition(data.partyPosition || { x: 50, y: 50 });
      setLoading(false);
    });

    socket.on('image-shared', (image) => {
      setSharedMedia((prev) => [image, ...prev]);
    });

    socket.on('image-sharing-stopped', () => {
      setSharedMedia([]);
    });

    socket.on('stats-updated', (newStats) => {
      setPartyStats(newStats);
    });

    socket.on('party-position-updated', (pos) => {
      setPartyPosition(pos);
    });

    return () => {
      socket.off('init');
      socket.off('image-shared');
      socket.off('image-sharing-stopped');
      socket.off('stats-updated');
      socket.off('party-position-updated');
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-accent-gold border-t-transparent rounded-full animate-spin"></div>
        <div className="text-accent-gold font-black tracking-[0.3em] animate-pulse">CARGANDO AVENTURA...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen text-slate-100 font-inter">
        <Routes>
          <Route path="/" element={<MainWrapper partyStats={partyStats} sharedMedia={sharedMedia} partyPosition={partyPosition} socket={socket} />} />
          <Route path="/dm" element={<DMAdmin partyStats={partyStats} sharedMedia={sharedMedia} partyPosition={partyPosition} socket={socket} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

// Wrapper component to handle Login vs Board logic
function MainWrapper({ partyStats, sharedMedia, partyPosition, socket }) {
  const [myCharacterId, setMyCharacterId] = useState(() => {
    return localStorage.getItem('dnd_character_id') || null;
  });

  const handleSelectCharacter = (id) => {
    setMyCharacterId(id);
    localStorage.setItem('dnd_character_id', id);
  };

  const handleLogout = () => {
    localStorage.removeItem('dnd_character_id');
    setMyCharacterId(null);
  };

  // If no character selected, show login
  if (!myCharacterId) {
    return <LoginPage characters={partyStats} onSelect={handleSelectCharacter} />;
  }

  // Find the selected character object
  const myCharacter = partyStats.find(c => c.id.toString() === myCharacterId.toString());

  // Safety: If character not found (e.g. ID from bad localStorage), reset and show login
  if (!myCharacter && partyStats.length > 0) {
    return <LoginPage characters={partyStats} onSelect={handleSelectCharacter} />;
  }

  // Wait until we have the character data
  if (!myCharacter) return null;

  return (
    <PlayerBoard
      sharedMedia={sharedMedia}
      character={myCharacter}
      partyPosition={partyPosition}
      socket={socket}
      onLogout={handleLogout}
    />
  );
}

export default App;
