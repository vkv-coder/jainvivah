// Shared logic for Jain Vivah. Loaded by every page, after config.js and
// the Supabase CDN script.
//
// IMPORTANT ASSUMPTION: this batch only knows the *names* of the tables
// (mt_profiles, mt_admins), not their exact columns, because the tables
// already exist in Supabase and were not created by this code. We assume:
//   - mt_profiles has a primary key column "id" that equals auth.uid()
//     (the standard Supabase pattern: id uuid references auth.users(id)),
//     plus a boolean column "profile_complete".
//   - mt_admins has a column "id" that equals auth.uid() for the admin user.
// If your tables use different column names (e.g. "user_id"), change the
// two constants below and everything else keeps working.
const PROFILES_ID_COLUMN = "id";
const ADMINS_ID_COLUMN = "id";

// One shared Supabase client for the whole app.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------

// Call this at the top of any page that requires a logged-in user.
// Redirects to index.html when there is no active session.
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  return session;
}

// Decide where a logged-in user should land, based on their mt_profiles row.
async function routeAfterLogin() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from("mt_profiles")
    .select("*")
    .eq(PROFILES_ID_COLUMN, user.id)
    .maybeSingle();

  if (error) {
    toast("Could not check your profile. Please try again.", "error");
    return;
  }

  if (!profile || profile.profile_complete === false) {
    window.location.href = "register.html";
  } else {
    window.location.href = "browse.html";
  }
}

// Returns true if the current user is listed in mt_admins.
async function isAdmin() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabaseClient
    .from("mt_admins")
    .select(ADMINS_ID_COLUMN)
    .eq(ADMINS_ID_COLUMN, user.id)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

// ---------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------

// Small slide-in notice. type is "success" | "error" | "info".
function toast(message, type) {
  type = type || "info";

  let container = document.getElementById("mt-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "mt-toast-container";
    document.body.appendChild(container);
  }

  const note = document.createElement("div");
  note.className = "mt-toast mt-toast-" + type;
  note.textContent = message;
  container.appendChild(note);

  // Force a layout so the slide-in transition actually plays.
  requestAnimationFrame(() => note.classList.add("mt-toast-show"));

  setTimeout(() => {
    note.classList.remove("mt-toast-show");
    setTimeout(() => note.remove(), 300);
  }, 3500);
}

// ---------------------------------------------------------------------
// Small data helpers
// ---------------------------------------------------------------------

// Age in whole years from a "YYYY-MM-DD" date of birth.
function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Converts centimetres to a "5 ft 7 in" style string.
function cmToFeet(cm) {
  if (!cm || isNaN(cm)) return "";
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet++;
    inches = 0;
  }
  return feet + " ft " + inches + " in";
}

// Escapes text before it is inserted into the page as HTML, so member
// input can never break the layout or run as script.
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------
// Register the service worker (best-effort, ignored on unsupported browsers).
// ---------------------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Offline support is a nice-to-have; failure here should never block the app.
    });
  });
}
