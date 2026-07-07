// Centralized Engine State System Object
const AppState = {
    db: null,
    currentCourse: null,
    currentTopic: null,
    currentSubtopic: null,
    collapsedTopics: new Set(),
    initializedCourses: new Set(),
    recents: JSON.parse(localStorage.getItem('devnotes_recents') || '[]')
};

// Application Bootstrap Execution Point
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch('data.json');
        AppState.db = await res.json();
        
        initializeUIComponents();
        routeHandler();
        window.addEventListener('hashchange', routeHandler);
    } catch (err) {
        console.error("Critical Error bootstrap initializing application data stack:", err);
    }
});

// Structural Components Engine Setup
function initializeUIComponents() {
    const courseSelect = document.getElementById('courseSelect');
    
    // Populate Course Select Dropdown UI
    AppState.db.courses.forEach(course => {
        const opt = document.createElement('option');
        opt.value = course.slug;
        opt.textContent = course.name;
        courseSelect.appendChild(opt);
    });

    courseSelect.addEventListener('change', (e) => {
        const targetCourse = AppState.db.courses.find(c => c.slug === e.target.value);
        if (targetCourse && targetCourse.topics.length > 0) {
            const firstTopic = targetCourse.topics[0];
            if (firstTopic.subtopics.length > 0) {
                window.location.hash = `#/${targetCourse.slug}/${firstTopic.slug}/${firstTopic.subtopics[0].slug}`;
                return;
            }
        }
        window.location.hash = `#/${e.target.value}`;
    });

    // Dark/Light Global Theme Handlers
    document.getElementById('themeToggle').addEventListener('click', () => {
        const docEl = document.documentElement;
        if (docEl.classList.contains('dark')) {
            docEl.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            docEl.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
    });
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }

    // Connect Active Modal Triggers & Sidebars Panels
    setupSearchEngine();
    setupCollapsibleControls();
    setupResponsiveDrawers();
    setupGlobalShortcuts();
    renderRecentsPanel();
}

// Client Routing Management Engine (Deep Link Processing Engine)
function routeHandler() {
    const route = window.location.hash.replace('#/', '');
    if (!route) {
        // Safe Default Initialization Route Selection Path
        loadFallbackRoot();
        return;
    }

    const [courseSlug, topicSlug, subtopicSlug] = route.split('/');
    const targetCourse = AppState.db.courses.find(c => c.slug === courseSlug);
    
    if (!targetCourse) {
        loadFallbackRoot();
        return;
    }

    AppState.currentCourse = targetCourse;
    document.getElementById('courseSelect').value = targetCourse.slug;
    ensureDefaultCollapsed();

      if (topicSlug && subtopicSlug) {
        const topic = targetCourse.topics.find(t => t.slug === topicSlug);
        const subtopic = topic ? topic.subtopics.find(s => s.slug === subtopicSlug) : null;
        
        if (subtopic) {
            AppState.currentTopic = topic;
            AppState.currentSubtopic = subtopic;
        }
    }
    renderLeftTopicSidebar();

    if (topicSlug && subtopicSlug) {
        const topic = targetCourse.topics.find(t => t.slug === topicSlug);
        const subtopic = topic ? topic.subtopics.find(s => s.slug === subtopicSlug) : null;
        
        if (subtopic) {
            renderMainContentArea();
            closeMobileDrawer();
            return;
        }
    }
    
    // Fallback selection path index inside active courses structural branches
    if (targetCourse.topics.length > 0 && targetCourse.topics[0].subtopics.length > 0) {
        window.location.hash = `#/${targetCourse.slug}/${targetCourse.topics[0].slug}/${targetCourse.topics[0].subtopics[0].slug}`;
    }
}

function loadFallbackRoot() {
    if (AppState.db.courses.length > 0) {
        const rootC = AppState.db.courses[0];
        window.location.hash = `#/${rootC.slug}/${rootC.topics[0]?.slug}/${rootC.topics[0]?.subtopics[0]?.slug}`;
    }
}

// Collapse every topic the first time a course is opened, so the sidebar
// starts fully collapsed by default.
function ensureDefaultCollapsed() {
    if (!AppState.currentCourse) return;
    if (AppState.initializedCourses.has(AppState.currentCourse.slug)) return;
    AppState.currentCourse.topics.forEach(t => AppState.collapsedTopics.add(t.slug));
    AppState.initializedCourses.add(AppState.currentCourse.slug);
}

