import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SessionGateway } from './session.gateway';
import { Server, Socket } from 'socket.io';

describe('SessionGateway', () => {
  let gateway: SessionGateway;
  let jwtService: JwtService;
  let configService: ConfigService;
  let mockServer: Partial<Server>;
  let mockClient: Partial<Socket>;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    mockClient = {
      id: 'test-client-id',
      data: {},
      rooms: new Set(['test-client-id']),
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
      handshake: {
        auth: {},
        query: {},
        headers: {},
        time: Date.now().toString(),
        address: '127.0.0.1',
        xdomain: false,
        secure: false,
        issued: Date.now(),
        url: '/socket.io/',
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'JWT_EXPIRY') return '7d';
              return null;
            }),
          },
        },
      ],
    }).compile();

    gateway = module.get<SessionGateway>(SessionGateway);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    // Manually set the server property
    gateway['server'] = mockServer as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('should successfully connect with valid JWT token in auth', async () => {
      const validToken = 'valid.jwt.token';
      const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
      
      if (mockClient.handshake) {
        mockClient.handshake.auth.token = validToken;
      }
      (jwtService.verify as jest.Mock).mockReturnValue(payload);

      await gateway.handleConnection(mockClient as Socket);

      expect(jwtService.verify).toHaveBeenCalledWith(validToken, {
        secret: 'test-secret',
      });
      expect(mockClient.data.userId).toBe('user-123');
      expect(mockClient.data.email).toBe('test@example.com');
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should successfully connect with valid JWT token in query', async () => {
      const validToken = 'valid.jwt.token';
      const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
      
      if (mockClient.handshake) {
        mockClient.handshake.query.token = validToken;
      }
      (jwtService.verify as jest.Mock).mockReturnValue(payload);

      await gateway.handleConnection(mockClient as Socket);

      expect(jwtService.verify).toHaveBeenCalledWith(validToken, {
        secret: 'test-secret',
      });
      expect(mockClient.data.userId).toBe('user-123');
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should successfully connect with valid JWT token in Authorization header', async () => {
      const validToken = 'valid.jwt.token';
      const payload = { sub: 'user-123', email: 'test@example.com', role: 'user' };
      
      if (mockClient.handshake) {
        mockClient.handshake.headers.authorization = `Bearer ${validToken}`;
      }
      (jwtService.verify as jest.Mock).mockReturnValue(payload);

      await gateway.handleConnection(mockClient as Socket);

      expect(jwtService.verify).toHaveBeenCalledWith(validToken, {
        secret: 'test-secret',
      });
      expect(mockClient.data.userId).toBe('user-123');
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect when no token is provided', async () => {
      await gateway.handleConnection(mockClient as Socket);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect when token is invalid', async () => {
      const invalidToken = 'invalid.jwt.token';
      if (mockClient.handshake) {
        mockClient.handshake.auth.token = invalidToken;
      }
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(mockClient as Socket);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up room memberships on disconnect', () => {
      const testRooms = new Set(['test-client-id', 'session:session-123']);
      Object.defineProperty(mockClient, 'rooms', {
        value: testRooms,
        writable: true,
      });
      
      gateway.handleDisconnect(mockClient as Socket);

      expect(mockClient.leave).toHaveBeenCalledWith('session:session-123');
      expect(mockClient.leave).not.toHaveBeenCalledWith('test-client-id');
    });
  });

  describe('Room Management', () => {
    it('should join session room', () => {
      const sessionId = 'session-123';
      
      gateway.joinSessionRoom(mockClient as Socket, sessionId);

      expect(mockClient.join).toHaveBeenCalledWith(`session:${sessionId}`);
    });

    it('should leave session room', () => {
      const sessionId = 'session-123';
      
      gateway.leaveSessionRoom(mockClient as Socket, sessionId);

      expect(mockClient.leave).toHaveBeenCalledWith(`session:${sessionId}`);
    });
  });

  describe('Event Emission', () => {
    it('should emit session:joined event', () => {
      const sessionId = 'session-123';
      const payload = {
        sessionId: 'session-123',
        userId: 'user-123',
        puzzleId: 'puzzle-456',
        startedAt: new Date(),
      };

      gateway.emitSessionJoined(sessionId, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('session:joined', payload);
    });

    it('should emit session:score_update event', () => {
      const sessionId = 'session-123';
      const payload = {
        sessionId: 'session-123',
        score: 850,
        timestamp: new Date(),
      };

      gateway.emitScoreUpdate(sessionId, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('session:score_update', payload);
    });

    it('should emit session:hint_revealed event', () => {
      const sessionId = 'session-123';
      const payload = {
        sessionId: 'session-123',
        hintIndex: 1,
        hintText: 'This is a hint',
        hintsUsed: 1,
      };

      gateway.emitHintRevealed(sessionId, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('session:hint_revealed', payload);
    });

    it('should emit session:completed event', () => {
      const sessionId = 'session-123';
      const payload = {
        sessionId: 'session-123',
        finalScore: 950,
        completedAt: new Date(),
        hintsUsed: 2,
        timeElapsed: 120,
      };

      gateway.emitSessionCompleted(sessionId, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('session:completed', payload);
    });

    it('should emit session:time_warning event', () => {
      const sessionId = 'session-123';
      const payload = {
        sessionId: 'session-123',
        timeRemaining: 60,
        threshold: 60,
      };

      gateway.emitTimeWarning(sessionId, payload);

      expect(mockServer.to).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('session:time_warning', payload);
    });
  });

  describe('Client Message Handlers', () => {
    it('should handle join_session message', () => {
      const data = { sessionId: 'session-123' };
      
      const result = gateway.handleJoinSession(mockClient as Socket, data);

      expect(mockClient.join).toHaveBeenCalledWith(`session:${data.sessionId}`);
      expect(result).toEqual({
        event: 'joined_session',
        data: { sessionId: 'session-123' },
      });
    });

    it('should handle leave_session message', () => {
      const data = { sessionId: 'session-123' };
      
      const result = gateway.handleLeaveSession(mockClient as Socket, data);

      expect(mockClient.leave).toHaveBeenCalledWith(`session:${data.sessionId}`);
      expect(result).toEqual({
        event: 'left_session',
        data: { sessionId: 'session-123' },
      });
    });
  });
});
