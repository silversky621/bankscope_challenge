import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import {ModalProvider} from "./context/ModalContext.jsx";

createRoot(document.getElementById('root')).render(

    <BrowserRouter>
        <ModalProvider>
        <AuthProvider>
                  <App />
        </AuthProvider>
        </ModalProvider>
    </BrowserRouter>

)
