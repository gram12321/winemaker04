import { useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-6xl font-bold text-amber-800 mb-4">
            🍷 Winery Management Game
          </h1>
          <p className="text-xl text-amber-700 max-w-2xl mx-auto">
            Welcome to your winery! Build, manage, and grow your wine empire. 
            Plant vineyards, produce wine, and build your legacy.
          </p>
        </header>
        
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <button 
              onClick={() => setCount((count) => count + 1)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Test Counter: {count}
            </button>
            <p className="mt-4 text-gray-600">
              Supabase connected: {supabase ? '✅' : '❌'}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Edit <code className="bg-gray-100 px-2 py-1 rounded">src/App.tsx</code> and save to test HMR
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
