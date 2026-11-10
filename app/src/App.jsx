import { AuthProvider } from './app/providers/AuthProvider'
import AppRouter from './app/router'
import './styles/global.css'

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
