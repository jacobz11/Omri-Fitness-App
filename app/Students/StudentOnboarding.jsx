import {
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
  Pressable,
  ImageBackground,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../configs/FirebaseConfig";
import { Colors } from "../../constants/Colors";
import { heightPercentageToDP as hp } from "react-native-responsive-screen";
import { useUser, useAuth } from "@clerk/clerk-expo";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import AntDesign from "@expo/vector-icons/AntDesign";
import * as SecureStore from "expo-secure-store";
import { useAuthContext } from "../../components/AuthContext";
import { useTheme } from "../../components/ThemeContext";

export default function StudentOnboarding() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const { isAdmin, isCheckingAdmin } = useAuthContext();
  const { setGender: setThemeGender } = useTheme();
  const { primaryColor } = useTheme();

  // Check if in edit mode (admin editing student data)
  const isEditMode = params?.editMode === "true";
  const studentId = params?.id;

  // Form state
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [height, setHeight] = useState("");
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [weight, setWeight] = useState("");
  const [showWeightPicker, setShowWeightPicker] = useState(false);
  const [trainingFrequency, setTrainingFrequency] = useState("");
  const [trainingDays, setTrainingDays] = useState([]);
  const [trainingPlace, setTrainingPlace] = useState("");
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [showGoalsPicker, setShowGoalsPicker] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState({});
  const [checkingBoardingData, setCheckingBoardingData] = useState(true);

  // Load existing boarding data when in edit mode
  useEffect(() => {
    if (isEditMode && params?.boardingData) {
      try {
        const data = JSON.parse(params.boardingData);

        // Load all fields
        setFullName(data?.fullName || "");
        setGender(data?.gender || "");
        setHeight(data?.height || "");
        setWeight(data?.weight || "");
        setTrainingFrequency(data?.trainingFrequency || "");
        setTrainingDays(data?.trainingDays || []);
        setTrainingPlace(data?.trainingPlace || "");
        setSelectedGoals(data?.workoutGoals || []);

        // Handle birthday
        if (data?.birthday) {
          const [day, month, year] = data.birthday.split("/");
          setBirthday(`${day}${month}${year}`);
          setBirthdayValue({ dateOfBirth: data.birthday });
        }

        setCheckingBoardingData(false);
      } catch (error) {
        console.error("Error loading boarding data:", error);
        setCheckingBoardingData(false);
      }
    }
  }, [isEditMode, params?.boardingData]);

  // Check if user already has boarding data (only when not in edit mode)
  useEffect(() => {
    // Skip this check if in edit mode
    if (isEditMode) {
      return;
    }

    const checkExistingBoardingData = async () => {
      try {
        if (!isLoaded || isCheckingAdmin) {
          return;
        }

        // If user is admin, redirect to home immediately
        if (isAdmin) {
          router.replace("/Home");
          return;
        }

        if (!user?.id) {
          setCheckingBoardingData(false);
          return;
        }

        const userEmail = user.primaryEmailAddress?.emailAddress;
        const userId = user.id;

        if (!userEmail && !userId) {
          setCheckingBoardingData(false);
          return;
        }

        // Find the user document by email or id
        let querySnapshot;
        if (userEmail) {
          const q = query(
            collection(db, "Users"),
            where("email", "==", userEmail),
          );
          querySnapshot = await getDocs(q);
        }

        // If not found by email, try by clerk user id field
        if (!querySnapshot || querySnapshot.empty) {
          const q = query(
            collection(db, "Users"),
            where("clerkUserId", "==", userId),
          );
          querySnapshot = await getDocs(q);
        }

        // If still not found, try loading the doc directly by clerk user id (doc id)
        let userDoc;
        if (!querySnapshot || querySnapshot.empty) {
          const directRef = doc(db, "Users", userId);
          const directSnap = await getDoc(directRef);
          if (directSnap.exists()) {
            userDoc = directSnap;
          }
        } else {
          userDoc = querySnapshot.docs[0];
        }

        if (userDoc) {
          const userData = userDoc.data();

          // Check if boarding data exists
          if (userData.boarding && Object.keys(userData.boarding).length > 0) {
            // User already has boarding data, navigate to home
            console.log("User already has boarding data, redirecting to home");
            router.replace("/Home");
            return;
          }
        }

        // No boarding data found, stay on onboarding screen
        setCheckingBoardingData(false);
      } catch (error) {
        console.error("Error checking boarding data:", error);
        setCheckingBoardingData(false);
      }
    };

    checkExistingBoardingData();
  }, [isLoaded, user, router, isAdmin, isCheckingAdmin, isEditMode]);

  // Options
  const genderOptions = ["זכר", "נקבה"];
  const heightRanges = ["פחות מ-150", "150-170", "170-180", "180-200", "200+"];
  const weightRanges = ["30-50", "50-70", "70-90", "90-110", "110+"];
  const placeOptions = ["בית", "חדר כושר", "חוץ"];
  const daysOfWeek = [
    { id: "ראשון", label: "ראשון" },
    { id: "שני", label: "שני" },
    { id: "שלישי", label: "שלישי" },
    { id: "רביעי", label: "רביעי" },
    { id: "חמישי", label: "חמישי" },
    { id: "שישי", label: "שישי" },
    { id: "שבת", label: "שבת" },
  ];
  const goalOptions = [
    "ירידה במשקל",
    "עלייה במסת שריר",
    "גמישות",
    "כוח",
    "סיבולת",
  ];

  const [birthday, setBirthday] = useState("");
  const [birthdayValue, setBirthdayValue] = useState({
    dateOfBirth: undefined,
  });
  const handleBirthdayChange = (value) => {
    setBirthday(value);
    if (validationErrors.birthday) {
      setValidationErrors((prev) => ({ ...prev, birthday: false }));
    }

    if (value.length === 8) {
      try {
        const year = parseInt(value.slice(4, 8), 10);
        if (
          Number.isNaN(year) ||
          year < 1900 ||
          year > new Date().getFullYear()
        ) {
          throw new Error("Invalid year");
        }

        let month = parseInt(value.slice(2, 4), 10);
        if (Number.isNaN(month) || month < 1 || month > 12) {
          throw new Error("Invalid month");
        }

        let day = parseInt(value.slice(0, 2), 10);
        const maxDays = new Date(year, month, 0).getDate();
        if (Number.isNaN(day) || day < 1 || day > maxDays) {
          throw new Error("Invalid day");
        }

        const formattedDay = day < 10 ? `0${day}` : day;
        const formattedMonth = month < 10 ? `0${month}` : month;
        setBirthdayValue({
          dateOfBirth: `${formattedDay}/${formattedMonth}/${year}`,
        });
      } catch (_error) {
        Alert.alert(strings.error, "תאריך לידה לא תקין", [
          { text: strings.ok },
        ]);
        setBirthday("");
      }
    }
  };

  const validateStep1 = () => {
    const errors = {};
    if (!birthdayValue.dateOfBirth) errors.birthday = true;
    if (!gender) errors.gender = true;
    if (!height) errors.height = true;
    if (!weight) errors.weight = true;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors = {};
    if (!trainingFrequency) errors.trainingFrequency = true;
    const requiredDays = parseInt(trainingFrequency, 10);
    if (trainingDays.length !== requiredDays) errors.trainingDays = true;
    if (!trainingPlace) errors.trainingPlace = true;
    if (selectedGoals.length === 0) errors.workoutGoals = true;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2);
      setValidationErrors({});
    } else {
      Alert.alert(strings.error, strings.fillRequired);
    }
  };

  const handleStart = async () => {
    if (!validateStep2()) {
      Alert.alert(strings.error, strings.fillRequired);
      return;
    }

    try {
      setSaving(true);

      // Prepare boarding data
      const boardingData = {
        fullName,
        birthday: birthdayValue.dateOfBirth,
        gender,
        height,
        weight,
        trainingFrequency,
        trainingDays,
        trainingPlace,
        workoutGoals: selectedGoals,
      };

      // Handle edit mode (admin editing student)
      if (isEditMode && studentId) {
        const userRef = doc(db, "Users", studentId);
        await updateDoc(userRef, {
          boarding: boardingData,
          lastUpdated: new Date().toISOString(),
        });

        Alert.alert(strings.success, strings.detailsUpdated, [
          {
            text: strings.ok,
            onPress: () => {
              router.back();
            },
          },
        ]);
        return;
      }

      // Original logic for new user onboarding
      // Wait for user to be loaded
      if (!isLoaded) {
        Alert.alert("Error", "Loading user information, please try again");
        setSaving(false);
        return;
      }

      if (!user?.id) {
        Alert.alert("Error", "User information not available");
        setSaving(false);
        return;
      }

      // Get email, with fallback to user id if email not available
      const userEmail = user.primaryEmailAddress?.emailAddress;
      const userId = user.id;

      if (!userEmail && !userId) {
        Alert.alert("Error", "User information not available");
        setSaving(false);
        return;
      }

      // Find the user document by email or id
      let querySnapshot;
      if (userEmail) {
        const q = query(
          collection(db, "Users"),
          where("email", "==", userEmail),
        );
        querySnapshot = await getDocs(q);
      }

      // If not found by email, try by clerk user id field
      if (!querySnapshot || querySnapshot.empty) {
        const q = query(
          collection(db, "Users"),
          where("clerkUserId", "==", userId),
        );
        querySnapshot = await getDocs(q);
      }

      // If still not found, try loading the doc directly by clerk user id (doc id)
      let userDoc;
      if (!querySnapshot || querySnapshot.empty) {
        const directRef = doc(db, "Users", userId);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          userDoc = directSnap;
        }
      } else {
        userDoc = querySnapshot.docs[0];
      }

      if (userDoc) {
        const userRef = doc(db, "Users", userDoc.id || userId);

        // Update user document with boarding dictionary
        await updateDoc(userRef, {
          boarding: boardingData,
          lastUpdated: new Date().toISOString(),
        });

        // Save to SecureStore that onboarding is completed
        const onboardingKey = `onboarding_completed_${user.id}`;
        await SecureStore.setItemAsync(onboardingKey, "true");

        // Update theme color immediately based on saved gender
        setThemeGender(gender);

        // Navigate to home
        Alert.alert(strings.sent, strings.wait, [
          {
            text: strings.ok,
            onPress: () => {
              router.replace("/Home");
            },
          },
        ]);
      } else {
        // No existing user doc found: create one using the clerk user id as document id
        const userRef = doc(db, "Users", userId);

        await setDoc(userRef, {
          email: userEmail || null,
          clerkUserId: userId,
          name: fullName || user.fullName || user.firstName || null,
          imgUrl: user.imageUrl || null,
          boarding: boardingData,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        });

        // Save to SecureStore that onboarding is completed
        const onboardingKey = `onboarding_completed_${user.id}`;
        await SecureStore.setItemAsync(onboardingKey, "true");

        // Update theme color immediately based on saved gender
        setThemeGender(gender);

        // Navigate to home
        Alert.alert(strings.sent, strings.wait, [
          {
            text: strings.ok,
            onPress: () => {
              router.replace("/Home");
            },
          },
        ]);
      }
    } catch (error) {
      console.error("Error saving onboarding data:", error);
      Alert.alert(strings.error, strings.saveError);
    } finally {
      setSaving(false);
    }
  };

  const toggleGoalSelection = (goal) => {
    setSelectedGoals((prev) => {
      if (prev.includes(goal)) {
        // Remove goal if already selected
        return prev.filter((g) => g !== goal);
      } else {
        // Add goal if not selected
        return [...prev, goal];
      }
    });
  };

  const toggleDaySelection = (dayId) => {
    const maxDays = parseInt(trainingFrequency, 10);
    if (!maxDays) return;

    setTrainingDays((prev) => {
      if (prev.includes(dayId)) {
        // Remove day if already selected
        return prev.filter((d) => d !== dayId);
      } else {
        // Add day if not selected and haven't reached max
        if (prev.length < maxDays) {
          if (validationErrors.trainingDays) {
            setValidationErrors((prevErrors) => ({
              ...prevErrors,
              trainingDays: false,
            }));
          }
          return [...prev, dayId];
        }
        return prev;
      }
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert(strings.error, "לא הצלחנו להתנתק");
    }
  };

  const renderModalPicker = (visible, setVisible, options, onSelect, title) => (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={styles.closeButton}
            >
              <FontAwesome6 name="xmark" size={24} color={primaryColor} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalOptionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.modalOption}
                onPress={() => {
                  onSelect(option);
                  setVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderGoalsModal = () => (
    <Modal
      visible={showGoalsPicker}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowGoalsPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.goalsModalContent]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{strings.workoutGoals}</Text>
            <TouchableOpacity
              onPress={() => setShowGoalsPicker(false)}
              style={styles.closeButton}
            >
              <FontAwesome6 name="xmark" size={24} color={primaryColor} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalOptionsContainer}>
            {goalOptions.map((goal, index) => {
              const isSelected = selectedGoals.includes(goal);
              return (
                <Pressable
                  key={index}
                  style={[
                    styles.modalOption,
                    styles.goalsModalOption,
                    [
                      isSelected &&
                        styles.goalsModalOptionSelected && {
                          borderColor: primaryColor,
                        },
                    ],
                  ]}
                  onPress={() => toggleGoalSelection(goal)}
                >
                  <View style={styles.goalsModalRow}>
                    <Text
                      style={[styles.modalOptionText, styles.goalsModalText]}
                    >
                      {goal}
                    </Text>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected &&
                          styles.checkboxSelected && {
                            borderColor: primaryColor,
                          },
                      ]}
                    >
                      {isSelected && (
                        <FontAwesome6
                          name="check"
                          size={14}
                          color={primaryColor}
                        />
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: primaryColor }]}
            onPress={() => setShowGoalsPicker(false)}
          >
            <Text style={styles.doneButtonText}>{strings.done}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Show loading while checking boarding data
  if (checkingBoardingData) {
    return (
      <ImageBackground
        source={require("../../assets/images/welcome4.jpg")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.mainContainer}>
          <StatusBar style="light" />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={styles.loadingText}>טוען...</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/welcome4.jpg")}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.mainContainer}>
        <StatusBar style="light" />

        {/* Header with Back Button for Edit Mode and Sign Out */}
        <View style={styles.header}>
          {isEditMode && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.btnBack, { backgroundColor: primaryColor }]}
            >
              <AntDesign name="caret-left" size={24} color="black" />
            </TouchableOpacity>
          )}
          {!isEditMode && (
            <TouchableOpacity onPress={handleSignOut} style={styles.btnSignOut}>
              <FontAwesome6
                name="right-from-bracket"
                size={18}
                color={Colors.DELETED}
              />
              <Text style={styles.btnSignOutText}>{strings.signOut}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Main Content */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Step 1: Personal Information Section */}
          {currentStep === 1 && (
            <View style={styles.section}>
              <Animated.View
                entering={FadeInDown.duration(600).delay(300)}
                style={styles.card}
              >
                <Text style={styles.welcomeTitle}>
                  {isEditMode
                    ? strings.editTitle
                    : `${strings.welcome}${user?.firstName || user?.fullName}`}
                </Text>
                <Text style={styles.sectionTitle}>{strings.personalInfo}</Text>
                <Text style={styles.helperTextTitle}>
                  {strings.mandatoryFields}
                </Text>
                {/* Full Name */}
                <View style={styles.inputWrapper}>
                  <View style={styles.labelContainer}>
                    <FontAwesome6 name="user" size={18} color={primaryColor} />
                    <Text style={styles.inputLabel}>{strings.fullName}</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder={strings.fullNamePlaceholder}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Birthday */}
                <View style={styles.inputWrapper}>
                  <View style={styles.labelContainer}>
                    <FontAwesome6
                      name="cake-candles"
                      size={18}
                      color={primaryColor}
                    />
                    <Text style={styles.inputLabel}>{strings.birthday}</Text>
                  </View>
                  <View style={styles.birthdayInputContainer}>
                    <TextInput
                      value={birthday}
                      style={styles.birthdayInput}
                      onChangeText={handleBirthdayChange}
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      autoCorrect={false}
                      caretHidden={true}
                      keyboardType="number-pad"
                      maxLength={8}
                      returnKeyType="done"
                    />
                    <View
                      style={[
                        styles.birthdayInputOverlay,
                        validationErrors.birthday && styles.inputError,
                      ]}
                    >
                      {"DD/MM/YYYY".split("").map((placeholder, index, arr) => {
                        const countDelimiters = arr
                          .slice(0, index)
                          .filter((char) => char === "/").length;
                        const indexWithoutDelimiters = index - countDelimiters;
                        const current = birthday[indexWithoutDelimiters];
                        return (
                          <Text
                            key={index}
                            style={styles.birthdayInputPlaceholder}
                          >
                            {placeholder === "/" || !current ? (
                              <Text
                                style={styles.birthdayInputEmptyPlaceholder}
                              >
                                {placeholder}
                              </Text>
                            ) : (
                              current
                            )}
                          </Text>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Gender */}
                <View style={styles.inputWrapper}>
                  <View style={styles.labelContainer}>
                    <FontAwesome6
                      name="venus-mars"
                      size={18}
                      color={primaryColor}
                    />
                    <Text style={styles.inputLabel}>{strings.gender}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.dropdown,
                      validationErrors.gender && styles.dropdownError,
                    ]}
                    onPress={() => {
                      setShowGenderPicker(true);
                      if (validationErrors.gender) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          gender: false,
                        }));
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !gender && styles.placeholder,
                      ]}
                    >
                      {gender || "בחר/י"}
                    </Text>
                    <FontAwesome6
                      name="chevron-down"
                      size={16}
                      color={primaryColor}
                    />
                  </TouchableOpacity>
                </View>

                {/* Height & Weight Row */}
                <View style={styles.rowContainer}>
                  <View style={[styles.inputWrapper, styles.halfWidth]}>
                    <View style={styles.labelContainer}>
                      <FontAwesome6
                        name="weight-scale"
                        size={18}
                        color={primaryColor}
                      />
                      <Text style={styles.inputLabel}>{strings.weight}</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.dropdown,
                        validationErrors.weight && styles.dropdownError,
                      ]}
                      onPress={() => {
                        setShowWeightPicker(true);
                        if (validationErrors.weight) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            weight: false,
                          }));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          !weight && styles.placeholder,
                        ]}
                      >
                        {weight || "בחר/י"}
                      </Text>
                      <FontAwesome6
                        name="chevron-down"
                        size={16}
                        color={primaryColor}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputWrapper, styles.halfWidth]}>
                    <View style={styles.labelContainer}>
                      <FontAwesome6
                        name="ruler-vertical"
                        size={18}
                        color={primaryColor}
                      />
                      <Text style={styles.inputLabel}>{strings.height}</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.dropdown,
                        validationErrors.height && styles.dropdownError,
                      ]}
                      onPress={() => {
                        setShowHeightPicker(true);
                        if (validationErrors.height) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            height: false,
                          }));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          !height && styles.placeholder,
                        ]}
                      >
                        {height || "בחר/י"}
                      </Text>
                      <FontAwesome6
                        name="chevron-down"
                        size={16}
                        color={primaryColor}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>

              {/* Paginator */}
              <Animated.View
                entering={FadeInDown.duration(600).delay(600)}
                style={styles.paginatorContainer}
              >
                <View
                  style={[
                    styles.dot,
                    styles.dotActive,
                    { backgroundColor: primaryColor },
                  ]}
                />
                <View style={styles.dot} />
              </Animated.View>

              {/* Next Button */}
              <Animated.View entering={FadeInDown.duration(600).delay(700)}>
                <TouchableOpacity
                  style={[
                    styles.nextButton,
                    {
                      backgroundColor: primaryColor,
                      shadowColor: primaryColor,
                    },
                  ]}
                  onPress={handleNext}
                >
                  <Text style={styles.nextButtonText}>{strings.next}</Text>
                  <FontAwesome6 name="arrow-right" size={24} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}

          {/* Step 2: Training Preferences Section */}
          {currentStep === 2 && (
            <View style={styles.section}>
              <Animated.View
                entering={FadeInDown.duration(600).delay(300)}
                style={styles.card}
              >
                <Text style={styles.sectionTitle}>{strings.preferences}</Text>
                <Text style={styles.helperTextTitle}>
                  {strings.mandatoryFields}
                </Text>
                {/* Training Frequency */}
                <View style={styles.inputWrapper}>
                  <View style={styles.labelContainer}>
                    <FontAwesome6
                      name="calendar-days"
                      size={18}
                      color={primaryColor}
                    />
                    <Text style={styles.inputLabel}>
                      {strings.trainingFrequency}
                    </Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.trainingFrequency &&
                        styles.inputErrorBorder,
                    ]}
                    placeholder={strings.trainingFrequencyPlaceholder}
                    value={trainingFrequency}
                    onChangeText={(value) => {
                      const num = parseInt(value, 10);
                      if (value === "") {
                        setTrainingFrequency("");
                        setTrainingDays([]);
                      } else if (!isNaN(num) && num >= 1 && num <= 7) {
                        setTrainingFrequency(value);
                        // Reset training days if new frequency is less than selected days
                        if (trainingDays.length > num) {
                          setTrainingDays(trainingDays.slice(0, num));
                        }
                        if (validationErrors.trainingFrequency) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            trainingFrequency: false,
                          }));
                        }
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={1}
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Training Days */}
                {trainingFrequency && (
                  <View style={styles.inputWrapper}>
                    <View style={styles.labelContainer}>
                      <FontAwesome6
                        name="calendar-check"
                        size={18}
                        color={primaryColor}
                      />
                      <Text style={styles.inputLabel}>
                        {strings.trainingDays}
                      </Text>
                    </View>
                    {trainingDays.length < parseInt(trainingFrequency, 10) && (
                      <Text style={styles.helperText}>
                        {strings.daysRemaining.replace(
                          "{count}",
                          parseInt(trainingFrequency, 10) - trainingDays.length,
                        )}
                      </Text>
                    )}
                    {trainingDays.length ===
                      parseInt(trainingFrequency, 10) && (
                      <Text
                        style={[styles.helperText, styles.helperTextSuccess]}
                      >
                        {strings.daysComplete}
                      </Text>
                    )}
                    <View
                      style={[
                        styles.daysGrid,
                        validationErrors.trainingDays && styles.daysGridError,
                      ]}
                    >
                      {daysOfWeek.map((day) => {
                        const isSelected = trainingDays.includes(day.id);
                        const maxDays = parseInt(trainingFrequency, 10);
                        const isDisabled =
                          !isSelected && trainingDays.length >= maxDays;

                        return (
                          <TouchableOpacity
                            key={day.id}
                            style={[
                              styles.dayChip,
                              { borderColor: primaryColor },
                              isSelected && [
                                styles.dayChipSelected,
                                {
                                  backgroundColor: primaryColor,
                                  borderColor: primaryColor,
                                },
                              ],
                              isDisabled && styles.dayChipDisabled,
                            ]}
                            onPress={() => toggleDaySelection(day.id)}
                            disabled={isDisabled}
                          >
                            <Text
                              style={[
                                styles.dayChipText,
                                { color: primaryColor },
                                isSelected && styles.dayChipTextSelected,
                                isDisabled && styles.dayChipTextDisabled,
                              ]}
                            >
                              {day.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Training Place */}
                <View style={styles.inputWrapper}>
                  <View style={styles.labelContainer}>
                    <FontAwesome6
                      name="location-dot"
                      size={18}
                      color={primaryColor}
                    />
                    <Text style={styles.inputLabel}>
                      {strings.trainingPlace}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.dropdown,
                      validationErrors.trainingPlace && styles.dropdownError,
                    ]}
                    onPress={() => {
                      setShowPlacePicker(true);
                      if (validationErrors.trainingPlace) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          trainingPlace: false,
                        }));
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !trainingPlace && styles.placeholder,
                      ]}
                    >
                      {trainingPlace || "בחר/י"}
                    </Text>
                    <FontAwesome6
                      name="chevron-down"
                      size={16}
                      color={primaryColor}
                    />
                  </TouchableOpacity>
                </View>

                {/* Workout Goals */}
                <View style={styles.inputWrapper}>
                  <View style={styles.labelContainer}>
                    <FontAwesome6
                      name="bullseye"
                      size={18}
                      color={primaryColor}
                    />
                    <Text style={styles.inputLabel}>
                      {strings.workoutGoals}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.dropdown,
                      validationErrors.workoutGoals && styles.dropdownError,
                    ]}
                    onPress={() => {
                      setShowGoalsPicker(true);
                      if (validationErrors.workoutGoals) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          workoutGoals: false,
                        }));
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        selectedGoals.length === 0 && styles.placeholder,
                      ]}
                    >
                      {selectedGoals.length > 0
                        ? `${selectedGoals.length} נבחרו`
                        : "בחר/י"}
                    </Text>
                    <FontAwesome6
                      name="chevron-down"
                      size={16}
                      color={primaryColor}
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Paginator */}
              <Animated.View
                entering={FadeInDown.duration(600).delay(600)}
                style={styles.paginatorContainer}
              >
                <View style={styles.dot} />
                <View
                  style={[
                    styles.dot,
                    styles.dotActive,
                    { backgroundColor: primaryColor },
                  ]}
                />
              </Animated.View>

              {/* Navigation Buttons */}
              <Animated.View
                entering={FadeInDown.duration(600).delay(700)}
                style={styles.navigationButtons}
              >
                <TouchableOpacity
                  style={[styles.prevButton, { borderColor: primaryColor }]}
                  onPress={() => setCurrentStep(1)}
                >
                  <FontAwesome6
                    name="arrow-left"
                    size={20}
                    color={primaryColor}
                  />
                  <Text
                    style={[styles.prevButtonText, { color: primaryColor }]}
                  >
                    {strings.previous}
                  </Text>
                </TouchableOpacity>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor: primaryColor,
                      shadowColor: primaryColor,
                    },
                    saving && styles.submitButtonDisabled,
                  ]}
                  onPress={handleStart}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.submitButtonText}>
                        {strings.submit}
                      </Text>
                      <FontAwesome6 name="rocket" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
        </ScrollView>

        {/* Modals */}
        {renderModalPicker(
          showGenderPicker,
          setShowGenderPicker,
          genderOptions,
          setGender,
          strings.gender,
        )}
        {renderModalPicker(
          showHeightPicker,
          setShowHeightPicker,
          heightRanges,
          setHeight,
          strings.height,
        )}
        {renderModalPicker(
          showWeightPicker,
          setShowWeightPicker,
          weightRanges,
          setWeight,
          strings.weight,
        )}
        {renderModalPicker(
          showPlacePicker,
          setShowPlacePicker,
          placeOptions,
          setTrainingPlace,
          strings.trainingPlace,
        )}
        {renderGoalsModal()}
      </SafeAreaView>
    </ImageBackground>
  );
}

