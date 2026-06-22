import { Platform, Share } from 'react-native';

function webOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://parul.app';
}

function buildShareUrl(path: string): string {
  if (Platform.OS === 'web') {
    return `${webOrigin()}${path}`;
  }
  // Native: use the web URL so the link opens in a browser pointing at the web app.
  // This avoids needing universal links / app-clip setup and the recipient can always
  // open the profile even without the native app installed.
  return `https://parul.app${path}`;
}

async function shareLink(url: string, label: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await Share.share({ message: `${label}\n${url}` });
    return true;
  } catch {
    return false;
  }
}

export function userProfileShareUrl(userId: string): string {
  return buildShareUrl(`/circles/user/${userId}`);
}

export function companionProfileShareUrl(companionId: string): string {
  return buildShareUrl(`/profile/companion/${companionId}`);
}

export function communityPostShareUrl(postId: string): string {
  return buildShareUrl(`/community/post/${postId}`);
}

export async function shareUserProfileLink(userId: string): Promise<boolean> {
  return shareLink(userProfileShareUrl(userId), 'Check out this profile on Parul');
}

export async function shareCompanionProfileLink(companionId: string): Promise<boolean> {
  return shareLink(companionProfileShareUrl(companionId), 'Check out this companion on Parul');
}

export async function shareCommunityPostLink(postId: string): Promise<boolean> {
  return shareLink(communityPostShareUrl(postId), 'Check out this post on Parul');
}

// Legacy deep-link helpers kept for any internal navigation use.
export function userProfileDeepLink(userId: string): string {
  return userProfileShareUrl(userId);
}

export function companionProfileDeepLink(companionId: string): string {
  return companionProfileShareUrl(companionId);
}

export function communityPostDeepLink(postId: string): string {
  return communityPostShareUrl(postId);
}
