// Local storage utilities for when database is unavailable
export interface KitchenImage {
  id: string
  name: string
  imageUrl: string
  userId: string
  createdAt: string
}

export interface Zone {
  id: string
  imageId: string
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string
  userId: string
  createdAt: string
}

export interface InventoryItem {
  id: string
  zoneId: string
  name: string
  quantity: number
  unit: string
  costPerUnit?: number
  reorderThreshold?: number
  notes?: string
  imageUrl?: string
  userId: string
  createdAt: string
  updatedAt: string
}

class LocalStorageDB {
  private getKey(table: string, userId: string): string {
    return `86_inventory_${table}_${userId}`
  }

  // Images
  async getImages(userId: string): Promise<KitchenImage[]> {
    const key = this.getKey('images', userId)
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  async saveImage(userId: string, image: KitchenImage): Promise<KitchenImage> {
    const images = await this.getImages(userId)
    const existingIndex = images.findIndex(img => img.id === image.id)
    
    if (existingIndex >= 0) {
      images[existingIndex] = image
    } else {
      images.unshift(image)
    }
    
    const key = this.getKey('images', userId)
    localStorage.setItem(key, JSON.stringify(images))
    return image
  }

  async deleteImage(userId: string, imageId: string): Promise<void> {
    const images = await this.getImages(userId)
    const filtered = images.filter(img => img.id !== imageId)
    const key = this.getKey('images', userId)
    localStorage.setItem(key, JSON.stringify(filtered))
  }

  // Zones
  async getZones(userId: string, imageId?: string): Promise<Zone[]> {
    const key = this.getKey('zones', userId)
    const data = localStorage.getItem(key)
    const zones = data ? JSON.parse(data) : []
    
    if (imageId) {
      return zones.filter((zone: Zone) => zone.imageId === imageId)
    }
    return zones
  }

  async saveZone(userId: string, zone: Zone): Promise<Zone> {
    const zones = await this.getZones(userId)
    const existingIndex = zones.findIndex(z => z.id === zone.id)
    
    if (existingIndex >= 0) {
      zones[existingIndex] = zone
    } else {
      zones.push(zone)
    }
    
    const key = this.getKey('zones', userId)
    localStorage.setItem(key, JSON.stringify(zones))
    return zone
  }

  async deleteZone(userId: string, zoneId: string): Promise<void> {
    const zones = await this.getZones(userId)
    const filtered = zones.filter(zone => zone.id !== zoneId)
    const key = this.getKey('zones', userId)
    localStorage.setItem(key, JSON.stringify(filtered))
    
    // Also delete related inventory items
    await this.deleteItemsByZone(userId, zoneId)
  }

  // Inventory Items
  async getInventoryItems(userId: string, zoneId?: string): Promise<InventoryItem[]> {
    const key = this.getKey('inventory', userId)
    const data = localStorage.getItem(key)
    const items = data ? JSON.parse(data) : []
    
    if (zoneId) {
      return items.filter((item: InventoryItem) => item.zoneId === zoneId)
    }
    return items
  }

  async saveInventoryItem(userId: string, item: InventoryItem): Promise<InventoryItem> {
    const items = await this.getInventoryItems(userId)
    const existingIndex = items.findIndex(i => i.id === item.id)
    
    if (existingIndex >= 0) {
      items[existingIndex] = { ...item, updatedAt: new Date().toISOString() }
    } else {
      items.push(item)
    }
    
    const key = this.getKey('inventory', userId)
    localStorage.setItem(key, JSON.stringify(items))
    return item
  }

  async deleteInventoryItem(userId: string, itemId: string): Promise<void> {
    const items = await this.getInventoryItems(userId)
    const filtered = items.filter(item => item.id !== itemId)
    const key = this.getKey('inventory', userId)
    localStorage.setItem(key, JSON.stringify(filtered))
  }

  async deleteItemsByZone(userId: string, zoneId: string): Promise<void> {
    const items = await this.getInventoryItems(userId)
    const filtered = items.filter(item => item.zoneId !== zoneId)
    const key = this.getKey('inventory', userId)
    localStorage.setItem(key, JSON.stringify(filtered))
  }

  // Stats
  async getStats(userId: string) {
    const images = await this.getImages(userId)
    const zones = await this.getZones(userId)
    const items = await this.getInventoryItems(userId)
    
    const lowStockItems = items.filter(item => 
      Number(item.quantity) <= Number(item.reorderThreshold || 0)
    )
    
    return {
      totalImages: images.length,
      totalZones: zones.length,
      totalItems: items.length,
      lowStockItems: lowStockItems.length,
      reorderSuggestions: lowStockItems.length
    }
  }
}

export const localDB = new LocalStorageDB()