import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import MenuList from "../../components/Profile/MenuList";
import UserIntro from "../../components/Profile/UserIntro";
import { useAuthContext } from "../../components/AuthContext";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "../../constants/Colors";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";

export default function Profile() {
  const { user, isDemoMode } = useAuthContext();
  const { signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    if (isDemoMode) {
      await SecureStore.deleteItemAsync("isDemoMode");
      window.location?.reload?.();
    } else {
      signOut();
    }
  };

  return (
    <View style={styles.container}>
      <Modal visible={signingOut} transparent animationType="fade">
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>מתנתק</Text>
        </View>
      </Modal>
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <MaterialIcons name="logout" size={20} color={Colors.DELETED} />
        </TouchableOpacity>
        <Text style={styles.title}>{strings.title}</Text>
      </View>
      <View style={styles.contentContainer}>
        <UserIntro user={user} />
        <MenuList router={router} />
      </View>
    </View>
  );
}

const strings = {
  title: "פרופיל",
  studentsList: "רשימת המתאמנים שלי",
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 25,
    marginBottom: 0,
  },
  logoutButton: {
    width: 42,
    height: 42,
    borderRadius: 99,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 30,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    textAlign: "right",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  overlayText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
