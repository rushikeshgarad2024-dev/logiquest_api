import { EmailTemplate } from './email.constants';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderEmailTemplate(template: EmailTemplate | string, context: Record<string, any> = {}): RenderedEmail {
  switch (template) {
    case EmailTemplate.WELCOME: {
      const username = context.username || 'Adventurer';
      const exploreUrl = context.exploreUrl || 'https://logiquest.io/puzzles';
      return {
        subject: 'Welcome to LogiQuest! 🧩',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h1 style="color: #4f46e5; text-align: center;">Welcome to LogiQuest!</h1>
            <p>Hi <strong>${username}</strong>,</p>
            <p>Thank you for joining LogiQuest, the community-driven logic puzzle platform on Stellar.</p>
            <p>Start solving puzzles, earning achievements, and climbing the global leaderboard!</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${exploreUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Explore Puzzles</a>
            </div>
            <p style="color: #6b7280; font-size: 12px; text-align: center;">© 2026 LogiQuest. All rights reserved.</p>
          </div>
        `.trim(),
        text: `Welcome to LogiQuest, ${username}! Explore puzzles at ${exploreUrl}`,
      };
    }

    case EmailTemplate.PASSWORD_RESET: {
      const resetUrl = context.resetUrl || 'https://logiquest.io/reset-password';
      const expiresIn = context.expiresIn || '15 minutes';
      return {
        subject: 'Reset Your LogiQuest Password 🔒',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #dc2626;">Password Reset Request</h2>
            <p>We received a request to reset your password. Click the link below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
            </div>
            <p>This link will expire in <strong>${expiresIn}</strong>. If you did not request this, you can safely ignore this email.</p>
            <p style="color: #6b7280; font-size: 12px; text-align: center;">© 2026 LogiQuest. All rights reserved.</p>
          </div>
        `.trim(),
        text: `Reset your password at: ${resetUrl} (Expires in ${expiresIn})`,
      };
    }

    case EmailTemplate.ACHIEVEMENT_UNLOCKED: {
      const achievementName = context.achievementName || 'Grand Master';
      const description = context.description || 'Solved 50 puzzles in a row!';
      const rewardPoints = context.rewardPoints || 100;
      return {
        subject: `Achievement Unlocked: ${achievementName} 🏆`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #059669; text-align: center;">🏆 Achievement Unlocked!</h2>
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
              <h3 style="color: #065f46; margin: 0 0 10px 0;">${achievementName}</h3>
              <p style="color: #047857; margin: 0;">${description}</p>
              <p style="font-weight: bold; color: #065f46; margin-top: 10px;">+${rewardPoints} Points</p>
            </div>
            <p style="text-align: center;">Keep solving to unlock exclusive NFTs and level up your rank!</p>
            <p style="color: #6b7280; font-size: 12px; text-align: center;">© 2026 LogiQuest. All rights reserved.</p>
          </div>
        `.trim(),
        text: `Achievement Unlocked: ${achievementName}! ${description} (+${rewardPoints} points)`,
      };
    }

    case EmailTemplate.WEEKLY_SUMMARY: {
      const username = context.username || 'Adventurer';
      const rank = context.rank || 1;
      const points = context.points || 0;
      const puzzlesSolved = context.puzzlesSolved || 0;
      return {
        subject: 'Your LogiQuest Weekly Summary 📊',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #2563eb; text-align: center;">Your Weekly Summary</h2>
            <p>Hi ${username}, here is your puzzle activity for the past week:</p>
            <div style="display: flex; justify-content: space-around; background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <div><strong>Rank:</strong> #${rank}</div>
              <div><strong>Points:</strong> ${points}</div>
              <div><strong>Solved:</strong> ${puzzlesSolved}</div>
            </div>
            <div style="text-align: center; margin: 25px 0;">
              <a href="https://logiquest.io/leaderboard" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Leaderboard</a>
            </div>
            <p style="color: #6b7280; font-size: 12px; text-align: center;">© 2026 LogiQuest. All rights reserved.</p>
          </div>
        `.trim(),
        text: `LogiQuest Weekly Summary for ${username}: Rank #${rank}, ${points} Points, ${puzzlesSolved} Puzzles Solved.`,
      };
    }

    default:
      return {
        subject: context.subject || 'LogiQuest Notification',
        html: `<p>${context.body || 'No content'}</p>`,
        text: context.body || 'No content',
      };
  }
}
