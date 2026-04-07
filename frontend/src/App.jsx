import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import GamesGrid from './components/GamesGrid';
import Footer from './components/Footer';
import BlackjackGame from './components/games/BlackjackGame';
import RoomsIndex from './components/rooms/RoomsIndex';
import RoomPage from './components/rooms/RoomPage';
import JudgementRooms from './components/rooms/JudgementRooms';
import JudgementRoomPage from './components/rooms/JudgementRoomPage';
import JudgementScorer from './components/games/JudgementScorer';

function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <GamesGrid />
      </main>
      <Footer />
    </>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/games/blackjack" element={<BlackjackGame />} />
        <Route path="/rooms" element={<RoomsIndex />} />
        <Route path="/rooms/:code" element={<RoomPage />} />
        <Route path="/games/judgement" element={<JudgementRooms />} />
        <Route path="/games/judgement/scorer" element={<JudgementScorer />} />
        <Route path="/games/judgement/:code" element={<JudgementRoomPage />} />
      </Routes>
    </Router>
  );
}

export default App;
