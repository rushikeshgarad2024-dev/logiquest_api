import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UseGuards } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';

interface SessionJoinedPayload {
  sessionId: string;
  userId: string;
  puzzleId: string;
  startedAt: Date;
}

interface ScoreUpdatePayload {
  sessionId: string;
  score: number;
  timestamp: Date;
}

interface HintRevealedPayload {
  sessionId: string;
  hintIndex: number;
  hintText: string;
  hintsUsed: number;
}

interface SessionCompletedPayload {
  sessionId: string;
  finalScore: number;
  completedAt: Date;
  hintsUsed: number;
  timeElapsed: number;
}

interface TimeWarningPayload {
  sessionId: string;
  timeRemaining: number;
  threshold: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class SessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET') || 'your-secret-key',
      });

      client.data.userId = payload.sub;
      client.data.email = payload.email;
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Clean up any room memberships
    const rooms = client.rooms;
    rooms.forEach((room) => {
      if (room !== client.id) {
        client.leave(room);
      }
    });
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.auth.token;
    if (authHeader) {
      return authHeader;
    }
    
    const queryToken = client.handshake.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    const headerToken = client.handshake.headers.authorization;
    if (headerToken && headerToken.startsWith('Bearer ')) {
      return headerToken.substring(7);
    }

    return null;
  }

  // Public methods that can be called from other services
  joinSessionRoom(client: Socket, sessionId: string) {
    const roomName = `session:${sessionId}`;
    client.join(roomName);
  }

  leaveSessionRoom(client: Socket, sessionId: string) {
    const roomName = `session:${sessionId}`;
    client.leave(roomName);
  }

  emitSessionJoined(sessionId: string, payload: SessionJoinedPayload) {
    this.server.to(`session:${sessionId}`).emit('session:joined', payload);
  }

  emitScoreUpdate(sessionId: string, payload: ScoreUpdatePayload) {
    this.server.to(`session:${sessionId}`).emit('session:score_update', payload);
  }

  emitHintRevealed(sessionId: string, payload: HintRevealedPayload) {
    this.server.to(`session:${sessionId}`).emit('session:hint_revealed', payload);
  }

  emitSessionCompleted(sessionId: string, payload: SessionCompletedPayload) {
    this.server.to(`session:${sessionId}`).emit('session:completed', payload);
  }

  emitTimeWarning(sessionId: string, payload: TimeWarningPayload) {
    this.server.to(`session:${sessionId}`).emit('session:time_warning', payload);
  }

  // Client-side event handlers
  @SubscribeMessage('join_session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const { sessionId } = data;
    this.joinSessionRoom(client, sessionId);
    return { event: 'joined_session', data: { sessionId } };
  }

  @SubscribeMessage('leave_session')
  handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const { sessionId } = data;
    this.leaveSessionRoom(client, sessionId);
    return { event: 'left_session', data: { sessionId } };
  }
}
