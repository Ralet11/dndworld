// app/src/router/index.jsx
import { createBrowserRouter, redirect } from 'react-router-dom'
import RootLayout from '../layouts/RootLayout'
import SessionLayout from '../layouts/SessionLayout'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import HomePage from '../pages/HomePage'
import ProfilePage from '../pages/ProfilePage'
import DMView from '../pages/DMView'
import DMToolsPage from '../pages/dm/DMToolsPage'
import PlayerView from '../pages/PlayerView'
import PlayerCharactersPage from '../pages/player/PlayerCharactersPage'
import { DMEntryPage, PlayerEntryPage } from '../pages/SessionEntryPage'
import { useSessionStore } from '../store/useSessionStore'

const requireAuthLoader = async ({ request }) => {
  const url = new URL(request.url)
  const isAuthenticated = useSessionStore.getState().isAuthenticated()

  if (!isAuthenticated) {
    const redirectTo = url.pathname + url.search
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
  }

  return null
}

const ensureModeLoader = (mode) => async (args) => {
  await requireAuthLoader(args)
  const activeMode = useSessionStore.getState().session.activeMode ?? 'dm'
  if (activeMode !== mode) {
    const fallback = mode === 'dm' ? '/player' : '/dm'
    throw redirect(fallback)
  }
  return null
}

const requireDmLoader = ensureModeLoader('dm')
const requirePlayerLoader = ensureModeLoader('player')

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'dm',
        loader: requireDmLoader,
        element: <DMEntryPage />,
      },
      {
        path: 'player',
        loader: requirePlayerLoader,
        element: <PlayerEntryPage />,
      },
      {
        path: 'player/campaigns',
        loader: requirePlayerLoader,
        element: <PlayerEntryPage />,
      },
      {
        path: 'player/characters',
        loader: requirePlayerLoader,
        element: <PlayerCharactersPage />,
      },
      {
        path: 'profile',
        loader: requireAuthLoader,
        element: <ProfilePage />,
      },
    ],
  },
  {
    path: '/session/:campaignId',
    loader: requireAuthLoader,
    element: <SessionLayout />,
    children: [
      {
        index: true,
        loader: requirePlayerLoader,
        element: <PlayerView />,
      },
      {
        path: 'dm',
        loader: requireDmLoader,
        element: <DMView />,
      },
      {
        path: 'tools',
        loader: requireDmLoader,
        element: <DMToolsPage />,
      },
      {
        path: 'player',
        loader: requirePlayerLoader,
        element: <PlayerView />,
      },
    ],
  },
])
