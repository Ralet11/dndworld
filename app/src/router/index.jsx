import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '../layouts/RootLayout'
import SessionLayout from '../layouts/SessionLayout'
import HomePage from '../pages/HomePage'
import DMView from '../pages/DMView'
import PlayerView from '../pages/PlayerView'
import { DMEntryPage, PlayerEntryPage } from '../pages/SessionEntryPage'

export const router = createBrowserRouter([
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
        element: <DMEntryPage />,
      },
      {
        path: 'player',
        element: <PlayerEntryPage />,
      },
    ],
  },
  {
    path: '/session/:campaignId',
    element: <SessionLayout />,
    children: [
      {
        index: true,
        element: <PlayerView />,
      },
      {
        path: 'dm',
        element: <DMView />,
      },
      {
        path: 'player',
        element: <PlayerView />,
      },
    ],
  },
])
