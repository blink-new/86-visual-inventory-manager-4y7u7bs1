import { useState, useEffect, useCallback } from 'react'
import { Package, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react'
import { blink } from '../blink/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { useToast } from '../hooks/use-toast'

type Page = 'dashboard' | 'workspace' | 'zones' | 'inventory' | 'reorder'

interface InventoryItemsProps {
  onNavigate: (page: Page) => void
  databaseAvailable?: boolean
}

interface InventoryItem {
  id: string
  name: string
  quantity: number
  unit: string
  costPerUnit: number
  reorderThreshold: number
  notes: string
  zoneId: string
  userId: string
  createdAt: string
  updatedAt: string
}

interface Zone {
  id: string
  name: string
  imageId: string
}

export function InventoryItems({ onNavigate, databaseAvailable = true }: InventoryItemsProps) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'pieces',
    costPerUnit: '',
    reorderThreshold: '',
    notes: '',
    zoneId: ''
  })
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    // Skip database calls if database is not available
    if (!databaseAvailable) {
      setItems([])
      setZones([])
      setLoading(false)
      return
    }

    try {
      const user = await blink.auth.me()
      
      const [itemsData, zonesData] = await Promise.all([
        blink.db.inventoryItems.list({
          where: { userId: user.id },
          orderBy: { updatedAt: 'desc' }
        }),
        blink.db.zones.list({
          where: { userId: user.id },
          orderBy: { name: 'asc' }
        })
      ])

      setItems(itemsData)
      setZones(zonesData)
    } catch (error) {
      console.error('Error loading data:', error)
      // Set empty arrays when database is not available
      setItems([])
      setZones([])
      // Don't show error toast for database not found - this is expected during setup
      if (!error.message?.includes('Database for project')) {
        toast({
          title: 'Error',
          description: 'Failed to load inventory items',
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

  const resetForm = () => {
    setFormData({
      name: '',
      quantity: '',
      unit: 'pieces',
      costPerUnit: '',
      reorderThreshold: '',
      notes: '',
      zoneId: ''
    })
    setEditingItem(null)
  }

  const openDialog = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        name: item.name,
        quantity: item.quantity.toString(),
        unit: item.unit,
        costPerUnit: item.costPerUnit.toString(),
        reorderThreshold: item.reorderThreshold.toString(),
        notes: item.notes || '',
        zoneId: item.zoneId
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.zoneId) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      })
      return
    }

    try {
      const user = await blink.auth.me()
      const itemData = {
        name: formData.name.trim(),
        quantity: Number(formData.quantity) || 0,
        unit: formData.unit,
        costPerUnit: Number(formData.costPerUnit) || 0,
        reorderThreshold: Number(formData.reorderThreshold) || 0,
        notes: formData.notes.trim(),
        zoneId: formData.zoneId,
        userId: user.id,
        updatedAt: new Date().toISOString()
      }

      if (editingItem) {
        await blink.db.inventoryItems.update(editingItem.id, itemData)
        setItems(prev => prev.map(item => 
          item.id === editingItem.id 
            ? { ...item, ...itemData }
            : item
        ))
        toast({
          title: 'Success',
          description: 'Item updated successfully'
        })
      } else {
        const newItem = await blink.db.inventoryItems.create({
          id: `item_${Date.now()}`,
          ...itemData,
          createdAt: new Date().toISOString()
        })
        setItems(prev => [newItem, ...prev])
        toast({
          title: 'Success',
          description: 'Item added successfully'
        })
      }

      closeDialog()
    } catch (error) {
      console.error('Error saving item:', error)
      toast({
        title: 'Error',
        description: 'Failed to save item',
        variant: 'destructive'
      })
    }
  }

  const deleteItem = async (itemId: string) => {
    try {
      await blink.db.inventoryItems.delete(itemId)
      setItems(prev => prev.filter(item => item.id !== itemId))
      toast({
        title: 'Success',
        description: 'Item deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting item:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive'
      })
    }
  }

  const getZoneName = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId)
    return zone?.name || 'Unknown Zone'
  }

  const isLowStock = (item: InventoryItem) => {
    return item.quantity <= item.reorderThreshold
  }

  const lowStockItems = items.filter(isLowStock)
  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.costPerUnit), 0)

  const units = [
    'pieces', 'bottles', 'cans', 'boxes', 'cases', 'gallons', 'liters', 
    'pounds', 'kilograms', 'ounces', 'grams', 'cups', 'tablespoons', 'teaspoons'
  ]

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Items</h1>
          <p className="text-muted-foreground">Track and manage your kitchen inventory</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Olive Oil, Ground Beef"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={formData.unit} onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="costPerUnit">Cost per Unit ($)</Label>
                  <Input
                    id="costPerUnit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData(prev => ({ ...prev, costPerUnit: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="reorderThreshold">Reorder Threshold</Label>
                  <Input
                    id="reorderThreshold"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.reorderThreshold}
                    onChange={(e) => setFormData(prev => ({ ...prev, reorderThreshold: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="zoneId">Zone *</Label>
                <Select value={formData.zoneId} onValueChange={(value) => setFormData(prev => ({ ...prev, zoneId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes about this item"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingItem ? 'Update' : 'Add'} Item
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold text-foreground">{items.length}</p>
              </div>
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-foreground">{lowStockItems.length}</p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${lowStockItems.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-foreground">${totalValue.toFixed(2)}</p>
              </div>
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Zones</p>
                <p className="text-2xl font-bold text-foreground">{zones.length}</p>
              </div>
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Items Added Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking your inventory by adding your first item
              </p>
              <Button onClick={() => openDialog()}>
                Add Your First Item
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} className={isLowStock(item) ? 'border-destructive' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{getZoneName(item.zoneId)}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    {isLowStock(item) && (
                      <Badge variant="destructive" className="text-xs">
                        Low Stock
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDialog(item)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteItem(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-medium">{item.quantity} {item.unit}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost per Unit:</span>
                    <span className="font-medium">${item.costPerUnit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Value:</span>
                    <span className="font-medium">${(item.quantity * item.costPerUnit).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Reorder at:</span>
                    <span className="font-medium">{item.reorderThreshold} {item.unit}</span>
                  </div>
                  {item.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">{item.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}