'use client'

import React, { useState } from 'react'
import QuietBlockForm from '@/components/quiet-blocks/QuietBlockForm'
import QuietBlockList from '@/components/quiet-blocks/QuietBlockList'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'

interface QuietBlock {
  _id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  date: string
  priority: 'low' | 'medium' | 'high'
  isRecurring: boolean
  recurrencePattern?: {
    type: 'daily' | 'weekly' | 'monthly'
    interval: number
    daysOfWeek?: number[]
    endDate?: string
  }
  tags: string[]
  isPrivate: boolean
  reminderEnabled: boolean
  reminderMinutesBefore: number
  reminderEmailEnabled: boolean
  reminderPushEnabled: boolean
  status: 'active' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('list')
  const [editingBlock, setEditingBlock] = useState<QuietBlock | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleFormSuccess = () => {
    setActiveTab('list')
    setEditingBlock(null)
    setRefreshKey(prev => prev + 1) // Trigger list refresh
  }

  const handleEdit = (block: QuietBlock) => {
    setEditingBlock(block)
    setActiveTab('create')
  }

  const handleCancelEdit = () => {
    setEditingBlock(null)
    setActiveTab('list')
  }

  const handleDelete = () => {
    setRefreshKey(prev => prev + 1) // Trigger list refresh
  }

  return (
    <div className="min-h-screen text-gray-900 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold  mb-2">
            Quiet Scheduler Dashboard
          </h1>
          <p className="text-gray-600">
            Manage your quiet blocks and stay focused
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('list')}
                className={`${
                  activeTab === 'list'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                My Schedules
              </button>
              <button
                onClick={() => {
                  setActiveTab('create')
                  setEditingBlock(null)
                }}
                className={`${
                  activeTab === 'create'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                {editingBlock ? 'Edit Schedule' : 'Create New Schedule'}
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'list' && (
          <QuietBlockList 
            key={refreshKey}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {activeTab === 'create' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingBlock ? 'Edit Quiet Block' : 'Create New Quiet Block'}
                </CardTitle>
                {editingBlock && (
                  <Button 
                    variant="outline" 
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <QuietBlockForm 
                initialData={editingBlock}
                isEditing={!!editingBlock}
                onSuccess={handleFormSuccess}
                onCancel={editingBlock ? handleCancelEdit : undefined}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}