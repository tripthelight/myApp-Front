const SERVICE_WORKER_PATH = "/sw.js";
const APP_CACHE_PREFIX = "pastel-rhythm-";
const DEV_RELOAD_KEY = "pwa-dev-cleanup-reloaded";

/**
 * 앱 시작 전에 PWA 실행 환경을 정리합니다.
 *
 * Vite 개발 서버에서는 Service Worker를 등록하지 않습니다.
 * 개발 중 남아 있는 이전 Worker/Cache가 최신 모듈을 가로채면 빈 화면이나
 * 무한 로딩이 발생할 수 있으므로, 같은 origin의 기존 등록과 앱 캐시를 제거합니다.
 *
 * @returns {Promise<boolean>} true면 앱을 계속 시작하고, false면 정리 후 새로고침 중입니다.
 */
export async function preparePwa() {
  if (!("serviceWorker" in navigator)) return true;

  if (import.meta.env.DEV) {
    return cleanupDevelopmentPwaState();
  }

  registerProductionServiceWorker();
  return true;
}

async function cleanupDevelopmentPwaState() {
  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.allSettled(
      registrations.map((registration) => registration.unregister()),
    );

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.allSettled(
        cacheNames
          .filter((name) => name.startsWith(APP_CACHE_PREFIX))
          .map((name) => caches.delete(name)),
      );
    }

    // 이미 이전 Service Worker가 현재 문서를 제어하고 있었다면 unregister만으로는
    // 이 문서의 제어가 즉시 풀리지 않습니다. 딱 한 번 새로고침하여 완전히 분리합니다.
    if (hadController && sessionStorage.getItem(DEV_RELOAD_KEY) !== "1") {
      sessionStorage.setItem(DEV_RELOAD_KEY, "1");
      window.location.reload();
      return false;
    }

    sessionStorage.removeItem(DEV_RELOAD_KEY);
  } catch (error) {
    // 개발 편의용 정리에 실패해도 게임 자체는 계속 실행합니다.
    console.warn("[PWA] 개발 환경의 이전 Service Worker 상태를 정리하지 못했습니다.", error);
  }

  return true;
}

function registerProductionServiceWorker() {
  if (!window.isSecureContext) {
    console.info(
      "[PWA] 운영 Service Worker를 등록하지 않았습니다. HTTPS 보안 연결이 필요합니다.",
    );
    return;
  }

  window.addEventListener(
    "load",
    async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          SERVICE_WORKER_PATH,
          {
            scope: "/",
            updateViaCache: "none",
          },
        );

        registration.update().catch(() => {});
      } catch (error) {
        console.warn("[PWA] 운영 Service Worker 등록에 실패했습니다.", error);
      }
    },
    { once: true },
  );
}
