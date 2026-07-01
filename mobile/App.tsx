import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  PanResponder,
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
type RouteKey =
  | TabKey
  | "create"
  | "access"
  | "eventManage"
  | "eventReserve"
  | "reservationManage";
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
  target?:
    | {
        eventId: string;
        kind: "host";
      }
    | {
        accessCode: string;
        kind: "reservation";
      };
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
  accessCode?: string;
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
type UpdateEventDateRangePayload = {
  activeDates: string[];
  dailyEndTime: string;
  dailyStartTime: string;
  dateEnd: string;
  dateStart: string;
};
type ActiveDateSelection = {
  activeDates: string[];
  dateEnd: string;
  dateStart: string;
};
type ReviewReservationPayload = {
  eventId: string;
  reservationId: string;
  slotId: string;
  status: "APPROVED" | "PENDING";
};
type CreateReservationPayload = {
  eventId: string;
  headcount: number;
  participants: Array<{ guestName: string; userId?: string }>;
  password?: string | null;
  requestedSlots: Array<{ endAt: string; startAt: string }>;
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
type MobileTimeBlock = {
  end_at: string;
  event_id: string;
  id: string;
  note: string | null;
  start_at: string;
  type: "AVAILABLE" | "BLOCKED";
};
type MobileTimeBlockDraft = {
  endAt: string;
  note?: string | null;
  startAt: string;
  type: "AVAILABLE" | "BLOCKED";
};
type MobileTimelineCell = {
  endAt: string;
  endMinute: number;
  startAt: string;
  startMinute: number;
};
type MobileTimeRange = {
  endAt: string;
  startAt: string;
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
  activeDates: string[];
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
  timeBlocks: MobileTimeBlock[];
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
type MobileEventDetail = {
  activeDates: string[];
  bufferOverrides: Array<{
    custom_end_at?: string | null;
    custom_start_at?: string | null;
    is_active: boolean;
    reservation_slot_id: string;
    side: string;
  }>;
  event: {
    buffer_time_minutes: number;
    daily_end_time: string;
    daily_start_time: string;
    date_end: string;
    date_start: string;
    description: string | null;
    event_code: string;
    id: string;
    is_buffer_active: boolean;
    is_buffer_after_active: boolean;
    is_buffer_before_active: boolean;
    title: string;
  };
  reservationSlots: MobileDashboardSlot[];
  timeBlocks: MobileTimeBlock[];
};
type MobileCreatedReservation = {
  eventCode: string;
  reservation: {
    headcount: number;
    id: string;
    reservation_access_code: string;
    slots: MobileDashboardSlot[];
    status: MobileGuestReservation["status"];
  };
};
type MobileReservationManagement = MobileEventDetail & {
  passwordRequired: boolean;
  reservation: {
    created_at: string;
    creator_id: string | null;
    event_id: string;
    headcount: number;
    id: string;
    participants: MobileDashboardParticipant[];
    reservation_access_code: string;
    slots: MobileDashboardSlot[];
    status: MobileGuestReservation["status"];
    updated_at: string;
  };
};
type RenderContext = {
  apiError: string | null;
  dashboard: MobileDashboardData | null;
  isApiLoading: boolean;
  onCreateEvent: (payload: CreateEventPayload) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<boolean>;
  onOpenHostEvent: (eventId: string) => void;
  onRefreshDashboard: () => Promise<void>;
  onCreateReservation: (
    payload: CreateReservationPayload,
  ) => Promise<MobileCreatedReservation | null>;
  onOpenEventReservation: (eventCode: string) => void;
  onReviewReservation: (payload: ReviewReservationPayload) => Promise<void>;
  onOpenReservationManagement: (accessCode: string) => void;
  onUpdateReservationManagement: (
    accessCode: string,
    payload: {
      headcount: number;
      participants: Array<{ guestName: string; userId?: string }>;
      password?: string | null;
      requestedSlots: Array<{ endAt: string; startAt: string }>;
    },
  ) => Promise<MobileReservationManagement | null>;
  onCancelReservationManagement: (
    accessCode: string,
    password?: string | null,
  ) => Promise<MobileReservationManagement | null>;
  onResolveCode: (code: string) => Promise<void>;
  onSaveTimeBlocks: (
    eventId: string,
    blocks: MobileTimeBlockDraft[],
  ) => Promise<boolean>;
  onSetUnsavedChanges: (hasChanges: boolean) => void;
  onUpdateEventDateRange: (
    eventId: string,
    payload: UpdateEventDateRangePayload,
  ) => Promise<boolean>;
  onSignOut: () => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (
    email: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<string>;
  selectedHostEventId: string | null;
  selectedEventCode: string | null;
  selectedReservationCode: string | null;
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
const CANDIDATE_REORDER_ROW_HEIGHT = 60;
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

async function deleteMobileEvent(eventId: string, token: string) {
  return apiRequest<{ eventCode: string; eventId: string }>(
    `/api/mobile/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      token,
    },
  );
}

async function updateMobileEventDateRange(
  eventId: string,
  payload: UpdateEventDateRangePayload,
  token: string,
) {
  return apiRequest<{
    event: {
      daily_end_time: string;
      daily_start_time: string;
      date_end: string;
      date_start: string;
      event_code: string;
      id: string;
    };
  }>(`/api/mobile/events/${encodeURIComponent(eventId)}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
    token,
  });
}

async function saveMobileTimeBlocks(
  eventId: string,
  blocks: MobileTimeBlockDraft[],
  token: string,
) {
  return apiRequest<{ timeBlocks: MobileTimeBlock[] }>(
    "/api/mobile/events/time-blocks",
    {
      body: JSON.stringify({ blocks, eventId }),
      method: "POST",
      token,
    },
  );
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

async function createMobileReservation(
  payload: CreateReservationPayload,
  token?: string,
) {
  return apiRequest<MobileCreatedReservation>("/api/mobile/reservations", {
    body: JSON.stringify(payload),
    method: "POST",
    token,
  });
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

async function loadMobileEventDetail(eventCode: string) {
  return apiRequest<MobileEventDetail>(
    `/api/mobile/events/${encodeURIComponent(eventCode)}`,
  );
}

async function loadMobileReservationManagement(
  accessCode: string,
  token?: string,
) {
  return apiRequest<MobileReservationManagement>(
    `/api/mobile/reservations/${encodeURIComponent(accessCode)}`,
    { token },
  );
}

async function updateMobileReservationManagement({
  accessCode,
  payload,
  token,
}: {
  accessCode: string;
  payload: {
    headcount: number;
    participants: Array<{ guestName: string; userId?: string }>;
    password?: string | null;
    requestedSlots: Array<{ endAt: string; startAt: string }>;
  };
  token?: string;
}) {
  return apiRequest<MobileReservationManagement>(
    `/api/mobile/reservations/${encodeURIComponent(accessCode)}`,
    {
      body: JSON.stringify(payload),
      method: "PUT",
      token,
    },
  );
}

async function cancelMobileReservationManagement({
  accessCode,
  password,
  token,
}: {
  accessCode: string;
  password?: string | null;
  token?: string;
}) {
  return apiRequest<MobileReservationManagement>(
    `/api/mobile/reservations/${encodeURIComponent(accessCode)}`,
    {
      body: JSON.stringify({ password }),
      method: "DELETE",
      token,
    },
  );
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
  const [apiError, setApiError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<MobileDashboardData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isLeaveConfirmVisible, setIsLeaveConfirmVisible] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [route, setRoute] = useState<RouteKey>("calendar");
  const [selectedHostEventId, setSelectedHostEventId] = useState<string | null>(
    null,
  );
  const [selectedEventCode, setSelectedEventCode] = useState<string | null>(
    null,
  );
  const [selectedReservationCode, setSelectedReservationCode] = useState<
    string | null
  >(null);
  const [session, setSession] = useState<MobileSession | null>(null);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [pendingLeaveTab, setPendingLeaveTab] = useState<TabKey | null>(null);
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
    setSelectedEventCode(null);
    setSelectedReservationCode(null);
    setIsQuickOpen(false);
    setHasUnsavedChanges(false);
    setIsLeaveConfirmVisible(false);
    setPendingLeaveTab(null);
  }

  function openRoute(nextRoute: RouteKey) {
    setRoute(nextRoute);
    setIsQuickOpen(false);
    setHasUnsavedChanges(false);
    setIsLeaveConfirmVisible(false);
    setPendingLeaveTab(null);
  }

  function openHostEvent(eventId: string) {
    setActiveTab("events");
    setSelectedHostEventId(eventId);
    setSelectedEventCode(null);
    setSelectedReservationCode(null);
    setRoute("eventManage");
    setIsQuickOpen(false);
    setHasUnsavedChanges(false);
    setIsLeaveConfirmVisible(false);
    setPendingLeaveTab(null);
  }

  function openEventReservation(eventCode: string) {
    setActiveTab("joined");
    setSelectedEventCode(eventCode);
    setSelectedHostEventId(null);
    setSelectedReservationCode(null);
    setRoute("eventReserve");
    setIsQuickOpen(false);
    setHasUnsavedChanges(false);
    setIsLeaveConfirmVisible(false);
    setPendingLeaveTab(null);
  }

  function openReservationManagement(accessCode: string) {
    setActiveTab("joined");
    setSelectedReservationCode(accessCode);
    setSelectedEventCode(null);
    setSelectedHostEventId(null);
    setRoute("reservationManage");
    setIsQuickOpen(false);
    setHasUnsavedChanges(false);
    setIsLeaveConfirmVisible(false);
    setPendingLeaveTab(null);
  }

  function requestOpenTab(tab: TabKey) {
    if (hasUnsavedChanges && route !== tab) {
      setPendingLeaveTab(tab);
      setIsLeaveConfirmVisible(true);
      return;
    }

    openTab(tab);
  }

  const handleBackPress = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingLeaveTab(null);
      setIsLeaveConfirmVisible(true);
      return;
    }

    openTab(activeTab);
  }, [activeTab, hasUnsavedChanges]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (route === activeTab) {
          return false;
        }

        handleBackPress();
        return true;
      },
    );

    return () => subscription.remove();
  }, [activeTab, handleBackPress, route]);

  function handleConfirmLeave() {
    openTab(pendingLeaveTab ?? activeTab);
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
      setHasUnsavedChanges(false);
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

  async function handleDeleteEvent(eventId: string) {
    if (!session?.accessToken) {
      setApiError("로그인이 필요합니다.");
      return false;
    }

    setApiError(null);
    setIsApiLoading(true);

    try {
      let nextSession = await getUsableSession(session);

      try {
        await deleteMobileEvent(eventId, nextSession.accessToken);
      } catch (error) {
        if (!isUnauthorizedError(error)) {
          throw error;
        }

        nextSession = await refreshSession(session.refreshToken);
        await deleteMobileEvent(eventId, nextSession.accessToken);
      }

      const { dashboard: nextDashboard, session: dashboardSession } =
        await loadDashboardWithSession(nextSession);

      setDashboard(nextDashboard);
      setSession(dashboardSession);
      await saveStoredSession(dashboardSession);
      setSelectedHostEventId(null);
      setHasUnsavedChanges(false);
      setActiveTab("events");
      setRoute("events");
      return true;
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "이벤트를 삭제하지 못했습니다.",
      );
      return false;
    } finally {
      setIsApiLoading(false);
    }
  }

  async function handleUpdateEventDateRange(
    eventId: string,
    payload: UpdateEventDateRangePayload,
  ) {
    if (!session?.accessToken) {
      setApiError("로그인이 필요합니다.");
      return false;
    }

    setApiError(null);
    setIsApiLoading(true);

    try {
      let nextSession = await getUsableSession(session);

      try {
        await updateMobileEventDateRange(eventId, payload, nextSession.accessToken);
      } catch (error) {
        if (!isUnauthorizedError(error)) {
          throw error;
        }

        nextSession = await refreshSession(session.refreshToken);
        await updateMobileEventDateRange(
          eventId,
          payload,
          nextSession.accessToken,
        );
      }

      const { dashboard: nextDashboard, session: dashboardSession } =
        await loadDashboardWithSession(nextSession);

      setDashboard(nextDashboard);
      setSession(dashboardSession);
      await saveStoredSession(dashboardSession);
      setSelectedHostEventId(eventId);
      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "날짜와 기본 시간을 저장하지 못했습니다.",
      );
      return false;
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

  async function handleSaveTimeBlocks(
    eventId: string,
    blocks: MobileTimeBlockDraft[],
  ) {
    if (!session?.accessToken) {
      setApiError("로그인이 필요합니다.");
      return false;
    }

    setApiError(null);
    setIsApiLoading(true);

    try {
      let nextSession = await getUsableSession(session);

      try {
        await saveMobileTimeBlocks(eventId, blocks, nextSession.accessToken);
      } catch (error) {
        if (!isUnauthorizedError(error)) {
          throw error;
        }

        nextSession = await refreshSession(session.refreshToken);
        await saveMobileTimeBlocks(eventId, blocks, nextSession.accessToken);
      }

      const { dashboard: nextDashboard, session: dashboardSession } =
        await loadDashboardWithSession(nextSession);

      setDashboard(nextDashboard);
      setSession(dashboardSession);
      await saveStoredSession(dashboardSession);
      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "가능 시간을 저장하지 못했습니다.",
      );
      return false;
    } finally {
      setIsApiLoading(false);
    }
  }

  async function handleCreateReservation(payload: CreateReservationPayload) {
    setApiError(null);
    setIsApiLoading(true);

    try {
      let nextSession = session ? await getUsableSession(session) : null;
      let createdReservation: MobileCreatedReservation;

      try {
        createdReservation = await createMobileReservation(
          payload,
          nextSession?.accessToken,
        );
      } catch (error) {
        if (!nextSession || !isUnauthorizedError(error)) {
          throw error;
        }

        nextSession = await refreshSession(session!.refreshToken);
        createdReservation = await createMobileReservation(
          payload,
          nextSession.accessToken,
        );
      }

      if (nextSession) {
        const { dashboard: nextDashboard, session: dashboardSession } =
          await loadDashboardWithSession(nextSession);

        setDashboard(nextDashboard);
        setSession(dashboardSession);
        await saveStoredSession(dashboardSession);
      }

      return createdReservation;
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "예약 생성에 실패했습니다.",
      );
      return null;
    } finally {
      setIsApiLoading(false);
    }
  }

  async function handleUpdateReservationManagement(
    accessCode: string,
    payload: {
      headcount: number;
      participants: Array<{ guestName: string; userId?: string }>;
      password?: string | null;
      requestedSlots: Array<{ endAt: string; startAt: string }>;
    },
  ) {
    setApiError(null);
    setIsApiLoading(true);

    try {
      let nextSession = session ? await getUsableSession(session) : null;
      let managementView: MobileReservationManagement;

      try {
        managementView = await updateMobileReservationManagement({
          accessCode,
          payload,
          token: nextSession?.accessToken,
        });
      } catch (error) {
        if (!nextSession || !isUnauthorizedError(error)) {
          throw error;
        }

        nextSession = await refreshSession(session!.refreshToken);
        managementView = await updateMobileReservationManagement({
          accessCode,
          payload,
          token: nextSession.accessToken,
        });
      }

      if (nextSession) {
        const { dashboard: nextDashboard, session: dashboardSession } =
          await loadDashboardWithSession(nextSession);

        setDashboard(nextDashboard);
        setSession(dashboardSession);
        await saveStoredSession(dashboardSession);
      }

      setHasUnsavedChanges(false);
      return managementView;
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "예약 정보를 저장하지 못했습니다.",
      );
      return null;
    } finally {
      setIsApiLoading(false);
    }
  }

  async function handleCancelReservationManagement(
    accessCode: string,
    password?: string | null,
  ) {
    setApiError(null);
    setIsApiLoading(true);

    try {
      let nextSession = session ? await getUsableSession(session) : null;
      let managementView: MobileReservationManagement;

      try {
        managementView = await cancelMobileReservationManagement({
          accessCode,
          password,
          token: nextSession?.accessToken,
        });
      } catch (error) {
        if (!nextSession || !isUnauthorizedError(error)) {
          throw error;
        }

        nextSession = await refreshSession(session!.refreshToken);
        managementView = await cancelMobileReservationManagement({
          accessCode,
          password,
          token: nextSession.accessToken,
        });
      }

      if (nextSession) {
        const { dashboard: nextDashboard, session: dashboardSession } =
          await loadDashboardWithSession(nextSession);

        setDashboard(nextDashboard);
        setSession(dashboardSession);
        await saveStoredSession(dashboardSession);
      }

      return managementView;
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "예약을 취소하지 못했습니다.");
      return null;
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

      if (resolved.kind === "event" && resolved.isHost) {
        openHostEvent(resolved.targetId);
      } else if (resolved.kind === "event") {
        openEventReservation(resolved.code);
      } else {
        openReservationManagement(resolved.code);
      }
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
    apiError,
    dashboard,
    isApiLoading: isBusy,
    onCreateEvent: handleCreateEvent,
    onCreateReservation: handleCreateReservation,
    onDeleteEvent: handleDeleteEvent,
    onOpenEventReservation: openEventReservation,
    onOpenHostEvent: openHostEvent,
    onOpenReservationManagement: openReservationManagement,
    onRefreshDashboard: handleRefreshDashboard,
    onReviewReservation: handleReviewReservation,
    onResolveCode: handleResolveCode,
    onSaveTimeBlocks: handleSaveTimeBlocks,
    onSetUnsavedChanges: setHasUnsavedChanges,
    onSignOut: handleSignOut,
    onSignIn: handleSignIn,
    onSignUp: handleSignUp,
    onUpdateEventDateRange: handleUpdateEventDateRange,
    onUpdateReservationManagement: handleUpdateReservationManagement,
    onCancelReservationManagement: handleCancelReservationManagement,
    selectedEventCode,
    selectedHostEventId,
    selectedReservationCode,
    session,
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar backgroundColor={BACKGROUND} barStyle="dark-content" />
      <View style={styles.app}>
        <Header
          onBack={handleBackPress}
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

        {route !== "create" ? (
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
        ) : null}

        <View
          style={[
            styles.tabBarOuter,
            { paddingBottom: Math.max(insets.bottom, 8) },
          ]}
        >
          <View style={styles.tabBar}>
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;

              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  key={tab.key}
                  onPress={() => requestOpenTab(tab.key)}
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

        <ConfirmDialog
          confirmLabel="나가기"
          message="저장 버튼을 누르기 전 변경사항은 서버에 반영되지 않아요."
          onCancel={() => {
            setIsLeaveConfirmVisible(false);
            setPendingLeaveTab(null);
          }}
          onConfirm={handleConfirmLeave}
          title="저장하지 않은 변경사항이 있어요"
          visible={isLeaveConfirmVisible}
        />
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
    route === "create" ||
    route === "access" ||
    route === "eventManage" ||
    route === "eventReserve" ||
    route === "reservationManage";

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
        onDeleteEvent={context.onDeleteEvent}
        onRefresh={context.onRefreshDashboard}
        onReviewReservation={context.onReviewReservation}
        onSaveTimeBlocks={context.onSaveTimeBlocks}
        onSetUnsavedChanges={context.onSetUnsavedChanges}
        onUpdateEventDateRange={context.onUpdateEventDateRange}
        session={context.session}
      />
    );
  }

  if (route === "joined") {
    return (
      <JoinedScreen
        dashboard={context.dashboard}
        isLoading={context.isApiLoading}
        onOpenReservation={context.onOpenReservationManagement}
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
        onSetUnsavedChanges={context.onSetUnsavedChanges}
        session={context.session}
      />
    );
  }

  if (route === "access") {
    return (
      <AccessScreen
        apiError={context.apiError}
        isLoading={context.isApiLoading}
        onResolveCode={context.onResolveCode}
      />
    );
  }

  if (route === "eventReserve") {
    return (
      <EventReserveScreen
        apiError={context.apiError}
        eventCode={context.selectedEventCode}
        isLoading={context.isApiLoading}
        onCreateReservation={context.onCreateReservation}
        onOpenReservationManagement={context.onOpenReservationManagement}
        onSetUnsavedChanges={context.onSetUnsavedChanges}
        session={context.session}
      />
    );
  }

  if (route === "reservationManage") {
    return (
      <ReservationManageScreen
        accessCode={context.selectedReservationCode}
        apiError={context.apiError}
        isLoading={context.isApiLoading}
        onCancelReservation={context.onCancelReservationManagement}
        onSetUnsavedChanges={context.onSetUnsavedChanges}
        onUpdateReservation={context.onUpdateReservationManagement}
        session={context.session}
      />
    );
  }

  return (
    <CalendarScreen
      dashboard={context.dashboard}
      isLoading={context.isApiLoading}
      onOpenHostEvent={context.onOpenHostEvent}
      onOpenReservation={context.onOpenReservationManagement}
      onRefresh={context.onRefreshDashboard}
      session={context.session}
    />
  );
}

