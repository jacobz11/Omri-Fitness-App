import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuthContext } from "../components/AuthContext";

export default function OAuthCallback() {
  const router = useRouter();
  const { isAdmin, isCheckingAdmin } = useAuthContext();

  // Route user after admin check completes
  useEffect(() => {
    if (!isCheckingAdmin) {
      if (isAdmin) {
        router.replace("/Home");
      } else {
        // router.replace("/Home");
        router.replace("/Students/StudentOnboarding");
      }
    }
  }, [isAdmin, isCheckingAdmin, router]);

  return null;
}