const strings = {
  welcome: "שלום לך, ",
  welcomeMessage: "בואו נכיר אותך קצת יותר טוב",
  editTitle: "עריכת פרטי מתאמן",
  personalInfo: "מידע אישי",
  fullName: "הכנס/י שם מלא",
  fullNamePlaceholder: "השם שיוצג באפליקציה (לא חובה)",
  birthday: "תאריך לידה*",
  gender: "מגדר*",
  height: "גובה (ס״מ)*",
  weight: "משקל (ק״ג)*",
  preferences: "העדפות אימון",
  mandatoryFields: "* שדות חובה",
  trainingFrequency: "תדירות אימונים בשבוע*",
  trainingFrequencyPlaceholder: "הכנס/י מספר בין 1-7",
  trainingDays: "ימי אימון*",
  daysRemaining: "נותרו {count} ימים לבחירה",
  daysComplete: "✓ נבחרו כל הימים הנדרשים",
  trainingPlace: "מקום אימון מועדף*",
  workoutGoals: "מטרות אימון*",
  done: "סיום",
  next: "הבא ",
  previous: "הקודם ",
  submit: "התחל/י כאן",
  error: "שגיאה",
  fillRequired: "יש למלא את כל השדות המסומנים ב-*",
  userNotFound: "משתמש לא נמצא",
  saveError: "לא הצלחנו לשמור את הנתונים",
  sent: "העדפותיך נשלחו אל המאמן",
  wait: "בקרוב תקבל/י הודעה מהמאמן שלך",
  success: "הצלחה",
  detailsUpdated: "הפרטים עודכנו בהצלחה",
  ok: "אישור",
  signOut: "התנתק/י",
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  mainContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 5,
    position: "relative",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  btnBack: {
    left: 5,
    backgroundColor: Colors.PRIMARY,
    width: hp(4.8),
    height: hp(4.8),
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 99,
  },
  btnSignOut: {
    right: 5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  btnSignOutText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#fff",
    marginBottom: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 30,
    flexGrow: 1,
    justifyContent: "center",
  },
  section: {
    marginBottom: 20,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 5,
    color: "#fff",
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  inputWrapper: {
    marginBottom: 20,
    position: "relative",
  },
  birthdayInputContainer: {
    position: "relative",
  },
  birthdayInputOverlay: {
    backgroundColor: "#fafafa",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 16,
    pointerEvents: "none",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 12,
  },
  birthdayInputPlaceholder: {
    flex: 1,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 16,
  },
  birthdayInputEmptyPlaceholder: {
    color: "#999",
    fontWeight: "500",
  },
  birthdayInput: {
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: "transparent",
    color: "transparent",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  labelContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  rowContainer: {
    flexDirection: "row-reverse",
    gap: 12,
    marginBottom: 0,
  },
  halfWidth: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    color: "#fff",
    writingDirection: "rtl",
  },
  helperText: {
    fontSize: 13,
    textAlign: "right",
    color: "#888",
    marginBottom: 12,
    fontStyle: "italic",
  },
  helperTextSuccess: {
    color: "#4caf50",
    fontWeight: "600",
  },
  helperTextTitle: {
    fontSize: 13,
    textAlign: "right",
    color: "#ddd",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    textAlign: "right",
  },
  dropdown: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownText: {
    fontSize: 16,
    textAlign: "right",
    color: "#1a1a1a",
  },
  placeholder: {
    color: "#999",
  },
  inputError: {
    borderColor: "#ff4444",
  },
  inputErrorBorder: {
    borderColor: "#ff4444",
  },
  dropdownError: {
    borderColor: "#ff4444",
  },
  dropdownOptions: {
    position: "absolute",
    top: 72,
    right: 0,
    left: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    zIndex: 1000,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    overflow: "hidden",
  },
  dropdownOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionText: {
    fontSize: 16,
    textAlign: "right",
    color: "#1a1a1a",
  },
  goalsGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
  },
  submitButton: {
    flex: 1,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 16,
    borderRadius: 15,
    shadowColor: Colors.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  nextButton: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 14,
    borderRadius: 15,
    marginTop: 20,
    shadowColor: Colors.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  navigationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  prevButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: Colors.PRIMARY,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  prevButtonText: {
    color: Colors.PRIMARY,
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "60%",
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1.5,
    borderBottomColor: "#e0e0e0",
    position: "relative",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  modalOptionsContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginVertical: 6,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 15,
    backgroundColor: "#fafafa",
  },
  modalOptionText: {
    fontSize: 17,
    color: "#1a1a1a",
    textAlign: "center",
    fontWeight: "500",
  },
  goalsModalContent: {
    width: "75%",
    maxHeight: "80%",
  },
  goalsModalOption: {
    borderColor: "#e0e0e0",
  },
  goalsModalOptionSelected: {
    borderColor: Colors.PRIMARY,
  },
  goalsModalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalsModalText: {
    textAlign: "right",
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  checkboxSelected: {
    borderColor: Colors.PRIMARY,
    backgroundColor: "#fff",
  },
  doneButton: {
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  paginatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#d0d0d0",
  },
  dotActive: {
    backgroundColor: Colors.PRIMARY,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  daysGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
    paddingVertical: 5,
  },
  daysGridError: {
    borderWidth: 1.5,
    borderColor: "#ff4444",
    borderRadius: 12,
    padding: 10,
  },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.PRIMARY,
    backgroundColor: "#fafafa",
    minWidth: 70,
    alignItems: "center",
  },
  dayChipSelected: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  dayChipDisabled: {
    borderColor: "#d0d0d0",
    backgroundColor: "#f5f5f5",
    opacity: 0.5,
  },
  dayChipText: {
    fontSize: 14,
    color: Colors.PRIMARY,
    fontWeight: "600",
  },
  dayChipTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  dayChipTextDisabled: {
    color: "#999",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    margin: 20,
    borderRadius: 16,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
