"use strict";
/* =========================================================
   ANALYSTIC — ACCESS SYSTEM + REAL MARKET ANALYZER
   ========================================================= */

/* =========================================================
   50 ACCESS CODES
   ========================================================= */
const accessCodes = [
    "60-27-31", "84-15-92", "37-61-04", "72-48-19", "25-93-67",
    "41-08-56", "96-32-75", "18-64-29", "53-07-81", "69-24-38",
    "12-85-47", "78-03-61", "45-92-16", "31-57-84", "87-26-40",
    "54-19-73", "06-48-95", "63-71-28", "29-84-53", "91-35-07",
    "46-12-89", "73-58-24", "15-69-42", "82-37-56", "38-94-10",
    "67-21-85", "04-76-39", "59-13-68", "27-80-41", "95-46-23",
    "34-72-09", "61-05-87", "88-43-16", "20-97-54", "76-31-82",
    "43-68-25", "09-52-74", "57-86-13", "24-39-91", "70-14-63",
    "11-47-82", "83-29-65", "36-75-18", "92-06-43", "48-51-27",
    "65-34-79", "17-83-52", "79-42-06", "52-68-31", "86-17-94"
];

/* =========================================================
   ACCESS SYSTEM
   ========================================================= */
const accessInput = document.getElementById("accessCode");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const loginContainer = document.querySelector(".login-container");
const mainApp = document.getElementById("mainApp");
const loadingScreen = document.getElementById("loadingScreen");

function showLoginMessage(message, type) {
    if (!loginMessage) {
        return;
    }
    loginMessage.textContent = message;
    loginMessage.className = "login-message " + type;
}

function login() {
    if (!accessInput) {
        return;
    }

    const enteredCode = accessInput.value.trim();

    if (enteredCode === "") {
        showLoginMessage("ENTER YOUR ACCESS CODE", "error");
        return;
    }

    const validCode = accessCodes.includes(enteredCode);

    if (!validCode) {
        showLoginMessage("ACCESS CODE NOT REGISTERED", "error");
        accessInput.value = "";
        accessInput.focus();
        return;
    }

    showLoginMessage("ACCESS GRANTED", "success");

    setTimeout(() => {
        if (loginContainer) {
            loginContainer.classList.add("hidden");
        }

        if (loadingScreen) {
            loadingScreen.classList.remove("hidden");
        }

        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.classList.add("hidden");
            }

            if (mainApp) {
                mainApp.classList.remove("hidden");
            }

            // Arranca el analizador SOLO después de un login válido
            initializeAnalyzer();
        }, 2500);
    }, 400);
}

if (loginButton) {
    loginButton.addEventListener("click", login);
}

if (accessInput) {
    accessInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            login();
        }
    });
}

const logoutButton = document.getElementById("logoutButton");

function logout() {
    // Si hay un análisis en curso, lo detenemos antes de salir
    if (typeof isAnalyzing !== "undefined" && isAnalyzing) {
        stopAnalysis();
    }

    if (mainApp) {
        mainApp.classList.add("hidden");
    }

    if (loadingScreen) {
        loadingScreen.classList.add("hidden");
    }

    if (loginContainer) {
        loginContainer.classList.remove("hidden");
    }

    if (accessInput) {
        accessInput.value = "";
        accessInput.focus();
    }

    showLoginMessage("", "");
}

if (logoutButton) {
    logoutButton.addEventListener("click", logout);
}


/* =========================================================
   ANALYSTIC — REAL MARKET ANALYZER
   (lógica intacta, tal como la enviaste)
   ========================================================= */

const DERIV_WS =
    "wss://api.derivws.com/trading/v1/options/ws/public";


/* =========================================================
   ELEMENTOS HTML
   ========================================================= */

const marketSelect = document.getElementById("market");
const strategySelect = document.getElementById("strategy");
const startBtn = document.getElementById("startBtn");

const marketTitle = document.getElementById("marketTitle");
const marketDisplay = document.getElementById("marketDisplay");
const strategyDisplay = document.getElementById("strategyDisplay");

const analysisStatus = document.getElementById("analysisStatus");
const statusDisplay = document.getElementById("statusDisplay");

const lastDigit = document.getElementById("lastDigit");
const tickDisplay = document.getElementById("tickDisplay");
const timeDisplay = document.getElementById("timeDisplay");

