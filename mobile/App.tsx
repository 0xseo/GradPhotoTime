import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, type WebView as WebViewType } from "react-native-webview";

type TabKey = "calendar" | "events" | "joined" | "my";
type FabAction = {
  label: string;
  path: string;
};

const PRIMARY = "#00264B";
const BORDER = "#E5E7EB";
const BACKGROUND = "#FFFFFF";
const MUTED = "#F5F6F8";
const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

const TABS: Array<{ key: TabKey; label: string; title: string }> = [
  { key: "events", label: "내 이벤트", title: "내 이벤트" },
  { key: "calendar", label: "달력", title: "달력" },
  { key: "joined", label: "참여한 이벤트", title: "참여한 이벤트" },
  { key: "my", label: "My", title: "My" },
];

export default function App() {
  const webViewRef = useRef<WebViewType>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("calendar");
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [uri, setUri] = useState(() => getTabUrl("calendar"));
  const fabActions = useMemo(() => getFabActions(activeTab), [activeTab]);

  function openTab(tab: TabKey) {
    setActiveTab(tab);
    setIsFabOpen(false);
    setUri(getTabUrl(tab));
  }

  function openPath(path: string) {
    setIsFabOpen(false);
    setUri(buildUrl(path));
  }

  function handleFabPress() {
    if (fabActions.length === 1) {
      openPath(fabActions[0].path);
      return;
    }

    setIsFabOpen((current) => !current);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.app}>
        <View style={styles.webViewShell}>
          <WebView
            ref={webViewRef}
            source={{ uri }}
            startInLoadingState
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={PRIMARY} />
              </View>
            )}
          />
        </View>

        <View style={styles.fabLayer} pointerEvents="box-none">
          {isFabOpen ? (
            <View style={styles.fabMenu}>
              {fabActions.map((action) => (
                <Pressable
                  accessibilityRole="button"
                  key={action.label}
                  onPress={() => openPath(action.path)}
                  style={({ pressed }: { pressed: boolean }) => [
                    styles.fabAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.fabActionText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            accessibilityLabel="빠른 작업"
            accessibilityRole="button"
            onPress={handleFabPress}
            style={({ pressed }: { pressed: boolean }) => [
              styles.fab,
              pressed && styles.fabPressed,
            ]}
          >
            <Text style={styles.fabText}>{isFabOpen ? "x" : "+"}</Text>
          </Pressable>
        </View>

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;

            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={tab.key}
                onPress={() => openTab(tab.key)}
                style={({ pressed }: { pressed: boolean }) => [
                  styles.tab,
                  isActive && styles.activeTab,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.tabLabel, isActive && styles.activeTabLabel]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function getTabUrl(tab: TabKey) {
  if (tab === "events") {
    return buildUrl("/", { mobileView: "host" });
  }

  if (tab === "joined") {
    return buildUrl("/", { mobileView: "guest" });
  }

  if (tab === "my") {
    return buildUrl("/auth");
  }

  return buildUrl("/", { mobileView: "calendar" });
}

function getFabActions(tab: TabKey): FabAction[] {
  if (tab === "events") {
    return [{ label: "이벤트 만들기", path: "/host/events/new" }];
  }

  if (tab === "joined") {
    return [{ label: "이벤트 참여하기", path: "/access" }];
  }

  return [
    { label: "이벤트 만들기", path: "/host/events/new" },
    { label: "이벤트 참여하기", path: "/access" },
  ];
}

function buildUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(path, WEB_BASE_URL);

  url.searchParams.set("shell", "mobile");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

const styles = StyleSheet.create({
  activeTab: {
    borderTopColor: PRIMARY,
  },
  activeTabLabel: {
    color: PRIMARY,
    fontWeight: "700",
  },
  app: {
    backgroundColor: BACKGROUND,
    flex: 1,
  },
  fab: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 32,
    height: 58,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    width: 58,
  },
  fabAction: {
    backgroundColor: BACKGROUND,
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  fabActionText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  fabLayer: {
    alignItems: "flex-end",
    bottom: 82,
    position: "absolute",
    right: 18,
    zIndex: 20,
  },
  fabMenu: {
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 12,
  },
  fabPressed: {
    backgroundColor: "#001A33",
  },
  fabText: {
    color: BACKGROUND,
    fontSize: 30,
    fontWeight: "500",
    lineHeight: 32,
  },
  loading: {
    alignItems: "center",
    backgroundColor: BACKGROUND,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  pressed: {
    opacity: 0.72,
  },
  safeArea: {
    backgroundColor: BACKGROUND,
    flex: 1,
  },
  tab: {
    alignItems: "center",
    borderTopColor: "transparent",
    borderTopWidth: 2,
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  tabBar: {
    backgroundColor: BACKGROUND,
    borderTopColor: BORDER,
    borderTopWidth: 1,
    flexDirection: "row",
    height: 68,
    paddingBottom: 8,
  },
  tabLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
  },
  webViewShell: {
    backgroundColor: MUTED,
    flex: 1,
  },
});
