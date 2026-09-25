// Shared constants and helpers for the profile form (register.html) and
// the profile editor (myprofile.html). Loaded after app.js on both pages.

// ---------------------------------------------------------------------
// Dropdown option lists
// ---------------------------------------------------------------------

const SECT_OPTIONS = [
  "Shwetambar Murtipujak",
  "Shwetambar Sthanakvasi",
  "Shwetambar Terapanthi",
  "Digambar",
  "Other"
];

// mt_profiles has check constraints that only accept these exact lowercase
// codes. Options below are [label, code] pairs: the label is shown to the
// member, the code is what gets stored (and is used as the <option value>,
// so no conversion is needed at save time).
const DIET_OPTIONS = [
  ["Jain", "jain"],
  ["Vegetarian", "veg"],
  ["Vegan", "vegan"],
  ["Other", "other"]
];

const MARITAL_STATUS_OPTIONS = [
  ["Unmarried", "unmarried"],
  ["Divorced", "divorced"],
  ["Widow", "widow"],
  ["Widower", "widower"]
];

// Codes accepted by mt_profiles.gender, mapped back to a friendly label
// for display (e.g. the locked gender box on register.html/myprofile.html).
const GENDER_LABELS = { male: "Male", female: "Female" };

// mt_profiles' check constraints only accept exact lowercase codes for
// gender, diet, marital_status and managed_by. The dropdowns already use
// the code as their <option value>, but this is applied a final time,
// right before every write, as a safety net against stale/mixed-case
// values (e.g. an older cached mt_signup in localStorage).
function normaliseCode(value) {
  return (value || "").toString().trim().toLowerCase();
}

const EDUCATION_OPTIONS = [
  "Below Graduate", "B.Com", "B.A", "B.Sc", "B.E/B.Tech", "BBA", "BCA",
  "CA", "CS", "MBBS", "BDS", "LLB", "M.Com", "M.A", "M.Sc", "M.E/M.Tech",
  "MBA", "PhD", "Other"
];

const PROFESSION_OPTIONS = [
  "Business", "Job", "Professional Practice", "Doctor", "CA", "Engineer",
  "Government Service", "Teaching", "Homemaker", "Student", "Other"
];

const ANNUAL_INCOME_OPTIONS = [
  "Below 3 Lakh", "3-5 Lakh", "5-10 Lakh", "10-15 Lakh", "15-25 Lakh",
  "25-50 Lakh", "Above 50 Lakh"
];

// Height dropdown: 4'6" to 6'6", stored as centimetres. Used for the
// member's own height and for the "looking for" height range.
function buildHeightOptions() {
  const options = [];
  for (let totalInches = 54; totalInches <= 78; totalInches++) {
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    const cm = Math.round(totalInches * 2.54);
    options.push({ cm: cm, label: feet + "'" + inches + '" (' + cm + " cm)" });
  }
  return options;
}

const DOB_MONTHS = [
  ["1", "January"], ["2", "February"], ["3", "March"], ["4", "April"],
  ["5", "May"], ["6", "June"], ["7", "July"], ["8", "August"],
  ["9", "September"], ["10", "October"], ["11", "November"], ["12", "December"]
];

// Fills the Day / Month / Year dropdowns used for date of birth, always in
// that fixed left-to-right order so the form reads as DD / MM / YYYY on
// every device regardless of locale.
function populateDobDropdowns(daySelect, monthSelect, yearSelect) {
  daySelect.innerHTML = '<option value="" disabled selected>Day</option>';
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = String(d);
    opt.textContent = String(d);
    daySelect.appendChild(opt);
  }

  monthSelect.innerHTML = '<option value="" disabled selected>Month</option>';
  DOB_MONTHS.forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    monthSelect.appendChild(opt);
  });

  yearSelect.innerHTML = '<option value="" disabled selected>Year</option>';
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 18; y >= currentYear - 90; y--) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }
}

// ---------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------

