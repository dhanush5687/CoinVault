import database from "@react-native-firebase/database";
import axios from "axios";

/**
 * Decode HTML entities commonly returned by quiz APIs like OpenTDB
 */
export function decodeHtmlEntities(str) {
    if (!str || typeof str !== "string") return str || "";
    return str
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&eacute;/g, "é")
        .replace(/&deg;/g, "°")
        .replace(/&shy;/g, "")
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}

/**
 * Fetch and parse questions from any external quiz API
 * Supports Open Trivia DB ({ results: [...] }) and generic JSON formats
 */
export async function fetchQuestionsFromApi(apiUrl) {
    if (!apiUrl || typeof apiUrl !== "string" || !apiUrl.trim()) {
        return null;
    }

    try {
        const cleanUrl = apiUrl.trim();
        const response = await axios.get(cleanUrl, { timeout: 8000 });
        const data = response.data;

        if (!data) return null;

        // Format 1: OpenTDB format { response_code: 0, results: [...] }
        if (Array.isArray(data.results) && data.results.length > 0) {
            return data.results.map((item, idx) => {
                const correctAnswer = decodeHtmlEntities(item.correct_answer || "");
                const incorrectAnswers = Array.isArray(item.incorrect_answers)
                    ? item.incorrect_answers.map(decodeHtmlEntities)
                    : [];

                // Combine and shuffle options
                const allOptions = [...incorrectAnswers, correctAnswer].sort(() => Math.random() - 0.5);
                const correctIndex = allOptions.indexOf(correctAnswer);

                return {
                    id: `api_opentdb_${idx}_${Date.now()}`,
                    question: decodeHtmlEntities(item.question || ""),
                    options: allOptions,
                    correctIndex: correctIndex >= 0 ? correctIndex : 0,
                    fact: `Category: ${decodeHtmlEntities(item.category || "General")} • Difficulty: ${item.difficulty || "Standard"}`,
                    source: "api",
                };
            });
        }

        // Format 2: Array format [ { question, options, correctIndex, fact } ]
        const list = Array.isArray(data) ? data : data.questions;
        if (Array.isArray(list) && list.length > 0) {
            return list.map((item, idx) => {
                let options = item.options || item.answers || [];
                let correctIndex = typeof item.correctIndex === "number" ? item.correctIndex : 0;

                // If options is object or string
                if (!Array.isArray(options) && typeof options === "object") {
                    options = Object.values(options);
                }

                return {
                    id: item.id || `api_custom_${idx}_${Date.now()}`,
                    question: decodeHtmlEntities(item.question || item.title || "Question"),
                    options: options.map((opt) => decodeHtmlEntities(String(opt))),
                    correctIndex: Math.min(Math.max(0, correctIndex), options.length - 1),
                    fact: decodeHtmlEntities(item.fact || item.explanation || "Scientific Trivia Fact"),
                    source: "api",
                };
            });
        }

        return null;
    } catch (error) {
        console.warn("Quiz API fetch error:", error?.message || error);
        return null;
    }
}

/**
 * Open Trivia DB Category Mapping
 * Maps in-app categories to OpenTDB category IDs (https://opentdb.com/api_config.php)
 */
export const OPENTDB_CATEGORY_MAP = {
    genetics: 17, // Science & Nature
    anatomy: 17,  // Science & Nature
    cellbio: 17,  // Science & Nature
    botany: 17,   // Science & Nature
    zoology: 27,  // Animals
    ecology: 17,  // Science & Nature
    general: 9,   // General Knowledge
    computers: 18,// Science: Computers
    all: null,    // Any Category
};

/**
 * Directly fetch live questions from Open Trivia DB API
 */
export async function fetchOpenTdbQuestions(categoryId = "all", amount = 10) {
    let url = `https://opentdb.com/api.php?amount=${amount}&type=multiple`;
    const openTdbCat = OPENTDB_CATEGORY_MAP[categoryId];
    if (openTdbCat) {
        url += `&category=${openTdbCat}`;
    }

    try {
        const questions = await fetchQuestionsFromApi(url);
        if (questions && questions.length > 0) {
            return questions;
        }
    } catch (e) {
        console.warn("fetchOpenTdbQuestions error:", e);
    }
    return null;
}

/**
 * Fetch Quiz Configuration from Firebase Realtime Database
 */
export async function getQuizConfig() {
    try {
        const snap = await database().ref("/quizConfig").once("value");
        if (snap.exists()) {
            const val = snap.val();
            return {
                apiUrl: val.apiUrl || "",
                useApi: !!val.useApi,
                rewardPoints: typeof val.rewardPoints === "number" ? val.rewardPoints : 1,
                penaltyPoints: typeof val.penaltyPoints === "number" ? val.penaltyPoints : 1,
            };
        }
    } catch (e) {
        console.warn("getQuizConfig error:", e.message);
    }

    return {
        apiUrl: "",
        useApi: false,
        rewardPoints: 1,
        penaltyPoints: 1,
    };
}

/**
 * Save Quiz Configuration to Firebase Realtime Database (Admin Control)
 */
export async function saveQuizConfig(config) {
    try {
        await database().ref("/quizConfig").update({
            apiUrl: config.apiUrl || "",
            useApi: !!config.useApi,
            rewardPoints: parseInt(config.rewardPoints, 10) || 1,
            penaltyPoints: parseInt(config.penaltyPoints, 10) || 1,
            lastUpdated: Date.now(),
        });
        return { success: true };
    } catch (e) {
        console.error("saveQuizConfig error:", e);
        return { success: false, error: e.message };
    }
}

