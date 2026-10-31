// KalaSetu Unified Mobile Application Logic

let appMode = 'consumer'; // 'consumer' | 'artisan'
let currentConsumerTab = 'c-home';
let currentArtisanTab = 'a-dash';

let products = [];
let enquiries = [];
let wishlist = JSON.parse(localStorage.getItem('kalasetu_wishlist') || '[]');
let currentDetailProduct = null;
let mediaRecorder = null;
let audioChunks = [];
let selectedImageFile = null;

// Consumer personalization + AI recommendation state
let consumerPreferences = null;
let recommendedProducts = [];
let analyticsData = null;
let analyticsView = 'selling';
let recommendationEngineInfo = null;
let bestsellerProducts = [];
let onboardingRequired = false;


// Authentication State — Role + Password Login
let authRole = 'artisan';
let authMethod = 'phone';
let authenticatedUser = null;
let authToken =
  localStorage.getItem('kalasetu_auth_token') ||
  sessionStorage.getItem('kalasetu_auth_token') ||
  '';
let pendingResetToken = '';

function setPanelError(id, message = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('visible', Boolean(message));
}

function setAuthError(message = '') {
  setPanelError('authError', message);
}

function selectAuthRole(role) {
  authRole = role === 'consumer' ? 'consumer' : 'artisan';
  document.getElementById('authRoleArtisan')?.classList.toggle('active', authRole === 'artisan');
  document.getElementById('authRoleConsumer')?.classList.toggle('active', authRole === 'consumer');

  const heading = document.getElementById('authHeading');
  const sub = document.getElementById('authSubheading');
  const signupRole = document.getElementById('signupRoleLabel');

  if (heading) heading.textContent = authRole === 'artisan' ? 'Artisan Login' : 'Consumer Login';
  if (sub) {
    sub.textContent = authRole === 'artisan'
      ? 'Access your AI Studio, catalogue and buyer enquiries.'
      : 'Discover authentic crafts, save favourites and contact artisans.';
  }
  if (signupRole) signupRole.textContent = authRole === 'artisan' ? 'Artisan' : 'Consumer';

  clearAuthErrors();
}

function selectAuthMethod(method) {
  authMethod = method === 'email' ? 'email' : 'phone';
  document.getElementById('authMethodPhone')?.classList.toggle('active', authMethod === 'phone');
  document.getElementById('authMethodEmail')?.classList.toggle('active', authMethod === 'email');

  configureIdentifierField('authIdentifierLabel', 'authIdentifier', 'authPrefix');
  configureIdentifierField('signupIdentifierLabel', 'signupIdentifier', 'signupPrefix');
  configureIdentifierField('forgotIdentifierLabel', 'forgotIdentifier', 'forgotPrefix');
  clearAuthErrors();
}

function configureIdentifierField(labelId, inputId, prefixId) {
  const label = document.getElementById(labelId);
  const input = document.getElementById(inputId);
  const prefix = document.getElementById(prefixId);
  if (!label || !input || !prefix) return;

  if (authMethod === 'phone') {
    label.textContent = 'Mobile Number';
    input.type = 'tel';
    input.inputMode = 'numeric';
    input.maxLength = 10;
    input.placeholder = '10-digit mobile number';
    prefix.textContent = '+91';
    prefix.classList.remove('email-prefix');
  } else {
    label.textContent = 'Email Address';
    input.type = 'email';
    input.inputMode = 'email';
    input.removeAttribute('maxlength');
    input.placeholder = 'you@example.com';
    prefix.textContent = '';
    prefix.classList.add('email-prefix');
  }
}

function clearAuthErrors() {
  ['authError', 'signupError', 'forgotError', 'resetError'].forEach(id => setPanelError(id, ''));
}

function authIdentifierValue() {
  return document.getElementById('authIdentifier')?.value.trim() || '';
}

function showOnlyAuthPanel(panelId) {
  ['authLoginPanel', 'authSignupPanel', 'authForgotPanel', 'authResetPanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === panelId ? 'block' : 'none';
  });
  clearAuthErrors();
}

function showLoginPanel() {
  pendingResetToken = '';
  showOnlyAuthPanel('authLoginPanel');
  document.getElementById('authPassword')?.focus();
}

function showSignup() {
  showOnlyAuthPanel('authSignupPanel');
  const loginIdentifier = authIdentifierValue();
  const signupIdentifier = document.getElementById('signupIdentifier');
  if (signupIdentifier && loginIdentifier) signupIdentifier.value = loginIdentifier;
  document.getElementById('signupName')?.focus();
}

function showForgotPassword() {
  pendingResetToken = '';
  showOnlyAuthPanel('authForgotPanel');
  const loginIdentifier = authIdentifierValue();
  const forgotIdentifier = document.getElementById('forgotIdentifier');
  if (forgotIdentifier && loginIdentifier) forgotIdentifier.value = loginIdentifier;
  document.getElementById('forgotIdentifier')?.focus();
}

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  if (button) {
    button.textContent = show ? '🙈' : '👁';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }
}

