import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import HeaderPage from "../../components/HeaderPage";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Colors } from "../../constants/Colors";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  doc,
  updateDoc,
  getDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../configs/FirebaseConfig";
import ArchiveCard from "./ArchiveCard";
import Toast from "react-native-toast-message";
import { useTheme } from "../../components/ThemeContext";

const generateRandomId = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function ArchiveList() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [trainings, setTrainings] = useState([]);
  const [selectedTrainings, setSelectedTrainings] = useState({});
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState({});
  const [dragMode, setDragMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { primaryColor } = useTheme();

  useEffect(() => {
    LoadTrainings();
  }, []);

  const LoadTrainings = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "Trainings"));
      const querySnapshot = await getDocs(q);
      const trainingsArray = [];

      querySnapshot.forEach((doc) => {
        trainingsArray.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // Sort by order field (ascending), if order doesn't exist, put at end
      trainingsArray.sort((a, b) => {
        const orderA =
          a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
        const orderB =
          b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

      setTrainings(trainingsArray);
    } catch (error) {
      console.error("Error loading trainings:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const q = query(collection(db, "Trainings"));
      const querySnapshot = await getDocs(q);
      const trainingsArray = [];

      querySnapshot.forEach((doc) => {
        trainingsArray.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // Sort by order field (ascending), if order doesn't exist, put at end
      trainingsArray.sort((a, b) => {
        const orderA =
          a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
        const orderB =
          b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

      setTrainings(trainingsArray);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error refreshing trainings:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleTrainingSelection = (trainingId) => {
    setSelectedTrainings((prev) => ({
      ...prev,
      [trainingId]: !prev[trainingId],
    }));
  };

  const handleDeleteTraining = (trainingId) => {
    setTrainings((prev) => prev.filter((t) => t.id !== trainingId));
    // Also remove from selected if it was selected
    setSelectedTrainings((prev) => {
      const { [trainingId]: removed, ...rest } = prev;
      return rest;
    });
  };

  const getSelectedTrainingIds = () => {
    return Object.keys(selectedTrainings).filter((id) => selectedTrainings[id]);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const [usersSnapshot, adminsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "Users"))),
        getDocs(query(collection(db, "Admins"))),
      ]);

      const adminEmails = new Set(
        adminsSnapshot.docs.map((d) => d.data().email).filter(Boolean),
      );

      const usersArray = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (!adminEmails.has(userData.email)) {
          usersArray.push({ id: doc.id, ...userData });
        }
      });

      setUsers(usersArray);
    } catch (error) {
      console.error("Error loading users:", error);
      Alert.alert(strings.error, strings.loadUsersError);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAttachClick = () => {
    setSelectedUsers({});
    setShowUsersModal(true);
    loadUsers();
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const getSelectedUserIds = () =>
    Object.keys(selectedUsers).filter((id) => selectedUsers[id]);

  const handleAttachToUsers = async () => {
    const userIdsToAttach = getSelectedUserIds();
    if (userIdsToAttach.length === 0) return;

    try {
      setAttaching(true);
      const selectedIds = getSelectedTrainingIds();
      const selectedTrainingsList = trainings.filter((t) =>
        selectedIds.includes(t.id),
      );

      const today = new Date();
      const dateLabel = `${today.getDate()}.${String(today.getMonth() + 1).padStart(2, "0")}`;

      let totalAdded = 0;
      let anyDuplicate = false;
      const allAddedByTraining = {}; // trainingId -> [userId]

      await Promise.all(
        userIdsToAttach.map(async (userId) => {
          const userRef = doc(db, "Users", userId);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) return;

          const userData = userSnap.data();
          const currentTrainings = userData.trainings || {};
          const newTrainings = { ...currentTrainings };
          const newGraphEntries = {};
          const addedTrainings = [];

          const existingArchiveIds = Object.values(currentTrainings)
            .map((t) => t.archiveId)
            .filter(Boolean);

          selectedTrainingsList.forEach((training) => {
            const isAttachedFromArchive = existingArchiveIds.includes(
              training.id,
            );
            const isOriginallyCreatedForUser =
              (training.userIds?.includes(userId) ||
                training.userId === userId) &&
              training.originalTrainingKey &&
              !!currentTrainings[training.originalTrainingKey];

            if (isAttachedFromArchive || isOriginallyCreatedForUser) {
              anyDuplicate = true;
              return;
            }

            const randomId = generateRandomId();
            const trainingKey = `training_${randomId}`;
            newTrainings[trainingKey] = {
              name: training.name,
              exercises: training.exercises,
              archiveId: training.id,
            };
            addedTrainings.push(training);

            if (training.exercises?.length > 0) {
              const graphsEntry = {};
              training.exercises.forEach((ex) => {
                const exerciseId = `${ex.bodyPartId}-${ex.exerciseIndex}`;
                graphsEntry[exerciseId] = {
                  dates: [dateLabel],
                  weights: [ex.weight || 0],
                  sets: [ex.numOfSets || 0],
                  reps: [ex.numOfReps || 0],
                };
              });
              newGraphEntries[`graphs.${trainingKey}`] = graphsEntry;
            }
          });

          if (addedTrainings.length === 0) return;

          await updateDoc(userRef, {
            trainings: newTrainings,
            ...newGraphEntries,
          });

          totalAdded += addedTrainings.length;
          addedTrainings.forEach((t) => {
            if (!allAddedByTraining[t.id]) allAddedByTraining[t.id] = [];
            allAddedByTraining[t.id].push(userId);
          });
        }),
      );

      // Update userIds on archive docs
      await Promise.all(
        Object.entries(allAddedByTraining).map(([trainingId, uids]) =>
          updateDoc(doc(db, "Trainings", trainingId), {
            userIds: arrayUnion(...uids),
          }),
        ),
      );

      if (anyDuplicate) {
        Toast.show({
          type: "error",
          text1: strings.trainingAlreadyExists,
          visibilityTime: 3000,
          topOffset: 60,
        });
      }

      if (totalAdded > 0) {
        Alert.alert(
          strings.success,
          strings.trainingsAttached.replace("{count}", totalAdded),
          [{ text: strings.ok }],
        );
      }

      setSelectedTrainings({});
      setSelectedUsers({});
      setShowUsersModal(false);

      // Optimistically update local state
      setTrainings((prev) =>
        prev.map((t) => {
          const addedUids = allAddedByTraining[t.id];
          if (addedUids?.length) {
            const currentUserIds = t.userIds || (t.userId ? [t.userId] : []);
            const merged = [...new Set([...currentUserIds, ...addedUids])];
            return { ...t, userIds: merged };
          }
          return t;
        }),
      );
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error attaching trainings:", error);
      Alert.alert(strings.error, strings.attachError);
    } finally {
      setAttaching(false);
    }
  };

  const handleDragEnd = async ({ data }) => {
    setTrainings(data);

    try {
      setSaving(true);
      // Update order for each training in Firestore
      const updatePromises = data.map((training, index) => {
        const trainingRef = doc(db, "Trainings", training.id);
        return updateDoc(trainingRef, {
          order: index,
          updatedAt: new Date(),
        });
      });

      await Promise.all(updatePromises);

      // Show success toast
      Toast.show({
        type: "success",
        text1: strings.orderSaved,
        visibilityTime: 2000,
        topOffset: 60,
      });
    } catch (error) {
      console.error("Error saving order:", error);
      Alert.alert(strings.error, strings.saveOrderError);
    } finally {
      setSaving(false);
    }
  };

  const toggleDragMode = () => {
    setDragMode(!dragMode);
    if (!dragMode) {
      // Clear selections when entering drag mode
      setSelectedTrainings({});
    }
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <HeaderPage title={strings.title} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          {loading ? (
            <ActivityIndicator
              size="large"
              color={primaryColor}
              style={styles.loader}
            />
          ) : trainings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{strings.noTrainings}</Text>
            </View>
          ) : (
            <>
              <View style={styles.controlsContainer}>
                <TouchableOpacity
                  style={[
                    styles.dragModeButton,
                    { borderColor: primaryColor },
                    dragMode && { backgroundColor: primaryColor },
                  ]}
                  onPress={toggleDragMode}
                >
                  <MaterialIcons
                    name={dragMode ? "check" : "drag-indicator"}
                    size={20}
                    color={dragMode ? "#fff" : primaryColor}
                  />
                  <Text
                    style={[
                      styles.dragModeText,
                      { color: primaryColor },
                      dragMode && styles.dragModeTextActive,
                    ]}
                  >
                    {dragMode ? strings.exitDragMode : strings.reorderTrainings}
                  </Text>
                </TouchableOpacity>
                {saving && (
                  <ActivityIndicator
                    size="small"
                    color={primaryColor}
                    style={styles.savingIndicator}
                  />
                )}
              </View>

              {dragMode ? (
                <DraggableFlatList
                  data={trainings}
                  renderItem={({ item, drag, isActive }) => (
                    <TouchableOpacity
                      onLongPress={drag}
                      disabled={isActive}
                      style={[
                        styles.draggableItem,
                        isActive && styles.draggableItemActive,
                      ]}
                    >
                      <ArchiveCard
                        training={item}
                        index={trainings.indexOf(item)}
                        isSelected={false}
                        onToggleSelect={() => {}}
                        isDragging={isActive}
                        dragModeActive={dragMode}
                        onDelete={handleDeleteTraining}
                        refreshKey={refreshKey}
                      />
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.id}
                  onDragEnd={handleDragEnd}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                />
              ) : (
                <FlatList
                  data={trainings}
                  renderItem={({ item, index }) => (
                    <ArchiveCard
                      training={item}
                      index={index}
                      isSelected={selectedTrainings[item.id]}
                      onToggleSelect={() => toggleTrainingSelection(item.id)}
                      dragModeActive={dragMode}
                      onDelete={handleDeleteTraining}
                      refreshKey={refreshKey}
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={[primaryColor]}
                      tintColor={primaryColor}
                    />
                  }
                />
              )}

              {!dragMode && getSelectedTrainingIds().length > 0 && (
                <View style={styles.attachButtonContainer}>
                  <TouchableOpacity
                    style={[
                      styles.attachButton,
                      { backgroundColor: primaryColor },
                    ]}
                    onPress={handleAttachClick}
                  >
                    <MaterialIcons name="person-add" size={20} color="#fff" />
                    <Text style={styles.attachButtonText}>
                      {strings.attachTrainings} (
                      {getSelectedTrainingIds().length})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Users Modal */}
          <Modal
            visible={showUsersModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowUsersModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{strings.selectUser}</Text>
                  <TouchableOpacity
                    onPress={() => setShowUsersModal(false)}
                    style={styles.closeButton}
                  >
                    <AntDesign name="close" size={24} color={primaryColor} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  {loadingUsers ? (
                    <ActivityIndicator
                      size="large"
                      color={primaryColor}
                      style={styles.modalLoader}
                    />
                  ) : (
                    users.map((user) => {
                      const isChecked = !!selectedUsers[user.id];
                      return (
                        <TouchableOpacity
                          key={user.id}
                          style={[
                            styles.userItem,
                            isChecked && {
                              borderColor: primaryColor,
                            },
                          ]}
                          onPress={() => toggleUserSelection(user.id)}
                          disabled={attaching}
                        >
                          <MaterialIcons
                            name={
                              isChecked
                                ? "check-box"
                                : "check-box-outline-blank"
                            }
                            size={24}
                            color={isChecked ? primaryColor : "#ccc"}
                            style={styles.userCheckbox}
                          />
                          <Text style={styles.userItemText}>
                            {user.fullName || user.name || user.email}
                          </Text>
                          <MaterialIcons
                            name="person"
                            size={20}
                            color={primaryColor}
                          />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
                {!loadingUsers && getSelectedUserIds().length > 0 && (
                  <View style={styles.modalAttachContainer}>
                    <TouchableOpacity
                      style={[
                        styles.modalAttachButton,
                        { backgroundColor: primaryColor },
                        attaching && { opacity: 0.6 },
                      ]}
                      onPress={handleAttachToUsers}
                      disabled={attaching}
                    >
                      {attaching ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <MaterialIcons
                          name="person-add"
                          size={20}
                          color="#fff"
                        />
                      )}
                      <Text style={styles.modalAttachButtonText}>
                        {strings.attachToSelected} (
                        {getSelectedUserIds().length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

const strings = {
  title: "ארכיון אימונים",
  noTrainings: "אין אימונים בארכיון",
  attachTrainings: "צרף אימונים",
  selectUser: "בחר מתאמן",
  error: "שגיאה",
  success: "הצלחה",
  ok: "אישור",
  loadUsersError: "לא הצלחנו לטעון את המתאמנים",
  attachError: "לא הצלחנו לצרף את האימונים",
  userNotFound: "המתאמן לא נמצא",
  trainingsAttached: "{count} אימונים צורפו בהצלחה",
  trainingAlreadyExists: "אימון כבר קיים עבור מתאמן זה",
  attachToSelected: "צרף למתאמנים שנבחרו",
  reorderTrainings: "סדר מחדש אימונים",
  exitDragMode: "סיים סידור",
  saveOrderError: "לא הצלחנו לשמור את הסדר",
  orderSaved: "הסדר נשמר בהצלחה",
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 10,
  },
  loader: {
    marginTop: 50,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    color: "#888",
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 100,
  },
  attachButtonContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  attachButton: {
    backgroundColor: Colors.PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 50,
    gap: 10,
  },
  attachButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    width: "90%",
    maxHeight: "70%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "center",
    position: "relative",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "600",
  },
  closeButton: {
    position: "absolute",
    right: 20,
  },
  modalScroll: {
    paddingVertical: 20,
    paddingHorizontal: 25,
  },
  modalScrollContent: {
    paddingBottom: 30,
  },
  modalLoader: {
    marginVertical: 20,
  },
  userItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  userItemText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#404040",
    flex: 1,
    textAlign: "right",
  },
  userCheckbox: {
    marginRight: 4,
  },
  modalAttachContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  modalAttachButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalAttachButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 15,
  },
  dragModeButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.PRIMARY,
    backgroundColor: "#fff",
  },
  dragModeButtonActive: {
    backgroundColor: Colors.PRIMARY,
  },
  dragModeText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.PRIMARY,
  },
  dragModeTextActive: {
    color: "#fff",
  },
  savingIndicator: {
    marginLeft: 10,
  },
  draggableItem: {
    opacity: 1,
  },
  draggableItemActive: {
    opacity: 0.7,
  },
});
