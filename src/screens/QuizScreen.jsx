import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Animated,
    Modal,
    StatusBar,
    SafeAreaView,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { ADMOB_BANNER_ID } from "@env";
import { supabase } from "../config/supabase";
import { showInterstitialAd } from "../ads/InterstitialAdManager";
import { fakeBack } from "../components/FackBack";

const { width } = Dimensions.get("window");

/* ================= QUIZ DATA BY CATEGORY ================= */
export const QUIZ_CATEGORIES = [
    {
        id: "genetics",
        title: "Genetics & DNA",
        shortTitle: "Genetics",
        icon: "dna",
        color: "#3b82f6",
        rewardPerQ: 20,
        stars: 5,
        badge: "POPULAR",
        badgeColor: "#ef4444",
        desc: "Genes, DNA replication, chromosomes & inheritance",
        questions: [
            {
                id: "g1",
                question: "What is the primary unit of heredity in living organisms?",
                options: ["Protein", "Gene", "Lipid", "Carbohydrate"],
                correctIndex: 1,
                fact: "Genes are segments of DNA that carry instructions for building proteins.",
            },
            {
                id: "g2",
                question: "Which nitrogenous base pairs with Adenine (A) in DNA?",
                options: ["Guanine", "Cytosine", "Thymine", "Uracil"],
                correctIndex: 2,
                fact: "In DNA, Adenine always pairs with Thymine via two hydrogen bonds.",
            },
            {
                id: "g3",
                question: "How many pairs of chromosomes are found in normal human body cells?",
                options: ["21 pairs", "23 pairs", "46 pairs", "12 pairs"],
                correctIndex: 1,
                fact: "Humans have 23 pairs (46 total) of chromosomes in each somatic cell.",
            },
            {
                id: "g4",
                question: "Who is widely celebrated as the Father of Modern Genetics?",
                options: ["Charles Darwin", "Gregor Mendel", "Louis Pasteur", "James Watson"],
                correctIndex: 1,
                fact: "Gregor Mendel discovered fundamental laws of inheritance through pea plant experiments.",
            },
            {
                id: "g5",
                question: "What is the process of copying genetic code from DNA to messenger RNA?",
                options: ["Translation", "Transcription", "Mutation", "Replication"],
                correctIndex: 1,
                fact: "Transcription is carried out by RNA polymerase inside the cell nucleus.",
            },
        ],
    },
    {
        id: "anatomy",
        title: "Human Anatomy",
        shortTitle: "Anatomy",
        icon: "heart-pulse",
        color: "#ec4899",
        rewardPerQ: 25,
        stars: 5,
        badge: "HOT",
        badgeColor: "#f97316",
        desc: "Heart, brain, blood circulation, skeleton & organs",
        questions: [
            {
                id: "a1",
                question: "Which organ is the largest in the human body by surface area?",
                options: ["Liver", "Brain", "Skin", "Lungs"],
                correctIndex: 2,
                fact: "Human skin covers around 1.5 to 2 square meters in an adult.",
            },
            {
                id: "a2",
                question: "How many chambers does the normal human heart have?",
                options: ["2", "3", "4", "6"],
                correctIndex: 2,
                fact: "The human heart has 4 chambers: two atria and two ventricles.",
            },
            {
                id: "a3",
                question: "How many bones make up an adult human skeletal system?",
                options: ["180", "206", "300", "250"],
                correctIndex: 1,
                fact: "Babies are born with ~300 bones, which fuse over time to 206 adult bones.",
            },
            {
                id: "a4",
                question: "Which blood cells are responsible for carrying oxygen throughout the body?",
                options: ["Platelets", "Red Blood Cells", "White Blood Cells", "Plasma cells"],
                correctIndex: 1,
                fact: "Red blood cells (erythrocytes) use iron-rich hemoglobin to bind and transport oxygen.",
            },
            {
                id: "a5",
                question: "Which part of the brain controls voluntary muscle balance and coordination?",
                options: ["Cerebrum", "Cerebellum", "Medulla", "Hypothalamus"],
                correctIndex: 1,
                fact: "The cerebellum coordinates motor movements and maintains posture and balance.",
            },
        ],
    },
    {
        id: "cell",
        title: "Cell Biology",
        shortTitle: "Cell Bio",
        icon: "microscope",
        color: "#8b5cf6",
        rewardPerQ: 20,
        stars: 4.5,
        badge: "FEATURED",
        badgeColor: "#8b5cf6",
        desc: "Mitochondria, organelles, cell division & enzymes",
        questions: [
            {
                id: "c1",
                question: "Which organelle is universally known as the 'powerhouse of the cell'?",
                options: ["Golgi body", "Nucleus", "Mitochondria", "Lysosome"],
                correctIndex: 2,
                fact: "Mitochondria generate most of the cell's ATP supply through cellular respiration.",
            },
            {
                id: "c2",
                question: "Which organelle is the primary site of protein synthesis in a cell?",
                options: ["Ribosome", "Vacuole", "Centriole", "Peroxisome"],
                correctIndex: 0,
                fact: "Ribosomes translate mRNA sequences into polypeptide amino acid chains.",
            },
            {
                id: "c3",
                question: "What type of cell division produces two genetically identical daughter cells?",
                options: ["Meiosis", "Mitosis", "Fertilization", "Budding"],
                correctIndex: 1,
                fact: "Mitosis ensures equal distribution of genetic material for growth and repair.",
            },
            {
                id: "c4",
                question: "What protective green pigment traps light energy in plant chloroplasts?",
                options: ["Hemoglobin", "Melanin", "Chlorophyll", "Carotene"],
                correctIndex: 2,
                fact: "Chlorophyll absorbs blue and red wavelengths while reflecting green light.",
            },
            {
                id: "c5",
                question: "Which organelle contains digestive enzymes to recycle cell waste?",
                options: ["Lysosome", "Endoplasmic reticulum", "Chloroplast", "Plastid"],
                correctIndex: 0,
                fact: "Lysosomes act as the cellular recycling center by degrading macromolecules.",
            },
        ],
    },
    {
        id: "botany",
        title: "Botany & Plants",
        shortTitle: "Botany",
        icon: "leaf",
        color: "#10b981",
        rewardPerQ: 15,
        stars: 4.5,
        badge: "NATURE",
        badgeColor: "#10b981",
        desc: "Photosynthesis, plant vascular tissues, leaves & flowers",
        questions: [
            {
                id: "b1",
                question: "Which plant tissue is responsible for transporting water and minerals upward?",
                options: ["Phloem", "Xylem", "Cambium", "Cortex"],
                correctIndex: 1,
                fact: "Xylem transports water and dissolved minerals from the roots up to the leaves.",
            },
            {
                id: "b2",
                question: "What are the microscopic pores on leaves used for gas exchange called?",
                options: ["Stomata", "Cuticles", "Lenticels", "Pollen"],
                correctIndex: 0,
                fact: "Stomata open and close to regulate carbon dioxide uptake and water transpiration.",
            },
            {
                id: "b3",
                question: "Which gas do plants absorb from the air during photosynthesis?",
                options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
                correctIndex: 2,
                fact: "Plants use carbon dioxide and water with solar energy to synthesize glucose and oxygen.",
            },
            {
                id: "b4",
                question: "What part of a flowering plant ripens and transforms into a fruit?",
                options: ["Stigma", "Ovary", "Petal", "Sepal"],
                correctIndex: 1,
                fact: "After pollination and fertilization, the plant ovary swells to form the fruit protecting seeds.",
            },
            {
                id: "b5",
                question: "Which plant hormone promotes stem elongation and phototropism towards light?",
                options: ["Auxin", "Ethylene", "Abscisic acid", "Insulin"],
                correctIndex: 0,
                fact: "Auxins accumulate on the shaded side of stems, causing cells to elongate towards light.",
            },
        ],
    },
    {
        id: "zoology",
        title: "Zoology & Animals",
        shortTitle: "Zoology",
        icon: "paw",
        color: "#f59e0b",
        rewardPerQ: 20,
        stars: 5,
        badge: "WILD",
        badgeColor: "#f59e0b",
        desc: "Vertebrates, animal behaviors, adaptations & species",
        questions: [
            {
                id: "z1",
                question: "Which animal is the largest living creature ever known on Earth?",
                options: ["African Elephant", "Blue Whale", "Colossal Squid", "Giraffe"],
                correctIndex: 1,
                fact: "The Blue Whale can weigh up to 200 metric tons and reach 30 meters in length.",
            },
            {
                id: "z2",
                question: "What defining trait separates mammals from all other animal classes?",
                options: ["Laying eggs", "Producing milk for young", "Cold-blooded", "Having feathers"],
                correctIndex: 1,
                fact: "Female mammals have mammary glands that produce milk to nourish their young.",
            },
            {
                id: "z3",
                question: "How many heart chambers does an adult amphibian (like a frog) have?",
                options: ["2", "3", "4", "1"],
                correctIndex: 1,
                fact: "Amphibians have a 3-chambered heart consisting of two atria and one shared ventricle.",
            },
            {
                id: "z4",
                question: "What specialized organ do fish use to extract dissolved oxygen from water?",
                options: ["Spiracles", "Gills", "Lungs", "Skin pores"],
                correctIndex: 1,
                fact: "Fish gills use countercurrent exchange to maximize oxygen absorption from water.",
            },
            {
                id: "z5",
                question: "Which insect undergoes complete metamorphosis (egg, larva, pupa, adult)?",
                options: ["Grasshopper", "Butterfly", "Cricket", "Dragonfly"],
                correctIndex: 1,
                fact: "Butterflies transform completely from caterpillars inside chrysalis pupae.",
            },
        ],
    },
    {
        id: "ecology",
        title: "Ecology & Nature",
        shortTitle: "Ecology",
        icon: "earth",
        color: "#06b6d4",
        rewardPerQ: 25,
        stars: 5,
        badge: "ECO",
        badgeColor: "#06b6d4",
        desc: "Ecosystems, biomes, food webs, symbiosis & biodiversity",
        questions: [
            {
                id: "e1",
                question: "What do you call organisms that manufacture their own food from sunlight?",
                options: ["Heterotrophs", "Autotrophs", "Decomposers", "Parasites"],
                correctIndex: 1,
                fact: "Autotrophs (producers) convert light or chemical energy into organic nutrients.",
            },
            {
                id: "e2",
                question: "What is a symbiotic relationship where both species benefit called?",
                options: ["Parasitism", "Mutualism", "Commensalism", "Competition"],
                correctIndex: 1,
                fact: "Mutualism occurs when both interacting species gain survival or reproductive advantages.",
            },
            {
                id: "e3",
                question: "Approximately what percentage of energy is passed to the next trophic level?",
                options: ["10%", "50%", "90%", "100%"],
                correctIndex: 0,
                fact: "According to Lindeman's 10% law, roughly 90% of energy is lost as metabolic heat.",
            },
            {
                id: "e4",
                question: "Which atmospheric gas layer shields Earth's surface from solar UV radiation?",
                options: ["Methane layer", "Ozone layer", "Argon blanket", "Carbon canopy"],
                correctIndex: 1,
                fact: "The stratospheric ozone (O3) layer absorbs high-frequency ultraviolet radiation.",
            },
            {
                id: "e5",
                question: "What is the vast cold terrestrial biome dominated by coniferous pine forests?",
                options: ["Tundra", "Taiga (Boreal Forest)", "Savanna", "Steppe"],
                correctIndex: 1,
                fact: "The Taiga is the world's largest land biome, circling the subarctic northern hemisphere.",
            },
        ],
    },
];

