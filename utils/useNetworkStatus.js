import { useEffect, useState, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";

export const useNetworkStatus = (options = {}) => {
  const { showToast = true, onConnectionChange = null } = options;

  const [isConnected, setIsConnected] = useState(true);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected =
        state.isConnected && state.isInternetReachable !== false;

      // Show toast on connection changes, or on first render if not connected
      if (!isFirstRender.current || !connected) {
        if (showToast && !connected) {
          Toast.show({
            type: "error",
            text1: "אין חיבור לאינטרנט",
            position: "top",
            visibilityTime: 3000,
            topOffset: 50,
          });
        } else if (!isFirstRender.current && connected) {
          // Hide toast when connection is restored (but not on first render)
          Toast.hide();
        }
      }

      isFirstRender.current = false;
      setIsConnected(connected);

      // Call callback if provided
      if (onConnectionChange) {
        onConnectionChange(connected);
      }
    });

    return () => unsubscribe();
  }, [showToast, onConnectionChange]);

  return { isConnected };
};

export const checkConnection = async () => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected && netInfo.isInternetReachable !== false;
};
