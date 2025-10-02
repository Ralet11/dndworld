import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import CreateCharacter from '../CreateCharacter'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../../api/client', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}))

describe('CreateCharacter', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockNavigate.mockReset()
  })

  const setupWizard = async () => {
    mockGet.mockResolvedValueOnce({ data: [
      { id: 1, name: 'Humano', description: 'Versátil' },
    ] })
    mockGet.mockResolvedValueOnce({ data: [
      { id: 10, name: 'Guerrero', description: 'Tanque' },
    ] })

    const user = userEvent.setup()
    render(<CreateCharacter />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))

    await user.click(screen.getByRole('button', { name: /humano/i }))
    await user.click(screen.getByRole('button', { name: /siguiente/i }))

    await user.click(screen.getByRole('button', { name: /guerrero/i }))
    await user.click(screen.getByRole('button', { name: /siguiente/i }))

    await user.type(screen.getByLabelText(/nombre/i), 'Aria')
    await user.type(screen.getByLabelText(/objetivo a corto plazo/i), 'Recuperar la reliquia')
    await user.type(screen.getByLabelText(/objetivo a largo plazo/i), 'Derrotar al dragón')

    return user
  }

  it('navigates after successful creation', async () => {
    const user = await setupWizard()

    mockPost.mockImplementation((url) => {
      if (url === '/characters') {
        return Promise.resolve({ data: { characterId: 7, deckId: 3 } })
      }
      return Promise.resolve({ data: {} })
    })

    await user.click(screen.getByRole('button', { name: /confirmar y crear/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/characters', expect.any(Object))
      expect(mockNavigate).toHaveBeenCalledWith('/personajes/7/oferta')
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows error message when limit is reached', async () => {
    const user = await setupWizard()

    mockPost.mockImplementation((url) => {
      if (url === '/characters') {
        return Promise.reject({
          response: {
            status: 400,
            data: { error: 'Ya alcanzaste el máximo de 3 personajes.' },
          },
        })
      }
      return Promise.resolve({ data: {} })
    })

    await user.click(screen.getByRole('button', { name: /confirmar y crear/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/characters', expect.any(Object))
    })

    expect(mockNavigate).not.toHaveBeenCalled()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ya alcanzaste el máximo de 3 personajes.')
  })
})
