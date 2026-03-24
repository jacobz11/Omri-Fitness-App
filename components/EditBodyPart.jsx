import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState, useEffect } from "react";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from "../configs/FirebaseConfig";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
} from "firebase/firestore";
import AntDesign from "@expo/vector-icons/AntDesign";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "./ThemeContext";

export default function EditBodyPart({
  bodyPartId,
  currentBodyPartName,
  currentImageUrl,
  onClose,
  onBodyPartUpdated,
}) {
  const [bodyPartName, setBodyPartName] = useState(currentBodyPartName || "");
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentImage] = useState(currentImageUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState([""]);
  const [categoryDocId, setCategoryDocId] = useState(null);
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
        return true;
      },
    );

    return () => backHandler.remove();
  }, [isSaving, onClose]);

  // Fetch existing categories
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
        const categoryDoc = categoriesSnapshot.docs[0];
        const categoryData = categoryDoc.data();
        setCategoryDocId(categoryDoc.id);
        setCategories(
          categoryData.categories && categoryData.categories.length > 0
            ? categoryData.categories
            : [""],
        );
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const onImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert(strings.error, strings.uploadErr);
    }
  };

  const validateFields = () => {
    if (!bodyPartName.trim()) {
      Alert.alert(strings.error, strings.nameRequired, [{ text: strings.ok }]);
      return false;
    }
    // Check if at least one category is filled
    const hasValidCategory = categories.some((cat) => cat.trim());
    if (!hasValidCategory) {
      Alert.alert(strings.error, strings.categoryRequired, [
        { text: strings.ok },
      ]);
      return false;
    }
    return true;
  };

  const addCategoryField = () => {
    setCategories([...categories, ""]);
  };

  const removeCategoryField = (index) => {
    if (categories.length > 1) {
      const newCategories = categories.filter((_, i) => i !== index);
      setCategories(newCategories);
    }
  };

  const updateCategory = (index, value) => {
    const newCategories = [...categories];
    newCategories[index] = value;
    setCategories(newCategories);
  };

  const uploadImage = async () => {
    if (!selectedImage) {
      // Keep current image if no new one selected
      return currentImage;
    }

    const response = await fetch(selectedImage.uri);
    const blob = await response.blob();
    const filename = `bodyParts/${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);

    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  };

  const handleUpdateBodyPart = async () => {
    if (!validateFields()) return;

    try {
      setIsSaving(true);

      // Upload image if changed
      const imageUrl = await uploadImage();

      // Filter out empty categories
      const validCategories = categories
        .map((cat) => cat.trim())
        .filter((cat) => cat !== "");

      // Update body part in BodyParts collection
      const bodyPartRef = doc(db, "BodyParts", bodyPartId);
      await updateDoc(bodyPartRef, {
        bodyPart: bodyPartName.trim(),
        imgUrl: imageUrl,
      });

      // Update or create Categories collection entry
      if (categoryDocId) {
        const categoryRef = doc(db, "Categories", categoryDocId);
        await updateDoc(categoryRef, {
          name: bodyPartName.trim(),
          categories: validCategories,
          id: bodyPartId, // Ensure id is set
        });
      } else {
        // If no category document exists, create one
        const categoriesRef = collection(db, "Categories");
        const newCategoryDoc = doc(categoriesRef);
        await setDoc(newCategoryDoc, {
          id: bodyPartId,
          name: bodyPartName.trim(),
          categories: validCategories,
        });
      }

      Alert.alert(strings.success, strings.bodyPartUpdated, [
        {
          text: strings.ok,
          onPress: () => {
            if (onBodyPartUpdated) onBodyPartUpdated();
            if (onClose) onClose();
          },
        },
      ]);
    } catch (error) {
      console.error("Error updating body part:", error);
      Alert.alert(strings.error, strings.updateBodyPartError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.mainContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <StatusBar style="dark" />
      {isSaving && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={styles.loadingText}>{strings.updating}</Text>
          </View>
        </View>
      )}

      {/* Close Button */}
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
        {/* Image Picker */}
        <View style={styles.imageContainer}>
          <TouchableOpacity
            style={[
              styles.imagePicker,
              { borderColor: primaryColor },
              (selectedImage || currentImage) && styles.imagePickerWithImage,
            ]}
            onPress={onImagePick}
          >
            {selectedImage ? (
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.selectedImage}
                resizeMode="cover"
              />
            ) : currentImage ? (
              <Image
                source={{ uri: currentImage }}
                style={styles.selectedImage}
                resizeMode="cover"
              />
            ) : (
              <>
                <AntDesign name="plus" size={hp(5)} color={primaryColor} />
                <Text style={[styles.imagePickerText, { color: primaryColor }]}>
                  {strings.changeImage}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.title}>{strings.editBodyPart}</Text>

          {/* Body Part Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{strings.bodyPartName}</Text>
            <TextInput
              style={styles.input}
              value={bodyPartName}
              onChangeText={setBodyPartName}
              placeholder={strings.namePlaceholder}
              placeholderTextColor="#999"
            />
          </View>

          {/* Categories */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{strings.categories}</Text>
            {categories.map((category, index) => (
              <View key={index} style={styles.categoryInputContainer}>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={(text) => updateCategory(index, text)}
                  placeholder={strings.categoryPlaceholder}
                  placeholderTextColor="#999"
                />
                {categories.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeCategoryButton}
                    onPress={() => removeCategoryField(index)}
                  >
                    <AntDesign name="close" size={hp(2)} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={[
                styles.addCategoryButton,
                { backgroundColor: primaryColor },
              ]}
              onPress={addCategoryField}
            >
              <AntDesign name="plus" size={hp(2)} color="#fff" />
              <Text style={styles.addCategoryText}>{strings.addCategory}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Floating Save Button */}
      <TouchableOpacity
        style={[styles.floatingSaveButton, { backgroundColor: primaryColor }]}
        onPress={handleUpdateBodyPart}
        disabled={isSaving}
      >
        <AntDesign name="save" size={hp(2.5)} color="#fff" />
        <Text style={styles.saveButtonText}>{strings.update}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const strings = {
  editBodyPart: "ערוך איזור גוף",
  bodyPartName: "שם איזור הגוף:",
  categories: "קטגוריות:",
  addCategory: "הוסף קטגוריה",
  changeImage: "שנה תמונה",
  update: "עדכן",
  error: "שגיאה",
  success: "הצלחה",
  ok: "אישור",
  updating: "מעדכן איזור גוף...",
  uploadErr: "לא הצלחנו להעלות את הקובץ. נסה שוב מאוחר יותר.",
  namePlaceholder: "הזן שם איזור גוף...",
  categoryPlaceholder: "הזן שם קטגוריה...",
  nameRequired: "יש להזין שם איזור גוף",
  categoryRequired: "יש להזין לפחות קטגוריה אחת",
  bodyPartUpdated: "איזור הגוף עודכן בהצלחה",
  updateBodyPartError: "עדכון איזור הגוף נכשל. אנא נסה שנית",
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollview: {
    paddingBottom: 100,
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
  imageContainer: {
    width: "100%",
    height: hp(40),
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: hp(7),
  },
  imagePicker: {
    width: wp(60),
    height: wp(60),
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  imagePickerWithImage: {
    borderStyle: "solid",
    overflow: "hidden",
  },
  selectedImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  imagePickerText: {
    marginTop: 10,
    fontSize: hp(2),
    fontWeight: "600",
  },
  detailsContainer: {
    padding: 15,
    paddingTop: 30,
  },
  title: {
    textAlign: "right",
    fontSize: hp(3.2),
    fontWeight: "700",
    color: "#404040",
    marginBottom: 20,
  },
  fieldContainer: {
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
  addCategoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    marginTop: 10,
  },
  addCategoryText: {
    color: "#fff",
    fontSize: hp(1.8),
    fontWeight: "600",
  },
  categoryInputContainer: {
    position: "relative",
    marginBottom: 10,
  },
  removeCategoryButton: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: [{ translateY: -18 }],
    backgroundColor: "#ff4444",
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});
