import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import {
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { Colors } from "../constants/Colors";
import { StatusBar } from "expo-status-bar";
import ExerciseList from "../components/ExerciseList";
import { ScrollView } from "react-native-virtualized-view";
import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../configs/FirebaseConfig";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AddExercise from "../components/AddExercise";
import EditBodyPart from "../components/EditBodyPart";
import { useAuthContext } from "../components/AuthContext";
import { useTheme } from "../components/ThemeContext";
import { getStorage, ref, deleteObject } from "firebase/storage";

export default function Exercises() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAdmin, isDemoMode, demoViewAsAdmin, toggleDemoView } =
    useAuthContext();
  const { primaryColor } = useTheme();
  const [imgUrl, setImgUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [bodyPartName, setBodyPartName] = useState(params?.bodyPart || "");
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showEditBodyPart, setShowEditBodyPart] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    fetchBodyPartData();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCategories = async () => {
    if (!params.id) return;

    try {
      const categoriesQuery = query(
        collection(db, "Categories"),
        where("id", "==", params.id),
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);

      if (!categoriesSnapshot.empty) {
        const categoryDoc = categoriesSnapshot.docs[0].data();
        setCategories(categoryDoc.categories || []);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchBodyPartData = async () => {
    if (!params.id) return;

    try {
      setLoading(true);
      const docRef = doc(db, "BodyParts", params.id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setImgUrl(data.imgUrl || "");
        setBodyPartName(data.bodyPart || params?.bodyPart);
        setExercises(data.exercises || []);
      }
    } catch (error) {
      console.error("Error fetching body part data:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setImageLoaded(false);
    await fetchBodyPartData();
    await fetchCategories();
    setRefreshing(false);
  };

  const deleteMediaFromStorage = async (url) => {
    if (!url || url.includes("logo.png")) return; // Skip local assets

    try {
      const storage = getStorage();
      // Extract the file path from Firebase Storage URL
      const decodedUrl = decodeURIComponent(url);
      const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);

      if (pathMatch && pathMatch[1]) {
        const filePath = pathMatch[1];
        const fileRef = ref(storage, filePath);
        await deleteObject(fileRef);
      }
    } catch (error) {
      console.error("Error deleting file from storage:", error);
    }
  };

  const handleDeleteBodyPart = async () => {
    Alert.alert(
      strings.confirmDelete,
      `${strings.deleteBodyPart} "${bodyPartName}"?`,
      [
        {
          text: strings.cancel,
          style: "cancel",
        },
        {
          text: strings.delete,
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);

              // Delete body part image
              if (imgUrl) {
                await deleteMediaFromStorage(imgUrl);
              }

              // Delete the document from BodyParts collection
              const docRef = doc(db, "BodyParts", params.id);
              await deleteDoc(docRef);

              // Delete corresponding document from Categories collection
              try {
                const categoriesQuery = query(
                  collection(db, "Categories"),
                  where("name", "==", bodyPartName.trim()),
                );
                const categoriesSnapshot = await getDocs(categoriesQuery);

                for (const doc of categoriesSnapshot.docs) {
                  await deleteDoc(doc.ref);
                }
              } catch (error) {
                console.error("Error deleting from Categories:", error);
              }

              Alert.alert(strings.success, strings.bodyPartDeleted, [
                {
                  text: strings.ok,
                },
              ]);
              router.back();
            } catch (error) {
              console.error("Error deleting body part:", error);
              Alert.alert(strings.error, strings.errorDeletingBodyPart);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      scrollEnabled={!showDropdown}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[primaryColor]}
          tintColor={primaryColor}
          enabled={!showDropdown}
        />
      }
    >
      <StatusBar style="light" />
      <View>
        {(!imageLoaded || loading) && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        )}
        {imgUrl && (
          <Image
            key={imgUrl}
            style={[styles.img, !imageLoaded && styles.hidden]}
            source={{ uri: imgUrl }}
            onLoadEnd={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
          />
        )}
      </View>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.btnBack, { backgroundColor: primaryColor }]}
      >
        <AntDesign name="caret-left" size={24} color="black" />
      </TouchableOpacity>
      <View style={styles.exeCont}>
        <View style={styles.iconTitleCont}>
          {isAdmin && (
            <TouchableOpacity onPress={handleDeleteBodyPart}>
              <MaterialIcons name="delete" size={hp(3.5)} color="#FF4444" />
            </TouchableOpacity>
          )}
          <View style={styles.addIconTitle}>
            {isAdmin && (
              <>
                <TouchableOpacity onPress={() => setShowAddExercise(true)}>
                  <MaterialIcons
                    name="post-add"
                    size={hp(3.5)}
                    color={primaryColor}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowEditBodyPart(true)}>
                  <AntDesign name="edit" size={hp(3.2)} color={primaryColor} />
                </TouchableOpacity>
              </>
            )}
            <Text style={styles.txtExe}>{bodyPartName}</Text>
          </View>
        </View>

        {/* Demo Mode Toggle */}
        {isDemoMode && (
          <View style={styles.demoToggleContainer}>
            <Text style={styles.demoToggleLabel}>{strings.demoViewLabel}</Text>
            <View style={styles.toggleButtons}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  demoViewAsAdmin && styles.toggleButtonActive,
                  demoViewAsAdmin && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
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
                  !demoViewAsAdmin && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
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

        {/* Categories Dropdown */}
        {categories.length > 0 && (
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[styles.dropdownButton, { borderColor: primaryColor }]}
              onPress={(e) => {
                setImageLoaded(true); // To prevent loader overlap
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
            >
              <Text style={styles.dropdownButtonText}>
                {selectedCategory || strings.categories}
              </Text>
              <AntDesign
                name={showDropdown ? "up" : "down"}
                size={hp(2)}
                color={primaryColor}
              />
            </TouchableOpacity>

            {showDropdown && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    selectedCategory === null && styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCategory(null);
                    setShowDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedCategory === null &&
                        styles.dropdownItemTextSelected,
                      selectedCategory === null && { color: primaryColor },
                    ]}
                  >
                    {strings.allCategories}
                  </Text>
                </TouchableOpacity>
                {categories.map((category, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dropdownItem,
                      selectedCategory === category &&
                        styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedCategory(category);
                      setShowDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        selectedCategory === category &&
                          styles.dropdownItemTextSelected,
                        selectedCategory === category && {
                          color: primaryColor,
                        },
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.exeList}>
          {(() => {
            const filteredExercises = selectedCategory
              ? exercises.filter((ex) => ex.category === selectedCategory)
              : exercises;

            return filteredExercises.length > 0 ? (
              <ExerciseList item={filteredExercises} bodyPartId={params.id} />
            ) : (
              <Text style={styles.noExercises}>{strings.noExercises}</Text>
            );
          })()}
        </View>
      </View>

      {/* Add Exercise Modal */}
      <Modal
        visible={showAddExercise}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAddExercise(false)}
      >
        <AddExercise
          bodyPartId={params.id}
          bodyPartName={bodyPartName}
          onClose={() => setShowAddExercise(false)}
          onExerciseAdded={() => {
            fetchBodyPartData();
            setShowAddExercise(false);
          }}
        />
      </Modal>

      {/* Edit Body Part Modal */}
      <Modal
        visible={showEditBodyPart}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowEditBodyPart(false)}
      >
        <EditBodyPart
          bodyPartId={params.id}
          currentBodyPartName={bodyPartName}
          currentImageUrl={imgUrl}
          onClose={() => setShowEditBodyPart(false)}
          onBodyPartUpdated={() => {
            fetchBodyPartData();
            setShowEditBodyPart(false);
          }}
        />
      </Modal>
    </ScrollView>
  );
}
const strings = {
  noExercises: "לא נמצאו תרגילים",
  success: "הצלחה",
  bodyPartDeleted: "חלק הגוף נמחק בהצלחה",
  ok: "אישור",
  error: "שגיאה",
  errorDeletingBodyPart: "אירעה שגיאה במחיקת חלק הגוף",
  confirmDelete: "אישור מחיקה",
  deleteBodyPart: "למחוק את חלק הגוף",
  cancel: "ביטול",
  delete: "מחק",
  categories: "בחר קטגוריה",
  allCategories: "כל הקטגוריות",
  demoViewLabel: "Demo View:",
  adminView: "Admin",
  userView: "User",
};
const styles = StyleSheet.create({
  img: {
    width: "100%",
    height: hp(45),
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  btnBack: {
    padding: 7,
    backgroundColor: Colors.PRIMARY,
    width: hp(5.5),
    height: hp(5.5),
    justifyContent: "center",
    alignItems: "center",
    top: hp(6),
    left: 10,
    borderRadius: 99,
    position: "absolute",
    display: "flex",
  },
  exeCont: {
    marginHorizontal: 15,
    marginVertical: 10,
  },
  txtExe: {
    fontSize: hp(3),
    fontWeight: "700",
    color: "#404040",
    textAlign: "right",
  },
  iconTitleCont: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  addIconTitle: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: 8,
  },
  exeList: {
    marginTop: 10,
  },
  noExercises: {
    textAlign: "center",
    fontSize: hp(2),
    color: "#999",
    marginTop: 20,
  },
  loaderContainer: {
    position: "absolute",
    width: "100%",
    height: hp(45),
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    zIndex: 10,
  },
  hidden: {
    opacity: 0,
  },
  dropdownContainer: {
    marginTop: 10,
    position: "relative",
    zIndex: 1000,
  },
  dropdownButton: {
    flexDirection: "row-reverse",
    width: "50%",
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownButtonText: {
    fontSize: hp(2.2),
    fontWeight: "600",
    textAlign: "right",
  },
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    left: "50%",
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginTop: 5,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: hp(30),
    zIndex: 1001,
  },
  dropdownItem: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  Selected: {
    backgroundColor: Colors.PRIMARY + "20",
  },
  dropdownItemText: {
    fontSize: hp(2),
    color: "#404040",
    textAlign: "right",
  },
  dropdownItemTextSelected: {
    color: Colors.PRIMARY,
    fontWeight: "700",
    textAlign: "right",
  },
  demoToggleContainer: {
    alignItems: "center",
    marginTop: 15,
    marginBottom: 10,
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
