import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { useState, useEffect } from "react";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { Image } from "expo-image";
import { db } from "../configs/FirebaseConfig";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "./ThemeContext";

export default function AddExercise({
  bodyPartId,
  bodyPartName,
  onClose,
  onExerciseAdded,
}) {
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [equipment, setEquipment] = useState("");
  const [secondaryMuscles, setSecondaryMuscles] = useState("");
  const [target, setTarget] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [urlInputs, setUrlInputs] = useState([""]);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const { primaryColor } = useTheme();

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isSaving) {
          return true; // Block back when saving
        }
        if (onClose) {
          onClose();
        }
        return true; // Always handle back press
      },
    );

    return () => backHandler.remove();
  }, [isSaving, onClose]);

  // Fetch categories for this body part
  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCategories = async () => {
    try {
      const categoriesQuery = query(
        collection(db, "Categories"),
        where("id", "==", bodyPartId),
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);

      if (!categoriesSnapshot.empty) {
        const categoryDoc = categoriesSnapshot.docs[0].data();
        setCategories(categoryDoc.categories || []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const getYoutubeThumbnail = (url) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = match && match[2].length === 11 ? match[2] : null;
    return videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : null;
  };

  const addNewUrlInput = () => {
    setUrlInputs([...urlInputs, ""]);
  };

  const updateUrlInput = (index, value) => {
    const updated = [...urlInputs];
    updated[index] = value;
    setUrlInputs(updated);
  };

  const removeUrlInput = (index) => {
    if (urlInputs.length > 1) {
      const updated = urlInputs.filter((_, i) => i !== index);
      setUrlInputs(updated);
    }
  };

  const validateFields = async () => {
    if (!name.trim()) {
      Alert.alert(strings.error, strings.nameRequired, [{ text: strings.ok }]);
      return false;
    }

    // Check for duplicate exercise name
    try {
      const bodyPartRef = doc(db, "BodyParts", bodyPartId);
      const bodyPartDoc = await getDoc(bodyPartRef);

      if (bodyPartDoc.exists()) {
        const exercises = bodyPartDoc.data().exercises || [];
        const duplicateExists = exercises.some(
          (exercise) =>
            exercise.name.trim().toLowerCase() === name.trim().toLowerCase(),
        );

        if (duplicateExists) {
          Alert.alert(strings.error, strings.duplicateName, [
            { text: strings.ok },
          ]);
          return false;
        }
      }
    } catch (error) {
      console.error("Error checking for duplicate:", error);
      // Continue even if check fails
    }

    return true;
  };

  const handleSaveExercise = async () => {
    const isValid = await validateFields();
    if (!isValid) return;

    try {
      setIsSaving(true);

      // Collect all non-empty YouTube URLs
      const youtubeUrls = urlInputs
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      // Create new exercise object
      const newExercise = {
        name: name.trim(),
        difficulty: difficulty.trim() || "",
        equipment: equipment.trim() || "",
        secondaryMuscles: secondaryMuscles.trim() || "",
        target: target.trim() || "",
        description: description.trim() || "",
        instructions: instructions.trim() || "",
        firstYoutubeUrl: youtubeUrls.length > 0 ? youtubeUrls[0] : "",
        youtubeUrls: youtubeUrls,
        category: selectedCategory || "",
      };

      // Add exercise to Firestore
      const bodyPartRef = doc(db, "BodyParts", bodyPartId);
      await updateDoc(bodyPartRef, {
        exercises: arrayUnion(newExercise),
      });

      Alert.alert(strings.success, strings.exerciseAdded, [
        {
          text: strings.ok,
          onPress: () => {
            if (onExerciseAdded) onExerciseAdded();
            if (onClose) onClose();
          },
        },
      ]);
    } catch (error) {
      console.error("Error adding exercise:", error);
      Alert.alert(strings.error, strings.addExerciseError);
    } finally {
      setIsSaving(false);
    }
  };

  const fields = [
    {
      label: strings.name,
      value: name,
      setValue: setName,
      placeholder: strings.namePlaceholder,
    },
    {
      label: strings.difficulty,
      value: difficulty,
      setValue: setDifficulty,
      placeholder: strings.difficultyPlaceholder,
    },
    {
      label: strings.equipment,
      value: equipment,
      setValue: setEquipment,
      placeholder: strings.equipmentPlaceholder,
    },
    {
      label: strings.secondaryMuscles,
      value: secondaryMuscles,
      setValue: setSecondaryMuscles,
      placeholder: strings.secondaryMusclesPlaceholder,
    },
    {
      label: strings.target,
      value: target,
      setValue: setTarget,
      placeholder: strings.targetPlaceholder,
    },
    {
      label: strings.describe,
      value: description,
      setValue: setDescription,
      placeholder: strings.describePlaceholder,
      multiline: true,
    },
  ];

  return (
    <View style={styles.mainContainer}>
      {isSaving && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={styles.loadingText}>{strings.saving}</Text>
          </View>
        </View>
      )}

      {/* Close Button - Fixed top right */}
      <TouchableOpacity
        style={[styles.closeButton, { backgroundColor: primaryColor }]}
        onPress={onClose}
        disabled={isSaving}
      >
        <AntDesign name="close" size={hp(2.5)} color="#fff" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollview}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Gallery - YouTube Thumbnails */}
        <View style={styles.editGalleryContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.videoGallery}
            contentContainerStyle={styles.videoGalleryContent}
          >
            {urlInputs
              .filter((url) => url.trim().length > 0)
              .map((url, index) => {
                const thumbnail = getYoutubeThumbnail(url);
                return (
                  <View key={`youtube-${index}`} style={styles.videoItem}>
                    <Image
                      source={{
                        uri:
                          thumbnail ||
                          "https://via.placeholder.com/320x180?text=YouTube+Video",
                      }}
                      style={styles.videoThumbnail}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                    <View style={styles.videoPlayIcon}>
                      <MaterialCommunityIcons
                        name="play-circle"
                        size={40}
                        color="rgba(255,255,255,0.9)"
                      />
                    </View>
                  </View>
                );
              })}
          </ScrollView>
        </View>

        {/* YouTube URL Input */}
        <View style={styles.youtubeInputContainer}>
          <Text style={styles.youtubeInputLabel}>{strings.youtubeUrl}</Text>
          {urlInputs.map((url, index) => (
            <View key={index} style={styles.youtubeInputRow}>
              <TouchableOpacity
                style={[styles.addUrlButton, { backgroundColor: primaryColor }]}
                onPress={addNewUrlInput}
              >
                <MaterialCommunityIcons name="plus" size={24} color="#fff" />
              </TouchableOpacity>
              {url.trim().length > 0 && urlInputs.length > 1 && (
                <TouchableOpacity
                  style={styles.removeUrlButton}
                  onPress={() => removeUrlInput(index)}
                >
                  <AntDesign name="minus" size={24} color="#fff" />
                </TouchableOpacity>
              )}
              <TextInput
                style={styles.youtubeInput}
                value={url}
                onChangeText={(value) => updateUrlInput(index, value)}
                placeholder={strings.enterYoutubeUrl}
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>
          ))}
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.title}>{strings.addNewExercise}</Text>
          <Text style={[styles.bodyPartText, { color: primaryColor }]}>
            {strings.bodyPart} {bodyPartName}
          </Text>

          {/* Category Dropdown */}
          {categories.length > 0 && (
            <View style={styles.categoryContainer}>
              <Text style={styles.fieldLabel}>{strings.category}</Text>
              <TouchableOpacity
                style={styles.categoryButton}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                <Text style={styles.categoryButtonText}>
                  {selectedCategory || strings.selectCategory}
                </Text>
                <AntDesign
                  name={showCategoryDropdown ? "up" : "down"}
                  size={hp(2)}
                  color={primaryColor}
                />
              </TouchableOpacity>

              {showCategoryDropdown && (
                <View style={styles.categoryDropdown}>
                  {categories.map((category, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.categoryDropdownItem,
                        selectedCategory === category &&
                          styles.categoryDropdownItemSelected,
                        selectedCategory === category && {
                          backgroundColor: primaryColor + "20",
                        },
                      ]}
                      onPress={() => {
                        setSelectedCategory(category);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryDropdownItemText,
                          selectedCategory === category &&
                            styles.categoryDropdownItemTextSelected,
                          selectedCategory === category && {
                            color: primaryColor,
                            fontWeight: "700",
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

          {/* All input fields */}
          {fields.map((field, index) => (
            <View key={index} style={styles.editFieldContainer}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                style={[styles.input, field.multiline && styles.multilineInput]}
                value={field.value}
                onChangeText={field.setValue}
                placeholder={field.placeholder}
                placeholderTextColor="#999"
                multiline={field.multiline}
                numberOfLines={field.multiline ? 4 : 1}
              />
            </View>
          ))}

          {/* Instructions field */}
          <View style={styles.editFieldContainer}>
            <Text style={[styles.fieldLabel, styles.titleInstEdit]}>
              {strings.instructions}
            </Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={instructions}
              onChangeText={setInstructions}
              placeholder={strings.instructionsPlaceholder}
              placeholderTextColor="#999"
              multiline
              numberOfLines={6}
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Save Button */}
      <TouchableOpacity
        style={[styles.floatingSaveButton, { backgroundColor: primaryColor }]}
        onPress={handleSaveExercise}
        disabled={isSaving}
      >
        <AntDesign name="save" size={hp(2.5)} color="#fff" />
        <Text style={styles.saveButtonText}>{strings.save}</Text>
      </TouchableOpacity>
    </View>
  );
}

const strings = {
  name: "שם התרגיל:",
  equipment: "ציוד:",
  secondaryMuscles: "שרירים משניים:",
  target: "שריר ראשי:",
  describe: "תיאור:",
  instructions: "הוראות ביצוע:",
  difficulty: "רמת קושי:",
  category: "קטגוריה:",
  selectCategory: "בחר קטגוריה (אופציונלי)",
  youtubeUrl: "לינק YouTube:",
  enterYoutubeUrl: "הזן כתובת URL של YouTube",
  save: "שמור",
  cancel: "ביטול",
  error: "שגיאה",
  success: "הצלחה",
  ok: "אישור",
  saving: "שומר תרגיל חדש...",
  addNewExercise: "הוסף תרגיל חדש",
  bodyPart: "איזור גוף:",

  // Placeholders
  namePlaceholder: "הזן שם תרגיל...",
  difficultyPlaceholder: "למשל: קל, בינוני, קשה",
  equipmentPlaceholder: "למשל: משקולות, מוט, משקל גוף",
  secondaryMusclesPlaceholder: "הזן שרירים משניים...",
  targetPlaceholder: "הזן שריר ראשי...",
  describePlaceholder: "הזן תיאור התרגיל...",
  instructionsPlaceholder: "הזן הוראות ביצוע מפורטות...",

  // Validation messages
  nameRequired: "יש להזין שם תרגיל",
  duplicateName: "תרגיל בשם זה כבר קיים באיזור גוף זה. אנא בחר שם אחר.",
  exerciseAdded: "התרגיל נוסף בהצלחה",
  addExerciseError: "הוספת התרגיל נכשלה. אנא נסה שנית",
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  scrollview: {
    paddingBottom: 50,
  },
  closeButton: {
    position: "absolute",
    top: hp(7),
    right: 15,
    borderRadius: 99,
    width: 35,
    height: 35,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  floatingSaveButton: {
    position: "absolute",
    bottom: 15,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    gap: 10,
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: hp(2.2),
    fontWeight: "700",
  },
  detailsContainer: {
    padding: 15,
  },
  title: {
    textAlign: "right",
    fontSize: hp(3.2),
    fontWeight: "700",
    color: "#404040",
    marginBottom: 5,
  },
  bodyPartText: {
    textAlign: "right",
    fontSize: hp(2.2),
    fontWeight: "600",
    marginBottom: 10,
  },
  editFieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: hp(2.5),
    fontWeight: "600",
    color: "#404040",
    marginBottom: 6,
    textAlign: "right",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: hp(2.2),
    backgroundColor: "#f9f9f9",
    textAlign: "right",
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  editGalleryContainer: {
    width: "100%",
    height: wp(60),
    backgroundColor: "#f5f5f5",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    marginTop: 0,
  },
  videoGallery: {
    flex: 1,
    paddingHorizontal: 10,
  },
  videoGalleryContent: {
    paddingRight: 10,
  },
  videoItem: {
    width: wp(35),
    height: wp(45),
    marginRight: 10,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  },
  videoThumbnail: {
    width: "100%",
    height: "100%",
  },
  videoPlayIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  youtubeInputContainer: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginBottom: 10,
  },
  youtubeInputLabel: {
    fontSize: hp(2.2),
    fontWeight: "600",
    color: "#404040",
    marginBottom: 8,
    textAlign: "right",
  },
  youtubeInputRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  youtubeInput: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: hp(2),
    textAlign: "right",
    color: "#404040",
  },
  addUrlButton: {
    borderRadius: 8,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  removeUrlButton: {
    backgroundColor: "#dc3545",
    borderRadius: 8,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  titleInstEdit: {
    marginTop: 8,
    marginBottom: 8,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    gap: 15,
  },
  loadingText: {
    fontSize: hp(2.2),
    fontWeight: "600",
    color: "#404040",
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  categoryButtonText: {
    fontSize: hp(2.2),
    color: "#404040",
    textAlign: "right",
  },
  categoryDropdown: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginTop: 5,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: hp(30),
  },
  categoryDropdownItem: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  categoryDropdownItemSelected: {},
  categoryDropdownItemText: {
    fontSize: hp(2),
    color: "#404040",
    textAlign: "right",
  },
  categoryDropdownItemTextSelected: {},
});
