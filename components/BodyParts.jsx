import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import BodyPartCard from "./BodyPartCard";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../configs/FirebaseConfig";
import { Colors } from "../constants/Colors";
import Search from "./Search/Search";
import { useAuthContext } from "./AuthContext";
import AddBodyPart from "./AddBodyPart";
import { checkConnection } from "../utils/useNetworkStatus";
import Toast from "react-native-toast-message";

export default function BodyParts({ title }) {
  const router = useRouter();
  const { isDemoMode, demoViewAsAdmin, toggleDemoView } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bodyPartsList, setBodyPartsList] = useState([]);
  const [selectedExercises, setSelectedExercises] = useState({});
  const [showAddBodyPart, setShowAddBodyPart] = useState(false);

  const showOfflineToast = () => {
    Toast.show({
      type: "error",
      text1: "אין חיבור לאינטרנט",
      position: "top",
      visibilityTime: 3000,
      topOffset: 50,
    });
  };

  const onAddBodyPart = () => {
    setShowAddBodyPart(true);
  };

  useEffect(() => {
    GetBodyParts();
  }, []);

  const GetBodyParts = async () => {
    setLoading(true);
    setBodyPartsList([]);
    try {
      const isOnline = await checkConnection();
      if (!isOnline) return;

      const q = query(collection(db, "BodyParts"));
      const querySnapshot = await getDocs(q);
      const bodyParts = [];
      querySnapshot.forEach((doc) => {
        bodyParts.push({ id: doc.id, ...doc.data() });
      });
      setBodyPartsList(bodyParts);
    } catch (error) {
      console.error("Error fetching body parts:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);

    const isOnline = await checkConnection();
    if (!isOnline) {
      showOfflineToast();
      setRefreshing(false);
      return;
    }

    await GetBodyParts();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title ? title : strings.exercises}</Text>

      {/* Demo Mode Toggle */}
      {isDemoMode && (
        <View style={styles.demoToggleContainer}>
          <Text style={styles.demoToggleLabel}>{strings.demoViewLabel}</Text>
          <View style={styles.toggleButtons}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                demoViewAsAdmin && styles.toggleButtonActive,
              ]}
              onPress={() => !demoViewAsAdmin && toggleDemoView()}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  demoViewAsAdmin && styles.toggleButtonTextActive,
                ]}
              >
                {strings.adminView}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                !demoViewAsAdmin && styles.toggleButtonActive,
              ]}
              onPress={() => demoViewAsAdmin && toggleDemoView()}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  !demoViewAsAdmin && styles.toggleButtonTextActive,
                ]}
              >
                {strings.userView}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Search
        bodyPartsList={bodyPartsList}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        router={router}
        BodyPartCard={BodyPartCard}
        selectedExercises={selectedExercises}
        setSelectedExercises={setSelectedExercises}
        onAddBodyPart={onAddBodyPart}
      />

      {/* Add Body Part Modal */}
      <Modal
        visible={showAddBodyPart}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAddBodyPart(false)}
      >
        <AddBodyPart
          onClose={() => setShowAddBodyPart(false)}
          onBodyPartAdded={() => {
            GetBodyParts();
            setShowAddBodyPart(false);
          }}
        />
      </Modal>
    </View>
  );
}
const strings = {
  exercises: "כל התרגילים",
  noExercises: "אין תכנית אימונים להצגה",
  demoViewLabel: "Demo View:",
  adminView: "Admin",
  userView: "User",
};
const styles = StyleSheet.create({
  container: {
    marginHorizontal: 4,
    flex: 1,
  },
  emptyCont: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "30%",
  },
  emptyTxt: {
    fontSize: 25,
    fontWeight: "700",
    color: "#404040",
  },
  title: {
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "right",
    marginRight: 10,
  },
  flat: {
    paddingBottom: 50,
    paddingTop: 10,
  },
  flat2: {
    justifyContent: "space-between",
  },
  load: {
    marginTop: 20,
  },
  demoToggleContainer: {
    alignItems: "center",
    marginVertical: 10,
    marginHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  demoToggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0369a1",
    marginBottom: 8,
  },
  toggleButtons: {
    flexDirection: "row",
    gap: 10,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  toggleButtonActive: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  toggleButtonTextActive: {
    color: "#fff",
  },
});