// Keep the "Collapse All" / "Expand All" button label in sync with state.
function updateToggleAllLabel() {
    const btn = document.getElementById('toggleAllTopics');
    if (!btn || !AppState.currentCourse) return;
    const allCollapsed = AppState.currentCourse.topics.every(t => AppState.collapsedTopics.has(t.slug));
    btn.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
}

// Left Tree Architectural Component Rendering
function renderLeftTopicSidebar() {
    const treeContainer = document.getElementById('topicsTree');
    treeContainer.innerHTML = '';

    AppState.currentCourse.topics.forEach(topic => {
        const isCollapsed = AppState.collapsedTopics.has(topic.slug);
        
        const topicBox = document.createElement('div');
        topicBox.className = "mb-1";

        const headerDiv = document.createElement('div');
        headerDiv.className = `flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${AppState.currentTopic?.slug === topic.slug ? 'text-green-600 font-semibold' : 'text-gray-700 dark:text-gray-300'}`;
        
        headerDiv.innerHTML = `
            <span class="truncate">${topic.name}</span>
            <i class="fa-solid fa-chevron-right text-[10px] transform transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}"></i>
        `;

        headerDiv.addEventListener('click', () => {
            const wasCollapsed = AppState.collapsedTopics.has(topic.slug);
            // Accordion behavior: collapse every topic, then open only the
            // clicked one (so opening a module auto-closes the previous one).
            AppState.currentCourse.topics.forEach(t => AppState.collapsedTopics.add(t.slug));
            if (wasCollapsed) {
                AppState.collapsedTopics.delete(topic.slug);
            }
            renderLeftTopicSidebar();
        });

        topicBox.appendChild(headerDiv);

        if (!isCollapsed) {
            const subContainer = document.createElement('ul');
            subContainer.className = "pl-4 mt-1 space-y-1 border-l border-gray-100 dark:border-gray-800 ml-3";
            
            topic.subtopics.forEach(sub => {
                const li = document.createElement('li');
                const isActive = AppState.currentSubtopic?.slug === sub.slug && AppState.currentTopic?.slug === topic.slug;
                li.className = `px-3 py-1.5 text-xs rounded-md cursor-pointer truncate transition-colors ${isActive ? 'bg-green-50 text-green-600 font-medium dark:bg-green-950/40 dark:text-green-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'}`;
                li.textContent = sub.name;
                
                li.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.location.hash = `#/${AppState.currentCourse.slug}/${topic.slug}/${sub.slug}`;
                });
                subContainer.appendChild(li);
            });
            topicBox.appendChild(subContainer);
        }

        treeContainer.appendChild(topicBox);
    });

    updateToggleAllLabel();
}


// Main View Engine Generator Injections
function renderMainContentArea() {
    const subtopic = AppState.currentSubtopic;
    if (!subtopic) return;

    // Process Breadcrumbs UI Trace Map
    const breadcrumbs = document.getElementById('breadcrumbs');
    breadcrumbs.innerHTML = `
        <span>${AppState.currentCourse.name}</span>
        <i class="fa-solid fa-chevron-right text-[8px]"></i>
        <span>${AppState.currentTopic.name}</span>
        <i class="fa-solid fa-chevron-right text-[8px]"></i>
        <span class="text-gray-900 dark:text-white font-medium">${subtopic.name}</span>
    `;

    document.getElementById('articleTitle').textContent = subtopic.name;
    // document.getElementById('articleDate').textContent = subtopic.lastUpdated || 'June 02, 2026';
    
    const bodyContainer = document.getElementById('articleBody');
    bodyContainer.innerHTML = subtopic.content;

    injectCodeBlockButtons();
    wrapTablesForScroll();
    renderContentNavigation();
    generateTableOfContents();
    trackRecentHistory(subtopic);

    // Reset scroll to top when navigating between content pages
    window.scrollTo({ top: 0, behavior: 'auto' });
}

// Builds an ordered flat list of every subtopic within the active course,
// so we can walk forward/back across topic boundaries.
function getFlatSubtopics() {
    const flat = [];
    AppState.currentCourse.topics.forEach(topic => {
        topic.subtopics.forEach(sub => {
            flat.push({ topic, sub });
        });
    });
    return flat;
}

