import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useState, useEffect } from "react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db, storage } from "../configs/FirebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { Colors } from "../constants/Colors";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../components/ThemeContext";

export default function EditExerciseDetails({
  exercise,
  bodyPartId,
  onSave,
  onCancel,
}) {
  // Edit state for all fields
  const [editedName, setEditedName] = useState(exercise.name || "");
  const [originalExerciseName] = useState(exercise.name || ""); // Store original name to find exercise
  const [editedDifficulty, setEditedDifficulty] = useState(
    exercise.difficulty || "",
  );
  const [editedEquipment, setEditedEquipment] = useState(
    exercise.equipment || "",
  );
  const [editedSecondaryMuscles, setEditedSecondaryMuscles] = useState(
    exercise.secondaryMuscles || "",
  );
  const [editedTarget, setEditedTarget] = useState(exercise.target || "");
  const [editedDescription, setEditedDescription] = useState(
    exercise.description || "",
  );
  const [editedInstructions, setEditedInstructions] = useState(
    exercise.instructions || "",
  );
  const [youtubeUrls, setYoutubeUrls] = useState([]);
  const [urlInputs, setUrlInputs] = useState([""]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageName, setSelectedImageName] = useState("");
  const [youtubeThumbnail] = useState(
    exercise.youtubeThumbnail || "",
  );
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(
    exercise.category || "",
  );
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [bodyPartName, setBodyPartName] = useState("");
  const { primaryColor } = useTheme();

  useEffect(() => {
    fetchCategories();
    fetchBodyPartName();
    fetchLatestExerciseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLatestExerciseData = async () => {
    try {
      const bodyPartRef = doc(db, "BodyParts", bodyPartId);
      const bodyPartSnap = await getDoc(bodyPartRef);

      if (bodyPartSnap.exists()) {
        const bodyPartData = bodyPartSnap.data();
        const exercises = bodyPartData.exercises || [];
        const currentExercise = exercises.find(
          (ex) => ex.name === exercise.name,
        );

        if (currentExercise && currentExercise.youtubeUrls) {
          setYoutubeUrls(currentExercise.youtubeUrls);
        }
      }
    } catch (_error) {}
  };

  const fetchBodyPartName = async () => {
    try {
      const bodyPartRef = doc(db, "BodyParts", bodyPartId);
      const bodyPartSnap = await getDoc(bodyPartRef);
      if (bodyPartSnap.exists()) {
        const data = bodyPartSnap.data();
        // The correct field is 'bodyPart'
        const name = data.bodyPart || "unknown";
        setBodyPartName(name);
      }
    } catch (_error) {}
  };

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
    } catch (_error) {}
  };

  const getYoutubeThumbnail = (url) => {
    // Extract video ID from YouTube URL
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

  const removeYoutubeUrl = async (index) => {
    try {
      const updated = youtubeUrls.filter((_, i) => i !== index);
      setYoutubeUrls(updated);

      // Update database immediately
      const bodyPartRef = doc(db, "BodyParts", bodyPartId);
      const bodyPartSnap = await getDoc(bodyPartRef);

      if (bodyPartSnap.exists()) {
        const bodyPartData = bodyPartSnap.data();
        const exercises = bodyPartData.exercises || [];

        const exerciseIndex = exercises.findIndex(
          (ex) => ex.name === originalExerciseName,
        );

        if (exerciseIndex !== -1) {
          exercises[exerciseIndex].youtubeUrls = updated;
          exercises[exerciseIndex].firstYoutubeUrl =
            updated.length > 0 ? updated[0] : "";

          await updateDoc(bodyPartRef, {
            exercises: exercises,
          });
        }
      }
    } catch (_error) {
      Alert.alert("שגיאה", "אירעה שגיאה במחיקת הסרטון");
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        const fileName = asset.uri.split("/").pop();
        setSelectedImageName(fileName);
      }
    } catch (_error) {
      Alert.alert("שגיאה", "אירעה שגיאה בבחירת התמונה");
    }
  };

  const uploadThumbnailToFirebase = async () => {
    if (!selectedImage) return null;

    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();

      const timestamp = Date.now();
      const fileName = `thumbnail_${editedName}_${timestamp}.jpg`;
      const storageRef = ref(storage, `thumbnails/${bodyPartName}/${fileName}`);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    } catch (_error) {
      throw _error;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Collect all non-empty URLs from input fields
      const newUrls = urlInputs
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      // Combine existing gallery URLs with new input URLs
      const finalYoutubeUrls = [...youtubeUrls, ...newUrls];

      // Upload thumbnail if a new image was selected
      let thumbnailUrl = youtubeThumbnail;
      if (selectedImage) {
        thumbnailUrl = await uploadThumbnailToFirebase();
      }

      const bodyPartRef = doc(db, "BodyParts", bodyPartId);
      const bodyPartSnap = await getDoc(bodyPartRef);

      if (!bodyPartSnap.exists()) {
        Alert.alert("שגיאה", "נסה שוב");
        setIsSaving(false);
        return;
      }

      const bodyPartData = bodyPartSnap.data();
      const exercises = bodyPartData.exercises || [];

      const exerciseIndex = exercises.findIndex(
        (ex) => ex.name === originalExerciseName,
      );

      if (exerciseIndex === -1) {
        Alert.alert("שגיאה", "התרגיל לא נמצא");
        setIsSaving(false);
        return;
      }

      const updatedExercise = {
        ...exercises[exerciseIndex],
        name: editedName,
        difficulty: editedDifficulty,
        equipment: editedEquipment,
        secondaryMuscles: editedSecondaryMuscles,
        target: editedTarget,
        description: editedDescription,
        instructions: editedInstructions,
        firstYoutubeUrl: finalYoutubeUrls.length > 0 ? finalYoutubeUrls[0] : "",
        youtubeUrls: finalYoutubeUrls,
        category: selectedCategory,
        youtubeThumbnail: thumbnailUrl || "",
      };

      // Update the specific exercise in the array
      exercises[exerciseIndex] = updatedExercise;

      await updateDoc(bodyPartRef, {
        exercises: exercises,
      });

      setIsSaving(false);
      Alert.alert(strings.success, strings.exerciseDetailsUpdated, [
        { text: strings.ok },
      ]);
      onSave();
    } catch (_error) {
      setIsSaving(false);
      Alert.alert(strings.error, strings.errorUpdatingDetails, [
        { text: strings.ok },
      ]);
    }
  };

  const fields = [
    {
      label: strings.difficulty,
      value: editedDifficulty,
      setValue: setEditedDifficulty,
    },
    {
      label: strings.equipment,
      value: editedEquipment,
      setValue: setEditedEquipment,
    },
    {
      label: strings.secondaryMuscles,
      value: editedSecondaryMuscles,
      setValue: setEditedSecondaryMuscles,
    },
    {
      label: strings.target,
      value: editedTarget,
      setValue: setEditedTarget,
    },
    {
      label: strings.describe,
      value: editedDescription,
      setValue: setEditedDescription,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Gallery */}
        <View style={styles.editGalleryContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.videoGallery}
            contentContainerStyle={styles.videoGalleryContent}
          >
            {/* Existing YouTube videos */}
            {youtubeUrls.map((url, index) => {
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
                  <TouchableOpacity
                    style={styles.deleteVideoButton}
                    onPress={() => removeYoutubeUrl(index)}
                  >
                    <AntDesign name="close" size={16} color="#fff" />
                  </TouchableOpacity>
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
              {url.trim().length > 0 && (
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
                placeholderTextColor={Colors.placeholder}
                autoCapitalize="none"
              />
            </View>
          ))}
        </View>

        {/* Image Picker for Thumbnail */}
        <View style={styles.imagePickerContainer}>
          <Text style={styles.imagePickerLabel}>{strings.customThumbnail}</Text>
          <TouchableOpacity
            style={[styles.pickImageButton, { backgroundColor: primaryColor }]}
            onPress={pickImage}
          >
            <MaterialCommunityIcons name="image-plus" size={24} color="#fff" />
            <Text style={styles.pickImageButtonText}>
              {strings.selectImage}
            </Text>
          </TouchableOpacity>
          {selectedImageName && (
            <View style={styles.selectedImageContainer}>
              <AntDesign name="check-circle" size={16} color={primaryColor} />
              <Text style={styles.selectedImageText}>{selectedImageName}</Text>
            </View>
          )}
          {!selectedImageName && youtubeThumbnail && (
            <View style={styles.selectedImageContainer}>
              <AntDesign name="check-circle" size={16} color="#999" />
              <Text style={styles.selectedImageText}>
                {strings.existingThumbnail}
              </Text>
            </View>
          )}
        </View>

        {/* Back/Save/Cancel Buttons */}
        <View style={styles.buttonsContainer}>
          <View style={styles.rightButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <AntDesign name="close" size={20} color="#fff" />
              <Text style={styles.buttonText}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: primaryColor }]}
              onPress={handleSave}
            >
              <AntDesign name="check" size={20} color="#fff" />
              <Text style={styles.buttonText}>שמור</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Edit Form */}
        <View style={styles.formContainer}>
          {/* Title/Name Field */}
          <View style={styles.editFieldContainer}>
            <Text style={styles.fieldLabel}>{strings.name}</Text>
            <TextInput
              style={styles.input}
              value={editedName}
              onChangeText={setEditedName}
              placeholder={strings.name}
              placeholderTextColor={Colors.placeholder}
              multiline
            />
          </View>

          {/* Category Dropdown */}
          {categories.length > 0 && (
            <View style={styles.categoryContainer}>
              <Text style={styles.fieldLabel}>{strings.category}</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                <Text style={styles.dropdownButtonText}>
                  {selectedCategory || strings.selectCategory}
                </Text>
                <AntDesign
                  name={showCategoryDropdown ? "up" : "down"}
                  size={hp(2)}
                  color={primaryColor}
                />
              </TouchableOpacity>

              {showCategoryDropdown && (
                <View style={styles.dropdownMenu}>
                  {categories.map((category, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dropdownItem,
                        selectedCategory === category &&
                          styles.dropdownItemSelected,
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

          {/* Dynamic Fields */}
          {fields.map((field, index) => (
            <View key={index} style={styles.fieldRow}>
              <Text style={styles.subTitleText}>{field.label}</Text>
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={field.value}
                onChangeText={field.setValue}
                placeholder={field.label}
                placeholderTextColor={Colors.placeholder}
              />
            </View>
          ))}

          {/* Instructions Field */}
          <View style={styles.instructionsContainer}>
            <Text style={[styles.subTitleText, styles.titleInst]}>
              {strings.instructions}
            </Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={editedInstructions}
              onChangeText={setEditedInstructions}
              placeholder={strings.instructions}
              placeholderTextColor={Colors.placeholder}
              multiline
              numberOfLines={6}
            />
          </View>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {isSaving && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={styles.loadingText}>{strings.saving}</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const strings = {
  name: "שם התרגיל:",
  equipment: "ציוד: ",
  secondaryMuscles: "שרירים משניים: ",
  target: "שריר ראשי: ",
  describe: "תיאור: ",
  instructions: "הוראות ביצוע: ",
  difficulty: "רמת קושי: ",
  error: "שגיאה",
  ok: "אישור",
  youtubeUrl: "לינק YouTube:",
  enterYoutubeUrl: "הזן כתובת URL של YouTube",
  category: "קטגוריה:",
  selectCategory: "בחר קטגוריה",
  deleteVideoTitle: "מחיקת סרטון",
  deleteVideoMsg: "האם אתה בטוח שברצונך למחוק את הסרטון הזה?",
  cancel: "ביטול",
  delete: "מחק",
  saving: "שומר שינויים...",
  success: "הצלחה",
  exerciseDetailsUpdated: "פרטי התרגיל עודכנו",
  errorUpdatingDetails: "אירעה שגיאה בעדכון פרטי התרגיל. נסה שוב מאוחר יותר.",
  customThumbnail: "תמונה מותאמת אישית:",
  selectImage: "בחר תמונה",
  existingThumbnail: "תמונה קיימת",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginLeft: "auto",
  },
  rightButtons: {
    flexDirection: "row",
    gap: 10,
  },
  saveButton: {
    backgroundColor: Colors.PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  cancelButton: {
    backgroundColor: "#999",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  buttonText: {
    color: "#fff",
    fontSize: hp(2),
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
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
    backgroundColor: Colors.PRIMARY,
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
  imagePickerContainer: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginBottom: 10,
  },
  imagePickerLabel: {
    fontSize: hp(2.2),
    fontWeight: "600",
    color: "#404040",
    marginBottom: 8,
    textAlign: "right",
  },
  pickImageButton: {
    backgroundColor: Colors.PRIMARY,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  pickImageButtonText: {
    color: "#fff",
    fontSize: hp(2),
    fontWeight: "600",
  },
  selectedImageContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  selectedImageText: {
    fontSize: hp(1.8),
    color: "#666",
    textAlign: "right",
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
  deleteVideoButton: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(220, 38, 38, 0.9)",
    borderRadius: 12,
    padding: 4,
  },
  videoPlayIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  formContainer: {
    padding: 15,
  },
  editFieldContainer: {
    marginBottom: 16,
  },
  categoryContainer: {
    marginBottom: 16,
    position: "relative",
    zIndex: 1000,
  },
  fieldLabel: {
    fontSize: hp(2.5),
    fontWeight: "600",
    color: "#404040",
    marginBottom: 6,
    textAlign: "right",
  },
  dropdownButton: {
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
  dropdownButtonText: {
    fontSize: hp(2.2),
    color: "#404040",
    textAlign: "right",
  },
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
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
  dropdownItemSelected: {
    backgroundColor: Colors.PRIMARY + "20",
  },
  dropdownItemText: {
    fontSize: hp(2),
    color: "#404040",
    textAlign: "right",
  },
  dropdownItemTextSelected: {
    fontSize: hp(2),
    fontWeight: "600",
    color: Colors.PRIMARY,
  },
  fieldRow: {
    marginBottom: 12,
  },
  subTitleText: {
    fontSize: hp(2.2),
    fontWeight: "600",
    color: "#404040",
    marginBottom: 6,
    textAlign: "right",
  },
  input: {
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
  inlineInput: {
    minHeight: hp(5),
  },
  instructionsContainer: {
    marginTop: 10,
  },
  titleInst: {
    marginBottom: 8,
  },
  multilineInput: {
    minHeight: hp(15),
    textAlignVertical: "top",
    paddingTop: 12,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loadingContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    minWidth: wp(40),
  },
  loadingText: {
    marginTop: 10,
    fontSize: hp(2),
    color: "#404040",
  },
});
