import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAdoption, type ChatThread } from '../../context/AdoptionContext';
import type { CirclesStackParamList } from '../../navigation/CirclesNavigator';
import { getRescueHelpContext, resolveRescueHelpContext } from '../../utils/rescueHelpChat';
import { ChatThreadScreen } from '../ChatThreadScreen';
import { getRootNavigation } from '../../navigation/notificationRouting';
import { openRescueCaseDetail } from '../../navigation/rescueCaseRouting';

type Route = RouteProp<CirclesStackParamList, 'ChatThread'>;
type Nav = NativeStackNavigationProp<CirclesStackParamList, 'ChatThread'>;

export function ChatThreadRouteScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const params = route.params;
  const { threads, messages, reloadThreads } = useAdoption();

  const contextThread = useMemo(
    () => threads.find(t => t.id === params.threadId),
    [threads, params.threadId],
  );

  const thread = useMemo((): ChatThread => {
    const base: ChatThread = contextThread ? { ...contextThread } : {
      id: params.threadId,
      participantId: params.participantId ?? '',
      participantName: params.participantName,
      participantHandle: params.participantHandle,
      participantTint: params.participantTint,
      participantAvatarUrl: params.participantAvatarUrl,
      participantAvatarFallbackUrl: params.participantAvatarFallbackUrl,
      participantAvatarOriginalUrl: params.participantAvatarOriginalUrl,
      preview: '',
      time: '',
      unread: 0,
      adoptionPostId: params.adoptionPostId,
      adoptionRecordId: params.adoptionRecordId,
    };

    const threadMessages = messages[params.threadId] ?? [];
    const rescueContext = base.rescueContext
      ?? getRescueHelpContext(params.threadId)
      ?? resolveRescueHelpContext(base, threadMessages);

    return rescueContext ? { ...base, rescueContext } : base;
  }, [
    contextThread,
    messages,
    params.threadId,
    params.participantId,
    params.participantName,
    params.participantHandle,
    params.participantTint,
    params.participantAvatarUrl,
    params.participantAvatarFallbackUrl,
    params.participantAvatarOriginalUrl,
    params.adoptionPostId,
    params.adoptionRecordId,
  ]);

  // Load the thread's messages once if they aren't cached yet (e.g. a brand-new
  // DM). Guarded so it fires at most once per thread — without this, a freshly
  // created thread that hasn't replicated yet keeps failing the hasOwnProperty
  // check, re-running reloadThreads on every `messages` change → a render loop
  // that (on mobile web) prevents the composer's first tap from opening the
  // keyboard.
  const reloadedForThreadRef = useRef<string | null>(null);
  useEffect(() => {
    if (Object.prototype.hasOwnProperty.call(messages, params.threadId)) {
      reloadedForThreadRef.current = null;
      return;
    }
    if (reloadedForThreadRef.current === params.threadId) return;
    reloadedForThreadRef.current = params.threadId;
    void reloadThreads();
  }, [messages, params.threadId, reloadThreads]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleViewRescueCase = useCallback((caseId: string) => {
    navigation.goBack();
    openRescueCaseDetail(getRootNavigation(navigation), caseId);
  }, [navigation]);

  const handleViewProfile = useCallback((userId: string) => {
    navigation.navigate('UserProfile', { userId, returnTo: 'Hub' });
  }, [navigation]);

  return (
    <ChatThreadScreen
      thread={thread}
      threadConnecting={params.threadConnecting ?? false}
      rescueCaseOriginId={params.rescueCaseOriginId}
      onClose={handleClose}
      onViewRescueCase={handleViewRescueCase}
      onViewProfile={handleViewProfile}
    />
  );
}
