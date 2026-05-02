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
 * AUTH FLOW:
 *   1. Frontend obtains a JWT access token from POST /auth/login
 *   2. Frontend connects: io({ auth: { token: accessToken } })
 *   3. Socket.io middleware verifies the JWT — rejects unauthenticated connections
 *   4. On connection, the server joins the socket to the user's private room
 *   5. Events are emitted per-user: getIO().to(userId).emit('new-jobs', {...})
 *
 * HOW TO EMIT FROM ANYWHERE IN THE APP:
 *   import { getIO } from '../utils/socket'
 *   getIO().to(userId).emit('new-jobs', { count: 5 })
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

// Module-level singleton — one Socket.io server for the whole app
let io: SocketIOServer

/**
 * Creates the Socket.io server and attaches it to the HTTP server.
 * Called once in index.ts after app.listen().
 *
 * SECURITY: The io.use() middleware verifies the JWT before any connection
 * is accepted. Invalid/missing tokens are rejected immediately.
 */
export const createSocketServer = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      // Must match your frontend URL (same as Express CORS config)
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  })

  // ── JWT Auth Middleware ──────────────────────────────────────────────────
  // Runs before every connection attempt. Rejects unauthenticated sockets.
  // The frontend must pass: io({ auth: { token: accessToken } })
  io.use((socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token as string | undefined

    if (!token) {
      return next(new Error('Unauthorized'))
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!)
      // Store userId on socket.data for use in connection handler
      socket.data.userId = (payload as { sub?: string; id?: string }).sub ??
        (payload as { id?: string }).id
      next()
    } catch {
      return next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`)

    // Auto-join the user's private room using the userId from JWT
    // (set by auth middleware above)
    if (socket.data.userId) {
      socket.join(socket.data.userId as string)
      console.log(`User ${socket.data.userId as string} auto-joined their room`)
    }

    // Legacy support: frontend can also manually emit 'join' with userId.
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
