'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Button, 
  Input, 
  Textarea, 
  Label, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Checkbox,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  CalendarIcon,
  ClockIcon,
  AlertCircle,
  Plus,
  X,
  useToast
} from '@/components/ui'
import { cn } from '@/lib/utils'

// Form validation schema
const quietBlockFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  priority: z.enum(['low', 'medium', 'high']),
  reminderEnabled: z.boolean(),
  reminderMinutesBefore: z.number().min(1).max(1440),
  reminderEmailEnabled: z.boolean(),
  reminderPushEnabled: z.boolean(),
  tags: z.array(z.string()),
  isPrivate: z.boolean(),
  location: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
}).refine((data) => {
  const start = new Date(data.startTime)
  const end = new Date(data.endTime)
  return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start < end
}, {
  message: 'End time must be after start time',
  path: ['endTime']
}).refine((data) => {
  const end = new Date(data.endTime)
  const now = new Date()
  const bufferTime = new Date(now.getTime() + 60000) // 1 minute buffer
  return end >= bufferTime
}, {
  message: 'End time must be at least 1 minute in the future',
  path: ['endTime']
})

type QuietBlockFormData = z.infer<typeof quietBlockFormSchema>

interface QuietBlockFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  initialData?: any
  isEditing?: boolean
}

export function QuietBlockForm({ onSuccess, onCancel, initialData, isEditing = false }: QuietBlockFormProps) {
  const [newTag, setNewTag] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<QuietBlockFormData>({
    resolver: zodResolver(quietBlockFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      startTime: initialData ? `${initialData.date}T${initialData.startTime}` : '',
      endTime: initialData ? `${initialData.date}T${initialData.endTime}` : '',
      priority: initialData?.priority || 'medium',
      reminderEnabled: initialData?.reminderEnabled ?? true,
      reminderMinutesBefore: initialData?.reminderMinutesBefore || 15,
      reminderEmailEnabled: initialData?.reminderEmailEnabled ?? true,
      reminderPushEnabled: initialData?.reminderPushEnabled ?? false,
      tags: initialData?.tags || [],
      isPrivate: initialData?.isPrivate || false,
      location: initialData?.location || '',
      notes: initialData?.notes || '',
    }
  })

  const watchedValues = watch()
  const reminderEnabled = watch('reminderEnabled')

  const handleFormSubmit = async (data: QuietBlockFormData) => {
    try {
      setIsLoading(true)
      
      // Validate that we have start and end times
      if (!data.startTime || !data.endTime) {
        alert('Please select both start and end times')
        return
      }
      
      // Convert form data to API format
      const startDateTime = new Date(data.startTime)
      const endDateTime = new Date(data.endTime)
      
      // Validate the dates are valid
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        alert('Please select valid start and end times')
        return
      }
      
      // Validate start is before end
      if (startDateTime >= endDateTime) {
        alert('End time must be after start time')
        return
      }
      
      // Validate end time is not in the past (with 1 minute buffer)
      const now = new Date()
      const bufferTime = new Date(now.getTime() + 60000) // 1 minute buffer
      console.log('Client validation check:')
      console.log('End DateTime:', endDateTime.toISOString())
      console.log('Now:', now.toISOString()) 
      console.log('Buffer time:', bufferTime.toISOString())
      console.log('Difference in minutes:', (endDateTime.getTime() - now.getTime()) / (1000 * 60))
      
      if (endDateTime < bufferTime) {
        alert('End time must be at least 1 minute in the future')
        return
      }

      console.log('DateTime values:')
      console.log('Start:', startDateTime.toISOString())
      console.log('End:', endDateTime.toISOString())
      console.log('Now:', now.toISOString())
      console.log('Buffer time:', bufferTime.toISOString())
      
      const apiData: any = {
        title: data.title,
        date: '', // Will be set below using local date
        startTime: String(startDateTime.getHours()).padStart(2, '0') + ':' + String(startDateTime.getMinutes()).padStart(2, '0'),
        endTime: String(endDateTime.getHours()).padStart(2, '0') + ':' + String(endDateTime.getMinutes()).padStart(2, '0'),
        priority: data.priority,
        reminderConfig: {
          enabled: data.reminderEnabled,
          minutesBefore: data.reminderMinutesBefore,
          emailEnabled: data.reminderEmailEnabled,
          pushEnabled: data.reminderPushEnabled
        },
        isPrivate: data.isPrivate
      }

      // If end time is on a different date (crosses midnight), we need to handle this differently
      // Use local date comparison instead of UTC to avoid timezone issues
      const startLocalDate = startDateTime.getFullYear() + '-' + 
                             String(startDateTime.getMonth() + 1).padStart(2, '0') + '-' + 
                             String(startDateTime.getDate()).padStart(2, '0')
      const endLocalDate = endDateTime.getFullYear() + '-' + 
                           String(endDateTime.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(endDateTime.getDate()).padStart(2, '0')
      
      console.log('Date comparison:')
      console.log('Start local date:', startLocalDate)
      console.log('End local date:', endLocalDate)
      console.log('Start UTC date:', startDateTime.toISOString().split('T')[0])
      console.log('End UTC date:', endDateTime.toISOString().split('T')[0])
      
      if (startLocalDate !== endLocalDate) {
        alert('Start and end time must be on the same date. Multi-day quiet blocks are not supported yet.')
        return
      }

      // Use the local date for the API data
      apiData.date = startLocalDate

      console.log('Date conversion details:')
      console.log('Original startTime:', data.startTime)
      console.log('Original endTime:', data.endTime)
      console.log('Parsed startDateTime:', startDateTime.toISOString())
      console.log('Parsed endDateTime:', endDateTime.toISOString())
      console.log('Extracted date:', apiData.date)
      console.log('Extracted startTime:', apiData.startTime)
      console.log('Extracted endTime:', apiData.endTime)
      console.log('Reconstructed server datetime:', `${apiData.date}T${apiData.endTime}`)      // Add optional fields only if they have values
      if (data.description && data.description.trim()) {
        apiData.description = data.description
      }
      if (data.tags && data.tags.length > 0) {
        apiData.tags = data.tags
      }
      if (data.location && data.location.trim()) {
        apiData.location = data.location
      }
      if (data.notes && data.notes.trim()) {
        apiData.notes = data.notes
      }

      console.log('Sending API data:', apiData)
      console.log('Form submission details:')
      console.log('isEditing:', isEditing)
      console.log('initialData._id:', initialData?._id)

      const url = isEditing && initialData?._id 
        ? `/api/quiet-blocks/${initialData._id}`
        : '/api/quiet-blocks'
      
      const method = isEditing ? 'PUT' : 'POST'
      
      console.log('URL:', url)
      console.log('Method:', method)
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        
        // Handle schedule conflicts for both creation and editing
        if (errorData.error === 'SCHEDULE_CONFLICT') {
          const conflictDetails = errorData.conflictingBlocks || []
          const conflictList = conflictDetails.map((block: any) => 
            `• "${block.title}" (${block.timeDisplay})`
          ).join('\n')
          
          const action = isEditing ? 'Update' : 'Create'
          showToast({
            message: `Cannot ${action} Schedule - Time Conflict!\n\nYour schedule overlaps with:\n${conflictList}\n\nPlease choose a different time slot.`,
            type: 'error'
          })
          return // Just return, don't proceed with creation/editing
        }
        
        let errorMessage = 'Failed to save quiet block'
        if (errorData.details && Array.isArray(errorData.details)) {
          errorMessage = errorData.details.map((issue: any) => 
            `${issue.path?.join('.')}: ${issue.message}`
          ).join(', ')
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
        
        throw new Error(errorMessage)
      }

      // Show success toast
      const action = isEditing ? 'updated' : 'created'
      showToast({
        message: `Quiet block successfully ${action}!`,
        type: 'success'
      })

      onSuccess?.()
    } catch (error) {
      console.error('Error submitting form:', error)
      showToast({
        message: error instanceof Error ? error.message : 'Failed to save quiet block',
        type: 'error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !watchedValues.tags.includes(newTag.trim())) {
      setValue('tags', [...watchedValues.tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setValue('tags', watchedValues.tags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          {isEditing ? 'Edit Quiet Block' : 'Schedule New Quiet Block'}
        </CardTitle>
        <CardDescription>
          {isEditing ? 'Update your quiet block details' : 'Create a focused time block for uninterrupted work'}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="e.g., Deep Focus Session"
                className={cn(errors.title && "border-red-500")}
              />
              {errors.title && (
                <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Brief description of what you'll be working on..."
                className={cn(errors.description && "border-red-500")}
                rows={2}
              />
              {errors.description && (
                <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.description.message}
                </p>
              )}
            </div>
          </div>

          {/* Time Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              Time & Duration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  {...register('startTime')}
                  className={cn(errors.startTime && "border-red-500")}
                />
                {errors.startTime && (
                  <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.startTime.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  {...register('endTime')}
                  className={cn(errors.endTime && "border-red-500")}
                />
                {errors.endTime && (
                  <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.endTime.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={watchedValues.priority} 
                onValueChange={(value: string) => setValue('priority', value as 'low' | 'medium' | 'high')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Low</Badge>
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Medium</Badge>
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-red-100 text-red-800">High</Badge>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reminder Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="reminderEnabled" 
                checked={reminderEnabled}
                onCheckedChange={(checked: boolean) => setValue('reminderEnabled', !!checked)}
              />
              <Label htmlFor="reminderEnabled">Enable Reminders</Label>
            </div>

            {reminderEnabled && (
              <div className="space-y-4 pl-6 border-l-2 border-gray-200">
                <div>
                  <Label htmlFor="reminderMinutesBefore">Remind me (minutes before)</Label>
                  <Select 
                    value={watchedValues.reminderMinutesBefore.toString()} 
                    onValueChange={(value: string) => setValue('reminderMinutesBefore', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="reminderEmailEnabled" 
                      checked={watchedValues.reminderEmailEnabled}
                      onCheckedChange={(checked: boolean) => setValue('reminderEmailEnabled', !!checked)}
                    />
                    <Label htmlFor="reminderEmailEnabled">Email</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="reminderPushEnabled" 
                      checked={watchedValues.reminderPushEnabled}
                      onCheckedChange={(checked: boolean) => setValue('reminderPushEnabled', !!checked)}
                    />
                    <Label htmlFor="reminderPushEnabled">Push Notification</Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-0 h-auto font-normal"
            >
              {showAdvanced ? '− Hide' : '+ Show'} Advanced Options
            </Button>

            {showAdvanced && (
              <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                {/* Tags */}
                <div>
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {watchedValues.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <button 
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTag(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Add a tag..."
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addTag}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Location */}
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    {...register('location')}
                    placeholder="e.g., Home Office, Conference Room A"
                  />
                </div>

                {/* Privacy */}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="isPrivate" 
                    checked={watchedValues.isPrivate}
                    onCheckedChange={(checked: boolean) => setValue('isPrivate', !!checked)}
                  />
                  <Label htmlFor="isPrivate">Private (only visible to you)</Label>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Additional notes or context..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting || isLoading}>
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isSubmitting || isLoading}
              className="flex-1"
            >
              {isSubmitting || isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {isEditing ? 'Updating...' : 'Scheduling...'}
                </>
              ) : (
                isEditing ? 'Update Quiet Block' : 'Schedule Quiet Block'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default QuietBlockForm