// Jain Vivah's minimum-age rule: women must be 18+, men must be 21+.
// gender is the lowercase code ("male" / "female") stored in mt_profiles.
// Returns an error message string, or null if the date of birth is fine.
function checkAgeRule(dob, gender) {
  const age = calcAge(dob);
  if (age === null) return "Please enter a valid date of birth.";
  if (gender === "female" && age < 18) {
    return "Sorry, a woman's profile can only be created at age 18 or above.";
  }
  if (gender === "male" && age < 21) {
    return "Sorry, a man's profile can only be created at age 21 or above.";
  }
  return null;
}

// Fields required (marked *) on each step, and a friendly label for
// telling the member exactly what is missing. Every non-mandatory field
// (extended family, sub caste, education/occupation detail, hobbies,
// about, alternate mobile, address, partner-preference details beyond
// age) was deliberately removed from the form — see CLAUDE.md.
const REQUIRED_FIELDS = {
  1: [
    ["full_name", "Full name"],
    ["gender", "Gender"],
    ["dob", "Date of birth"],
    ["height_cm", "Height"],
    ["weight_kg", "Weight"],
    ["marital_status", "Marital status"],
    ["diet", "Diet"]
  ],
  2: [
    ["sect", "Sect"],
    ["city", "City"],
    ["state", "State"]
  ],
  3: [
    ["education", "Education"],
    ["profession", "Profession"],
    ["annual_income", "Annual income"]
  ],
  4: [
    ["pref_age_min", "Looking for: age from"],
    ["pref_age_max", "Looking for: age to"]
  ]
};

// Students and homemakers typically have no income of their own - annual
// income is skipped as a required field for these two professions (still
// fine to fill in if they want to).
const PROFESSIONS_WITHOUT_INCOME = ["Student", "Homemaker"];

// Checks a profile row against every required field across steps 1-4,
// plus mobile (from the contact row) and at least one photo (step 5).
// Returns an array of { step, label } for anything missing (empty array
// means the profile is complete and ready to submit).
function findMissingFields(profile, contact, photoCount) {
  const missing = [];
  const incomeExempt = !!(profile && PROFESSIONS_WITHOUT_INCOME.includes(profile.profession));

  Object.keys(REQUIRED_FIELDS).forEach((stepKey) => {
    const step = Number(stepKey);
    REQUIRED_FIELDS[step].forEach(([field, label]) => {
      if (field === "annual_income" && incomeExempt) return;
      const value = profile ? profile[field] : null;
      if (value === null || value === undefined || value === "") {
        missing.push({ step: step, label: label });
      }
    });
  });

  if (!contact || !contact.mobile) {
    missing.push({ step: 5, label: "Mobile number" });
  }
  if (!photoCount || photoCount < 1) {
    missing.push({ step: 5, label: "At least one photo" });
  }

  return missing;
}

