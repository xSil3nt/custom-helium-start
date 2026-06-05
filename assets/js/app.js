const SafeStorage = {
    prefix: 'helium_',
    get: (key, fallback = '[]') => {
        try {
            return JSON.parse(localStorage.getItem(SafeStorage.prefix + key) || fallback);
        } catch (e) {
            return JSON.parse(fallback);
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(SafeStorage.prefix + key, JSON.stringify(value));
        } catch (e) { }
    }
};

const escapeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

const init3D = () => {
    const canvas = document.getElementById('app-3d');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
        precision: 'mediump'
    });

    const baseSize = 64;
    renderer.setSize(baseSize, baseSize, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    canvas.style.width = (baseSize * CONFIG.animation.scale) + 'px';
    canvas.style.height = (baseSize * CONFIG.animation.scale) + 'px';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 10;

    const group = new THREE.Group();
    const ditherMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                vec3 lightDir = normalize(vec3(0.5, 1.0, 1.0));
                float diff = max(dot(vNormal, lightDir), 0.0);
                vec2 pos = floor(gl_FragCoord.xy);
                float dither = mod(pos.x + pos.y, 2.0); 
                float stepDiff = step(0.5, diff + (dither * 0.3 - 0.15));
                vec3 highlightColor = vec3(1.0, 1.0, 1.0);
                vec3 shadowColor = vec3(0.5, 0.6, 0.9); 
                gl_FragColor = vec4(mix(shadowColor, highlightColor, stepDiff), 1.0);
            }
        `
    });

    const geo = new THREE.BoxGeometry(0.5, 6, 0.5);
    for (let i = 0; i < 4; i++) {
        const mesh = new THREE.Mesh(geo, ditherMaterial);
        mesh.rotation.z = (Math.PI / 4) * i;
        group.add(mesh);
    }
    group.scale.set(0, 0, 0);
    scene.add(group);

    let isPaused = false;
    let startTime = null;

    const animate3D = (time) => {
        if (isPaused) return;
        if (!startTime) startTime = time;

        const elapsed = (time - startTime) / 1000;
        const entranceDuration = 1.2;

        if (elapsed < entranceDuration) {
            const t = elapsed / entranceDuration;
            const scale = 1 + 0.1 * Math.sin(t * Math.PI) * (1 - t);
            const finalScale = t < 1 ? t * scale : 1;
            group.scale.set(finalScale, finalScale, finalScale);
        } else {
            group.scale.set(1, 1, 1);
        }

        requestAnimationFrame(animate3D);
        group.rotation.y = (time * CONFIG.animation.speedY);
        group.rotation.x = (time * CONFIG.animation.speedX);
        renderer.render(scene, camera);
    };
    requestAnimationFrame(animate3D);

    document.addEventListener('visibilitychange', () => {
        const wasPaused = isPaused;
        isPaused = document.hidden;
        if (wasPaused && !isPaused) requestAnimationFrame(animate3D);
    });

    window.addEventListener('resize', () => {
        const dpr = window.devicePixelRatio || 1;
        renderer.setPixelRatio(dpr);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
    });
};

document.addEventListener('DOMContentLoaded', () => {
    init3D();

    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.querySelector('.search-icon');
    const searchCombobox = document.getElementById('search-combobox');
    const suggestionsList = document.getElementById('suggestions-list');
    const tabTray = document.getElementById('tab-tray');
    const canvas = document.getElementById('app-3d');
    const bangIndicator = document.getElementById('bang-indicator');

    searchInput.addEventListener('focus', () => canvas.classList.add('focused'));
    searchInput.addEventListener('blur', () => {
        canvas.classList.remove('focused');
        setTimeout(() => updateSpatialFeedback(false), 150);
    });

    searchInput.addEventListener('keydown', (e) => {
        canvas.classList.add('active');
        setTimeout(() => canvas.classList.remove('active'), 150);

        if (e.key === 'Escape' && searchInput.value) {
            searchInput.value = '';
            updateBangIndicator('');
            renderSuggestions([]);
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== searchInput)) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    const updateBangIndicator = (query) => {
        if (!bangIndicator) return;
        if (query.startsWith('!')) {
            const trigger = query.split(' ')[0].toLowerCase();
            const bang = CONFIG.bangsList.find(b => b.trigger === trigger);
            if (bang) {
                const domain = new URL(bang.url.replace('{q}', 'test')).hostname;
                bangIndicator.replaceChildren();
                const img = document.createElement('img');
                img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                img.className = 'w-5 h-5 rounded-full shadow-lg';
                img.alt = 'Search engine logo';
                bangIndicator.appendChild(img);

                bangIndicator.style.opacity = '1';
                bangIndicator.style.transform = 'scale(1)';

                searchIcon.style.opacity = '0';
                searchIcon.style.transform = 'scale(1)';
                return;
            }
        }
        bangIndicator.style.opacity = '0';
        bangIndicator.style.transform = 'scale(1)';
        searchIcon.style.opacity = '1';
        searchIcon.style.transform = 'scale(1)';
    };

    const updateSpatialFeedback = (isSearching) => {
        const wrapper = document.querySelector('.search-wrapper');
        if (isSearching) {
            canvas.classList.add('searching');
            wrapper?.classList.add('is-searching');
        } else {
            canvas.classList.remove('searching');
            wrapper?.classList.remove('is-searching');
        }
    };

    let state = {
        selectedIndex: -1,
        currentSuggestions: [],
        suggestionElements: [],
        lastQuery: '',
        debounceTimer: null
    };

    const defaultTabs = [
        { url: 'https://youtube.com', name: 'YouTube', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>' },
        { url: 'https://mail.google.com', name: 'Gmail', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" /></svg>' },
        { url: 'https://gemini.google.com', name: 'Gemini', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" /></svg>' },
        { url: 'https://web.whatsapp.com', name: 'WhatsApp', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>' }
    ];

    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');

        if (clockEl) {
            clockEl.textContent = '';
            clockEl.appendChild(document.createTextNode(h));
            const colon = document.createElement('span');
            colon.className = 'colon';
            colon.textContent = ':';
            clockEl.appendChild(colon);
            clockEl.appendChild(document.createTextNode(m));
        }

        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', options);
        if (dateEl && dateEl.textContent !== dateStr) dateEl.textContent = dateStr;
    }

    const normalizeDeep = (url) => {
        try {
            const u = new URL(url);
            let host = u.hostname.replace(/^www\./i, '');
            let path = u.pathname.replace(/\/$/, '');
            if (path === '') path = '/';
            return (host + path).toLowerCase();
        } catch (e) {
            return url.toLowerCase().replace(/\/$/, '');
        }
    };

    const trackVisit = (url, name) => {
        const normKey = normalizeDeep(url);
        let history = SafeStorage.get('h_history', '[]');

        const existingIndex = history.findIndex(i => normalizeDeep(i.url) === normKey);
        if (existingIndex !== -1) {
            history[existingIndex].count++;
            history[existingIndex].lastVisit = Date.now();
            if (url.length > history[existingIndex].url.length) history[existingIndex].url = url;
            if (name && name.length > 3) history[existingIndex].name = name;
        } else {
            history.push({ url, name, count: 1, lastVisit: Date.now() });
        }

        history.sort((a, b) => (b.count - a.count) || (b.lastVisit - a.lastVisit));
        SafeStorage.set('h_history', history.slice(0, 20));
        renderTray();
    };

    const renderTray = () => {
        const history = SafeStorage.get('h_history', '[]');
        if (!tabTray) return;

        const fragment = document.createDocumentFragment();
        const items = [...history];

        if (items.length < 4) {
            defaultTabs.forEach(def => {
                if (!items.find(i => normalizeDeep(i.url) === normalizeDeep(def.url)) && items.length < 4) {
                    items.push({ ...def, count: 0, lastVisit: 0 });
                }
            });
        }

        items.sort((a, b) => (b.count - a.count) || (b.lastVisit - a.lastVisit));
        const trayItems = items.slice(0, 4).map(item => {
            const defTab = defaultTabs.find(d => normalizeDeep(d.url) === normalizeDeep(item.url));
            if (defTab && defTab.icon) return { ...item, icon: defTab.icon };
            return item;
        });

        if (trayItems.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'flex-1 flex items-center justify-center py-4 text-[10px] text-white/20 tracking-[0.2em] uppercase';
            emptyMsg.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-1.5 rounded-full bg-white/10 animate-pulse"></div>
                    System Ready
                    <div class="w-1.5 h-1.5 rounded-full bg-white/10 animate-pulse" style="animation-delay:0.5s"></div>
                </div>
            `;
            tabTray.appendChild(emptyMsg);
            return;
        }

        tabTray.innerHTML = '';
        trayItems.forEach(item => {
            const a = document.createElement('a');
            a.href = item.url;
            a.rel = "noopener noreferrer";
            a.className = "tab-link flex-1";

            if (item.icon) {
                const svgWrapper = document.createElement('div');
                svgWrapper.className = 'flex items-center justify-center icon-shortcut transition-all';
                svgWrapper.innerHTML = item.icon;
                a.appendChild(svgWrapper);
            } else {
                const domain = new URL(item.url || 'http://localhost').hostname;
                const img = document.createElement('img');
                img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                img.className = 'rounded-full shadow-md opacity-0 transition-opacity duration-300 pointer-events-none icon-shortcut';
                img.alt = `${item.name} icon`;

                img.onload = () => img.classList.remove('opacity-0');

                img.onerror = () => {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] uppercase font-bold';
                    fallback.textContent = item.name.charAt(0);
                    a.replaceChild(fallback, img);
                };
                a.appendChild(img);
            }
            const textSpan = document.createElement('span');
            textSpan.textContent = item.name;
            a.appendChild(textSpan);

            a.addEventListener('click', () => {
                if (!item.url.includes('{q}')) trackVisit(item.url, item.name);
            });
            fragment.appendChild(a);
        });
        tabTray.appendChild(fragment);
    };

    const renderSuggestions = (suggestions, isBangs = false) => {
        state.currentSuggestions = suggestions;
        state.selectedIndex = -1;

        while (suggestionsList.firstChild) suggestionsList.removeChild(suggestionsList.firstChild);

        if (suggestions.length === 0) {
            state.currentSuggestions = [];
            state.suggestionElements = [];
            suggestionsList.classList.remove('active');
            searchCombobox.setAttribute('aria-expanded', 'false');
            return;
        }

        const fragment = document.createDocumentFragment();
        suggestions.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'suggestion-item';
            li.setAttribute('role', 'option');
            li.id = `suggestion-${index}`;

            if (isBangs) {
                const triggerSpan = document.createElement('span');
                triggerSpan.className = 'px-2 py-0.5 rounded font-mono text-sm mr-1';
                Object.assign(triggerSpan.style, { background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.9)', fontWeight: '600' });
                triggerSpan.textContent = item.trigger;

                const textSpan = document.createElement('span');
                textSpan.className = 'text-white/60 text-sm ml-2';
                textSpan.textContent = `Search on ${item.name}`;

                li.append(triggerSpan, textSpan);
                li.dataset.value = item.trigger + ' ';
            } else {
                li.insertAdjacentHTML('afterbegin', `
                    <svg class="w-4 h-4 text-white/40 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                `);
                const textSpan = document.createElement('span');
                textSpan.className = 'text-white/90 truncate';
                textSpan.textContent = item;
                li.appendChild(textSpan);
                li.dataset.value = item;
            }

            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                searchInput.value = li.dataset.value;
                if (isBangs) {
                    searchInput.focus();
                    renderSuggestions([]);
                } else {
                    searchForm.dispatchEvent(new Event('submit'));
                }
            });

            li.addEventListener('mouseenter', () => updateSelection(index));
            fragment.appendChild(li);
        });

        suggestionsList.appendChild(fragment);
        state.suggestionElements = Array.from(suggestionsList.querySelectorAll('.suggestion-item'));
        suggestionsList.classList.add('active');
        searchCombobox.setAttribute('aria-expanded', 'true');
    };

    const updateSelection = (index) => {
        state.suggestionElements.forEach(i => i.classList.remove('selected'));
        state.selectedIndex = index;
        if (index >= 0 && index < state.suggestionElements.length) {
            const el = state.suggestionElements[index];
            el.classList.add('selected');
            searchInput.setAttribute('aria-activedescendant', el.id);
        } else {
            searchInput.setAttribute('aria-activedescendant', '');
        }
    };

    const fetchSuggestions = async (query) => {
        try {
            const res = await fetch(
                `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
            );
            const data = await res.json();
            searchIcon.classList.remove('loading');
            if (data && data[0] === state.lastQuery && data[1]) renderSuggestions(data[1].slice(0, 6));
        } catch {
            searchIcon.classList.remove('loading');
        }
    };

    searchInput.addEventListener('input', (e) => {
        const rawValue = e.target.value;
        const query = rawValue.trim();
        updateBangIndicator(rawValue);

        if (query.startsWith('!') && !rawValue.includes(' ')) {
            const bang = CONFIG.bangsList.find(b => b.trigger === query.toLowerCase());
            if (bang) {
                const hasSiblings = CONFIG.bangsList.some(b => b.trigger.startsWith(query.toLowerCase()) && b.trigger !== query.toLowerCase());
                if (!hasSiblings) {
                    e.target.value = rawValue + ' ';
                    updateBangIndicator(e.target.value);
                }
            }
        }

        clearTimeout(state.debounceTimer);
        state.lastQuery = query;

        if (!query) {
            renderSuggestions([]);
            updateSpatialFeedback(false);
            return;
        }

        updateSpatialFeedback(true);

        if (query.startsWith('!')) {
            const parts = query.split(' ');
            if (parts.length <= 1) {
                const matches = CONFIG.bangsList.filter(b => b.trigger.startsWith(query.toLowerCase())).slice(0, 5);
                renderSuggestions(matches, true);
            } else {
                renderSuggestions([]);
            }
            return;
        }

        searchIcon.classList.add('loading');
        state.debounceTimer = setTimeout(() => fetchSuggestions(query), 150);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (!suggestionsList.classList.contains('active')) return;
        const items = suggestionsList.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            const nextIdx = state.selectedIndex < items.length - 1 ? state.selectedIndex + 1 : 0;
            updateSelection(nextIdx);
            searchInput.value = items[nextIdx].dataset.value;
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            const prevIdx = state.selectedIndex > 0 ? state.selectedIndex - 1 : items.length - 1;
            updateSelection(prevIdx);
            searchInput.value = items[prevIdx].dataset.value;
        } else if (e.key === 'Escape') {
            renderSuggestions([]);
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchForm.contains(e.target)) suggestionsList.classList.remove('active');
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputVal = searchInput.value.trim();
        if (!inputVal) return;

        if (inputVal.startsWith('!')) {
            const parts = inputVal.split(' ');
            const trigger = parts[0].toLowerCase();
            const query = parts.slice(1).join(' ');
            const bang = CONFIG.bangsList.find(b => b.trigger === trigger);

            if (bang) {
                const targetUrl = bang.url.replace('{q}', encodeURIComponent(query));
                trackVisit(targetUrl, bang.name);
                window.location.href = targetUrl;
            } else {
                window.location.href = `https://duckduckgo.com/?q=${encodeURIComponent(inputVal)}`;
            }
        } else {
            const urlPattern = /^(https?:\/\/)?((localhost|[\w\-]+(\.[\w\-]+)+)|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/[\w\-\.\/?%&@=#+~]*)?$/i;
            if (urlPattern.test(inputVal)) {
                let targetUrl = inputVal;
                if (!/^https?:\/\//i.test(inputVal)) targetUrl = `https://${inputVal}`;
                trackVisit(targetUrl, inputVal.split('/')[0]);
                window.location.href = targetUrl;
            } else {
                const engine = CONFIG.search.engineUrls[CONFIG.search.default] || CONFIG.search.engineUrls.google;
                updateSpatialFeedback(false);
                window.location.href = `${engine}${encodeURIComponent(inputVal)}`;
            }
        }
    });

    updateClock();
    setInterval(updateClock, 1000);
    renderTray();
});