// Previous / Next pager rendered at the end of each content page.
function renderContentNavigation() {
    const container = document.getElementById('contentNav');
    if (!container) return;
    container.innerHTML = '';

    const flat = getFlatSubtopics();
    const currentIndex = flat.findIndex(
        item => item.topic.slug === AppState.currentTopic.slug && item.sub.slug === AppState.currentSubtopic.slug
    );
    if (currentIndex === -1) return;

    const prev = currentIndex > 0 ? flat[currentIndex - 1] : null;
    const next = currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null;

    const buildLink = (entry, direction) => {
        const isNext = direction === 'next';
        const btn = document.createElement('button');
        btn.className = `group flex-1 min-w-0 flex flex-col ${isNext ? 'items-end text-right' : 'items-start text-left'} gap-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-green-500 dark:hover:border-green-500 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-green-500`;
        btn.innerHTML = `
            <span class="text-xs font-medium uppercase tracking-wider text-gray-400 flex items-center gap-1">
                ${isNext ? '' : '<i class="fa-solid fa-arrow-left text-[10px]"></i>'}
                ${isNext ? 'Next' : 'Previous'}
                ${isNext ? '<i class="fa-solid fa-arrow-right text-[10px]"></i>' : ''}
            </span>
            <span class="text-sm font-semibold text-gray-800 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 truncate max-w-full">${entry.sub.name}</span>
        `;
        btn.addEventListener('click', () => {
            window.location.hash = `#/${AppState.currentCourse.slug}/${entry.topic.slug}/${entry.sub.slug}`;
        });
        return btn;
    };

    if (prev) {
        container.appendChild(buildLink(prev, 'prev'));
    } else {
        const spacer = document.createElement('div');
        spacer.className = 'flex-1 hidden sm:block';
        container.appendChild(spacer);
    }

    if (next) {
        container.appendChild(buildLink(next, 'next'));
    }
}

// Wrap wide tables in a horizontally scrollable container so they don't
// break the layout on small screens.
function wrapTablesForScroll() {
    document.querySelectorAll('#articleBody table').forEach(table => {
        if (table.parentElement && table.parentElement.classList.contains('table-scroll')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'table-scroll';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });
}

// Interactive Copy Capabilities Feature Injections
function injectCodeBlockButtons() {
    document.querySelectorAll('#articleBody pre').forEach((block) => {
        const btn = document.createElement('button');
        btn.className = "absolute top-2 right-2 px-2 py-1 bg-gray-800 text-gray-400 hover:text-white text-xs rounded border border-gray-700 transition-colors focus:outline-none";
        btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        
        btn.addEventListener('click', () => {
            const code = block.querySelector('code')?.innerText || block.innerText;
            navigator.clipboard.writeText(code).then(() => {
                btn.innerHTML = '<i class="fa-solid fa-check text-green-500"></i> Copied!';
                setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy', 2000);
            });
        });
        block.appendChild(btn);
    });
}

// Dynamic Dynamic Auto-indexing Table Of Contents Mapping Functions
function generateTableOfContents() {
    const tocList = document.getElementById('tableOfContents');
    tocList.innerHTML = '';
    const headings = document.getElementById('articleBody').querySelectorAll('h2, h3');
    
    if (headings.length === 0) {
        tocList.innerHTML = '<li class="text-gray-400 italic">No sections found</li>';
        return;
    }

    headings.forEach((heading, idx) => {
        if (!heading.id) heading.id = `heading-${idx}`;
        const li = document.createElement('li');
        li.className = "pl-2 border-l-2 border-transparent hover:text-green-500 transition-all cursor-pointer truncate";
        li.textContent = heading.textContent;
        li.setAttribute('data-target', heading.id);
        
        li.addEventListener('click', () => {
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        tocList.appendChild(li);
    });

    setupScrollSpy(headings);
}

// Interactive ScrollSpy Highlighting Mechanism Engine
function setupScrollSpy(headings) {
    const tocItems = document.querySelectorAll('#tableOfContents li');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                tocItems.forEach(item => {
                    if (item.getAttribute('data-target') === entry.target.id) {
                        item.classList.add('toc-active');
                    } else {
                        item.classList.remove('toc-active');
                    }
                });
            }
        });
    }, { rootMargin: '-10% 0px -80% 0px' });

    headings.forEach(h => observer.observe(h));
}

