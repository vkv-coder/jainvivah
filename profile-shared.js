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

const FAMILY_TYPE_OPTIONS = ["Joint", "Nuclear"];

const LIVING_STATUS_OPTIONS = ["Living", "Late"];

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
// telling the member exactly what is missing. Family (step 4) has no
// required fields.
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
  5: [
    ["pref_age_min", "Looking for: age from"],
    ["pref_age_max", "Looking for: age to"]
  ]
};

// Checks a profile row against every required field across steps 1-3 and
// 5, plus mobile (from the contact row) and at least one photo (step 6).
// Returns an array of { step, label } for anything missing (empty array
// means the profile is complete and ready to submit).
function findMissingFields(profile, contact, photoCount) {
  const missing = [];

  Object.keys(REQUIRED_FIELDS).forEach((stepKey) => {
    const step = Number(stepKey);
    REQUIRED_FIELDS[step].forEach(([field, label]) => {
      const value = profile ? profile[field] : null;
      if (value === null || value === undefined || value === "") {
        missing.push({ step: step, label: label });
      }
    });
  });

  if (!contact || !contact.mobile) {
    missing.push({ step: 6, label: "Mobile number" });
  }
  if (!photoCount || photoCount < 1) {
    missing.push({ step: 6, label: "At least one photo" });
  }

  return missing;
}

// A short human-friendly code used only for the manual WhatsApp
// verification message, e.g. "JV4F2A9C1B".
function generateProfileCode(userId) {
  return "JV" + userId.replace(/-/g, "").slice(0, 8).toUpperCase();
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
// Photo manager — identical UI/behaviour used by register.html (step 6)
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
        '<input type="file" id="mt-photo-input" accept="image/*">' +
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
      await supabaseClient.from("mt_photos").update({ is_primary: true }).eq("id", remaining[0].id);
    }

    toast("Photo deleted.", "success");
    render();
  }

  return {
    render: render,
    countPhotos: async () => (await fetchPhotos()).length
  };
}
