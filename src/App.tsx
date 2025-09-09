import { supabase } from './lib/supabase'

function App() {
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
            <p className="text-gray-600 mb-4">
              Supabase connected: {supabase ? '✅' : '❌'}
            </p>
            <p className="text-sm text-gray-500">
              Ready to start building your winery management game!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
