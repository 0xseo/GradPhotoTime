import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type TabKey = "events" | "calendar" | "joined" | "my";
type RouteKey = TabKey | "create" | "access" | "eventManage";
type QuickAction = {
  label: string;
  route: RouteKey;
  tone: string;
};
type ScheduleItem = {
  date: string;
  group: string;
  startAt?: string;
  status: string;
  time: string;
  title: string;
};
type HostEventView = {
  approved: number;
  code: string;
  id: string;
  pending: number;
  range?: string;
  title: string;
};
type JoinedReservationView = {
  event: string;
  status: string;
  time: string;
};
type CreateEventPayload = {
  activeDates: string[];
  bufferTimeMinutes: number;
  dailyEndTime: string;
  dailyStartTime: string;
  dateEnd: string;
  dateStart: string;
  description: string;
  isBufferAfterActive: boolean;
  isBufferBeforeActive: boolean;
  title: string;
};
type ReviewReservationPayload = {
  eventId: string;
  reservationId: string;
  slotId: string;
  status: "APPROVED" | "PENDING";
};
type ApiResult<T> =
  | {
      data: T;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };
type MobileSession = {
  accessToken: string;
  expiresAt: number | null;
  refreshToken: string;
  user: MobileUser;
};
type MobileSignUpResult = {
  emailConfirmationRequired: boolean;
  message: string;
  session: MobileSession | null;
};
type MobileUser = {
  email: string | null;
  id: string;
};
type MobileDashboardSlot = {
  confirmed_end_at: string | null;
  confirmed_start_at: string | null;
  end_at: string;
  id: string;
  is_confirmed: boolean;
  priority_order: number;
  reservation_id: string;
  start_at: string;
};
type MobileDashboardParticipant = {
  created_at?: string;
  guest_name: string;
  id: string;
  is_creator: boolean;
  reservation_id: string;
  user_id: string | null;
};
type MobileHostedEvent = {
  approvedCount: number;
  buffer_time_minutes: number;
  confirmedSlots: MobileDashboardSlot[];
  daily_end_time: string;
  daily_start_time: string;
  date_end: string;
  date_start: string;
  event_code: string;
  id: string;
  is_buffer_active: boolean;
  is_buffer_after_active: boolean;
  is_buffer_before_active: boolean;
  participants: MobileDashboardParticipant[];
  pendingCount: number;
  pendingSlots: MobileDashboardSlot[];
  title: string;
};
type MobileGuestReservation = {
  created_at: string;
  event: {
    date_end: string;
    date_start: string;
    event_code: string;
    id: string;
    title: string;
  } | null;
  event_id: string;
  headcount: number;
  id: string;
  participants: MobileDashboardParticipant[];
  reservation_access_code: string;
  slots: MobileDashboardSlot[];
  status: "APPROVED" | "CANCELLED" | "PENDING" | "REJECTED";
};
type MobileDashboardData = {
  hostedEvents: MobileHostedEvent[];
  reservations: MobileGuestReservation[];
  user: MobileUser;
};
type AccessPreview =
  | {
      code: string;
      kind: "event";
      meta?: string;
      title: string;
      subtitle: string;
    }
  | {
      code: string;
      kind: "reservation";
      meta?: string;
      title: string;
      subtitle: string;
    };