function CalendarScreen({
  dashboard,
  isLoading,
  onOpenHostEvent,
  onOpenReservation,
  onRefresh,
  session,
}: {
  dashboard: MobileDashboardData | null;
  isLoading: boolean;
  onOpenHostEvent: (eventId: string) => void;
  onOpenReservation: (accessCode: string) => void;
  onRefresh: () => Promise<void>;
  session: MobileSession | null;
}) {
  const items = useMemo(() => buildSchedulesFromDashboard(dashboard), [dashboard]);
  function handleOpenSchedule(item: ScheduleItem) {
    if (item.target?.kind === "host") {
      onOpenHostEvent(item.target.eventId);
      return;
    }

    if (item.target?.kind === "reservation") {
      onOpenReservation(item.target.accessCode);
    }
  }

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
      <MonthCard dashboard={dashboard} onOpenSchedule={handleOpenSchedule} />
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
        <ScheduleCard
          item={item}
          key={`${item.date}-${item.title}-${item.time}`}
          onOpen={handleOpenSchedule}
        />
      ))}
    </ScrollView>
  );
}

function MonthCard({
  dashboard,
  onOpenSchedule,
}: {
  dashboard: MobileDashboardData | null;
  onOpenSchedule: (item: ScheduleItem) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const monthItems = useMemo(
    () => (dashboard ? buildSchedulesFromDashboard(dashboard) : schedules),
    [dashboard],
  );
  const schedulesByDate = useMemo(
    () => buildSchedulesByDate(monthItems, visibleMonth),
    [monthItems, visibleMonth],
  );
  const markers = useMemo(
    () => buildMonthMarkers(dashboard, visibleMonth),
    [dashboard, visibleMonth],
  );
  const monthTitle = formatMonthTitle(visibleMonth);
  const todayKey = buildDateKey(today);
  const selectedItems = selectedDateKey
    ? schedulesByDate.get(selectedDateKey) ?? []
    : [];

  return (
    <View style={styles.monthCard}>
      <View style={styles.monthHeader}>
        <Pressable
          accessibilityLabel="이전 달"
          accessibilityRole="button"
          onPress={() =>
            setVisibleMonth((current) => addMonthsToDate(current, -1))
          }
          style={({ pressed }) => [
            styles.monthNavButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.monthNavText}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="연월 선택"
          accessibilityRole="button"
          onPress={() => setIsMonthPickerVisible(true)}
          style={({ pressed }) => [
            styles.monthTitleButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.monthTitle}>{monthTitle}</Text>
        </Pressable>
        <View style={styles.monthHeaderRight}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setVisibleMonth(
                new Date(today.getFullYear(), today.getMonth(), 1),
              );
              setSelectedDateKey(todayKey);
            }}
            style={({ pressed }) => [
              styles.monthTodayButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.monthToday}>오늘</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="다음 달"
            accessibilityRole="button"
            onPress={() =>
              setVisibleMonth((current) => addMonthsToDate(current, 1))
            }
            style={({ pressed }) => [
              styles.monthNavButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.monthNavText}>›</Text>
          </Pressable>
        </View>
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
          const dayKey =
            day === null
              ? ""
              : buildDateKey(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth(),
                    day,
                  ),
                );
          const isToday = dayKey === todayKey;
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
              <Pressable
                accessibilityLabel={`${item.title} 열기`}
                accessibilityRole="button"
                disabled={!item.target}
                key={`${item.title}-${item.time}-${index}`}
                onPress={() => onOpenSchedule(item)}
                style={({ pressed }) => [
                  styles.dayPreviewItem,
                  item.target && styles.pressableCard,
                  pressed && item.target && styles.pressed,
                ]}
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
              </Pressable>
            ))}
        </View>
      ) : null}
      <MonthPickerModal
        key={buildMonthKey(visibleMonth)}
        monthDate={visibleMonth}
        onClose={() => setIsMonthPickerVisible(false)}
        onSelectMonth={(nextMonth) => {
          setVisibleMonth(nextMonth);
          setIsMonthPickerVisible(false);
        }}
        visible={isMonthPickerVisible}
      />
    </View>
  );
}