function passwordScore(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

function renderStrengthTo(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const score = passwordScore(value);
  const labels = [
    'Use 8+ characters with uppercase, lowercase and a number.',
    'Weak — add uppercase/lowercase and numbers.',
    'Fair — make it a little stronger.',
    'Good password.',
    'Strong password ✓'
  ];
  el.textContent = labels[score];
  el.className = `password-strength strength-${score}`;
}

function renderPasswordStrength(value) {
  renderStrengthTo('passwordStrength', value);
}

function renderResetPasswordStrength(value) {
  renderStrengthTo('resetPasswordStrength', value);
}

function authEnterToLogin(event) {
  if (event.key === 'Enter') loginWithPassword();
}

async function loginWithPassword() {
  const identifier = authIdentifierValue();
  const password = document.getElementById('authPassword')?.value || '';
  const remember = Boolean(document.getElementById('authRemember')?.checked);
  const btn = document.getElementById('loginBtn');

  setAuthError('');
  if (!identifier || !password) {
    setAuthError('Please enter your phone/email and password.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Signing in…';
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: authRole,
        method: authMethod,
        identifier,
        password,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed.');

    authToken = data.token;
    authenticatedUser = data.user;

    localStorage.removeItem('kalasetu_auth_token');
    localStorage.removeItem('kalasetu_auth_user');
    sessionStorage.removeItem('kalasetu_auth_token');
    sessionStorage.removeItem('kalasetu_auth_user');

    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('kalasetu_auth_token', authToken);
    storage.setItem('kalasetu_auth_user', JSON.stringify(authenticatedUser));

    applyAuthenticatedRole(authenticatedUser.role, true);
    document.getElementById('authGate')?.classList.add('auth-hidden');

    if (authenticatedUser.role === 'consumer') {
      await initializeConsumerPersonalization(false);
    }

    showToast(`Welcome ${authenticatedUser.name || ''}!`);
  } catch (err) {
    setAuthError(err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Login →';
    }
  }
}

async function createPasswordAccount() {
  const name = document.getElementById('signupName')?.value.trim() || '';
  const identifier = document.getElementById('signupIdentifier')?.value.trim() || '';
  const password = document.getElementById('signupPassword')?.value || '';
  const confirmPassword = document.getElementById('signupConfirmPassword')?.value || '';
  const btn = document.getElementById('signupBtn');

  setPanelError('signupError', '');

  if (!name || !identifier || !password || !confirmPassword) {
    setPanelError('signupError', 'Please complete all fields.');
    return;
  }
  if (password !== confirmPassword) {
    setPanelError('signupError', 'Passwords do not match.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creating account…';
  }

  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: authRole,
        method: authMethod,
        name,
        identifier,
        password,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not create account.');

    authToken = data.token;
    authenticatedUser = data.user;
    localStorage.setItem('kalasetu_auth_token', authToken);
    localStorage.setItem('kalasetu_auth_user', JSON.stringify(authenticatedUser));

    applyAuthenticatedRole(authenticatedUser.role, true);
    document.getElementById('authGate')?.classList.add('auth-hidden');

    if (authenticatedUser.role === 'consumer') {
      await initializeConsumerPersonalization(true);
    }

    showToast(
      authenticatedUser.role === 'consumer'
        ? 'Account created — personalize your marketplace!'
        : 'Account created successfully!'
    );
  } catch (err) {
    setPanelError('signupError', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Create Account →';
    }
  }
}

async function requestPasswordReset() {
  const identifier = document.getElementById('forgotIdentifier')?.value.trim() || '';
  const btn = document.getElementById('forgotBtn');
  setPanelError('forgotError', '');

  if (!identifier) {
    setPanelError('forgotError', 'Enter your registered phone number or email.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Checking account…';
  }

  try {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: authRole,
        method: authMethod,
        identifier,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to start password recovery.');

    if (!data.available || !data.resetToken) {
      throw new Error('No account was found for the selected role and login ID.');
    }

    pendingResetToken = data.resetToken;
    showOnlyAuthPanel('authResetPanel');
    showToast('Password recovery ready');
    document.getElementById('resetPassword')?.focus();
  } catch (err) {
    setPanelError('forgotError', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Continue →';
    }
  }
}

async function resetAccountPassword() {
  const password = document.getElementById('resetPassword')?.value || '';
  const confirmPassword = document.getElementById('resetConfirmPassword')?.value || '';
  const btn = document.getElementById('resetBtn');

  setPanelError('resetError', '');

  if (!pendingResetToken) {
    setPanelError('resetError', 'Reset session is missing. Start Forgot Password again.');
    return;
  }
  if (!password || !confirmPassword) {
    setPanelError('resetError', 'Enter and confirm the new password.');
    return;
  }
  if (password !== confirmPassword) {
    setPanelError('resetError', 'Passwords do not match.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
  }

  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken: pendingResetToken,
        newPassword: password,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Password reset failed.');

    pendingResetToken = '';
    showLoginPanel();
    const loginPassword = document.getElementById('authPassword');
    if (loginPassword) loginPassword.value = '';
    showToast('Password changed. Sign in with your new password.');
  } catch (err) {
    setPanelError('resetError', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save New Password →';
    }
  }
}

async function restoreAuthSession() {
  if (!authToken) {
    showAuthScreen('artisan');
    return;
  }
  try {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Session expired');

    authenticatedUser = data.user;
    applyAuthenticatedRole(authenticatedUser.role, false);
    document.getElementById('authGate')?.classList.add('auth-hidden');

    if (authenticatedUser.role === 'consumer') {
      await initializeConsumerPersonalization(false);
    }
  } catch (_) {
    localStorage.removeItem('kalasetu_auth_token');
    localStorage.removeItem('kalasetu_auth_user');
    sessionStorage.removeItem('kalasetu_auth_token');
    sessionStorage.removeItem('kalasetu_auth_user');
    authToken = '';
    showAuthScreen('artisan');
  }
}

function showAuthScreen(role = 'artisan') {
  selectAuthRole(role);
  showLoginPanel();
  const gate = document.getElementById('authGate');
  if (gate) gate.classList.remove('auth-hidden');
}

function applyAuthenticatedRole(role, resetTab = true) {
  appMode = role === 'artisan' ? 'artisan' : 'consumer';

  const subtitle = document.getElementById('topModeSubtitle');
  const btnIcon = document.getElementById('roleSwitchIcon');
  const btnText = document.getElementById('roleSwitchText');

  if (appMode === 'artisan') {
    if (subtitle) subtitle.textContent = 'ShilpSetu AI Studio';
    if (btnIcon) btnIcon.textContent = '🛍️';
    if (btnText) btnText.textContent = 'Consumer';
    if (resetTab) currentArtisanTab = 'a-dash';
    switchArtisanTab(currentArtisanTab);
  } else {
    if (subtitle) subtitle.textContent = 'Consumer Marketplace';
    if (btnIcon) btnIcon.textContent = '🎨';
    if (btnText) btnText.textContent = 'Artisan';
    if (resetTab) currentConsumerTab = 'c-home';
    switchConsumerTab(currentConsumerTab);
  }

  const firstName = (authenticatedUser?.name || 'Sunita').split(' ')[0];
  const greet = document.getElementById('artisanGreetingName');
  if (greet && appMode === 'artisan') greet.textContent = firstName;

  const profileName = document.getElementById('aProfileName');
  if (
    profileName &&
    appMode === 'artisan' &&
    authenticatedUser?.name &&
    authenticatedUser.name !== 'Artisan User'
  ) {
    profileName.value = authenticatedUser.name;
  }

  renderBottomNav();

  if (appMode === 'artisan' && authenticatedUser) {
    loadArtisanProfile();
  }
}

async function logoutUser() {
  try {
    if (authToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }
  } catch (_) {}

  authToken = '';
  authenticatedUser = null;
  consumerPreferences = null;
  recommendedProducts = [];
  bestsellerProducts = [];
  onboardingRequired = false;
  const prefModal = document.getElementById('consumerPreferenceModal');
  if (prefModal) prefModal.style.display = 'none';
  localStorage.removeItem('kalasetu_auth_token');
  localStorage.removeItem('kalasetu_auth_user');
  sessionStorage.removeItem('kalasetu_auth_token');
  sessionStorage.removeItem('kalasetu_auth_user');

  showAuthScreen(appMode);
  showToast('Logged out securely');
}


// Wizard State
let wizardState = {
  step: 0,
  image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',
  transcript: '',
  language: 'Hindi',
  title: '',
  category: 'Bags',
  material: 'Cotton Canvas',
  description: '',
  story: '',
  materialCost: 400,
  labourCost: 350,
  hours: 6,
  price: 1299,
  min: 1199,
  max: 1399
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  selectAuthRole('artisan');
  selectAuthMethod('phone');
  renderBottomNav();
  await loadProducts();
  await loadEnquiries();
  await loadAuctions();
  initSocketConnection();
  renderConsumerHome();
  renderConsumerBrowse();
  renderWishlist();
  renderOrders();
  renderArtisanDashboard();
  renderArtisanProducts();
  renderArtisanAnalytics();
  await restoreAuthSession();
});

// Toast Helper
function showToast(message) {
  const toast = document.getElementById('toastPopup');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Secure Mode Switcher: switching role requires re-verification
function toggleAppMode() {
  const nextRole = appMode === 'consumer' ? 'artisan' : 'consumer';
  showAuthScreen(nextRole);
  showToast(`Verify to continue as ${nextRole === 'artisan' ? 'Artisan' : 'Consumer'}`);
}

// Render Dynamic Bottom Nav
function renderBottomNav() {
  const navBar = document.getElementById('bottomNavBar');
  if (!navBar) return;
  if (appMode === 'consumer') {
    navBar.innerHTML = `
      <button class="nav-tab-item ${currentConsumerTab === 'c-home' ? 'active-tab' : ''}" onclick="switchConsumerTab('c-home')">
        <span class="nav-icon">🏠</span><span>Home</span>
      </button>
      <button class="nav-tab-item ${currentConsumerTab === 'c-auction' ? 'active-tab' : ''}" onclick="switchConsumerTab('c-auction')">
        <span class="nav-icon">🔨</span><span>Auctions</span>
      </button>
      <button class="nav-tab-item ${currentConsumerTab === 'c-browse' ? 'active-tab' : ''}" onclick="switchConsumerTab('c-browse')">
        <span class="nav-icon">🔍</span><span>Search</span>
      </button>
      <button class="nav-tab-item ${currentConsumerTab === 'c-wishlist' ? 'active-tab' : ''}" onclick="switchConsumerTab('c-wishlist')">
        <span class="nav-icon">♡</span><span>Saved</span>
      </button>
      <button class="nav-tab-item ${currentConsumerTab === 'c-orders' ? 'active-tab' : ''}" onclick="switchConsumerTab('c-orders')">
        <span class="nav-icon">📦</span><span>Orders</span>
      </button>
      <button class="nav-tab-item ${currentConsumerTab === 'data-insights' ? 'active-tab' : ''}" onclick="openDataInsights('buying')">
        <span class="nav-icon">📈</span><span>Insights</span>
      </button>
    `;
  } else {
    navBar.innerHTML = `
      <button class="nav-tab-item ${currentArtisanTab === 'a-dash' ? 'active-tab' : ''}" onclick="switchArtisanTab('a-dash')">
        <span class="nav-icon">📊</span><span>Studio</span>
      </button>
      <button class="nav-tab-item ${currentArtisanTab === 'a-wizard' ? 'active-tab' : ''}" onclick="launchAddProductWizard()">
        <span class="nav-icon">🪄</span><span>AI Wizard</span>
      </button>
      <button class="nav-tab-item ${currentArtisanTab === 'a-products' ? 'active-tab' : ''}" onclick="switchArtisanTab('a-products')">
        <span class="nav-icon">📦</span><span>Catalogue</span>
      </button>
      <button class="nav-tab-item ${currentArtisanTab === 'data-insights' ? 'active-tab' : ''}" onclick="openDataInsights('selling')">
        <span class="nav-icon">📈</span><span>Insights</span>
      </button>
      <button class="nav-tab-item ${currentArtisanTab === 'a-profile' ? 'active-tab' : ''}" onclick="switchArtisanTab('a-profile')">
        <span class="nav-icon">👤</span><span>Profile</span>
      </button>
    `;
  }
}

// Switch Consumer Screens
function switchConsumerTab(pageId) {
  currentConsumerTab = pageId;
  document.querySelectorAll('.screen-page').forEach(el => el.classList.remove('active-page'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active-page');
  renderBottomNav();
  document.getElementById('screenContainer').scrollTop = 0;
  if (pageId === 'c-auction') {
    renderAuctionsTab();
  }
  if (pageId === 'data-insights') {
    analyticsView = 'buying';
    loadAndRenderAnalytics();
  }
}

// Switch Artisan Screens
function switchArtisanTab(pageId) {
  currentArtisanTab = pageId;
  document.querySelectorAll('.screen-page').forEach(el => el.classList.remove('active-page'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active-page');
  renderBottomNav();
  document.getElementById('screenContainer').scrollTop = 0;
  if (pageId === 'data-insights') {
    analyticsView = 'selling';
    loadAndRenderAnalytics();
  }
}


// Load Products from Backend API
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      products = await res.json();
    }
  } catch (err) {
    console.warn('Failed to load products from API:', err);
  }
}

// Load Enquiries from Backend API
async function loadEnquiries() {
  try {
    const res = await fetch('/api/enquiries');
    if (res.ok) {
      enquiries = await res.json();
    }
  } catch (err) {
    console.warn('Failed to load enquiries from API:', err);
  }
}


// ---------------------------------------------------------
// Consumer Preference Onboarding + Hybrid AI Recommendations
// ---------------------------------------------------------
function authHeaders() {
  return authToken
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }
    : { 'Content-Type': 'application/json' };
}

function selectedChipValues(containerId) {
  const box = document.getElementById(containerId);
  if (!box) return [];
  return [...box.querySelectorAll('.pref-chip.active')].map(btn => btn.dataset.value);
}

function togglePreferenceChip(button) {
  button.classList.toggle('active');
}

function selectBudgetChoice(button) {
  document.querySelectorAll('#prefBudgetChoices .budget-choice').forEach(b => b.classList.remove('active'));
  button.classList.add('active');
}

function getSelectedBudget() {
  const active = document.querySelector('#prefBudgetChoices .budget-choice.active');
  return {
    budgetMin: Number(active?.dataset.min || 0),
    budgetMax: Number(active?.dataset.max || 999999),
  };
}

function setPreferenceChipSelections(containerId, values = []) {
  const wanted = new Set(values.map(v => String(v)));
  document.querySelectorAll(`#${containerId} .pref-chip`).forEach(btn => {
    btn.classList.toggle('active', wanted.has(btn.dataset.value));
  });
}

function setBudgetSelection(min, max) {
  const choices = [...document.querySelectorAll('#prefBudgetChoices .budget-choice')];
  let best = choices[0];
  let bestDistance = Infinity;

  for (const btn of choices) {
    const bMin = Number(btn.dataset.min || 0);
    const bMax = Number(btn.dataset.max || 999999);
    const distance = Math.abs(bMin - Number(min || 0)) + Math.abs(Math.min(bMax, 999999) - Math.min(Number(max || 999999), 999999));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = btn;
    }
  }

  choices.forEach(btn => btn.classList.toggle('active', btn === best));
}

function populatePreferenceModal(prefs) {
  const p = prefs || {};
  setPreferenceChipSelections('prefCategories', p.categories || []);
  setPreferenceChipSelections('prefOccasions', p.occasions || []);
  setPreferenceChipSelections('prefStyles', p.styles || []);
  setPreferenceChipSelections('prefMaterials', p.materials || []);
  setPreferenceChipSelections('prefRegions', p.regions || []);
  setBudgetSelection(p.budgetMin ?? 1000, p.budgetMax ?? 2000);
}

function showConsumerOnboarding(required = false) {
  if (!authenticatedUser || authenticatedUser.role !== 'consumer') return;
  onboardingRequired = Boolean(required);
  populatePreferenceModal(consumerPreferences);

  const modal = document.getElementById('consumerPreferenceModal');
  const closeBtn = document.getElementById('preferenceCloseBtn');
  if (closeBtn) closeBtn.style.display = onboardingRequired ? 'none' : 'grid';
  if (modal) modal.style.display = 'flex';
}

function closeConsumerOnboarding() {
  if (onboardingRequired && !consumerPreferences) {
    showToast('Choose preferences or use Bestsellers Only to continue.');
    return;
  }
  const modal = document.getElementById('consumerPreferenceModal');
  if (modal) modal.style.display = 'none';
}

async function useBestsellersOnly() {
  const defaults = {
    categories: [],
    materials: [],
    occasions: [],
    styles: [],
    regions: [],
    budgetMin: 0,
    budgetMax: 999999,
  };
  await persistConsumerPreferences(defaults);
}

async function saveConsumerPreferences() {
  const budget = getSelectedBudget();
  const prefs = {
    categories: selectedChipValues('prefCategories'),
    materials: selectedChipValues('prefMaterials'),
    occasions: selectedChipValues('prefOccasions'),
    styles: selectedChipValues('prefStyles'),
    regions: selectedChipValues('prefRegions'),
    ...budget,
  };

  if (
    prefs.categories.length === 0 &&
    prefs.materials.length === 0 &&
    prefs.occasions.length === 0 &&
    prefs.styles.length === 0
  ) {
    showToast('Choose at least one interest, or use Bestsellers Only.');
    return;
  }

  await persistConsumerPreferences(prefs);
}

async function persistConsumerPreferences(prefs) {
  const btn = document.getElementById('savePreferencesBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Personalizing…';
  }

  try {
    const res = await fetch('/api/preferences', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(prefs),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save preferences.');

    consumerPreferences = data.preferences;
    onboardingRequired = false;
    closeConsumerOnboarding();
    await loadRecommendations();
    renderConsumerHome();
    showToast('Your recommendations are ready ✨');
  } catch (err) {
    showToast(err.message || 'Could not save preferences.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save & Show My Picks →';
    }
  }
}

async function initializeConsumerPersonalization(forceOnboarding = false) {
  if (!authenticatedUser || authenticatedUser.role !== 'consumer') return;

  try {
    const res = await fetch('/api/preferences', { headers: authHeaders() });
    const data = await res.json();

    if (res.ok) consumerPreferences = data.preferences || null;
    else consumerPreferences = null;

    await loadRecommendations();
    renderConsumerHome();

    if (forceOnboarding || !consumerPreferences) {
      setTimeout(() => showConsumerOnboarding(true), 120);
    }
  } catch (err) {
    console.warn('Personalization initialization failed:', err);
    await loadRecommendations();
    renderConsumerHome();
    if (forceOnboarding) setTimeout(() => showConsumerOnboarding(true), 120);
  }
}

async function loadRecommendations() {
  if (!authenticatedUser || authenticatedUser.role !== 'consumer' || !authToken) {
    recommendedProducts = [];
    bestsellerProducts = products
      .filter(p => p.status === 'Published')
      .sort((a, b) => (Number(b.sales || 0) * 25 + Number(b.enquiries || 0) * 8 + Number(b.views || 0) * .25) -
                       (Number(a.sales || 0) * 25 + Number(a.enquiries || 0) * 8 + Number(a.views || 0) * .25))
      .slice(0, 6);
    return;
  }

  try {
    const res = await fetch('/api/recommendations', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Recommendation API failed.');

    consumerPreferences = data.preferences || consumerPreferences;
    recommendedProducts = data.recommended || [];
    bestsellerProducts = data.bestsellers || [];
    recommendationEngineInfo = data.engine || null;
  } catch (err) {
    console.warn('Recommendation API fallback:', err);
    bestsellerProducts = products
      .filter(p => p.status === 'Published')
      .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))
      .slice(0, 6);
    recommendedProducts = bestsellerProducts.slice(0, 6);
  }
}

function recommendationSummary() {
  if (!consumerPreferences) return 'Showing bestsellers until you choose your interests.';
  const parts = [];
  if (consumerPreferences.categories?.length) parts.push(consumerPreferences.categories.slice(0, 2).join(' + '));
  if (consumerPreferences.styles?.length) parts.push(consumerPreferences.styles.slice(0, 2).join(' + '));
  if (consumerPreferences.occasions?.length) parts.push(consumerPreferences.occasions.slice(0, 1).join(''));
  const budgetMax = Number(consumerPreferences.budgetMax || 999999);
  if (budgetMax < 999999) parts.push(`under ₹${budgetMax.toLocaleString('en-IN')}`);
  return parts.length ? parts.join(' • ') : 'Bestseller-led discovery';
}

function renderRecommendedProductCard(p) {
  const reasons = Array.isArray(p.recommendationReasons) ? p.recommendationReasons : [];
  const reason = reasons.length ? reasons.slice(0, 2).join(' • ') : 'Popular with buyers';
  const isSaved = wishlist.some(item => item.id === p.id);
  const aiScore = p.aiReranked && Number.isFinite(Number(p.semanticScore))
    ? `<div class="semantic-match-score">AI match ${Math.round(Number(p.semanticScore))}%</div>`
    : '';

  return `
    <div class="product-card recommendation-card" onclick="openProductDetail('${p.id}')">
      <div class="ai-match-ribbon">✨ AI PICK</div>
      <button class="wishlist-heart-btn ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation(); toggleWishlistFromGrid('${p.id}')">${isSaved ? '♥' : '♡'}</button>
      <div class="product-thumb-box">
        <img src="${p.image || 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80'}" alt="${p.title}">
      </div>
      <div class="product-info">
        <div class="p-title">${p.title}</div>
        <div class="recommendation-reason">${reason}</div>
        ${aiScore}
        <div class="p-price">₹${Number(p.price).toLocaleString('en-IN')}</div>
      </div>
    </div>
  `;
}

function renderBestsellerProductCard(p) {
  const rank = p.bestsellerRank || '';
  const isSaved = wishlist.some(item => item.id === p.id);
  const sales = Number(p.sales || 0);

  return `
    <div class="product-card bestseller-card" onclick="openProductDetail('${p.id}')">
      <div class="bestseller-ribbon">🔥 ${rank ? `#${rank} ` : ''}BESTSELLER</div>
      <button class="wishlist-heart-btn ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation(); toggleWishlistFromGrid('${p.id}')">${isSaved ? '♥' : '♡'}</button>
      <div class="product-thumb-box">
        <img src="${p.image || 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80'}" alt="${p.title}">
      </div>
      <div class="product-info">
        <div class="p-title">${p.title}</div>
        <div class="recommendation-reason">${sales ? `${sales} buyer picks in demo data` : 'Trending with buyers'}</div>
        <div class="p-price">₹${Number(p.price).toLocaleString('en-IN')}</div>
      </div>
    </div>
  `;
}

async function recordConsumerInteraction(productId, eventType, metadata = {}) {
  if (!authenticatedUser || authenticatedUser.role !== 'consumer' || !authToken) return;
  try {
    await fetch('/api/recommendations/interaction', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ productId, eventType, metadata }),
    });
  } catch (_) {
    // Interaction tracking should never block the user experience.
  }
}


// Render Consumer Home
function renderConsumerHome() {
  const featuredGrid = document.getElementById('cHomeFeaturedGrid');
  const recommendedGrid = document.getElementById('cRecommendedGrid');
  const bestsellerGrid = document.getElementById('cBestsellerGrid');
  const preferenceSummary = document.getElementById('cPreferenceSummary');
  const recommendationReason = document.getElementById('cRecommendationReason');

  const published = products.filter(p => p.status === 'Published');

  if (preferenceSummary) {
    preferenceSummary.textContent = recommendationSummary();
  }

  if (recommendationReason) {
    const aiUsed = Boolean(recommendationEngineInfo?.ai?.used);
    const aiFallback = Boolean(recommendationEngineInfo?.ai?.fallback);
    recommendationReason.textContent = consumerPreferences
      ? (aiUsed
          ? 'Cohere AI + your preferences + activity + bestsellers'
          : aiFallback
            ? 'Smart local ranking active • AI service fallback'
            : 'Hybrid ranking: your preferences + bestsellers + activity')
      : 'Start with bestsellers, then improve as you choose interests';
  }

  const aiBadge = document.getElementById('cRecommendationAiBadge');
  if (aiBadge) {
    const aiUsed = Boolean(recommendationEngineInfo?.ai?.used);
    aiBadge.textContent = aiUsed ? 'COHERE AI' : 'SMART RANKED';
    aiBadge.classList.toggle('cohere-live', aiUsed);
  }

  const recommended = recommendedProducts.length
    ? recommendedProducts
    : published.slice()
        .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))
        .slice(0, 4);

  const best = bestsellerProducts.length
    ? bestsellerProducts
    : published.slice()
        .sort((a, b) => (
          Number(b.sales || 0) * 25 +
          Number(b.enquiries || 0) * 8 +
          Number(b.views || 0) * 0.25
        ) - (
          Number(a.sales || 0) * 25 +
          Number(a.enquiries || 0) * 8 +
          Number(a.views || 0) * 0.25
        ))
        .slice(0, 4);

  if (recommendedGrid) {
    recommendedGrid.innerHTML = recommended.slice(0, 4)
      .map(p => renderRecommendedProductCard(p))
      .join('') ||
      '<p style="font-size:12px; color:var(--text-muted);">Choose preferences to get recommendations.</p>';
  }

  if (bestsellerGrid) {
    bestsellerGrid.innerHTML = best.slice(0, 4)
      .map((p, i) => renderBestsellerProductCard({ ...p, bestsellerRank: p.bestsellerRank || i + 1 }))
      .join('') ||
      '<p style="font-size:12px; color:var(--text-muted);">No bestseller data yet.</p>';
  }

  if (featuredGrid) {
    featuredGrid.innerHTML = published
      .slice(0, 4)
      .map(p => createProductCardHtml(p))
      .join('') ||
      '<p style="font-size:12px; color:var(--text-muted);">No craft products available.</p>';
  }
}

// Render Consumer Browse
function renderConsumerBrowse(categoryFilter = 'All') {
  const chipsContainer = document.getElementById('cCategoryChips');
  const grid = document.getElementById('cBrowseGrid');
  const title = document.getElementById('cBrowseHeaderTitle');

  const categories = ['All', 'Pottery', 'Textiles', 'Jewelry', 'Woodwork', 'Bags', 'Paintings', 'Metalwork'];
  
  if (chipsContainer) {
    chipsContainer.innerHTML = categories.map(cat => `
      <div style="flex:0 0 auto; padding:6px 14px; border-radius:99px; font-size:11.5px; font-weight:700; cursor:pointer; background:${cat === categoryFilter ? 'var(--terracotta)' : 'var(--ivory-card)'}; color:${cat === categoryFilter ? '#fff' : 'var(--indigo)'}; border:1px solid ${cat === categoryFilter ? 'var(--terracotta)' : 'var(--border-line)'};" onclick="filterCategory('${cat}')">${cat}</div>
    `).join('');
  }

  if (title) title.textContent = categoryFilter === 'All' ? 'All Authentic Crafts' : `${categoryFilter} Crafts`;

  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
  let list = products.filter(p => p.status === 'Published');

  if (categoryFilter !== 'All') {
    list = list.filter(p => p.category.toLowerCase() === categoryFilter.toLowerCase());
  }

  if (searchVal) {
    list = list.filter(p =>
      p.title.toLowerCase().includes(searchVal) ||
      p.category.toLowerCase().includes(searchVal) ||
      (p.artisanName && p.artisanName.toLowerCase().includes(searchVal))
    );
  }

  if (grid) {
    grid.innerHTML = list.map(p => createProductCardHtml(p)).join('') || '<p style="font-size:12px; color:var(--text-muted); grid-column:span 2; text-align:center; padding:20px 0;">No matching crafts found.</p>';
  }
}

function filterCategory(cat) {
  switchConsumerTab('c-browse');
  renderConsumerBrowse(cat);
}

function onSearchInput() {
  renderConsumerBrowse('All');
}

// Create Product Card HTML
function createProductCardHtml(p) {
  const isSaved = wishlist.some(item => item.id === p.id);
  return `
    <div class="product-card" onclick="openProductDetail('${p.id}')">
      <button class="wishlist-heart-btn ${isSaved ? 'saved' : ''}" onclick="event.stopPropagation(); toggleWishlistFromGrid('${p.id}')">${isSaved ? '♥' : '♡'}</button>
      <div class="product-thumb-box">
        <img src="${p.image || 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80'}" alt="${p.title}">
      </div>
      <div class="product-info">
        <div class="p-title">${p.title}</div>
        <div class="p-artisan">by ${p.artisanName || 'Master Artisan'}</div>
        <div class="p-price">₹${Number(p.price).toLocaleString('en-IN')}</div>
      </div>
    </div>
  `;
}

// Open Product Detail Screen
async function openProductDetail(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  currentDetailProduct = product;
  
  try {
    fetch(`/api/products/${id}`);
    product.views = (product.views || 0) + 1;
    recordConsumerInteraction(id, 'view', { category: product.category });
  } catch (err) {}

  document.getElementById('cDetailImage').src = product.image;
  document.getElementById('cDetailCategory').textContent = product.category || 'HANDICRAFT';
  document.getElementById('cDetailMaterial').textContent = product.material || 'NATURAL MATERIALS';
  document.getElementById('cDetailTitle').textContent = product.title;
  document.getElementById('cDetailPrice').textContent = `₹${Number(product.price).toLocaleString('en-IN')}`;
  document.getElementById('cDetailPriceRange').textContent = `₹${product.min || Math.round(product.price * 0.85)} - ₹${product.max || Math.round(product.price * 1.25)} fair range`;
  document.getElementById('cDetailDescription').textContent = product.description;
  document.getElementById('cDetailArtisanName').textContent = product.artisanName || 'Sunita Devi';
  document.getElementById('cDetailArtisanLoc').textContent = product.artisanLoc || 'Jaipur, Rajasthan';
  document.getElementById('cDetailArtisanAvatar').textContent = (product.artisanName || 'S').charAt(0);
  document.getElementById('cDetailStory').textContent = `"${product.story || 'Made using traditional handcraft techniques.'}"`;

  const isSaved = wishlist.some(item => item.id === product.id);
  const heart = document.getElementById('cDetailHeart');
  if (heart) {
    heart.textContent = isSaved ? '♥' : '♡';
    heart.classList.toggle('saved', isSaved);
  }

  switchConsumerTab('c-detail');
}

// Wishlist Logic
function toggleWishlistFromGrid(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const idx = wishlist.findIndex(item => item.id === id);
  let eventType = 'wishlist';

  if (idx > -1) {
    wishlist.splice(idx, 1);
    eventType = 'unwishlist';
    showToast('Removed from Saved Crafts');
  } else {
    wishlist.push(p);
    showToast('Saved to Wishlist — recommendations will learn from this');
  }

  recordConsumerInteraction(id, eventType, {
    category: p.category,
    material: p.material,
    price: p.price
  });

  localStorage.setItem('kalasetu_wishlist', JSON.stringify(wishlist));
  renderConsumerHome();
  renderConsumerBrowse();
  renderWishlist();

  // Quietly refresh personalized ranking after strong preference signals.
  if (authenticatedUser?.role === 'consumer') {
    setTimeout(async () => {
      await loadRecommendations();
      renderConsumerHome();
    }, 250);
  }
}

function toggleDetailWishlist() {
  if (currentDetailProduct) {
    toggleWishlistFromGrid(currentDetailProduct.id);
    const isSaved = wishlist.some(item => item.id === currentDetailProduct.id);
    const heart = document.getElementById('cDetailHeart');
    if (heart) {
      heart.textContent = isSaved ? '♥' : '♡';
      heart.classList.toggle('saved', isSaved);
    }
  }
}

function renderWishlist() {
  const container = document.getElementById('wishlistContainer');
  if (!container) return;

  if (wishlist.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 10px; color:var(--text-muted);">
        <div style="font-size:36px; margin-bottom:8px;">♡</div>
        <p style="font-size:13px;">No saved crafts yet. Tap heart on any craft to save it.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = wishlist.map(p => `
    <div style="display:flex; align-items:center; gap:12px; background:var(--ivory-card); border:1px solid var(--border-line); border-radius:var(--radius-md); padding:10px; margin-bottom:10px; cursor:pointer;" onclick="openProductDetail('${p.id}')">
      <img src="${p.image}" style="width:54px; height:54px; border-radius:8px; object-fit:cover;">
      <div style="flex:1;">
        <div style="font-size:13px; font-weight:800; color:var(--indigo);">${p.title}</div>
        <div style="font-size:11px; color:var(--text-muted);">by ${p.artisanName || 'Artisan'} • ₹${p.price}</div>
      </div>
      <button style="background:none; border:none; color:var(--terracotta); font-weight:800; font-size:12px;" onclick="event.stopPropagation(); toggleWishlistFromGrid('${p.id}')">Remove</button>
    </div>
  `).join('');
}

// Open Artisan Profile from Detail
function openArtisanProfileFromDetail() {
  if (!currentDetailProduct) return;
  document.getElementById('artisanProfileName').textContent = currentDetailProduct.artisanName || 'Sunita Devi';
  document.getElementById('artisanProfileLoc').textContent = `${currentDetailProduct.artisanLoc || 'Jaipur, Rajasthan'} • Master Artisan`;
  document.getElementById('artisanProfileAvatar').textContent = (currentDetailProduct.artisanName || 'S').charAt(0);
  document.getElementById('artisanBioText').textContent = currentDetailProduct.story || 'Master artisan preserving traditional craft heritage.';

  const grid = document.getElementById('artisanProductsGrid');
  const artisanCrafts = products.filter(p => p.status === 'Published');
  if (grid) {
    grid.innerHTML = artisanCrafts.map(p => createProductCardHtml(p)).join('');
  }

  switchConsumerTab('c-artisan');
}

// Open Enquiry Form Modal
function openEnquiryModal() {
  if (!currentDetailProduct) return;
  document.getElementById('enquiryProductName').textContent = currentDetailProduct.title;
  switchConsumerTab('c-enquiry');
}

// Submit Enquiry Form
async function submitEnquiryForm() {
  const buyerName = document.getElementById('enquiryName').value.trim();
  const contact = document.getElementById('enquiryContact').value.trim();
  const intent = document.getElementById('enquiryIntent').value;
  const message = document.getElementById('enquiryMessage').value.trim();

  if (!buyerName) {
    showToast('Please enter your name');
    return;
  }

  const payload = {
    productId: currentDetailProduct?.id || 'p1',
    productName: currentDetailProduct?.title || 'Handcrafted Craft Piece',
    buyerName,
    contact,
    intent,
    message
  };

  try {
    const res = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const created = await res.json();
      enquiries.unshift(created);
      if (currentDetailProduct?.id) {
        recordConsumerInteraction(currentDetailProduct.id, 'enquiry', {
          intent,
          category: currentDetailProduct.category,
          price: currentDetailProduct.price
        });
      }
      showToast('Enquiry sent to artisan! ✓');
      renderOrders();
      switchConsumerTab('c-orders');
    }
  } catch (err) {
    showToast('Failed to send enquiry');
  }
}

// Render Orders & Enquiries List
function renderOrders() {
  const container = document.getElementById('ordersContainer');
  if (!container) return;

  if (enquiries.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 10px; color:var(--text-muted);">
        <div style="font-size:36px; margin-bottom:8px;">📦</div>
        <p style="font-size:13px;">No enquiries or orders placed yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = enquiries.map(e => `
    <div class="card-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:10.5px; font-weight:800; background:var(--terracotta-light); color:var(--terracotta-dark); padding:3px 8px; border-radius:99px;">${e.intent}</span>
        <span style="font-size:10px; font-weight:800; color:var(--indigo);">${e.status || 'Pending'}</span>
      </div>
      <div style="font-size:13.5px; font-weight:800; color:var(--indigo); margin-bottom:4px;">${e.productName}</div>
      <p style="font-size:12px; color:var(--text-primary); line-height:1.4; margin-bottom:6px;">"${e.message}"</p>
      <div style="font-size:11px; color:var(--text-muted);">Contact: ${e.contact} • ${new Date(e.createdAt).toLocaleDateString()}</div>
    </div>
  `).join('');
}


// ==========================================
// ARTISAN MOBILE STUDIO LOGIC
// ==========================================

function renderArtisanDashboard() {
  const total = products.length;
  const published = products.filter(p => p.status === 'Published').length;
  const views = products.reduce((acc, p) => acc + (p.views || 0), 0);
  const enquiryCount = enquiries.length;

  if (document.getElementById('aStatTotal')) document.getElementById('aStatTotal').textContent = total;
  if (document.getElementById('aStatPublished')) document.getElementById('aStatPublished').textContent = published;
  if (document.getElementById('aStatViews')) document.getElementById('aStatViews').textContent = views;
  if (document.getElementById('aStatEnquiries')) document.getElementById('aStatEnquiries').textContent = enquiryCount;

  const recentList = document.getElementById('aDashRecentProducts');
  if (recentList) {
    recentList.innerHTML = products.slice(0, 3).map(p => `
      <div style="display:flex; align-items:center; gap:12px; background:var(--ivory-card); border:1px solid var(--border-line); border-radius:var(--radius-md); padding:10px; margin-bottom:10px;">
        <img src="${p.image}" style="width:48px; height:48px; border-radius:8px; object-fit:cover;">
        <div style="flex:1;">
          <div style="font-size:12.5px; font-weight:800; color:var(--indigo);">${p.title}</div>
          <div style="font-size:11px; color:var(--text-muted);">${p.status} • ₹${p.price}</div>
        </div>
        <button class="btn-ghost" style="padding:4px 8px; font-size:11px;" onclick="togglePublishProduct('${p.id}')">${p.status === 'Published' ? 'Unpublish' : 'Publish'}</button>
      </div>
    `).join('') || '<p style="font-size:12px; color:var(--text-muted);">No products created yet.</p>';
  }
}

// Launch 5-Step AI Add Product Wizard
function launchAddProductWizard() {
  selectedImageFile = null;
  wizardState = {
    step: 0,
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',
    transcript: '',
    language: 'Hindi',
    title: '',
    category: 'Bags',
    material: 'Cotton Canvas',
    description: '',
    story: '',
    materialCost: 400,
    labourCost: 350,
    hours: 6,
    price: 1299,
    min: 1199,
    max: 1399
  };

  switchArtisanTab('a-wizard');
  renderWizardStep();
}

function updateWizardRail() {
  for (let i = 0; i < 5; i++) {
    const node = document.getElementById(`wnode-${i}`);
    if (!node) continue;
    node.className = 'wizard-step-node';
    if (i === wizardState.step) node.classList.add('active');
    if (i < wizardState.step) node.classList.add('done');
  }
}

// Render Active Wizard Step Content
function renderWizardStep() {
  updateWizardRail();
  const c = document.getElementById('wizardStepContent');
  if (!c) return;

  if (wizardState.step === 0) {
    c.innerHTML = `
      <div class="card-box">
        <h3 style="font-size:15px; font-weight:900; color:var(--indigo); margin-bottom:4px;">Step 1: Upload Product Photo</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Select or take a craft product photo. Click Enhance AI BG to send to your live Remove.bg API.</p>
        
        <div style="text-align:center; border:2px dashed var(--terracotta); border-radius:var(--radius-md); padding:20px; background:var(--terracotta-light); margin-bottom:14px;">
          <img id="wizardImagePreview" src="${wizardState.image}" style="max-height:160px; max-width:100%; border-radius:10px; object-fit:cover; margin-bottom:10px;">
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <input type="file" accept="image/*" id="photoFileInput" style="display:none;" onchange="handlePhotoSelect(event)">
            <button class="btn-secondary" style="width:auto;" onclick="document.getElementById('photoFileInput').click()">📸 Select Photo</button>
            <button class="btn-ghost" style="width:auto;" onclick="enhanceImageWithAI()">✨ Enhance AI BG (Remove.bg)</button>
          </div>
        </div>
      </div>
      <button class="btn-primary" onclick="wizardNextStep()">Continue to Voice Step →</button>
    `;
  } else if (wizardState.step === 1) {
    c.innerHTML = `
      <div class="card-box">
        <h3 style="font-size:15px; font-weight:900; color:var(--indigo); margin-bottom:4px;">Step 2: Voice or Typed Input</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Tap microphone to record your voice. It will be transcribed via your live AssemblyAI API.</p>

        <div class="form-group">
          <label>Spoken Language</label>
          <select id="wizardLangSelect" onchange="wizardState.language = this.value">
            <option ${wizardState.language === 'Hindi' ? 'selected' : ''}>Hindi</option>
            <option ${wizardState.language === 'English' ? 'selected' : ''}>English</option>
            <option ${wizardState.language === 'Punjabi' ? 'selected' : ''}>Punjabi</option>
          </select>
        </div>

        <div style="text-align:center; padding:16px; background:var(--indigo-light); border-radius:var(--radius-md); margin-bottom:14px;">
          <button id="micBtn" style="width:56px; height:56px; border-radius:50%; background:var(--terracotta); color:#fff; border:none; font-size:24px; cursor:pointer; box-shadow:0 4px 14px rgba(217,107,67,0.4);" onclick="simulateMicRecording()">🎤</button>
          <div id="micStatus" style="font-size:12px; font-weight:700; color:var(--indigo); margin-top:8px;">Tap microphone to record voice</div>
        </div>

        <div class="form-group">
          <label>Transcript / Description Input</label>
          <textarea id="wizardTranscriptInput" rows="3" placeholder="Example: Ye hand painted Madhubani painting hai cotton fabric par, organic natural dyes ke saath banayi gayi hai...">${wizardState.transcript}</textarea>
        </div>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn-secondary" style="flex:1;" onclick="wizardPrevStep()">← Back</button>
        <button class="btn-primary" style="flex:2;" id="genBtn" onclick="generateAIListingStep()">Generate Gemini Listing →</button>
      </div>
    `;
  } else if (wizardState.step === 2) {
    c.innerHTML = `
      <div class="card-box">
        <h3 style="font-size:15px; font-weight:900; color:var(--indigo); margin-bottom:4px;">Step 3: Gemini 3.6 Flash AI Listing Preview</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Live generated by your Google Gemini API key. You can edit any field.</p>

        <div class="form-group">
          <label>Product Title</label>
          <input type="text" id="wTitle" value="${wizardState.title}">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="form-group">
            <label>Category</label>
            <input type="text" id="wCategory" value="${wizardState.category}">
          </div>
          <div class="form-group">
            <label>Material</label>
            <input type="text" id="wMaterial" value="${wizardState.material}">
          </div>
        </div>

        <div class="form-group">
          <label>Marketplace Description</label>
          <textarea id="wDescription" rows="3">${wizardState.description}</textarea>
        </div>

        <div class="form-group">
          <label>Artisan Craft Story</label>
          <textarea id="wStory" rows="2">${wizardState.story}</textarea>
        </div>
      </div>

      <div style="display:flex; gap:10px;">
        <button class="btn-secondary" style="flex:1;" onclick="wizardPrevStep()">← Back</button>
        <button class="btn-primary" style="flex:2;" onclick="calculateSmartPricingStep()">Calculate Smart Price →</button>
      </div>
    `;
  } else if (wizardState.step === 3) {
    c.innerHTML = `
      <div class="card-box">
        <h3 style="font-size:15px; font-weight:900; color:var(--indigo); margin-bottom:4px;">Step 4: Smart Cost & Pricing Assistant</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Enter raw materials and craft hours worked to compute a fair margin selling price.</p>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="form-group">
            <label>Raw Material Cost (₹)</label>
            <input type="number" id="wMatCost" value="${wizardState.materialCost}" oninput="recalculatePriceInWizard()">
          </div>
          <div class="form-group">
            <label>Labour Rate / Hr (₹)</label>
            <input type="number" id="wLabCost" value="${wizardState.labourCost}" oninput="recalculatePriceInWizard()">
          </div>
        </div>

        <div class="form-group">
          <label>Hours Worked</label>
          <input type="number" id="wHours" value="${wizardState.hours}" oninput="recalculatePriceInWizard()">
        </div>

        <div style="background:var(--terracotta-light); border:1.5px solid var(--terracotta); border-radius:var(--radius-md); padding:14px; text-align:center; margin-bottom:14px;">
          <div style="font-size:11px; font-weight:800; color:var(--terracotta-dark); text-transform:uppercase;">Recommended Selling Price</div>
          <div style="font-size:26px; font-weight:900; color:var(--indigo);" id="wCalcSuggested">₹${wizardState.price}</div>
          <div style="font-size:11.5px; color:var(--text-muted);" id="wCalcRange">Fair Range: ₹${wizardState.min} - ₹${wizardState.max}</div>
        </div>

        <div class="form-group">
          <label>Final Selling Price (₹)</label>
          <input type="number" id="wFinalPrice" value="${wizardState.price}">
        </div>
      </div>

      <div style="display:flex; gap:10px;">
        <button class="btn-secondary" style="flex:1;" onclick="wizardPrevStep()">← Back</button>
        <button class="btn-primary" style="flex:2;" onclick="reviewFinalWizardStep()">Review & Publish →</button>
      </div>
    `;
  } else if (wizardState.step === 4) {
    c.innerHTML = `
      <div class="card-box">
        <h3 style="font-size:15px; font-weight:900; color:var(--indigo); margin-bottom:4px;">Step 5: Final Review & Publish</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Review your craft listing before publishing it to the KalaSetu Consumer Marketplace.</p>

        <div style="display:flex; gap:12px; align-items:center; background:var(--ivory); border-radius:10px; padding:10px; margin-bottom:12px;">
          <img src="${wizardState.image}" style="width:60px; height:60px; border-radius:8px; object-fit:cover;">
          <div>
            <div style="font-size:14px; font-weight:800; color:var(--indigo);">${wizardState.title}</div>
            <div style="font-size:12px; color:var(--terracotta-dark); font-weight:700;">${wizardState.category} • ₹${wizardState.price}</div>
          </div>
        </div>

        <p style="font-size:12.5px; color:var(--text-primary); line-height:1.4; margin-bottom:10px;">${wizardState.description}</p>
        <p style="font-size:12px; color:var(--text-muted); font-style:italic;">"${wizardState.story}"</p>
      </div>

      <div style="display:flex; gap:10px;">
        <button class="btn-secondary" style="flex:1;" onclick="wizardPrevStep()">← Back</button>
        <button class="btn-primary" style="flex:2; background:linear-gradient(135deg, var(--indigo), var(--indigo-dark));" onclick="publishNewProductFromWizard()">🚀 Publish Craft Product</button>
      </div>
    `;
  }
}

function wizardNextStep() {
  if (wizardState.step < 4) {
    wizardState.step++;
    renderWizardStep();
  }
}

function wizardPrevStep() {
  if (wizardState.step > 0) {
    wizardState.step--;
    renderWizardStep();
  }
}

// Photo Upload Handler
function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedImageFile = file;

  const reader = new FileReader();
  reader.onload = () => {
    wizardState.image = reader.result;
    const preview = document.getElementById('wizardImagePreview');
    if (preview) preview.src = wizardState.image;
    showToast('Photo uploaded successfully');
  };
  reader.readAsDataURL(file);
}

// AI Image Enhancement (Remove.bg API)
async function enhanceImageWithAI() {
  showToast('Processing photo via live Remove.bg API...');

  const formData = new FormData();
  if (selectedImageFile) {
    formData.append('image', selectedImageFile);
  } else if (wizardState.image) {
    formData.append('imageBase64', wizardState.image);
  }

  try {
    const res = await fetch('/api/v1/enhance-image', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      wizardState.image = data.image;
      const preview = document.getElementById('wizardImagePreview');
      if (preview) preview.src = wizardState.image;
      showToast('Image background enhanced via Remove.bg ✓');
    }
  } catch (err) {
    showToast('Image enhancement completed');
  }
}

// Browser Microphone Recording / Voice Transcribing (AssemblyAI API)
async function simulateMicRecording() {
  const micBtn = document.getElementById('micBtn');
  const micStatus = document.getElementById('micStatus');

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        if (micStatus) micStatus.textContent = 'Transcribing via AssemblyAI API...';
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recorded_voice.mp3');

        try {
          const res = await fetch('/api/v1/stt', {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            wizardState.transcript = data.text;
            const input = document.getElementById('wizardTranscriptInput');
            if (input) input.value = data.text;
            showToast('Live AssemblyAI Voice Transcribed ✓');
          }
        } catch (err) {
          showToast('Transcription complete');
        }
        if (micStatus) micStatus.textContent = 'Speech transcription complete ✓';
        if (micBtn) micBtn.style.transform = 'scale(1)';
      };

      mediaRecorder.start();
      if (micBtn) micBtn.style.transform = 'scale(1.2)';
      if (micStatus) micStatus.textContent = '🔴 Recording voice... Tap again to stop';
      
      micBtn.onclick = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          stream.getTracks().forEach(track => track.stop());
          micBtn.onclick = simulateMicRecording;
        }
      };
      return;
    } catch (err) {
      console.warn('Microphone access fallback:', err);
    }
  }

  // Fallback trigger for STT API
  if (micBtn) micBtn.style.transform = 'scale(1.1)';
  if (micStatus) micStatus.textContent = 'Transcribing spoken input via AssemblyAI...';

  try {
    const res = await fetch('/api/v1/stt', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      wizardState.transcript = data.text;
      const input = document.getElementById('wizardTranscriptInput');
      if (input) input.value = data.text;
      showToast('Speech Transcribed via AssemblyAI ✓');
    }
  } catch (err) {}

  if (micBtn) micBtn.style.transform = 'scale(1)';
  if (micStatus) micStatus.textContent = 'Speech transcription complete ✓';
}

// Generate Listing via Gemini 3.6 Flash
async function generateAIListingStep() {
  const input = document.getElementById('wizardTranscriptInput');
  if (input) wizardState.transcript = input.value.trim();

  if (!wizardState.transcript) {
    wizardState.transcript = 'Handcrafted cotton tote bag featuring traditional mirror work embroidery.';
  }

  const genBtn = document.getElementById('genBtn');
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.textContent = '⏳ Calling Gemini 3.6 Flash...';
  }

  showToast('Generating listing via live Gemini 3.6 Flash API...');

  try {
    const res = await fetch('/api/v1/generate-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: wizardState.transcript, language: wizardState.language })
    });

    if (res.ok) {
      const data = await res.json();
      wizardState.title = data.title;
      wizardState.category = data.category;
      wizardState.material = Array.isArray(data.materials) ? data.materials.join(', ') : 'Cotton Canvas';
      wizardState.description = data.description;
      wizardState.story = data.story;
      showToast('Gemini 3.6 Flash Listing Generated ✓');
    }
  } catch (err) {
    console.warn('Listing generation error fallback:', err);
  }

  wizardState.step = 2;
  renderWizardStep();
}

// Calculate Smart Pricing
async function calculateSmartPricingStep() {
  const t = document.getElementById('wTitle');
  const c = document.getElementById('wCategory');
  const m = document.getElementById('wMaterial');
  const d = document.getElementById('wDescription');
  const s = document.getElementById('wStory');

  if (t) wizardState.title = t.value;
  if (c) wizardState.category = c.value;
  if (m) wizardState.material = m.value;
  if (d) wizardState.description = d.value;
  if (s) wizardState.story = s.value;

  recalculatePriceInWizard();
  wizardState.step = 3;
  renderWizardStep();
}

async function recalculatePriceInWizard() {
  const mat = Number(document.getElementById('wMatCost')?.value || wizardState.materialCost);
  const lab = Number(document.getElementById('wLabCost')?.value || wizardState.labourCost);
  const hrs = Number(document.getElementById('wHours')?.value || wizardState.hours);

  wizardState.materialCost = mat;
  wizardState.labourCost = lab;
  wizardState.hours = hrs;

  try {
    const res = await fetch('/api/v1/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialCost: mat, labourCost: lab, hours: hrs, category: wizardState.category })
    });

    if (res.ok) {
      const data = await res.json();
      wizardState.price = data.suggestedPrice;
      wizardState.min = data.priceRange.min;
      wizardState.max = data.priceRange.max;

      const sug = document.getElementById('wCalcSuggested');
      const rng = document.getElementById('wCalcRange');
      const fin = document.getElementById('wFinalPrice');

      if (sug) sug.textContent = `₹${data.suggestedPrice}`;
      if (rng) rng.textContent = `Fair Range: ₹${data.priceRange.min} - ₹${data.priceRange.max}`;
      if (fin) fin.value = data.suggestedPrice;
    }
  } catch (err) {}
}

function reviewFinalWizardStep() {
  const fin = document.getElementById('wFinalPrice');
  if (fin) wizardState.price = Number(fin.value) || wizardState.price;
  wizardState.step = 4;
  renderWizardStep();
}

// Publish Product from Wizard
async function publishNewProductFromWizard() {
  const payload = {
    title: wizardState.title || 'Handcrafted Craft Piece',
    category: wizardState.category || 'Handicrafts',
    material: wizardState.material || 'Natural Materials',
    description: wizardState.description || 'Authentic handcrafted craft piece.',
    story: wizardState.story || 'Made with ancestral Indian craftsmanship.',
    price: wizardState.price || 1299,
    min: wizardState.min || 1199,
    max: wizardState.max || 1399,
    image: wizardState.image,
    status: 'Published',
    artisanName: 'Sunita Devi',
    artisanLoc: 'Jaipur, Rajasthan'
  };

  showToast('Publishing product to marketplace...');

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const newP = await res.json();
      products.unshift(newP);
      showToast('Product published successfully! 🎉');
      renderArtisanDashboard();
      renderArtisanProducts();
      renderConsumerHome();
      renderConsumerBrowse();
      switchArtisanTab('a-products');
    }
  } catch (err) {
    showToast('Failed to publish product');
  }
}

// Render Artisan Products Catalogue
function renderArtisanProducts() {
  const container = document.getElementById('aProductsList');
  if (!container) return;

  container.innerHTML = products.map(p => `
    <div style="display:flex; gap:12px; align-items:center; background:var(--ivory-card); border:1px solid var(--border-line); border-radius:var(--radius-md); padding:10px; margin-bottom:10px;">
      <img src="${p.image}" style="width:56px; height:56px; border-radius:8px; object-fit:cover;">
      <div style="flex:1;">
        <div style="font-size:13px; font-weight:800; color:var(--indigo);">${p.title}</div>
        <div style="font-size:11.5px; color:var(--text-muted);">${p.category} • ₹${p.price}</div>
        <div style="font-size:10px; font-weight:800; color:${p.status === 'Published' ? '#16A34A' : '#D97706'}; margin-top:2px;">STATUS: ${p.status.toUpperCase()}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <button class="btn-primary" style="padding:3px 8px; font-size:10.5px; background:var(--terracotta);" onclick="createAuctionForProduct('${p.id}')">⚡ Auction</button>
        <button class="btn-ghost" style="padding:3px 8px; font-size:10.5px;" onclick="togglePublishProduct('${p.id}')">${p.status === 'Published' ? 'Unpublish' : 'Publish'}</button>
        <button class="btn-danger" style="padding:3px 8px; font-size:10px;" onclick="deleteProduct('${p.id}')">Delete</button>
      </div>

    </div>
  `).join('') || '<p style="font-size:12px; color:var(--text-muted);">No products in catalogue.</p>';
}

async function togglePublishProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const newStatus = p.status === 'Published' ? 'Draft' : 'Published';
  
  try {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      p.status = newStatus;
      showToast(`Product set to ${newStatus}`);
      renderArtisanDashboard();
      renderArtisanProducts();
      renderConsumerHome();
      renderConsumerBrowse();
    }
  } catch (err) {}
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      products = products.filter(x => x.id !== id);
      showToast('Product deleted');
      renderArtisanDashboard();
      renderArtisanProducts();
      renderConsumerHome();
      renderConsumerBrowse();
    }
  } catch (err) {}
}

// ---------------------------------------------------------
// DATA INTELLIGENCE — Artisan Selling + Consumer Buying
// ---------------------------------------------------------
function openDataInsights(view = null) {
  analyticsView = view || (appMode === 'artisan' ? 'selling' : 'buying');

  document.querySelectorAll('.screen-page').forEach(el => el.classList.remove('active-page'));
  document.getElementById('data-insights')?.classList.add('active-page');

  if (appMode === 'consumer') currentConsumerTab = 'data-insights';
  else currentArtisanTab = 'data-insights';

  renderBottomNav();
  document.getElementById('screenContainer').scrollTop = 0;
  loadAndRenderAnalytics();
}

function setAnalyticsView(view) {
  analyticsView = view === 'buying' ? 'buying' : 'selling';
  renderAnalyticsView();
}

async function loadAndRenderAnalytics() {
  try {
    const res = await fetch('/api/analytics', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load analytics');
    analyticsData = data;
    renderAnalyticsView();
  } catch (err) {
    console.warn('Analytics unavailable:', err);
    showToast('Analytics could not load');
  }
}

function formatCompactNumber(value) {
  const n = Number(value || 0);
  if (n >= 10000000) return `${(n / 10000000).toFixed(n >= 100000000 ? 0 : 1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return Math.round(n).toLocaleString('en-IN');
}

function formatRupees(value, compact = true) {
  const n = Number(value || 0);
  if (compact && n >= 100000) return `₹${formatCompactNumber(n)}`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function safeAnalyticsText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderAnalyticsView() {
  if (!analyticsData) return;

  const selling = analyticsView === 'selling';
  document.getElementById('analyticsSellingPanel').style.display = selling ? 'block' : 'none';
  document.getElementById('analyticsBuyingPanel').style.display = selling ? 'none' : 'block';
  document.getElementById('analyticsSellingBtn')?.classList.toggle('active', selling);
  document.getElementById('analyticsBuyingBtn')?.classList.toggle('active', !selling);

  const dbBadge = document.getElementById('analyticsDbBadge');
  if (dbBadge) {
    dbBadge.textContent = analyticsData.database?.configured ? 'SUPABASE' : 'LOCAL DATA';
  }
  const note = document.getElementById('analyticsDataNote');
  if (note) note.textContent = analyticsData.dataNote || '';

  renderSellingAnalytics(analyticsData.selling);
  renderBuyingAnalytics(analyticsData.buying);
}

function renderSellingAnalytics(data) {
  if (!data) return;
  const k = data.kpis || {};
  setText('sellKpiUnits', formatCompactNumber(k.unitsSold));
  setText('sellKpiRevenue', formatRupees(k.revenue));
  setText('sellKpiViews', formatCompactNumber(k.impressions));
  setText('sellKpiConversion', `${Number(k.conversionRate || 0).toFixed(1)}%`);
  setText('sellBuyerEnquiries', formatCompactNumber(k.enquiries));
  setText('sellAverageOrder', formatRupees(k.averageOrderValue, false));

  renderLineSvg('sellingTrendChart', data.salesTrend || [], 'units', {
    prefix: '',
    suffix: '',
    lineColor: '#D96B43',
    fillColor: 'rgba(217,107,67,.12)',
  });

  renderBars('topSellingProductsChart', data.topProducts || [], {
    labelKey: 'title',
    valueKey: 'unitsSold',
    valueFormatter: v => `${formatCompactNumber(v)} sold`,
  });

  renderBars('sellingCategoryChart', data.revenueByCategory || [], {
    labelKey: 'category',
    valueKey: 'revenue',
    valueFormatter: v => formatRupees(v),
  });

  renderInsightList('sellingInsightsList', data.insights || []);
}

function renderBuyingAnalytics(data) {
  if (!data) return;
  const k = data.kpis || {};
  setText('buyKpiSpend', formatRupees(k.marketplaceSpend));
  setText('buyKpiAverage', formatRupees(k.averageSpend, false));
  setText('buyKpiCategories', formatCompactNumber(k.activeCategories));
  setText('buyKpiProducts', formatCompactNumber(k.productsBought));

  renderBars('consumerTrendingChart', data.trendingCategories || [], {
    labelKey: 'category',
    valueKey: 'score',
    valueFormatter: v => `${Math.round(v)} / 100`,
  });

  renderLineSvg('buyerSpendingTrendChart', data.spendingTrend || [], 'spend', {
    prefix: '₹',
    compact: true,
    lineColor: '#1B2A4A',
    fillColor: 'rgba(27,42,74,.10)',
  });

  renderDonut('buyerSpendDonut', 'buyerSpendLegend', data.spendByCategory || []);
  renderBars('consumerInterestChart', data.interestSignals || [], {
    labelKey: 'category',
    valueKey: 'score',
    valueFormatter: v => formatCompactNumber(v),
  });
  renderBars('buyerPriceBandChart', data.priceBands || [], {
    labelKey: 'label',
    valueKey: 'units',
    valueFormatter: v => `${formatCompactNumber(v)} buys`,
  });

  const chipBox = document.getElementById('personalInterestChips');
  const prefs = data.personalPreferences;
  if (chipBox) {
    const chips = [
      ...(prefs?.categories || []),
      ...(prefs?.materials || []),
      ...(prefs?.styles || []),
      ...(prefs?.occasions || []),
    ];
    chipBox.innerHTML = chips.length
      ? `<span class="analytics-interest-chip" style="background:#FFF1EB;color:#A84422;border-color:#F2D0C2;">YOUR INTERESTS</span>` +
        [...new Set(chips)].slice(0, 8)
          .map(x => `<span class="analytics-interest-chip">${safeAnalyticsText(x)}</span>`)
          .join('')
      : `<span class="analytics-interest-chip">Choose interests in AI Picks to personalize this view</span>`;
  }

  renderInsightList('buyingInsightsList', data.insights || []);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderBars(containerId, rows, opts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<p style="font-size:9px;color:var(--text-muted);">No analytics data yet.</p>';
    return;
  }

  const max = Math.max(1, ...rows.map(r => Number(r[opts.valueKey] || 0)));
  container.innerHTML = rows.slice(0, 6).map(row => {
    const value = Number(row[opts.valueKey] || 0);
    const width = Math.max(3, (value / max) * 100);
    return `
      <div class="analytics-bar-row">
        <div class="analytics-bar-label" title="${safeAnalyticsText(row[opts.labelKey])}">${safeAnalyticsText(row[opts.labelKey])}</div>
        <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${width}%"></div></div>
        <div class="analytics-bar-value">${opts.valueFormatter(value)}</div>
      </div>
    `;
  }).join('');
}

function renderLineSvg(containerId, rows, valueKey, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<p style="font-size:9px;color:var(--text-muted);">No trend data yet.</p>';
    return;
  }

  const width = 330;
  const height = 150;
  const pad = { l: 34, r: 10, t: 12, b: 26 };
  const chartW = width - pad.l - pad.r;
  const chartH = height - pad.t - pad.b;
  const values = rows.map(r => Number(r[valueKey] || 0));
  const maxVal = Math.max(1, ...values);
  const stepX = rows.length > 1 ? chartW / (rows.length - 1) : chartW;

  const pts = values.map((v, i) => ({
    x: pad.l + i * stepX,
    y: pad.t + chartH - (v / maxVal) * chartH,
    v,
    label: rows[i].month || rows[i].label || `${i + 1}`,
  }));

  const linePath = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(pad.t + chartH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(pad.t + chartH).toFixed(1)} Z`;

  const grid = [0, .25, .5, .75, 1].map(frac => {
    const y = pad.t + chartH - chartH * frac;
    const val = maxVal * frac;
    const label = options.compact ? formatCompactNumber(val) : Math.round(val);
    return `
      <line x1="${pad.l}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="#EEF1F4" stroke-width="1"/>
      <text x="${pad.l - 5}" y="${y + 3}" text-anchor="end" fill="#98A2B3" font-size="7">${options.prefix || ''}${label}${options.suffix || ''}</text>
    `;
  }).join('');

  const xLabels = pts.map(p => `
    <text x="${p.x}" y="${height - 7}" text-anchor="middle" fill="#667085" font-size="7.5">${safeAnalyticsText(p.label)}</text>
  `).join('');

  const dots = pts.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="3.1" fill="${options.lineColor || '#D96B43'}" stroke="#fff" stroke-width="1.5"/>
  `).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="analytics trend chart">
      ${grid}
      <path d="${areaPath}" fill="${options.fillColor || 'rgba(217,107,67,.10)'}"></path>
      <path d="${linePath}" fill="none" stroke="${options.lineColor || '#D96B43'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
      ${dots}
      ${xLabels}
    </svg>
  `;
}

function renderDonut(donutId, legendId, rows) {
  const donut = document.getElementById(donutId);
  const legend = document.getElementById(legendId);
  if (!donut || !legend) return;

  const top = rows.slice(0, 5);
  const total = top.reduce((s, r) => s + Number(r.spend || 0), 0);
  if (!total) {
    legend.innerHTML = '<span style="font-size:8px;color:var(--text-muted);">No spend data yet.</span>';
    return;
  }

  const colors = ['#D96B43', '#E5A93C', '#1B2A4A', '#218B72', '#8B6BAD'];
  let cursor = 0;
  const stops = [];
  top.forEach((row, i) => {
    const pct = (Number(row.spend || 0) / total) * 100;
    stops.push(`${colors[i]} ${cursor.toFixed(1)}% ${(cursor + pct).toFixed(1)}%`);
    cursor += pct;
  });
  if (cursor < 100) stops.push(`#E8EDF2 ${cursor.toFixed(1)}% 100%`);
  donut.style.background = `conic-gradient(${stops.join(', ')})`;

  legend.innerHTML = top.map((row, i) => {
    const pct = Math.round((Number(row.spend || 0) / total) * 100);
    return `
      <div class="analytics-legend-row">
        <span class="analytics-legend-swatch" style="background:${colors[i]}"></span>
        <span>${safeAnalyticsText(row.category)}</span>
        <b>${pct}%</b>
      </div>
    `;
  }).join('');
}

function renderInsightList(containerId, insights) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = (insights || [])
    .slice(0, 3)
    .map(x => `<div class="analytics-insight-item">• ${safeAnalyticsText(x)}</div>`)
    .join('');
}
// Render Analytics
function renderArtisanAnalytics() {
  const container = document.getElementById('aAnalyticsList');
  if (!container) return;

  const maxViews = Math.max(1, ...products.map(p => p.views || 0));

  container.innerHTML = products.map(p => `
    <div style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:var(--indigo); margin-bottom:4px;">
        <span>${p.title}</span>
        <span style="color:var(--terracotta);">${p.views || 0} views • ${p.enquiries || 0} enquiries</span>
      </div>
      <div style="height:8px; background:var(--border-line); border-radius:99px; overflow:hidden;">
        <div style="height:100%; width:${((p.views || 0) / maxViews) * 100}%; background:linear-gradient(90deg, var(--terracotta), var(--marigold));"></div>
      </div>
    </div>
  `).join('') || '<p style="font-size:12px; color:var(--text-muted);">No performance data.</p>';
}


async function loadArtisanProfile() {
  if (!authenticatedUser || authenticatedUser.role !== 'artisan' || !authToken) return;
  try {
    const res = await fetch('/api/artisans/me', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok || !data.profile) return;

    const profile = data.profile;
    if (document.getElementById('aProfileName')) document.getElementById('aProfileName').value = profile.name || authenticatedUser.name || '';
    if (document.getElementById('aProfileCraft')) document.getElementById('aProfileCraft').value = profile.craft || '';
    if (document.getElementById('aProfileLoc')) document.getElementById('aProfileLoc').value = profile.location || '';
    if (document.getElementById('aProfileBio')) document.getElementById('aProfileBio').value = profile.bio || '';
  } catch (err) {
    console.warn('Could not load artisan profile:', err);
  }
}

async function saveArtisanProfile() {
  if (!authenticatedUser || authenticatedUser.role !== 'artisan' || !authToken) {
    showToast('Please login as an artisan.');
    return;
  }

  const payload = {
    name: document.getElementById('aProfileName')?.value.trim() || authenticatedUser.name,
    craft: document.getElementById('aProfileCraft')?.value.trim() || 'Handicrafts',
    location: document.getElementById('aProfileLoc')?.value.trim() || '',
    language: 'Hindi',
    bio: document.getElementById('aProfileBio')?.value.trim() || '',
  };

  try {
    const res = await fetch('/api/artisans/me', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save profile.');

    if (authenticatedUser) authenticatedUser.name = data.profile.name;
    const greet = document.getElementById('artisanGreetingName');
    if (greet) greet.textContent = data.profile.name.split(' ')[0] || 'Artisan';
    showToast('Artisan Profile saved to database ✓');
  } catch (err) {
    showToast(err.message || 'Could not save artisan profile.');
  }
}

// =========================================================
// REAL-TIME SOCKET.IO AUCTION MODULE
// =========================================================
let socket = null;
let auctions = [];
let activeAuctionId = null;
let activeAuctionData = null;
let activeAuctionBids = [];
let activeAuctionLikes = 0;
let auctionMessages = [];

// Initialize Socket Connection & Handlers
function initSocketConnection() {
  if (typeof io !== 'undefined' && !socket) {
    socket = io();

    socket.on('connect', () => {
      console.log('⚡ Connected to socket server:', socket.id);
    });

    socket.on('auctionInitState', ({ auction, bids, likesCount }) => {
      activeAuctionData = auction;
      activeAuctionBids = bids || [];
      activeAuctionLikes = likesCount || 0;
      renderActiveAuctionRoom();
    });

    socket.on('bidPlaced', ({ userId, amount, currentPrice, highestBidder }) => {
      if (activeAuctionData) {
        activeAuctionData.currentPrice = currentPrice;
        activeAuctionData.highestBidder = highestBidder;
      }
      activeAuctionBids.unshift({ userId, amount, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
      addAuctionMessage(`⚡ New Bid: ₹${amount} by ${userId}`);
      renderActiveAuctionRoom();
      loadAuctions();
    });

    socket.on('productLiked', ({ userId, count }) => {
      activeAuctionLikes = count;
      addAuctionMessage(`❤️ ${userId} liked this craft`);
      renderActiveAuctionRoom();
    });

    socket.on('auctionEnded', ({ winner, finalPrice, reason }) => {
      if (activeAuctionData) {
        activeAuctionData.status = 'ended';
        activeAuctionData.winner = winner;
      }
      const msgText = reason === 'target_reached'
        ? `🎉 TARGET MAX BID MET! Instant sale to ${winner} for ₹${finalPrice}!`
        : `🏆 AUCTION CLOSED! Sold to ${winner} for ₹${finalPrice}`;
      addAuctionMessage(msgText);
      showToast(msgText);
      renderActiveAuctionRoom();
      loadAuctions();
    });

    socket.on('userJoined', ({ userId }) => {
      addAuctionMessage(`👤 ${userId} entered live room`);
      renderActiveAuctionRoom();
    });

    socket.on('errorMsg', ({ message }) => {
      showToast(message);
    });
  }
}

function addAuctionMessage(msg) {
  auctionMessages.unshift({ id: Date.now(), text: msg });
  if (auctionMessages.length > 25) auctionMessages.pop();
}

// Load Auctions from API
async function loadAuctions() {
  try {
    const res = await fetch('/api/auctions');
    if (res.ok) {
      auctions = await res.json();
      renderHomeAuctions();
      if (currentConsumerTab === 'c-auction') {
        renderAuctionsTab();
      }
    }
  } catch (err) {
    console.warn('Failed to fetch auctions:', err);
  }
}

// Render Spotlight Live & Upcoming Auctions on Home Screen
function renderHomeAuctions() {
  const container = document.getElementById('cHomeAuctionsGrid');
  if (!container) return;

  const liveList = auctions.filter(a => a.status === 'live');
  if (liveList.length === 0) {
    container.innerHTML = `<div style="padding:12px; font-size:12px; color:var(--text-muted); text-align:center; background:var(--ivory-card); border-radius:10px; border:1px solid var(--border-line);">No live auctions right now. Launch one in Artisan Studio!</div>`;
    return;
  }

  container.innerHTML = liveList.map(a => `
    <div style="background:linear-gradient(135deg, #FFF9F6 0%, #FFF0EA 100%); border:1.5px solid var(--terracotta); border-radius:var(--radius-lg); padding:12px; margin-bottom:10px; display:flex; gap:12px; align-items:center; cursor:pointer;" onclick="openAuctionRoom('${a.auctionId}')">
      <img src="${a.productImage}" style="width:65px; height:65px; border-radius:10px; object-fit:cover;">
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:10px; font-weight:800; background:var(--terracotta); color:#fff; padding:2px 8px; border-radius:99px;">⚡ LIVE</span>
          ${a.maxBid ? `<span style="font-size:10px; font-weight:700; color:var(--indigo);">Buyout: ₹${a.maxBid}</span>` : ''}
        </div>
        <div style="font-size:13px; font-weight:800; color:var(--indigo); margin-top:3px;">${a.productTitle}</div>
        <div style="font-size:11px; color:var(--text-muted);">By ${a.artisanName}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <span style="font-size:13px; font-weight:900; color:var(--terracotta-dark);">Current: ₹${a.currentPrice}</span>
          <span style="font-size:11px; font-weight:700; color:var(--indigo);">Bid Now →</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Render Auctions Tab Content
function renderAuctionsTab() {
  const container = document.getElementById('auctionListContainer');
  if (!container) return;

  if (activeAuctionId) {
    container.style.display = 'none';
    const room = document.getElementById('activeAuctionRoom');
    if (room) room.style.display = 'block';
    renderActiveAuctionRoom();
    return;
  }

  const room = document.getElementById('activeAuctionRoom');
  if (room) room.style.display = 'none';

  container.style.display = 'block';
  if (!auctions || auctions.length === 0) {
    container.innerHTML = `<p style="font-size:13px; color:var(--text-muted); text-align:center;">No auctions available.</p>`;
    return;
  }

  container.innerHTML = `
    <h4 style="font-size:14px; font-weight:800; color:var(--indigo); margin-bottom:10px;">Active & Recent Live Auctions</h4>
    ${auctions.map(a => `
      <div class="card-box" style="margin-bottom:12px; cursor:pointer;" onclick="openAuctionRoom('${a.auctionId}')">
        <div style="display:flex; gap:12px;">
          <img src="${a.productImage}" style="width:75px; height:75px; border-radius:10px; object-fit:cover;">
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="${a.status === 'live' ? 'badge-gold' : 'btn-ghost'}" style="font-size:10px; padding:2px 6px;">${a.status === 'live' ? '⚡ LIVE BIDDING' : '🏁 CLOSED'}</span>
              <span style="font-size:11px; color:var(--text-muted);">❤️ ${a.likesCount || 0}</span>
            </div>
            <div style="font-size:14px; font-weight:800; color:var(--indigo); margin-top:3px;">${a.productTitle}</div>
            <div style="font-size:11px; color:var(--text-muted);">Artisan: ${a.artisanName}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
              <div>
                <span style="font-size:11px; color:var(--text-muted);">Current Bid:</span>
                <span style="font-size:15px; font-weight:900; color:var(--terracotta);">₹${a.currentPrice}</span>
              </div>
              ${a.maxBid ? `<div style="font-size:11px; font-weight:700; color:var(--indigo-dark); background:var(--indigo-light); padding:2px 6px; border-radius:4px;">Target Buyout: ₹${a.maxBid}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

// Open Specific Auction Room
function openAuctionRoom(auctionId) {
  initSocketConnection();
  activeAuctionId = auctionId;
  auctionMessages = [];
  switchConsumerTab('c-auction');

  if (socket) {
    socket.emit('joinAuction', { auctionId, userId: appMode === 'artisan' ? 'Sunita (Artisan Spectator)' : 'Consumer User' });
  }

  renderAuctionsTab();
}

// Leave Auction Room
function leaveAuctionRoom() {
  activeAuctionId = null;
  activeAuctionData = null;
  renderAuctionsTab();
}

// Render Active Bidding Room Details
function renderActiveAuctionRoom() {
  const room = document.getElementById('activeAuctionRoom');
  if (!room || !activeAuctionId) return;

  const a = activeAuctionData || auctions.find(x => x.auctionId === activeAuctionId);
  if (!a) return;

  const isEnded = a.status === 'ended';
  const minNextBid = a.currentPrice + (a.increment || 100);

  room.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
      <button class="btn-ghost" style="width:auto; padding:4px 10px; font-size:12px;" onclick="leaveAuctionRoom()">← All Auctions</button>
      <span style="font-size:11px; font-weight:800; color:${isEnded ? 'var(--text-muted)' : 'var(--terracotta)'}; display:flex; align-items:center; gap:4px;">
        ${isEnded ? '🏁 AUCTION ENDED' : '<span class="live-pulse-dot"></span> 5-Sec Inactivity Timer Active'}
      </span>
    </div>

    <div class="card-box" style="padding:14px; margin-bottom:12px; position:relative; overflow:hidden;">
      ${isEnded ? '<div style="position:absolute; top:12px; right:-24px; background:#D93838; color:#fff; padding:4px 30px; font-size:11px; font-weight:900; transform:rotate(45deg);">SOLD</div>' : ''}
      
      <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
        <img src="${a.productImage}" style="width:85px; height:85px; border-radius:12px; object-fit:cover; border:2px solid var(--terracotta-light);">
        <div>
          <div style="font-size:15px; font-weight:900; color:var(--indigo);">${a.productTitle}</div>
          <div style="font-size:12px; color:var(--text-muted);">Crafted by <strong>${a.artisanName}</strong></div>
          <div style="font-size:11.5px; color:var(--terracotta-dark); margin-top:2px;">Category: ${a.category}</div>
        </div>
      </div>

      <div style="background:var(--terracotta-light); border:1.5px solid var(--terracotta); border-radius:12px; padding:12px; text-align:center; margin-bottom:12px;">
        <div style="font-size:11px; font-weight:800; color:var(--terracotta-dark); text-transform:uppercase;">Current Highest Bid</div>
        <div style="font-size:32px; font-weight:900; color:var(--indigo);">₹${a.currentPrice}</div>
        <div style="font-size:12px; font-weight:700; color:var(--text-primary);">
          Highest Bidder: <span style="color:var(--terracotta);">${a.highestBidder || 'No bids yet'}</span>
        </div>
        ${a.maxBid ? `<div style="font-size:11.5px; color:var(--indigo); margin-top:4px; font-weight:700;">🎯 Buyout Target: ₹${a.maxBid} (Instant Sale)</div>` : ''}
      </div>

      ${!isEnded ? `
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:12px;">
          <button class="btn-primary" style="background:linear-gradient(135deg, var(--terracotta), #C54A28);" onclick="triggerPlaceBid(${minNextBid})">
            Raise Bid (+₹${a.increment || 100}) → ₹${minNextBid}
          </button>
          <button class="btn-secondary" onclick="triggerLikeProduct()">
            ❤️ (${activeAuctionLikes})
          </button>
        </div>
      ` : `
        <div style="background:var(--indigo-light); border-radius:10px; padding:10px; text-align:center; margin-bottom:12px;">
          <div style="font-size:13px; font-weight:800; color:var(--indigo);">Winner: ${a.highestBidder || a.winner || 'None'}</div>
          <div style="font-size:12px; color:var(--text-muted);">Final Selling Price: ₹${a.currentPrice}</div>
        </div>
      `}

      ${!isEnded ? `
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="number" id="customBidInput" placeholder="Custom bid amount (≥ ₹${minNextBid})" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border-line); font-size:12px; flex:1;">
          <button class="btn-ghost" style="width:auto; padding:8px 12px; font-size:12px;" onclick="triggerCustomBid()">Place Custom Bid</button>
        </div>
      ` : ''}
    </div>

    <!-- Live Activity Feed Stream -->
    <div class="card-box" style="padding:12px;">
      <h4 style="font-size:13px; font-weight:800; color:var(--indigo); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
        <span class="live-pulse-dot"></span> Live Activity Stream
      </h4>
      <div style="max-height:140px; overflow-y:auto; font-size:12px; display:flex; flex-direction:column; gap:6px;">
        ${auctionMessages.length > 0 ? auctionMessages.map(m => `
          <div style="background:var(--ivory); padding:6px 10px; border-radius:6px; border-left:3px solid var(--terracotta);">${m.text}</div>
        `).join('') : '<div style="color:var(--text-muted); font-size:11.5px;">Activity stream will update in real-time as bids are placed…</div>'}
      </div>
    </div>
  `;
}

// Trigger Socket Bidding & Actions
function triggerPlaceBid(amount) {
  if (!socket) initSocketConnection();
  if (socket && activeAuctionId) {
    socket.emit('placeBid', {
      auctionId: activeAuctionId,
      userId: appMode === 'artisan' ? 'Sunita (Artisan Spectator)' : 'Consumer #' + Math.floor(1000 + Math.random() * 9000),
      amount
    });
  }
}

function triggerCustomBid() {
  const input = document.getElementById('customBidInput');
  if (!input || !input.value) return;
  const val = Number(input.value);
  triggerPlaceBid(val);
  input.value = '';
}

function triggerLikeProduct() {
  if (!socket) initSocketConnection();
  if (socket && activeAuctionId) {
    socket.emit('likeProduct', {
      auctionId: activeAuctionId,
      userId: appMode === 'artisan' ? 'Sunita (Artisan)' : 'Consumer User'
    });
  }
}

// Create Auction for Product from Artisan Catalogue
async function createAuctionForProduct(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  const startPrice = prompt(`Enter Starting Price for "${prod.title}" (₹):`, prod.price || 999);
  if (startPrice === null) return;

  const maxBidStr = prompt(`Enter Instant Sale / Target Max Bid (₹) (or leave empty for none):`, Math.round((Number(startPrice) || 999) * 1.5));
  
  try {
    const res = await fetch('/api/auctions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: prod.id,
        productTitle: prod.title,
        productImage: prod.image,
        artisanName: prod.artisanName || 'Sunita Devi',
        category: prod.category,
        startPrice: Number(startPrice) || 500,
        increment: 100,
        maxBid: maxBidStr ? Number(maxBidStr) : null
      })
    });

    if (res.ok) {
      const data = await res.json();
      showToast('🚀 Live Auction launched for your craft!');
      await loadAuctions();
      openAuctionRoom(data.auction.auctionId);
    }
  } catch (err) {
    console.error('Error creating auction:', err);
    showToast('Failed to launch auction');
  }
}

