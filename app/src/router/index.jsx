import { createBrowserRouter } from 'react-router-dom'
import RootLayout from '../layouts/RootLayout'
import HomePage from '../pages/HomePage'
import DMView from '../pages/DMView'
import PlayerView from '../pages/PlayerView'

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
        element: <DMView />,
      },
      {
        path: 'player',
        element: <PlayerView />,
      },
    ],
  },
])
