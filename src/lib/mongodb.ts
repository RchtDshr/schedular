import mongoose from 'mongoose'

// MongoDB connection string from environment
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

// Interface for connection cache
interface MongooseConnection {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

// Cache the MongoDB connection in development to prevent multiple connections
declare global {
  var mongoose: MongooseConnection | undefined
}

let cached: MongooseConnection = global.mongoose || { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

/**
 * Connect to MongoDB using Mongoose
 * Uses connection caching to prevent multiple connections in development
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  // If we already have a connection, return it
  if (cached.conn) {
    return cached.conn
  }

  // If we don't have a promise, create one
  if (!cached.promise) {
    const opts = {
      maxPoolSize: 10, // Maximum number of connections in the connection pool
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
    }

    cached.promise = mongoose.connect(MONGODB_URI!, opts)
  }

  try {
    cached.conn = await cached.promise
    console.log('✅ Connected to MongoDB')
    return cached.conn
  } catch (error) {
    cached.promise = null
    console.error('❌ MongoDB connection error:', error)
    throw error
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectFromDatabase(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect()
    cached.conn = null
    cached.promise = null
    console.log('✅ Disconnected from MongoDB')
  }
}

/**
 * Check if MongoDB is connected
 */
export function isConnected(): boolean {
  return cached.conn?.connection?.readyState === 1
}

/**
 * Get connection status
 */
export function getConnectionStatus(): string {
  if (!cached.conn) return 'disconnected'
  
  switch (cached.conn.connection.readyState) {
    case 0: return 'disconnected'
    case 1: return 'connected'
    case 2: return 'connecting'
    case 3: return 'disconnecting'
    default: return 'unknown'
  }
}

/**
 * Setup MongoDB event listeners for debugging
 */
export function setupDatabaseEventListeners(): void {
  if (!mongoose.connection) return

  mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to MongoDB')
  })

  mongoose.connection.on('error', (error) => {
    console.error('❌ Mongoose connection error:', error)
  })

  mongoose.connection.on('disconnected', () => {
    console.log('🔌 Mongoose disconnected from MongoDB')
  })

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 Mongoose reconnected to MongoDB')
  })

  // Graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await disconnectFromDatabase()
      console.log('👋 MongoDB connection closed through app termination')
      process.exit(0)
    } catch (error) {
      console.error('❌ Error during MongoDB disconnection:', error)
      process.exit(1)
    }
  })
}

// Auto-setup event listeners
setupDatabaseEventListeners()

export default mongoose