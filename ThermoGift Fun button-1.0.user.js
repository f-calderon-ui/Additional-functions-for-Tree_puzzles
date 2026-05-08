// ==UserScript==
// @name         ThermoGift Fun button
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Botón "Fun":  "make apples grow" on trees (to mark them), also, on 0 files/rows, there's water and tents float, and finally, I implemented a chill OST.
// @match        https://lexaire.github.io/ThermoGift/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // =====================================================
    // CONFIGURACIÓN MUSICAL
    // =====================================================
    const TEMPO = 84;
    const NEGRA = 60 / TEMPO;
    const COMPAS = 4 * NEGRA;

    // ========== ESTILOS ==========
    GM_addStyle(`
        .plus-fun-btn {
            background-color: #4a6a8b;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 6px 12px;
            margin-left: 8px;
            cursor: pointer;
            font-weight: bold;
            font-family: monospace;
            font-size: 1.1em;
            transition: 0.2s;
        }
        .plus-fun-btn.active {
            background-color: #2c5e2e;
            box-shadow: 0 0 0 2px #a0d6a0;
        }
        .mute-btn {
            background: none;
            border: 1px solid #4a6a8b;
            border-radius: 8px;
            padding: 4px 8px;
            margin-left: 4px;
            cursor: pointer;
            font-size: 1.2em;
            transition: 0.2s;
        }
        .confetti-particle {
            position: fixed;
            width: 8px;
            height: 8px;
            pointer-events: none;
            z-index: 99999;
        }
    `);

    // ========== SVG DE ÁRBOL CON MANZANAS (gradiente) ==========
    const APPLE_TREE_SVG = `<svg class="cell-icon" viewBox="0 0 48 48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="appleGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="15%">
        <stop offset="0%" style="stop-color:rgb(255,50,50);stop-opacity:1" />
        <stop offset="60%" style="stop-color:rgb(220,0,0);stop-opacity:1" />
        <stop offset="100%" style="stop-color:rgb(160,0,0);stop-opacity:1" />
      </radialGradient>
    </defs>
    <ellipse class="tree-shadow" cx="24" cy="42" rx="10" ry="3" fill="#D5E8D4" opacity="0.5"></ellipse>
    <rect class="tree-trunk" x="21" y="26" width="6" height="14" rx="2" fill="#795548"></rect>
    <polygon class="tree-foliage tree-foliage-dark" points="24,18 38,32 10,32" fill="#2E7D32"></polygon>
    <polygon class="tree-foliage tree-foliage-mid" points="24,10 34,24 14,24" fill="#388E3C"></polygon>
    <polygon class="tree-foliage tree-foliage-light" points="24,3 30,16 18,16" fill="#43A047"></polygon>
    <circle cx="24" cy="14" r="3.5" fill="url(#appleGradient)"></circle>
    <circle cx="19" cy="25" r="3.3" fill="url(#appleGradient)"></circle>
    <circle cx="29" cy="25" r="3.3" fill="url(#appleGradient)"></circle>
  </svg>`;

    const FLOATING_TENT_SVG = `<svg class="cell-icon floating-tent-raft" viewBox="0 0 48 48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <g class="tent-pontoon">
      <rect x="0" y="30" width="48" height="4" fill="#D2B48C"></rect> <rect x="0" y="34" width="48" height="4" fill="#D2B48C"></rect> <rect x="0" y="38" width="48" height="4" fill="#D2B48C"></rect> <rect x="0" y="42" width="48" height="4" fill="#D2B48C"></rect> <line x1="0" y1="34" x2="48" y2="34" stroke="#8B4513" stroke-width="0.7"></line>
      <line x1="0" y1="38" x2="48" y2="38" stroke="#8B4513" stroke-width="0.7"></line>
      <line x1="0" y1="42" x2="48" y2="42" stroke="#8B4513" stroke-width="0.7"></line>
    </g>
    <g class="tent-structure">
      <polygon class="tent-left" points="24,5 24,38 6,38" fill="#FBBF24"></polygon>
      <polygon class="tent-right" points="24,5 24,38 42,38" fill="#D97706"></polygon>
      <polygon class="tent-entrance" points="24,18 32,38 16,38" fill="white" stroke="black" stroke-width="1.2"></polygon>
      <polygon class="tent-outline" points="24,5 42,38 6,38" fill="none" stroke="black" stroke-width="1.8"></polygon>
      <line class="tent-ridge" x1="24" y1="5" x2="24" y2="38" stroke="black" stroke-width="1.8"></line>
    </g>
    <g class="tent-oar">
      <rect x="4" y="32" width="2.5" height="12" fill="#CD853F"></rect> <polygon points="1.5,44 9,44 6,52 3,52" fill="#8B4513"></polygon> </g>
  </svg>`;

    // ========== VARIABLES ==========
    let funMode = false;
    let button = null;
    let muteButton = null;
    let isMuted = false;

    const appleTreeSet = new Set();  // coordenadas "row,col" de árboles con manzanas
    const floatingTentSet = new Set(); // coordenadas "row,col" de tiendas flotantes

    // VARIABLES DE AUDIO
    let audioContext = null;
    let masterGain = null;
    let reverbGain = null;
    let delayNode = null;
    let isPlaying = false;
    let playbackSessionId = 0;
    let loopInterval = null;

    const PROGRESION = [
        { notas: [261.63, 329.63, 392.00, 493.88] }, // Cmaj7
        { notas: [196.00, 246.94, 293.66, 392.00] }, // G
        { notas: [220.00, 261.63, 329.63, 392.00] }, // Am7
        { notas: [174.61, 220.00, 261.63, 349.23] }, // Fmaj7
        { notas: [261.63, 329.63, 392.00, 523.25] }, // C
        { notas: [164.81, 246.94, 329.63, 440.00] }, // Em7
        { notas: [174.61, 261.63, 349.23, 440.00] }, // F
        { notas: [196.00, 293.66, 392.00, 440.00] }, // G
        { notas: [220.00, 261.63, 329.63, 392.00] }, // Am7
        { notas: [164.81, 246.94, 329.63, 392.00] }, // Em7
        { notas: [174.61, 220.00, 261.63, 329.63] }, // Fmaj7
        { notas: [261.63, 329.63, 392.00, 493.88] }, // Cmaj7
        { notas: [146.83, 220.00, 293.66, 349.23] }, // Dm7
        { notas: [196.00, 246.94, 293.66, 440.00] }, // G7
        { notas: [261.63, 329.63, 392.00, 523.25] }, // C
        { notas: [196.00, 261.63, 293.66, 392.00] }  // Gsus4
    ];

    const MELODIA = [
        { f: 392.00, t: 0.0, d: 0.5 }, { f: 523.25, t: 1.0, d: 0.5 }, { f: 493.88, t: 2.0, d: 1.0 },
        { f: 392.00, t: 4.0, d: 0.5 }, { f: 440.00, t: 5.0, d: 0.5 }, { f: 349.23, t: 6.0, d: 1.0 },
        { f: 329.63, t: 8.0, d: 0.5 }, { f: 392.00, t: 9.0, d: 0.5 }, { f: 523.25, t: 10.0, d: 0.5 }, { f: 587.33, t: 11.0, d: 0.5 },
        { f: 659.25, t: 12.0, d: 1.0 }, { f: 587.33, t: 14.0, d: 1.5 },

        { f: 440.00, t: 16.0, d: 0.5 }, { f: 523.25, t: 17.0, d: 0.5 }, { f: 659.25, t: 18.0, d: 1.0 },
        { f: 587.33, t: 20.0, d: 0.5 }, { f: 523.25, t: 21.0, d: 0.5 }, { f: 493.88, t: 22.0, d: 1.0 },
        { f: 440.00, t: 24.0, d: 0.5 }, { f: 392.00, t: 25.0, d: 0.5 }, { f: 440.00, t: 26.0, d: 0.5 }, { f: 493.88, t: 27.0, d: 0.5 },
        { f: 523.25, t: 28.0, d: 2.0 },

        { f: 783.99, t: 32.0, d: 0.5 }, { f: 698.46, t: 33.0, d: 0.5 }, { f: 659.25, t: 34.0, d: 1.0 },
        { f: 523.25, t: 36.0, d: 0.5 }, { f: 587.33, t: 37.0, d: 0.5 }, { f: 493.88, t: 38.0, d: 1.0 },
        { f: 440.00, t: 40.0, d: 1.0 }, { f: 493.88, t: 42.0, d: 1.0 }, { f: 523.25, t: 44.0, d: 4.0 }
    ];

    const BAJO = [
        130.81, 98.00, 110.00, 87.31, 130.81, 82.41, 87.31, 98.00,
        110.00, 82.41, 87.31, 130.81, 73.42, 98.00, 130.81, 98.00
    ];

    // ========== FUNCIONES DE AUDIO ==========
    function initAudio() {
        if (audioContext && audioContext.state !== 'closed') return;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.5;
        delayNode = audioContext.createDelay();
        delayNode.delayTime.value = 0.18;
        reverbGain = audioContext.createGain();
        reverbGain.gain.value = 0.15;
        delayNode.connect(reverbGain);
        reverbGain.connect(masterGain);
        masterGain.connect(audioContext.destination);
    }

    function playNote(freq, start, duration, type = 'triangle', volume = 0.1) {
        if (!audioContext || isMuted) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2200;
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        gain.connect(delayNode);
        const s = start + ((Math.random() - 0.5) * 0.015);
        gain.gain.setValueAtTime(0.0001, s);
        gain.gain.linearRampToValueAtTime(volume, s + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, s + duration);
        osc.start(s);
        osc.stop(s + duration + 0.1);
    }

    function playCycle() {
        if (!audioContext || isMuted) return;
        const now = audioContext.currentTime + 0.05;
        PROGRESION.forEach((acorde, compas) => {
            const start = now + compas * COMPAS;
            acorde.notas.forEach((f, i) => playNote(f, start + i * 0.03, COMPAS, 'triangle', 0.035));
            const patron = [0, 1, 2, 1, 2, 3, 2, 1];
            patron.forEach((idx, step) => {
                playNote(acorde.notas[idx], start + (step * NEGRA * 0.5), NEGRA * 0.45, 'triangle', 0.045);
            });
            playNote(BAJO[compas], start, COMPAS, 'triangle', 0.08);
        });
        MELODIA.forEach(nota => {
            playNote(nota.f, now + nota.t * NEGRA, nota.d * NEGRA, 'sine', 0.10);
        });
        // Percusión más animada
        for (let i = 0; i < PROGRESION.length * 4; i++) {
            const time = now + i * NEGRA;
            const isDownbeat = i % 4 === 0;
            const isOffbeat = i % 4 === 2;

            if (isDownbeat || isOffbeat) {
                const osc = audioContext.createOscillator();
                const g = audioContext.createGain();
                osc.frequency.setValueAtTime(isDownbeat ? 60 : 80, time);
                osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
                g.gain.setValueAtTime(0.1, time);
                g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
                osc.connect(g);
                g.connect(masterGain);
                osc.start(time);
                osc.stop(time + 0.1);
            }

            // Hi-hats suaves
            playNote(8000, time + NEGRA * 0.5, 0.02, 'sine', 0.005);
        }
    }

    async function startMusic() {
        const sessionId = ++playbackSessionId;

        // Si ya está sonando, detenemos todo para reiniciar desde cero
        stopMusic();

        if (isMuted || !funMode) return;

        isPlaying = true;
        initAudio();
        if (audioContext.state === 'suspended') await audioContext.resume();

        // Si durante la espera el usuario desactivó el modo o inició una nueva sesión, abortamos
        if (sessionId !== playbackSessionId || !funMode || isMuted) {
            isPlaying = false;
            return;
        }

        playCycle();
        const totalDuration = PROGRESION.length * COMPAS * 1000;
        loopInterval = setInterval(() => {
            if (isPlaying && !isMuted && sessionId === playbackSessionId) {
                playCycle();
            } else {
                clearInterval(loopInterval);
            }
        }, totalDuration);
    }

    function stopMusic() {
        isPlaying = false;
        if (loopInterval) {
            clearInterval(loopInterval);
            loopInterval = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
            // Cerrar el contexto cancela todos los sonidos programados y libera recursos
            audioContext.close().catch(console.warn);
        }
        audioContext = null;
        masterGain = null;
        delayNode = null;
        reverbGain = null;
    }

    function toggleMute() {
        isMuted = !isMuted;
        muteButton.textContent = isMuted ? '🔇' : '🔊';
        if (isMuted) {
            stopMusic();
        } else if (funMode) {
            startMusic();
        }
    }

    // ========== FUNCIONES PARA ÁRBOLES ==========
    function getCoordKey(cell) {
        const label = cell.getAttribute('aria-label');
        if (!label) return null;
        const match = label.match(/Row (\d+), column (\d+)/i);
        return match ? `${match[1]},${match[2]}` : null;
    }

    // Guarda el SVG original del árbol (la primera vez)
    function getOriginalSVG(cell) {
        if (cell._originalSVG) return cell._originalSVG;
        const svg = cell.querySelector('svg');
        if (svg) {
            cell._originalSVG = svg.cloneNode(true);
            return cell._originalSVG;
        }
        return null;
    }

    // Aplica el estado "con manzanas" o "sin manzanas"
    function applyAppleState(cell) {
        const key = getCoordKey(cell);
        if (!key) return;
        const shouldHaveApples = funMode && appleTreeSet.has(key) && cell.classList.contains('tree-cell');
        const currentSvg = cell.querySelector('svg');
        if (!currentSvg) return;

        if (shouldHaveApples) {
            // Evitar re-procesar si ya tiene el degradado de manzana
            if (currentSvg.querySelector('radialGradient#appleGradient')) return;

            // Guardar el SVG original antes de reemplazarlo por primera vez
            getOriginalSVG(cell);

            // Reemplazar con el SVG de manzanas (con gradiente)
            const parser = new DOMParser();
            const doc = parser.parseFromString(APPLE_TREE_SVG, 'image/svg+xml');
            const appleSvg = doc.documentElement;
            // Copiar atributos importantes (class, etc.)
            appleSvg.setAttribute('class', currentSvg.getAttribute('class') || 'cell-icon');
            currentSvg.replaceWith(appleSvg);
        } else {
            if (!cell._originalSVG) return;
            // Restaurar si tiene manzanas pero no debería
            if (currentSvg.querySelector('radialGradient#appleGradient')) {
            const original = getOriginalSVG(cell);
            if (original) {
                currentSvg.replaceWith(original.cloneNode(true));
            }
            }
        }
    }

    function applyFloatingTentState(cell) {
        const key = getCoordKey(cell);
        if (!key) return;
        // Se activa si está en el set manual O si es una tienda del juego en zona de lago
        const shouldHaveTent = funMode && cellShouldHaveLake(cell) && (floatingTentSet.has(key) || cell.classList.contains('tent-cell'));
        const currentSvg = cell.querySelector('svg');

        if (shouldHaveTent) {
            // Evitar re-procesar si ya es la balsa
            if (currentSvg && currentSvg.classList.contains('floating-tent-raft')) return;

            // Guardar el SVG original antes de reemplazarlo por primera vez
            getOriginalSVG(cell);

            const parser = new DOMParser();
            const doc = parser.parseFromString(FLOATING_TENT_SVG, 'image/svg+xml');
            const tentSvg = doc.documentElement;
            if (currentSvg) {
                currentSvg.replaceWith(tentSvg);
            } else {
                cell.appendChild(tentSvg);
            }
        } else {
            // Si no debe haber balsa pero el SVG actual es el de la balsa, intentamos restaurar el original
            if (currentSvg && currentSvg.classList.contains('floating-tent-raft')) {
                const original = getOriginalSVG(cell);
                if (original) {
                    currentSvg.replaceWith(original.cloneNode(true));
                } else {
                    currentSvg.remove();
                }
            }
        }
    }

    function toggleApple(cell) {
        const key = getCoordKey(cell);
        if (!key) return;
        if (appleTreeSet.has(key)) {
            appleTreeSet.delete(key);
        } else {
            appleTreeSet.add(key);
        }
        applyAppleState(cell);
    }

    function toggleFloatingTent(cell) {
        const key = getCoordKey(cell);
        if (!key) return;
        if (floatingTentSet.has(key)) {
            floatingTentSet.delete(key);
        } else {
            floatingTentSet.add(key);
        }
        applyFloatingTentState(cell);
    }

    function onCellClick(e) {
        if (!funMode) return;
        const cell = e.currentTarget;
        if (cell.classList.contains('tree-cell')) {
            e.stopPropagation();
            e.preventDefault();
            toggleApple(cell);
        } else if (cellShouldHaveLake(cell)) {
            e.stopPropagation();
            e.preventDefault();
            toggleFloatingTent(cell);
        }
    }

    function setupCell(cell) {
        if (!cell._listenerAttached) {
            cell.addEventListener('click', onCellClick);
            cell._listenerAttached = true;
        }
        if (cell.classList.contains('tree-cell')) applyAppleState(cell);
        applyFloatingTentState(cell);
    }

    function refreshBoard() {
        document.querySelectorAll('#board .cell').forEach(setupCell);
    }

    function resetFunStates() {
        appleTreeSet.clear();
        floatingTentSet.clear();
        document.querySelectorAll('#board .cell').forEach(cell => {
            restoreOriginalGrass(cell); // Restore grass before refreshing the board
        });

        refreshBoard();
    }

    // ========== LAGOS Y PROTECCIÓN DE HIERBA (sin cambios relevantes) ==========
    function getLakeBackgroundSVG() {
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect x='0' y='0' width='48' height='48' rx='4' ry='4' fill='%233b9eff' stroke='%231a6db3' stroke-width='1.5' /%3E%3Cpath d='M0 16 Q12 12 24 16 Q36 20 48 16' stroke='%23c0e4ff' stroke-width='2' fill='none' stroke-linecap='round' /%3E%3Cpath d='M0 28 Q12 24 24 28 Q36 32 48 28' stroke='%23c0e4ff' stroke-width='2' fill='none' stroke-linecap='round' /%3E%3Cpath d='M0 40 Q12 36 24 40 Q36 44 48 40' stroke='%23c0e4ff' stroke-width='1.8' fill='none' stroke-linecap='round' /%3E%3C/svg%3E#lake")`;
    }

    function getZeroClues() {
        const colClues = document.querySelectorAll('#colClues .col-clue');
        const zeroCols = [];
        colClues.forEach((el, i) => { if (parseInt(el.textContent) === 0) zeroCols.push(i); });
        const rowClues = document.querySelectorAll('#rowClues .col-clue');
        const zeroRows = [];
        rowClues.forEach((el, i) => { if (parseInt(el.textContent) === 0) zeroRows.push(i); });
        return { zeroRows, zeroCols };
    }

    function cellShouldHaveLake(cell) {
        if (cell.classList.contains('tree-cell')) return false;
        const label = cell.getAttribute('aria-label');
        if (!label) return false;
        const match = label.match(/Row (\d+), column (\d+)/i);
        if (!match) return false;
        const row = parseInt(match[1]) - 1;
        const col = parseInt(match[2]) - 1;
        const { zeroRows, zeroCols } = getZeroClues();
        return zeroRows.includes(row) || zeroCols.includes(col);
    }

    function updateLakeBackgrounds() {
        if (!funMode) {
            document.querySelectorAll('#board .cell').forEach(cell => {
                if (cell.style.backgroundImage && cell.style.backgroundImage.includes('lake')) {
                    cell.style.backgroundImage = '';
                }
                restoreOriginalGrass(cell);
                applyFloatingTentState(cell);
            });
            return;
        }
        const cells = document.querySelectorAll('#board .cell');
        cells.forEach(cell => {
            const shouldHaveLake = cellShouldHaveLake(cell);
            if (shouldHaveLake) {
                cell.style.backgroundImage = getLakeBackgroundSVG();
                cell.style.backgroundSize = 'cover';
                cell.style.backgroundRepeat = 'no-repeat';
                cell.style.backgroundPosition = 'center';
                if (cell.classList.contains('grass-marked')) {
                    cell.classList.remove('grass-marked');
                }
                const grassIcon = cell.querySelector('.grass-icon');
                if (grassIcon) grassIcon.remove();
            } else {
                if (cell.style.backgroundImage && cell.style.backgroundImage.includes('lake')) {
                    cell.style.backgroundImage = '';
                }
            }
            applyFloatingTentState(cell);
        });
    }

    function protectLakeCellsFromGrass() {
        if (!funMode) return;
        const cells = document.querySelectorAll('#board .cell');
        cells.forEach(cell => {
            if (cellShouldHaveLake(cell)) {
                // Store original grass state before removing it
                const existingGrass = cell.querySelector('.grass-icon');
                if (existingGrass && !cell._originalGrassSVG) {
                    cell._originalGrassSVG = existingGrass.cloneNode(true);
                    // Also store if it had the 'grass-marked' class
                    cell._originalGrassClass = cell.classList.contains('grass-marked') ? 'grass-marked' : '';
                }

                // Remove grass if it's a lake
                if (cell.classList.contains('grass-marked')) {
                    cell.classList.remove('grass-marked');
                }
                const grassIcon = cell.querySelector('.grass-icon');
                if (grassIcon) grassIcon.remove();
            }
        });
    }

    // Restores grass to cells that previously had it
    function restoreOriginalGrass(cell) {
        if (cell._originalGrassSVG) {
            if (!cell.querySelector('.grass-icon')) { // Only add if not already present
                cell.appendChild(cell._originalGrassSVG);
                if (cell._originalGrassClass === 'grass-marked') {
                    cell.classList.add('grass-marked');
                }
            }
            delete cell._originalGrassSVG; // Clear stored state after restoring
            delete cell._originalGrassClass;
        }
    }

    // ========== OBSERVADORES ==========
    function watchForNewCells() {
        const board = document.getElementById('board');
        if (!board) return;
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mut => {
                mut.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.matches('.cell')) setupCell(node);
                        else if (node.matches('svg')) { // Detectar cuando el juego inyecta un SVG
                            const cell = node.closest('.cell');
                            if (cell) setupCell(cell);
                        }
                        if (node.querySelectorAll) node.querySelectorAll('.cell').forEach(setupCell);
                    }
                });
            });
            if (funMode) {
                updateLakeBackgrounds();
                protectLakeCellsFromGrass();
            }
        });
        observer.observe(board, { childList: true, subtree: true });
    }

    function watchPuzzleReset() {
        const newBtn = document.getElementById('newPuzzle');
        const resetBtn = document.getElementById('resetPuzzle');
        const typeSelect = document.getElementById('newPuzzleType');
        const sizeSelect = document.getElementById('newSize');
        const resetHandler = () => {
            setTimeout(() => {
                resetFunStates();
                updateLakeBackgrounds();
                refreshBoard();
                protectLakeCellsFromGrass();
            }, 100);
        };
        if (newBtn) newBtn.addEventListener('click', resetHandler);
        if (resetBtn) resetBtn.addEventListener('click', resetHandler);
        if (typeSelect) typeSelect.addEventListener('change', resetHandler);
        if (sizeSelect) sizeSelect.addEventListener('change', resetHandler);
    }

    function watchClueChanges() {
        const colContainer = document.getElementById('colClues');
        const rowContainer = document.getElementById('rowClues');
        if (!colContainer || !rowContainer) return;
        const callback = () => {
            if (funMode) {
                updateLakeBackgrounds();
                protectLakeCellsFromGrass();
            }
        };
        const obs = new MutationObserver(callback);
        obs.observe(colContainer, { childList: true, subtree: true, characterData: true });
        obs.observe(rowContainer, { childList: true, subtree: true, characterData: true });
    }

    function watchForGrassOnLakes() {
        const board = document.getElementById('board');
        if (!board) return;
        const observer = new MutationObserver(() => {
            if (funMode) protectLakeCellsFromGrass();
        });
        observer.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    function triggerConfetti(el) {
        const rect = el.getBoundingClientRect();
        const colors = ['#ff5252', '#33d9b2', '#34ace0', '#ffda79', '#ff793f', '#706fd3'];
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div');
            p.className = 'confetti-particle';
            p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            let x = rect.left + rect.width / 2;
            let y = rect.top + rect.height / 2;
            const angle = Math.random() * Math.PI * 2;
            const force = 5 + Math.random() * 10;
            let vx = Math.cos(angle) * force;
            let vy = (Math.sin(angle) * force) - 5;
            let opacity = 1;
            const step = () => {
                x += vx; y += vy; vy += 0.45; vx *= 0.98; opacity -= 0.018;
                p.style.left = x + 'px'; p.style.top = y + 'px';
                p.style.opacity = opacity;
                p.style.transform = `scale(${0.5 + opacity / 2}) rotate(${opacity * 1000}deg)`;
                if (opacity > 0) requestAnimationFrame(step);
                else p.remove();
            };
            document.body.appendChild(p);
            requestAnimationFrame(step);
        }
    }

    // ========== BOTÓN + FUN ==========
    function addButton() {
        if (button) return true;
        const container = document.querySelector('.board-controls');
        if (!container) return false;
        button = document.createElement('button');
        button.innerHTML = '<i class="fa fa-circle" style="font-size: 0.7em; vertical-align: middle; margin-right: 6px;"></i>FUN';
        button.className = 'plus-fun-btn';
        button.type = 'button';
        button.title = 'Activar +Fun: clic en árboles para añadir/quitar manzanas con gradiente, muestra lagos y evita hierba en lagos';

        muteButton = document.createElement('button');
        muteButton.textContent = '🔊';
        muteButton.className = 'mute-btn';
        muteButton.type = 'button';
        muteButton.title = 'Silenciar/Activar música';
        muteButton.addEventListener('click', toggleMute);
        muteButton.style.display = 'none'; // Oculto por defecto

        button.addEventListener('click', () => {
            funMode = !funMode;
            if (funMode) { triggerConfetti(button); startMusic(); muteButton.style.display = 'inline-block'; }
            else { stopMusic(); muteButton.style.display = 'none'; }
            button.classList.toggle('active', funMode);
            updateLakeBackgrounds();
            protectLakeCellsFromGrass();
            refreshBoard();
        });
        container.appendChild(button);
        container.appendChild(muteButton);
        return true;
    }

    function init() {
        if (!addButton()) {
            setTimeout(init, 300);
            return;
        }
        refreshBoard();
        watchForNewCells();
        watchPuzzleReset();
        watchClueChanges();
        watchForGrassOnLakes();
        updateLakeBackgrounds();
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else
        init();
})();