const digitBars = document.getElementById("digitBars");

const resultSection = document.getElementById("resultSection");
const recommendation = document.getElementById("recommendation");
const percentage = document.getElementById("percentage");
const resultTicks = document.getElementById("resultTicks");
const confidence = document.getElementById("confidence");
const resultMarket = document.getElementById("resultMarket");

const newAnalysis = document.getElementById("newAnalysis");

const canvas = document.getElementById("marketChart");
const ctx = canvas ? canvas.getContext("2d") : null;


/* =========================================================
   ESTADO
   ========================================================= */

let socket = null;

let activeSymbols = [];

let currentSymbol = null;
let previousSymbol = null;

let subscribed = false;

let isAnalyzing = false;

let analysisDigits = [];
let analysisTickCount = 0;

let chartPrices = [];

let analysisStartTime = null;
let timerInterval = null;

let renderPending = false;

let finalResult = null;


/* =========================================================
   MERCADOS
   ========================================================= */

const marketNames = {
    vol10: "Volatility 10 (1s)",
    vol25: "Volatility 25 (1s)",
    vol50: "Volatility 50 (1s)",
    vol75: "Volatility 75 (1s)",
    vol100: "Volatility 100 (1s)"
};


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(text) {
    if (analysisStatus) {
        analysisStatus.textContent = text;
    }
    if (statusDisplay) {
        statusDisplay.textContent = text;
    }
}


/* =========================================================
   MERCADO SELECCIONADO
   ========================================================= */

function getSelectedMarket() {
    const value = marketSelect.value;
    return marketNames[value] || value;
}


/* =========================================================
   ESTRATEGIA
   ========================================================= */

function getSelectedStrategy() {
    return strategySelect.options[strategySelect.selectedIndex].text;
}


/* =========================================================
   INFORMACIÓN
   ========================================================= */

function updateMarketInformation() {
    const market = getSelectedMarket();
    const strategy = getSelectedStrategy();

    if (marketTitle) {
        marketTitle.textContent = market;
    }
    if (marketDisplay) {
        marketDisplay.textContent = market;
    }
    if (strategyDisplay) {
        strategyDisplay.textContent = strategy;
    }
}


/* =========================================================
   CONEXIÓN
   ========================================================= */

function connectToDeriv() {
    return new Promise((resolve, reject) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            resolve();
            return;
        }

        setStatus("CONNECTING");

        try {
            socket = new WebSocket(DERIV_WS);
        } catch (error) {
            reject(error);
            return;
        }

        socket.onopen = () => {
            console.log("Connected to Deriv");
            setStatus("CONNECTED");

            socket.send(JSON.stringify({
                active_symbols: "brief",
                req_id: 1
            }));

            resolve();
        };

        socket.onmessage = event => {
            handleMessage(event);
        };

        socket.onerror = error => {
            console.error("WebSocket error:", error);
            setStatus("CONNECTION ERROR");
        };

        socket.onclose = () => {
            console.log("WebSocket closed");
            subscribed = false;
        };
    });
}


/* =========================================================
   MENSAJES
   ========================================================= */

function handleMessage(event) {
    let data;

    try {
        data = JSON.parse(event.data);
    } catch {
        return;
    }

    if (data.error) {
        console.error("Deriv error:", data.error);
        setStatus("API ERROR");
        return;
    }

    if (data.msg_type === "active_symbols") {
        handleActiveSymbols(data.active_symbols || []);
        return;
    }

    if (data.msg_type === "history") {
        handleHistory(data);
        return;
    }

    if (data.msg_type === "tick") {
        handleTick(data.tick);
        return;
    }
}


/* =========================================================
   BUSCAR SÍMBOLO REAL
   ========================================================= */

function findMarketSymbol() {
    const selected = marketSelect.value;

    const match = selected.match(/\d+/);

    if (!match) {
        return null;
    }

    const number = match[0];

    let found = activeSymbols.find(item => {
        const name = String(item.underlying_symbol_name || "").toLowerCase();
        return name.includes("volatility") && name.includes(number);
    });

    return found || null;
}


/* =========================================================
   MERCADOS ACTIVOS
   ========================================================= */

