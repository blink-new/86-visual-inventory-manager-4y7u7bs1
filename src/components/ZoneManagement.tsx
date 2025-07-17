import { useState, useEffect, useCallback } from 'react'
import { MapPin, Edit, Trash2, Package } from 'lucide-react'
import { blink } from '../blink/client'
import { localDB } from '../utils/localStorage'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useToast } from '../hooks/use-toast'

type Page = 'dashboard' | 'workspace' | 'zones' | 'inventory' | 'reorder'

interface ZoneManagementProps {
  onNavigate: (page: Page) => void
  databaseAvailable?: boolean
}

interface Zone {
  id: string
  name: string
  imageId: string
  x: number
  y: number
  width: number
  height: number
  color: string
  userId: string
  createdAt: string
}

interface KitchenImage {
  id: string
  name: string
  imageUrl: string
  userId: string
  createdAt: string
}

export function ZoneManagement({ onNavigate, databaseAvailable = true }: ZoneManagementProps) {
  const [zones, setZones] = useState<Zone[]>([])
  const [images, setImages] = useState<KitchenImage[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    try {
      const user = await blink.auth.me()
      
      if (databaseAvailable) {
        // Load zones and images from database
        const [zonesData, imagesData] = await Promise.all([
          blink.db.zones.list({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
          }),
          blink.db.images.list({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
          })
        ])

        setZones(zonesData)
        setImages(imagesData)
      } else {
        // Load zones and images from local storage
        const [zonesData, imagesData] = await Promise.all([
          localDB.getZones(user.id),
          localDB.getImages(user.id)
        ])

        setZones(zonesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
        setImages(imagesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setZones([])
      setImages([])
      // Don't show error toast for expected database errors
      const errorMessage = error?.message || ''
      if (!errorMessage.includes('Database for project') && 
          !errorMessage.includes('failed with status 404') &&
          !errorMessage.includes('maximum database count')) {
        toast({
          title: 'Error',
          description: 'Failed to load zones',
          variant: 'destructive'
        })
      }
    } finally {
      setLoading(false)
    }
  }, [databaseAvailable, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const deleteZone = async (zoneId: string) => {
    try {
      await blink.db.zones.delete(zoneId)
      setZones(prev => prev.filter(zone => zone.id !== zoneId))
      toast({
        title: 'Success',
        description: 'Zone deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting zone:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete zone',
        variant: 'destructive'
      })
    }
  }

  const getImageName = (imageId: string) => {
    const image = images.find(img => img.id === imageId)
    return image?.name || 'Unknown Image'
  }

  const getZonesByImage = () => {
    const zonesByImage: Record<string, Zone[]> = {}
    zones.forEach(zone => {
      if (!zonesByImage[zone.imageId]) {
        zonesByImage[zone.imageId] = []
      }
      zonesByImage[zone.imageId].push(zone)
    })
    return zonesByImage
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading zones...</p>
        </div>
      </div>
    )
  }

  const zonesByImage = getZonesByImage()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Zone Management</h1>
          <p className="text-muted-foreground">Manage your inventory zones across all kitchen images</p>
        </div>
        <Button onClick={() => onNavigate('workspace')}>
          <MapPin className="w-4 h-4 mr-2" />
          Create New Zone
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Zones</p>
                <p className="text-2xl font-bold text-foreground">{zones.length}</p>
              </div>
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Images with Zones</p>
                <p className="text-2xl font-bold text-foreground">{Object.keys(zonesByImage).length}</p>
              </div>
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Zones per Image</p>
                <p className="text-2xl font-bold text-foreground">
                  {Object.keys(zonesByImage).length > 0 
                    ? Math.round(zones.length / Object.keys(zonesByImage).length * 10) / 10
                    : 0
                  }
                </p>
              </div>
              <Edit className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zones by Image */}
      {Object.keys(zonesByImage).length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Zones Created Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by uploading kitchen images and creating inventory zones
              </p>
              <Button onClick={() => onNavigate('workspace')}>
                Create Your First Zone
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(zonesByImage).map(([imageId, imageZones]) => (
            <Card key={imageId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{getImageName(imageId)}</span>
                  <Badge variant="outline">{imageZones.length} zones</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {imageZones.map((zone) => (
                    <div
                      key={zone.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: zone.color }}
                          />
                          <h4 className="font-medium text-foreground">{zone.name}</h4>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteZone(zone.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Position:</span>
                          <span>{Math.round(zone.x)}, {Math.round(zone.y)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <span>{Math.round(zone.width)} × {Math.round(zone.height)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Created:</span>
                          <span>{new Date(zone.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => onNavigate('inventory')}
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Manage Items
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}