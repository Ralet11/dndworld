import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Landing from './pages/Landing.jsx'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'

import Characters from './pages/characters/Characters.jsx'
import CreateCharacter from './pages/characters/CreateCharacter.jsx'
import CharacterDetail from './pages/characters/CharacterDetail.jsx'
import TalentTree from './pages/characters/TalentTree.jsx'
import DeckManager from './pages/characters/DeckManager.jsx'
import OfferPicker from './pages/characters/OfferPicker.jsx'
import Inventory from './pages/characters/Inventory.jsx'

import Campaigns from './pages/campaigns/Campaigns.jsx'
import CampaignDetail from './pages/campaigns/CampaignDetail.jsx'
import CampaignCreate from './pages/campaigns/CampaignCreate.jsx'
import CampaignMembers from './pages/campaigns/CampaignMembers.jsx'

import DMTools from './pages/dm/DMTools.jsx'
import Scenarios from './pages/dm/Scenarios.jsx'
import ScenarioDetail from './pages/dm/ScenarioDetail.jsx'

import SessionBoard from './pages/session/SessionBoard.jsx'

import NPCs from './pages/dm/NPCs.jsx'
import Items from './pages/dm/Items.jsx'
import Quests from './pages/dm/Quests.jsx'
import NpcCreate from './pages/dm/NpcCreate.jsx'
import NpcDetail from './pages/dm/NpcDetail.jsx'
import NpcEdit from './pages/dm/NpcEdit.jsx'

import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { RoleGate } from './components/RoleGate.jsx'
import useAuth from './store/useAuth.js'

export default function App(){
  const { isAuthed } = useAuth()
  return (
    <Routes>
      <Route path="/" element={isAuthed ? <Layout /> : <Landing />}>
        <Route index element={<Home />} />
        <Route path="perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Personajes */}
        <Route path="personajes" element={<ProtectedRoute><Characters /></ProtectedRoute>} />
        <Route path="personajes/crear" element={<ProtectedRoute><CreateCharacter /></ProtectedRoute>} />
        <Route path="personajes/:id" element={<ProtectedRoute><CharacterDetail /></ProtectedRoute>} />
        <Route path="personajes/:id/talentos" element={<ProtectedRoute><TalentTree /></ProtectedRoute>} />
        <Route path="personajes/:id/mazo" element={<ProtectedRoute><DeckManager /></ProtectedRoute>} />
        <Route path="personajes/:id/oferta" element={<ProtectedRoute><OfferPicker /></ProtectedRoute>} />
        <Route path="personajes/:id/inventario" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />

        {/* Campañas */}
        <Route path="campanias" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
        <Route path="campanias/crear" element={<ProtectedRoute><RoleGate role="DM"><CampaignCreate /></RoleGate></ProtectedRoute>} />
        <Route path="campanias/:id" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
        <Route path="campanias/:id/miembros" element={<ProtectedRoute><RoleGate role="DM"><CampaignMembers /></RoleGate></ProtectedRoute>} />

        {/* DM */}
        <Route path="dm" element={<ProtectedRoute><RoleGate role="DM"><DMTools /></RoleGate></ProtectedRoute>} />
        <Route path="dm/campanias/:id/escenarios" element={<ProtectedRoute><RoleGate role="DM"><Scenarios /></RoleGate></ProtectedRoute>} />
        <Route path="dm/escenarios/:id" element={<ProtectedRoute><RoleGate role="DM"><ScenarioDetail /></RoleGate></ProtectedRoute>} />
        <Route path="dm/npcs" element={<ProtectedRoute><RoleGate role="DM"><NPCs /></RoleGate></ProtectedRoute>} />
        <Route path="dm/npcs/nuevo" element={<ProtectedRoute><RoleGate role="DM"><NpcCreate /></RoleGate></ProtectedRoute>} />
        <Route path="dm/npcs/:id" element={<ProtectedRoute><RoleGate role="DM"><NpcDetail /></RoleGate></ProtectedRoute>} />
        <Route path="dm/npcs/:id/editar" element={<ProtectedRoute><RoleGate role="DM"><NpcEdit /></RoleGate></ProtectedRoute>} />
        <Route path="dm/items" element={<ProtectedRoute><RoleGate role="DM"><Items /></RoleGate></ProtectedRoute>} />
        <Route path="dm/quests" element={<ProtectedRoute><RoleGate role="DM"><Quests /></RoleGate></ProtectedRoute>} />

        {/* Sesión */}
        <Route path="sesion/:id" element={<ProtectedRoute><SessionBoard /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

