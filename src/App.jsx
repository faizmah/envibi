import { AuthProvider } from './app/providers/AuthProvider'
import { UIProvider } from './app/providers/UIProvider'
import AppRouter from './app/router'
import './styles/global.css'

export default function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </UIProvider>
  )
}
