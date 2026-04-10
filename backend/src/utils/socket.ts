/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Socket.io Setup (src/utils/socket.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sets up the Socket.io server that runs alongside the Express HTTP server.
 * Socket.io enables real-time bidirectional communication between the server
 * and connected browser clients.
 *
 * IN PLAIN ENGLISH:
 *   Normal HTTP: browser asks → server responds → connection closes
 *   WebSocket:   browser connects → connection STAYS OPEN → server can
 *                push data at any time without the browser asking
 *
 * WE USE IT FOR:
 *   - Pushing "you have 3 new matching jobs" to the user's browser
 *     when the daily cron job finishes aggregating
 *
 * HOW TO EMIT FROM ANYWHERE IN THE APP:
 *   import { getIO } from '../utils/socket'
 *   getIO().to(userId).emit('new-jobs', { count: 5 })
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'

// Module-level singleton — one Socket.io server for the whole app
let io: SocketIOServer

/**
 * Creates the Socket.io server and attaches it to the HTTP server.
 * Called once in index.ts after app.listen().
 */
export const createSocketServer = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      // Must match your frontend URL (same as Express CORS config)
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  })

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`)

    // When the frontend connects, it should emit 'join' with the userId
    // so we can route events to the right user.
    // Example frontend code:
    //   socket.emit('join', userId)
    socket.on('join', (userId: string) => {
      // Join a room named after the user's ID
      // This lets us emit to a specific user with: io.to(userId).emit(...)
      socket.join(userId)
      console.log(`User ${userId} joined their room`)
    })

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`)
    })
  })

  return io
}

/**
 * Returns the Socket.io server instance.
 * Call this from services/jobs that need to push events.
 *
 * @throws Error if called before createSocketServer()
 */
export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call createSocketServer() first.')
  }
  return io
}