function handleActiveSymbols(symbols) {
    activeSymbols = symbols;

    const market = findMarketSymbol();

    if (!market) {
        console.error("Market not found:", getSelectedMarket());
        setStatus("MARKET NOT FOUND");
        return;
    }

    const newSymbol = market.underlying_symbol;

    if (previousSymbol && previousSymbol !== newSymbol) {
        unsubscribeFromSymbol(previousSymbol);
    }

    currentSymbol = newSymbol;
    previousSymbol = newSymbol;

    console.log("Selected market:", getSelectedMarket());
    console.log("Real symbol:", currentSymbol);

    chartPrices = [];

    if (lastDigit) {
        lastDigit.textContent = "—";
    }

    markChartUpdate();

    requestHistory();

    subscribeToCurrentSymbol();
}


/* =========================================================
   DESUSCRIBIR MERCADO ANTERIOR
   ========================================================= */

function unsubscribeFromSymbol(symbol) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !symbol) {
        return;
    }

    console.log("Unsubscribing:", symbol);

    socket.send(JSON.stringify({
        forget_all: "ticks",
        req_id: 10
    }));

    subscribed = false;
}


/* =========================================================
   HISTORIAL
   ========================================================= */

function requestHistory() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentSymbol) {
        return;
    }

    console.log("Requesting history:", currentSymbol);

    socket.send(JSON.stringify({
        ticks_history: currentSymbol,
        count: 100,
        end: "latest",
        style: "ticks",
        req_id: 20
    }));
}


/* =========================================================
   SUSCRIPCIÓN
   ========================================================= */

function subscribeToCurrentSymbol() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentSymbol) {
        return;
    }

    console.log("Subscribing:", currentSymbol);

    socket.send(JSON.stringify({
        ticks: currentSymbol,
        subscribe: 1,
        req_id: 30
    }));

    subscribed = true;

    setStatus(isAnalyzing ? "ANALYZING" : "LIVE MARKET");
}


/* =========================================================
   HISTORIAL RECIBIDO
   ========================================================= */

function handleHistory(data) {
    if (!data.history || !data.history.prices) {
        return;
    }

    chartPrices = [];

    data.history.prices.forEach(price => {
        const value = Number(price);
        if (Number.isFinite(value)) {
            chartPrices.push(value);
        }
    });

    chartPrices = chartPrices.slice(-150);

    markChartUpdate();
}


/* =========================================================
   TICK REAL
   ========================================================= */

function handleTick(tick) {
    if (!tick) {
        return;
    }

    if (tick.symbol && currentSymbol && tick.symbol !== currentSymbol) {
        return;
    }

    const price = Number(tick.quote);

    if (!Number.isFinite(price)) {
        return;
    }

    chartPrices.push(price);

    if (chartPrices.length > 150) {
        chartPrices.shift();
    }

    if (lastDigit) {
        lastDigit.textContent = getLastDigit(price);
    }

    markChartUpdate();

    if (!isAnalyzing) {
        return;
    }

    const digit = getLastDigit(price);

    analysisDigits.push(digit);
    analysisTickCount++;

    if (tickDisplay) {
        tickDisplay.textContent = analysisTickCount;
    }

    updateDigitDistribution();
}


/* =========================================================
   ÚLTIMO DÍGITO
   ========================================================= */

function getLastDigit(price) {
    const text = String(price);
    const clean = text.replace(/[^0-9]/g, "");

    if (!clean) {
        return 0;
    }

    return Number(clean[clean.length - 1]);
}


/* =========================================================
   DISTRIBUCIÓN
   ========================================================= */

function updateDigitDistribution() {
    if (!digitBars) {
        return;
    }

    const counts = Array(10).fill(0);

    analysisDigits.forEach(digit => {
        counts[digit]++;
    });

    const total = analysisDigits.length;

    digitBars.innerHTML = "";

    for (let digit = 0; digit <= 9; digit++) {
        const percent = total > 0 ? (counts[digit] / total) * 100 : 0;

        const row = document.createElement("div");
        row.className = "digit-row";

        row.innerHTML = `
            <div class="digit-number">${digit}</div>
            <div class="digit-track">
                <div class="digit-fill" style="width:${percent.toFixed(2)}%"></div>
            </div>
            <div class="digit-value">${percent.toFixed(2)}%</div>
        `;

        digitBars.appendChild(row);
    }
}


/* =========================================================
   CANVAS
   ========================================================= */