// A short human-friendly code used only for the manual WhatsApp
// verification message, e.g. "JV4F2A9C1B".
function generateProfileCode(userId) {
  return "JV" + userId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

// ---------------------------------------------------------------------
// Multi-select checkbox list (used for Education - two or more degrees)
// with an "Other, please specify" text field. Stored on mt_profiles as a
// single comma-separated text value, e.g. "B.Com, M.Com" - no schema
// change needed since education has no CHECK constraint.
// ---------------------------------------------------------------------

function renderCheckboxList(containerEl, options) {
  containerEl.innerHTML = options
    .map((opt) => {
      const id = containerEl.id + "-" + opt.replace(/[^a-z0-9]/gi, "_");
      return (
        '<label for="' + id + '"><input type="checkbox" id="' + id + '" value="' + escapeHtml(opt) + '">' +
        escapeHtml(opt) + "</label>"
      );
    })
    .join("");
}

// Wires the "Other" checkbox inside a rendered checkbox list to show/hide
// a free-text field right below it.
function wireOtherToggle(containerEl, otherWrapEl) {
  const otherBox = containerEl.querySelector('input[value="Other"]');
  if (!otherBox) return;
  otherBox.addEventListener("change", () => {
    otherWrapEl.style.display = otherBox.checked ? "block" : "none";
  });
}

// Reads the checked boxes into a comma-separated string. If "Other" is
// checked and the free-text field has a value, that typed text replaces
// the literal word "Other" in the result.
function getCheckboxListValue(containerEl, otherInputEl) {
  const values = Array.from(containerEl.querySelectorAll("input[type=checkbox]:checked")).map((cb) => cb.value);
  const otherIndex = values.indexOf("Other");
  if (otherIndex !== -1) {
    const otherText = (otherInputEl.value || "").trim();
    if (otherText) values[otherIndex] = otherText;
  }
  return values.join(", ");
}

// Prefills a rendered checkbox list from a stored comma-separated string.
// Any part that doesn't match a known checkbox value is treated as a
// custom "Other" entry.
function setCheckboxListValue(containerEl, otherWrapEl, otherInputEl, csvValue) {
  const parts = (csvValue || "").split(",").map((p) => p.trim()).filter(Boolean);
  const knownValues = Array.from(containerEl.querySelectorAll("input[type=checkbox]")).map((cb) => cb.value);
  let hasOther = false;
  let otherText = "";

  parts.forEach((part) => {
    if (knownValues.includes(part)) {
      const cb = containerEl.querySelector('input[value="' + CSS.escape(part) + '"]');
      if (cb) cb.checked = true;
    } else {
      hasOther = true;
      otherText = part;
    }
  });

  const otherBox = containerEl.querySelector('input[value="Other"]');
  if (hasOther && otherBox) {
    otherBox.checked = true;
    otherWrapEl.style.display = "block";
    otherInputEl.value = otherText;
  }
}

// ---------------------------------------------------------------------
// Image resizing (runs entirely in the browser — the original file
// never leaves the device).
// ---------------------------------------------------------------------

function resizeImageToBlob(file) {
  const MAX_SIDE = 1000;
  const QUALITY = 0.72;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = (readEvent) => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file does not look like a valid image."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_SIDE) {
          height = Math.round((height * MAX_SIDE) / width);
          width = MAX_SIDE;
        } else if (height >= width && height > MAX_SIDE) {
          width = Math.round((width * MAX_SIDE) / height);
          height = MAX_SIDE;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not process that image."));
          },
          "image/jpeg",
          QUALITY
        );
      };
      img.src = readEvent.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------
// Photo manager — identical UI/behaviour used by register.html (step 5)
// and myprofile.html. Renders into containerEl and wires up its own
// upload/delete/set-primary handlers.
// ---------------------------------------------------------------------

const MAX_PHOTOS = 3;
const PHOTOS_BUCKET = "mt-photos";

