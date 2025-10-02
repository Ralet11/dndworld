import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Characters from '../Characters'
import { vi } from 'vitest'

const mockGet = vi.fn()

vi.mock('../../../api/client', () => ({
  default: {
    get: mockGet,
  },
}))

describe('Characters page', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('shows the create button when below the limit', async () => {
    mockGet.mockResolvedValueOnce({ data: [
      { id: 1, Creature: { name: 'A', level: 1 } },
      { id: 2, Creature: { name: 'B', level: 1 } },
    ] })

    render(
      <MemoryRouter>
        <Characters />
      </MemoryRouter>
    )

    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    const createLink = screen.getByRole('link', { name: /crear personaje/i })
    expect(createLink).toBeInTheDocument()
    expect(createLink).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('disables creation when limit is reached', async () => {
    mockGet.mockResolvedValueOnce({ data: [
      { id: 1, Creature: { name: 'A', level: 1 } },
      { id: 2, Creature: { name: 'B', level: 1 } },
      { id: 3, Creature: { name: 'C', level: 1 } },
    ] })

    render(
      <MemoryRouter>
        <Characters />
      </MemoryRouter>
    )

    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    expect(screen.getByRole('button', { name: /crear personaje/i })).toBeDisabled()
    expect(
      screen.getByText(/solo podés tener 3 personajes activos/i)
    ).toBeInTheDocument()
  })
})
