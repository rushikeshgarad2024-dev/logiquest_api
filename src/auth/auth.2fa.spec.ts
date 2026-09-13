import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { OAuthProvider } from './entities/oauth-provider.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import {
  generateBase32Secret,
  generateTotpCode,
  verifyTotp,
  generateTotpUri,
  generateBackupCodes,
  encryptSecret,
  decryptSecret,
  hashBackupCode,
} from './utils/totp.util';

describe('Two-Factor Authentication (TOTP) Suite', () => {
  let authService: AuthService;
  let userRepository: any;
  let refreshTokenRepository: any;

  const mockUser: Partial<User> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'alice_player',
    email: 'alice@example.com',
    password: '$2b$10$hashedpasswordvalue',
    isTwoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
  };

  beforeEach(async () => {
    userRepository = {
      findOne: vi.fn(),
      save: vi.fn().mockImplementation((user) => Promise.resolve(user)),
      create: vi.fn().mockImplementation((dto) => ({ ...dto, id: 'mock-id' })),
    };

    refreshTokenRepository = {
      create: vi.fn().mockImplementation((dto) => dto),
      save: vi.fn().mockResolvedValue(true),
      findOne: vi.fn(),
      update: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(OAuthProvider),
          useValue: {},
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
        {
          provide: JwtService,
          useValue: {
            sign: vi.fn().mockReturnValue('mock.jwt.token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultVal: any) => defaultVal),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('TOTP Utilities', () => {
    test('generateBase32Secret returns valid base32 string', () => {
      const secret = generateBase32Secret(20);
      expect(secret).toMatch(/^[A-Z2-7]+$/);
      expect(secret.length).toBe(20);
    });

    test('generateTotpCode and verifyTotp produce matching 6-digit codes', () => {
      const secret = generateBase32Secret(20);
      const code = generateTotpCode(secret);
      expect(code).toHaveLength(6);
      expect(verifyTotp(code, secret)).toBe(true);
    });

    test('verifyTotp rejects invalid codes', () => {
      const secret = generateBase32Secret(20);
      expect(verifyTotp('000000', secret)).toBe(false);
    });

    test('generateTotpUri formats valid otpauth URI', () => {
      const uri = generateTotpUri('test@example.com', 'JBSWY3DPEHPK3PXP', 'LogiQuest');
      expect(uri).toContain('otpauth://totp/LogiQuest:test%40example.com');
      expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
      expect(uri).toContain('issuer=LogiQuest');
    });

    test('encryptSecret and decryptSecret roundtrip encrypted data', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const key = 'my-super-secret-encryption-key';
      const encrypted = encryptSecret(secret, key);
      expect(encrypted).toContain(':');
      const decrypted = decryptSecret(encrypted, key);
      expect(decrypted).toBe(secret);
    });

    test('generateBackupCodes produces 8 raw and hashed codes', () => {
      const backup = generateBackupCodes(8);
      expect(backup.rawCodes).toHaveLength(8);
      expect(backup.hashedCodes).toHaveLength(8);
      expect(hashBackupCode(backup.rawCodes[0])).toBe(backup.hashedCodes[0]);
    });
  });

  describe('AuthService 2FA Flow', () => {
    test('setupTwoFactor generates encrypted secret, QR URI, and 8 backup codes', async () => {
      userRepository.findOne.mockResolvedValueOnce({ ...mockUser });

      const result = await authService.setupTwoFactor(mockUser.id);
      expect(result.secret).toBeDefined();
      expect(result.qrCodeUri).toContain('otpauth://totp/LogiQuest');
      expect(result.backupCodes).toHaveLength(8);

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactorSecret: expect.stringContaining(':'),
          twoFactorBackupCodes: expect.any(Array),
        }),
      );
    });

    test('enableTwoFactor enables 2FA when valid code is supplied', async () => {
      const rawSecret = generateBase32Secret(20);
      const key = 'logiquest-2fa-secret-key-32b';
      const encryptedSecret = encryptSecret(rawSecret, key);
      const validCode = generateTotpCode(rawSecret);

      userRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        twoFactorSecret: encryptedSecret,
        isTwoFactorEnabled: false,
      });

      const response = await authService.enableTwoFactor(mockUser.id, validCode);
      expect(response.enabled).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isTwoFactorEnabled: true,
        }),
      );
    });

    test('enableTwoFactor throws UnauthorizedException on invalid code', async () => {
      const rawSecret = generateBase32Secret(20);
      const key = 'logiquest-2fa-secret-key-32b';
      const encryptedSecret = encryptSecret(rawSecret, key);

      userRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        twoFactorSecret: encryptedSecret,
        isTwoFactorEnabled: false,
      });

      await expect(
        authService.enableTwoFactor(mockUser.id, '999999'),
      ).rejects.toThrow(UnauthorizedException);
    });

    test('login returns requires2FA challenge when user has 2FA enabled', async () => {
      const bcrypt = require('bcrypt');
      vi.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true as never);

      userRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        isTwoFactorEnabled: true,
      });

      const result = await authService.login({
        username: 'alice_player',
        password: 'password123',
      });

      expect(result).toEqual({
        requires2FA: true,
        userId: mockUser.id,
        message: 'Two-factor authentication code required',
      });
    });

    test('verifyTwoFactor succeeds with valid TOTP code and returns token pair', async () => {
      const rawSecret = generateBase32Secret(20);
      const key = 'logiquest-2fa-secret-key-32b';
      const encryptedSecret = encryptSecret(rawSecret, key);
      const validCode = generateTotpCode(rawSecret);

      userRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        twoFactorSecret: encryptedSecret,
        isTwoFactorEnabled: true,
      });

      const tokens = await authService.verifyTwoFactor(mockUser.id, validCode);
      expect(tokens.accessToken).toBe('mock.jwt.token');
      expect(tokens.refreshToken).toBe('mock.jwt.token');
    });

    test('verifyTwoFactor consumes single-use backup code and returns token pair', async () => {
      const rawSecret = generateBase32Secret(20);
      const key = 'logiquest-2fa-secret-key-32b';
      const encryptedSecret = encryptSecret(rawSecret, key);
      const backup = generateBackupCodes(8);
      const rawBackupCode = backup.rawCodes[0];

      const userState = {
        ...mockUser,
        twoFactorSecret: encryptedSecret,
        twoFactorBackupCodes: [...backup.hashedCodes],
        isTwoFactorEnabled: true,
      };

      userRepository.findOne.mockResolvedValueOnce(userState);

      const tokens = await authService.verifyTwoFactor(mockUser.id, rawBackupCode);
      expect(tokens.accessToken).toBe('mock.jwt.token');
      expect(userRepository.save).toHaveBeenCalled();
      expect(userState.twoFactorBackupCodes).not.toContain(backup.hashedCodes[0]);
    });

    test('disableTwoFactor deactivates 2FA and clears secrets', async () => {
      const rawSecret = generateBase32Secret(20);
      const key = 'logiquest-2fa-secret-key-32b';
      const encryptedSecret = encryptSecret(rawSecret, key);
      const validCode = generateTotpCode(rawSecret);

      userRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        twoFactorSecret: encryptedSecret,
        isTwoFactorEnabled: true,
      });

      const res = await authService.disableTwoFactor(mockUser.id, validCode);
      expect(res.enabled).toBe(false);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isTwoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
        }),
      );
    });
  });
});
