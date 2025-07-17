import { useState, useEffect, useCallback } from 'react'
import { Camera, MapPin, Package, ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react'
import { blink } from '../blink/client'
import { localDB } from '../utils/localStorage'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

type Page = 'dashboard' | 'workspace' | 'zones' | 'inventory' | 'reorder'

interface DashboardProps {
  onNavigate: (page: Page) => void
  databaseAvailable?: boolean
}

export function Dashboard({ onNavigate, databaseAvailable = true }: DashboardProps) {
  const [stats, setStats] = useState({
    totalImages: 0,
    totalZones: 0,
    totalItems: 0,
    lowStockItems: 0,
    reorderSuggestions: 0
  })

  const loadDashboardStats = useCallback(async () => {
    try {
      const user = await blink.auth.me()
      
      if (databaseAvailable) {
        // Use database when available
        const images = await blink.db.images.list({
          where: { userId: user.id }
        })
        
        const zones = await blink.db.zones.list({
          where: { userId: user.id }
        })
        
        const items = await blink.db.inventoryItems.list({
          where: { userId: user.id }
        })
        
        const lowStockItems = items.filter(item => 
          Number(item.quantity) <= Number(item.reorderThreshold || 0)
        )
        
        setStats({
          totalImages: images.length,
          totalZones: zones.length,
          totalItems: items.length,
          lowStockItems: lowStockItems.length,
          reorderSuggestions: lowStockItems.length
        })
      } else {
        // Use local storage when database is unavailable
        const stats = await localDB.getStats(user.id)
        setStats(stats)
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
      setStats({
        totalImages: 0,
        totalZones: 0,
        totalItems: 0,
        lowStockItems: 0,
        reorderSuggestions: 0
      })
    }
  }, [databaseAvailable])

  useEffect(() => {
    loadDashboardStats()
  }, [loadDashboardStats])

  const quickActions = [
    {
      title: 'Upload Kitchen Image',
      description: 'Add a new image of your kitchen space',
      icon: Camera,
      action: () => onNavigate('workspace'),
      color: 'bg-blue-500'
    },
    {
      title: 'Manage Zones',
      description: 'Create and edit inventory zones',
      icon: MapPin,
      action: () => onNavigate('zones'),
      color: 'bg-green-500'
    },
    {
      title: 'Add Inventory',
      description: 'Log new inventory items',
      icon: Package,
      action: () => onNavigate('inventory'),
      color: 'bg-purple-500'
    },
    {
      title: 'Review Reorders',
      description: 'Check items that need restocking',
      icon: ShoppingCart,
      action: () => onNavigate('reorder'),
      color: 'bg-orange-500'
    }
  ]

  const statCards = [
    {
      title: 'Kitchen Images',
      value: stats.totalImages,
      icon: Camera,
      description: 'Uploaded spaces'
    },
    {
      title: 'Active Zones',
      value: stats.totalZones,
      icon: MapPin,
      description: 'Inventory zones'
    },
    {
      title: 'Total Items',
      value: stats.totalItems,
      icon: Package,
      description: 'Tracked items'
    },
    {
      title: 'Low Stock',
      value: stats.lowStockItems,
      icon: AlertTriangle,
      description: 'Need attention',
      alert: stats.lowStockItems > 0
    }
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center md:text-left">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome to 86 Visual Inventory
        </h1>
        <p className="text-muted-foreground">
          Manage your kitchen inventory with visual zones and smart tracking
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className={stat.alert ? 'border-destructive' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                  <Icon className={`w-8 h-8 ${stat.alert ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockItems > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-medium text-foreground">
                    {stats.lowStockItems} items need restocking
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Review your reorder suggestions to maintain optimal inventory levels
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => onNavigate('reorder')}
                variant="destructive"
                size="sm"
              >
                Review Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon
            return (
              <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-6" onClick={action.action}>
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{action.title}</h3>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Demo Mode Info */}
      {!databaseAvailable && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-blue-800">
              <TrendingUp className="w-5 h-5" />
              <span>Demo Mode Active</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-blue-700">
              You're using the full-featured 86 Visual Inventory Manager in demo mode! All features work perfectly using local storage.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <p className="font-medium text-blue-800">Upload Images</p>
                <p className="text-sm text-blue-600">Add kitchen photos</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <p className="font-medium text-blue-800">Draw Zones</p>
                <p className="text-sm text-blue-600">Mark storage areas</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <p className="font-medium text-blue-800">Track Items</p>
                <p className="text-sm text-blue-600">Manage inventory</p>
              </div>
            </div>
            <Button onClick={() => onNavigate('workspace')} className="w-full bg-blue-600 hover:bg-blue-700">
              Try It Now - Upload Your First Image
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Getting Started */}
      {stats.totalImages === 0 && databaseAvailable && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Getting Started</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Welcome to 86 Visual Inventory Manager! Here's how to get started:
            </p>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-0.5">1</Badge>
                <div>
                  <p className="font-medium">Upload Kitchen Images</p>
                  <p className="text-sm text-muted-foreground">
                    Take photos of your kitchen spaces like walk-in coolers, dry storage, or bar areas
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-0.5">2</Badge>
                <div>
                  <p className="font-medium">Create Inventory Zones</p>
                  <p className="text-sm text-muted-foreground">
                    Draw boxes on your images to mark different storage areas and shelves
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-0.5">3</Badge>
                <div>
                  <p className="font-medium">Add Inventory Items</p>
                  <p className="text-sm text-muted-foreground">
                    Log your inventory items with quantities, costs, and reorder thresholds
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={() => onNavigate('workspace')} className="w-full md:w-auto">
              Start with Your First Image
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}