export default function QuizScreen({ navigation, route }) {
    const initialCategory = route?.params?.category || "genetics";

    // State
    const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategory);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [sessionCoins, setSessionCoins] = useState(0);
    const [score, setScore] = useState(0);
    const [walletBalance, setWalletBalance] = useState(0);
    const [showResultModal, setShowResultModal] = useState(false);

    // Animations
    const progressAnim = useRef(new Animated.Value(0)).current;
    const optionScaleAnim = useRef(new Animated.Value(1)).current;

    // Current category & questions
    const currentCategory = QUIZ_CATEGORIES.find((c) => c.id === selectedCategoryId) || QUIZ_CATEGORIES[0];
    const questions = currentCategory.questions;
    const currentQuestion = questions[currentQuestionIndex] || questions[0];

    // Load Wallet Balance
    useEffect(() => {
        fetchWalletBalance();
    }, []);

    // Update Progress Bar
    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: (currentQuestionIndex + 1) / questions.length,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [currentQuestionIndex, questions.length]);

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const database = require("@react-native-firebase/database").default;
            const snapshot = await database().ref(`/wallets/${user.id}`).once("value");

            if (snapshot.exists()) {
                setWalletBalance(parseFloat(snapshot.val().balance || 0));
            } else {
                const { data } = await supabase
                    .from("profiles")
                    .select("wallet_balance")
                    .eq("id", user.id)
                    .single();
                if (data) setWalletBalance(parseFloat(data.wallet_balance || 0));
            }
        } catch (e) {
            console.log("QuizScreen fetchWalletBalance error:", e);
        }
    };

    const awardCoinsToDatabase = async (coinsWon) => {
        if (!coinsWon || coinsWon <= 0) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const database = require("@react-native-firebase/database").default;
            const snapshot = await database().ref(`/wallets/${user.id}`).once("value");

            let currentBal = 0;
            if (snapshot.exists()) {
                currentBal = parseFloat(snapshot.val().balance || 0);
            } else {
                const { data } = await supabase
                    .from("profiles")
                    .select("wallet_balance")
                    .eq("id", user.id)
                    .single();
                currentBal = parseFloat(data?.wallet_balance || 0);
            }

            const newBal = currentBal + coinsWon;

            // 1. Supabase update
            await supabase.from("profiles").update({ wallet_balance: newBal }).eq("id", user.id);

            // 2. Firebase sync
            try {
                await database().ref(`/wallets/${user.id}`).update({
                    balance: newBal,
                    lastUpdated: Date.now(),
                });
            } catch (fbErr) {
                console.warn("Quiz Firebase sync error:", fbErr.message);
            }

            // 3. Wallet transaction log
            try {
                await supabase.from("wallet_transactions").insert([{
                    user_id: user.id,
                    transaction_type: "Quiz Reward",
                    amount: coinsWon,
                    balance_after: newBal,
                }]);
            } catch (txErr) {
                console.warn("Quiz transaction log error:", txErr.message);
            }

            setWalletBalance(newBal);
        } catch (e) {
            console.log("Error awarding quiz coins:", e);
        }
    };

    const handleSelectOption = (index) => {
        if (isAnswered) return;

        setSelectedOption(index);
        setIsAnswered(true);

        const isCorrect = index === currentQuestion.correctIndex;
        if (isCorrect) {
            const reward = currentCategory.rewardPerQ;
            setScore((prev) => prev + 1);
            setSessionCoins((prev) => prev + reward);
            awardCoinsToDatabase(reward);
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
            setSelectedOption(null);
            setIsAnswered(false);
        } else {
            // Quiz completed
            showInterstitialAd();
            setShowResultModal(true);
        }
    };

    const switchCategory = (catId) => {
        setSelectedCategoryId(catId);
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setIsAnswered(false);
        setScore(0);
        setSessionCoins(0);
    };

    const restartCurrentQuiz = () => {
        setShowResultModal(false);
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setIsAnswered(false);
        setScore(0);
        setSessionCoins(0);
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
    });

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0f1f" />

            {/* TOP BAR */}
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.backBtn} onPress={() => fakeBack(navigation)}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle}>Biology Quiz & Win</Text>
                    <Text style={styles.headerSubtitle}>{currentCategory.title}</Text>
                </View>

                {/* Live Coins Tag */}
                <View style={styles.balanceTag}>
                    <MaterialCommunityIcons name="circle-multiple" size={16} color="#facc15" />
                    <Text style={styles.balanceText}>{walletBalance} 🪙</Text>
                </View>
            </View>

            {/* CATEGORY SELECTOR CHIPS */}
            <View style={styles.categoryScrollContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                    {QUIZ_CATEGORIES.map((cat) => {
                        const isActive = cat.id === selectedCategoryId;
                        return (
                            <TouchableOpacity
                                key={cat.id}
                                style={[
                                    styles.categoryChip,
                                    isActive && { backgroundColor: cat.color, borderColor: cat.color },
                                ]}
                                onPress={() => switchCategory(cat.id)}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons
                                    name={cat.icon}
                                    size={16}
                                    color={isActive ? "#fff" : cat.color}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                                    {cat.shortTitle}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* PROGRESS & REWARD BAR */}
                <View style={styles.progressCard}>
                    <View style={styles.progressRow}>
                        <Text style={styles.progressText}>
                            Question <Text style={{ color: "#38bdf8", fontWeight: "700" }}>{currentQuestionIndex + 1}</Text> of {questions.length}
                        </Text>
                        <View style={styles.rewardBadge}>
                            <MaterialCommunityIcons name="fire" size={16} color="#22c55e" />
                            <Text style={styles.rewardBadgeText}>+{currentCategory.rewardPerQ} coins / correct</Text>
                        </View>
                    </View>

                    {/* Progress line */}
                    <View style={styles.progressBarTrack}>
                        <Animated.View style={[styles.progressBarFill, { width: progressWidth, backgroundColor: currentCategory.color }]} />
                    </View>
                </View>

                {/* QUESTION CARD */}
                <View style={styles.questionCard}>
                    <View style={styles.questionHeader}>
                        <View style={[styles.categoryBadge, { backgroundColor: currentCategory.color + "22", borderColor: currentCategory.color }]}>
                            <MaterialCommunityIcons name={currentCategory.icon} size={14} color={currentCategory.color} style={{ marginRight: 4 }} />
                            <Text style={[styles.categoryBadgeText, { color: currentCategory.color }]}>{currentCategory.title}</Text>
                        </View>
                        <Text style={styles.streakText}>Session: +{sessionCoins} 🪙</Text>
                    </View>

                    <Text style={styles.questionTitle}>{currentQuestion.question}</Text>
                </View>

                {/* OPTIONS */}
                <View style={styles.optionsContainer}>
                    {currentQuestion.options.map((option, idx) => {
                        const letter = ["A", "B", "C", "D"][idx];
                        const isSelected = selectedOption === idx;
                        const isCorrect = idx === currentQuestion.correctIndex;

                        let cardStyle = styles.optionCard;
                        let letterStyle = styles.optionLetterBox;
                        let textStyle = styles.optionText;

                        if (isAnswered) {
                            if (isCorrect) {
                                cardStyle = [styles.optionCard, styles.optionCorrect];
                                letterStyle = [styles.optionLetterBox, styles.letterCorrect];
                                textStyle = [styles.optionText, styles.textCorrect];
                            } else if (isSelected && !isCorrect) {
                                cardStyle = [styles.optionCard, styles.optionWrong];
                                letterStyle = [styles.optionLetterBox, styles.letterWrong];
                                textStyle = [styles.optionText, styles.textWrong];
                            }
                        } else if (isSelected) {
                            cardStyle = [styles.optionCard, styles.optionSelected];
                        }

                        return (
                            <TouchableOpacity
                                key={idx}
                                style={cardStyle}
                                activeOpacity={0.8}
                                onPress={() => handleSelectOption(idx)}
                                disabled={isAnswered}
                            >
                                <View style={letterStyle}>
                                    <Text style={styles.letterText}>{letter}</Text>
                                </View>
                                <Text style={textStyle}>{option}</Text>

                                {isAnswered && isCorrect && (
                                    <MaterialCommunityIcons name="check-circle" size={24} color="#22c55e" style={{ marginLeft: "auto" }} />
                                )}
                                {isAnswered && isSelected && !isCorrect && (
                                    <MaterialCommunityIcons name="close-circle" size={24} color="#ef4444" style={{ marginLeft: "auto" }} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* FACT / EXPLANATION CARD (Visible after answering) */}
                {isAnswered && (
                    <View style={styles.factCard}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                            <MaterialCommunityIcons name="lightbulb-on" size={18} color="#facc15" style={{ marginRight: 6 }} />
                            <Text style={styles.factTitle}>Did you know?</Text>
                            {selectedOption === currentQuestion.correctIndex ? (
                                <Text style={styles.factBadgeSuccess}>+ {currentCategory.rewardPerQ} Coins Won!</Text>
                            ) : (
                                <Text style={styles.factBadgeWrong}>Incorrect</Text>
                            )}
                        </View>
                        <Text style={styles.factText}>{currentQuestion.fact}</Text>

                        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: currentCategory.color }]} onPress={handleNextQuestion}>
                            <Text style={styles.nextBtnText}>
                                {currentQuestionIndex < questions.length - 1 ? "Next Question" : "View Results & Win"}
                            </Text>
                            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* ALL CATEGORIES QUICK PICK */}
                <View style={styles.allCategoriesSection}>
                    <Text style={styles.sectionHeading}>Explore All Biology Categories</Text>
                    <View style={styles.categoriesGrid}>
                        {QUIZ_CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[
                                    styles.gridCard,
                                    cat.id === selectedCategoryId && { borderColor: cat.color, backgroundColor: cat.color + "15" },
                                ]}
                                onPress={() => switchCategory(cat.id)}
                            >
                                <View style={[styles.gridIconBox, { backgroundColor: cat.color }]}>
                                    <MaterialCommunityIcons name={cat.icon} size={22} color="#fff" />
                                </View>
                                <Text style={styles.gridCardTitle}>{cat.title}</Text>
                                <Text style={styles.gridCardSub}>+{cat.rewardPerQ} coins/Q</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* BOTTOM ADMOB BANNER */}
            <View style={styles.bannerWrapper}>
                <BannerAd unitId={ADMOB_BANNER_ID} size={BannerAdSize.ADAPTIVE_BANNER} />
            </View>

            {/* RESULTS MODAL */}
            <Modal visible={showResultModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={[styles.modalTrophy, { backgroundColor: currentCategory.color }]}>
                            <MaterialCommunityIcons name="trophy" size={44} color="#fff" />
                        </View>

                        <Text style={styles.modalTitle}>Quiz Completed!</Text>
                        <Text style={styles.modalSub}>{currentCategory.title}</Text>

                        {/* STATS */}
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statNumber}>{score}/{questions.length}</Text>
                                <Text style={styles.statLabel}>Score</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <Text style={[styles.statNumber, { color: "#22c55e" }]}>+{sessionCoins}</Text>
                                <Text style={styles.statLabel}>Coins Won</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <Text style={styles.statNumber}>{Math.round((score / questions.length) * 100)}%</Text>
                                <Text style={styles.statLabel}>Accuracy</Text>
                            </View>
                        </View>

                        <Text style={styles.coinsCreditedNotice}>
                            🎉 {sessionCoins} coins have been added to your wallet!
                        </Text>

                        {/* ACTION BUTTONS */}
                        <TouchableOpacity style={[styles.modalBtn, { backgroundColor: currentCategory.color }]} onPress={restartCurrentQuiz}>
                            <MaterialCommunityIcons name="restart" size={20} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.modalBtnText}>Play Again</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalBtnAlt} onPress={() => { setShowResultModal(false); fakeBack(navigation); }}>
                            <Text style={styles.modalBtnAltText}>Back to Home</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0f1f",
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#1e293b",
    },
    backBtn: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: "#1e293b",
    },
    titleContainer: {
        alignItems: "center",
        flex: 1,
        marginHorizontal: 10,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#fff",
    },
    headerSubtitle: {
        fontSize: 12,
        color: "#94a3b8",
        marginTop: 1,
    },
    balanceTag: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1e293b",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#facc1533",
    },
    balanceText: {
        color: "#facc15",
        fontWeight: "700",
        fontSize: 12,
        marginLeft: 4,
    },
    categoryScrollContainer: {
        backgroundColor: "#0d1424",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#1e293b",
    },
    categoryScroll: {
        paddingHorizontal: 12,
    },
    categoryChip: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: "#1e293b",
        marginRight: 8,
        borderWidth: 1,
        borderColor: "#334155",
    },
    categoryChipText: {
        color: "#cbd5e1",
        fontSize: 12,
        fontWeight: "600",
    },
    categoryChipTextActive: {
        color: "#fff",
        fontWeight: "700",
    },
    scrollContent: {
        padding: 15,
    },
    progressCard: {
        backgroundColor: "#111827",
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#1e293b",
    },
    progressRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    progressText: {
        color: "#94a3b8",
        fontSize: 13,
    },
    rewardBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#14532d",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    rewardBadgeText: {
        color: "#4ade80",
        fontSize: 11,
        fontWeight: "700",
        marginLeft: 2,
    },
    progressBarTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: "#1e293b",
        overflow: "hidden",
    },
    progressBarFill: {
        height: "100%",
        borderRadius: 3,
    },
    questionCard: {
        backgroundColor: "#111827",
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#1e293b",
    },
    questionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    categoryBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    categoryBadgeText: {
        fontSize: 11,
        fontWeight: "700",
    },
    streakText: {
        color: "#facc15",
        fontWeight: "700",
        fontSize: 12,
    },
    questionTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#fff",
        lineHeight: 24,
    },
    optionsContainer: {
        marginBottom: 14,
    },
    optionCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111827",
        borderRadius: 14,
        padding: 14,
        marginVertical: 6,
        borderWidth: 1.5,
        borderColor: "#1e293b",
    },
    optionSelected: {
        borderColor: "#38bdf8",
        backgroundColor: "#0284c715",
    },
    optionCorrect: {
        borderColor: "#22c55e",
        backgroundColor: "#16a34a20",
    },
    optionWrong: {
        borderColor: "#ef4444",
        backgroundColor: "#dc262620",
    },
    optionLetterBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "#1e293b",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    letterCorrect: {
        backgroundColor: "#22c55e",
    },
    letterWrong: {
        backgroundColor: "#ef4444",
    },
    letterText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 14,
    },
    optionText: {
        flex: 1,
        color: "#e2e8f0",
        fontSize: 15,
        fontWeight: "500",
    },
    textCorrect: {
        color: "#4ade80",
        fontWeight: "700",
    },
    textWrong: {
        color: "#f87171",
        fontWeight: "600",
    },
    factCard: {
        backgroundColor: "#1e293b",
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: "#facc15",
    },
    factTitle: {
        color: "#facc15",
        fontWeight: "700",
        fontSize: 13,
        flex: 1,
    },
    factBadgeSuccess: {
        color: "#4ade80",
        fontWeight: "700",
        fontSize: 12,
        backgroundColor: "#14532d",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    factBadgeWrong: {
        color: "#f87171",
        fontWeight: "700",
        fontSize: 12,
        backgroundColor: "#7f1d1d",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    factText: {
        color: "#cbd5e1",
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 12,
    },
    nextBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        borderRadius: 12,
    },
    nextBtnText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 14,
    },
    allCategoriesSection: {
        marginTop: 10,
    },
    sectionHeading: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 12,
    },
    categoriesGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    gridCard: {
        width: (width - 42) / 2,
        backgroundColor: "#111827",
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#1e293b",
    },
    gridIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    gridCardTitle: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 13,
    },
    gridCardSub: {
        color: "#22c55e",
        fontSize: 11,
        marginTop: 3,
        fontWeight: "600",
    },
    bannerWrapper: {
        alignItems: "center",
        backgroundColor: "#0a0f1f",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalCard: {
        width: "100%",
        backgroundColor: "#111827",
        borderRadius: 22,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#1e293b",
    },
    modalTrophy: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    modalTitle: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "700",
    },
    modalSub: {
        color: "#94a3b8",
        fontSize: 14,
        marginTop: 4,
        marginBottom: 18,
    },
    statsRow: {
        flexDirection: "row",
        backgroundColor: "#1e293b",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 20,
        width: "100%",
        justifyContent: "space-around",
        alignItems: "center",
        marginBottom: 16,
    },
    statBox: {
        alignItems: "center",
    },
    statNumber: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
    },
    statLabel: {
        color: "#94a3b8",
        fontSize: 11,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: "#334155",
    },
    coinsCreditedNotice: {
        color: "#4ade80",
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 20,
        textAlign: "center",
    },
    modalBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        paddingVertical: 14,
        borderRadius: 14,
        marginBottom: 10,
    },
    modalBtnText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 15,
    },
    modalBtnAlt: {
        paddingVertical: 10,
    },
    modalBtnAltText: {
        color: "#94a3b8",
        fontSize: 14,
    },
});

