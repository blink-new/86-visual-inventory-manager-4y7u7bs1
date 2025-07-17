import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Plus, Edit, Trash2, Save, X, Camera } from 'lucide-react'
import { blink } from '../blink/client'
import { localDB, type KitchenImage as LocalKitchenImage, type Zone as LocalZone } from '../utils/localStorage'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { useToast } from '../hooks/use-toast'

type Page = 'dashboard' | 'workspace' | 'zones' | 'inventory' | 'reorder'

interface ImageWorkspaceProps {
  onNavigate: (page: Page) => void
  databaseAvailable?: boolean
}

interface Zone {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string
}

interface KitchenImage {
  id: string
  name: string
  imageUrl: string
  zones: Zone[]
  userId: string
  createdAt: string
}

export function ImageWorkspace({ onNavigate, databaseAvailable = true }: ImageWorkspaceProps) {
  const [images, setImages] = useState<KitchenImage[]>([])
  const [selectedImage, setSelectedImage] = useState<KitchenImage | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentZone, setCurrentZone] = useState<Partial<Zone> | null>(null)
  const [editingZone, setEditingZone] = useState<string | null>(null)
  const [zoneName, setZoneName] = useState('')
  const [uploading, setUploading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const loadImages = useCallback(async () => {
    try {
      const user = await blink.auth.me()
      
      if (databaseAvailable) {
        // Use database when available
        const imageData = await blink.db.images.list({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' }
        })
        setImages(imageData)
      } else {
        // Use local storage when database is unavailable
        const imageData = await localDB.getImages(user.id)
        setImages(imageData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      }
    } catch (error) {
      console.error('Error loading images:', error)
      setImages([])
      // Don't show error toast for database not found - this is expected during setup
      if (!error.message?.includes('Database for project')) {
        toast({
          title: 'Error',
          description: 'Failed to load images',
          variant: 'destructive'
        })
      }
    }
  }, [databaseAvailable, toast])

  useEffect(() => {
    loadImages()
  }, [loadImages])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const user = await blink.auth.me()
      
      // Upload image to storage
      const { publicUrl } = await blink.storage.upload(
        file,
        `kitchen-images/${Date.now()}-${file.name}`,
        { upsert: true }
      )

      const imageRecord: KitchenImage = {
        id: `img_${Date.now()}`,
        name: file.name.split('.')[0],
        imageUrl: publicUrl,
        userId: user.id,
        createdAt: new Date().toISOString(),
        zones: []
      }

      if (databaseAvailable) {
        // Save to database when available
        await blink.db.images.create({
          id: imageRecord.id,
          name: imageRecord.name,
          imageUrl: imageRecord.imageUrl,
          userId: imageRecord.userId,
          createdAt: imageRecord.createdAt
        })
      } else {
        // Save to local storage when database is unavailable
        await localDB.saveImage(user.id, {
          id: imageRecord.id,
          name: imageRecord.name,
          imageUrl: imageRecord.imageUrl,
          userId: imageRecord.userId,
          createdAt: imageRecord.createdAt
        })
      }

      setImages(prev => [imageRecord, ...prev])
      toast({
        title: 'Success',
        description: 'Image uploaded successfully'
      })
    } catch (error) {
      console.error('Error uploading image:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedImage || editingZone) return
    
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    if (!canvas || !rect) return

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setIsDrawing(true)
    setCurrentZone({
      x,
      y,
      width: 0,
      height: 0,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    })
  }

  const drawZone = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentZone) return

    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    if (!canvas || !rect) return

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setCurrentZone(prev => ({
      ...prev,
      width: x - (prev?.x || 0),
      height: y - (prev?.y || 0)
    }))
  }

  const finishDrawing = () => {
    if (!isDrawing || !currentZone || !selectedImage) return

    if (Math.abs(currentZone.width || 0) < 20 || Math.abs(currentZone.height || 0) < 20) {
      setIsDrawing(false)
      setCurrentZone(null)
      return
    }

    const zoneId = `zone_${Date.now()}`
    setEditingZone(zoneId)
    setZoneName('')
    setIsDrawing(false)
  }

  const saveZone = async () => {
    if (!currentZone || !selectedImage || !zoneName.trim()) return

    try {
      const user = await blink.auth.me()
      const newZone: Zone = {
        id: editingZone || `zone_${Date.now()}`,
        name: zoneName.trim(),
        x: currentZone.x || 0,
        y: currentZone.y || 0,
        width: currentZone.width || 0,
        height: currentZone.height || 0,
        color: currentZone.color || '#3b82f6'
      }

      const zoneRecord: LocalZone = {
        id: newZone.id,
        imageId: selectedImage.id,
        name: newZone.name,
        x: newZone.x,
        y: newZone.y,
        width: newZone.width,
        height: newZone.height,
        color: newZone.color,
        userId: selectedImage.userId,
        createdAt: new Date().toISOString()
      }

      if (databaseAvailable) {
        // Save to database when available
        await blink.db.zones.create(zoneRecord)
      } else {
        // Save to local storage when database is unavailable
        await localDB.saveZone(user.id, zoneRecord)
      }

      // Update local state
      setSelectedImage(prev => prev ? {
        ...prev,
        zones: [...(prev.zones || []), newZone]
      } : null)

      setCurrentZone(null)
      setEditingZone(null)
      setZoneName('')

      toast({
        title: 'Success',
        description: 'Zone created successfully'
      })
    } catch (error) {
      console.error('Error saving zone:', error)
      toast({
        title: 'Error',
        description: 'Failed to save zone',
        variant: 'destructive'
      })
    }
  }

  const cancelZone = () => {
    setCurrentZone(null)
    setEditingZone(null)
    setZoneName('')
    setIsDrawing(false)
  }

  const selectImage = async (image: KitchenImage) => {
    try {
      const user = await blink.auth.me()
      let zones: any[] = []

      if (databaseAvailable) {
        // Load zones from database when available
        zones = await blink.db.zones.list({
          where: { imageId: image.id }
        })
      } else {
        // Load zones from local storage when database is unavailable
        zones = await localDB.getZones(user.id, image.id)
      }

      const zonesWithColors = zones.map(zone => ({
        id: zone.id,
        name: zone.name,
        x: Number(zone.x),
        y: Number(zone.y),
        width: Number(zone.width),
        height: Number(zone.height),
        color: zone.color || '#3b82f6'
      }))

      setSelectedImage({
        ...image,
        zones: zonesWithColors
      })
    } catch (error) {
      console.error('Error loading zones:', error)
      setSelectedImage(image)
    }
  }

  const deleteZone = async (zoneId: string) => {
    try {
      const user = await blink.auth.me()

      if (databaseAvailable) {
        // Delete from database when available
        await blink.db.zones.delete(zoneId)
      } else {
        // Delete from local storage when database is unavailable
        await localDB.deleteZone(user.id, zoneId)
      }
      
      setSelectedImage(prev => prev ? {
        ...prev,
        zones: prev.zones.filter(zone => zone.id !== zoneId)
      } : null)

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Image Workspace</h1>
          <p className="text-muted-foreground">Upload kitchen images and create inventory zones</p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'Uploading...' : 'Upload Image'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Gallery */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Kitchen Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {images.length === 0 ? (
                <div className="text-center py-8">
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No images uploaded yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload First Image
                  </Button>
                </div>
              ) : (
                images.map((image) => (
                  <div
                    key={image.id}
                    className={`cursor-pointer rounded-lg border-2 transition-colors ${
                      selectedImage?.id === image.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => selectImage(image)}
                  >
                    <div className="p-3">
                      <img
                        src={image.imageUrl}
                        alt={image.name}
                        className="w-full h-24 object-cover rounded mb-2"
                      />
                      <p className="font-medium text-sm">{image.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {selectedImage?.id === image.id ? selectedImage.zones.length : 0} zones
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Image Editor */}
        <div className="lg:col-span-2">
          {selectedImage ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{selectedImage.name}</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {selectedImage.zones.length} zones
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="relative inline-block">
                    <img
                      ref={imageRef}
                      src={selectedImage.imageUrl}
                      alt={selectedImage.name}
                      className="max-w-full h-auto rounded-lg"
                      onLoad={() => {
                        const canvas = canvasRef.current
                        const img = imageRef.current
                        if (canvas && img) {
                          canvas.width = img.offsetWidth
                          canvas.height = img.offsetHeight
                          canvas.style.width = `${img.offsetWidth}px`
                          canvas.style.height = `${img.offsetHeight}px`
                        }
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 cursor-crosshair"
                      onMouseDown={startDrawing}
                      onMouseMove={drawZone}
                      onMouseUp={finishDrawing}
                      style={{ pointerEvents: editingZone ? 'none' : 'auto' }}
                    />
                    
                    {/* Render existing zones */}
                    {selectedImage.zones.map((zone) => (
                      <div
                        key={zone.id}
                        className="absolute border-2 bg-black/10 flex items-center justify-center group"
                        style={{
                          left: zone.x,
                          top: zone.y,
                          width: Math.abs(zone.width),
                          height: Math.abs(zone.height),
                          borderColor: zone.color
                        }}
                      >
                        <div className="bg-white/90 px-2 py-1 rounded text-xs font-medium">
                          {zone.name}
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteZone(zone.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Render current drawing zone */}
                    {currentZone && (
                      <div
                        className="absolute border-2 border-dashed bg-primary/20"
                        style={{
                          left: currentZone.x,
                          top: currentZone.y,
                          width: Math.abs(currentZone.width || 0),
                          height: Math.abs(currentZone.height || 0),
                          borderColor: currentZone.color
                        }}
                      />
                    )}
                  </div>

                  {/* Zone Name Input */}
                  {editingZone && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <Label htmlFor="zoneName">Zone Name</Label>
                      <div className="flex items-center space-x-2 mt-2">
                        <Input
                          id="zoneName"
                          value={zoneName}
                          onChange={(e) => setZoneName(e.target.value)}
                          placeholder="Enter zone name (e.g., 'Top Shelf', 'Produce Drawer')"
                          className="flex-1"
                        />
                        <Button onClick={saveZone} disabled={!zoneName.trim()}>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                        <Button variant="outline" onClick={cancelZone}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 text-sm text-muted-foreground">
                    <p>💡 Click and drag to create inventory zones on your image</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Select an Image to Start
                  </h3>
                  <p className="text-muted-foreground">
                    Choose an image from the gallery to create inventory zones
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}