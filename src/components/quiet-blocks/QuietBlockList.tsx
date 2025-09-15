'use client'

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button, ConfirmationModal } from '@/components/ui'
import { CalendarIcon, ClockIcon } from '@/components/ui'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/components/ui/toast'

interface QuietBlock {
  _id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  date: string
  priority: 'low' | 'medium' | 'high'
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

interface QuietBlockListProps {
  onEdit?: (block: QuietBlock) => void
  onDelete?: (id: string) => void
}

export default function QuietBlockList({ onEdit, onDelete }: QuietBlockListProps) {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [blocks, setBlocks] = useState<QuietBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'active'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'title'>('date')
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean
    blockId: string | null
    blockTitle: string
  }>({
    isOpen: false,
    blockId: null,
    blockTitle: ''
  })

  useEffect(() => {
    if (!authLoading && user) {
      fetchQuietBlocks()
    } else if (!authLoading && !user) {
      // User is not authenticated, redirect to login
      window.location.href = '/auth/login?redirectTo=/dashboard'
    }
  }, [user, authLoading])

  const fetchQuietBlocks = async () => {
    try {
      setLoading(true)
      console.log('Fetching quiet blocks...')
      const response = await fetch('/api/quiet-blocks')
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('API Response:', data)
        console.log('Blocks data:', data.data)
        setBlocks(data.data || [])
      } else if (response.status === 401) {
        console.error('User not authenticated, redirecting to login...')
        // Redirect to login page
        window.location.href = '/auth/login?redirectTo=/dashboard'
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to fetch quiet blocks:', errorData)
        console.error('Error details:', errorData)
      }
    } catch (error) {
      console.error('Error fetching quiet blocks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    // Find the block to get its title for the modal
    const blockToDelete = blocks.find(block => block._id === id)
    const blockTitle = blockToDelete?.title || 'Quiet Block'
    
    // Show confirmation modal
    setDeleteConfirmation({
      isOpen: true,
      blockId: id,
      blockTitle: blockTitle
    })
  }

  const confirmDelete = async () => {
    const { blockId, blockTitle } = deleteConfirmation
    if (!blockId) return
    
    try {
      const response = await fetch(`/api/quiet-blocks/${blockId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setBlocks(blocks.filter(block => block._id !== blockId))
        onDelete?.(blockId)
        showToast({
          message: `"${blockTitle}" successfully deleted!`,
          type: 'success'
        })
      } else {
        const errorText = await response.text()
        console.error('Failed to delete quiet block:', errorText)
        showToast({
          message: `Failed to delete "${blockTitle}". Please try again.`,
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Error deleting quiet block:', error)
      showToast({
        message: `Error deleting "${blockTitle}". Please check your connection and try again.`,
        type: 'error'
      })
    }
  }

  const filterBlocks = (blocks: QuietBlock[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    return blocks.filter(block => {
      const blockDate = new Date(block.date)
      const blockDateTime = new Date(`${block.date}T${block.startTime}`)

      switch (filter) {
        case 'upcoming':
          return blockDateTime >= now
        case 'past':
          return blockDateTime < now
        case 'active':
          return block.status === 'active'
        default:
          return true
      }
    })
  }

  const sortBlocks = (blocks: QuietBlock[]) => {
    return [...blocks].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        case 'title':
          return a.title.localeCompare(b.title)
        case 'date':
        default:
          const aDateTime = new Date(`${a.date}T${a.startTime}`)
          const bDateTime = new Date(`${b.date}T${b.startTime}`)
          return aDateTime.getTime() - bDateTime.getTime()
      }
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour24 = parseInt(hours)
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
    const ampm = hour24 >= 12 ? 'PM' : 'AM'
    return `${hour12}:${minutes} ${ampm}`
  }

  const filteredAndSortedBlocks = sortBlocks(filterBlocks(blocks))

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading quiet blocks...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters and Sort */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Blocks</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="active">Active</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="title">Sort by Title</option>
          </select>
        </div>
        
        <div className="text-sm text-gray-500">
          {filteredAndSortedBlocks.length} block{filteredAndSortedBlocks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Quiet Blocks List */}
      {filteredAndSortedBlocks.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center text-gray-500">
              <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No quiet blocks found</h3>
              <p>Create your first quiet block to get started.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAndSortedBlocks.map((block) => (
            <Card key={block._id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{block.title}</CardTitle>
                    {block.description && (
                      <CardDescription className="text-sm">
                        {block.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge className={getPriorityColor(block.priority)}>
                      {block.priority}
                    </Badge>
                    <Badge className={getStatusColor(block.status)}>
                      {block.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Date and Time */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      {format(new Date(block.date), 'MMM dd, yyyy')}
                    </div>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      {formatTime(block.startTime)} - {formatTime(block.endTime)}
                    </div>
                  </div>

                  {/* Tags */}
                  {block.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {block.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Reminder Info */}
                  {block.reminderEnabled && (
                    <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      Reminder: {block.reminderMinutesBefore} minutes before
                      {block.reminderEmailEnabled && ' (Email)'}
                      {block.reminderPushEnabled && ' (Push)'}
                    </div>
                  )}

                  {/* Privacy */}
                  {block.isPrivate && (
                    <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                      Private
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit?.(block)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(block._id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, blockId: null, blockTitle: '' })}
        onConfirm={confirmDelete}
        title="Delete Quiet Block"
        description={`Are you sure you want to delete "${deleteConfirmation.blockTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  )
}