// Search Modal Matching Execution Sub-engine
function setupSearchEngine() {
    const trigger = document.getElementById('searchTrigger');
    const modal = document.getElementById('searchModal');
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');

    const openSearch = () => { modal.classList.remove('hidden'); input.focus(); };
    const closeSearch = () => { modal.classList.add('hidden'); input.value = ''; results.innerHTML = ''; };

    trigger.addEventListener('click', openSearch);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeSearch(); });

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        results.innerHTML = '';
        if (!query) return;

        let matchCount = 0;
        AppState.db.courses.forEach(course => {
            course.topics.forEach(topic => {
                topic.subtopics.forEach(sub => {
                    const matchedContent = sub.content.toLowerCase().includes(query);
                    const matchedTitle = sub.name.toLowerCase().includes(query);

                    if (matchedTitle || matchedContent) {
                        matchCount++;
                        const entry = document.createElement('div');
                        entry.className = "p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md cursor-pointer transition-colors";
                        entry.innerHTML = `
                            <div class="text-xs text-green-600 font-semibold uppercase tracking-wider">${course.name} &raquo; ${topic.name}</div>
                            <div class="text-sm font-medium text-gray-900 dark:text-white mt-0.5">${sub.name}</div>
                        `;
                        entry.addEventListener('click', () => {
                            window.location.hash = `#/${course.slug}/${topic.slug}/${sub.slug}`;
                            closeSearch();
                        });
                        results.appendChild(entry);
                    }
                });
            });
        });

        if (matchCount === 0) {
            results.innerHTML = '<div class="text-sm text-gray-500 p-4 text-center">No search metrics matched your string inquiry.</div>';
        }
    });

    AppState.closeSearch = closeSearch;
    AppState.openSearch = openSearch;
}

// Sidebars Controls (Expand / Collapse States Actions)
function setupCollapsibleControls() {
    const toggleBtn = document.getElementById('toggleAllTopics');
    toggleBtn.addEventListener('click', () => {
        const allCollapsed = AppState.currentCourse.topics.every(t => AppState.collapsedTopics.has(t.slug));
        if (allCollapsed) {
            AppState.collapsedTopics.clear();
        } else {
            AppState.currentCourse.topics.forEach(t => AppState.collapsedTopics.add(t.slug));
        }
        renderLeftTopicSidebar();
    });

    document.getElementById('copyUrlBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            const orig = document.getElementById('copyUrlBtn').innerHTML;
            document.getElementById('copyUrlBtn').innerHTML = '<i class="fa-solid fa-check text-green-500"></i> Copied URL';
            setTimeout(() => document.getElementById('copyUrlBtn').innerHTML = orig, 2000);
        });
    });
}

// Mobile Panel Drawer Responsive Event Triggers
function setupResponsiveDrawers() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const leftSidebar = document.getElementById('leftSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    const openDrawer = () => {
        leftSidebar.classList.remove('-translate-x-full');
        backdrop.classList.remove('hidden');
    };
    const closeDrawer = () => {
        leftSidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
    };

    menuBtn.addEventListener('click', openDrawer);
    backdrop.addEventListener('click', closeDrawer);
    AppState.closeDrawer = closeDrawer;
}
function closeMobileDrawer() {
    if (AppState.closeDrawer) AppState.closeDrawer();
}

// Native Device Keyboard Hotkey Hooks Setup
function setupGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (AppState.openSearch) AppState.openSearch();
        }
        if (e.key === 'Escape') {
            if (AppState.closeSearch) AppState.closeSearch();
        }
    });
}

// Tracking Recents Engine Hook Metrics
function trackRecentHistory(subtopic) {
    let list = AppState.recents.filter(item => item.slug !== subtopic.slug);
    list.unshift({
        name: subtopic.name,
        slug: subtopic.slug,
        routeHash: `#/${AppState.currentCourse.slug}/${AppState.currentTopic.slug}/${subtopic.slug}`
    });
    // Truncate stack size allocations to 5 values
    if (list.length > 5) list.pop();
    AppState.recents = list;
    localStorage.setItem('devnotes_recents', JSON.stringify(list));
    renderRecentsPanel();
}

function renderRecentsPanel() {
    const listContainer = document.getElementById('recentList');
    listContainer.innerHTML = '';
    if (AppState.recents.length === 0) {
        listContainer.innerHTML = '<li class="text-gray-400 italic">No historical visits</li>';
        return;
    }
    AppState.recents.forEach(item => {
        const li = document.createElement('li');
        li.className = "truncate hover:text-green-500 cursor-pointer transition-colors flex items-center";
        li.innerHTML = `<i class="fa-regular fa-file-lines mr-1.5 opacity-60"></i> ${item.name}`;
        li.addEventListener('click', () => {
            window.location.hash = item.routeHash;
        });
        listContainer.appendChild(li);
    });
}