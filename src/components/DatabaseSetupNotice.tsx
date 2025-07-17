import { AlertTriangle, Database, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Alert, AlertDescription } from './ui/alert'

interface DatabaseSetupNoticeProps {
  onRetry?: () => void
}

export function DatabaseSetupNotice({ onRetry }: DatabaseSetupNoticeProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-800">
            <Database className="w-6 h-6" />
            <span>Running in Demo Mode</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertTriangle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              The app is running in demo mode using local storage. All features are fully functional!
            </AlertDescription>
          </Alert>

          <div className="space-y-3 text-sm text-blue-700">
            <p>
              <strong>What's happening:</strong> Due to platform database limitations, the app is using your browser's local storage to save data. This means all features work perfectly, but data is stored locally on your device.
            </p>
            
            <p>
              <strong>Fully functional features:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>✅ Upload and annotate kitchen space images</li>
              <li>✅ Create interactive inventory zones by drawing on images</li>
              <li>✅ Track inventory items with quantities and costs</li>
              <li>✅ Set reorder thresholds and get low stock alerts</li>
              <li>✅ Mobile-optimized interface for easy kitchen use</li>
              <li>✅ All data persists in your browser</li>
            </ul>

            <p>
              <strong>Try it out:</strong> Click "Continue to App" below to start using the full inventory management system. Upload a kitchen image, draw zones, and add inventory items!
            </p>
          </div>

          <div className="pt-4 flex space-x-3">
            <Button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Continue to App
            </Button>
            {onRetry && (
              <Button 
                onClick={onRetry}
                variant="outline"
                className="border-blue-300 text-blue-800 hover:bg-blue-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Database
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Demo Preview */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Preview: What the App Will Look Like</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Mock Stats */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Kitchen Images</p>
                  <p className="text-2xl font-bold text-blue-800">3</p>
                  <p className="text-xs text-blue-600">Uploaded spaces</p>
                </div>
                <Database className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Active Zones</p>
                  <p className="text-2xl font-bold text-green-800">12</p>
                  <p className="text-xs text-green-600">Inventory zones</p>
                </div>
                <Database className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Total Items</p>
                  <p className="text-2xl font-bold text-purple-800">47</p>
                  <p className="text-xs text-purple-600">Tracked items</p>
                </div>
                <Database className="w-8 h-8 text-purple-400" />
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Low Stock</p>
                  <p className="text-2xl font-bold text-orange-800">5</p>
                  <p className="text-xs text-orange-600">Need attention</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-400" />
              </div>
            </div>
          </div>

          <div className="text-center text-muted-foreground">
            <p className="text-sm">
              This is a preview of your dashboard once the database is set up. 
              You'll be able to track all your kitchen inventory visually and efficiently.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}