function ScheduleCard({
  item,
  onOpen,
}: {
  item: ScheduleItem;
  onOpen: (item: ScheduleItem) => void;
}) {
  const approved = item.status === "확정";

  return (
    <Pressable
      accessibilityLabel={`${item.title} 열기`}
      accessibilityRole="button"
      disabled={!item.target}
      onPress={() => onOpen(item)}
      style={({ pressed }) => [
        styles.scheduleCard,
        item.target && styles.pressableCard,
        pressed && item.target && styles.pressed,
      ]}
    >
      <View style={styles.scheduleTop}>
        <View>
          <Text style={styles.scheduleDate}>{item.date}</Text>
          <Text style={styles.scheduleTitle}>{item.title}</Text>
        </View>
        <StatusPill approved={approved} label={item.status} />
      </View>
      <Text style={styles.scheduleTime}>{item.time}</Text>
      <Text style={styles.scheduleGroup}>{item.group}</Text>
    </Pressable>
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
  onDeleteEvent,
  onRefresh,
  onReviewReservation,
  onSaveTimeBlocks,
  onSetUnsavedChanges,
  onUpdateEventDateRange,
  session,
}: {
  event: MobileHostedEvent | null;
  isLoading: boolean;
  onDeleteEvent: (eventId: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onReviewReservation: (payload: ReviewReservationPayload) => Promise<void>;
  onSaveTimeBlocks: (
    eventId: string,
    blocks: MobileTimeBlockDraft[],
  ) => Promise<boolean>;
  onSetUnsavedChanges: (hasChanges: boolean) => void;
  onUpdateEventDateRange: (
    eventId: string,
    payload: UpdateEventDateRangePayload,
  ) => Promise<boolean>;
  session: MobileSession | null;
}) {
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isDateEditVisible, setIsDateEditVisible] = useState(false);
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
            <View style={styles.manageHeroActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={() => setIsDateEditVisible(true)}
                style={({ pressed }) => [
                  styles.manageEditButton,
                  isLoading && styles.primaryButtonDisabled,
                  pressed && !isLoading && styles.pressed,
                ]}
              >
                <Text style={styles.manageEditButtonText}>
                  날짜/기본시간 수정
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={() => setIsDeleteConfirmVisible(true)}
                style={({ pressed }) => [
                  styles.manageDeleteButton,
                  isLoading && styles.primaryButtonDisabled,
                  pressed && !isLoading && styles.pressed,
                ]}
              >
                <Text style={styles.manageDeleteButtonText}>이벤트 삭제</Text>
              </Pressable>
            </View>
          </View>

          <HostEventCalendar
            event={event}
            isSaving={isLoading}
            key={`${event.id}-${event.timeBlocks
              .map((block) => `${block.id}:${block.start_at}:${block.end_at}`)
              .join("|")}`}
            onSaveTimeBlocks={onSaveTimeBlocks}
            onSetUnsavedChanges={onSetUnsavedChanges}
          />

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
            pendingSlots.map((slot, index) => (
              <HostSlotCard
                displayPriority={index + 1}
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
      {event && isDateEditVisible ? (
        <EventDateTimeEditModal
          event={event}
          isSaving={isLoading}
          onClose={() => setIsDateEditVisible(false)}
          onSave={async (payload) => {
            const didSave = await onUpdateEventDateRange(event.id, payload);

            if (didSave) {
              setIsDateEditVisible(false);
            }
          }}
        />
      ) : null}
      {event ? (
        <ConfirmDialog
          confirmLabel="삭제"
          isDanger
          message="이벤트와 연결된 예약, 후보 시간, 가능 시간이 모두 삭제돼요."
          onCancel={() => setIsDeleteConfirmVisible(false)}
          onConfirm={() => {
            setIsDeleteConfirmVisible(false);
            void onDeleteEvent(event.id);
          }}
          title="이벤트를 삭제할까요?"
          visible={isDeleteConfirmVisible}
        />
      ) : null}
    </ScrollView>
  );
}

function EventDateTimeEditModal({
  event,
  isSaving,
  onClose,
  onSave,
}: {
  event: MobileHostedEvent;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: UpdateEventDateRangePayload) => Promise<void>;
}) {
  const [dailyEndTime, setDailyEndTime] = useState(
    () => trimClockValue(event.daily_end_time),
  );
  const [dailyStartTime, setDailyStartTime] = useState(
    () => trimClockValue(event.daily_start_time),
  );
  const initialActiveDates = useMemo(
    () => normalizeActiveDateList(event.activeDates, event.date_start, event.date_end),
    [event.activeDates, event.date_end, event.date_start],
  );
  const [activeDates, setActiveDates] = useState(initialActiveDates);
  const [dateEnd, setDateEnd] = useState(
    () => getActiveDateBounds(initialActiveDates, event.date_start, event.date_end)[1],
  );
  const [dateStart, setDateStart] = useState(
    () => getActiveDateBounds(initialActiveDates, event.date_start, event.date_end)[0],
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function updateDateSelection(nextSelection: ActiveDateSelection) {
    setActiveDates(nextSelection.activeDates);
    setDateStart(nextSelection.dateStart);
    setDateEnd(nextSelection.dateEnd);
  }

  function updateDateStart(nextStart: string) {
    setDateStart(nextStart);

    if (isDateInputValue(nextStart) && isDateInputValue(dateEnd)) {
      const nextActiveDates = buildActiveDatesBetweenInputs(nextStart, dateEnd);

      setActiveDates(nextActiveDates);
      const [nextDateStart, nextDateEnd] = getActiveDateBounds(
        nextActiveDates,
        nextStart,
        dateEnd,
      );

      setDateStart(nextDateStart);
      setDateEnd(nextDateEnd);
    }
  }

  function updateDateEnd(nextEnd: string) {
    setDateEnd(nextEnd);

    if (isDateInputValue(dateStart) && isDateInputValue(nextEnd)) {
      const nextActiveDates = buildActiveDatesBetweenInputs(dateStart, nextEnd);

      setActiveDates(nextActiveDates);
      const [nextDateStart, nextDateEnd] = getActiveDateBounds(
        nextActiveDates,
        dateStart,
        nextEnd,
      );

      setDateStart(nextDateStart);
      setDateEnd(nextDateEnd);
    }
  }

  async function handleSave() {
    setLocalError(null);
    const normalizedActiveDates = normalizeActiveDateList(
      activeDates,
      dateStart,
      dateEnd,
    );

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

    await onSave({
      activeDates: normalizedActiveDates,
      dailyEndTime,
      dailyStartTime,
      dateEnd: normalizedActiveDates[normalizedActiveDates.length - 1] ?? dateEnd,
      dateStart: normalizedActiveDates[0] ?? dateStart,
    });
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible
    >
      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={onClose}
        style={styles.modalBackdrop}
      >
        <Pressable
          onPress={(nativeEvent) => nativeEvent.stopPropagation()}
          style={styles.eventEditPanel}
        >
          <View style={styles.formHeaderRow}>
            <View>
              <Text style={styles.manageEyebrow}>EVENT SETTINGS</Text>
              <Text style={styles.formTitle}>날짜/기본시간 수정</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onClose}
              style={({ pressed }) => [
                styles.headerBack,
                pressed && !isSaving && styles.pressed,
              ]}
            >
              <Text style={styles.headerBackText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.eventEditContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formTwoColumn}>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>시작일</Text>
                <TextInput
                  keyboardType="numbers-and-punctuation"
                  onChangeText={updateDateStart}
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
                  onChangeText={updateDateEnd}
                  placeholder="2026-06-26"
                  placeholderTextColor={SUBTLE}
                  style={styles.input}
                  value={dateEnd}
                />
              </View>
            </View>
            <DateRangeCalendarPicker
              activeDates={activeDates}
              dateEnd={dateEnd}
              dateStart={dateStart}
              onChange={updateDateSelection}
            />
            <View style={styles.formTwoColumn}>
              <View style={styles.formColumn}>
                <View style={styles.timeLabelRow}>
                  <Text style={styles.formLabel}>시작 시간</Text>
                  <TimePresetToggle
                    active={dailyStartTime === "00:00"}
                    label="0시"
                    onPress={() =>
                      setDailyStartTime((value) =>
                        trimClockValue(value) === "00:00" ? "09:00" : "00:00",
                      )
                    }
                  />
                </View>
                <TextInput
                  editable={dailyStartTime !== "00:00"}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setDailyStartTime}
                  placeholder="09:00"
                  placeholderTextColor={SUBTLE}
                  style={[
                    styles.input,
                    dailyStartTime === "00:00" && styles.inputDisabled,
                  ]}
                  value={dailyStartTime}
                />
              </View>
              <View style={styles.formColumn}>
                <View style={styles.timeLabelRow}>
                  <Text style={styles.formLabel}>종료 시간</Text>
                  <TimePresetToggle
                    active={dailyEndTime === "24:00"}
                    label="자정"
                    onPress={() =>
                      setDailyEndTime((value) =>
                        trimClockValue(value) === "24:00" ? "18:00" : "24:00",
                      )
                    }
                  />
                </View>
                <TextInput
                  editable={dailyEndTime !== "24:00"}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setDailyEndTime}
                  placeholder="18:00"
                  placeholderTextColor={SUBTLE}
                  style={[
                    styles.input,
                    dailyEndTime === "24:00" && styles.inputDisabled,
                  ]}
                  value={dailyEndTime}
                />
              </View>
            </View>
            <Text style={styles.dateRangeHint}>
              저장하면 이 이벤트의 관리/예약 달력 표시 범위가 함께 바뀌어요.
            </Text>
            {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
          </ScrollView>

          <View style={styles.eventEditActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onClose}
              style={({ pressed }) => [
                styles.confirmCancelButton,
                isSaving && styles.primaryButtonDisabled,
                pressed && !isSaving && styles.pressed,
              ]}
            >
              <Text style={styles.confirmCancelText}>닫기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.confirmButton,
                isSaving && styles.primaryButtonDisabled,
                pressed && !isSaving && styles.pressed,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={BACKGROUND} size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>저장</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function HostEventCalendar({
  event,
  isSaving,
  onSaveTimeBlocks,
  onSetUnsavedChanges,
}: {
  event: MobileHostedEvent;
  isSaving: boolean;
  onSaveTimeBlocks: (
    eventId: string,
    blocks: MobileTimeBlockDraft[],
  ) => Promise<boolean>;
  onSetUnsavedChanges: (hasChanges: boolean) => void;
}) {
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [draftBlocks, setDraftBlocks] = useState<MobileTimeBlockDraft[]>(() =>
    createMobileTimeBlockDrafts(event.timeBlocks),
  );
  const committedBlocksKey = useMemo(
    () => buildMobileTimeBlockDraftKey(createMobileTimeBlockDrafts(event.timeBlocks)),
    [event.timeBlocks],
  );
  const eventDates = useMemo(
    () => normalizeActiveDateList(event.activeDates, event.date_start, event.date_end),
    [event.activeDates, event.date_end, event.date_start],
  );
  const todayKey = buildDateKey(new Date());
  const initialDate = eventDates.includes(todayKey)
    ? todayKey
    : eventDates[0] ?? event.date_start;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const currentDate = eventDates.includes(selectedDate)
    ? selectedDate
    : initialDate;
  const committedBlocks = useMemo(
    () => createMobileTimeBlockDrafts(event.timeBlocks),
    [event.timeBlocks],
  );
  const displayedBlocks = isEditingAvailability ? draftBlocks : committedBlocks;
  const draftBlocksKey = useMemo(
    () => buildMobileTimeBlockDraftKey(draftBlocks),
    [draftBlocks],
  );
  const hasAvailabilityChanges = draftBlocksKey !== committedBlocksKey;
  const allSlots = useMemo(
    () => sortSlots([...event.confirmedSlots, ...event.pendingSlots]),
    [event.confirmedSlots, event.pendingSlots],
  );
  const pendingPriorityBySlotId = useMemo(
    () =>
      new Map(
        sortSlots(event.pendingSlots).map((slot, index) => [slot.id, index + 1]),
      ),
    [event.pendingSlots],
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
  const availabilityCells = useMemo(
    () =>
      buildAvailabilityCells(
        currentDate,
        event.daily_start_time,
        event.daily_end_time,
      ),
    [currentDate, event.daily_end_time, event.daily_start_time],
  );
  const visibleAvailabilityBlocks = useMemo(
    () =>
      displayedBlocks
        .filter((block) => block.type === "AVAILABLE")
        .map((block) => ({
          block,
          overlap: getRangeOverlapMinutes(
            {
              endAt: block.endAt,
              startAt: block.startAt,
            },
            currentDate,
          ),
        }))
        .filter(
          (
            item,
          ): item is {
            block: MobileTimeBlockDraft;
            overlap: { end: number; start: number };
          } => item.overlap !== null,
        ),
    [currentDate, displayedBlocks],
  );
  const timelineHeight = Math.max(
    ((timelineBounds.end - timelineBounds.start) / 60) *
      MANAGE_TIMELINE_HOUR_HEIGHT,
    MANAGE_TIMELINE_HOUR_HEIGHT,
  );

  function handleStartAvailabilityEdit() {
    setDraftBlocks(committedBlocks);
    setIsEditingAvailability(true);
    onSetUnsavedChanges(false);
  }

  function handleCancelAvailabilityEdit() {
    setDraftBlocks(committedBlocks);
    setIsEditingAvailability(false);
    onSetUnsavedChanges(false);
  }

  async function handleSaveAvailability() {
    if (isSaving) {
      return;
    }

    const didSave = await onSaveTimeBlocks(
      event.id,
      mergeMobileTimeBlockDrafts(draftBlocks),
    );

    if (didSave) {
      setIsEditingAvailability(false);
      onSetUnsavedChanges(false);
    }
  }

  function handleDragAvailabilityRange(
    range: MobileTimeRange,
    shouldBeAvailable: boolean,
  ) {
    onSetUnsavedChanges(true);
    setDraftBlocks((current) =>
      setMobileAvailabilityDraftRange(current, range, shouldBeAvailable),
    );
  }

  return (
    <View style={styles.manageCalendarCard}>
      <View style={styles.manageCalendarHeader}>
        <View>
          <Text style={styles.manageCalendarEyebrow}>CALENDAR</Text>
          <Text style={styles.manageCalendarTitle}>일정 달력</Text>
        </View>
        <View style={styles.manageCalendarActions}>
          <Text style={styles.manageCalendarCount}>
            일정 {visibleSlots.length} · 가능 {visibleAvailabilityBlocks.length}
          </Text>
          {isEditingAvailability ? (
            <View style={styles.manageEditActionRow}>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={handleCancelAvailabilityEdit}
                style={({ pressed }) => [
                  styles.manageEditButton,
                  pressed && !isSaving && styles.pressed,
                  isSaving && styles.primaryButtonDisabled,
                ]}
              >
                <Text style={styles.manageEditButtonText}>취소</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving || !hasAvailabilityChanges}
                onPress={handleSaveAvailability}
                style={({ pressed }) => [
                  styles.manageEditButton,
                  styles.manageEditButtonActive,
                  (isSaving || !hasAvailabilityChanges) &&
                    styles.primaryButtonDisabled,
                  pressed &&
                    !isSaving &&
                    hasAvailabilityChanges &&
                    styles.pressed,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color={BACKGROUND} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.manageEditButtonText,
                      styles.manageEditButtonTextActive,
                    ]}
                  >
                    저장
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={handleStartAvailabilityEdit}
              style={({ pressed }) => [
                styles.manageEditButton,
                pressed && !isSaving && styles.pressed,
                isSaving && styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.manageEditButtonText}>가능 시간 편집</Text>
            </Pressable>
          )}
        </View>
      </View>

      <DateStripNavigator
        dates={eventDates}
        onSelectDate={setSelectedDate}
        selectedDate={currentDate}
      />

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
          {isEditingAvailability
            ? availabilityCells.map((cell) => {
                const isAvailable = isRangeInAvailableDrafts(draftBlocks, cell);
                const top =
                  ((cell.startMinute - timelineBounds.start) / 60) *
                  MANAGE_TIMELINE_HOUR_HEIGHT;
                const height =
                  ((cell.endMinute - cell.startMinute) / 60) *
                  MANAGE_TIMELINE_HOUR_HEIGHT;

                return (
                  <View
                    accessibilityLabel={
                      isAvailable ? "가능 시간 해제" : "가능 시간 추가"
                    }
                    key={cell.startAt}
                    style={[
                      styles.manageAvailabilityCell,
                      isAvailable && styles.manageAvailabilityCellActive,
                      { height, top },
                    ]}
                  >
                    {isAvailable ? (
                      <Text style={styles.manageAvailabilityCellText}>
                        가능
                      </Text>
                    ) : null}
                  </View>
                );
              })
            : visibleAvailabilityBlocks.map(({ block, overlap }) => {
                const top =
                  ((overlap.start - timelineBounds.start) / 60) *
                    MANAGE_TIMELINE_HOUR_HEIGHT +
                  3;
                const height = Math.max(
                  ((overlap.end - overlap.start) / 60) *
                    MANAGE_TIMELINE_HOUR_HEIGHT -
                    6,
                  MANAGE_TIMELINE_BLOCK_MIN_HEIGHT,
                );

                return (
                  <View
                    key={`${block.startAt}-${block.endAt}`}
                    style={[
                      styles.manageAvailabilityBlock,
                      { height, top },
                    ]}
                  >
                    <Text style={styles.manageAvailabilityBlockText}>가능</Text>
                  </View>
                );
              })}
          {isEditingAvailability ? (
            <DraggableTimelineSelectionLayer
              cells={availabilityCells}
              disabled={isSaving}
              inactiveLabel="가능 해제"
              isSelected={(cell) => isRangeInAvailableDrafts(draftBlocks, cell)}
              onCommit={handleDragAvailabilityRange}
              selectedLabel="가능 추가"
              timelineStart={timelineBounds.start}
            />
          ) : null}
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
                    : `후보 ${
                        pendingPriorityBySlotId.get(slot.id) ??
                        slot.priority_order
                      }`}{" "}
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
  displayPriority,
  event,
  isLoading,
  onReviewReservation,
  slot,
}: {
  displayPriority?: number;
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
          label={
            slot.is_confirmed
              ? "확정"
              : `후보 ${displayPriority ?? slot.priority_order}`
          }
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
  onOpenReservation,
  onRefresh,
  session,
}: {
  dashboard: MobileDashboardData | null;
  isLoading: boolean;
  onOpenReservation: (accessCode: string) => void;
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
        <Pressable
          key={`${reservation.event}-${reservation.time}`}
          onPress={() => {
            if ("accessCode" in reservation && reservation.accessCode) {
              onOpenReservation(reservation.accessCode);
            }
          }}
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
        </Pressable>
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
  onSetUnsavedChanges,
  session,
}: {
  apiError: string | null;
  isLoading: boolean;
  onCreateEvent: (payload: CreateEventPayload) => Promise<void>;
  onSetUnsavedChanges: (hasChanges: boolean) => void;
  session: MobileSession | null;
}) {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [bufferBefore, setBufferBefore] = useState(true);
  const [bufferAfter, setBufferAfter] = useState(true);
  const [bufferMinutes, setBufferMinutes] = useState("30");
  const [dailyEndTime, setDailyEndTime] = useState("18:00");
  const [dailyStartTime, setDailyStartTime] = useState("09:00");
  const [activeDates, setActiveDates] = useState([today]);
  const [dateEnd, setDateEnd] = useState(today);
  const [dateStart, setDateStart] = useState(today);
  const [description, setDescription] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  function markDirty() {
    onSetUnsavedChanges(true);
  }

  function updateDateSelection(nextSelection: ActiveDateSelection) {
    setActiveDates(nextSelection.activeDates);
    setDateStart(nextSelection.dateStart);
    setDateEnd(nextSelection.dateEnd);
    markDirty();
  }

  function updateDateStart(nextStart: string) {
    setDateStart(nextStart);

    if (isDateInputValue(nextStart) && isDateInputValue(dateEnd)) {
      const nextActiveDates = buildActiveDatesBetweenInputs(nextStart, dateEnd);

      setActiveDates(nextActiveDates);
      const [nextDateStart, nextDateEnd] = getActiveDateBounds(
        nextActiveDates,
        nextStart,
        dateEnd,
      );

      setDateStart(nextDateStart);
      setDateEnd(nextDateEnd);
    }

    markDirty();
  }

  function updateDateEnd(nextEnd: string) {
    setDateEnd(nextEnd);

    if (isDateInputValue(dateStart) && isDateInputValue(nextEnd)) {
      const nextActiveDates = buildActiveDatesBetweenInputs(dateStart, nextEnd);

      setActiveDates(nextActiveDates);
      const [nextDateStart, nextDateEnd] = getActiveDateBounds(
        nextActiveDates,
        dateStart,
        nextEnd,
      );

      setDateStart(nextDateStart);
      setDateEnd(nextDateEnd);
    }

    markDirty();
  }

  async function handleSubmit() {
    setLocalError(null);
    const normalizedActiveDates = normalizeActiveDateList(
      activeDates,
      dateStart,
      dateEnd,
    );

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
      activeDates: normalizedActiveDates,
      bufferTimeMinutes: Number.parseInt(bufferMinutes, 10) || 0,
      dailyEndTime,
      dailyStartTime,
      dateEnd: normalizedActiveDates[normalizedActiveDates.length - 1] ?? dateEnd,
      dateStart: normalizedActiveDates[0] ?? dateStart,
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
          onChangeText={(value) => {
            setTitle(value);
            markDirty();
          }}
          placeholder="졸업사진 일정"
          placeholderTextColor={SUBTLE}
          style={styles.input}
          value={title}
        />

        <Text style={styles.formLabel}>설명</Text>
        <TextInput
          multiline
          onChangeText={(value) => {
            setDescription(value);
            markDirty();
          }}
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
              onChangeText={updateDateStart}
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
              onChangeText={updateDateEnd}
              placeholder="2026-06-26"
              placeholderTextColor={SUBTLE}
              style={styles.input}
              value={dateEnd}
            />
          </View>
        </View>
        <DateRangeCalendarPicker
          activeDates={activeDates}
          dateEnd={dateEnd}
          dateStart={dateStart}
          onChange={updateDateSelection}
        />
      </View>

      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>기본 시간</Text>
          <Text style={styles.formMeta}>HH:MM</Text>
        </View>
        <View style={styles.formTwoColumn}>
          <View style={styles.formColumn}>
            <View style={styles.timeLabelRow}>
              <Text style={styles.formLabel}>시작 시간</Text>
              <TimePresetToggle
                active={dailyStartTime === "00:00"}
                label="0시"
                onPress={() => {
                  setDailyStartTime((value) =>
                    trimClockValue(value) === "00:00" ? "09:00" : "00:00",
                  );
                  markDirty();
                }}
              />
            </View>
            <TextInput
              editable={dailyStartTime !== "00:00"}
              keyboardType="numbers-and-punctuation"
              onChangeText={(value) => {
                setDailyStartTime(value);
                markDirty();
              }}
              placeholder="09:00"
              placeholderTextColor={SUBTLE}
              style={[
                styles.input,
                dailyStartTime === "00:00" && styles.inputDisabled,
              ]}
              value={dailyStartTime}
            />
          </View>
          <View style={styles.formColumn}>
            <View style={styles.timeLabelRow}>
              <Text style={styles.formLabel}>종료 시간</Text>
              <TimePresetToggle
                active={dailyEndTime === "24:00"}
                label="자정"
                onPress={() => {
                  setDailyEndTime((value) =>
                    trimClockValue(value) === "24:00" ? "18:00" : "24:00",
                  );
                  markDirty();
                }}
              />
            </View>
            <TextInput
              editable={dailyEndTime !== "24:00"}
              keyboardType="numbers-and-punctuation"
              onChangeText={(value) => {
                setDailyEndTime(value);
                markDirty();
              }}
              placeholder="18:00"
              placeholderTextColor={SUBTLE}
              style={[
                styles.input,
                dailyEndTime === "24:00" && styles.inputDisabled,
              ]}
              value={dailyEndTime}
            />
          </View>
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>버퍼</Text>
          <Text style={styles.formMeta}>{bufferMinutes || "0"}분</Text>
        </View>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => {
            setBufferMinutes(value);
            markDirty();
          }}
          placeholder="30"
          placeholderTextColor={SUBTLE}
          style={styles.input}
          value={bufferMinutes}
        />
        <ToggleRow
          active={bufferBefore}
          label="약속 전"
          onPress={() => {
            setBufferBefore((value) => !value);
            markDirty();
          }}
        />
        <ToggleRow
          active={bufferAfter}
          label="약속 후"
          onPress={() => {
            setBufferAfter((value) => !value);
            markDirty();
          }}
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

function DateRangeCalendarPicker({
  activeDates,
  dateEnd,
  dateStart,
  onChange,
}: {
  activeDates: string[];
  dateEnd: string;
  dateStart: string;
  onChange: (selection: ActiveDateSelection) => void;
}) {
  const todayKey = buildDateKey(new Date());
  const initialMonth = isDateInputValue(dateStart)
    ? parseDateValue(dateStart)
    : new Date();
  const [dragState, setDragState] = useState<{
    currentDate: string;
    shouldActivate: boolean;
    startDate: string;
  } | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  );
  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const dateCells = useMemo(
    () =>
      days.map((day) =>
        day
          ? buildDateKey(
              new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                day,
              ),
            )
          : null,
      ),
    [days, visibleMonth],
  );
  const normalizedActiveDates = useMemo(
    () => normalizeActiveDateList(activeDates, dateStart, dateEnd),
    [activeDates, dateEnd, dateStart],
  );
  const activeDateSet = useMemo(
    () => new Set(normalizedActiveDates),
    [normalizedActiveDates],
  );
  const previewDateSet = useMemo(() => {
    if (!dragState) {
      return null;
    }

    const [previewStart, previewEnd] = sortDatePair(
      dragState.startDate,
      dragState.currentDate,
    );

    return new Set(buildDateList(previewStart, previewEnd));
  }, [dragState]);
  const cellHeight = 42;

  const getDateFromLocation = useCallback((locationX: number, locationY: number) => {
    if (gridWidth <= 0) {
      return null;
    }

    const columnWidth = gridWidth / 7;
    const column = clamp(Math.floor(locationX / columnWidth), 0, 6);
    const maxRow = Math.max(Math.ceil(dateCells.length / 7) - 1, 0);
    const row = clamp(Math.floor(locationY / cellHeight), 0, maxRow);
    const index = row * 7 + column;

    return dateCells[index] ?? null;
  }, [dateCells, gridWidth, cellHeight]);

  const commitActiveDates = useCallback((nextActiveDates: string[]) => {
    const normalizedNextActiveDates = normalizeActiveDateSelection(nextActiveDates);
    const [nextStart, nextEnd] = getActiveDateBounds(
      normalizedNextActiveDates,
      dateStart,
      dateEnd,
    );

    onChange({
      activeDates: normalizedNextActiveDates,
      dateEnd: nextEnd,
      dateStart: nextStart,
    });
  }, [dateEnd, dateStart, onChange]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => gridWidth > 0,
        onStartShouldSetPanResponder: () => gridWidth > 0,
        onPanResponderGrant: (event) => {
          const nextDate = getDateFromLocation(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          );

          if (!nextDate) {
            return;
          }

          setDragState({
            currentDate: nextDate,
            shouldActivate: !activeDateSet.has(nextDate),
            startDate: nextDate,
          });
        },
        onPanResponderMove: (event) => {
          const nextDate = getDateFromLocation(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          );

          if (!nextDate) {
            return;
          }

          setDragState((current) =>
            current ? { ...current, currentDate: nextDate } : current,
          );
        },
        onPanResponderRelease: () => {
          setDragState((current) => {
            if (current) {
              const [selectionStart, selectionEnd] = sortDatePair(
                current.startDate,
                current.currentDate,
              );

              commitActiveDates(
                applyActiveDateSelection(
                  normalizedActiveDates,
                  buildDateList(selectionStart, selectionEnd),
                  current.shouldActivate,
                ),
              );
            }

            return null;
          });
        },
        onPanResponderTerminate: () => setDragState(null),
      }),
    [
      activeDateSet,
      commitActiveDates,
      getDateFromLocation,
      gridWidth,
      normalizedActiveDates,
    ],
  );

  return (
    <View style={styles.dateRangePicker}>
      <View style={styles.monthHeader}>
        <Pressable
          accessibilityLabel="이전 달"
          accessibilityRole="button"
          onPress={() =>
            setVisibleMonth((current) => addMonthsToDate(current, -1))
          }
          style={({ pressed }) => [
            styles.monthNavButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.monthNavText}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="연월 선택"
          accessibilityRole="button"
          onPress={() => setIsMonthPickerVisible(true)}
          style={({ pressed }) => [
            styles.monthTitleButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.monthTitle}>{formatMonthTitle(visibleMonth)}</Text>
        </Pressable>
        <View style={styles.monthHeaderRight}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const today = new Date();

              setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              onChange({
                activeDates: [todayKey],
                dateEnd: todayKey,
                dateStart: todayKey,
              });
            }}
            style={({ pressed }) => [
              styles.monthTodayButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.monthToday}>오늘</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="다음 달"
            accessibilityRole="button"
            onPress={() =>
              setVisibleMonth((current) => addMonthsToDate(current, 1))
            }
            style={({ pressed }) => [
              styles.monthNavButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.monthNavText}>›</Text>
          </Pressable>
        </View>
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
      <View
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        style={[
          styles.dateRangeGrid,
          { height: Math.ceil(dateCells.length / 7) * cellHeight },
        ]}
        {...panResponder.panHandlers}
      >
        {dateCells.map((dayKey, index) => {
          const weekday = index % 7;
          const isPreviewed =
            dayKey !== null && previewDateSet?.has(dayKey) === true;
          const isActive =
            dayKey !== null &&
            (isPreviewed
              ? dragState?.shouldActivate === true
              : activeDateSet.has(dayKey));
          const isPreviewOff =
            dayKey !== null &&
            isPreviewed &&
            dragState?.shouldActivate === false;
          const isToday = dayKey === todayKey;

          return (
            <View
              key={dayKey ?? `blank-${index}`}
              style={[
                styles.dateRangeDay,
                { height: cellHeight },
                isActive && styles.dateRangeDayEndpoint,
                isPreviewed &&
                  dragState?.shouldActivate === true &&
                  styles.dateRangeDayActivePreview,
                isPreviewOff && styles.dateRangeDayInactivePreview,
              ]}
            >
              {dayKey ? (
                <Text
                  style={[
                    styles.dateRangeDayText,
                    weekday === 0 && styles.sundayText,
                    weekday === 6 && styles.saturdayText,
                    isActive && styles.dateRangeDayTextActive,
                    isPreviewOff && styles.dateRangeDayTextInactivePreview,
                  ]}
                >
                  {Number(dayKey.slice(-2))}
                </Text>
              ) : null}
              {isToday ? <View style={styles.dateRangeTodayDot} /> : null}
            </View>
          );
        })}
      </View>
      <Text style={styles.dateRangeHint}>
        날짜를 눌러 켜고 끄거나 드래그해서 여러 날짜를 한 번에 바꿀 수 있어요.
      </Text>
      <MonthPickerModal
        key={buildMonthKey(visibleMonth)}
        monthDate={visibleMonth}
        onClose={() => setIsMonthPickerVisible(false)}
        onSelectMonth={(nextMonth) => {
          setVisibleMonth(nextMonth);
          setIsMonthPickerVisible(false);
        }}
        visible={isMonthPickerVisible}
      />
    </View>
  );
}

function AccessScreen({
  apiError,
  isLoading,
  onResolveCode,
}: {
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
      </View>
    </ScrollView>
  );
}

function EventReserveScreen({
  apiError,
  eventCode,
  isLoading,
  onCreateReservation,
  onOpenReservationManagement,
  onSetUnsavedChanges,
  session,
}: {
  apiError: string | null;
  eventCode: string | null;
  isLoading: boolean;
  onCreateReservation: (
    payload: CreateReservationPayload,
  ) => Promise<MobileCreatedReservation | null>;
  onOpenReservationManagement: (accessCode: string) => void;
  onSetUnsavedChanges: (hasChanges: boolean) => void;
  session: MobileSession | null;
}) {
  const [createdReservation, setCreatedReservation] =
    useState<MobileCreatedReservation | null>(null);
  const [eventDetail, setEventDetail] = useState<MobileEventDetail | null>(null);
  const [headcount, setHeadcount] = useState("1");
  const [isEventLoading, setIsEventLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [participantNames, setParticipantNames] = useState(
    session?.user.email?.split("@")[0] ?? "",
  );
  const [password, setPassword] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<
    Array<{ endAt: string; startAt: string }>
  >([]);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      if (!eventCode) {
        return;
      }

      setCreatedReservation(null);
      setEventDetail(null);
      setIsEventLoading(true);
      setLocalError(null);
      setSelectedSlots([]);

      try {
        const detail = await loadMobileEventDetail(eventCode);

        if (isMounted) {
          setEventDetail(detail);
          onSetUnsavedChanges(false);
          setSelectedDate(
            detail.activeDates.includes(buildDateKey(new Date()))
              ? buildDateKey(new Date())
              : detail.activeDates[0] ?? detail.event.date_start,
          );
        }
      } catch (error) {
        if (isMounted) {
          setLocalError(
            error instanceof Error
              ? error.message
              : "이벤트 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isMounted) {
          setIsEventLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [eventCode, onSetUnsavedChanges]);

  if (!eventCode) {
    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <EmptyCard detail="코드 입력 화면에서 이벤트를 먼저 열어 주세요." title="이벤트가 없어요" />
      </ScrollView>
    );
  }

  const currentDate =
    selectedDate && eventDetail?.activeDates.includes(selectedDate)
      ? selectedDate
      : eventDetail?.activeDates[0] ?? null;
  const startMinute = eventDetail
    ? getDailyStartMinute(eventDetail.event.daily_start_time)
    : 540;
  const endMinute = eventDetail
    ? getDailyEndMinute(eventDetail.event.daily_start_time, eventDetail.event.daily_end_time)
    : 1080;
  const timelineRows = buildTimelineRows(startMinute, endMinute);
  const timelineHeight = Math.max(
    ((endMinute - startMinute) / 60) * MANAGE_TIMELINE_HOUR_HEIGHT,
    MANAGE_TIMELINE_HOUR_HEIGHT,
  );
  const cells =
    eventDetail && currentDate
      ? buildAvailabilityCells(
          currentDate,
          eventDetail.event.daily_start_time,
          eventDetail.event.daily_end_time,
        )
      : [];
  const confirmedSlots = eventDetail?.reservationSlots.filter(
    (slot) => slot.is_confirmed,
  ) ?? [];
  const visibleConfirmedSlots = currentDate
    ? confirmedSlots
        .map((slot) => ({
          overlap: getSlotOverlapMinutes(slot, currentDate),
          slot,
        }))
        .filter(
          (
            item,
          ): item is {
            overlap: { end: number; start: number };
            slot: MobileDashboardSlot;
          } => item.overlap !== null,
        )
    : [];
  const visibleBufferRanges =
    eventDetail && currentDate
      ? buildMobileBufferRanges(eventDetail, confirmedSlots)
          .map((range) => ({
            overlap: getRangeOverlapMinutes(range, currentDate),
            range,
          }))
          .filter(
            (
              item,
            ): item is {
              overlap: { end: number; start: number };
              range: { endAt: string; startAt: string };
            } => item.overlap !== null,
          )
      : [];

  async function handleSubmit() {
    if (!eventDetail) {
      return;
    }

    setLocalError(null);

    const parsedHeadcount = Number.parseInt(headcount, 10);
    const participants = parseParticipantNames(participantNames).map(
      (guestName, index) => ({
        guestName,
        userId: index === 0 ? session?.user.id : undefined,
      }),
    );

    if (!Number.isInteger(parsedHeadcount) || parsedHeadcount < 1) {
      setLocalError("총 인원수를 입력해 주세요.");
      return;
    }

    if (participants.length === 0) {
      setLocalError("참여자 이름을 하나 이상 입력해 주세요.");
      return;
    }

    if (participants.length > parsedHeadcount) {
      setLocalError("참여자 수는 총 인원수를 초과할 수 없습니다.");
      return;
    }

    if (selectedSlots.length === 0) {
      setLocalError("예약 후보 시간을 하나 이상 선택해 주세요.");
      return;
    }

    const reservation = await onCreateReservation({
      eventId: eventDetail.event.id,
      headcount: parsedHeadcount,
      participants,
      password: password || null,
      requestedSlots: selectedSlots,
    });

    if (reservation) {
      setCreatedReservation(reservation);
      onSetUnsavedChanges(false);
      onOpenReservationManagement(
        reservation.reservation.reservation_access_code,
      );
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {isEventLoading ? <LoadingCard label="이벤트를 불러오는 중" /> : null}
      {localError || apiError ? (
        <Text style={styles.errorText}>{localError ?? apiError}</Text>
      ) : null}
      {eventDetail ? (
        <>
          <View style={styles.reserveHero}>
            <View style={styles.scheduleTop}>
              <View style={styles.previewTextBlock}>
                <Text style={styles.manageEyebrow}>EVENT</Text>
                <Text style={styles.manageTitle}>{eventDetail.event.title}</Text>
              </View>
              <Text style={styles.manageCode}>{eventDetail.event.event_code}</Text>
            </View>
            <Text style={styles.manageMeta}>
              {formatDate(eventDetail.event.date_start)} -{" "}
              {formatDate(eventDetail.event.date_end)}
            </Text>
            <Text style={styles.manageMeta}>
              {formatTimeFromClock(eventDetail.event.daily_start_time)} -{" "}
              {formatTimeFromClock(eventDetail.event.daily_end_time)}
            </Text>
            {eventDetail.event.description ? (
              <Text style={styles.reserveDescription}>
                {eventDetail.event.description}
              </Text>
            ) : null}
          </View>

          {createdReservation ? (
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>예약 신청 완료</Text>
              <Text style={styles.successText}>
                예약 관리 코드 {createdReservation.reservation.reservation_access_code}
              </Text>
              <Text style={styles.successMeta}>
                후보 {createdReservation.reservation.slots.length}개 · 상태 대기
              </Text>
            </View>
          ) : null}

          <View style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <Text style={styles.formTitle}>예약 정보</Text>
              <Text style={styles.formMeta}>혼합 그룹 가능</Text>
            </View>
            <Text style={styles.formLabel}>총 인원수</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => {
                setHeadcount(value);
                onSetUnsavedChanges(true);
              }}
              placeholder="1"
              placeholderTextColor={SUBTLE}
              style={styles.input}
              value={headcount}
            />
            <Text style={styles.formLabel}>참여자 이름</Text>
            <TextInput
              multiline
              onChangeText={(value) => {
                setParticipantNames(value);
                onSetUnsavedChanges(true);
              }}
              placeholder="쉼표나 줄바꿈으로 이름을 입력"
              placeholderTextColor={SUBTLE}
              style={[styles.input, styles.textArea]}
              value={participantNames}
            />
            <Text style={styles.formLabel}>관리 비밀번호 선택</Text>
            <TextInput
              onChangeText={(value) => {
                setPassword(value);
                onSetUnsavedChanges(true);
              }}
              placeholder="비워두면 코드만으로 관리"
              placeholderTextColor={SUBTLE}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          <View style={styles.manageCalendarCard}>
            <View style={styles.manageCalendarHeader}>
              <View>
                <Text style={styles.manageCalendarEyebrow}>CANDIDATES</Text>
                <Text style={styles.manageCalendarTitle}>후보 시간 선택</Text>
              </View>
              <Text style={styles.manageCalendarCount}>
                후보 {selectedSlots.length}개
              </Text>
            </View>

            <DateStripNavigator
              dates={eventDetail.activeDates}
              onSelectDate={setSelectedDate}
              selectedDate={currentDate ?? eventDetail.activeDates[0] ?? null}
            />

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
                {cells.map((cell) => {
                  const isAvailable = isRangeInAvailableBlocks(
                    eventDetail.timeBlocks,
                    cell,
                  );
                  const isSelected = isRangeInCandidateSlots(selectedSlots, cell);
                  const top =
                    ((cell.startMinute - startMinute) / 60) *
                    MANAGE_TIMELINE_HOUR_HEIGHT;
                  const height =
                    ((cell.endMinute - cell.startMinute) / 60) *
                    MANAGE_TIMELINE_HOUR_HEIGHT;

                  return (
                    <View
                      accessibilityRole="button"
                      key={cell.startAt}
                      style={[
                        styles.reserveCandidateCell,
                        isAvailable && styles.reserveCandidateCellAvailable,
                        isSelected && styles.reserveCandidateCellSelected,
                        { height, top },
                      ]}
                    >
                      {isSelected ? (
                        <Text style={styles.reserveCandidateCellText}>후보</Text>
                      ) : null}
                    </View>
                  );
                })}
                <DraggableTimelineSelectionLayer
                  cells={cells}
                  disabled={isLoading || isEventLoading}
                  inactiveLabel="후보 해제"
                  isSelected={(cell) => isRangeInCandidateSlots(selectedSlots, cell)}
                  onCommit={(range, shouldSelect) => {
                    onSetUnsavedChanges(true);
                    setSelectedSlots((current) =>
                      setCandidateSlotRange(current, range, shouldSelect),
                    );
                  }}
                  selectedLabel="후보 추가"
                  timelineStart={startMinute}
                />
                {visibleBufferRanges.map(({ overlap, range }, index) => (
                  <View
                    key={`${range.startAt}-${index}`}
                    pointerEvents="none"
                    style={[
                      styles.reserveBlockedOverlay,
                      getTimelineOverlayStyle(overlap, startMinute),
                    ]}
                  >
                    <Text style={styles.reserveBlockedOverlayText}>버퍼</Text>
                  </View>
                ))}
                {visibleConfirmedSlots.map(({ overlap, slot }) => (
                  <View
                    key={slot.id}
                    pointerEvents="none"
                    style={[
                      styles.reserveConfirmedOverlay,
                      getTimelineOverlayStyle(overlap, startMinute),
                    ]}
                  >
                    <Text style={styles.reserveConfirmedOverlayText}>확정</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {selectedSlots.length > 0 ? (
            <CandidateSlotList
              meta="행을 드래그해서 순서 변경"
              onReorder={(nextSlots) => {
                setSelectedSlots(nextSlots);
                onSetUnsavedChanges(true);
              }}
              slots={selectedSlots}
              title="후보 목록"
            />
          ) : null}

          <PrimaryAction
            disabled={isLoading || isEventLoading}
            label="예약 신청"
            loading={isLoading}
            onPress={handleSubmit}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function ReservationManageScreen({
  accessCode,
  apiError,
  isLoading,
  onCancelReservation,
  onSetUnsavedChanges,
  onUpdateReservation,
  session,
}: {
  accessCode: string | null;
  apiError: string | null;
  isLoading: boolean;
  onCancelReservation: (
    accessCode: string,
    password?: string | null,
  ) => Promise<MobileReservationManagement | null>;
  onSetUnsavedChanges: (hasChanges: boolean) => void;
  onUpdateReservation: (
    accessCode: string,
    payload: {
      headcount: number;
      participants: Array<{ guestName: string; userId?: string }>;
      password?: string | null;
      requestedSlots: Array<{ endAt: string; startAt: string }>;
    },
  ) => Promise<MobileReservationManagement | null>;
  session: MobileSession | null;
}) {
  const [detail, setDetail] = useState<MobileReservationManagement | null>(null);
  const [headcount, setHeadcount] = useState("1");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [participantNames, setParticipantNames] = useState("");
  const [password, setPassword] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<
    Array<{ endAt: string; startAt: string }>
  >([]);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      if (!accessCode) {
        return;
      }

      setDetail(null);
      setIsDetailLoading(true);
      setLocalError(null);
      setNotice(null);

      try {
        const management = await loadMobileReservationManagement(
          accessCode,
          session?.accessToken,
        );

        if (isMounted) {
          hydrateReservationManagement(management);
          onSetUnsavedChanges(false);
        }
      } catch (error) {
        if (isMounted) {
          setLocalError(
            error instanceof Error
              ? error.message
              : "예약 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    }

    function hydrateReservationManagement(management: MobileReservationManagement) {
      setDetail(management);
      setHeadcount(String(management.reservation.headcount));
      setParticipantNames(
        management.reservation.participants
          .map((participant) => participant.guest_name)
          .join(", "),
      );
      setSelectedSlots(
        management.reservation.slots
          .filter((slot) => !slot.is_confirmed)
          .map((slot) => ({
            endAt: slot.end_at,
            startAt: slot.start_at,
          })),
      );
      setSelectedDate(
        management.activeDates.includes(buildDateKey(new Date()))
          ? buildDateKey(new Date())
          : management.activeDates[0] ?? management.event.date_start,
      );
    }

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [accessCode, onSetUnsavedChanges, session?.accessToken]);

  if (!accessCode) {
    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <EmptyCard
          detail="코드 입력 화면에서 예약 관리 코드를 먼저 열어 주세요."
          title="예약 코드가 없어요"
        />
      </ScrollView>
    );
  }

  const currentDate =
    selectedDate && detail?.activeDates.includes(selectedDate)
      ? selectedDate
      : detail?.activeDates[0] ?? null;
  const startMinute = detail
    ? getDailyStartMinute(detail.event.daily_start_time)
    : 540;
  const endMinute = detail
    ? getDailyEndMinute(detail.event.daily_start_time, detail.event.daily_end_time)
    : 1080;
  const timelineRows = buildTimelineRows(startMinute, endMinute);
  const timelineHeight = Math.max(
    ((endMinute - startMinute) / 60) * MANAGE_TIMELINE_HOUR_HEIGHT,
    MANAGE_TIMELINE_HOUR_HEIGHT,
  );
  const cells =
    detail && currentDate
      ? buildAvailabilityCells(
          currentDate,
          detail.event.daily_start_time,
          detail.event.daily_end_time,
        )
      : [];
  const confirmedSlots = detail?.reservationSlots.filter(
    (slot) => slot.is_confirmed,
  ) ?? [];
  const visibleConfirmedSlots = currentDate
    ? confirmedSlots
        .map((slot) => ({
          overlap: getSlotOverlapMinutes(slot, currentDate),
          slot,
        }))
        .filter(
          (
            item,
          ): item is {
            overlap: { end: number; start: number };
            slot: MobileDashboardSlot;
          } => item.overlap !== null,
        )
    : [];
  const visibleBufferRanges =
    detail && currentDate
      ? buildMobileBufferRanges(detail, confirmedSlots)
          .map((range) => ({
            overlap: getRangeOverlapMinutes(range, currentDate),
            range,
          }))
          .filter(
            (
              item,
            ): item is {
              overlap: { end: number; start: number };
              range: { endAt: string; startAt: string };
            } => item.overlap !== null,
          )
      : [];

  async function handleSave() {
    if (!detail || !accessCode) {
      return;
    }

    setLocalError(null);
    setNotice(null);

    const parsedHeadcount = Number.parseInt(headcount, 10);
    const participants = parseParticipantNames(participantNames).map(
      (guestName, index) => ({
        guestName,
        userId: index === 0 ? session?.user.id : undefined,
      }),
    );

    if (!Number.isInteger(parsedHeadcount) || parsedHeadcount < 1) {
      setLocalError("총 인원수를 입력해 주세요.");
      return;
    }

    if (participants.length === 0) {
      setLocalError("참여자 이름을 하나 이상 입력해 주세요.");
      return;
    }

    if (participants.length > parsedHeadcount) {
      setLocalError("참여자 수는 총 인원수를 초과할 수 없습니다.");
      return;
    }

    if (
      selectedSlots.length === 0 &&
      !detail.reservation.slots.some((slot) => slot.is_confirmed)
    ) {
      setLocalError("예약 후보 시간을 하나 이상 선택해 주세요.");
      return;
    }

    if (detail.passwordRequired && !password) {
      setLocalError("예약 비밀번호를 입력해 주세요.");
      return;
    }

    const nextDetail = await onUpdateReservation(accessCode, {
      headcount: parsedHeadcount,
      participants,
      password: password || null,
      requestedSlots: selectedSlots,
    });

    if (nextDetail) {
      setDetail(nextDetail);
      setNotice("예약 정보를 저장했습니다.");
      onSetUnsavedChanges(false);
    }
  }

  async function handleCancel() {
    if (!accessCode) {
      return;
    }

    if (detail?.passwordRequired && !password) {
      setLocalError("예약 비밀번호를 입력해 주세요.");
      return;
    }

    const nextDetail = await onCancelReservation(accessCode, password || null);

    if (nextDetail) {
      setDetail(nextDetail);
      setNotice("예약을 취소했습니다.");
      onSetUnsavedChanges(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {isDetailLoading ? <LoadingCard label="예약 정보를 불러오는 중" /> : null}
      {localError || apiError ? (
        <Text style={styles.errorText}>{localError ?? apiError}</Text>
      ) : null}
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      {detail ? (
        <>
          <View style={styles.reserveHero}>
            <View style={styles.scheduleTop}>
              <View style={styles.previewTextBlock}>
                <Text style={styles.manageEyebrow}>RESERVATION</Text>
                <Text style={styles.manageTitle}>{detail.event.title}</Text>
              </View>
              <StatusPill
                approved={detail.reservation.status === "APPROVED"}
                label={statusLabel(detail.reservation.status)}
              />
            </View>
            <Text style={styles.manageMeta}>
              예약 관리 코드 {detail.reservation.reservation_access_code}
            </Text>
            <Text style={styles.manageMeta}>
              {formatDate(detail.event.date_start)} -{" "}
              {formatDate(detail.event.date_end)}
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <Text style={styles.formTitle}>예약 정보</Text>
              <Text style={styles.formMeta}>
                {detail.passwordRequired ? "비밀번호 필요" : "권한 확인됨"}
              </Text>
            </View>
            <Text style={styles.formLabel}>총 인원수</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => {
                setHeadcount(value);
                onSetUnsavedChanges(true);
              }}
              placeholder="1"
              placeholderTextColor={SUBTLE}
              style={styles.input}
              value={headcount}
            />
            <Text style={styles.formLabel}>참여자 이름</Text>
            <TextInput
              multiline
              onChangeText={(value) => {
                setParticipantNames(value);
                onSetUnsavedChanges(true);
              }}
              placeholder="쉼표나 줄바꿈으로 이름을 입력"
              placeholderTextColor={SUBTLE}
              style={[styles.input, styles.textArea]}
              value={participantNames}
            />
            {detail.passwordRequired ? (
              <>
                <Text style={styles.formLabel}>예약 비밀번호</Text>
                <TextInput
                  onChangeText={(value) => {
                    setPassword(value);
                    onSetUnsavedChanges(true);
                  }}
                  placeholder="예약 비밀번호"
                  placeholderTextColor={SUBTLE}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
              </>
            ) : null}
          </View>

          {detail.reservation.slots.some((slot) => slot.is_confirmed) ? (
            <View style={styles.formCard}>
              <View style={styles.formHeaderRow}>
                <Text style={styles.formTitle}>확정 일정</Text>
                <Text style={styles.formMeta}>수정 불가</Text>
              </View>
              {detail.reservation.slots
                .filter((slot) => slot.is_confirmed)
                .map((slot) => (
                  <View key={slot.id} style={styles.candidateRow}>
                    <StatusPill approved label="확정" />
                    <Text style={styles.candidateTime}>
                      {formatRange(
                        getSlotDisplayStart(slot),
                        getSlotDisplayEnd(slot),
                      )}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}

          <View style={styles.manageCalendarCard}>
            <View style={styles.manageCalendarHeader}>
              <View>
                <Text style={styles.manageCalendarEyebrow}>CANDIDATES</Text>
                <Text style={styles.manageCalendarTitle}>후보 시간 수정</Text>
              </View>
              <Text style={styles.manageCalendarCount}>
                후보 {selectedSlots.length}개
              </Text>
            </View>

            <DateStripNavigator
              dates={detail.activeDates}
              onSelectDate={setSelectedDate}
              selectedDate={currentDate ?? detail.activeDates[0] ?? null}
            />

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
                {cells.map((cell) => {
                  const isAvailable = isRangeInAvailableBlocks(
                    detail.timeBlocks,
                    cell,
                  );
                  const isSelected = isRangeInCandidateSlots(selectedSlots, cell);
                  const top =
                    ((cell.startMinute - startMinute) / 60) *
                    MANAGE_TIMELINE_HOUR_HEIGHT;
                  const height =
                    ((cell.endMinute - cell.startMinute) / 60) *
                    MANAGE_TIMELINE_HOUR_HEIGHT;

                  return (
                    <View
                      accessibilityRole="button"
                      key={cell.startAt}
                      style={[
                        styles.reserveCandidateCell,
                        isAvailable && styles.reserveCandidateCellAvailable,
                        isSelected && styles.reserveCandidateCellSelected,
                        { height, top },
                      ]}
                    >
                      {isSelected ? (
                        <Text style={styles.reserveCandidateCellText}>후보</Text>
                      ) : null}
                    </View>
                  );
                })}
                <DraggableTimelineSelectionLayer
                  cells={cells}
                  disabled={isLoading || isDetailLoading}
                  inactiveLabel="후보 해제"
                  isSelected={(cell) => isRangeInCandidateSlots(selectedSlots, cell)}
                  onCommit={(range, shouldSelect) => {
                    onSetUnsavedChanges(true);
                    setSelectedSlots((current) =>
                      setCandidateSlotRange(current, range, shouldSelect),
                    );
                  }}
                  selectedLabel="후보 추가"
                  timelineStart={startMinute}
                />
                {visibleBufferRanges.map(({ overlap, range }, index) => (
                  <View
                    key={`${range.startAt}-${index}`}
                    pointerEvents="none"
                    style={[
                      styles.reserveBlockedOverlay,
                      getTimelineOverlayStyle(overlap, startMinute),
                    ]}
                  >
                    <Text style={styles.reserveBlockedOverlayText}>버퍼</Text>
                  </View>
                ))}
                {visibleConfirmedSlots.map(({ overlap, slot }) => (
                  <View
                    key={slot.id}
                    pointerEvents="none"
                    style={[
                      styles.reserveConfirmedOverlay,
                      getTimelineOverlayStyle(overlap, startMinute),
                    ]}
                  >
                    <Text style={styles.reserveConfirmedOverlayText}>확정</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {selectedSlots.length > 0 ? (
            <CandidateSlotList
              meta="행을 드래그해서 순서 변경"
              onReorder={(nextSlots) => {
                setSelectedSlots(nextSlots);
                onSetUnsavedChanges(true);
              }}
              slots={selectedSlots}
              title="대기 후보"
            />
          ) : null}

          <PrimaryAction
            disabled={isLoading || isDetailLoading}
            label="예약 업데이트"
            loading={isLoading}
            onPress={handleSave}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isLoading || isDetailLoading}
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.dangerButton,
              (isLoading || isDetailLoading) && styles.primaryButtonDisabled,
              pressed && !isLoading && styles.pressed,
            ]}
          >
            <Text style={styles.dangerButtonText}>예약 취소</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function CandidateSlotList({
  meta,
  onReorder,
  slots,
  title,
}: {
  meta: string;
  onReorder: (slots: MobileTimeRange[]) => void;
  slots: MobileTimeRange[];
  title: string;
}) {
  const [dragState, setDragState] = useState<{
    fromIndex: number;
    toIndex: number;
  } | null>(null);
  const handlePreview = useCallback((fromIndex: number, toIndex: number) => {
    setDragState({ fromIndex, toIndex });
  }, []);
  const handleEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      setDragState(null);

      if (fromIndex !== toIndex) {
        onReorder(reorderMobileRanges(slots, fromIndex, toIndex));
      }
    },
    [onReorder, slots],
  );
  const handleCancel = useCallback(() => setDragState(null), []);

  return (
    <View style={styles.formCard}>
      <View style={styles.formHeaderRow}>
        <Text style={styles.formTitle}>{title}</Text>
        <Text style={styles.formMeta}>{meta}</Text>
      </View>
      {slots.map((slot, index) => (
        <CandidateSlotRow
          count={slots.length}
          index={index}
          isDragging={dragState?.fromIndex === index}
          key={`${slot.startAt}-${slot.endAt}`}
          onCancel={handleCancel}
          onEnd={handleEnd}
          onPreview={handlePreview}
          slot={slot}
          targetIndex={
            dragState?.fromIndex === index ? dragState.toIndex : null
          }
        />
      ))}
    </View>
  );
}

function CandidateSlotRow({
  count,
  index,
  isDragging,
  onCancel,
  onEnd,
  onPreview,
  slot,
  targetIndex,
}: {
  count: number;
  index: number;
  isDragging: boolean;
  onCancel: () => void;
  onEnd: (fromIndex: number, toIndex: number) => void;
  onPreview: (fromIndex: number, toIndex: number) => void;
  slot: MobileTimeRange;
  targetIndex: number | null;
}) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          count > 1 && Math.abs(gesture.dy) > 5,
        onStartShouldSetPanResponder: () => count > 1,
        onPanResponderGrant: () => onPreview(index, index),
        onPanResponderMove: (_, gesture) => {
          const nextIndex = clamp(
            index + Math.round(gesture.dy / CANDIDATE_REORDER_ROW_HEIGHT),
            0,
            count - 1,
          );

          onPreview(index, nextIndex);
        },
        onPanResponderRelease: (_, gesture) => {
          const nextIndex = clamp(
            index + Math.round(gesture.dy / CANDIDATE_REORDER_ROW_HEIGHT),
            0,
            count - 1,
          );

          onEnd(index, nextIndex);
        },
        onPanResponderTerminate: onCancel,
      }),
    [count, index, onCancel, onEnd, onPreview],
  );

  return (
    <View
      style={[
        styles.candidateRow,
        isDragging && styles.candidateRowDragging,
      ]}
    >
      <StatusPill approved={false} label={`후보 ${index + 1}`} />
      <Text style={styles.candidateTime}>{formatRange(slot.startAt, slot.endAt)}</Text>
      <View style={styles.candidateReorderMeta}>
        {targetIndex !== null && targetIndex !== index ? (
          <Text style={styles.candidateReorderTarget}>
            {targetIndex + 1}번으로
          </Text>
        ) : null}
        <View
          accessibilityLabel="후보 우선순위 드래그"
          accessibilityRole="button"
          style={styles.candidateReorderHandle}
          {...panResponder.panHandlers}
        >
          <Text style={styles.candidateReorderGrip}>≡</Text>
        </View>
      </View>
    </View>
  );
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

function ConfirmDialog({
  confirmLabel,
  isDanger = false,
  message,
  onCancel,
  onConfirm,
  title,
  visible,
}: {
  confirmLabel: string;
  isDanger?: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.modalBackdrop}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.confirmPanel}
        >
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmMessage}>{message}</Text>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.confirmCancelButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmCancelText}>취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                isDanger && styles.confirmDangerButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DateStripNavigator({
  dates,
  onSelectDate,
  selectedDate,
}: {
  dates: string[];
  onSelectDate: (date: string) => void;
  selectedDate: string | null;
}) {
  const sortedDates = useMemo(
    () =>
      [...new Set(dates)]
        .filter(isDateInputValue)
        .sort((left, right) => left.localeCompare(right)),
    [dates],
  );
  const todayKey = buildDateKey(new Date());
  const currentDate =
    selectedDate && sortedDates.includes(selectedDate)
      ? selectedDate
      : sortedDates[0] ?? null;
  const currentIndex = currentDate ? sortedDates.indexOf(currentDate) : -1;
  const monthDate = currentDate ? parseDateValue(currentDate) : new Date();
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);

  if (sortedDates.length === 0 || !currentDate) {
    return null;
  }

  function selectDateAt(index: number) {
    const nextDate = sortedDates[index];

    if (nextDate) {
      onSelectDate(nextDate);
    }
  }

  function handleSelectMonth(nextMonth: Date) {
    const nextMonthKey = buildMonthKey(nextMonth);
    const nextDate =
      sortedDates.find(
        (dateKey) => buildMonthKey(parseDateValue(dateKey)) === nextMonthKey,
      ) ?? sortedDates[0];

    onSelectDate(nextDate);
    setIsMonthPickerVisible(false);
  }

  return (
    <View style={styles.dateNavigator}>
      <View style={styles.dateNavigatorHeader}>
        <Pressable
          accessibilityLabel="이전 날짜"
          accessibilityRole="button"
          disabled={currentIndex <= 0}
          onPress={() => selectDateAt(currentIndex - 1)}
          style={({ pressed }) => [
            styles.dateNavButton,
            currentIndex <= 0 && styles.dateNavButtonDisabled,
            pressed && currentIndex > 0 && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.dateNavButtonText,
              currentIndex <= 0 && styles.dateNavButtonTextDisabled,
            ]}
          >
            ‹
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="연월 선택"
          accessibilityRole="button"
          onPress={() => setIsMonthPickerVisible(true)}
          style={({ pressed }) => [
            styles.dateMonthButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.dateMonthButtonText}>
            {formatMonthTitle(monthDate)}
          </Text>
        </Pressable>
        <View style={styles.dateNavigatorRight}>
          {sortedDates.includes(todayKey) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelectDate(todayKey)}
              style={({ pressed }) => [
                styles.dateTodayButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dateTodayButtonText}>오늘</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="다음 날짜"
            accessibilityRole="button"
            disabled={currentIndex >= sortedDates.length - 1}
            onPress={() => selectDateAt(currentIndex + 1)}
            style={({ pressed }) => [
              styles.dateNavButton,
              currentIndex >= sortedDates.length - 1 &&
                styles.dateNavButtonDisabled,
              pressed &&
                currentIndex < sortedDates.length - 1 &&
                styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.dateNavButtonText,
                currentIndex >= sortedDates.length - 1 &&
                  styles.dateNavButtonTextDisabled,
              ]}
            >
              ›
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.manageDateScroller}
      >
        <View style={styles.manageDateChipRow}>
          {sortedDates.map((dateKey) => {
            const parsedDate = parseDateValue(dateKey);
            const isSelected = dateKey === currentDate;
            const isToday = dateKey === todayKey;
            const weekday = parsedDate.getDay();

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={dateKey}
                onPress={() => onSelectDate(dateKey)}
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

      <MonthPickerModal
        activeDates={sortedDates}
        key={buildMonthKey(monthDate)}
        monthDate={monthDate}
        onClose={() => setIsMonthPickerVisible(false)}
        onSelectMonth={handleSelectMonth}
        visible={isMonthPickerVisible}
      />
    </View>
  );
}

function MonthPickerModal({
  activeDates,
  monthDate,
  onClose,
  onSelectMonth,
  visible,
}: {
  activeDates?: string[];
  monthDate: Date;
  onClose: () => void;
  onSelectMonth: (monthDate: Date) => void;
  visible: boolean;
}) {
  const [displayYear, setDisplayYear] = useState(monthDate.getFullYear());
  const activeMonthKeys = useMemo(
    () =>
      activeDates
        ? new Set(
            activeDates
              .filter(isDateInputValue)
              .map((dateKey) => buildMonthKey(parseDateValue(dateKey))),
          )
        : null,
    [activeDates],
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={styles.modalBackdrop}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.monthPickerPanel}
        >
          <View style={styles.monthPickerHeader}>
            <Pressable
              accessibilityLabel="이전 연도"
              accessibilityRole="button"
              onPress={() => setDisplayYear((year) => year - 1)}
              style={({ pressed }) => [
                styles.monthPickerArrow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.monthPickerArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.monthPickerTitle}>{displayYear}년</Text>
            <Pressable
              accessibilityLabel="다음 연도"
              accessibilityRole="button"
              onPress={() => setDisplayYear((year) => year + 1)}
              style={({ pressed }) => [
                styles.monthPickerArrow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.monthPickerArrowText}>›</Text>
            </Pressable>
          </View>
          <View style={styles.monthPickerGrid}>
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const optionDate = new Date(displayYear, monthIndex, 1);
              const monthKey = buildMonthKey(optionDate);
              const isSelected = buildMonthKey(monthDate) === monthKey;
              const isDisabled =
                activeMonthKeys !== null && !activeMonthKeys.has(monthKey);

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDisabled, selected: isSelected }}
                  disabled={isDisabled}
                  key={monthKey}
                  onPress={() => onSelectMonth(optionDate)}
                  style={({ pressed }) => [
                    styles.monthPickerOption,
                    isSelected && styles.monthPickerOptionActive,
                    isDisabled && styles.monthPickerOptionDisabled,
                    pressed && !isDisabled && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.monthPickerOptionText,
                      isSelected && styles.monthPickerOptionTextActive,
                      isDisabled && styles.monthPickerOptionTextDisabled,
                    ]}
                  >
                    {monthIndex + 1}월
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DraggableTimelineSelectionLayer({
  cells,
  disabled,
  inactiveLabel,
  isSelected,
  onCommit,
  selectedLabel,
  timelineStart,
}: {
  cells: MobileTimelineCell[];
  disabled?: boolean;
  inactiveLabel: string;
  isSelected: (cell: MobileTimelineCell) => boolean;
  onCommit: (range: MobileTimeRange, shouldSelect: boolean) => void;
  selectedLabel: string;
  timelineStart: number;
}) {
  const [dragState, setDragState] = useState<{
    currentIndex: number;
    shouldSelect: boolean;
    startIndex: number;
  } | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () =>
          !disabled && cells.length > 0,
        onStartShouldSetPanResponder: () =>
          !disabled && cells.length > 0,
        onPanResponderGrant: (event) => {
          const cellIndex = getTimelineCellIndexFromY(
            event.nativeEvent.locationY,
            cells,
            timelineStart,
          );
          const cell = cells[cellIndex];

          if (!cell) {
            return;
          }

          setDragState({
            currentIndex: cellIndex,
            shouldSelect: !isSelected(cell),
            startIndex: cellIndex,
          });
        },
        onPanResponderMove: (event) => {
          const cellIndex = getTimelineCellIndexFromY(
            event.nativeEvent.locationY,
            cells,
            timelineStart,
          );

          setDragState((currentDrag) =>
            currentDrag && cellIndex !== currentDrag.currentIndex
              ? { ...currentDrag, currentIndex: cellIndex }
              : currentDrag,
          );
        },
        onPanResponderRelease: () => {
          setDragState((currentDrag) => {
            if (!currentDrag) {
              return null;
            }

            const range = buildTimelineRangeFromIndexes(
              cells,
              currentDrag.startIndex,
              currentDrag.currentIndex,
            );

            if (range) {
              onCommit(range, currentDrag.shouldSelect);
            }

            return null;
          });
        },
        onPanResponderTerminate: () => setDragState(null),
      }),
    [cells, disabled, isSelected, onCommit, timelineStart],
  );
  const previewRange = dragState
    ? buildTimelineRangeFromIndexes(
        cells,
        dragState.startIndex,
        dragState.currentIndex,
      )
    : null;

  return (
    <View style={styles.timelineDragLayer} {...panResponder.panHandlers}>
      {previewRange ? (
        <View
          pointerEvents="none"
          style={[
            styles.timelineDragPreview,
            dragState?.shouldSelect
              ? styles.timelineDragPreviewAdd
              : styles.timelineDragPreviewRemove,
            getTimelineOverlayStyle(
              {
                end: previewRange.endMinute,
                start: previewRange.startMinute,
              },
              timelineStart,
            ),
          ]}
        >
          <Text
            style={[
              styles.timelineDragPreviewText,
              dragState?.shouldSelect
                ? styles.timelineDragPreviewTextAdd
                : styles.timelineDragPreviewTextRemove,
            ]}
          >
            {dragState?.shouldSelect ? selectedLabel : inactiveLabel}
          </Text>
        </View>
      ) : null}
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

function TimePresetToggle({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.timePresetToggle,
        active && styles.timePresetToggleActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.timePresetCheck, active && styles.timePresetCheckActive]}>
        {active ? <Text style={styles.timePresetCheckText}>✓</Text> : null}
      </View>
      <Text style={[styles.timePresetText, active && styles.timePresetTextActive]}>
        {label}
      </Text>
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

  if (route === "eventReserve") {
    return "예약 신청";
  }

  if (route === "reservationManage") {
    return "예약 관리";
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
        target: { eventId: event.id, kind: "host" },
        title: event.title,
      }),
    ),
    ...event.pendingSlots.map((slot) =>
      buildScheduleItem({
        group: "호스트",
        slot,
        status: "대기",
        target: { eventId: event.id, kind: "host" },
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
        target: reservation.reservation_access_code
          ? {
              accessCode: reservation.reservation_access_code,
              kind: "reservation",
            }
          : undefined,
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
  target,
  title,
}: {
  group: string;
  slot: MobileDashboardSlot;
  status: string;
  target?: ScheduleItem["target"];
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
    target,
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
      accessCode: reservation.reservation_access_code,
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
  return getRangeOverlapMinutes(
    {
      endAt: getSlotDisplayEnd(slot),
      startAt: getSlotDisplayStart(slot),
    },
    dateKey,
  );
}

function getRangeOverlapMinutes(
  range: { endAt: string; startAt: string },
  dateKey: string,
) {
  const dayStart = parseDateValue(dateKey);
  const dayEnd = new Date(dayStart);
  const rangeStart = parseDateValue(range.startAt);
  const rangeEnd = parseDateValue(range.endAt);

  dayEnd.setDate(dayEnd.getDate() + 1);

  if (
    Number.isNaN(dayStart.getTime()) ||
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime())
  ) {
    return null;
  }

  const overlapStart = Math.max(rangeStart.getTime(), dayStart.getTime());
  const overlapEnd = Math.min(rangeEnd.getTime(), dayEnd.getTime());

  if (overlapEnd <= overlapStart) {
    return null;
  }

  return {
    end: Math.ceil((overlapEnd - dayStart.getTime()) / 60000),
    start: Math.floor((overlapStart - dayStart.getTime()) / 60000),
  };
}

function buildAvailabilityCells(
  dateKey: string,
  dailyStartTime: string,
  dailyEndTime: string,
): MobileTimelineCell[] {
  const startMinute = getDailyStartMinute(dailyStartTime);
  const endMinute = getDailyEndMinute(dailyStartTime, dailyEndTime);
  const cells: Array<{
    endAt: string;
    endMinute: number;
    startAt: string;
    startMinute: number;
  }> = [];

  for (let minute = startMinute; minute < endMinute; minute += 30) {
    const nextMinute = Math.min(minute + 30, endMinute);

    cells.push({
      endAt: buildDateTimeForMinute(dateKey, nextMinute),
      endMinute: nextMinute,
      startAt: buildDateTimeForMinute(dateKey, minute),
      startMinute: minute,
    });
  }

  return cells;
}

function getDailyStartMinute(dailyStartTime: string) {
  const startClock = parseClockMinutes(dailyStartTime);

  return Number.isNaN(startClock) ? 540 : Math.max(0, startClock);
}

function getDailyEndMinute(dailyStartTime: string, dailyEndTime: string) {
  const startMinute = getDailyStartMinute(dailyStartTime);
  const endClock = parseClockMinutes(dailyEndTime);

  return Number.isNaN(endClock) || endClock <= startMinute ? 1440 : endClock;
}

function isRangeInAvailableBlocks(
  blocks: MobileTimeBlock[],
  range: { endAt: string; startAt: string },
) {
  const start = parseDateValue(range.startAt).getTime();
  const end = parseDateValue(range.endAt).getTime();

  return blocks.some((block) => {
    if (block.type !== "AVAILABLE") {
      return false;
    }

    const blockStart = parseDateValue(block.start_at).getTime();
    const blockEnd = parseDateValue(block.end_at).getTime();

    return blockStart <= start && end <= blockEnd;
  });
}

function isRangeInCandidateSlots(
  slots: Array<{ endAt: string; startAt: string }>,
  range: { endAt: string; startAt: string },
) {
  const start = parseDateValue(range.startAt).getTime();
  const end = parseDateValue(range.endAt).getTime();

  return slots.some(
    (slot) =>
      parseDateValue(slot.startAt).getTime() <= start &&
      end <= parseDateValue(slot.endAt).getTime(),
  );
}

function setCandidateSlotRange(
  slots: Array<{ endAt: string; startAt: string }>,
  range: { endAt: string; startAt: string },
  shouldSelect: boolean,
) {
  if (!shouldSelect) {
    return slots.flatMap((slot) => subtractMobileTimeRange(slot, range));
  }

  const relatedIndexes = slots
    .map((slot, index) => ({
      index,
      isRelated: mobileRangesTouchOrOverlap(slot, range),
    }))
    .filter((item) => item.isRelated)
    .map((item) => item.index);

  if (relatedIndexes.length === 0) {
    return [...slots, range];
  }

  const firstRelatedIndex = Math.min(...relatedIndexes);
  const relatedIndexSet = new Set(relatedIndexes);
  const relatedRanges = slots.filter((_, index) => relatedIndexSet.has(index));
  const mergedRanges = mergeMobileRanges([...relatedRanges, range]);
  const nextSlots = slots.filter((_, index) => !relatedIndexSet.has(index));

  nextSlots.splice(firstRelatedIndex, 0, ...mergedRanges);

  return nextSlots;
}

function createMobileTimeBlockDrafts(blocks: MobileTimeBlock[]) {
  return blocks.map<MobileTimeBlockDraft>((block) => ({
    endAt: block.end_at,
    note: block.note,
    startAt: block.start_at,
    type: block.type,
  }));
}

function buildMobileTimeBlockDraftKey(blocks: MobileTimeBlockDraft[]) {
  return mergeMobileTimeBlockDrafts(blocks)
    .map(
      (block) =>
        `${block.type}:${block.startAt}:${block.endAt}:${block.note ?? ""}`,
    )
    .join("|");
}

function isRangeInAvailableDrafts(
  blocks: MobileTimeBlockDraft[],
  range: { endAt: string; startAt: string },
) {
  const start = parseDateValue(range.startAt).getTime();
  const end = parseDateValue(range.endAt).getTime();

  return blocks.some((block) => {
    if (block.type !== "AVAILABLE") {
      return false;
    }

    const blockStart = parseDateValue(block.startAt).getTime();
    const blockEnd = parseDateValue(block.endAt).getTime();

    return blockStart <= start && end <= blockEnd;
  });
}

function setMobileAvailabilityDraftRange(
  blocks: MobileTimeBlockDraft[],
  range: { endAt: string; startAt: string },
  shouldBeAvailable: boolean,
): MobileTimeBlockDraft[] {
  const drafts = blocks.map<MobileTimeBlockDraft>((block) => ({ ...block }));
  const availableBlocks = drafts.filter((block) => block.type === "AVAILABLE");
  const otherBlocks = drafts.filter((block) => block.type !== "AVAILABLE");
  const nextAvailableBlocks = shouldBeAvailable
    ? [
        ...availableBlocks,
        {
          ...range,
          note: null,
          type: "AVAILABLE" as const,
        },
      ]
    : availableBlocks.flatMap((block) =>
        subtractMobileTimeRange(block, range).map((piece) => ({
          ...piece,
          note: block.note ?? null,
          type: "AVAILABLE" as const,
        })),
      );

  return mergeMobileTimeBlockDrafts([...otherBlocks, ...nextAvailableBlocks]);
}

function getTimelineCellIndexFromY(
  locationY: number,
  cells: MobileTimelineCell[],
  timelineStart: number,
) {
  if (cells.length === 0) {
    return -1;
  }

  const minuteAtY =
    timelineStart +
    (Math.max(0, locationY) / MANAGE_TIMELINE_HOUR_HEIGHT) * 60;
  const matchingIndex = cells.findIndex(
    (cell) => cell.startMinute <= minuteAtY && minuteAtY < cell.endMinute,
  );

  if (matchingIndex >= 0) {
    return matchingIndex;
  }

  if (minuteAtY < cells[0].startMinute) {
    return 0;
  }

  return cells.length - 1;
}

function buildTimelineRangeFromIndexes(
  cells: MobileTimelineCell[],
  startIndex: number,
  endIndex: number,
) {
  if (cells.length === 0 || startIndex < 0 || endIndex < 0) {
    return null;
  }

  const firstIndex = Math.min(startIndex, endIndex);
  const lastIndex = Math.max(startIndex, endIndex);
  const firstCell = cells[firstIndex];
  const lastCell = cells[lastIndex];

  if (!firstCell || !lastCell) {
    return null;
  }

  return {
    endAt: lastCell.endAt,
    endMinute: lastCell.endMinute,
    startAt: firstCell.startAt,
    startMinute: firstCell.startMinute,
  };
}

function mergeMobileRanges(ranges: Array<{ endAt: string; startAt: string }>) {
  return ranges
    .filter(isMobileTimeRangeValid)
    .sort(
      (left, right) =>
        parseDateValue(left.startAt).getTime() -
        parseDateValue(right.startAt).getTime(),
    )
    .reduce<Array<{ endAt: string; startAt: string }>>((merged, range) => {
      const previous = merged.at(-1);

      if (
        previous &&
        parseDateValue(range.startAt).getTime() <=
          parseDateValue(previous.endAt).getTime()
      ) {
        previous.endAt = new Date(
          Math.max(
            parseDateValue(previous.endAt).getTime(),
            parseDateValue(range.endAt).getTime(),
          ),
        ).toISOString();
        return merged;
      }

      return [...merged, { ...range }];
    }, []);
}

function subtractMobileTimeRange(
  range: { endAt: string; startAt: string },
  removal: { endAt: string; startAt: string },
) {
  if (!mobileRangesOverlap(range, removal)) {
    return [range];
  }

  const rangeStart = parseDateValue(range.startAt).getTime();
  const rangeEnd = parseDateValue(range.endAt).getTime();
  const removalStart = parseDateValue(removal.startAt).getTime();
  const removalEnd = parseDateValue(removal.endAt).getTime();
  const pieces: Array<{ endAt: string; startAt: string }> = [];

  if (rangeStart < removalStart) {
    pieces.push({
      endAt: new Date(Math.min(removalStart, rangeEnd)).toISOString(),
      startAt: range.startAt,
    });
  }

  if (removalEnd < rangeEnd) {
    pieces.push({
      endAt: range.endAt,
      startAt: new Date(Math.max(removalEnd, rangeStart)).toISOString(),
    });
  }

  return pieces.filter((piece) => isMobileTimeRangeValid(piece));
}

function mergeMobileTimeBlockDrafts(blocks: MobileTimeBlockDraft[]) {
  return (["AVAILABLE", "BLOCKED"] as const).flatMap((type) => {
    const typeBlocks = blocks
      .filter((block) => block.type === type && isMobileTimeRangeValid(block))
      .sort(
        (left, right) =>
          parseDateValue(left.startAt).getTime() -
          parseDateValue(right.startAt).getTime(),
      );

    return typeBlocks.reduce<MobileTimeBlockDraft[]>((merged, block) => {
      const previous = merged.at(-1);

      if (
        previous &&
        parseDateValue(block.startAt).getTime() <=
          parseDateValue(previous.endAt).getTime()
      ) {
        previous.endAt = new Date(
          Math.max(
            parseDateValue(previous.endAt).getTime(),
            parseDateValue(block.endAt).getTime(),
          ),
        ).toISOString();
        return merged;
      }

      return [...merged, { ...block, note: block.note ?? null, type }];
    }, []);
  });
}

function mobileRangesOverlap(
  left: { endAt: string; startAt: string },
  right: { endAt: string; startAt: string },
) {
  return (
    parseDateValue(left.startAt).getTime() <
      parseDateValue(right.endAt).getTime() &&
    parseDateValue(right.startAt).getTime() <
      parseDateValue(left.endAt).getTime()
  );
}

function mobileRangesTouchOrOverlap(
  left: { endAt: string; startAt: string },
  right: { endAt: string; startAt: string },
) {
  return (
    parseDateValue(left.startAt).getTime() <=
      parseDateValue(right.endAt).getTime() &&
    parseDateValue(right.startAt).getTime() <=
      parseDateValue(left.endAt).getTime()
  );
}

function reorderMobileRanges<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);

  if (item === undefined) {
    return items;
  }

  nextItems.splice(toIndex, 0, item);

  return nextItems;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isMobileTimeRangeValid(range: { endAt: string; startAt: string }) {
  return parseDateValue(range.startAt).getTime() < parseDateValue(range.endAt).getTime();
}

function buildMobileBufferRanges(
  detail: MobileEventDetail,
  confirmedSlots: MobileDashboardSlot[],
) {
  if (!detail.event.is_buffer_active || detail.event.buffer_time_minutes <= 0) {
    return [];
  }

  const bufferMs = detail.event.buffer_time_minutes * 60_000;
  const overrideByKey = new Map(
    detail.bufferOverrides.map((override) => [
      `${override.reservation_slot_id}:${override.side}`,
      override,
    ]),
  );

  return confirmedSlots.flatMap((slot) => {
    const start = parseDateValue(getSlotDisplayStart(slot)).getTime();
    const end = parseDateValue(getSlotDisplayEnd(slot)).getTime();

    return (["BEFORE", "AFTER"] as const).flatMap((side) => {
      const defaultActive =
        side === "BEFORE"
          ? detail.event.is_buffer_before_active
          : detail.event.is_buffer_after_active;
      const override = overrideByKey.get(`${slot.id}:${side}`);
      const isActive = override ? override.is_active : defaultActive;

      if (!isActive) {
        return [];
      }

      const defaultRange =
        side === "BEFORE"
          ? {
              endAt: new Date(start).toISOString(),
              startAt: new Date(start - bufferMs).toISOString(),
            }
          : {
              endAt: new Date(end + bufferMs).toISOString(),
              startAt: new Date(end).toISOString(),
            };
      const range = {
        endAt: override?.custom_end_at ?? defaultRange.endAt,
        startAt: override?.custom_start_at ?? defaultRange.startAt,
      };

      return isMobileTimeRangeValid(range) ? [range] : [];
    });
  });
}

function getTimelineOverlayStyle(
  overlap: { end: number; start: number },
  timelineStart: number,
) {
  return {
    height: Math.max(
      ((overlap.end - overlap.start) / 60) * MANAGE_TIMELINE_HOUR_HEIGHT - 6,
      MANAGE_TIMELINE_BLOCK_MIN_HEIGHT,
    ),
    top:
      ((overlap.start - timelineStart) / 60) * MANAGE_TIMELINE_HOUR_HEIGHT + 3,
  };
}

function parseParticipantNames(value: string) {
  return value
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
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

function buildDateTimeForMinute(dateKey: string, minuteOfDay: number) {
  const date = parseDateValue(dateKey);
  const clampedMinute = Math.min(1440, Math.max(0, minuteOfDay));

  date.setHours(0, clampedMinute, 0, 0);

  return date.toISOString();
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

function trimClockValue(value: string) {
  const [hoursText = "00", minutesText = "00"] = value.split(":");

  return `${hoursText.padStart(2, "0")}:${minutesText.padStart(2, "0")}`;
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

function buildMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${date.getFullYear()}-${month}`;
}

function addMonthsToDate(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonthTitle(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
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

function normalizeActiveDateSelection(activeDates: string[]) {
  return [
    ...new Set(activeDates.filter((date) => isDateInputValue(date))),
  ].sort();
}

function normalizeActiveDateList(
  activeDates: string[] | undefined,
  fallbackStart: string,
  fallbackEnd: string,
) {
  const normalized = normalizeActiveDateSelection(activeDates ?? []);

  if (normalized.length > 0) {
    return normalized;
  }

  if (isDateInputValue(fallbackStart) && isDateInputValue(fallbackEnd)) {
    return buildActiveDatesBetweenInputs(fallbackStart, fallbackEnd);
  }

  return [buildDateKey(new Date())];
}

function buildActiveDatesBetweenInputs(dateStart: string, dateEnd: string) {
  if (!isDateInputValue(dateStart) || !isDateInputValue(dateEnd)) {
    return [];
  }

  const [nextStart, nextEnd] = sortDatePair(dateStart, dateEnd);

  return buildDateList(nextStart, nextEnd);
}

function applyActiveDateSelection(
  currentActiveDates: string[],
  targetDates: string[],
  shouldActivate: boolean,
) {
  const nextDates = new Set(normalizeActiveDateSelection(currentActiveDates));

  targetDates.forEach((date) => {
    if (!isDateInputValue(date)) {
      return;
    }

    if (shouldActivate) {
      nextDates.add(date);
    } else {
      nextDates.delete(date);
    }
  });

  const normalized = normalizeActiveDateSelection([...nextDates]);

  return normalized.length > 0 ? normalized : normalizeActiveDateSelection(currentActiveDates);
}

function getActiveDateBounds(
  activeDates: string[],
  fallbackStart: string,
  fallbackEnd: string,
): [string, string] {
  const normalized = normalizeActiveDateSelection(activeDates);

  if (normalized.length > 0) {
    return [normalized[0], normalized[normalized.length - 1]];
  }

  if (isDateInputValue(fallbackStart) && isDateInputValue(fallbackEnd)) {
    return sortDatePair(fallbackStart, fallbackEnd);
  }

  const today = buildDateKey(new Date());

  return [today, today];
}

function sortDatePair(left: string, right: string): [string, string] {
  if (!isDateInputValue(left) || !isDateInputValue(right)) {
    const fallback = buildDateKey(new Date());

    return [fallback, fallback];
  }

  return left <= right ? [left, right] : [right, left];
}

function isDateInputValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isTimeInputValue(value: string) {
  return /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(value);
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
  candidateRow: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  candidateRowDragging: {
    backgroundColor: PRIMARY_SOFT,
    borderColor: PRIMARY,
  },
  candidateReorderGrip: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22,
  },
  candidateReorderHandle: {
    alignItems: "center",
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 38,
  },
  candidateReorderMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  candidateReorderTarget: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "900",
  },
  candidateTime: {
    color: INK,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
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
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 18,
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  confirmButtonText: {
    color: BACKGROUND,
    fontSize: 14,
    fontWeight: "900",
  },
  confirmCancelButton: {
    alignItems: "center",
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  confirmCancelText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "900",
  },
  confirmDangerButton: {
    backgroundColor: "#B95050",
  },
  confirmMessage: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },
  confirmPanel: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 10,
    borderWidth: 1,
    padding: 18,
    width: "100%",
  },
  confirmTitle: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 22,
    fontWeight: "700",
  },
  dateRangeDay: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    position: "relative",
    width: "14.285%",
  },
  dateRangeDayActive: {
    backgroundColor: PRIMARY_SOFT,
  },
  dateRangeDayActivePreview: {
    backgroundColor: "rgba(0, 38, 75, 0.78)",
  },
  dateRangeDayEndpoint: {
    backgroundColor: PRIMARY,
  },
  dateRangeDayInactivePreview: {
    backgroundColor: "rgba(185, 80, 80, 0.13)",
  },
  dateRangeDayText: {
    color: INK,
    fontSize: 14,
    fontWeight: "800",
  },
  dateRangeDayTextActive: {
    color: BACKGROUND,
  },
  dateRangeDayTextInactivePreview: {
    color: "#B95050",
  },
  dateRangeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dateRangeHint: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  dateRangePicker: {
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  dateRangeTodayDot: {
    backgroundColor: PRIMARY,
    borderRadius: 3,
    bottom: 5,
    height: 5,
    position: "absolute",
    width: 5,
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
  dateMonthButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
  },
  dateMonthButtonText: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 18,
    fontWeight: "700",
  },
  dateNavButton: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 42,
  },
  dateNavButtonDisabled: {
    opacity: 0.35,
  },
  dateNavButtonText: {
    color: PRIMARY,
    fontSize: 25,
    fontWeight: "600",
    lineHeight: 28,
  },
  dateNavButtonTextDisabled: {
    color: SUBTLE,
  },
  dateNavigator: {
    gap: 10,
  },
  dateNavigatorHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  dateNavigatorRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  dateTodayButton: {
    alignItems: "center",
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  dateTodayButtonText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: BACKGROUND,
    borderColor: "#F1C5C5",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#B95050",
    fontSize: 14,
    fontWeight: "900",
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
  eventEditActions: {
    borderTopColor: BORDER,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
  },
  eventEditContent: {
    gap: 12,
    paddingBottom: 10,
  },
  eventEditPanel: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 10,
    borderWidth: 1,
    gap: 14,
    maxHeight: "90%",
    padding: 16,
    width: "100%",
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
  timeLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
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
  inputDisabled: {
    backgroundColor: "#F3F4F6",
    color: MUTED,
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
  monthHeaderRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  monthNavButton: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  monthNavText: {
    color: PRIMARY,
    fontSize: 26,
    fontWeight: "600",
    lineHeight: 28,
  },
  monthPickerArrow: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  monthPickerArrowText: {
    color: PRIMARY,
    fontSize: 26,
    fontWeight: "600",
    lineHeight: 28,
  },
  monthPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthPickerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthPickerOption: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    width: "30.5%",
  },
  monthPickerOptionActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  monthPickerOptionDisabled: {
    opacity: 0.28,
  },
  monthPickerOptionText: {
    color: INK,
    fontSize: 13,
    fontWeight: "900",
  },
  monthPickerOptionTextActive: {
    color: BACKGROUND,
  },
  monthPickerOptionTextDisabled: {
    color: SUBTLE,
  },
  monthPickerPanel: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
    padding: 16,
    width: "86%",
  },
  monthPickerTitle: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 22,
    fontWeight: "700",
  },
  monthTitle: {
    color: INK,
    fontFamily: serifFont,
    fontSize: 23,
    fontWeight: "700",
  },
  monthTitleButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
  },
  manageCalendarCard: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  manageCalendarActions: {
    alignItems: "flex-end",
    gap: 8,
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
  manageHeroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  manageDeleteButton: {
    alignItems: "center",
    backgroundColor: "#FFF7F7",
    borderColor: "#F1C5C5",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  manageDeleteButtonText: {
    color: "#B95050",
    fontSize: 12,
    fontWeight: "900",
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
  manageEditButton: {
    alignItems: "center",
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
    minWidth: 94,
    paddingHorizontal: 12,
  },
  manageEditButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  manageEditButtonText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "900",
  },
  manageEditButtonTextActive: {
    color: BACKGROUND,
  },
  manageEditActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  manageTimeline: {
    flexDirection: "row",
    gap: 10,
  },
  manageAvailabilityBlock: {
    backgroundColor: "rgba(0, 38, 75, 0.08)",
    borderColor: "rgba(0, 38, 75, 0.16)",
    borderRadius: 8,
    borderWidth: 1,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    position: "absolute",
    right: 6,
  },
  manageAvailabilityBlockText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "900",
  },
  manageAvailabilityCell: {
    backgroundColor: "rgba(17, 24, 39, 0.02)",
    borderColor: "rgba(229, 231, 235, 0.9)",
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: "center",
    left: 6,
    paddingHorizontal: 8,
    position: "absolute",
    right: 6,
  },
  manageAvailabilityCellActive: {
    backgroundColor: "rgba(0, 38, 75, 0.14)",
    borderColor: "rgba(0, 38, 75, 0.32)",
  },
  manageAvailabilityCellText: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: "900",
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
  monthTodayButton: {
    alignItems: "center",
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.25)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
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
  pressableCard: {
    borderColor: "rgba(0, 38, 75, 0.22)",
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
  previewAction: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  previewActionText: {
    color: BACKGROUND,
    fontSize: 14,
    fontWeight: "900",
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
  reserveBlockedOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(107, 114, 128, 0.18)",
    borderRadius: 8,
    justifyContent: "center",
    left: 8,
    position: "absolute",
    right: 8,
  },
  reserveBlockedOverlayText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "900",
  },
  reserveCandidateCell: {
    backgroundColor: "rgba(17, 24, 39, 0.02)",
    borderColor: "rgba(229, 231, 235, 0.9)",
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: "center",
    left: 6,
    paddingHorizontal: 8,
    position: "absolute",
    right: 6,
  },
  reserveCandidateCellAvailable: {
    backgroundColor: "rgba(0, 38, 75, 0.07)",
    borderColor: "rgba(0, 38, 75, 0.16)",
  },
  reserveCandidateCellSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  reserveCandidateCellText: {
    color: BACKGROUND,
    fontSize: 10,
    fontWeight: "900",
  },
  reserveConfirmedOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 38, 75, 0.82)",
    borderRadius: 8,
    justifyContent: "center",
    left: 8,
    position: "absolute",
    right: 8,
  },
  reserveConfirmedOverlayText: {
    color: BACKGROUND,
    fontSize: 11,
    fontWeight: "900",
  },
  reserveDescription: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  reserveHero: {
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
  successCard: {
    backgroundColor: "#EAF7EF",
    borderColor: "#BFE6CE",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  successMeta: {
    color: APPROVED,
    fontSize: 12,
    fontWeight: "800",
  },
  successText: {
    color: INK,
    fontSize: 14,
    fontWeight: "900",
  },
  successTitle: {
    color: APPROVED,
    fontSize: 16,
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
  timelineDragLayer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20,
  },
  timelineDragPreview: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    left: 5,
    paddingHorizontal: 8,
    position: "absolute",
    right: 5,
  },
  timelineDragPreviewAdd: {
    backgroundColor: "rgba(0, 38, 75, 0.2)",
    borderColor: "rgba(0, 38, 75, 0.42)",
  },
  timelineDragPreviewRemove: {
    backgroundColor: "rgba(185, 80, 80, 0.14)",
    borderColor: "rgba(185, 80, 80, 0.36)",
  },
  timelineDragPreviewText: {
    fontSize: 11,
    fontWeight: "900",
  },
  timelineDragPreviewTextAdd: {
    color: PRIMARY,
  },
  timelineDragPreviewTextRemove: {
    color: "#B95050",
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
  timePresetCheck: {
    alignItems: "center",
    borderColor: BORDER,
    borderRadius: 4,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  timePresetCheckActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  timePresetCheckText: {
    color: BACKGROUND,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
  },
  timePresetText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "900",
  },
  timePresetTextActive: {
    color: PRIMARY,
  },
  timePresetToggle: {
    alignItems: "center",
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  timePresetToggleActive: {
    backgroundColor: PRIMARY_SOFT,
    borderColor: "rgba(0, 38, 75, 0.22)",
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