type RenderContext = {
  accessPreview: AccessPreview | null;
  apiError: string | null;
  dashboard: MobileDashboardData | null;
  isApiLoading: boolean;
  onCreateEvent: (payload: CreateEventPayload) => Promise<void>;
  onOpenHostEvent: (eventId: string) => void;
  onRefreshDashboard: () => Promise<void>;
  onReviewReservation: (payload: ReviewReservationPayload) => Promise<void>;
  onResolveCode: (code: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (
    email: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<string>;
  selectedHostEventId: string | null;
  session: MobileSession | null;
};

declare const process: {
  env?: {
    EXPO_PUBLIC_API_BASE_URL?: string;
  };
};

const PRIMARY = "#00264B";
const PRIMARY_SOFT = "#EAF2FA";
const INK = "#111827";
const MUTED = "#6B7280";
const SUBTLE = "#9CA3AF";
const BORDER = "#E5E7EB";
const BACKGROUND = "#FFFFFF";
const SURFACE = "#F6F7F9";
const APPROVED = "#1F7A4D";
const PENDING = "#B7791F";
const API_BASE_URL =
  process.env?.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "https://grad-photo-time.vercel.app";
const SESSION_STORAGE_KEY = "grad-photo-time.mobile-session";
const MANAGE_TIMELINE_HOUR_HEIGHT = 58;
const MANAGE_TIMELINE_BLOCK_MIN_HEIGHT = 34;
const serifFont = Platform.select({
  android: "serif",
  ios: "Georgia",
  default: undefined,
});

const tabs: Array<{ key: TabKey; label: string; title: string; icon: string }> =
  [
    { key: "events", label: "내 이벤트", title: "내 이벤트", icon: "E" },
    { key: "calendar", label: "달력", title: "달력", icon: "C" },
    { key: "joined", label: "참여", title: "참여한 이벤트", icon: "J" },
    { key: "my", label: "My", title: "My", icon: "M" },
  ];

const schedules: ScheduleItem[] = [
  {
    date: "6/26 (금)",
    group: "민서 팀",
    title: "중앙도서관 졸업사진",
    time: "오후 02:00 - 오후 03:30",
    status: "확정",
  },
  {
    date: "6/28 (일)",
    group: "건우 팀",
    title: "본관 앞 촬영",
    time: "오전 10:00 - 오전 11:00",
    status: "대기",
  },
  {
    date: "7/2 (목)",
    group: "소연 팀",
    title: "공대 잔디밭",
    time: "오후 04:00 - 오후 05:00",
    status: "확정",
  },
];

const hostEvents: HostEventView[] = [
  {
    id: "demo-host-event-1",
    code: "GRA26A",
    pending: 4,
    approved: 2,
    title: "서연 졸업사진",
  },
  {
    id: "demo-host-event-2",
    code: "PHOTO9",
    pending: 2,
    approved: 1,
    title: "가족 촬영",
  },
];

const joinedReservations: JoinedReservationView[] = [
  {
    event: "서연 졸업사진",
    status: "확정",
    time: "6/26 (금) 오후 02:00 - 오후 03:30",
  },
  {
    event: "본관 앞 촬영",
    status: "대기",
    time: "6/28 (일) 오전 10:00 - 오전 11:00",
  },
];

class MobileApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MobileApiError";
    this.status = status;
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
) {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const result = (await response.json()) as ApiResult<T>;

  if (!response.ok || !result.ok) {
    throw new MobileApiError(
      result.ok ? "요청에 실패했습니다." : result.error,
      response.status,
    );
  }

  return result.data;
}

async function signIn(email: string, password: string) {
  return apiRequest<MobileSession>("/api/mobile/auth/sign-in", {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
}

async function signUp(
  email: string,
  password: string,
  passwordConfirm: string,
) {
  return apiRequest<MobileSignUpResult>("/api/mobile/auth/sign-up", {
    body: JSON.stringify({ email, password, passwordConfirm }),
    method: "POST",
  });
}

async function refreshSession(refreshToken: string) {
  return apiRequest<MobileSession>("/api/mobile/auth/refresh", {
    body: JSON.stringify({ refreshToken }),
    method: "POST",
  });
}

async function loadDashboard(token: string) {
  return apiRequest<MobileDashboardData>("/api/mobile/dashboard", { token });
}

async function createMobileEvent(payload: CreateEventPayload, token: string) {
  return apiRequest<{
    event: {
      event_code: string;
      id: string;
      title: string;
    };
  }>("/api/mobile/events", {
    body: JSON.stringify(payload),
    method: "POST",
    token,
  });
}

async function reviewMobileReservation(
  payload: ReviewReservationPayload,
  token: string,
) {
  return apiRequest<{ eventCode: string; reservationId: string }>(
    "/api/mobile/reservations/review",
    {
      body: JSON.stringify({
        confirmedSlotId: payload.slotId,
        eventId: payload.eventId,
        reservationId: payload.reservationId,
        status: payload.status,
      }),
      method: "POST",
      token,
    },
  );
}

async function resolveCode(code: string, token?: string) {
  return apiRequest<{
    code: string;
    isHost?: boolean;
    kind: "event" | "reservation";
    targetId: string;
  }>("/api/mobile/access/resolve", {
    body: JSON.stringify({ code }),
    method: "POST",
    token,
  });
}

async function loadEventPreview(eventCode: string) {
  const data = await apiRequest<{
    activeDates: string[];
    event: {
      date_end: string;
      date_start: string;
      description: string | null;
      event_code: string;
      id: string;
      title: string;
    };
    reservationSlots: unknown[];
    timeBlocks: unknown[];
  }>(`/api/mobile/events/${encodeURIComponent(eventCode)}`);

  return {
    code: data.event.event_code,
    kind: "event" as const,
    subtitle: `${formatDate(data.event.date_start)} - ${formatDate(data.event.date_end)} · 가능 시간 ${data.timeBlocks.length}개`,
    title: data.event.title,
  };
}

async function loadReservationPreview(accessCode: string) {
  const data = await apiRequest<{
    event: {
      title: string;
    };
    reservation: {
      reservation_access_code: string;
      slots: MobileDashboardSlot[];
      status: MobileGuestReservation["status"];
    };
  }>(`/api/mobile/reservations/${encodeURIComponent(accessCode)}`);
  const confirmed = data.reservation.slots.find((slot) => slot.is_confirmed);

  return {
    code: data.reservation.reservation_access_code,
    kind: "reservation" as const,
    subtitle: confirmed
      ? `확정 · ${formatRange(confirmed.confirmed_start_at ?? confirmed.start_at, confirmed.confirmed_end_at ?? confirmed.end_at)}`
      : `${statusLabel(data.reservation.status)} · 후보 ${data.reservation.slots.length}개`,
    title: data.event.title,
  };
}

async function saveStoredSession(session: MobileSession) {
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
}

async function loadStoredSession() {
  const rawSession = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as MobileSession;

    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

async function getUsableSession(session: MobileSession) {
  if (!shouldRefreshSession(session)) {
    return session;
  }

  return refreshSession(session.refreshToken);
}

async function loadDashboardWithSession(session: MobileSession) {
  let nextSession = await getUsableSession(session);

  try {
    return {
      dashboard: await loadDashboard(nextSession.accessToken),
      session: nextSession,
    };
  } catch (error) {
    if (!isUnauthorizedError(error)) {
      throw error;
    }

    nextSession = await refreshSession(session.refreshToken);

    return {
      dashboard: await loadDashboard(nextSession.accessToken),
      session: nextSession,
    };
  }
}

function isUnauthorizedError(error: unknown) {
  return error instanceof MobileApiError && error.status === 401;
}

function shouldRefreshSession(session: MobileSession) {
  if (!session.expiresAt) {
    return false;
  }

  return session.expiresAt * 1000 < Date.now() + 60_000;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NativeShell />
    </SafeAreaProvider>
  );
}

function NativeShell() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("calendar");
  const [accessPreview, setAccessPreview] = useState<AccessPreview | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<MobileDashboardData | null>(null);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [route, setRoute] = useState<RouteKey>("calendar");
  const [selectedHostEventId, setSelectedHostEventId] = useState<string | null>(
    null,
  );
  const [session, setSession] = useState<MobileSession | null>(null);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const quickActions = useMemo(() => getQuickActions(activeTab), [activeTab]);

  const title = getTitle(route, activeTab);
  const isBusy = isApiLoading || isRestoringSession;

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedSession = await loadStoredSession();

      try {
        if (!storedSession) {
          return;
        }

        const { dashboard: nextDashboard, session: nextSession } =
          await loadDashboardWithSession(storedSession);

        await saveStoredSession(nextSession);

        if (isMounted) {
          setSession(nextSession);
          setDashboard(nextDashboard);
        }
      } catch (error) {
        if (isUnauthorizedError(error)) {
          await clearStoredSession();
        }

        if (isMounted) {
          if (storedSession && !isUnauthorizedError(error)) {
            setSession(storedSession);
          }

          setApiError(
            isUnauthorizedError(error)
              ? "저장된 로그인 정보가 만료됐습니다."
              : "저장된 로그인으로 시작했지만 데이터를 새로 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  function openTab(tab: TabKey) {
    setActiveTab(tab);
    setRoute(tab);
    setSelectedHostEventId(null);
    setIsQuickOpen(false);
  }

  function openRoute(nextRoute: RouteKey) {
    setRoute(nextRoute);
    setIsQuickOpen(false);
  }

  function openHostEvent(eventId: string) {
    setActiveTab("events");
    setSelectedHostEventId(eventId);
    setRoute("eventManage");
    setIsQuickOpen(false);
  }

  function handleQuickPress() {
    if (quickActions.length === 1) {
      openRoute(quickActions[0].route);
      return;
    }

    setIsQuickOpen((current) => !current);
  }

  async function handleRefreshDashboard() {
    if (!session?.accessToken) {
      setApiError("로그인이 필요합니다.");
      return;
    }

    setApiError(null);
    setIsApiLoading(true);

    try {
      const { dashboard: nextDashboard, session: nextSession } =
        await loadDashboardWithSession(session);

      setSession(nextSession);
      await saveStoredSession(nextSession);
      setDashboard(nextDashboard);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await clearStoredSession();
        setSession(null);
        setDashboard(null);
      }

      setApiError(
        error instanceof Error
          ? error.message
          : "대시보드를 새로고침하지 못했습니다.",
      );
    } finally {
      setIsApiLoading(false);
    }
  }

  async function handleSignUp(
    email: string,
    password: string,
    passwordConfirm: string,
  ) {
    setApiError(null);
    setIsApiLoading(true);

    try {
      const result = await signUp(email, password, passwordConfirm);

      if (result.session) {
        const { dashboard: nextDashboard, session: nextSession } =
          await loadDashboardWithSession(result.session);

        await saveStoredSession(nextSession);
        setSession(nextSession);
        setDashboard(nextDashboard);
        setActiveTab("calendar");
        setRoute("calendar");
      }

      return result.message;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "가입에 실패했습니다.";

      setApiError(message);
      return message;
    } finally {
      setIsApiLoading(false);
    }
  }

  async function handleSignIn(email: string, password: string) {
    setApiError(null);
    setIsApiLoading(true);

    try {
      const nextSession = await signIn(email, password);
      const { dashboard: nextDashboard, session: usableSession } =
        await loadDashboardWithSession(nextSession);

      await saveStoredSession(usableSession);
      setSession(usableSession);
      setDashboard(nextDashboard);
      setActiveTab("calendar");
      setRoute("calendar");
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "로그인에 실패했습니다.",
      );
    } finally {
      setIsApiLoading(false);
    }
  }

  async function handleSignOut() {
    await clearStoredSession();
    setSession(null);
    setDashboard(null);
    setApiError(null);
    setActiveTab("my");
    setRoute("my");
  }

  async function handleCreateEvent(payload: CreateEventPayload) {
    if (!session?.accessToken) {
      setApiError("로그인이 필요합니다.");
      return;
    }

    setApiError(null);
    setIsApiLoading(true);

    try {
      let nextSession = await getUsableSession(session);

      try {
        await createMobileEvent(payload, nextSession.accessToken);
      } catch (error) {
        if (!isUnauthorizedError(error)) {
          throw error;
        }

        nextSession = await refreshSession(session.refreshToken);
        await createMobileEvent(payload, nextSession.accessToken);
      }

      const { dashboard: nextDashboard, session: dashboardSession } =
        await loadDashboardWithSession(nextSession);

      setDashboard(nextDashboard);
      setSession(dashboardSession);
      await saveStoredSession(dashboardSession);
      setActiveTab("events");
      setRoute("events");
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "이벤트 생성에 실패했습니다.",
      );
    } finally {
      setIsApiLoading(false);
    }
  }

  async function handleReviewReservation(payload: ReviewReservationPayload) {
    if (!session?.accessToken) {
      setApiError("로그인이 필요합니다.");
      return;
    }

    setApiError(null);
    setIsApiLoading(true);

    try {
      let nextSession = await getUsableSession(session);

      try {
        await reviewMobileReservation(payload, nextSession.accessToken);
      } catch (error) {
        if (!isUnauthorizedError(error)) {
          throw error;
        }

        nextSession = await refreshSession(session.refreshToken);
        await reviewMobileReservation(payload, nextSession.accessToken);
      }

      const { dashboard: nextDashboard, session: dashboardSession } =
        await loadDashboardWithSession(nextSession);

      setDashboard(nextDashboard);
      setSession(dashboardSession);
      await saveStoredSession(dashboardSession);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "예약을 처리하지 못했습니다.",
      );
    } finally {
      setIsApiLoading(false);
    }
  }

  async function handleResolveCode(code: string) {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setApiError("코드를 입력해 주세요.");
      return;
    }

    setAccessPreview(null);
    setApiError(null);
    setIsApiLoading(true);

    try {
      const nextSession = session ? await getUsableSession(session) : null;

      if (nextSession && nextSession !== session) {
        setSession(nextSession);
        await saveStoredSession(nextSession);
      }

      const resolved = await resolveCode(
        trimmedCode,
        nextSession?.accessToken,
      );
      const preview =
        resolved.kind === "event"
          ? await loadEventPreview(resolved.code)
          : await loadReservationPreview(resolved.code);

      setAccessPreview({
        ...preview,
        meta:
          resolved.kind === "event" && resolved.isHost
            ? "내가 만든 이벤트"
            : undefined,
      });
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "코드를 확인하지 못했습니다.",
      );
    } finally {
      setIsApiLoading(false);
    }
  }

  const renderContext: RenderContext = {
    accessPreview,
    apiError,
    dashboard,
    isApiLoading: isBusy,
    onCreateEvent: handleCreateEvent,
    onOpenHostEvent: openHostEvent,
    onRefreshDashboard: handleRefreshDashboard,
    onReviewReservation: handleReviewReservation,
    onResolveCode: handleResolveCode,
    onSignOut: handleSignOut,
    onSignIn: handleSignIn,
    onSignUp: handleSignUp,
    selectedHostEventId,
    session,
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar backgroundColor={BACKGROUND} barStyle="dark-content" />
      <View style={styles.app}>
        <Header
          onBack={() => openTab(activeTab)}
          route={route}
          title={title}
        />
        <View style={styles.body}>{renderRoute(route, renderContext)}</View>

        {isQuickOpen ? (
          <Pressable
            accessibilityLabel="빠른 작업 닫기"
            onPress={() => setIsQuickOpen(false)}
            style={styles.scrim}
          />
        ) : null}

        <View
          pointerEvents="box-none"
          style={[styles.quickLayer, { bottom: insets.bottom + 88 }]}
        >
          {isQuickOpen ? (
            <View style={styles.quickMenu}>
              {quickActions.map((action) => (
                <Pressable
                  accessibilityRole="button"
                  key={action.label}
                  onPress={() => openRoute(action.route)}
                  style={({ pressed }) => [
                    styles.quickAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.quickIcon,
                      { backgroundColor: action.tone },
                    ]}
                  >
                    <Text style={styles.quickIconText}>+</Text>
                  </View>
                  <Text style={styles.quickActionText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="빠른 작업"
            accessibilityRole="button"
            onPress={handleQuickPress}
            style={({ pressed }) => [
              styles.quickButton,
              isQuickOpen && styles.quickButtonOpen,
              pressed && styles.quickButtonPressed,
            ]}
          >
            <Text style={styles.quickButtonText}>
              {isQuickOpen ? "x" : "+"}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.tabBarOuter,
            { paddingBottom: Math.max(insets.bottom, 8) },
          ]}
        >
          <View style={styles.tabBar}>
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab && route === tab.key;

              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  key={tab.key}
                  onPress={() => openTab(tab.key)}
                  style={({ pressed }) => [
                    styles.tab,
                    isActive && styles.activeTab,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.tabIcon,
                      isActive && styles.activeTabIcon,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabIconText,
                        isActive && styles.activeTabIconText,
                      ]}
                    >
                      {tab.icon}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabLabel,
                      isActive && styles.activeTabLabel,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Header({
  route,
  title,
  onBack,
}: {
  route: RouteKey;
  title: string;
  onBack: () => void;
}) {
  const isModalRoute =
    route === "create" || route === "access" || route === "eventManage";

  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {isModalRoute ? (
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [
              styles.headerBack,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.headerBackText}>‹</Text>
          </Pressable>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Text>
      <View style={styles.headerSide} />
    </View>
  );
}

function renderRoute(route: RouteKey, context: RenderContext) {
  if (route === "events") {
    return (
      <HostEventsScreen
        dashboard={context.dashboard}
        isLoading={context.isApiLoading}
        onOpenEvent={context.onOpenHostEvent}
        onRefresh={context.onRefreshDashboard}
        session={context.session}
      />
    );
  }

  if (route === "eventManage") {
    return (
      <HostEventManageScreen
        event={
          context.dashboard?.hostedEvents.find(
            (event) => event.id === context.selectedHostEventId,
          ) ?? null
        }
        isLoading={context.isApiLoading}
        onRefresh={context.onRefreshDashboard}
        onReviewReservation={context.onReviewReservation}
        session={context.session}
      />
    );
  }

  if (route === "joined") {
    return (
      <JoinedScreen
        dashboard={context.dashboard}
        isLoading={context.isApiLoading}
        onRefresh={context.onRefreshDashboard}
        session={context.session}
      />
    );
  }

  if (route === "my") {
    return (
      <MyScreen
        apiError={context.apiError}
        dashboard={context.dashboard}
        isLoading={context.isApiLoading}
        onRefresh={context.onRefreshDashboard}
        onSignOut={context.onSignOut}
        onSignIn={context.onSignIn}
        onSignUp={context.onSignUp}
        session={context.session}
      />
    );
  }

  if (route === "create") {
    return (
      <CreateEventScreen
        apiError={context.apiError}
        isLoading={context.isApiLoading}
        onCreateEvent={context.onCreateEvent}
        session={context.session}
      />
    );
  }

  if (route === "access") {
    return (
      <AccessScreen
        accessPreview={context.accessPreview}
        apiError={context.apiError}
        isLoading={context.isApiLoading}
        onResolveCode={context.onResolveCode}
      />
    );
  }

  return (
    <CalendarScreen
      dashboard={context.dashboard}
      isLoading={context.isApiLoading}
      onRefresh={context.onRefreshDashboard}
      session={context.session}
    />
  );
}

function CalendarScreen({
  dashboard,
  isLoading,
  onRefresh,
  session,
}: {
  dashboard: MobileDashboardData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  session: MobileSession | null;
}) {
  const items = useMemo(() => buildSchedulesFromDashboard(dashboard), [dashboard]);

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      refreshControl={
        session ? (
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      <MonthCard dashboard={dashboard} />
      <SectionHeader title="다가오는 일정" />
      {isLoading ? <LoadingCard label="일정을 불러오는 중" /> : null}
      {!session ? (
        <EmptyCard
          detail="My 탭에서 이메일로 로그인하면 내 확정 일정과 대기 후보가 여기에 표시됩니다."
          title="로그인이 필요해요"
        />
      ) : null}
      {session && items.length === 0 && !isLoading ? (
        <EmptyCard
          detail="호스트 확정 일정, 참여한 예약, 대기 후보가 생기면 달력에 바로 표시됩니다."
          title="아직 표시할 일정이 없어요"
        />
      ) : null}
      {(session ? items : schedules).map((item) => (
        <ScheduleCard key={`${item.date}-${item.title}`} item={item} />
      ))}
    </ScrollView>
  );
}

function MonthCard({
  dashboard,
}: {
  dashboard: MobileDashboardData | null;
}) {
  const today = useMemo(() => new Date(), []);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const days = useMemo(() => buildMonthDays(today), [today]);
  const monthItems = useMemo(
    () => (dashboard ? buildSchedulesFromDashboard(dashboard) : schedules),
    [dashboard],
  );
  const schedulesByDate = useMemo(
    () => buildSchedulesByDate(monthItems, today),
    [monthItems, today],
  );
  const markers = useMemo(
    () => buildMonthMarkers(dashboard, today),
    [dashboard, today],
  );
  const monthTitle = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
  const selectedItems = selectedDateKey
    ? schedulesByDate.get(selectedDateKey) ?? []
    : [];

  return (
    <View style={styles.monthCard}>
      <View style={styles.monthHeader}>
        <Text style={styles.monthTitle}>{monthTitle}</Text>
        <Text style={styles.monthToday}>오늘</Text>
      </View>
      <View style={styles.weekRow}>
        {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
          <Text
            key={day}
            style={[
              styles.weekLabel,
              index === 0 && styles.sundayText,
              index === 6 && styles.saturdayText,
            ]}
          >
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {days.map((day, index) => {
          const isToday =
            day === today.getDate() &&
            today.getMonth() === new Date().getMonth() &&
            today.getFullYear() === new Date().getFullYear();
          const dayKey =
            day === null
              ? ""
              : buildDateKey(
                  new Date(today.getFullYear(), today.getMonth(), day),
                );
          const isSelected = selectedDateKey === dayKey;
          const hasApproved = dashboard
            ? markers.approved.has(dayKey)
            : [8, 18, 26].includes(day ?? -1);
          const hasPending = dashboard
            ? markers.pending.has(dayKey)
            : [13, 28].includes(day ?? -1);

          if (!day) {
            return (
              <View
                key={`blank-${index}`}
                style={styles.dayCell}
              />
            );
          }

          return (
            <Pressable
              accessibilityLabel={`${day}일 일정 보기`}
              accessibilityRole="button"
              key={`${day}-${index}`}
              onPress={() => setSelectedDateKey(dayKey)}
              style={({ pressed }) => [
                styles.dayCell,
                isToday && styles.todayCell,
                isSelected && styles.selectedDayCell,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  index % 7 === 0 && styles.sundayText,
                  index % 7 === 6 && styles.saturdayText,
                  (isToday || isSelected) && styles.todayText,
                ]}
              >
                {day}
              </Text>
              <View style={styles.dayDots}>
                {hasApproved ? <View style={styles.approvedDot} /> : null}
                {hasPending ? <View style={styles.pendingDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {selectedDateKey && selectedItems.length > 0 ? (
        <View style={styles.dayPreview}>
          <View style={styles.dayPreviewHeader}>
            <Text style={styles.dayPreviewTitle}>
              {formatDateKeyLabel(selectedDateKey)}
            </Text>
            <Text style={styles.dayPreviewCount}>
              {selectedItems.length > 0
                ? `일정 ${selectedItems.length}개`
                : "일정 없음"}
            </Text>
          </View>
          {selectedItems.map((item, index) => (
              <View
                key={`${item.title}-${item.time}-${index}`}
                style={styles.dayPreviewItem}
              >
                <View style={styles.dayPreviewTop}>
                  <Text numberOfLines={1} style={styles.dayPreviewItemTitle}>
                    {item.title}
                  </Text>
                  <StatusPill
                    approved={item.status === "확정"}
                    label={item.status}
                  />
                </View>
                <Text style={styles.dayPreviewTime}>{item.time}</Text>
                <Text style={styles.dayPreviewRole}>{item.group}</Text>
              </View>
            ))}
        </View>
      ) : null}
    </View>
  );
}

function ScheduleCard({
  item,
}: {
  item: ScheduleItem;
}) {
  const approved = item.status === "확정";

  return (
    <View style={styles.scheduleCard}>
      <View style={styles.scheduleTop}>
        <View>
          <Text style={styles.scheduleDate}>{item.date}</Text>
          <Text style={styles.scheduleTitle}>{item.title}</Text>
        </View>
        <StatusPill approved={approved} label={item.status} />
      </View>
      <Text style={styles.scheduleTime}>{item.time}</Text>
      <Text style={styles.scheduleGroup}>{item.group}</Text>
    </View>
  );
}

function HostEventsScreen({
  dashboard,
  isLoading,
  onOpenEvent,
  onRefresh,
  session,
}: {
  dashboard: MobileDashboardData | null;
  isLoading: boolean;
  onOpenEvent: (eventId: string) => void;
  onRefresh: () => Promise<void>;
  session: MobileSession | null;
}) {
  const events = useMemo(() => buildHostedEventViews(dashboard), [dashboard]);

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      refreshControl={
        session ? (
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader title="관리 중" />
      {isLoading ? <LoadingCard label="내 이벤트를 불러오는 중" /> : null}
      {!session ? (
        <EmptyCard
          detail="My 탭에서 로그인하면 내가 만든 이벤트가 여기에 표시됩니다."
          title="로그인이 필요해요"
        />
      ) : null}
      {session && events.length === 0 && !isLoading ? (
        <EmptyCard
          detail="오른쪽 아래 + 버튼으로 새 이벤트를 만들 수 있어요."
          title="아직 만든 이벤트가 없어요"
        />
      ) : null}
      {(session ? events : hostEvents).map((event) => (
        <Pressable
          accessibilityLabel={`${event.title} 관리`}
          accessibilityRole="button"
          disabled={!session}
          key={event.code}
          onPress={() => onOpenEvent(event.id)}
          style={({ pressed }) => [
            styles.eventCard,
            pressed && session && styles.pressed,
          ]}
        >
          <View style={styles.eventTop}>
            <View>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventCode}>{event.code}</Text>
              {event.range ? (
                <Text style={styles.eventRange}>{event.range}</Text>
              ) : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
          <View style={styles.statRow}>
            <Stat label="확정" value={event.approved} tone={APPROVED} />
            <Stat label="대기" value={event.pending} tone={PENDING} />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function HostEventManageScreen({
  event,
  isLoading,
  onRefresh,
  onReviewReservation,
  session,
}: {
  event: MobileHostedEvent | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onReviewReservation: (payload: ReviewReservationPayload) => Promise<void>;
  session: MobileSession | null;
}) {
  const confirmedSlots = useMemo(
    () => sortSlots(event?.confirmedSlots ?? []),
    [event?.confirmedSlots],
  );
  const pendingSlots = useMemo(
    () => sortSlots(event?.pendingSlots ?? []),
    [event?.pendingSlots],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      refreshControl={
        session ? (
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      {!session ? (
        <EmptyCard
          detail="My 탭에서 로그인한 뒤 이벤트를 관리할 수 있어요."
          title="로그인이 필요해요"
        />
      ) : null}
      {session && !event ? (
        <EmptyCard
          detail="아래로 당겨 새로고침하거나 내 이벤트 목록에서 다시 선택해 주세요."
          title="이벤트를 찾지 못했어요"
        />
      ) : null}
      {event ? (
        <>
          <View style={styles.manageHero}>
            <View style={styles.manageTitleRow}>
              <View style={styles.manageTitleBlock}>
                <Text style={styles.manageEyebrow}>HOST EVENT</Text>
                <Text style={styles.manageTitle}>{event.title}</Text>
              </View>
              <Text style={styles.manageCode}>{event.event_code}</Text>
            </View>
            <Text style={styles.manageMeta}>
              {formatDate(event.date_start)} - {formatDate(event.date_end)}
            </Text>
            <Text style={styles.manageMeta}>
              {formatTimeFromClock(event.daily_start_time)} -{" "}
              {formatTimeFromClock(event.daily_end_time)}
            </Text>
            <View style={styles.statRow}>
              <Stat
                label="확정"
                value={event.approvedCount}
                tone={APPROVED}
              />
              <Stat label="대기" value={event.pendingCount} tone={PENDING} />
            </View>
            <View style={styles.bufferSummary}>
              <Text style={styles.bufferSummaryLabel}>버퍼</Text>
              <Text style={styles.bufferSummaryValue}>
                {event.is_buffer_active
                  ? `${event.buffer_time_minutes}분 · ${formatBufferDirections(event)}`
                  : "사용 안함"}
              </Text>
            </View>
          </View>

          <HostEventCalendar event={event} />

          <SectionHeader title="확정 일정" />
          {confirmedSlots.length > 0 ? (
            confirmedSlots.map((slot) => (
              <HostSlotCard
                event={event}
                isLoading={isLoading}
                key={slot.id}
                onReviewReservation={onReviewReservation}
                slot={slot}
              />
            ))
          ) : (
            <EmptyCard
              detail="승인한 일정이 생기면 여기에 표시됩니다."
              title="확정 일정이 없어요"
            />
          )}

          <SectionHeader title="대기 후보" />
          {pendingSlots.length > 0 ? (
            pendingSlots.map((slot) => (
              <HostSlotCard
                event={event}
                isLoading={isLoading}
                key={slot.id}
                onReviewReservation={onReviewReservation}
                slot={slot}
              />
            ))
          ) : (
            <EmptyCard
              detail="예약자가 후보 시간을 신청하면 여기에 표시됩니다."
              title="대기 후보가 없어요"
            />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function HostEventCalendar({ event }: { event: MobileHostedEvent }) {
  const eventDates = useMemo(
    () => buildDateList(event.date_start, event.date_end),
    [event.date_end, event.date_start],
  );
  const todayKey = buildDateKey(new Date());
  const initialDate = eventDates.includes(todayKey)
    ? todayKey
    : eventDates[0] ?? event.date_start;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const currentDate = eventDates.includes(selectedDate)
    ? selectedDate
    : initialDate;
  const allSlots = useMemo(
    () => sortSlots([...event.confirmedSlots, ...event.pendingSlots]),
    [event.confirmedSlots, event.pendingSlots],
  );
  const visibleSlots = useMemo(
    () =>
      allSlots
        .map((slot) => ({
          slot,
          overlap: getSlotOverlapMinutes(slot, currentDate),
        }))
        .filter(
          (
            item,
          ): item is {
            overlap: { end: number; start: number };
            slot: MobileDashboardSlot;
          } => item.overlap !== null,
        ),
    [allSlots, currentDate],
  );
  const timelineBounds = useMemo(
    () => buildManageTimelineBounds(event, currentDate, allSlots),
    [allSlots, currentDate, event],
  );
  const timelineRows = useMemo(
    () => buildTimelineRows(timelineBounds.start, timelineBounds.end),
    [timelineBounds.end, timelineBounds.start],
  );
  const timelineHeight = Math.max(
    ((timelineBounds.end - timelineBounds.start) / 60) *
      MANAGE_TIMELINE_HOUR_HEIGHT,
    MANAGE_TIMELINE_HOUR_HEIGHT,
  );

  return (
    <View style={styles.manageCalendarCard}>
      <View style={styles.manageCalendarHeader}>
        <View>
          <Text style={styles.manageCalendarEyebrow}>CALENDAR</Text>
          <Text style={styles.manageCalendarTitle}>일정 달력</Text>
        </View>
        <Text style={styles.manageCalendarCount}>
          {visibleSlots.length > 0 ? `${visibleSlots.length}개` : "비어 있음"}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.manageDateScroller}
      >
        <View style={styles.manageDateChipRow}>
          {eventDates.map((dateKey) => {
            const parsedDate = parseDateValue(dateKey);
            const isSelected = dateKey === currentDate;
            const isToday = dateKey === todayKey;
            const weekday = parsedDate.getDay();

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={dateKey}
                onPress={() => setSelectedDate(dateKey)}
                style={({ pressed }) => [
                  styles.manageDateChip,
                  isSelected && styles.manageDateChipActive,
                  isToday && !isSelected && styles.manageDateChipToday,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.manageDateChipDate,
                    weekday === 0 && styles.sundayText,
                    weekday === 6 && styles.saturdayText,
                    isSelected && styles.manageDateChipDateActive,
                  ]}
                >
                  {formatShortDate(dateKey)}
                </Text>
                <Text
                  style={[
                    styles.manageDateChipWeekday,
                    weekday === 0 && styles.sundayText,
                    weekday === 6 && styles.saturdayText,
                    isSelected && styles.manageDateChipWeekdayActive,
                  ]}
                >
                  {formatWeekday(dateKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.manageTimeline}>
        <View style={styles.manageTimelineTimeColumn}>
          {timelineRows.map((minute) => (
            <View
              key={minute}
              style={[
                styles.manageTimelineTimeSlot,
                { height: MANAGE_TIMELINE_HOUR_HEIGHT },
              ]}
            >
              <Text style={styles.manageTimelineTimeText}>
                {formatTimelineHour(minute)}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.manageTimelineLane, { height: timelineHeight }]}>
          {timelineRows.map((minute) => (
            <View
              key={minute}
              style={[
                styles.manageTimelineHourLine,
                { height: MANAGE_TIMELINE_HOUR_HEIGHT },
              ]}
            >
              <View style={styles.manageTimelineHalfLine} />
            </View>
          ))}
          {visibleSlots.map(({ overlap, slot }) => {
            const participants = getParticipantsForSlot(event, slot);
            const participantLabel =
              participants.length > 0 ? participants.join(", ") : "참여자 없음";
            const top =
              ((overlap.start - timelineBounds.start) / 60) *
                MANAGE_TIMELINE_HOUR_HEIGHT +
              4;
            const height = Math.max(
              ((overlap.end - overlap.start) / 60) *
                MANAGE_TIMELINE_HOUR_HEIGHT -
                8,
              MANAGE_TIMELINE_BLOCK_MIN_HEIGHT,
            );

            return (
              <View
                key={slot.id}
                style={[
                  styles.manageTimelineBlock,
                  slot.is_confirmed
                    ? styles.manageTimelineBlockApproved
                    : styles.manageTimelineBlockPending,
                  { height, top },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.manageTimelineBlockTitle,
                    slot.is_confirmed &&
                      styles.manageTimelineBlockTitleApproved,
                  ]}
                >
                  {participantLabel}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.manageTimelineBlockMeta,
                    slot.is_confirmed &&
                      styles.manageTimelineBlockMetaApproved,
                  ]}
                >
                  {slot.is_confirmed
                    ? "확정"
                    : `후보 ${slot.priority_order}`}{" "}
                  · {formatTimeRange(getSlotDisplayStart(slot), getSlotDisplayEnd(slot))}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function HostSlotCard({
  event,
  isLoading,
  onReviewReservation,
  slot,
}: {
  event: MobileHostedEvent;
  isLoading: boolean;
  onReviewReservation: (payload: ReviewReservationPayload) => Promise<void>;
  slot: MobileDashboardSlot;
}) {
  const participants = getParticipantsForSlot(event, slot);
  const participantLabel =
    participants.length > 0 ? participants.join(", ") : "참여자 없음";
  const displayStart = slot.is_confirmed
    ? slot.confirmed_start_at ?? slot.start_at
    : slot.start_at;
  const displayEnd = slot.is_confirmed
    ? slot.confirmed_end_at ?? slot.end_at
    : slot.end_at;
  const nextStatus = slot.is_confirmed ? "PENDING" : "APPROVED";

  return (
    <View style={styles.hostSlotCard}>
      <View style={styles.hostSlotTop}>
        <View style={styles.hostSlotTitleBlock}>
          <Text numberOfLines={1} style={styles.hostSlotTitle}>
            {participantLabel}
          </Text>
          <Text style={styles.hostSlotMeta}>
            {participants.length > 0 ? `${participants.length}명` : "인원 미정"}
          </Text>
        </View>
        <StatusPill
          approved={slot.is_confirmed}
          label={slot.is_confirmed ? "확정" : `후보 ${slot.priority_order}`}
        />
      </View>
      <Text style={styles.hostSlotTime}>
        {formatRange(displayStart, displayEnd)}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={isLoading}
        onPress={() =>
          onReviewReservation({
            eventId: event.id,
            reservationId: slot.reservation_id,
            slotId: slot.id,
            status: nextStatus,
          })
        }
        style={({ pressed }) => [
          styles.slotActionButton,
          slot.is_confirmed && styles.slotActionButtonGhost,
          isLoading && styles.primaryButtonDisabled,
          pressed && !isLoading && styles.pressed,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator color={slot.is_confirmed ? PRIMARY : BACKGROUND} />
        ) : (
          <Text
            style={[
              styles.slotActionText,
              slot.is_confirmed && styles.slotActionTextGhost,
            ]}
          >
            {slot.is_confirmed ? "확정 취소" : "승인"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function JoinedScreen({
  dashboard,
  isLoading,
  onRefresh,
  session,
}: {
  dashboard: MobileDashboardData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  session: MobileSession | null;
}) {
  const reservations = useMemo(
    () => buildJoinedReservationViews(dashboard),
    [dashboard],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      refreshControl={
        session ? (
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader title="내 예약" />
      {isLoading ? <LoadingCard label="내 예약을 불러오는 중" /> : null}
      {!session ? (
        <EmptyCard
          detail="My 탭에서 로그인하면 내가 만든 예약과 참여한 예약이 표시됩니다."
          title="로그인이 필요해요"
        />
      ) : null}
      {session && reservations.length === 0 && !isLoading ? (
        <EmptyCard
          detail="오른쪽 아래 + 버튼으로 이벤트 코드나 예약 관리 코드를 열 수 있어요."
          title="아직 참여한 예약이 없어요"
        />
      ) : null}
      {(session ? reservations : joinedReservations).map((reservation) => (
        <View
          key={`${reservation.event}-${reservation.time}`}
          style={styles.reservationCard}
        >
          <View style={styles.scheduleTop}>
            <Text style={styles.eventTitle}>{reservation.event}</Text>
            <StatusPill
              approved={reservation.status === "확정"}
              label={reservation.status}
            />
          </View>
          <Text style={styles.scheduleTime}>{reservation.time}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function MyScreen({
  apiError,
  dashboard,
  isLoading,
  onRefresh,
  onSignOut,
  onSignIn,
  onSignUp,
  session,
}: {
  apiError: string | null;
  dashboard: MobileDashboardData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (
    email: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<string>;
  session: MobileSession | null;
}) {
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const displayEmail = session?.user.email ?? "로그인 필요";
  const initial = displayEmail.slice(0, 1).toUpperCase();

  async function handleSubmit() {
    setNotice(null);

    if (!email.trim() || !password) {
      setLocalError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    if (authMode === "signUp" && password !== passwordConfirm) {
      setLocalError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setLocalError(null);

    if (authMode === "signUp") {
      setNotice(await onSignUp(email.trim(), password, passwordConfirm));
      return;
    }

    await onSignIn(email.trim(), password);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        session ? (
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{session ? initial : "M"}</Text>
        </View>
        <Text style={styles.profileName}>
          {session
            ? "로그인됨"
            : authMode === "signUp"
              ? "이메일 회원가입"
              : "이메일 로그인"}
        </Text>
        <Text style={styles.profileEmail}>
          {session ? displayEmail : "가입한 이메일과 비밀번호를 입력하세요"}
        </Text>
      </View>

      {!session ? (
        <View style={styles.formCard}>
          <View style={styles.authSwitch}>
            <Pressable
              onPress={() => {
                setAuthMode("signIn");
                setLocalError(null);
                setNotice(null);
              }}
              style={[
                styles.authSwitchButton,
                authMode === "signIn" && styles.authSwitchButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.authSwitchText,
                  authMode === "signIn" && styles.authSwitchTextActive,
                ]}
              >
                로그인
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAuthMode("signUp");
                setLocalError(null);
                setNotice(null);
              }}
              style={[
                styles.authSwitchButton,
                authMode === "signUp" && styles.authSwitchButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.authSwitchText,
                  authMode === "signUp" && styles.authSwitchTextActive,
                ]}
              >
                가입
              </Text>
            </Pressable>
          </View>
          <Text style={styles.formLabel}>이메일</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={SUBTLE}
            style={styles.input}
            value={email}
          />
          <Text style={styles.formLabel}>비밀번호</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="8자 이상"
            placeholderTextColor={SUBTLE}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {authMode === "signUp" ? (
            <>
              <Text style={styles.formLabel}>비밀번호 확인</Text>
              <TextInput
                onChangeText={setPasswordConfirm}
                placeholder="비밀번호를 한 번 더 입력"
                placeholderTextColor={SUBTLE}
                secureTextEntry
                style={styles.input}
                value={passwordConfirm}
              />
              <View style={styles.passwordHintBox}>
                <Text
                  style={[
                    styles.passwordHintText,
                    password.length >= 8 && styles.passwordHintTextPassed,
                  ]}
                >
                  {password.length >= 8 ? "✓" : "•"} 비밀번호 8자 이상
                </Text>
                <Text
                  style={[
                    styles.passwordHintText,
                    password !== "" &&
                      password === passwordConfirm &&
                      styles.passwordHintTextPassed,
                  ]}
                >
                  {password !== "" && password === passwordConfirm ? "✓" : "•"}{" "}
                  비밀번호 확인 일치
                </Text>
              </View>
            </>
          ) : null}
          {localError || apiError ? (
            <Text style={styles.errorText}>{localError ?? apiError}</Text>
          ) : null}
          {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
          <PrimaryAction
            disabled={isLoading}
            label={authMode === "signUp" ? "가입하기" : "로그인"}
            loading={isLoading}
            onPress={handleSubmit}
          />
        </View>
      ) : (
        <View style={styles.settingList}>
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>내 이벤트</Text>
            <Text style={styles.settingValue}>
              {dashboard?.hostedEvents.length ?? 0}개
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>내 예약</Text>
            <Text style={styles.settingValue}>
              {dashboard?.reservations.length ?? 0}개
            </Text>
          </View>
          <Pressable onPress={onSignOut} style={styles.settingRow}>
            <Text style={styles.signOutText}>로그아웃</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function CreateEventScreen({
  apiError,
  isLoading,
  onCreateEvent,
  session,
}: {
  apiError: string | null;
  isLoading: boolean;
  onCreateEvent: (payload: CreateEventPayload) => Promise<void>;
  session: MobileSession | null;
}) {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [bufferBefore, setBufferBefore] = useState(true);
  const [bufferAfter, setBufferAfter] = useState(true);
  const [bufferMinutes, setBufferMinutes] = useState("30");
  const [dailyEndTime, setDailyEndTime] = useState("18:00");
  const [dailyStartTime, setDailyStartTime] = useState("09:00");
  const [dateEnd, setDateEnd] = useState(today);
  const [dateStart, setDateStart] = useState(today);
  const [description, setDescription] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  async function handleSubmit() {
    setLocalError(null);

    if (!session) {
      setLocalError("로그인이 필요합니다.");
      return;
    }

    if (!isDateInputValue(dateStart) || !isDateInputValue(dateEnd)) {
      setLocalError("날짜는 YYYY-MM-DD 형식으로 입력해 주세요.");
      return;
    }

    if (dateStart > dateEnd) {
      setLocalError("시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }

    if (!isTimeInputValue(dailyStartTime) || !isTimeInputValue(dailyEndTime)) {
      setLocalError("시간은 HH:MM 형식으로 입력해 주세요.");
      return;
    }

    if (dailyStartTime >= dailyEndTime) {
      setLocalError("시작 시간은 종료 시간보다 빨라야 합니다.");
      return;
    }

    await onCreateEvent({
      activeDates: buildDateList(dateStart, dateEnd),
      bufferTimeMinutes: Number.parseInt(bufferMinutes, 10) || 0,
      dailyEndTime,
      dailyStartTime,
      dateEnd,
      dateStart,
      description,
      isBufferAfterActive: bufferAfter,
      isBufferBeforeActive: bufferBefore,
      title,
    });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {!session ? (
        <EmptyCard
          detail="My 탭에서 로그인한 뒤 이벤트를 만들 수 있어요."
          title="로그인이 필요해요"
        />
      ) : null}
      <View style={styles.formCard}>
        <Text style={styles.formLabel}>이벤트명</Text>
        <TextInput
          onChangeText={setTitle}
          placeholder="졸업사진 일정"
          placeholderTextColor={SUBTLE}
          style={styles.input}
          value={title}
        />

        <Text style={styles.formLabel}>설명</Text>
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="촬영 장소나 준비물을 적어두세요"
          placeholderTextColor={SUBTLE}
          style={[styles.input, styles.textArea]}
          value={description}
        />
      </View>

      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>일정</Text>
          <Text style={styles.formMeta}>YYYY-MM-DD</Text>
        </View>
        <View style={styles.formTwoColumn}>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>시작일</Text>
            <TextInput
              keyboardType="numbers-and-punctuation"
              onChangeText={setDateStart}
              placeholder="2026-06-26"
              placeholderTextColor={SUBTLE}
              style={styles.input}
              value={dateStart}
            />
          </View>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>종료일</Text>
            <TextInput
              keyboardType="numbers-and-punctuation"
              onChangeText={setDateEnd}
              placeholder="2026-06-26"
              placeholderTextColor={SUBTLE}
              style={styles.input}
              value={dateEnd}
            />
          </View>
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>기본 시간</Text>
          <Text style={styles.formMeta}>HH:MM</Text>
        </View>
        <View style={styles.formTwoColumn}>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>시작 시간</Text>
            <TextInput
              keyboardType="numbers-and-punctuation"
              onChangeText={setDailyStartTime}
              placeholder="09:00"
              placeholderTextColor={SUBTLE}
              style={styles.input}
              value={dailyStartTime}
            />
          </View>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>종료 시간</Text>
            <TextInput
              keyboardType="numbers-and-punctuation"
              onChangeText={setDailyEndTime}
              placeholder="18:00"
              placeholderTextColor={SUBTLE}
              style={styles.input}
              value={dailyEndTime}
            />
          </View>
        </View>
        <View style={styles.timePreview}>
          <View style={styles.timeBlock} />
          <Text style={styles.timePreviewText}>
            {dateStart} - {dateEnd} · {dailyStartTime} - {dailyEndTime}
          </Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>버퍼</Text>
          <Text style={styles.formMeta}>{bufferMinutes || "0"}분</Text>
        </View>
        <TextInput
          keyboardType="number-pad"
          onChangeText={setBufferMinutes}
          placeholder="30"
          placeholderTextColor={SUBTLE}
          style={styles.input}
          value={bufferMinutes}
        />
        <ToggleRow
          active={bufferBefore}
          label="약속 전"
          onPress={() => setBufferBefore((value) => !value)}
        />
        <ToggleRow
          active={bufferAfter}
          label="약속 후"
          onPress={() => setBufferAfter((value) => !value)}
        />
      </View>

      {localError || apiError ? (
        <Text style={styles.errorText}>{localError ?? apiError}</Text>
      ) : null}
      <PrimaryAction
        disabled={isLoading || !session}
        label="이벤트 만들기"
        loading={isLoading}
        onPress={handleSubmit}
      />
    </ScrollView>
  );
}

function AccessScreen({
  accessPreview,
  apiError,
  isLoading,
  onResolveCode,
}: {
  accessPreview: AccessPreview | null;
  apiError: string | null;
  isLoading: boolean;
  onResolveCode: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.accessCard}>
        <Text style={styles.accessTitle}>코드 입력</Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setCode}
          placeholder="이벤트 코드 또는 예약 코드"
          placeholderTextColor={SUBTLE}
          style={styles.codeInput}
          value={code}
        />
        {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}
        <PrimaryAction
          disabled={isLoading}
          label="열기"
          loading={isLoading}
          onPress={() => onResolveCode(code)}
        />
        {accessPreview ? (
          <View style={styles.previewCard}>
            <View style={styles.scheduleTop}>
              <View style={styles.previewTextBlock}>
                <Text style={styles.previewMeta}>
                  {accessPreview.kind === "event" ? "이벤트" : "예약 관리"}
                  {accessPreview.meta ? ` · ${accessPreview.meta}` : ""}
                </Text>
                <Text style={styles.previewTitle}>{accessPreview.title}</Text>
              </View>
              <Text style={styles.eventCode}>{accessPreview.code}</Text>
            </View>
            <Text style={styles.previewSubtitle}>{accessPreview.subtitle}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function StatusPill({
  approved,
  label,
}: {
  approved: boolean;
  label: string;
}) {
  return (
    <View style={[styles.statusPill, approved && styles.statusPillApproved]}>
      <Text
        style={[
          styles.statusPillText,
          approved && styles.statusPillApprovedText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function PrimaryAction({
  disabled,
  label,
  loading,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={BACKGROUND} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator color={PRIMARY} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

function EmptyCard({
  detail,
  title,
}: {
  detail: string;
  title: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
    </View>
  );
}

function Stat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ToggleRow({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggleTrack, active && styles.toggleTrackActive]}>
        <View style={[styles.toggleThumb, active && styles.toggleThumbActive]} />
      </View>
    </Pressable>
  );
}

function getQuickActions(tab: TabKey): QuickAction[] {
  if (tab === "events") {
    return [{ label: "이벤트 만들기", route: "create", tone: PRIMARY_SOFT }];
  }

  if (tab === "joined") {
    return [{ label: "코드로 참여", route: "access", tone: "#EEF8F1" }];
  }

  return [
    { label: "이벤트 만들기", route: "create", tone: PRIMARY_SOFT },
    { label: "코드로 참여", route: "access", tone: "#EEF8F1" },
  ];
}

function getTitle(route: RouteKey, activeTab: TabKey) {
  if (route === "create") {
    return "이벤트 만들기";
  }

  if (route === "access") {
    return "코드 입력";
  }

  if (route === "eventManage") {
    return "이벤트 관리";
  }

  return tabs.find((tab) => tab.key === activeTab)?.title ?? "";
}

function buildMonthDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function buildSchedulesFromDashboard(
  dashboard: MobileDashboardData | null,
): ScheduleItem[] {
  if (!dashboard) {
    return [];
  }

  const hostItems = dashboard.hostedEvents.flatMap((event) => [
    ...event.confirmedSlots.map((slot) =>
      buildScheduleItem({
        group: "호스트",
        slot,
        status: "확정",
        title: event.title,
      }),
    ),
    ...event.pendingSlots.map((slot) =>
      buildScheduleItem({
        group: "호스트",
        slot,
        status: "대기",
        title: event.title,
      }),
    ),
  ]);
  const guestItems = dashboard.reservations.flatMap((reservation) =>
    reservation.slots.map((slot) =>
      buildScheduleItem({
        group: "참여",
        slot,
        status: slot.is_confirmed ? "확정" : statusLabel(reservation.status),
        title: reservation.event?.title ?? "예약",
      }),
    ),
  );

  return [...hostItems, ...guestItems].sort(
    (left, right) =>
      new Date(left.startAt ?? "").getTime() -
      new Date(right.startAt ?? "").getTime(),
  );
}

function buildScheduleItem({
  group,
  slot,
  status,
  title,
}: {
  group: string;
  slot: MobileDashboardSlot;
  status: string;
  title: string;
}): ScheduleItem {
  const startAt = slot.is_confirmed
    ? slot.confirmed_start_at ?? slot.start_at
    : slot.start_at;
  const endAt = slot.is_confirmed
    ? slot.confirmed_end_at ?? slot.end_at
    : slot.end_at;

  return {
    date: formatDate(startAt),
    group,
    startAt,
    status,
    time: formatTimeRange(startAt, endAt),
    title,
  };
}

function buildHostedEventViews(
  dashboard: MobileDashboardData | null,
): HostEventView[] {
  if (!dashboard) {
    return [];
  }

  return dashboard.hostedEvents.map((event) => ({
    approved: event.approvedCount,
    code: event.event_code,
    id: event.id,
    pending: event.pendingCount,
    range: `${formatDate(event.date_start)} - ${formatDate(event.date_end)}`,
    title: event.title,
  }));
}

function buildJoinedReservationViews(
  dashboard: MobileDashboardData | null,
): JoinedReservationView[] {
  if (!dashboard) {
    return [];
  }

  return dashboard.reservations.map((reservation) => {
    const confirmedSlot = reservation.slots.find((slot) => slot.is_confirmed);
    const firstSlot = reservation.slots[0];
    const displaySlot = confirmedSlot ?? firstSlot;
    const status = confirmedSlot ? "확정" : statusLabel(reservation.status);
    const time = displaySlot
      ? formatRange(
          displaySlot.is_confirmed
            ? displaySlot.confirmed_start_at ?? displaySlot.start_at
            : displaySlot.start_at,
          displaySlot.is_confirmed
            ? displaySlot.confirmed_end_at ?? displaySlot.end_at
            : displaySlot.end_at,
        )
      : "후보 시간 없음";

    return {
      event: reservation.event?.title ?? "예약",
      status,
      time:
        reservation.slots.length > 1 && !confirmedSlot
          ? `${time} · 후보 ${reservation.slots.length}개`
          : time,
    };
  });
}

function sortSlots(slots: MobileDashboardSlot[]) {
  return [...slots].sort(
    (left, right) =>
      parseDateValue(getSlotDisplayStart(left)).getTime() -
        parseDateValue(getSlotDisplayStart(right)).getTime() ||
      left.priority_order - right.priority_order,
  );
}

function getSlotDisplayStart(slot: MobileDashboardSlot) {
  return slot.is_confirmed
    ? slot.confirmed_start_at ?? slot.start_at
    : slot.start_at;
}

function getSlotDisplayEnd(slot: MobileDashboardSlot) {
  return slot.is_confirmed
    ? slot.confirmed_end_at ?? slot.end_at
    : slot.end_at;
}

function getSlotOverlapMinutes(slot: MobileDashboardSlot, dateKey: string) {
  const dayStart = parseDateValue(dateKey);
  const dayEnd = new Date(dayStart);
  const slotStart = parseDateValue(getSlotDisplayStart(slot));
  const slotEnd = parseDateValue(getSlotDisplayEnd(slot));

  dayEnd.setDate(dayEnd.getDate() + 1);

  if (
    Number.isNaN(dayStart.getTime()) ||
    Number.isNaN(slotStart.getTime()) ||
    Number.isNaN(slotEnd.getTime())
  ) {
    return null;
  }

  const overlapStart = Math.max(slotStart.getTime(), dayStart.getTime());
  const overlapEnd = Math.min(slotEnd.getTime(), dayEnd.getTime());

  if (overlapEnd <= overlapStart) {
    return null;
  }

  return {
    end: Math.ceil((overlapEnd - dayStart.getTime()) / 60000),
    start: Math.floor((overlapStart - dayStart.getTime()) / 60000),
  };
}

function buildManageTimelineBounds(
  event: MobileHostedEvent,
  selectedDate: string,
  slots: MobileDashboardSlot[],
) {
  const startClock = parseClockMinutes(event.daily_start_time);
  const endClock = parseClockMinutes(event.daily_end_time);
  let start = Number.isNaN(startClock) ? 540 : startClock;
  let end = Number.isNaN(endClock) ? 1080 : endClock;

  if (end <= start) {
    end = 1440;
  }

  for (const slot of slots) {
    const overlap = getSlotOverlapMinutes(slot, selectedDate);

    if (!overlap) {
      continue;
    }

    start = Math.min(start, overlap.start);
    end = Math.max(end, overlap.end);
  }

  start = Math.max(0, Math.floor(start / 60) * 60);
  end = Math.min(1440, Math.ceil(end / 60) * 60);

  if (end <= start) {
    end = Math.min(1440, start + 60);
  }

  return { end, start };
}

function buildTimelineRows(start: number, end: number) {
  const rows: number[] = [];

  for (let minute = start; minute < end; minute += 60) {
    rows.push(minute);
  }

  return rows.length > 0 ? rows : [start];
}

function parseClockMinutes(value: string) {
  const [hoursText, minutesText = "00"] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 24 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return Number.NaN;
  }

  return Math.min(1440, hours * 60 + minutes);
}

function formatTimelineHour(minutes: number) {
  const hours = Math.floor(minutes / 60) % 24;
  const period = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 || 12;

  return `${hour12}${period}`;
}

function formatShortDate(value: string) {
  const date = parseDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatWeekday(value: string) {
  const date = parseDateValue(value);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return weekdays[date.getDay()];
}

function getParticipantsForSlot(
  event: MobileHostedEvent,
  slot: MobileDashboardSlot,
) {
  return event.participants
    .filter((participant) => participant.reservation_id === slot.reservation_id)
    .map((participant) => participant.guest_name)
    .filter(Boolean);
}

function formatBufferDirections(event: MobileHostedEvent) {
  if (event.is_buffer_before_active && event.is_buffer_after_active) {
    return "전/후";
  }

  if (event.is_buffer_before_active) {
    return "전";
  }

  if (event.is_buffer_after_active) {
    return "후";
  }

  return "방향 없음";
}

function buildMonthMarkers(
  dashboard: MobileDashboardData | null,
  monthDate: Date,
) {
  const approved = new Set<string>();
  const pending = new Set<string>();

  if (!dashboard) {
    return { approved, pending };
  }

  for (const item of buildSchedulesFromDashboard(dashboard)) {
    if (!item.startAt) {
      continue;
    }

    const parsed = parseDateValue(item.startAt);

    if (
      parsed.getFullYear() !== monthDate.getFullYear() ||
      parsed.getMonth() !== monthDate.getMonth()
    ) {
      continue;
    }

    if (item.status === "확정") {
      approved.add(buildDateKey(parsed));
    } else {
      pending.add(buildDateKey(parsed));
    }
  }

  return { approved, pending };
}

function buildSchedulesByDate(items: ScheduleItem[], monthDate: Date) {
  const schedulesByDate = new Map<string, ScheduleItem[]>();

  for (const item of items) {
    const dateKey = getScheduleDateKey(item, monthDate.getFullYear());

    if (!dateKey) {
      continue;
    }

    const parsed = parseDateValue(dateKey);

    if (
      parsed.getFullYear() !== monthDate.getFullYear() ||
      parsed.getMonth() !== monthDate.getMonth()
    ) {
      continue;
    }

    const current = schedulesByDate.get(dateKey) ?? [];

    schedulesByDate.set(dateKey, [...current, item]);
  }

  for (const [dateKey, dateItems] of schedulesByDate) {
    schedulesByDate.set(
      dateKey,
      [...dateItems].sort(
        (left, right) =>
          getScheduleSortTime(left) - getScheduleSortTime(right),
      ),
    );
  }

  return schedulesByDate;
}

function getScheduleDateKey(item: ScheduleItem, fallbackYear: number) {
  if (item.startAt) {
    return buildDateKey(parseDateValue(item.startAt));
  }

  const match = /^(\d{1,2})\/(\d{1,2})/.exec(item.date);

  if (!match) {
    return null;
  }

  return buildDateKey(
    new Date(fallbackYear, Number(match[1]) - 1, Number(match[2])),
  );
}

function getScheduleSortTime(item: ScheduleItem) {
  if (item.startAt) {
    return parseDateValue(item.startAt).getTime();
  }

  return 0;
}

function formatDateKeyLabel(dateKey: string) {
  return formatDate(dateKey);
}

function formatDate(value: string) {
  const date = parseDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
}

function formatRange(startAt: string, endAt: string) {
  return `${formatDate(startAt)} ${formatTimeRange(startAt, endAt)}`;
}

function formatTimeRange(startAt: string, endAt: string) {
  return `${formatTime(startAt)} - ${formatTime(endAt)}`;
}

function formatTime(value: string) {
  const date = parseDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 || 12;

  return `${period} ${String(hour12).padStart(2, "0")}:${minutes}`;
}

function formatTimeFromClock(value: string) {
  const [hoursText, minutesText = "00"] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 24
  ) {
    return value;
  }

  const normalizedHours = hours === 24 ? 0 : hours;
  const period = normalizedHours < 12 ? "오전" : "오후";
  const hour12 = normalizedHours % 12 || 12;

  return `${period} ${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function statusLabel(status: MobileGuestReservation["status"]) {
  if (status === "APPROVED") {
    return "확정";
  }

  if (status === "PENDING") {
    return "대기";
  }

  if (status === "CANCELLED") {
    return "취소";
  }

  return "종료";
}

function parseDateValue(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnlyMatch) {
    return new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
    );
  }

  return new Date(value);
}

function buildDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function buildDateList(dateStart: string, dateEnd: string) {
  const dates: string[] = [];
  const current = parseDateValue(dateStart);
  const end = parseDateValue(dateEnd);

  while (current.getTime() <= end.getTime()) {
    dates.push(buildDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function isDateInputValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isTimeInputValue(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function toDateInputValue(date: Date) {
  return buildDateKey(date);
}

const styles = StyleSheet.create({
  accessCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  accessTitle: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 25,
    fontWeight: "700",
  },
  activeDateChip: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  activeDateChipText: {
    color: BACKGROUND,
  },
  activeTab: {
    backgroundColor: BACKGROUND,
  },
  activeTabIcon: {
    backgroundColor: PRIMARY_SOFT,
  },
  activeTabIconText: {
    color: PRIMARY,
  },
  activeTabLabel: {
    color: PRIMARY,
    fontWeight: "800",
  },
  app: {
    backgroundColor: SURFACE,
    flex: 1,
  },
  approvedDot: {
    backgroundColor: APPROVED,
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  authSwitch: {
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  authSwitchButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
  },
  authSwitchButtonActive: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderWidth: 1,
  },
  authSwitchText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "900",
  },
  authSwitchTextActive: {
    color: PRIMARY,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  avatarText: {
    color: BACKGROUND,
    fontFamily: serifFont,
    fontSize: 28,
    fontWeight: "700",
  },
  body: {
    flex: 1,
  },
  chevron: {
    color: SUBTLE,
    fontSize: 28,
    fontWeight: "300",
  },
  codeInput: {
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    color: INK,
    fontSize: 16,
    fontWeight: "800",
    height: 54,
    paddingHorizontal: 14,
  },
  dateChip: {
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dateChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dateChipText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "800",
  },
  dayCell: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: "center",
    width: "14.285%",
  },
  dayDots: {
    flexDirection: "row",
    gap: 3,
    height: 7,
    marginTop: 4,
  },
  dayPreview: {
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
    padding: 12,
  },
  dayPreviewCount: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "900",
  },
  dayPreviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayPreviewItem: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  dayPreviewItemTitle: {
    color: INK,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  dayPreviewRole: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "800",
  },
  dayPreviewTime: {
    color: INK,
    fontSize: 13,
    fontWeight: "800",
  },
  dayPreviewTitle: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 17,
    fontWeight: "700",
  },
  dayPreviewTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  dayText: {
    color: INK,
    fontSize: 14,
    fontWeight: "700",
  },
  eventCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  eventCode: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  eventRange: {
    color: SUBTLE,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  eventTitle: {
    color: INK,
    fontSize: 16,
    fontWeight: "900",
  },
  eventTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  formCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  formHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  formLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "800",
  },
  formMeta: {
    color: SUBTLE,
    fontSize: 12,
    fontWeight: "700",
  },
  formColumn: {
    flex: 1,
    gap: 7,
  },
  formTitle: {
    color: INK,
    fontSize: 17,
    fontWeight: "900",
  },
  formTwoColumn: {
    flexDirection: "row",
    gap: 10,
  },
  header: {
    alignItems: "center",
    backgroundColor: BACKGROUND,
    borderBottomColor: BORDER,
    borderBottomWidth: 1,
    flexDirection: "row",
    height: 54,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerBack: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerBackText: {
    color: PRIMARY,
    fontSize: 32,
    fontWeight: "300",
    lineHeight: 34,
  },
  headerSide: {
    alignItems: "flex-start",
    position: "absolute",
    left: 12,
    width: 48,
  },
  headerTitle: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 20,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 16,
  },
  emptyDetail: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  emptyTitle: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
  },
  errorText: {
    color: "#B95050",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    color: INK,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  bufferSummary: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  bufferSummaryLabel: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "800",
  },
  bufferSummaryValue: {
    color: INK,
    fontSize: 13,
    fontWeight: "900",
  },
  hostSlotCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    padding: 14,
  },
  hostSlotMeta: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "800",
  },
  hostSlotTime: {
    color: INK,
    fontSize: 14,
    fontWeight: "800",
  },
  hostSlotTitle: {
    color: INK,
    fontSize: 15,
    fontWeight: "900",
  },
  hostSlotTitleBlock: {
    flex: 1,
    gap: 3,
  },
  hostSlotTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  loadingCard: {
    alignItems: "center",
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  loadingText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "800",
  },
  monthCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthTitle: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 23,
    fontWeight: "700",
  },
  manageCalendarCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  manageCalendarCount: {
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    color: MUTED,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  manageCalendarEyebrow: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "900",
  },
  manageCalendarHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  manageCalendarTitle: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  manageCode: {
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 999,
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  manageEyebrow: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "900",
  },
  manageHero: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  manageMeta: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "800",
  },
  manageTitle: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 24,
    fontWeight: "700",
  },
  manageTitleBlock: {
    flex: 1,
    gap: 4,
  },
  manageTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  manageDateChip: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  manageDateChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  manageDateChipDate: {
    color: INK,
    fontSize: 14,
    fontWeight: "900",
  },
  manageDateChipDateActive: {
    color: BACKGROUND,
  },
  manageDateChipRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 2,
  },
  manageDateChipToday: {
    borderColor: PRIMARY,
  },
  manageDateChipWeekday: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "900",
  },
  manageDateChipWeekdayActive: {
    color: "rgba(255, 255, 255, 0.82)",
  },
  manageDateScroller: {
    marginHorizontal: -2,
    paddingHorizontal: 2,
  },
  manageTimeline: {
    flexDirection: "row",
    gap: 10,
  },
  manageTimelineBlock: {
    borderRadius: 8,
    left: 8,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: "absolute",
    right: 8,
  },
  manageTimelineBlockApproved: {
    backgroundColor: PRIMARY,
  },
  manageTimelineBlockMeta: {
    color: "#8A5F17",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  manageTimelineBlockMetaApproved: {
    color: "rgba(255, 255, 255, 0.78)",
  },
  manageTimelineBlockPending: {
    backgroundColor: "#FFF4D7",
    borderColor: "#F3D08A",
    borderWidth: 1,
  },
  manageTimelineBlockTitle: {
    color: INK,
    fontSize: 13,
    fontWeight: "900",
  },
  manageTimelineBlockTitleApproved: {
    color: BACKGROUND,
  },
  manageTimelineHalfLine: {
    borderTopColor: "#EEF0F3",
    borderTopWidth: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: "50%",
  },
  manageTimelineHourLine: {
    borderTopColor: BORDER,
    borderTopWidth: 1,
  },
  manageTimelineLane: {
    backgroundColor: "#FBFCFD",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  manageTimelineTimeColumn: {
    width: 42,
  },
  manageTimelineTimeSlot: {
    alignItems: "flex-end",
    paddingRight: 2,
    paddingTop: 2,
  },
  manageTimelineTimeText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "900",
  },
  monthToday: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  pendingDot: {
    backgroundColor: PENDING,
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  noticeText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  passwordHintBox: {
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 11,
  },
  passwordHintText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "800",
  },
  passwordHintTextPassed: {
    color: APPROVED,
  },
  pressed: {
    opacity: 0.72,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 8,
    minHeight: 54,
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.64,
  },
  primaryButtonText: {
    color: BACKGROUND,
    fontSize: 15,
    fontWeight: "900",
  },
  previewCard: {
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  previewMeta: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "900",
  },
  previewSubtitle: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  previewTextBlock: {
    flex: 1,
    gap: 3,
  },
  previewTitle: {
    color: INK,
    fontSize: 16,
    fontWeight: "900",
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    padding: 22,
  },
  profileEmail: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  profileName: {
    color: INK,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
  },
  quickAction: {
    alignItems: "center",
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    elevation: 4,
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  quickActionText: {
    color: INK,
    fontSize: 14,
    fontWeight: "800",
  },
  quickButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 30,
    elevation: 8,
    height: 58,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    width: 58,
  },
  quickButtonOpen: {
    backgroundColor: "#0B335F",
  },
  quickButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  quickButtonText: {
    color: BACKGROUND,
    fontSize: 30,
    fontWeight: "500",
    lineHeight: 33,
  },
  quickIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  quickIconText: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: "500",
    lineHeight: 23,
  },
  quickLayer: {
    alignItems: "flex-end",
    position: "absolute",
    right: 18,
    zIndex: 20,
  },
  quickMenu: {
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 12,
  },
  reservationCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  safeArea: {
    backgroundColor: BACKGROUND,
    flex: 1,
  },
  selectedDayCell: {
    backgroundColor: PRIMARY,
  },
  scheduleCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  scheduleDate: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3,
  },
  scheduleGroup: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "700",
  },
  scheduleTime: {
    color: INK,
    fontSize: 14,
    fontWeight: "800",
  },
  scheduleTitle: {
    color: INK,
    fontSize: 17,
    fontWeight: "900",
  },
  scheduleTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  screenContent: {
    gap: 12,
    padding: 16,
    paddingBottom: 110,
  },
  scrim: {
    backgroundColor: "rgba(17, 24, 39, 0.08)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
  sectionHeader: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  settingList: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingRow: {
    alignItems: "center",
    borderBottomColor: BORDER,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: 16,
  },
  settingText: {
    color: INK,
    fontSize: 15,
    fontWeight: "800",
  },
  settingValue: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "900",
  },
  signOutText: {
    color: "#B95050",
    fontSize: 15,
    fontWeight: "900",
  },
  slotActionButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  slotActionButtonGhost: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderWidth: 1,
  },
  slotActionText: {
    color: BACKGROUND,
    fontSize: 14,
    fontWeight: "900",
  },
  slotActionTextGhost: {
    color: PRIMARY,
  },
  statBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    flex: 1,
    padding: 12,
  },
  statLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  statusPill: {
    backgroundColor: "#FFF8E8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillApproved: {
    backgroundColor: "#EAF7EF",
  },
  statusPillApprovedText: {
    color: APPROVED,
  },
  statusPillText: {
    color: PENDING,
    fontSize: 12,
    fontWeight: "900",
  },
  subtleText: {
    color: SUBTLE,
  },
  sundayText: {
    color: "#B95050",
  },
  saturdayText: {
    color: "#4F78A8",
  },
  tab: {
    alignItems: "center",
    borderRadius: 22,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minWidth: 0,
    paddingTop: 4,
  },
  tabBar: {
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    height: 64,
    padding: 5,
  },
  tabBarOuter: {
    backgroundColor: BACKGROUND,
    borderTopColor: "rgba(229, 231, 235, 0.75)",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  tabIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 30,
    justifyContent: "center",
    width: 42,
  },
  tabIconText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "900",
  },
  tabLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  timeBlock: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    height: 34,
    width: "72%",
  },
  timePreview: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    gap: 9,
    padding: 12,
  },
  timePreviewText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "800",
  },
  todayCell: {
    backgroundColor: PRIMARY,
  },
  todayText: {
    color: BACKGROUND,
  },
  toggleLabel: {
    color: INK,
    fontSize: 15,
    fontWeight: "800",
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  toggleThumb: {
    backgroundColor: BACKGROUND,
    borderRadius: 10,
    height: 20,
    transform: [{ translateX: 2 }],
    width: 20,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  toggleTrack: {
    backgroundColor: "#D1D5DB",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 44,
  },
  toggleTrackActive: {
    backgroundColor: PRIMARY,
  },
  weekLabel: {
    color: MUTED,
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
});