function resizeCanvas() {
    if (!canvas || !ctx) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    markChartUpdate();
}


/* =========================================================
   ACTUALIZAR GRÁFICA
   ========================================================= */

function markChartUpdate() {
    if (renderPending) {
        return;
    }

    renderPending = true;

    requestAnimationFrame(() => {
        renderPending = false;
        drawChart();
    });
}


/* =========================================================
   DIBUJAR GRÁFICA
   ========================================================= */

function drawChart() {
    if (!canvas || !ctx) {
        return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width <= 0 || height <= 0) {
        return;
    }

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    if (chartPrices.length < 2) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Waiting for real market ticks...", width / 2, height / 2);
        return;
    }

    const data = chartPrices.slice(-100);

    let min = Math.min(...data);
    let max = Math.max(...data);

    if (min === max) {
        min -= 0.0001;
        max += 0.0001;
    }

    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - min) / (max - min);
        const x = padding + (i / (data.length - 1)) * chartWidth;
        const y = height - padding - (normalized * chartHeight);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.strokeStyle = "#4da3ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    const lastIndex = data.length - 1;
    const normalized = (data[lastIndex] - min) / (max - min);
    const x = padding + chartWidth;
    const y = height - padding - (normalized * chartHeight);

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
}


/* =========================================================
   TIMER
   ========================================================= */

function startTimer() {
    stopTimer();

    analysisStartTime = Date.now();

    timerInterval = setInterval(() => {
        if (!isAnalyzing) {
            return;
        }

        const elapsed = Math.floor((Date.now() - analysisStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;

        if (timeDisplay) {
            timeDisplay.textContent =
                String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
        }
    }, 1000);
}


/* =========================================================
   STOP TIMER
   ========================================================= */

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}


/* =========================================================
   START / STOP
   ========================================================= */

async function startAnalysis() {
    if (isAnalyzing) {
        stopAnalysis();
        return;
    }

    analysisDigits = [];
    analysisTickCount = 0;
    finalResult = null;

    if (tickDisplay) {
        tickDisplay.textContent = "0";
    }

    if (timeDisplay) {
        timeDisplay.textContent = "00:00";
    }

    if (resultSection) {
        resultSection.classList.add("hidden");
    }

    updateDigitDistribution();

    isAnalyzing = true;

    startBtn.textContent = "STOP ANALYSIS";

    setStatus("ANALYZING");

    startTimer();

    try {
        await connectToDeriv();
    } catch (error) {
        console.error(error);

        isAnalyzing = false;
        stopTimer();

        startBtn.textContent = "START ANALYSIS";

        setStatus("CONNECTION ERROR");
    }
}


/* =========================================================
   STOP ANALYSIS
   ========================================================= */

function stopAnalysis() {
    isAnalyzing = false;

    stopTimer();

    startBtn.textContent = "START ANALYSIS";

    setStatus("ANALYSIS STOPPED");

    generateFinalResult();
}


/* =========================================================
   RESULTADO
   ========================================================= */

function generateFinalResult() {
    const total = analysisDigits.length;

    if (total === 0) {
        if (recommendation) {
            recommendation.textContent = "NO DATA";
        }
        if (percentage) {
            percentage.textContent = "0%";
        }
        if (resultTicks) {
            resultTicks.textContent = "0";
        }
        if (confidence) {
            confidence.textContent = "LOW";
        }
        if (resultMarket) {
            resultMarket.textContent = getSelectedMarket();
        }
        if (resultSection) {
            resultSection.classList.remove("hidden");
        }

        return;
    }

    const counts = Array(10).fill(0);

    analysisDigits.forEach(digit => {
        counts[digit]++;
    });

    const strategy = strategySelect.value;

    let resultText = "—";
    let resultPercentage = 0;

    if (strategy === "matches") {
        let bestDigit = 0;

        for (let i = 1; i <= 9; i++) {
            if (counts[i] > counts[bestDigit]) {
                bestDigit = i;
            }
        }

        resultText = `MATCH ${bestDigit}`;
        resultPercentage = (counts[bestDigit] / total) * 100;
    }

    if (strategy === "evenodd") {
        let even = 0;
        let odd = 0;

        analysisDigits.forEach(digit => {
            if (digit % 2 === 0) {
                even++;
            } else {
                odd++;
            }
        });

        if (even >= odd) {
            resultText = "EVEN";
            resultPercentage = (even / total) * 100;
        } else {
            resultText = "ODD";
            resultPercentage = (odd / total) * 100;
        }
    }

    if (strategy === "overunder") {
        let over = 0;
        let under = 0;

        analysisDigits.forEach(digit => {
            if (digit >= 5) {
                over++;
            } else {
                under++;
            }
        });

        if (over >= under) {
            resultText = "OVER 4";
            resultPercentage = (over / total) * 100;
        } else {
            resultText = "UNDER 5";
            resultPercentage = (under / total) * 100;
        }
    }

    let confidenceText = "LOW";

    if (resultPercentage >= 15) {
        confidenceText = "MEDIUM";
    }

    if (resultPercentage >= 20) {
        confidenceText = "HIGH";
    }

    finalResult = {
        recommendation: resultText,
        percentage: resultPercentage,
        ticks: total,
        confidence: confidenceText,
        market: getSelectedMarket()
    };

    if (recommendation) {
        recommendation.textContent = finalResult.recommendation;
    }

    if (percentage) {
        percentage.textContent = finalResult.percentage.toFixed(2) + "%";
    }

    if (resultTicks) {
        resultTicks.textContent = finalResult.ticks;
    }

    if (confidence) {
        confidence.textContent = finalResult.confidence;
    }

    if (resultMarket) {
        resultMarket.textContent = finalResult.market;
    }

    if (resultSection) {
        resultSection.classList.remove("hidden");
    }

    console.log("FINAL ANALYSIS:", finalResult);
}


/* =========================================================
   CAMBIO DE MERCADO
   ========================================================= */

async function changeMarket() {
    if (isAnalyzing) {
        marketSelect.value = marketSelect.dataset.previous || marketSelect.value;

        alert("Primero detén el análisis antes de cambiar de mercado.");

        return;
    }

    marketSelect.dataset.previous = marketSelect.value;

    analysisDigits = [];
    analysisTickCount = 0;
    finalResult = null;

    if (tickDisplay) {
        tickDisplay.textContent = "0";
    }

    if (timeDisplay) {
        timeDisplay.textContent = "00:00";
    }

    if (resultSection) {
        resultSection.classList.add("hidden");
    }

    updateDigitDistribution();

    updateMarketInformation();

    chartPrices = [];

    if (lastDigit) {
        lastDigit.textContent = "—";
    }

    markChartUpdate();

    setStatus("LOADING MARKET");

    try {
        await connectToDeriv();

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                active_symbols: "brief",
                req_id: 100
            }));
        }
    } catch (error) {
        console.error(error);

        setStatus("CONNECTION ERROR");
    }
}