function createPhotoManager(containerEl, userId, onChange) {
  async function fetchPhotos() {
    const { data, error } = await supabaseClient
      .from("mt_photos")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) {
      toast("Could not load your photos.", "error");
      return [];
    }
    return data || [];
  }

  async function render() {
    const photos = await fetchPhotos();

    // Fetch a short-lived signed URL for each thumbnail — photos are
    // private, so nothing here is ever a public link.
    const withUrls = await Promise.all(
      photos.map(async (photo) => {
        const { data } = await supabaseClient.storage
          .from(PHOTOS_BUCKET)
          .createSignedUrl(photo.storage_path, 60);
        return { photo: photo, url: data ? data.signedUrl : "" };
      })
    );

    let html = '<div class="mt-photo-grid">';
    withUrls.forEach(({ photo, url }) => {
      html += '<div class="mt-photo-item">';
      // draggable=false and oncontextmenu=false are a basic deterrent
      // against casual right-click-save / drag-out of the thumbnail.
      html +=
        '<img src="' + escapeHtml(url) + '" alt="Profile photo" draggable="false" oncontextmenu="return false">';
      if (photo.is_primary) {
        html += '<span class="mt-photo-badge">Primary</span>';
      }
      html += '<div class="mt-photo-actions">';
      if (!photo.is_primary) {
        html += '<button type="button" class="mt-btn-mini" data-action="primary" data-id="' + escapeHtml(photo.id) + '">Set primary</button>';
      }
      html += '<button type="button" class="mt-btn-mini mt-btn-mini-danger" data-action="delete" data-id="' + escapeHtml(photo.id) + '" data-path="' + escapeHtml(photo.storage_path) + '">Delete</button>';
      html += '</div></div>';
    });
    html += "</div>";

    if (photos.length < MAX_PHOTOS) {
      html +=
        '<div class="mt-field">' +
        '<label for="mt-photo-input">Add a photo (' + photos.length + '/' + MAX_PHOTOS + ')</label>' +
        '<input type="file" id="mt-photo-input" accept="image/*,.heic,.heif">' +
        "</div>";
    } else {
      html += '<p class="mt-hint">Maximum of ' + MAX_PHOTOS + ' photos reached. Delete one to add another.</p>';
    }

    html +=
      '<p class="mt-hint">Please upload a clear face photo of the person only. ' +
      "Do not write any phone number or ID on the photo.</p>";

    containerEl.innerHTML = html;

    const fileInput = document.getElementById("mt-photo-input");
    if (fileInput) {
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        await uploadPhoto(file, photos.length);
      });
    }

    containerEl.querySelectorAll('[data-action="primary"]').forEach((btn) => {
      btn.addEventListener("click", () => setPrimary(btn.dataset.id));
    });
    containerEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", () => deletePhoto(btn.dataset.id, btn.dataset.path));
    });

    if (onChange) onChange(photos.length);
  }

  async function uploadPhoto(file, currentCount) {
    toast("Uploading photo...", "info");
    let blob;
    try {
      blob = await resizeImageToBlob(file);
    } catch (err) {
      toast(err.message, "error");
      return;
    }

    const path = userId + "/" + crypto.randomUUID() + ".jpg";
    const { error: uploadError } = await supabaseClient.storage
      .from(PHOTOS_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });

    if (uploadError) {
      toast("Photo upload failed: " + uploadError.message, "error");
      return;
    }

    const { error: insertError } = await supabaseClient.from("mt_photos").insert({
      user_id: userId,
      storage_path: path,
      sort_order: currentCount,
      is_primary: currentCount === 0
    });

    if (insertError) {
      toast("Could not save the photo record: " + insertError.message, "error");
      return;
    }

    toast("Photo added.", "success");
    render();
  }

  async function setPrimary(photoId) {
    await supabaseClient.from("mt_photos").update({ is_primary: false }).eq("user_id", userId);
    const { error } = await supabaseClient
      .from("mt_photos")
      .update({ is_primary: true })
      .eq("id", photoId);

    if (error) {
      toast("Could not update primary photo.", "error");
      return;
    }
    render();
  }

  async function deletePhoto(photoId, storagePath) {
    if (!confirm("Delete this photo? This cannot be undone.")) return;
    await supabaseClient.storage.from(PHOTOS_BUCKET).remove([storagePath]);
    const { error } = await supabaseClient.from("mt_photos").delete().eq("id", photoId);

    if (error) {
      toast("Could not delete the photo.", "error");
      return;
    }

    // If the deleted photo was the primary one, promote the next photo.
    const remaining = await fetchPhotos();
    const stillHasPrimary = remaining.some((p) => p.is_primary);
    if (!stillHasPrimary && remaining.length > 0) {
      const { error: promoteError } = await supabaseClient.from("mt_photos").update({ is_primary: true }).eq("id", remaining[0].id);
      if (promoteError) console.error("Failed to promote next primary photo:", promoteError);
    }

    toast("Photo deleted.", "success");
    render();
  }

  return {
    render: render,
    countPhotos: async () => (await fetchPhotos()).length
  };
}
