import { useState, useEffect, useCallback } from 'react'
import { Database } from 'lucide-react'
import { blink } from './blink/client'
import { Dashboard } from './components/Dashboard'
import { ImageWorkspace } from './components/ImageWorkspace'
import { ZoneManagement } from './components/ZoneManagement'
import { InventoryItems } from './components/InventoryItems'
import { ReorderCenter } from './components/ReorderCenter'
import { Navigation } from './components/Navigation'
import { DatabaseSetupNotice } from './components/DatabaseSetupNotice'
import { Button } from './components/ui/button'
import { Toaster } from './components/ui/toaster'

type Page = 'dashboard' | 'workspace' | 'zones' | 'inventory' | 'reorder'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [databaseError, setDatabaseError] = useState(false)
  const [databaseChecked, setDatabaseChecked] = useState(false)

  const checkDatabaseAvailability = useCallback(async () => {
    if (!user) return
    
    try {
      // Try a simple database query to check if database exists
      await blink.db.images.list({ where: { userId: user.id }, limit: 1 })
      setDatabaseError(false)
    } catch (error) {
      console.log('Database check error:', error)
      // Check for various database not found error patterns
      const errorMessage = error?.message || ''
      const errorCode = error?.code || ''
      const errorStatus = error?.status || 0
      
      if (errorMessage.includes('Database for project') || 
          errorMessage.includes('not found') ||
          errorMessage.includes('PGRST116') ||
          errorMessage.includes('maximum database count') ||
          errorCode === 'NETWORK_ERROR' ||
          errorCode === 'SQL_EXECUTION_ERROR' ||
          errorStatus === 404 ||
          errorStatus === 400) {
        setDatabaseError(true)
      } else {
        // For other errors, assume database is available but there's a different issue
        setDatabaseError(false)
      }
    } finally {
      setDatabaseChecked(true)
    }
  }, [user])

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  // Check for database availability when user is authenticated
  useEffect(() => {
    if (user && !loading) {
      checkDatabaseAvailability()
    }
  }, [user, loading, checkDatabaseAvailability])

  if (loading || (user && !databaseChecked)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {loading ? 'Loading 86 Visual Inventory Manager...' : 'Checking database availability...'}
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">86</h1>
            <h2 className="text-xl font-medium text-muted-foreground mb-4">Visual Inventory Manager</h2>
            <p className="text-muted-foreground">
              Transform your kitchen operations with visual inventory management. 
              Upload images, create zones, and track inventory like never before.
            </p>
          </div>
          <button
            onClick={() => blink.auth.login()}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Sign In to Get Started
          </button>
        </div>
      </div>
    )
  }

  const handleDatabaseRetry = () => {
    setDatabaseChecked(false)
    setDatabaseError(false)
    checkDatabaseAvailability()
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} databaseAvailable={!databaseError} />
      case 'workspace':
        return <ImageWorkspace onNavigate={setCurrentPage} databaseAvailable={!databaseError} />
      case 'zones':
        return <ZoneManagement onNavigate={setCurrentPage} databaseAvailable={!databaseError} />
      case 'inventory':
        return <InventoryItems onNavigate={setCurrentPage} databaseAvailable={!databaseError} />
      case 'reorder':
        return <ReorderCenter onNavigate={setCurrentPage} databaseAvailable={!databaseError} />
      default:
        return <Dashboard onNavigate={setCurrentPage} databaseAvailable={!databaseError} />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} user={user} />
      {databaseError && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-blue-700">
              <Database className="w-4 h-4" />
              <span>Demo Mode: Using local storage - all features fully functional!</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage('dashboard')}
              className="text-blue-700 hover:text-blue-800"
            >
              Learn More
            </Button>
          </div>
        </div>
      )}
      <main className="pb-16 md:pb-0">
        {renderPage()}
      </main>
      <Toaster />
    </div>
  )
}

export default App