/* =========================================================
   NUEVO ANÁLISIS
   ========================================================= */

function resetAnalysis() {
    isAnalyzing = false;
    stopTimer();

    analysisDigits = [];
    analysisTickCount = 0;
    finalResult = null;

    if (tickDisplay) {
        tickDisplay.textContent = "0";
    }

    if (timeDisplay) {
        timeDisplay.textContent = "00:00";
    }

    if (resultSection) {
        resultSection.classList.add("hidden");
    }

    updateDigitDistribution();

    startBtn.textContent = "START ANALYSIS";

    setStatus("READY");
}


/* =========================================================
   EVENTOS
   ========================================================= */

marketSelect.addEventListener("change", changeMarket);

strategySelect.addEventListener("change", () => {
    if (isAnalyzing) {
        alert("Detén el análisis antes de cambiar de estrategia.");
        return;
    }

    updateMarketInformation();
});

startBtn.addEventListener("click", startAnalysis);

if (newAnalysis) {
    newAnalysis.addEventListener("click", resetAnalysis);
}

window.addEventListener("resize", resizeCanvas);


/* =========================================================
   INICIO DEL ANALIZADOR
   (se ejecuta SOLO cuando login() lo llama tras un
   código de acceso válido — ya no se auto-ejecuta al cargar)
   ========================================================= */

function initializeAnalyzer() {
    updateMarketInformation();

    setStatus("READY");

    resizeCanvas();

    updateDigitDistribution();

    if (marketSelect) {
        marketSelect.dataset.previous = marketSelect.value;
    }

    console.log("ANALYSTIC INITIALIZED");
}
