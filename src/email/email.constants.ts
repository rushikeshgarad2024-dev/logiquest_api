export enum EmailTemplate {
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password-reset',
  ACHIEVEMENT_UNLOCKED = 'achievement-unlocked',
  WEEKLY_SUMMARY = 'weekly-summary',
}

export enum EmailProvider {
  SMTP = 'smtp',
  SENDGRID = 'sendgrid',
  CONSOLE = 'console',
}

export interface EmailPreferences {
  marketing: boolean;
  weeklySummary: boolean;
  achievements: boolean;
  transactional: boolean; // Always true (cannot opt out of password reset / security)
}

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  marketing: true,
  weeklySummary: true,
  achievements: true,
  transactional: true,
};
