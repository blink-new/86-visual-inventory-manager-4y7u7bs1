import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, AlertTriangle, Package, CheckCircle, X } from 'lucide-react'
import { blink } from '../blink/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import { useToast } from '../hooks/use-toast'

type Page = 'dashboard' | 'workspace' | 'zones' | 'inventory' | 'reorder'

interface ReorderCenterProps {
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

interface ReorderItem extends InventoryItem {
  zoneName: string
  suggestedQuantity: number
  selected: boolean
}

export function ReorderCenter({ onNavigate, databaseAvailable = true }: ReorderCenterProps) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [reorderItems, setReorderItems] = useState<ReorderItem[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    // Skip database calls if database is not available
    if (!databaseAvailable) {
      setItems([])
      setZones([])
      setReorderItems([])
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
          where: { userId: user.id }
        })
      ])

      setItems(itemsData)
      setZones(zonesData)

      // Filter items that need reordering
      const lowStockItems = itemsData.filter(item => 
        item.quantity <= item.reorderThreshold
      )

      // Create reorder items with zone names and suggested quantities
      const reorderList = lowStockItems.map(item => {
        const zone = zonesData.find(z => z.id === item.zoneId)
        const suggestedQuantity = Math.max(
          item.reorderThreshold * 2, // Suggest 2x the threshold
          item.reorderThreshold + 10 // Or threshold + 10, whichever is higher
        )

        return {
          ...item,
          zoneName: zone?.name || 'Unknown Zone',
          suggestedQuantity,
          selected: true // Default to selected
        }
      })

      setReorderItems(reorderList)
    } catch (error) {
      console.error('Error loading data:', error)
      setItems([])
      setZones([])
      setReorderItems([])
      // Don't show error toast for database not found - this is expected during setup
      if (!error.message?.includes('Database for project')) {
        toast({
          title: 'Error',
          description: 'Failed to load reorder data',
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

  const toggleItemSelection = (itemId: string) => {
    setReorderItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, selected: !item.selected }
        : item
    ))
  }

  const selectAll = () => {
    setReorderItems(prev => prev.map(item => ({ ...item, selected: true })))
  }

  const deselectAll = () => {
    setReorderItems(prev => prev.map(item => ({ ...item, selected: false })))
  }

  const updateSuggestedQuantity = (itemId: string, quantity: number) => {
    setReorderItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, suggestedQuantity: Math.max(0, quantity) }
        : item
    ))
  }

  const generateReorderList = () => {
    const selectedItems = reorderItems.filter(item => item.selected)
    
    if (selectedItems.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select items to include in your reorder list',
        variant: 'destructive'
      })
      return
    }

    // Generate a simple text list for now
    const reorderText = selectedItems.map(item => 
      `${item.name} - ${item.suggestedQuantity} ${item.unit} (Current: ${item.quantity}, Zone: ${item.zoneName})`
    ).join('\n')

    // Copy to clipboard
    navigator.clipboard.writeText(reorderText).then(() => {
      toast({
        title: 'Reorder List Generated',
        description: 'The reorder list has been copied to your clipboard'
      })
    }).catch(() => {
      // Fallback: show in alert
      alert(`Reorder List:\n\n${reorderText}`)
      toast({
        title: 'Reorder List Generated',
        description: 'The reorder list is displayed above'
      })
    })
  }

  const markAsOrdered = async () => {
    const selectedItems = reorderItems.filter(item => item.selected)
    
    if (selectedItems.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select items to mark as ordered',
        variant: 'destructive'
      })
      return
    }

    try {
      // Update quantities for selected items
      await Promise.all(
        selectedItems.map(item => 
          blink.db.inventoryItems.update(item.id, {
            quantity: item.suggestedQuantity,
            updatedAt: new Date().toISOString()
          })
        )
      )

      toast({
        title: 'Success',
        description: `${selectedItems.length} items marked as restocked`
      })

      // Reload data to refresh the list
      loadData()
    } catch (error) {
      console.error('Error updating items:', error)
      toast({
        title: 'Error',
        description: 'Failed to update inventory quantities',
        variant: 'destructive'
      })
    }
  }

  const selectedItems = reorderItems.filter(item => item.selected)
  const totalEstimatedCost = selectedItems.reduce(
    (sum, item) => sum + (item.suggestedQuantity * item.costPerUnit), 
    0
  )

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading reorder suggestions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reorder Center</h1>
          <p className="text-muted-foreground">Review and manage items that need restocking</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => onNavigate('inventory')}>
            <Package className="w-4 h-4 mr-2" />
            Manage Inventory
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Items Need Reorder</p>
                <p className="text-2xl font-bold text-foreground">{reorderItems.length}</p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${reorderItems.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Selected Items</p>
                <p className="text-2xl font-bold text-foreground">{selectedItems.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estimated Cost</p>
                <p className="text-2xl font-bold text-foreground">${totalEstimatedCost.toFixed(2)}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
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
      </div>

      {/* Reorder List */}
      {reorderItems.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">All Stocked Up!</h3>
              <p className="text-muted-foreground mb-4">
                No items currently need reordering. All inventory levels are above their thresholds.
              </p>
              <Button onClick={() => onNavigate('inventory')}>
                Manage Inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Items Needing Reorder</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
                <Button onClick={generateReorderList} disabled={selectedItems.length === 0}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Generate List
                </Button>
                <Button 
                  variant="outline" 
                  onClick={markAsOrdered} 
                  disabled={selectedItems.length === 0}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Restocked
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reorderItems.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    item.selected ? 'bg-primary/5 border-primary' : 'bg-background'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => toggleItemSelection(item.id)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-foreground">{item.name}</h4>
                          <p className="text-sm text-muted-foreground">{item.zoneName}</p>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          Low Stock
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Current:</span>
                          <p className="font-medium">{item.quantity} {item.unit}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Threshold:</span>
                          <p className="font-medium">{item.reorderThreshold} {item.unit}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Suggested:</span>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateSuggestedQuantity(item.id, item.suggestedQuantity - 1)}
                              className="w-6 h-6 p-0"
                            >
                              -
                            </Button>
                            <span className="font-medium min-w-[60px] text-center">
                              {item.suggestedQuantity} {item.unit}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateSuggestedQuantity(item.id, item.suggestedQuantity + 1)}
                              className="w-6 h-6 p-0"
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Est. Cost:</span>
                          <p className="font-medium">${(item.suggestedQuantity * item.costPerUnit).toFixed(2)}</p>
                        </div>
                      </div>

                      {item.notes && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedItems.length > 0 && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Selected: {selectedItems.length} items</p>
                    <p className="text-sm text-muted-foreground">
                      Total estimated cost: ${totalEstimatedCost.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button onClick={generateReorderList}>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Generate Reorder List
                    </Button>
                    <Button variant="outline" onClick={markAsOrdered}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Restocked
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}